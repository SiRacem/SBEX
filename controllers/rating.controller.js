// server/controllers/rating.controller.js
const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const User = require('../models/User'); // Ensure User model has: claimedLevelRewards: [Number], reputationLevel: String, etc.
const MediationRequest = require('../models/MediationRequest');
const Notification = require('../models/Notification');

// --- Dynamic Level and Reward Calculation Constants ---
const BASE_POINTS_FOR_LEVEL_2 = 10;
const POINTS_INCREMENT_PER_LEVEL_STEP = 5;
const BASE_REWARD_FOR_LEVEL_2 = 2;
const REWARD_INCREMENT_PER_LEVEL = 2;
const DEFAULT_CURRENCY = 'TND';
const MAX_LEVEL_CAP = 100;

// --- Helper Functions (Internal to this module) ---

/**
 * Calculates the total cumulative reputation points required to reach a specific target level.
 */
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

/**
 * Calculates the monetary reward for achieving a specific target level.
 */
function calculateRewardForLevel(targetLevel) {
    if (targetLevel < 2) return { amount: 0, currency: DEFAULT_CURRENCY };
    const rewardAmount = BASE_REWARD_FOR_LEVEL_2 + (targetLevel - 2) * REWARD_INCREMENT_PER_LEVEL;
    return { amount: rewardAmount, currency: DEFAULT_CURRENCY };
}

/**
 * Determines the reputation badge based on the user's numeric level.
 */
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
    return 'Novice'; // Default for levels 1-2
}

/**
 * Updates the user's numeric level and reputation badge based on their current reputation points.
 * This function modifies the userDoc directly.
 */
const updateUserLevelAndBadge = (userDoc) => { // Exported, so can be used by other controllers
    if (!userDoc) {
        console.error("updateUserLevelAndBadge called with undefined userDoc");
        return false;
    }
    let madeChanges = false;
    const oldNumericLevel = userDoc.level;
    const oldBadge = userDoc.reputationLevel;

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
        console.log(`User ${userDoc._id} numeric level changing from ${oldNumericLevel} to ${newNumericLevel} (Points: ${userDoc.reputationPoints})`);
        userDoc.level = newNumericLevel;
        madeChanges = true;
    }

    const newBadge = determineReputationBadge(userDoc.level);
    if (userDoc.reputationLevel !== newBadge) {
        console.log(`User ${userDoc._id} reputation badge changing from ${oldBadge} to ${newBadge} (Level: ${userDoc.level})`);
        userDoc.reputationLevel = newBadge;
        madeChanges = true;
    }
    return madeChanges;
};

/**
 * Processes rewards if a new numeric level is achieved and the reward for that level has not been claimed yet.
 * This function modifies the userDoc directly if a reward is given.
 */
const processLevelUpRewards = async (userDoc, oldNumericLevelBeforePointsUpdate, session) => { // Exported
    if (!userDoc) {
        console.error("processLevelUpRewards called with undefined userDoc");
        return false;
    }
    let rewardProcessedThisCall = false;

    for (let achievedLevel = oldNumericLevelBeforePointsUpdate + 1; achievedLevel <= userDoc.level; achievedLevel++) {
        if (achievedLevel > MAX_LEVEL_CAP) break;
        const rewardDetails = calculateRewardForLevel(achievedLevel);
        if (rewardDetails.amount > 0 && !(userDoc.claimedLevelRewards || []).includes(achievedLevel)) {
            userDoc.balance = (userDoc.balance || 0) + rewardDetails.amount;
            if (!Array.isArray(userDoc.claimedLevelRewards)) userDoc.claimedLevelRewards = [];
            userDoc.claimedLevelRewards.push(achievedLevel);
            rewardProcessedThisCall = true;
            console.log(`User ${userDoc._id} received reward of ${rewardDetails.amount} ${rewardDetails.currency} for newly reaching Level ${achievedLevel}. New balance: ${userDoc.balance}`);
            await Notification.create([{
                user: userDoc._id, type: 'LEVEL_UP_REWARD',
                title: `🎉 Congratulations! You've reached Level ${achievedLevel}!`,
                message: `You have received a reward of ${rewardDetails.amount} ${rewardDetails.currency} for reaching Level ${achievedLevel}. Keep up the great work!`,
                relatedEntity: { id: userDoc._id, modelName: 'User' }
            }], { session });
        } else if (rewardDetails.amount > 0 && (userDoc.claimedLevelRewards || []).includes(achievedLevel)) {
            console.log(`User ${userDoc._id} has already claimed the reward for Level ${achievedLevel}.`);
        }
    }
    return rewardProcessedThisCall;
};

