// server/controllers/rating.controller.js
const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const User = require('../models/User');
const MediationRequest = require('../models/MediationRequest');
const Notification = require('../models/Notification');

// --- Dynamic Level and Reward Calculation Constants ---
const BASE_POINTS_FOR_LEVEL_2 = 10;
const POINTS_INCREMENT_PER_LEVEL_STEP = 5;
const BASE_REWARD_FOR_LEVEL_2 = 2;
const REWARD_INCREMENT_PER_LEVEL = 2;
const DEFAULT_CURRENCY = 'TND';
const MAX_LEVEL_CAP = 100;

// --- Helper Functions (Internal or to be exported) ---
function calculateCumulativePointsForLevel(targetLevel) {
    if (targetLevel <= 1) return 0;
    let totalPoints = 0;
    let pointsForCurrentStep = BASE_POINTS_FOR_LEVEL_2;
    for (let level = 2; level <= targetLevel; level++) {
        totalPoints += pointsForCurrentStep;
        if (level < targetLevel) {
            pointsForCurrentStep += POINTS_INCREMENT_PER_LEVEL_STEP;
        }
    }
    return totalPoints;
}

function calculateRewardForLevel(targetLevel) {
    if (targetLevel < 2) return { amount: 0, currency: DEFAULT_CURRENCY };
    const rewardAmount = BASE_REWARD_FOR_LEVEL_2 + (targetLevel - 2) * REWARD_INCREMENT_PER_LEVEL;
    return { amount: rewardAmount, currency: DEFAULT_CURRENCY };
}

function determineReputationBadge(numericLevel) {
    if (numericLevel >= 35) return 'Mythic';
    if (numericLevel >= 30) return 'Legend';
    if (numericLevel >= 25) return 'Grandmaster';
    if (numericLevel >= 20) return 'Master';
    if (numericLevel >= 15) return 'Diamond';
    if (numericLevel >= 10) return 'Platinum';
    if (numericLevel >= 7) return 'Gold';
    if (numericLevel >= 5) return 'Silver';
    if (numericLevel >= 3) return 'Bronze';
    return 'Novice';
}

// --- Functions to be Exported ---
const updateUserLevelAndBadge = (userDoc) => {
    if (!userDoc) return false;
    let madeChanges = false;
    let newNumericLevel = 1;
    for (let levelCheck = MAX_LEVEL_CAP; levelCheck >= 2; levelCheck--) {
        if (userDoc.reputationPoints >= calculateCumulativePointsForLevel(levelCheck)) {
            newNumericLevel = levelCheck;
            break;
        }
    }
    if (userDoc.reputationPoints < calculateCumulativePointsForLevel(2)) {
        newNumericLevel = 1;
    }
    if (userDoc.level !== newNumericLevel) {
        console.log(`User ${userDoc._id} numeric level changing from ${userDoc.level} to ${newNumericLevel} (Points: ${userDoc.reputationPoints})`);
        userDoc.level = newNumericLevel;
        madeChanges = true;
    }
    const newBadge = determineReputationBadge(userDoc.level);
    if (userDoc.reputationLevel !== newBadge) {
        console.log(`User ${userDoc._id} reputation badge changing from ${userDoc.reputationLevel} to ${newBadge}`);
        userDoc.reputationLevel = newBadge;
        madeChanges = true;
    }
    return madeChanges;
};