// --- Main Controller Functions defined with const ---
const submitRating = async (req, res) => {
    const raterId = req.user._id;
    const { ratedUserId, ratingType, comment, mediationRequestId } = req.body;

    console.log(`--- Controller: submitRating by Rater: ${raterId} for User: ${ratedUserId} (Type: ${ratingType}) for Mediation: ${mediationRequestId} ---`);

    if (!ratedUserId || !ratingType || !mediationRequestId) return res.status(400).json({ msg: "Rated user ID, rating type, and mediation request ID are required." });
    if (!mongoose.Types.ObjectId.isValid(ratedUserId) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) return res.status(400).json({ msg: "Invalid ID format for rated user or mediation request." });
    if (!['like', 'dislike'].includes(ratingType)) return res.status(400).json({ msg: "Invalid rating type. Must be 'like' or 'dislike'." });
    if (raterId.equals(ratedUserId)) return res.status(400).json({ msg: "You cannot rate yourself." });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title')
            .populate('seller', '_id fullName')
            .populate('buyer', '_id fullName')
            .populate('mediator', '_id fullName')
            .session(session);

        if (!mediationRequest) { await session.abortTransaction(); await session.endSession(); return res.status(404).json({ msg: "Mediation request not found." }); }
        if (mediationRequest.status !== 'Completed') { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "Ratings can only be submitted for completed mediations." }); }

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
        if (!isValidParticipantPair) { await session.abortTransaction(); await session.endSession(); return res.status(403).json({ msg: "You are not authorized to rate this user for this transaction, or the rated user is not part of this transaction." }); }

        const existingRating = await Rating.findOne({ rater: raterId, ratedUser: ratedUserId, mediationRequestId }).session(session);
        if (existingRating) { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "You have already rated this user for this mediation transaction." }); }

        const newRating = new Rating({ rater: raterId, ratedUser: ratedUserId, mediationRequestId, product: mediationRequest.product?._id, ratingType, comment: comment || undefined });
        await newRating.save({ session });
        console.log("New rating saved:", newRating._id);

        const ratedUserDoc = await User.findById(ratedUserId).session(session);
        if (!ratedUserDoc) { throw new Error(`Rated user ${ratedUserId} not found.`); }

        const oldNumericLevelBeforePointsUpdate = ratedUserDoc.level;
        const oldBadgeBeforeUpdate = ratedUserDoc.reputationLevel;

        let reputationChange = (ratingType === 'like') ? 3 : -2;
        let ratingFieldToUpdate = (ratingType === 'like') ? 'positiveRatings' : 'negativeRatings';

        ratedUserDoc[ratingFieldToUpdate] = (ratedUserDoc[ratingFieldToUpdate] || 0) + 1;
        ratedUserDoc.reputationPoints = (ratedUserDoc.reputationPoints || 0) + reputationChange;
        if (ratedUserDoc.reputationPoints < 0) ratedUserDoc.reputationPoints = 0;

        let userDocChangedByPointsOrRatingField = true; // Since points/rating field definitely changed

        const structuralChangesFromLevelBadge = updateUserLevelAndBadge(ratedUserDoc);
        const rewardWasProcessed = await processLevelUpRewards(ratedUserDoc, oldNumericLevelBeforePointsUpdate, session);

        if (userDocChangedByPointsOrRatingField || structuralChangesFromLevelBadge || rewardWasProcessed) {
            await ratedUserDoc.save({ session });
            console.log(`User ${ratedUserDoc._id} saved with all updates.`);

            if (structuralChangesFromLevelBadge && ratedUserDoc.reputationLevel !== oldBadgeBeforeUpdate) {
                // Send a badge notification if the badge specifically changed,
                // and it's not already covered by a more specific "Level Up + Reward" notification
                // for the *exact same new level* the badge corresponds to.
                let isRewardNotificationSufficient = false;
                if (rewardWasProcessed) {
                    // Check if the reward was for the *current* new level that also triggered this badge change
                    const rewardInfoForCurrentNewLevel = calculateRewardForLevel(ratedUserDoc.level);
                    if (rewardInfoForCurrentNewLevel.amount > 0 && (ratedUserDoc.claimedLevelRewards || []).includes(ratedUserDoc.level) && oldNumericLevelBeforePointsUpdate < ratedUserDoc.level) {
                        isRewardNotificationSufficient = true;
                    }
                }

                if (!isRewardNotificationSufficient) {
                    await Notification.create([{
                        user: ratedUserDoc._id, type: 'BADGE_UNLOCKED',
                        title: `🏅 Reputation Update: You are now ${ratedUserDoc.reputationLevel}!`,
                        message: `Your reputation status has been updated to ${ratedUserDoc.reputationLevel}.`,
                        relatedEntity: { id: ratedUserDoc._id, modelName: 'User' }
                    }], { session });
                    console.log(`User ${ratedUserDoc._id} received a badge update notification to ${ratedUserDoc.reputationLevel}.`);
                }
            }
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
                productsSoldCount: ratedUserDoc.productsSoldCount
            };
            req.io.emit('user_profile_updated', updatedProfileSummary);
            console.log(`SOCKET: Emitted 'user_profile_updated' for user ${updatedProfileSummary._id}`);
        }
        res.status(201).json({ msg: "Rating submitted successfully!", rating: newRating });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error submitting rating:", error.message, error.stack);
        const statusCode = error.isOperationalError ? 400 : (error.status || 500); // Differentiate known vs unknown errors
        res.status(statusCode).json({ msg: error.message || 'Failed to submit rating.' });
    } finally {
        if (session) await session.endSession();
    }
};

const getRatingsForMediation = async (req, res) => {
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

// --- Export all functions at the end ---
module.exports = {
    submitRating,
    getRatingsForMediation,
    updateUserLevelAndBadge,    // Exported for potential use in mediationController
    processLevelUpRewards,      // Exported for potential use in mediationController
    calculateCumulativePointsForLevel, // Exported for potential use
    // determineReputationBadge // Exported for potential use
};