const processLevelUpRewards = async (userDoc, oldNumericLevelBeforePointsUpdate, session) => {
    if (!userDoc) return false;
    let rewardProcessed = false;
    if (userDoc.level > oldNumericLevelBeforePointsUpdate) {
        for (let achievedLevel = oldNumericLevelBeforePointsUpdate + 1; achievedLevel <= userDoc.level; achievedLevel++) {
            if (achievedLevel > MAX_LEVEL_CAP) break;
            const rewardDetails = calculateRewardForLevel(achievedLevel);
            if (rewardDetails.amount > 0 && !(userDoc.claimedLevelRewards || []).includes(achievedLevel)) {
                userDoc.balance = (userDoc.balance || 0) + rewardDetails.amount;
                if (!userDoc.claimedLevelRewards) userDoc.claimedLevelRewards = [];
                userDoc.claimedLevelRewards.push(achievedLevel);
                rewardProcessed = true;
                console.log(`User ${userDoc._id} received reward of ${rewardDetails.amount} ${rewardDetails.currency} for newly reaching Level ${achievedLevel}. New balance: ${userDoc.balance}`);
                await Notification.create([{
                    user: userDoc._id, type: 'LEVEL_UP_REWARD',
                    title: `🎉 Congratulations! You've reached Level ${achievedLevel}!`,
                    message: `You have received a reward of ${rewardDetails.amount} ${rewardDetails.currency} for reaching Level ${achievedLevel}. Keep up the great work!`,
                    relatedEntity: { id: userDoc._id, modelName: 'User' }
                }], { session });
            } else if (rewardDetails.amount > 0 && (userDoc.claimedLevelRewards || []).includes(achievedLevel)) {
                console.log(`User ${userDoc._id} has already claimed the reward for Level ${achievedLevel}, even if re-attained.`);
            }
        }
    }
    return rewardProcessed;
};

const submitRating = async (req, res) => { // <<< تعريف الدالة هنا
    const raterId = req.user._id;
    const { ratedUserId, ratingType, comment, mediationRequestId } = req.body;

    console.log(`--- Controller: submitRating by Rater: ${raterId} for User: ${ratedUserId} (Type: ${ratingType}) for Mediation: ${mediationRequestId} ---`);

    if (!ratedUserId || !ratingType || !mediationRequestId) return res.status(400).json({ msg: "Rated user ID, rating type, and mediation request ID are required." });
    if (!mongoose.Types.ObjectId.isValid(ratedUserId) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) return res.status(400).json({ msg: "Invalid ID format." });
    if (!['like', 'dislike'].includes(ratingType)) return res.status(400).json({ msg: "Invalid rating type." });
    if (raterId.equals(ratedUserId)) return res.status(400).json({ msg: "You cannot rate yourself." });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId).populate('product', 'title').populate('seller', '_id fullName').populate('buyer', '_id fullName').populate('mediator', '_id fullName').session(session);
        if (!mediationRequest) { await session.abortTransaction(); await session.endSession(); return res.status(404).json({ msg: "Mediation request not found." }); }
        if (mediationRequest.status !== 'Completed') { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "Ratings can only be for completed mediations." }); }

        const isRaterSeller = mediationRequest.seller._id.equals(raterId);
        const isRaterBuyer = mediationRequest.buyer._id.equals(raterId);
        const isRaterMediator = mediationRequest.mediator?._id.equals(raterId);
        const isRatedSeller = mediationRequest.seller._id.equals(ratedUserId);
        const isRatedBuyer = mediationRequest.buyer._id.equals(ratedUserId);
        const isRatedMediator = mediationRequest.mediator?._id.equals(ratedUserId);
        let isValidParticipantPair = false;
        if (isRaterBuyer && (isRatedSeller || (isRatedMediator && mediationRequest.mediator))) isValidParticipantPair = true;
        else if (isRaterSeller && (isRatedBuyer || (isRatedMediator && mediationRequest.mediator))) isValidParticipantPair = true;
        else if (isRaterMediator && (isRatedSeller || isRatedBuyer)) isValidParticipantPair = true;
        if (!isValidParticipantPair) { await session.abortTransaction(); await session.endSession(); return res.status(403).json({ msg: "Unauthorized to rate this user for this transaction." }); }

        const existingRating = await Rating.findOne({ rater: raterId, ratedUser: ratedUserId, mediationRequestId }).session(session);
        if (existingRating) { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "You have already rated this user for this transaction." }); }

        const newRating = new Rating({ rater: raterId, ratedUser: ratedUserId, mediationRequestId, product: mediationRequest.product?._id, ratingType, comment: comment || undefined });
        await newRating.save({ session });
        console.log("New rating saved:", newRating._id);

        const ratedUserDoc = await User.findById(ratedUserId).session(session);
        if (!ratedUserDoc) { throw new Error(`Rated user ${ratedUserId} not found.`); }

        const oldNumericLevelBeforePointsUpdate = ratedUserDoc.level;
        let reputationChange = (ratingType === 'like') ? 3 : -2;
        let ratingFieldToUpdate = (ratingType === 'like') ? 'positiveRatings' : 'negativeRatings';

        ratedUserDoc[ratingFieldToUpdate] = (ratedUserDoc[ratingFieldToUpdate] || 0) + 1;
        ratedUserDoc.reputationPoints = (ratedUserDoc.reputationPoints || 0) + reputationChange;
        if (ratedUserDoc.reputationPoints < 0) ratedUserDoc.reputationPoints = 0;

        const structuralChangesMade = updateUserLevelAndBadge(ratedUserDoc);
        const rewardWasProcessed = await processLevelUpRewards(ratedUserDoc, oldNumericLevelBeforePointsUpdate, session);

        if (structuralChangesMade || rewardWasProcessed || ratingFieldToUpdate) {
            if (structuralChangesMade && !rewardWasProcessed && oldNumericLevelBeforePointsUpdate === ratedUserDoc.level) {
                await Notification.create([{
                    user: ratedUserDoc._id, type: 'BADGE_UPDATED',
                    title: `🏅 Reputation Update: You are now ${ratedUserDoc.reputationLevel}!`,
                    message: `Your reputation level has been updated to ${ratedUserDoc.reputationLevel}.`,
                    relatedEntity: { id: ratedUserDoc._id, modelName: 'User' }
                }], { session });
            }
            await ratedUserDoc.save({ session });
            console.log(`User ${ratedUserDoc._id} saved with updates.`);
        }

        const raterInfo = await User.findById(raterId).select('fullName').lean().session(session);
        if (raterInfo) {
            const productTitle = mediationRequest.product?.title || 'the transaction';
            const cmt = comment ? ` Comment: "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"` : "";
            await Notification.create([{ user: ratedUserId, type: 'RATING_RECEIVED', title: `New Rating: ${ratingType}!`, message: `${raterInfo.fullName} gave you a ${ratingType} for "${productTitle}".${cmt}`, relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' } }], { session });
        }

        await session.commitTransaction();
        console.log("Transaction committed successfully.");

        if (req.io) {
            const updatedProfileSummary = {
                _id: ratedUserDoc._id.toString(), reputationPoints: ratedUserDoc.reputationPoints,
                level: ratedUserDoc.level, reputationLevel: ratedUserDoc.reputationLevel,
                balance: ratedUserDoc.balance, positiveRatings: ratedUserDoc.positiveRatings,
                negativeRatings: ratedUserDoc.negativeRatings, claimedLevelRewards: ratedUserDoc.claimedLevelRewards,
                // أضف productsSoldCount إذا كان يتم تحديثه هنا أيضًا
                productsSoldCount: ratedUserDoc.productsSoldCount
            };
            req.io.emit('user_profile_updated', updatedProfileSummary);
            console.log(`SOCKET: Emitted 'user_profile_updated' for user ${updatedProfileSummary._id}`);
        }
        res.status(201).json({ msg: "Rating submitted successfully!", rating: newRating });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error submitting rating:", error.message, error.stack);
        const statusCode = error.isOperationalError ? 400 : (error.status || 500);
        res.status(statusCode).json({ msg: error.message || 'Failed to submit rating.' });
    } finally {
        if (session) await session.endSession();
    }
};

const getRatingsForMediation = async (req, res) => { // <<< تعريف الدالة هنا
    const { mediationRequestId } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID." });
        }
        const ratings = await Rating.find({ mediationRequestId })
            .populate('rater', 'fullName avatarUrl')
            .populate('ratedUser', 'fullName avatarUrl')
            .sort({ createdAt: -1 });
        res.status(200).json(ratings);
    } catch (error) {
        console.error("Error fetching ratings for mediation:", error);
        res.status(500).json({ msg: "Server error fetching ratings.", errorDetails: error.message });
    }
};

// --- [!!!] تصدير الدوال بشكل صحيح [!!!] ---
module.exports = {
    submitRating,               // تصدير الدالة المعرفة أعلاه
    getRatingsForMediation,     // تصدير الدالة المعرفة أعلاه
    updateUserLevelAndBadge,    // تصدير الدالة المساعدة
    processLevelUpRewards,      // تصدير الدالة المساعدة
    // إذا أردت تصدير الدوال الأخرى، يمكنك إضافتها هنا أيضًا
    // calculateCumulativePointsForLevel,
    // calculateRewardForLevel,
    // determineReputationBadge
};