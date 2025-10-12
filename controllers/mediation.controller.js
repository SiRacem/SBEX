// controllers/mediation.controller.js

const MediationRequest = require('../models/MediationRequest');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const PendingFund = require('../models/PendingFund');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { sendUserStatsUpdate } = require('./user.controller');
const { updateUserLevelAndBadge, processLevelUpRewards } = require('./rating.controller');
const config = require('config');

// --- ثوابت العملات وأسعار الصرف ---
const TND_USD_EXCHANGE_RATE = config.get('TND_USD_EXCHANGE_RATE') || 3.0;
const PLATFORM_BASE_CURRENCY = config.get('PLATFORM_BASE_CURRENCY') || 'TND';

const { calculateMediatorFeeDetails } = require('../utils/feeCalculator');

// --- دالة مساعدة لتنسيق العملة ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") safeCurrencyCode = "TND";
    try {
        return num.toLocaleString("fr-TN", { style: "currency", currency: safeCurrencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) { return `${num.toFixed(2)} ${safeCurrencyCode}`; }
};

// --- Helper Function: Initiate Mediation Chat ---
async function initiateMediationChat(mediationRequestId, callingFunctionName = "UnknownFunction") {
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[${callingFunctionName} -> initiateMediationChat] Starting chat initiation process for MediationRequest: ${mediationRequestId}`);

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', '_id title')
            .populate('mediator', '_id fullName')
            .populate('seller', '_id fullName')
            .populate('buyer', '_id fullName')
            .session(session);

        if (!mediationRequest) {
            throw new Error(`MediationRequest ${mediationRequestId} not found during chat initiation.`);
        }

        if (mediationRequest.status !== 'PartiesConfirmed') {
            console.warn(`[initiateMediationChat] Attempted to start chat for ${mediationRequestId} but status is ${mediationRequest.status}, not 'PartiesConfirmed'. Aborting chat initiation.`);
            await session.abortTransaction();
            return;
        }

        mediationRequest.status = 'InProgress';
        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({
            event: "Mediation chat initiated by system",
            timestamp: new Date(),
            details: { previousStatus: 'PartiesConfirmed' }
        });
        await mediationRequest.save({ session });
        console.log(`   [initiateMediationChat] MediationRequest ${mediationRequestId} status updated to 'InProgress'.`);

        if (mediationRequest.product && mediationRequest.product._id) {
            await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'InProgress' } }, { session });
            console.log(`   [initiateMediationChat] Product ${mediationRequest.product._id} status updated to 'InProgress'.`);
        }

        if (mediationRequest.mediator && mediationRequest.mediator._id) {
            await User.findByIdAndUpdate(mediationRequest.mediator._id, { $set: { mediatorStatus: 'Busy' } }, { session });
            console.log(`   [initiateMediationChat] Mediator ${mediationRequest.mediator._id} status updated to 'Busy'.`);
        }

        const productTitle = mediationRequest.product?.title || 'the transaction';
        const mediatorName = mediationRequest.mediator?.fullName || 'The Assigned Mediator';
        const commonMessage = `All parties have confirmed for "${productTitle}". The mediation process and chat have now started with ${mediatorName}.`;
        const notificationTypeStart = 'MEDIATION_STARTED';

        const notificationsToSend = [
            { user: mediationRequest.seller._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } },
            { user: mediationRequest.buyer._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } },
            { user: mediationRequest.mediator._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } }
        ];
        await Notification.insertMany(notificationsToSend, { session });
        console.log(`   [initiateMediationChat] MEDIATION_STARTED notifications sent for ${mediationRequestId}.`);

        await session.commitTransaction();
        console.log(`[initiateMediationChat] Chat initiation committed for MediationRequest: ${mediationRequestId}`);

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error(`[initiateMediationChat] Error during chat initiation for ${mediationRequestId}:`, error);
    } finally {
        await session.endSession();
    }
}

exports.getMediationRequestDetailsController = async (req, res) => {
    console.log("--- Controller: getMediationRequestDetailsController ---");
    try {
        const { mediationRequestId } = req.params;
        const userId = req.user._id;
        const userRole = req.user.userRole;

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID." });
        }

        const request = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title imageUrls currency agreedPrice bidAmount bidCurrency')
            .populate('seller', '_id fullName avatarUrl userRole')
            .populate('buyer', '_id fullName avatarUrl userRole')
            .populate('mediator', '_id fullName avatarUrl userRole isMediatorQualified')
            .populate('disputeOverseers', '_id fullName avatarUrl userRole')
            .populate({ path: 'chatMessages.readBy.readerId', select: 'fullName avatarUrl _id' })
            .populate('chatMessages.sender', 'fullName avatarUrl _id')
            .populate({
                path: 'adminSubChats',
                populate: [
                    { path: 'participants.userId', select: '_id fullName avatarUrl' },
                    { path: 'createdBy', select: '_id fullName avatarUrl' },
                    { path: 'messages.sender', select: '_id fullName avatarUrl' },
                ]
            });

        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        const isSeller = request.seller && request.seller._id.equals(userId);
        const isBuyer = request.buyer && request.buyer._id.equals(userId);
        const isMediator = request.mediator && request.mediator._id.equals(userId);
        const isAdmin = userRole === 'Admin';
        const isDesignatedOverseer = request.disputeOverseers &&
            request.disputeOverseers.some(overseer => overseer._id.equals(userId));

        let canAccess = isSeller || isBuyer || isMediator || isDesignatedOverseer;
        if (isAdmin && request.status === 'Disputed') {
            canAccess = true;
        }

        if (!canAccess) {
            console.warn(`[getMediationDetails] User ${userId} (Role: ${userRole}) is FORBIDDEN from accessing details for ${mediationRequestId}.`);
            return res.status(403).json({ msg: "Forbidden: You are not authorized to view these mediation details." });
        }

        const responseRequest = request.toObject();

        if (userRole !== 'Admin') {
            if (responseRequest.adminSubChats && Array.isArray(responseRequest.adminSubChats)) {
                responseRequest.adminSubChats = responseRequest.adminSubChats.filter(subChat =>
                    subChat.participants.some(participant =>
                        participant.userId && participant.userId._id.equals(userId)
                    )
                );
            }
        }

        console.log(`[getMediationDetails] User ${userId} (Role: ${userRole}) GRANTED access to details for ${mediationRequestId}.`);
        res.status(200).json({ mediationRequest: responseRequest });

    } catch (error) {
        console.error("[getMediationDetails] Error fetching mediation request details:", error.message, error.stack);
        res.status(500).json({ msg: "Server error fetching mediation details.", errorDetails: error.message });
    }
};

exports.adminGetPendingAssignmentRequests = async (req, res) => {
    const { page = 1, limit = 15 } = req.query;
    console.log(`[MediationCtrl - GetPendingAssign] Admin fetching pending assignments. Page: ${page}, Limit: ${limit}`);
    try {
        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 15,
            sort: { createdAt: 1 },
            populate: [
                { path: 'product', select: 'title imageUrls' },
                { path: 'seller', select: 'fullName email avatarUrl' },
                { path: 'buyer', select: 'fullName email avatarUrl' }
            ],
            lean: true
        };
        const result = await MediationRequest.paginate({ status: 'PendingAssignment' }, options);
        res.status(200).json({
            requests: result.docs || result.requests,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalRequests: result.totalDocs || result.totalRequests
        });
    } catch (error) {
        console.error("[MediationCtrl - GetPendingAssign] Error fetching pending assignment requests:", error);
        res.status(500).json({ msg: "Server error fetching mediation requests." });
    }
};

exports.adminAssignMediator = async (req, res) => {
    const { requestId } = req.params;
    const { mediatorId } = req.body;
    const adminUserId = req.user._id;
    console.log(`[MediationCtrl - AssignMediator V3] Admin ${adminUserId} assigning Mediator ${mediatorId} to Request ${requestId}`);
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(mediatorId)) {
        return res.status(400).json({ msg: "Invalid Request ID or Mediator ID format." });
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const mediatorUser = await User.findOne({ _id: mediatorId, isMediatorQualified: true, blocked: false }).select('_id').lean().session(session);
        if (!mediatorUser) throw new Error(`Selected user (ID: ${mediatorId}) is not a qualified or active mediator.`);

        const mediationRequest = await MediationRequest.findOne({ _id: requestId, status: 'PendingAssignment' }).select('seller buyer status').session(session);
        if (!mediationRequest) {
            const existingRequestCheck = await MediationRequest.findById(requestId).select('status').session(session);
            if (!existingRequestCheck) throw new Error(`Mediation request with ID ${requestId} not found.`);
            throw new Error(`Mediation request is already in status "${existingRequestCheck.status}". Cannot assign mediator.`);
        }
        if (mediationRequest.seller.equals(mediatorId)) throw new Error("The selected mediator cannot be the seller in this transaction.");
        if (mediationRequest.buyer.equals(mediatorId)) throw new Error("The selected mediator cannot be the buyer in this transaction.");

        const updatedMediationRequest = await MediationRequest.findByIdAndUpdate(requestId,
            { $set: { mediator: mediatorId, status: 'MediatorAssigned' } },
            { new: true, runValidators: true, session: session }
        ).populate('product', 'title').populate('seller', 'fullName').populate('buyer', 'fullName');
        if (!updatedMediationRequest) throw new Error(`Failed to update mediation request ${requestId} after validation.`);

        const productTitle = updatedMediationRequest.product?.title || 'N/A';
        const bidAmountFormatted = formatCurrency(updatedMediationRequest.bidAmount, updatedMediationRequest.bidCurrency);
        const mediatorMessage = `You have been assigned as a mediator for the transaction regarding product "${productTitle}" (Price: ${bidAmountFormatted}). Please review and accept or reject the task within the allowed time.`;
        const newNotification = await Notification.create([{
            user: mediatorId, type: 'MEDIATION_ASSIGNED', title: 'New Mediation Assignment', message: mediatorMessage,
            relatedEntity: { id: updatedMediationRequest._id, modelName: 'MediationRequest' }
        }], { session: session });

        const mediatorSocketId = req.onlineUsers?.[mediatorId.toString()];
        if (mediatorSocketId) {
            req.io.to(mediatorSocketId).emit('new_notification', newNotification[0].toObject());
        }
        await session.commitTransaction();
        res.status(200).json({ msg: 'Mediator assigned successfully.', mediationRequest: updatedMediationRequest });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("[MediationCtrl - AssignMediator V3] Error assigning mediator:", error);
        const statusCode = error.message.includes("not found") || error.message.includes("already in status") ? 404 : error.message.includes("not a qualified") || error.message.includes("cannot be the seller") || error.message.includes("cannot be the buyer") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || 'Failed to assign mediator.' });
    } finally {
        if (session && session.endSession) await session.endSession();
    }
};

// --- Seller: Get Available Random Mediators ---
exports.getAvailableRandomMediators = async (req, res) => {
    console.log("<<<<< RUNNING LATEST VERSION OF getAvailableRandomMediators >>>>>");
    const { mediationRequestId } = req.params;
    const requestingUserId = req.user._id;
    const { refresh, exclude } = req.query;

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .select('seller buyer previouslySuggestedMediators suggestionRefreshCount status')
            .lean();

        if (!mediationRequest) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        if (!mediationRequest.seller.equals(requestingUserId)) {
            return res.status(403).json({ msg: "Forbidden: You are not the seller." });
        }

        // [!!!] START: هذا هو الإصلاح الرئيسي
        // الآن، نحن نتحقق من أن الحالة هي 'PendingMediatorSelection' في جميع الأحوال (سواء الجلب الأولي أو إعادة الجلب).
        // هذا يمنع أي دالة أخرى من استدعاء هذا المسار في حالة خاطئة، ويحل الخطأ الذي رأيته.
        if (mediationRequest.status !== 'PendingMediatorSelection') {
            return res.status(400).json({
                msg: `Action not allowed for seller at current request status: '${mediationRequest.status}'. Expected 'PendingMediatorSelection'.`
            });
        }

        // التحقق من عدد مرات إعادة الجلب المسموح بها
        if (refresh === 'true' && (mediationRequest.suggestionRefreshCount || 0) >= 1) {
            return res.status(400).json({ msg: "You have already used your one-time request for new suggestions." });
        }
        // [!!!] END: نهاية الإصلاح الرئيسي

        let exclusionIds = [mediationRequest.seller, mediationRequest.buyer];
        // عند إعادة الجلب، قم بإضافة الوسطاء المقترحين سابقاً إلى قائمة الاستبعاد
        if (mediationRequest.previouslySuggestedMediators?.length) {
            exclusionIds = [...exclusionIds, ...mediationRequest.previouslySuggestedMediators];
        }

        if (exclude) {
            const excludeArray = exclude.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
            exclusionIds = [...new Set([...exclusionIds, ...excludeArray])];
        }

        const finalExclusionObjectIds = exclusionIds.map(id => new mongoose.Types.ObjectId(id.toString()));

        const query = {
            isMediatorQualified: true,
            mediatorStatus: 'Available',
            blocked: false,
            _id: { $nin: finalExclusionObjectIds }
        };

        const allAvailableMediators = await User.find(query).select('fullName avatarUrl mediatorStatus successfulMediationsCount reputationPoints level positiveRatings negativeRatings').lean();

        if (allAvailableMediators.length === 0) {
            const message = refresh === 'true' ? "No new distinct mediators found." : "No available mediators found.";
            return res.status(200).json({
                mediators: [],
                message,
                refreshCountRemaining: Math.max(0, 1 - (mediationRequest.suggestionRefreshCount || 0))
            });
        }

        const shuffledMediators = [...allAvailableMediators].sort(() => 0.5 - Math.random());
        const selectedMediatorsRaw = shuffledMediators.slice(0, 3);

        const selectedMediatorsWithRating = selectedMediatorsRaw.map(mediator => {
            const totalRatings = (mediator.positiveRatings || 0) + (mediator.negativeRatings || 0);
            let calculatedRatingValue = 0.0;
            if (totalRatings > 0) {
                calculatedRatingValue = parseFloat((((mediator.positiveRatings || 0) / totalRatings) * 5).toFixed(1));
            }
            return { ...mediator, calculatedRating: calculatedRatingValue };
        });

        // تحديث قاعدة البيانات بالوسطاء المقترحين والعداد
        const updateOperations = {
            $addToSet: { previouslySuggestedMediators: { $each: selectedMediatorsWithRating.map(m => m._id) } }
        };

        let currentRefreshCount = mediationRequest.suggestionRefreshCount || 0;
        if (refresh === 'true') {
            updateOperations.$inc = { suggestionRefreshCount: 1 };
            currentRefreshCount++;
        }

        await MediationRequest.findByIdAndUpdate(mediationRequestId, updateOperations);

        res.status(200).json({
            mediators: selectedMediatorsWithRating,
            suggestionsRefreshed: refresh === 'true',
            refreshCountRemaining: Math.max(0, 1 - currentRefreshCount)
        });

    } catch (error) {
        console.error("Error fetching available mediators:", error);
        res.status(500).json({ msg: "Server error fetching mediators.", errorDetails: error.message });
    }
};

// --- Seller: Assign Selected Mediator ---
exports.sellerAssignSelectedMediator = async (req, res) => {
    const { mediationRequestId } = req.params;
    const { selectedMediatorId } = req.body;
    const sellerId = req.user._id;
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`--- Controller: sellerAssignSelectedMediator for Request: ${mediationRequestId} ---`);

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title _id')
            .populate('buyer', 'fullName _id')
            .session(session);

        if (!mediationRequest) throw new Error("Mediation request not found.");
        if (!mediationRequest.seller.equals(sellerId)) throw new Error("Forbidden: You are not the seller for this request.");
        if (mediationRequest.status !== 'PendingMediatorSelection') {
            throw new Error(`Cannot assign mediator. Request status is already '${mediationRequest.status}'.`);
        }
        if (mediationRequest.seller.equals(selectedMediatorId)) {
            throw new Error("The selected mediator cannot be the seller in this transaction.");
        }
        if (mediationRequest.buyer._id.equals(selectedMediatorId)) {
            throw new Error("The selected mediator cannot be the buyer in this transaction.");
        }

        const mediatorUser = await User.findOne({
            _id: selectedMediatorId,
            isMediatorQualified: true,
            mediatorStatus: 'Available',
            blocked: false
        }).select('fullName').lean().session(session);

        if (!mediatorUser) {
            throw new Error(`Selected user (ID: ${selectedMediatorId}) is not a qualified or available mediator, or does not exist.`);
        }

        mediationRequest.mediator = selectedMediatorId;
        mediationRequest.status = 'MediatorAssigned';
        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({
            event: "Mediator selected by seller",
            userId: sellerId,
            details: { mediatorId: selectedMediatorId, mediatorName: mediatorUser.fullName },
            timestamp: new Date()
        });
        const updatedMediationRequestDoc = await mediationRequest.save({ session });

        if (mediationRequest.product?._id) {
            await Product.findByIdAndUpdate(mediationRequest.product._id,
                { $set: { status: 'MediatorAssigned' } },
                { session: session }
            );
            console.log(`   Product ${mediationRequest.product._id} status updated to 'MediatorAssigned' in DB.`);
        }

        const productTitleForNotification = mediationRequest.product?.title || 'the specified product';
        const sellerFullNameForNotification = req.user.fullName || 'The Seller';
        const buyerFullNameForNotification = mediationRequest.buyer?.fullName || 'The Buyer';

        const sellerConfirmationMsg = `You have successfully selected ${mediatorUser.fullName} as the mediator for "${productTitleForNotification}". They have been notified and you will be updated on their decision.`;
        const mediatorNotificationMsg = `You have been selected as a mediator by ${sellerFullNameForNotification} for a transaction regarding "${productTitleForNotification}" with ${buyerFullNameForNotification}. Please review and accept or reject this assignment.`;
        const buyerNotificationMsg = `${sellerFullNameForNotification} has selected ${mediatorUser.fullName} as the mediator for your transaction regarding "${productTitleForNotification}". Please wait for the mediator to accept the assignment.`;

        await Notification.create([
            { user: sellerId, type: 'MEDIATOR_SELECTION_CONFIRMED', title: 'Mediator Selection Confirmed', message: sellerConfirmationMsg, relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' } },
            { user: selectedMediatorId, type: 'MEDIATION_ASSIGNED', title: 'New Mediation Assignment', message: mediatorNotificationMsg, relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' } },
            { user: mediationRequest.buyer._id, type: 'MEDIATOR_SELECTED_BY_SELLER', title: 'Mediator Selected for Your Transaction', message: buyerNotificationMsg, relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' } }
        ], { session: session, ordered: true });
        console.log(`   Notifications sent for mediator assignment on request ${updatedMediationRequestDoc._id}.`);

        await session.commitTransaction();
        console.log("   sellerAssignSelectedMediator transaction committed successfully.");

        // --- [!!!] الحل: إعادة جلب شاملة قبل إرسال السوكيت [!!!] ---
        const finalPopulatedMediationRequest = await MediationRequest.findById(updatedMediationRequestDoc._id)
            .populate('product') // المنتج بالكامل
            .populate('seller', 'fullName avatarUrl _id')
            .populate('buyer', 'fullName avatarUrl _id')
            .populate('mediator', 'fullName avatarUrl _id')
            .lean();

        if (req.io && finalPopulatedMediationRequest) {
            // إرسال تحديث عام
            const involvedUserIds = [finalPopulatedMediationRequest.seller?._id, finalPopulatedMediationRequest.buyer?._id, finalPopulatedMediationRequest.mediator?._id].filter(id => id).map(id => id.toString());
            const uniqueInvolvedUserIds = [...new Set(involvedUserIds)];
            uniqueInvolvedUserIds.forEach(involvedUserIdString => {
                if (req.onlineUsers && req.onlineUsers[involvedUserIdString]) {
                    req.io.to(req.onlineUsers[involvedUserIdString]).emit('mediation_request_updated', {
                        updatedMediationRequestData: finalPopulatedMediationRequest
                    });
                }
            });

            // إرسال تحديث للمنتج منفصل
            if (finalPopulatedMediationRequest.product) {
                req.io.emit('product_updated', finalPopulatedMediationRequest.product);
            }

            // --- [!!!] الحل: إرسال حدث مخصص للوسيط لتحديث قائمته [!!!] ---
            const mediatorSocketId = req.onlineUsers?.[selectedMediatorId.toString()];
            if (mediatorSocketId) {
                req.io.to(mediatorSocketId).emit('new_assignment_for_mediator', {
                    newAssignmentData: finalPopulatedMediationRequest
                });
                console.log(`   [Socket] Emitted 'new_assignment_for_mediator' to mediator ${selectedMediatorId}`);
            }
        }

        res.status(200).json({
            msg: `Mediator ${mediatorUser.fullName} has been assigned. They will be notified.`,
            mediationRequest: finalPopulatedMediationRequest
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("--- Controller: sellerAssignSelectedMediator ERROR ---", error);
        res.status(error.status || 500).json({ msg: error.message || 'Failed to assign mediator.' });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

// --- Mediator: Get Pending Assignments ---
exports.getMediatorPendingAssignments = async (req, res) => {
    // ... (الكود الكامل لهذه الدالة كما قدمته سابقاً، بدون تغييرات هنا) ...
    const mediatorId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    try {
        if (!req.user.isMediatorQualified) return res.status(403).json({ msg: "Access denied. Not a qualified mediator." });
        const query = { mediator: mediatorId, status: 'MediatorAssigned' };
        const options = { page: parseInt(page), limit: parseInt(limit), sort: { createdAt: -1 }, populate: [{ path: 'product', select: 'title imageUrls agreedPrice currency' }, { path: 'seller', select: 'fullName avatarUrl' }, { path: 'buyer', select: 'fullName avatarUrl' }], lean: true };
        const result = await MediationRequest.paginate(query, options);
        res.status(200).json({ assignments: result.docs, totalPages: result.totalPages, currentPage: result.page, totalAssignments: result.totalDocs });
    } catch (error) {
        console.error("Error fetching mediator assignments:", error);
        res.status(500).json({ msg: "Server error fetching assignments.", errorDetails: error.message });
    }
};

// --- Mediator: Accept Assignment ---
exports.mediatorAcceptAssignment = async (req, res) => {
    // 1. استخراج معرفات الطلب والوسيط
    // req.mediationRequest يتم توفيره بواسطة middleware مثل isAssignedMediator
    const mediationRequestIdToAccept = req.mediationRequest?._id || req.params.mediationRequestId;
    const mediatorId = req.user._id; // الوسيط الذي يقوم بالقبول

    // بدء جلسة transaction لضمان سلامة البيانات
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`--- Controller: mediatorAcceptAssignment for Request: ${mediationRequestIdToAccept} ---`);

    try {
        // متغير لتخزين المستند المحدث لاستخدامه بعد إتمام المعاملة
        let updatedDoc;

        // ========================================================================
        // 2. الجزء الخاص بقاعدة البيانات (يتم داخل المعاملة)
        // ========================================================================

        // جلب طلب الوساطة من قاعدة البيانات باستخدام الجلسة الحالية
        const mediationRequest = await MediationRequest.findById(mediationRequestIdToAccept).session(session);

        // التحقق من صحة الطلب وصلاحيات الوسيط
        if (!mediationRequest) {
            throw new Error("Mediation request not found or has been removed.");
        }
        if (!mediationRequest.mediator || !mediationRequest.mediator.equals(mediatorId)) {
            throw new Error("Forbidden: You are not the assigned mediator for this request.");
        }
        if (mediationRequest.status !== 'MediatorAssigned') {
            throw new Error(`Cannot accept assignment. Request status is '${mediationRequest.status}', but expected 'MediatorAssigned'.`);
        }

        // تحديث حالة طلب الوساطة وإضافة سجل في التاريخ
        mediationRequest.status = 'MediationOfferAccepted';
        if (!Array.isArray(mediationRequest.history)) {
            mediationRequest.history = [];
        }
        mediationRequest.history.push({
            event: "Mediator accepted assignment",
            userId: mediatorId,
            timestamp: new Date()
        });

        // حفظ التغييرات في طلب الوساطة والحصول على المستند المحدث
        updatedDoc = await mediationRequest.save({ session });

        // جلب البيانات المعبأة (populated) اللازمة لإنشاء الإشعارات
        const populatedRequestForNotif = await MediationRequest.findById(updatedDoc._id)
            .populate('product', 'title _id')
            .populate('seller', '_id fullName')
            .populate('buyer', '_id fullName')
            .populate('mediator', '_id fullName')
            .lean() // .lean() للأداء الأفضل عند القراءة فقط
            .session(session);

        // إعداد رسائل الإشعارات
        const productTitle = populatedRequestForNotif.product?.title || 'the specified product';
        const mediatorFullName = populatedRequestForNotif.mediator?.fullName || 'The Assigned Mediator';
        const sellerFullName = populatedRequestForNotif.seller?.fullName || 'The Seller';
        const buyerFullName = populatedRequestForNotif.buyer?.fullName || 'The Buyer';

        const mediatorConfirmationMsg = `You have successfully accepted the mediation assignment for "${productTitle}". You will be notified when both parties are ready.`;
        const sellerMessage = `${mediatorFullName} has accepted the assignment to mediate your transaction for "${productTitle}" (with buyer: ${buyerFullName}). Please proceed to confirm your readiness for mediation.`;
        const buyerMessage = `${mediatorFullName} has accepted the assignment to mediate your transaction for "${productTitle}" (with seller: ${sellerFullName}). Please proceed to confirm your readiness for mediation.`;

        // إنشاء جميع الإشعارات دفعة واحدة داخل المعاملة
        await Notification.create([
            { user: mediatorId, type: 'MEDIATION_TASK_ACCEPTED_SELF', title: 'Assignment Accepted', message: mediatorConfirmationMsg, relatedEntity: { id: populatedRequestForNotif._id, modelName: 'MediationRequest' } },
            { user: populatedRequestForNotif.seller._id, type: 'MEDIATION_ACCEPTED_BY_MEDIATOR', title: 'Mediator Accepted - Confirm Readiness', message: sellerMessage, relatedEntity: { id: populatedRequestForNotif._id, modelName: 'MediationRequest' } },
            { user: populatedRequestForNotif.buyer._id, type: 'MEDIATION_ACCEPTED_BY_MEDIATOR', title: 'Mediator Accepted - Confirm Readiness', message: buyerMessage, relatedEntity: { id: populatedRequestForNotif._id, modelName: 'MediationRequest' } }
        ], { session, ordered: true }); // الخيار { ordered: true } ضروري عند الإنشاء المتعدد داخل transaction

        // إتمام المعاملة وحفظ جميع التغييرات في قاعدة البيانات
        await session.commitTransaction();
        console.log("   mediatorAcceptAssignment transaction committed successfully.");

        // ========================================================================
        // 3. الجزء الخاص بإرسال البيانات (يتم خارج المعاملة بعد نجاحها)
        // ========================================================================

        // الحل الحاسم: أعد جلب طلب الوساطة بالكامل وبشكل شامل من قاعدة البيانات
        // هذا يضمن أنك تحصل على أحدث نسخة 100% لإرسالها عبر السوكيت.
        const finalRequestForSocket = await MediationRequest.findById(updatedDoc._id)
            .populate({
                path: 'product', // جلب المنتج
                populate: { path: 'user' } // وجلب المستخدم (البائع) المرتبط بالمنتج
            })
            .populate('seller', 'fullName avatarUrl _id')
            .populate('buyer', 'fullName avatarUrl _id')
            .populate('mediator', 'fullName avatarUrl _id')
            .lean();

        // التحقق من أنك حصلت على البيانات قبل إرسالها
        if (req.io && finalRequestForSocket) {

            // (اختياري للتصحيح) اطبع البيانات التي سترسلها للتأكد من أنها كاملة
            console.log("--- DEBUG: Data being sent via socket AFTER mediator acceptance ---");
            console.log(JSON.stringify(finalRequestForSocket, null, 2));
            console.log("------------------------------------------------------------------");

            // تحديد جميع الأطراف المعنية لاستلام التحديث
            const involvedUserIds = [finalRequestForSocket.seller?._id, finalRequestForSocket.buyer?._id, finalRequestForSocket.mediator?._id].filter(id => id).map(id => id.toString());
            const uniqueInvolvedUserIds = [...new Set(involvedUserIds)];

            uniqueInvolvedUserIds.forEach(involvedUserIdString => {
                if (req.onlineUsers && req.onlineUsers[involvedUserIdString]) {
                    // أرسل البيانات الكاملة في حدث واحد
                    req.io.to(req.onlineUsers[involvedUserIdString]).emit('mediation_request_updated', {
                        updatedMediationRequestData: finalRequestForSocket
                    });
                }
            });

            // أرسل تحديث المنتج بشكل منفصل أيضًا لضمان التوافق مع productReducer
            if (finalRequestForSocket.product) {
                req.io.emit('product_updated', finalRequestForSocket.product);
            }
            console.log(`   [Socket] Emitted 'mediation_request_updated' and 'product_updated' with fully populated data.`);
        }

        // 4. إرسال استجابة HTTP النهائية للعميل الذي قام بالطلب
        res.status(200).json({
            msg: "Mediation assignment accepted successfully. Parties will be notified to confirm readiness.",
            mediationRequest: finalRequestForSocket // أرجع البيانات الكاملة أيضًا في الاستجابة
        });

    } catch (error) {
        // في حالة حدوث أي خطأ، قم بإلغاء المعاملة
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("--- Controller: mediatorAcceptAssignment ERROR ---", error);
        // تحديد رمز الحالة المناسب للخطأ وإرساله
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Cannot accept") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || "Failed to accept mediation assignment." });
    } finally {
        // تأكد دائمًا من إنهاء الجلسة لتحرير الموارد
        if (session) {
            await session.endSession();
        }
    }
};

// --- Mediator: Reject Assignment ---
exports.mediatorRejectAssignment = async (req, res) => {
    const { mediationRequestId } = req.params;
    const mediatorId = req.user._id; // الوسيط الذي يقوم بالرفض
    const { reason } = req.body;

    console.log(`--- Controller: mediatorRejectAssignment ---`);
    console.log(`   MediationRequestID: ${mediationRequestId}, Rejecting MediatorID: ${mediatorId}, Reason: "${reason}"`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID format." });
    }
    if (!reason || reason.trim() === "") {
        return res.status(400).json({ msg: "Rejection reason is required." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for mediatorRejectAssignment.");

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', '_id title') // Populate product for notifications and status update
            .populate('seller', '_id fullName') // Populate seller for notification
            .populate('buyer', '_id fullName')  // Populate buyer for notification
            .session(session);

        if (!mediationRequest) {
            throw new Error("Mediation request not found.");
        }

        // التحقق من أن المستخدم الحالي هو الوسيط المعين لهذا الطلب
        if (!mediationRequest.mediator || !mediationRequest.mediator.equals(mediatorId)) {
            throw new Error("Forbidden: You are not the assigned mediator for this request or no mediator is assigned.");
        }
        // التحقق من أن حالة الطلب تسمح بالرفض (يجب أن يكون الوسيط قد تم تعيينه ولم يقبل/يرفض بعد)
        if (mediationRequest.status !== 'MediatorAssigned') {
            throw new Error(`Cannot reject assignment. Request status is '${mediationRequest.status}', expected 'MediatorAssigned'.`);
        }

        const originalMediatorId = mediationRequest.mediator; // ID الوسيط الذي يرفض

        // تحديث حالة طلب الوساطة
        mediationRequest.status = 'PendingMediatorSelection'; // يعود لانتظار اختيار وسيط جديد
        mediationRequest.mediator = null; // إزالة الوسيط الحالي

        // إضافة الوسيط المرفوض إلى قائمة "تم اقتراحهم سابقاً" لتجنب إعادة اقتراحه فوراً (اختياري)
        if (originalMediatorId) {
            if (!Array.isArray(mediationRequest.previouslySuggestedMediators)) {
                mediationRequest.previouslySuggestedMediators = [];
            }
            mediationRequest.previouslySuggestedMediators.addToSet(originalMediatorId);
            console.log(`   Added mediator ${originalMediatorId} to previouslySuggestedMediators for request ${mediationRequest._id}.`);
        }

        // إضافة سجل بتاريخ الرفض
        if (!Array.isArray(mediationRequest.history)) {
            mediationRequest.history = [];
        }
        mediationRequest.history.push({
            event: "Mediator rejected assignment",
            userId: mediatorId, // الوسيط هو من قام بالإجراء
            details: { reason: reason, rejectedMediatorId: originalMediatorId?.toString() },
            timestamp: new Date()
        });

        const updatedRequestAfterRejection = await mediationRequest.save({ session });
        console.log(`   MediationRequest ${updatedRequestAfterRejection._id} status updated to '${updatedRequestAfterRejection.status}', mediator removed.`);

        // تحديث حالة المنتج المرتبط ليعود لانتظار اختيار وسيط
        if (mediationRequest.product && mediationRequest.product._id) {
            await Product.findByIdAndUpdate(
                mediationRequest.product._id,
                { $set: { status: 'PendingMediatorSelection' } },
                { session }
            );
            console.log(`   Product ${mediationRequest.product._id} status updated back to 'PendingMediatorSelection'.`);
        }

        // تحديث حالة الوسيط الرافض إلى 'Available' إذا لم يكن لديه مهام نشطة أخرى
        if (originalMediatorId) {
            const otherActiveAssignments = await MediationRequest.countDocuments({
                mediator: originalMediatorId,
                status: { $in: ['MediatorAssigned', 'MediationOfferAccepted', 'PartiesConfirmed', 'InProgress'] } // حالات نشطة
            }).session(session);
            console.log(`   Mediator ${originalMediatorId} has ${otherActiveAssignments} other active assignments.`);
            if (otherActiveAssignments === 0) {
                await User.findByIdAndUpdate(originalMediatorId,
                    { $set: { mediatorStatus: 'Available' } },
                    { session }
                );
                console.log(`   Mediator ${originalMediatorId} status updated to 'Available'.`);
            } else {
                console.log(`   Mediator ${originalMediatorId} remains in current status due to other active assignments.`);
            }
        }

        // جلب معلومات الوسيط الرافض (اسمه) للإشعارات
        const rejectingMediator = await User.findById(originalMediatorId).select('fullName').lean().session(session);
        const rejectingMediatorName = rejectingMediator?.fullName || 'The previously assigned mediator';
        const productTitle = mediationRequest.product?.title || 'the product';
        const sellerFullName = mediationRequest.seller?.fullName || 'The Seller'; // اسم البائع للإشعار

        // إنشاء وإرسال الإشعارات
        console.log("   Preparing notifications for mediator rejection...");
        const sellerMessage = `${rejectingMediatorName} has rejected the mediation assignment for "${productTitle}". Reason: "${reason}". Please select a new mediator.`;
        const buyerMessage = `The mediator assignment for your transaction regarding "${productTitle}" (with seller ${sellerFullName}) was rejected by ${rejectingMediatorName}. The seller will select a new mediator.`;
        const mediatorRejectionConfirmationMsg = `You have successfully rejected the mediation assignment for "${productTitle}". Reason: ${reason}.`;

        // --- التعديل هنا ---
        await Notification.create([
            { // إشعار للبائع
                user: mediationRequest.seller._id,
                type: 'MEDIATION_REJECTED_BY_MEDIATOR_SELECT_NEW',
                title: 'Mediator Rejected - Action Required',
                message: sellerMessage,
                relatedEntity: { id: updatedRequestAfterRejection._id, modelName: 'MediationRequest' }
            },
            { // إشعار للمشتري
                user: mediationRequest.buyer._id,
                type: 'MEDIATION_REJECTED_BY_MEDIATOR',
                title: 'Mediator Assignment Rejected',
                message: buyerMessage,
                relatedEntity: { id: updatedRequestAfterRejection._id, modelName: 'MediationRequest' }
            },
            { // إشعار للوسيط الرافض (تأكيد)
                user: originalMediatorId, // ID الوسيط الذي قام بالرفض
                type: 'MEDIATION_TASK_REJECTED_SELF',
                title: 'Assignment Rejection Confirmed',
                message: mediatorRejectionConfirmationMsg,
                relatedEntity: { id: updatedRequestAfterRejection._id, modelName: 'MediationRequest' }
            }
        ], { session, ordered: true }); // <--- أضف ordered: true
        // --- نهاية التعديل ---
        console.log(`   Notifications sent for mediator rejection on request ${updatedRequestAfterRejection._id}.`);

        await session.commitTransaction();
        console.log("   mediatorRejectAssignment transaction committed.");

        // إرجاع طلب الوساطة المحدث (الذي تم عمل populate له مسبقًا للإشعارات إذا كان كافيًا)
        // أو يمكن إعادة عمل populate هنا إذا احتجت لبيانات أكثر في الاستجابة
        const finalResponseRequest = await MediationRequest.findById(updatedRequestAfterRejection._id)
            .populate('product', 'title status imageUrls') // أضف أي حقول تريدها
            .populate('seller', 'fullName avatarUrl')
            .populate('buyer', 'fullName avatarUrl')
            // الوسيط سيكون null هنا، لذا لا حاجة لـ populate('mediator')
            .lean();

        res.status(200).json({
            msg: "Mediation assignment rejected successfully. Seller has been notified to select a new mediator.",
            mediationRequest: finalResponseRequest
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl mediatorRejectAssignment] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: mediatorRejectAssignment ERROR ---", error);
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Cannot reject assignment") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || "Failed to reject mediation assignment." });
    } finally {
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: mediatorRejectAssignment END ---");
    }
};

// --- Mediator: Get Accepted/Ongoing Assignments (MODIFIED) ---
// (الكود كما هو في الرد السابق الذي يشمل PartiesConfirmed و InProgress)
exports.getMediatorAcceptedAwaitingParties = async (req, res) => {
    const mediatorId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    console.log(`--- Controller: getMediatorAcceptedAwaitingParties (EXTENDED STATUSES) for Mediator: ${mediatorId}, Page: ${page} ---`);
    try {
        if (!req.user.isMediatorQualified) {
            return res.status(403).json({ msg: "Access denied. You are not a qualified mediator." });
        }

        // --- [!!!] النقطة الحاسمة هنا [!!!] ---
        const query = {
            mediator: mediatorId,
            status: {
                $in: [
                    'MediationOfferAccepted',
                    'EscrowFunded',
                    'PartiesConfirmed',  // <-- هل هذه الحالة موجودة؟
                    'InProgress'         // <-- هل هذه الحالة موجودة؟
                ]
            }
        };
        // --- [!!!] نهاية النقطة الحاسمة [!!!] ---

        console.log("[getMediatorAcceptedAwaitingParties] Query being executed:", JSON.stringify(query)); // <--- أضف هذا الـ log

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { updatedAt: -1 },
            populate: [
                { path: 'product', select: 'title imageUrls agreedPrice currency' },
                { path: 'seller', select: 'fullName avatarUrl' },
                { path: 'buyer', select: 'fullName avatarUrl' }
            ],
            lean: true
        };

        console.log("[getMediatorAcceptedAwaitingParties] Query being executed:", JSON.stringify(query)); // تأكد من وجود هذا

        const result = await MediationRequest.paginate(query, options);

        console.log(`[getMediatorAcceptedAwaitingParties] Found ${result.docs?.length || 0} assignments for query.`); // تأكد من وجود هذا

        if (result.docs && result.docs.length > 0) {
            result.docs.forEach(doc => console.log(`  - Returned Assignment ID: ${doc._id}, Status: ${doc.status}`));
        }


        res.status(200).json({
            assignments: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalAssignments: result.totalDocs
        });

    } catch (error) {
        console.error("--- Controller: getMediatorAcceptedAwaitingParties ERROR ---", error);
        res.status(500).json({ msg: "Server error while fetching assignments.", errorDetails: error.message });
    } finally {
        console.log("--- Controller: getMediatorAcceptedAwaitingParties END ---");
    }
};

// --- Buyer: Get Own Mediation Requests ---
exports.getBuyerMediationRequests = async (req, res) => {
    const buyerId = req.user._id; // يُفترض أن req.user._id متاح من middleware المصادقة
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const statusFilterFromQuery = req.query.status; // هذا سيكون سلسلة نصية واحدة إذا تم تمريره

    console.log(`--- [Controller getBuyerMediationRequests] START - BuyerID: ${buyerId}, Page: ${page}, Limit: ${limit}, StatusFilter from query: '${statusFilterFromQuery}' ---`);

    try {
        const query = { buyer: buyerId }; // الفلتر الأساسي: طلبات هذا المشتري

        if (statusFilterFromQuery && typeof statusFilterFromQuery === 'string' && statusFilterFromQuery.trim() !== "") {
            // إذا تم تمرير فلتر حالة محدد من العميل، استخدمه
            query.status = statusFilterFromQuery.trim();
            console.log(`   [Controller getBuyerMediationRequests] Applying specific status filter: '${query.status}'`);
        } else {
            // إذا لم يتم تمرير فلتر حالة، استخدم القائمة الافتراضية للحالات التي تهم المشتري
            query.status = {
                $in: [
                    'PendingMediatorSelection',
                    'MediatorAssigned',
                    'MediationOfferAccepted',
                    'EscrowFunded',
                    'InProgress',
                    'PendingBuyerAction', // إذا كان هناك إجراء مطلوب من المشتري
                    'PartiesConfirmed',
                    'Completed',
                    'Cancelled',
                    'Disputed' // <-- تأكد من تضمين حالة النزاع هنا
                ]
            };
            console.log(`   [Controller getBuyerMediationRequests] No specific status filter provided. Using default list of statuses:`, query.status.$in);
        }

        const options = {
            page: page,
            limit: limit,
            sort: { updatedAt: -1 },
            select: 'product seller buyer mediator status bidAmount bidCurrency createdAt updatedAt cancellationDetails resolutionDetails buyerConfirmedStart sellerConfirmedStart', // Added resolutionDetails
            populate: [
                { path: 'product', select: 'title imageUrls agreedPrice currency user' }, // user هنا هو بائع المنتج
                { path: 'seller', select: '_id fullName avatarUrl' },
                { path: 'buyer', select: '_id fullName avatarUrl' },
                { path: 'mediator', select: '_id fullName avatarUrl' }
            ],
            lean: true
        }

        console.log(`   [Controller getBuyerMediationRequests] Executing MediationRequest.paginate with query:`, JSON.stringify(query), `and options:`, options);
        const result = await MediationRequest.paginate(query, options);

        console.log(`   [Controller getBuyerMediationRequests] Found ${result.docs?.length || 0} requests for buyer ${buyerId} on page ${result.page} (Total: ${result.totalDocs || 0}).`);

        res.status(200).json({
            requests: result.docs || [], // أرجع مصفوفة فارغة إذا لم تكن هناك نتائج
            totalPages: result.totalPages || 0,
            currentPage: result.page || 1,
            totalRequests: result.totalDocs || 0
        });

    } catch (error) {
        console.error("[Controller getBuyerMediationRequests] Error fetching buyer's mediation requests:", error.message, "\nStack:", error.stack);
        res.status(500).json({
            msg: "Server error while fetching your mediation requests. Please try again later.",
            errorDetails: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    } finally {
        console.log(`--- [Controller getBuyerMediationRequests] END - BuyerID: ${buyerId} ---`);
    }
};

// --- Seller: Confirm Readiness (MODIFIED with PartiesConfirmed) ---
exports.sellerConfirmReadiness = async (req, res) => {
    // ... (الكود الكامل مع منطق PartiesConfirmed و استدعاء initiateMediationChat كما في الرد السابق) ...
    const { mediationRequestId } = req.params;
    const sellerId = req.user._id;
    console.log(`--- Controller: sellerConfirmReadiness for ${mediationRequestId} by Seller: ${sellerId} ---`);
    const session = await mongoose.startSession();
    session.startTransaction();
    let mediationRequestInstance;
    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title _id').populate('buyer', '_id fullName')
            .populate('mediator', '_id fullName').populate('seller', '_id fullName')
            .session(session);
        mediationRequestInstance = mediationRequest;

        if (!mediationRequest) throw new Error("Mediation request not found.");
        if (!mediationRequest.seller.equals(sellerId)) throw new Error("Forbidden: Not the seller.");
        if (!['MediationOfferAccepted', 'EscrowFunded'].includes(mediationRequest.status)) throw new Error(`Action not allowed. Status is '${mediationRequest.status}'.`);
        if (mediationRequest.sellerConfirmedStart) throw new Error("Already confirmed readiness.");

        mediationRequest.sellerConfirmedStart = true;
        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({ event: "Seller confirmed readiness", userId: sellerId, timestamp: new Date() });

        let msg = "Readiness confirmed. Waiting for buyer.";

        if (mediationRequest.buyerConfirmedStart && (mediationRequest.status === 'EscrowFunded' || mediationRequest.status === 'MediationOfferAccepted')) {
            mediationRequest.status = 'PartiesConfirmed';
            msg = "Readiness confirmed. Both parties ready. Chat will open shortly.";
            if (mediationRequest.product?._id) {
                await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'PartiesConfirmed' } }, { session });
            }
            const productTitle = mediationRequest.product?.title || 'transaction';
            const partiesConfirmedMsg = `All parties confirmed for "${productTitle}". Chat will initiate shortly.`;
            const notifType = 'PARTIES_CONFIRMED_AWAITING_CHAT';
            await Notification.insertMany([
                { user: mediationRequest.seller._id, type: notifType, title: "Parties Confirmed", message: partiesConfirmedMsg, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } },
                { user: mediationRequest.buyer._id, type: notifType, title: "Parties Confirmed", message: partiesConfirmedMsg, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } },
                { user: mediationRequest.mediator._id, type: notifType, title: "Parties Confirmed", message: partiesConfirmedMsg, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } }
            ], { session });
        } else {
            const buyerAwaitingMsg = `Seller for "${mediationRequest.product?.title || 'transaction'}" confirmed readiness. Please confirm your readiness and ensure funds.`;
            await Notification.create([{ user: mediationRequest.buyer._id, type: 'SELLER_CONFIRMED_AWAITING_YOUR_ACTION', title: 'Seller Confirmed', message: buyerAwaitingMsg, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } }], { session });
        }

        await mediationRequest.save({ session });
        await session.commitTransaction();

        if (mediationRequestInstance?.status === 'PartiesConfirmed') {
            initiateMediationChat(mediationRequestInstance._id, "sellerConfirmReadiness").catch(console.error);
        }

        const finalResponse = await MediationRequest.findById(mediationRequestInstance._id).populate('product seller buyer mediator history.userId', 'title status agreedPrice imageUrls currency fullName avatarUrl').lean();
        res.status(200).json({ msg, mediationRequest: finalResponse });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error in sellerConfirmReadiness:", error);
        res.status(400).json({ msg: error.message || "Failed to confirm readiness." });
    } finally {
        if (session.endSession) await session.endSession();
    }
};

// --- Buyer: Confirm Readiness and Escrow Funds ---
exports.buyerConfirmReadinessAndEscrow = async (req, res) => {
    const { mediationRequestId } = req.params;
    const buyerId = req.user._id; // المشتري الذي يقوم بالإجراء
    const buyerFullNameForNotification = req.user.fullName || 'The Buyer';

    console.log(`--- Controller: buyerConfirmReadinessAndEscrow for Mediation: ${mediationRequestId} by Buyer: ${buyerId} ---`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title currency _id') // currency من المنتج لتحديد عملة السعر الأصلي
            .populate('seller', '_id fullName') // فقط المعلومات الأساسية للبائع
            .populate('mediator', '_id fullName') // فقط المعلومات الأساسية للوسيط
            // لا نحتاج لجلب أرصدة البائع أو الوسيط هنا، فقط المشتري
            .session(session);

        // 1. التحقق من صحة الطلب والأطراف
        if (!mediationRequest) {
            await session.abortTransaction();
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (!mediationRequest.buyer.equals(buyerId)) {
            await session.abortTransaction();
            return res.status(403).json({ msg: "Forbidden: You are not the buyer for this request." });
        }
        if (mediationRequest.status !== 'MediationOfferAccepted') {
            await session.abortTransaction();
            return res.status(400).json({ msg: `Action not allowed. Current status is '${mediationRequest.status}'. Expected 'MediationOfferAccepted'.` });
        }
        if (mediationRequest.buyerConfirmedStart) {
            await session.abortTransaction();
            return res.status(400).json({ msg: "Already confirmed readiness and escrowed funds." });
        }
        if (typeof mediationRequest.bidAmount !== 'number' || !mediationRequest.bidCurrency) {
            await session.abortTransaction();
            return res.status(400).json({ msg: "Transaction details (bid amount or currency) are incomplete for fee calculation." });
        }

        // 2. حساب الرسوم والمبلغ الإجمالي المطلوب إيداعه
        const feeDetails = calculateMediatorFeeDetails(
            mediationRequest.bidAmount,
            mediationRequest.bidCurrency // عملة العرض هي العملة التي يجب أن تتم بها الحسابات الأولية
        );

        if (feeDetails.error) {
            await session.abortTransaction();
            return res.status(400).json({ msg: `Fee calculation error: ${feeDetails.error}` });
        }

        const amountToEscrowInOriginalCurrency = feeDetails.totalForBuyer; // هذا هو المبلغ بالعملة الأصلية للعرض
        const originalEscrowCurrency = feeDetails.currencyUsed; // هذه هي عملة العرض/الضمان

        if (typeof amountToEscrowInOriginalCurrency !== 'number' || isNaN(amountToEscrowInOriginalCurrency)) {
            await session.abortTransaction();
            return res.status(500).json({ msg: "Failed to determine the amount to escrow due to fee calculation issue." });
        }

        // 3. جلب بيانات المشتري (خاصة الرصيد)
        const buyerUser = await User.findById(buyerId).session(session);
        if (!buyerUser) {
            await session.abortTransaction();
            return res.status(404).json({ msg: "Buyer user profile not found." });
        }

        // 4. تحويل المبلغ المطلوب إيداعه إلى عملة المنصة الأساسية للخصم من رصيد المشتري
        let amountToDeductInPlatformCurrency = amountToEscrowInOriginalCurrency;
        if (originalEscrowCurrency === 'USD' && PLATFORM_BASE_CURRENCY === 'TND') {
            amountToDeductInPlatformCurrency = amountToEscrowInOriginalCurrency * TND_USD_EXCHANGE_RATE;
        } else if (originalEscrowCurrency === 'TND' && PLATFORM_BASE_CURRENCY === 'USD') {
            amountToDeductInPlatformCurrency = amountToEscrowInOriginalCurrency / TND_USD_EXCHANGE_RATE;
        }
        amountToDeductInPlatformCurrency = parseFloat(amountToDeductInPlatformCurrency.toFixed(2));

        // 5. التحقق من رصيد المشتري (بالعملة الأساسية للمنصة)
        if (buyerUser.balance < amountToDeductInPlatformCurrency) {
            await session.abortTransaction();
            return res.status(400).json({ msg: `Insufficient balance. Required: ${formatCurrency(amountToDeductInPlatformCurrency, PLATFORM_BASE_CURRENCY)}, Available: ${formatCurrency(buyerUser.balance, PLATFORM_BASE_CURRENCY)}` });
        }

        // 6. خصم المبلغ من رصيد المشتري
        buyerUser.balance = parseFloat((buyerUser.balance - amountToDeductInPlatformCurrency).toFixed(2));
        await buyerUser.save({ session });
        console.log(`   Buyer ${buyerId} balance updated to: ${buyerUser.balance} ${PLATFORM_BASE_CURRENCY}`);

        // 7. تحديث طلب الوساطة بمعلومات الضمان والرسوم
        mediationRequest.escrowedAmount = amountToEscrowInOriginalCurrency;
        mediationRequest.escrowedCurrency = originalEscrowCurrency;
        mediationRequest.calculatedMediatorFee = feeDetails.fee;
        mediationRequest.calculatedBuyerFeeShare = feeDetails.buyerShare;
        mediationRequest.calculatedSellerFeeShare = feeDetails.sellerShare;
        mediationRequest.mediationFeeCurrency = feeDetails.currencyUsed; // عملة الرسوم
        mediationRequest.buyerConfirmedStart = true;

        let nextStatus = 'EscrowFunded'; // الحالة الافتراضية بعد الإيداع
        let buyerAlertMessage = "Readiness confirmed and funds escrowed successfully. Waiting for seller to confirm.";

        if (mediationRequest.sellerConfirmedStart) { // إذا كان البائع قد أكد بالفعل
            nextStatus = 'PartiesConfirmed';
            buyerAlertMessage = "Readiness confirmed, funds escrowed. Both parties ready. Chat will open shortly.";
            if (mediationRequest.product?._id) {
                await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'PartiesConfirmed' } }, { session });
            }
        }
        mediationRequest.status = nextStatus;
        mediationRequest.history.push({
            event: "Buyer confirmed readiness and escrowed funds",
            userId: buyerId,
            timestamp: new Date(),
            details: {
                amountEscrowed: amountToEscrowInOriginalCurrency,
                escrowCurrency: originalEscrowCurrency,
                totalFeeCalculated: feeDetails.fee,
                feeCurrency: feeDetails.currencyUsed,
                buyerFeeShare: feeDetails.buyerShare,
                previousStatus: 'MediationOfferAccepted',
                newStatus: nextStatus
            }
        });

        // 8. (اختياري، ولكنه جيد للشفافية) إنشاء سجل Transaction لعملية تجميد رصيد المشتري
        const escrowTransaction = new Transaction({
            user: buyerId,
            type: 'ESCROW_FUNDED_BY_BUYER',
            amount: amountToDeductInPlatformCurrency, // المبلغ المخصوم من رصيده بالعملة الأساسية
            currency: PLATFORM_BASE_CURRENCY,
            status: 'COMPLETED', // لأن الخصم تم
            description: `Funds escrowed for mediation of '${mediationRequest.product?.title || 'product'}' (Mediation ID: ${mediationRequestId.toString().slice(-6)}). Original escrow: ${formatCurrency(amountToEscrowInOriginalCurrency, originalEscrowCurrency)}.`,
            relatedMediationRequest: mediationRequestId,
            metadata: {
                originalEscrowAmount: amountToEscrowInOriginalCurrency,
                originalEscrowCurrency: originalEscrowCurrency,
                totalFee: feeDetails.fee,
                buyerFeeShare: feeDetails.buyerShare
            }
        });
        await escrowTransaction.save({ session });
        console.log(`   Transaction (ESCROW_FUNDED_BY_BUYER) created: ${escrowTransaction._id}`);


        // 9. حفظ طلب الوساطة المحدث
        const updatedMediationRequest = await mediationRequest.save({ session });
        console.log(`   MediationRequest ${mediationRequestId} updated. Status: ${updatedMediationRequest.status}`);


        // 10. إنشاء الإشعارات
        const productTitleForNotif = mediationRequest.product?.title || 'the transaction';
        const notificationPromises = [];

        // إشعار للبائع (إذا لم يكن قد أكد بعد)
        if (!mediationRequest.sellerConfirmedStart && mediationRequest.seller?._id) {
            notificationPromises.push(Notification.create([{
                user: mediationRequest.seller._id,
                type: 'BUYER_CONFIRMED_AWAITING_YOUR_ACTION',
                title: 'Buyer Confirmed & Paid - Your Turn!',
                message: `${buyerFullNameForNotification} has confirmed readiness and escrowed funds for "${productTitleForNotif}". Please confirm your readiness to proceed.`,
                relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }], { session }));
        }
        // إشعار للمشتري
        notificationPromises.push(Notification.create([{
            user: buyerId,
            type: 'MEDIATION_CONFIRMED_BY_PARTY', // أو ESCROW_SUCCESSFUL
            title: 'Readiness & Escrow Confirmed',
            message: buyerAlertMessage, // استخدم الرسالة الديناميكية
            relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
        }], { session }));

        // إذا تم تأكيد كلا الطرفين، أرسل إشعارًا لجميع الأطراف (بما في ذلك الوسيط)
        if (nextStatus === 'PartiesConfirmed') {
            const partiesConfirmedNotifMessage = `All parties (Seller & Buyer) have confirmed readiness for "${productTitleForNotif}". The mediation chat will be initiated shortly.`;
            const participantsToNotify = [mediationRequest.seller._id, buyerId];
            if (mediationRequest.mediator?._id) participantsToNotify.push(mediationRequest.mediator._id);

            const partiesConfirmedNotifications = [...new Set(participantsToNotify)].map(pId => ({
                user: pId,
                type: 'PARTIES_CONFIRMED_AWAITING_CHAT',
                title: 'All Parties Confirmed!',
                message: partiesConfirmedNotifMessage,
                relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }));
            if (partiesConfirmedNotifications.length > 0) {
                notificationPromises.push(Notification.insertMany(partiesConfirmedNotifications, { session }));
            }
        }
        if (notificationPromises.length > 0) await Promise.all(notificationPromises);
        console.log("   Notifications sent for buyer readiness and escrow.");


        // 11. Commit Transaction
        await session.commitTransaction();
        console.log(`   Transaction committed. MediationRequest ${mediationRequestId} status: ${nextStatus}.`);

        // 12. بدء المحادثة إذا تم تأكيد كلا الطرفين (خارج الـ transaction)
        if (nextStatus === 'PartiesConfirmed') {
            initiateMediationChat(mediationRequest._id, "buyerConfirmReadinessAndEscrow").catch(err => {
                console.error("Error triggering initiateMediationChat from buyerConfirmReadinessAndEscrow (post-commit):", err);
            });
        }

        // 13. إرسال تحديثات Socket.IO لإعلام العملاء بالتغييرات
        if (req.io) {
            const roomName = mediationRequestId.toString();
            // جلب النسخة النهائية المحدثة من الوساطة لإرسالها عبر السوكيت
            const finalUpdatedRequestForSocket = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title imageUrls currency agreedPrice bidAmount bidCurrency status')
                .populate('seller', '_id fullName avatarUrl userRole')
                .populate('buyer', '_id fullName avatarUrl userRole')
                .populate('mediator', '_id fullName avatarUrl userRole')
                .lean();

            if (finalUpdatedRequestForSocket) {
                req.io.to(roomName).emit('mediation_details_updated', {
                    mediationRequestId,
                    updatedMediationDetails: finalUpdatedRequestForSocket
                });
                console.log(`   SOCKET: Emitted 'mediation_details_updated' for room ${roomName}`);
            }
            // إرسال تحديث رصيد المشتري
            if (req.onlineUsers && req.onlineUsers[buyerId.toString()]) {
                const freshBuyerUser = await User.findById(buyerId).select('balance').lean(); // جلب الرصيد المحدث فقط
                if (freshBuyerUser) {
                    req.io.to(req.onlineUsers[buyerId.toString()]).emit('user_profile_updated', {
                        _id: buyerId.toString(),
                        balance: freshBuyerUser.balance
                        // أرسل فقط الحقول التي تغيرت أو التي تهم هذا السياق
                    });
                    console.log(`   SOCKET: Emitted 'user_profile_updated' (balance update) to buyer ${buyerId}`);
                }
            }
        }

        // إعادة جلب الطلب المحدث بالكامل للاستجابة
        const finalResponseRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title currency agreedPrice') // Populate حسب الحاجة
            .populate('seller', '_id fullName')
            .populate('buyer', '_id fullName')
            .populate('mediator', '_id fullName')
            .lean();

        res.status(200).json({
            msg: buyerAlertMessage,
            mediationRequest: finalResponseRequest, // إرجاع الطلب المحدث
            updatedBuyerBalance: buyerUser.balance // إرجاع رصيد المشتري المحدث (بالعملة الأساسية للمنصة)
        });

    } catch (error) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("[Controller buyerConfirmReadinessAndEscrow] CRITICAL Error:", error.message, "\nFull Stack:", error.stack);
        res.status(error.status || 400).json({ msg: error.message || 'Failed to confirm readiness or escrow funds.' }); // استخدام error.status إذا كان متاحًا
    } finally {
        if (session) {
            await session.endSession();
        }
        console.log(`--- [SERVER] buyerConfirmReadinessAndEscrow END - MediationID: ${mediationRequestId} ---`);
    }
};

// --- Buyer: Reject Mediation ---
exports.buyerRejectMediation = async (req, res) => {
    const { mediationRequestId } = req.params; // ID طلب الوساطة من مسار الطلب
    const buyerId = req.user._id; // ID المستخدم الحالي (المشتري) من المصادقة
    const { reason } = req.body; // سبب الإلغاء من جسم الطلب
    const buyerFullName = req.user.fullName || `Buyer (${buyerId.toString().slice(-4)})`; // اسم المشتري الكامل للإشعارات

    console.log(`--- Controller: buyerRejectMediation for Request: ${mediationRequestId} by Buyer: ${buyerId} ---`);
    console.log(`   Reason for cancellation: "${reason}"`);

    // 1. التحقق الأولي من المدخلات
    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        console.warn("   Validation Error: Invalid Mediation Request ID format.");
        return res.status(400).json({ msg: "Invalid Mediation Request ID." });
    }
    if (!reason || reason.trim() === "") {
        console.warn("   Validation Error: Rejection reason is required.");
        return res.status(400).json({ msg: "Rejection reason is required to cancel mediation." });
    }

    // 2. بدء معاملة قاعدة البيانات
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for buyerRejectMediation.");

    let productIdThatWasUpdated = null; // متغير لتخزين ID المنتج إذا تم تحديث حالته
    let sellerIdThatWasUpdated = null; // <--- قم بتعريف المتغير هنا

    try {
        // 3. جلب طلب الوساطة مع populate للمنتج، البائع، والوسيط
        console.log("   Fetching mediation request details from database...");
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title _id user status currentMediationRequest') // 'user' هنا هو ID بائع المنتج
            .populate('seller', '_id fullName') // معلومات البائع
            .populate('mediator', '_id fullName') // معلومات الوسيط (إذا كان معينًا)
            .session(session);

        // 4. التحقق من وجود طلب الوساطة وصلاحيات المشتري
        if (!mediationRequest) {
            console.error(`   Error: Mediation request ${mediationRequestId} not found.`);
            throw new Error("Mediation request not found.");
        }
        if (!mediationRequest.buyer.equals(buyerId)) {
            console.warn(`   Authorization Error: User ${buyerId} is not the buyer for request ${mediationRequestId}.`);
            throw new Error("Forbidden: You are not the buyer for this request.");
        }

        // 5. التحقق من أن حالة الطلب تسمح بالإلغاء من قبل المشتري
        // (مثال: يمكن الإلغاء إذا كان الوسيط قد تم تعيينه أو قبل المهمة، ولكن قبل أن يؤكد المشتري الدفع)
        const allowedStatusesForBuyerCancellation = ['MediatorAssigned', 'MediationOfferAccepted'];
        if (!allowedStatusesForBuyerCancellation.includes(mediationRequest.status)) {
            console.warn(`   Action Not Allowed: Cannot cancel mediation. Current status is '${mediationRequest.status}'.`);
            throw new Error(`Action not allowed. Current mediation status is '${mediationRequest.status}'.`);
        }

        // 6. تحديث حالة طلب الوساطة إلى 'Cancelled'
        const originalStatus = mediationRequest.status;
        mediationRequest.status = 'Cancelled';

        // --- [!!!] الحل: أضف هذا السطر هنا [!!!] ---
        mediationRequest.cancellationDetails = {
            cancelledBy: buyerId,
            cancelledByType: 'Buyer',
            reason: reason.trim(), // استخدم السبب الذي تم إرساله من الواجهة
            cancelledAt: new Date()
        };
        // --- نهاية الإضافة ---

        if (!Array.isArray(mediationRequest.history)) {
            mediationRequest.history = [];
        }
        mediationRequest.history.push({
            event: "Buyer cancelled mediation",
            userId: buyerId,
            details: { reason: reason.trim(), previousStatus: originalStatus },
            timestamp: new Date()
        });

        const updatedMediationRequestDoc = await mediationRequest.save({ session });
        console.log(`   MediationRequest ${updatedMediationRequestDoc._id} status updated to 'Cancelled'.`);

        // 7. إعادة المنتج المرتبط إلى حالة 'approved' إذا كان لا يزال مرتبطًا بهذا الطلب ولم يتم بيعه/إكماله
        if (mediationRequest.product?._id) {
            const productDoc = await Product.findById(mediationRequest.product._id).session(session);
            if (productDoc &&
                !['sold', 'Completed'].includes(productDoc.status) && // المنتج لم يباع أو يكتمل
                productDoc.currentMediationRequest && productDoc.currentMediationRequest.equals(mediationRequest._id) // المنتج لا يزال مرتبطًا بهذا الطلب
            ) {
                productDoc.status = 'approved'; // إعادة المنتج ليكون متاحًا
                productDoc.currentMediationRequest = null; // إزالة الارتباط بطلب الوساطة الملغى
                productDoc.buyer = null; // إزالة المشتري المرتبط بهذا العرض السابق
                productDoc.agreedPrice = null; // إزالة السعر المتفق عليه
                await productDoc.save({ session });
                productIdThatWasUpdated = productDoc._id; // احفظ ID المنتج الذي تم تحديثه
                sellerIdThatWasUpdated = productDoc.user; // [!!!] قم بإعطاء قيمة للمتغير هنا
                console.log(`   Product ${productDoc._id} status reset to 'approved', mediation link and buyer info removed.`);
            } else if (productDoc) {
                console.log(`   Product ${productDoc._id} not reset. Current status: ${productDoc.status}. Linked mediation: ${productDoc.currentMediationRequest}`);
            }
        }

        // 8. تحديث حالة الوسيط (إذا كان معينًا) إلى 'Available' إذا لم يكن لديه مهام أخرى نشطة
        if (mediationRequest.mediator?._id) {
            const otherActiveAssignmentsForMediator = await MediationRequest.countDocuments({
                mediator: mediationRequest.mediator._id,
                status: { $in: ['MediatorAssigned', 'MediationOfferAccepted', 'InProgress', 'PartiesConfirmed', 'EscrowFunded'] }
            }).session(session);

            if (otherActiveAssignmentsForMediator === 0) {
                await User.findByIdAndUpdate(mediationRequest.mediator._id, { $set: { mediatorStatus: 'Available' } }, { session });
                console.log(`   Mediator ${mediationRequest.mediator._id} status updated to 'Available'.`);
            } else {
                console.log(`   Mediator ${mediationRequest.mediator._id} has ${otherActiveAssignmentsForMediator} other active assignments, status remains unchanged.`);
            }
        }

        // 9. إنشاء وإرسال الإشعارات للأطراف المعنية
        const productTitleForNotification = mediationRequest.product?.title || 'the transaction';
        const notifications = [
            { // إشعار للبائع
                user: mediationRequest.seller._id,
                type: 'MEDIATION_CANCELLED_BY_BUYER', // نوع مميز
                title: 'Mediation Cancelled by Buyer',
                message: `${buyerFullName} has cancelled the mediation for product "${productTitleForNotification}". Reason: "${reason.trim()}". The product may now be available for new bids.`,
                relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' }
            },
            { // إشعار للمشتري (تأكيد الإلغاء)
                user: buyerId,
                type: 'MEDIATION_CANCELLATION_CONFIRMED',
                title: 'Mediation Cancellation Confirmed',
                message: `You have successfully cancelled the mediation for product "${productTitleForNotification}".`,
                relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' }
            }
        ];
        if (mediationRequest.mediator?._id) { // إذا كان هناك وسيط، أرسل له إشعارًا
            notifications.push({
                user: mediationRequest.mediator._id,
                type: 'MEDIATION_CANCELLED_BY_PARTY',
                title: 'Mediation Cancelled by Buyer',
                message: `The mediation for product "${productTitleForNotification}" (between seller ${mediationRequest.seller.fullName} and buyer ${buyerFullName}) has been cancelled by the buyer. Reason: "${reason.trim()}".`,
                relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' }
            });
        }

        const createdNotifications = await Notification.insertMany(notifications, { session, ordered: true });
        console.log("   Cancellation notifications created and saved in DB.");

        // إرسال إشعارات السوكيت الفورية
        if (req.io && req.onlineUsers) {
            createdNotifications.forEach(notificationDoc => {
                const targetUserSocketId = req.onlineUsers[notificationDoc.user.toString()];
                if (targetUserSocketId) {
                    req.io.to(targetUserSocketId).emit('new_notification', notificationDoc.toObject());
                    console.log(`   [Socket] Sent 'new_notification' for cancellation to user ${notificationDoc.user}.`);
                }
            });
        }

        // 10. إتمام المعاملة (Commit)
        await session.commitTransaction();
        console.log("   buyerRejectMediation transaction committed successfully.");

        // --- [!!! إرسال أحداث Socket.IO بعد الـ Commit لتحديث الواجهات !!!] ---
        // 10.1. إرسال تحديث لطلب الوساطة الملغى
        const finalPopulatedMediationRequest = await MediationRequest.findById(updatedMediationRequestDoc._id)
            .populate('product', 'title status currentMediationRequest agreedPrice imageUrls currency user buyer bids.user')
            .populate('seller', 'fullName avatarUrl _id')
            .populate('buyer', 'fullName avatarUrl _id')
            .populate('mediator', 'fullName avatarUrl _id') // سيكون null إذا لم يتم تعيينه أو أُزيل
            .lean();

        // [!!!] الحل: ضع الـ console.log هنا [!!!]
        console.log("--- DEBUG: Data being sent via socket for rejection ---");
        console.log(JSON.stringify(finalPopulatedMediationRequest, null, 2));
        console.log("---------------------------------------------------------");
        // [!!!] نهاية الجزء الذي تضيفه [!!!]

        if (req.io && finalPopulatedMediationRequest) {
            const involvedUserIds = [
                finalPopulatedMediationRequest.seller?._id?.toString(),
                finalPopulatedMediationRequest.buyer?._id?.toString(),
                finalPopulatedMediationRequest.mediator?._id?.toString() // قد يكون الوسيط null
            ].filter(id => id); // إزالة القيم الفارغة (مثل الوسيط إذا كان null)
            const uniqueInvolvedUserIds = [...new Set(involvedUserIds)];

            uniqueInvolvedUserIds.forEach(involvedUserIdString => {
                if (req.onlineUsers && req.onlineUsers[involvedUserIdString]) {
                    req.io.to(req.onlineUsers[involvedUserIdString]).emit('mediation_request_updated', {
                        mediationRequestId: finalPopulatedMediationRequest._id.toString(),
                        updatedMediationRequestData: finalPopulatedMediationRequest
                    });
                    console.log(`   [Socket] Emitted 'mediation_request_updated' to user ${involvedUserIdString} for cancelled request ${finalPopulatedMediationRequest._id}.`);
                }
            });
        }

        // 2. إرسال تحديث للمنتج إذا تم تحديثه
        if (req.io && productIdThatWasUpdated) {
            // --- [!!! جلب المنتج المحدث بالكامل مرة أخرى لإرساله عبر السوكيت !!!] ---
            const productToSendViaSocket = await Product.findById(productIdThatWasUpdated)
                .populate('user', 'fullName email avatarUrl')
                .populate('bids.user', 'fullName email avatarUrl')
                .populate('buyer', 'fullName email avatarUrl') // سيكون null
                .populate({ path: 'currentMediationRequest', select: '_id status' }) // سيكون null
                .lean();

            if (productToSendViaSocket) {
                req.io.emit('product_updated', productToSendViaSocket);

                // --- [!!!] هذا هو الجزء الحاسم والمحسّن [!!!] ---
                const sellerId = sellerIdThatWasUpdated.toString();
                const sellerSocketId = req.onlineUsers[sellerId];

                if (sellerSocketId) {
                    // قم بإعادة حساب عدد المنتجات النشطة للبائع وأرسله
                    const newActiveListingsCount = await Product.countDocuments({
                        user: sellerId,
                        status: 'approved'
                    });

                    const profileUpdatePayload = {
                        _id: sellerId,
                        activeListingsCount: newActiveListingsCount
                    };

                    req.io.to(sellerSocketId).emit('user_profile_updated', profileUpdatePayload);
                    console.log(`   [Socket buyerRejectMediation] Emitted 'user_profile_updated' to seller ${sellerId} with new count: ${newActiveListingsCount}`);
                }
                // --- نهاية الجزء الحاسم ---
            }
        }

        // [!!!] هذا الجزء سيعمل الآن بدون خطأ [!!!]
        // إرسال تحديث لإحصائيات البائع
        if (req.io && sellerIdThatWasUpdated) { // <--- تحقق من وجود المتغير
            const sellerId = sellerIdThatWasUpdated.toString();
            const sellerSocketId = req.onlineUsers[sellerId];

            if (sellerSocketId) {
                const newActiveListingsCount = await Product.countDocuments({
                    user: sellerId,
                    status: 'approved'
                });

                const profileUpdatePayload = {
                    _id: sellerId,
                    activeListingsCount: newActiveListingsCount
                };

                req.io.to(sellerSocketId).emit('user_profile_updated', profileUpdatePayload);
                console.log(`   [Socket buyerRejectMediation] Emitted 'user_profile_updated' to seller ${sellerId} with new count: ${newActiveListingsCount}`);
            }
        }

        // [!!!] استخدم الدالة المساعدة هنا [!!!]
        if (sellerIdThatWasUpdated) {
            await sendUserStatsUpdate(req, sellerIdThatWasUpdated);
        }

        // --- نهاية إرسال أحداث Socket.IO ---

        // 11. إرسال استجابة ناجحة للعميل
        res.status(200).json({
            msg: "Mediation cancelled successfully.",
            mediationRequest: finalPopulatedMediationRequest // أرجع طلب الوساطة المحدث (الملغى)
        });

    } catch (error) {
        // 12. في حالة حدوث أي خطأ، قم بإلغاء المعاملة
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.error("   Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: buyerRejectMediation ERROR ---", error);
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Action not allowed") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || 'Failed to cancel mediation.' });
    } finally {
        // 13. إنهاء جلسة قاعدة البيانات دائمًا
        if (session && typeof session.endSession === 'function') {
            if (session.inTransaction()) {
                console.warn("   [buyerRejectMediation Finally] Session was still in transaction. Aborting.");
                await session.abortTransaction();
            }
            await session.endSession();
            console.log("   MongoDB session ended for buyerRejectMediation.");
        }
        console.log("--- Controller: buyerRejectMediation END ---");
    }
};

// --- Get Mediation Chat History ---
exports.getMediationChatHistory = async (req, res) => {
    const { mediationRequestId } = req.params;
    const userId = req.user._id; // المستخدم الحالي
    try {
        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) return res.status(400).json({ msg: "Invalid ID." });

        const request = await MediationRequest.findById(mediationRequestId)
            .select('seller buyer mediator status chatMessages disputeOverseers') // أضفت disputeOverseers
            .populate('chatMessages.sender', 'fullName avatarUrl _id userRole');
        // يمكنك إضافة populate لـ disputeOverseers إذا أردت عرض معلوماتهم هنا أيضًا

        if (!request) return res.status(404).json({ msg: "Request not found." });

        // --- [!!!] التحقق من الصلاحية هنا [!!!] ---
        const isSeller = request.seller.equals(userId);
        const isBuyer = request.buyer.equals(userId);
        const isMediator = request.mediator && request.mediator.equals(userId);
        // --- [!!!] يجب إضافة الأدمن هنا إذا كانت الحالة Disputed [!!!] ---
        const isAdmin = req.user.userRole === 'Admin'; // افترض أن req.user يحتوي على userRole
        const isOverseer = request.disputeOverseers && request.disputeOverseers.some(adminId => adminId.equals(userId));

        let isParty = isSeller || isBuyer || isMediator;

        // إذا كانت الحالة نزاع، اسمح للأدمن أو المشرف على النزاع بالوصول
        if (request.status === 'Disputed' && (isAdmin || isOverseer)) {
            isParty = true;
            console.log(`   [ChatHistory] Admin/Overseer ${userId} accessing disputed chat ${mediationRequestId}.`);
        }
        // ---------------------------------------------------------------

        if (!isParty) {
            console.warn(`   [ChatHistory] User ${userId} (Role: ${req.user.userRole}) is FORBIDDEN from accessing chat history for ${mediationRequestId}. Parties: S-${request.seller}, B-${request.buyer}, M-${request.mediator}`);
            return res.status(403).json({ msg: "Forbidden: You are not a party to this mediation chat or not authorized." });
        }
        // --------------------------------------------

        res.status(200).json(request.chatMessages || []);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ msg: "Server error fetching chat history.", errorDetails: error.message });
    }
};

exports.handleChatImageUpload = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: "No file uploaded." });
    }

    const imageUrl = `/uploads/chat/${req.file.filename}`;

    res.status(200).json({
        msg: "Image uploaded successfully.",
        imageUrl
    });
};

exports.getMyMediationSummariesController = async (req, res) => {
    console.log("--- Controller: getMyMediationSummariesController ---");
    try {
        const userId = req.user._id; // ID المستخدم الحالي من middleware المصادقة

        // جلب جميع طلبات الوساطة التي يكون المستخدم طرفًا فيها
        const mediationRequests = await MediationRequest.find({
            $or: [
                { seller: userId },
                { buyer: userId },
                { mediator: userId }
            ],
            // يمكنك إضافة فلتر للحالة إذا أردت، مثلاً لاستبعاد الحالات المنتهية تمامًا
            // status: { $in: ['InProgress', 'PendingBuyerAction', ... ] }
        })
            .populate('product', 'title imageUrls') // جلب عنوان المنتج وصورة (اختياري)
            .populate('seller', '_id fullName avatarUrl userRole')
            .populate('buyer', '_id fullName avatarUrl userRole')
            .populate('mediator', '_id fullName avatarUrl userRole')
            .sort({ 'chatMessages.timestamp': -1, updatedAt: -1 }) // ترتيب حسب آخر رسالة أو آخر تحديث
            .lean(); // .lean() للأداء الأفضل عند القراءة فقط

        if (!mediationRequests) {
            return res.status(200).json({ requests: [], totalUnreadMessages: 0 });
        }

        let totalUnreadMessagesOverall = 0;

        const summaries = mediationRequests.map(request => {
            let unreadMessagesCount = 0;
            if (request.chatMessages && request.chatMessages.length > 0) {
                request.chatMessages.forEach(msg => {
                    // تحقق أن الرسالة ليست من المستخدم الحالي
                    // وأنه لم يقرأها بعد (لا يوجد سجل قراءة له)
                    if (msg.sender && !msg.sender.equals(userId) &&
                        (!msg.readBy || !msg.readBy.some(rb => rb.readerId && rb.readerId.equals(userId)))) {
                        unreadMessagesCount++;
                    }
                });
            }
            totalUnreadMessagesOverall += unreadMessagesCount;

            // تحديد الطرف الآخر
            let otherParty = null;
            let otherPartyRole = '';
            if (request.seller?._id.equals(userId)) {
                otherParty = request.buyer;
                otherPartyRole = 'Buyer';
            } else if (request.buyer?._id.equals(userId)) {
                otherParty = request.seller;
                otherPartyRole = 'Seller';
            } else if (request.mediator?._id.equals(userId)) {
                // إذا كان المستخدم هو الوسيط، يمكنك اختيار عرض البائع أو المشتري كـ "الطرف الآخر"
                // أو ربما عرض "Seller & Buyer"
                // للتبسيط الآن، سنأخذ البائع
                otherParty = request.seller;
                otherPartyRole = 'Seller (Mediating)';
                if (!otherParty && request.buyer) { // Fallback if seller is null for some reason
                    otherParty = request.buyer;
                    otherPartyRole = 'Buyer (Mediating)';
                }
            }

            // الحصول على timestamp آخر رسالة
            let lastMessageTimestamp = request.updatedAt; // قيمة افتراضية
            if (request.chatMessages && request.chatMessages.length > 0) {
                // نفترض أن الرسائل مرتبة، آخر رسالة هي الأخيرة في المصفوفة
                // ولكن يجب التأكد من الترتيب عند الإضافة أو الاعتماد على sort
                const sortedMessages = [...request.chatMessages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (sortedMessages.length > 0) {
                    lastMessageTimestamp = sortedMessages[0].timestamp;
                }
            }

            return {
                _id: request._id,
                product: request.product ? { title: request.product.title, imageUrl: request.product.imageUrls?.[0] } : { title: 'N/A' },
                status: request.status,
                otherParty: otherParty ? {
                    _id: otherParty._id,
                    fullName: otherParty.fullName,
                    avatarUrl: otherParty.avatarUrl,
                    roleLabel: otherPartyRole
                } : { fullName: 'N/A', roleLabel: 'Participant' },
                unreadMessagesCount: unreadMessagesCount,
                lastMessageTimestamp: lastMessageTimestamp,
                updatedAt: request.updatedAt, // قد يكون مفيدًا للترتيب الإضافي
            };
        });

        // ترتيب الملخصات: التي بها رسائل غير مقروءة أولاً، ثم حسب آخر نشاط رسالة
        summaries.sort((a, b) => {
            if (a.unreadMessagesCount > 0 && b.unreadMessagesCount === 0) return -1;
            if (a.unreadMessagesCount === 0 && b.unreadMessagesCount > 0) return 1;
            return new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp);
        });


        res.status(200).json({
            requests: summaries,
            totalUnreadMessagesCount: totalUnreadMessagesOverall // <--- هذا الاسم صحيح ويتطابق مع التصحيح المقترح للـ reducer
        });

    } catch (error) {
        console.error("[getMyMediationSummariesController] Error:", error);
        res.status(500).json({ msg: "Server error fetching mediation summaries.", errorDetails: error.message });
    }
};

// --- Buyer Confirms Receipt of Product/Service ---
exports.buyerConfirmReceiptController = async (req, res) => {
    const { mediationRequestId } = req.params;
    const buyerId = req.user._id;
    const buyerFullNameForNotification = req.user.fullName || 'The Buyer';

    console.log(`--- Controller: buyerConfirmReceipt for Mediation: ${mediationRequestId} by Buyer: ${buyerId} ---`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('seller', '_id fullName balance sellerPendingBalance sellerAvailableBalance level reputationPoints reputationLevel claimedLevelRewards productsSoldCount')
            .populate('mediator', '_id fullName balance level reputationPoints reputationLevel claimedLevelRewards successfulMediationsCount mediatorStatus')
            .populate('buyer', '_id fullName level reputationPoints reputationLevel claimedLevelRewards')
            .populate('product', 'title _id')
            .session(session);

        if (!mediationRequest) {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] Mediation request ${mediationRequestId} not found.`);
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (!mediationRequest.buyer._id.equals(buyerId)) {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] FORBIDDEN: User ${buyerId} is not the buyer.`);
            return res.status(403).json({ msg: "Forbidden: You are not the buyer for this request." });
        }
        if (mediationRequest.status !== 'InProgress') {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] Action not allowed. Status: '${mediationRequest.status}'. Expected 'InProgress'.`);
            return res.status(400).json({ msg: `Action not allowed. Current status is '${mediationRequest.status}'. Expected 'InProgress'.` });
        }
        if (!mediationRequest.escrowedAmount || mediationRequest.escrowedAmount <= 0) {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] No funds in escrow for mediation ${mediationRequestId}.`);
            return res.status(400).json({ msg: "No funds in escrow for this mediation." });
        }

        const seller = mediationRequest.seller;
        const mediator = mediationRequest.mediator;
        const buyer = mediationRequest.buyer;
        const product = mediationRequest.product;

        if (!seller || !mediator || !buyer || !product) {
            await session.abortTransaction();
            console.error(`[ConfirmReceipt] CRITICAL: Missing data for mediation ${mediationRequestId}.`);
            return res.status(404).json({ msg: "Associated seller, mediator, buyer, or product not found." });
        }

        // 1. حساب المبالغ والرسوم
        const totalEscrowedInOriginalCurrency = parseFloat(mediationRequest.escrowedAmount);
        const originalEscrowCurrency = mediationRequest.escrowedCurrency;
        const mediatorFeeInOriginalCurrency = parseFloat(mediationRequest.calculatedMediatorFee || 0);
        const feeCurrency = mediationRequest.mediationFeeCurrency || originalEscrowCurrency; // عملة رسوم الوسيط الأصلية
        const netAmountForSellerInOriginalCurrency = totalEscrowedInOriginalCurrency - mediatorFeeInOriginalCurrency;

        if (netAmountForSellerInOriginalCurrency < 0) {
            await session.abortTransaction();
            console.error(`[ConfirmReceipt] Calculation Error: Negative amount for seller (${netAmountForSellerInOriginalCurrency}).`);
            return res.status(500).json({ msg: "Calculation error: Negative amount derived for seller." });
        }

        // تحويل مبلغ البائع الصافي إلى عملة المنصة الأساسية
        let netAmountForSellerInPlatformCurrency = netAmountForSellerInOriginalCurrency;
        if (originalEscrowCurrency === 'USD' && PLATFORM_BASE_CURRENCY === 'TND') {
            netAmountForSellerInPlatformCurrency = netAmountForSellerInOriginalCurrency * TND_USD_EXCHANGE_RATE;
        } else if (originalEscrowCurrency === 'TND' && PLATFORM_BASE_CURRENCY === 'USD') {
            netAmountForSellerInPlatformCurrency = netAmountForSellerInOriginalCurrency / TND_USD_EXCHANGE_RATE;
        }
        netAmountForSellerInPlatformCurrency = parseFloat(netAmountForSellerInPlatformCurrency.toFixed(2));

        // 2. إنشاء سجل Transaction لتعليق أموال البائع
        const pendingSaleTransaction = new Transaction({
            user: seller._id, // البائع هو المستخدم المرتبط بهذه المعاملة
            type: 'PRODUCT_SALE_FUNDS_PENDING',
            amount: netAmountForSellerInOriginalCurrency,
            currency: originalEscrowCurrency,
            status: 'ON_HOLD', // أو 'PENDING_RELEASE'
            description: `Funds from sale of '${product.title}' (Mediation: ${mediationRequestId.toString().slice(-6)}) are now on hold.`,
            relatedProduct: product._id,
            relatedMediationRequest: mediationRequestId,
            metadata: {
                buyerId: buyerId.toString(),
                buyerName: buyerFullNameForNotification,
                originalAmount: totalEscrowedInOriginalCurrency, // المبلغ الإجمالي قبل خصم رسوم الوسيط
                originalCurrency: originalEscrowCurrency,
                mediatorFee: mediatorFeeInOriginalCurrency,
                feeCurrency: feeCurrency
            }
        });
        await pendingSaleTransaction.save({ session });
        console.log(`   Transaction (PRODUCT_SALE_FUNDS_PENDING) created: ${pendingSaleTransaction._id}`);

        // 3. إنشاء سجل PendingFund للبائع
        const releaseTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 ساعة من الآن
        const pendingFundRecord = new PendingFund({
            seller: seller._id,
            mediationRequest: mediationRequestId,
            product: product._id,
            amount: netAmountForSellerInOriginalCurrency, // المبلغ الصافي للبائع بالعملة الأصلية
            currency: originalEscrowCurrency,
            amountInPlatformCurrency: netAmountForSellerInPlatformCurrency, // المبلغ الصافي بالعملة الأساسية
            platformCurrency: PLATFORM_BASE_CURRENCY,
            releaseAt: releaseTime,
            transactionPendingId: pendingSaleTransaction._id // ربط بسجل المعاملة الأولي
        });
        await pendingFundRecord.save({ session });
        console.log(`   PendingFund record created: ${pendingFundRecord._id} for seller ${seller._id}, release at ${releaseTime.toISOString()}`);

        // 4. تحديث sellerPendingBalance للبائع (بالعملة الأساسية للمنصة)
        seller.sellerPendingBalance = parseFloat(((seller.sellerPendingBalance || 0) + netAmountForSellerInPlatformCurrency).toFixed(2));
        // لا يتم الحفظ هنا بعد، سيتم مع تحديثات السمعة

        // 5. دفع عمولة الوسيط
        let mediatorFeeInPlatformCurrency = mediatorFeeInOriginalCurrency;
        if (feeCurrency === 'USD' && PLATFORM_BASE_CURRENCY === 'TND') {
            mediatorFeeInPlatformCurrency = mediatorFeeInOriginalCurrency * TND_USD_EXCHANGE_RATE;
        } else if (feeCurrency === 'TND' && PLATFORM_BASE_CURRENCY === 'USD') {
            mediatorFeeInPlatformCurrency = mediatorFeeInOriginalCurrency / TND_USD_EXCHANGE_RATE;
        }
        mediatorFeeInPlatformCurrency = parseFloat(mediatorFeeInPlatformCurrency.toFixed(2));
        mediator.balance = parseFloat(((mediator.balance || 0) + mediatorFeeInPlatformCurrency).toFixed(2));
        // لا يتم الحفظ هنا بعد

        const mediatorFeeTransaction = new Transaction({
            user: mediator._id, // الوسيط هو المستخدم المرتبط بهذه المعاملة
            type: 'MEDIATION_FEE_RECEIVED',
            amount: mediatorFeeInOriginalCurrency, // مبلغ العمولة الأصلي
            currency: feeCurrency, // عملة العمولة الأصلية
            status: 'COMPLETED',
            description: `Fee received for mediating '${product.title}' (Mediation: ${mediationRequestId.toString().slice(-6)}).`,
            relatedMediationRequest: mediationRequestId
        });
        await mediatorFeeTransaction.save({ session });
        console.log(`   Transaction (MEDIATION_FEE_RECEIVED) created: ${mediatorFeeTransaction._id} for mediator ${mediator._id}`);

        // 6. تحديث حالة الوساطة
        mediationRequest.status = 'Completed';
        mediationRequest.history.push({
            event: "Buyer confirmed receipt, funds processed and transaction completed.",
            userId: buyerId,
            timestamp: new Date(),
            details: {
                releasedToSellerPending: netAmountForSellerInOriginalCurrency,
                sellerCurrency: originalEscrowCurrency,
                mediatorFeePaid: mediatorFeeInOriginalCurrency,
                mediatorFeeCurrency: feeCurrency
            }
        });
        // سيتم حفظ mediationRequest مع حفظ المستخدمين

        // 7. تحديث حالة المنتج وعداد مبيعات البائع
        const productDoc = await Product.findById(product._id).session(session);
        if (productDoc) {
            productDoc.status = 'sold';
            productDoc.soldAt = new Date();
            productDoc.buyer = buyerId;
            await productDoc.save({ session });
            seller.productsSoldCount = (seller.productsSoldCount || 0) + 1;
            console.log(`   Product ${productDoc._id} status set to sold. Seller ${seller._id} productsSoldCount updated to ${seller.productsSoldCount}.`);
        }

        // 8. تحديث نقاط السمعة والمستويات والمكافآت لجميع الأطراف (+1 نقطة للجميع عند الإكمال)
        console.log("   [Reputation] Processing reputation (+1), levels, and rewards for participants.");
        const participants = [seller, buyer, mediator];
        for (const participant of participants) {
            if (participant) {
                const oldLevel = participant.level;
                participant.reputationPoints = (participant.reputationPoints || 0) + 1;
                if (participant._id.equals(mediator._id)) {
                    participant.successfulMediationsCount = (participant.successfulMediationsCount || 0) + 1;
                }
                const badgeChangedByLevelUpdate = updateUserLevelAndBadge(participant);
                const rewardGivenByLevelUp = await processLevelUpRewards(participant, oldLevel, session);

                if (badgeChangedByLevelUpdate && !rewardGivenByLevelUp && oldLevel === participant.level) {
                    await Notification.create([{
                        user: participant._id, type: 'BADGE_UPDATED',
                        title: `🏅 Reputation Update: You are now ${participant.reputationLevel}!`,
                        message: `Your reputation level has been updated to ${participant.reputationLevel}.`,
                        relatedEntity: { id: participant._id, modelName: 'User' }
                    }], { session });
                }
            }
        }
        // حفظ جميع التغييرات على المستخدمين (بما في ذلك الأرصدة المحدثة) والوساطة
        await seller.save({ session });
        await buyer.save({ session });
        await mediator.save({ session });
        await mediationRequest.save({ session });
        console.log("   Users (balances, reputation, etc.) and MediationRequest updated and saved.");

        // 9. إنشاء إشعارات
        const productTitleForNotif = product.title || 'the transaction';
        const notifications = [
            {
                user: seller._id,
                type: 'SALE_FUNDS_PENDING',
                title: 'notification_titles.SALE_FUNDS_PENDING', // <-- مفتاح
                message: 'notification_messages.SALE_FUNDS_PENDING', // <-- مفتاح
                messageParams: { // <-- متغيرات
                    buyerName: buyerFullNameForNotification,
                    productName: productTitleForNotif,
                    amount: formatCurrency(netAmountForSellerInOriginalCurrency, originalEscrowCurrency)
                },
                relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
            },
            {
                user: mediator._id,
                type: 'MEDIATION_FEE_RECEIVED',
                title: 'notification_titles.MEDIATION_FEE_RECEIVED', // <-- مفتاح
                message: 'notification_messages.MEDIATION_FEE_RECEIVED', // <-- مفتاح
                messageParams: { // <-- متغيرات
                    amount: formatCurrency(mediatorFeeInOriginalCurrency, feeCurrency),
                    productName: productTitleForNotif
                },
                relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
            },
            {
                user: buyerId,
                type: 'PRODUCT_RECEIPT_CONFIRMED',
                title: 'notification_titles.PRODUCT_RECEIPT_CONFIRMED', // <-- مفتاح
                message: 'notification_messages.PRODUCT_RECEIPT_CONFIRMED', // <-- مفتاح
                messageParams: { // <-- متغيرات
                    productName: productTitleForNotif
                },
                relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
            }
        ];
        await Notification.insertMany(notifications, { session });
        console.log("   Notifications sent for receipt confirmation.");

        // (اختياري ولكن جيد للشفافية) إنشاء سجل معاملة للمشتري
        const purchaseTransaction = new Transaction({
            user: buyerId, // <<< يجب أن يكون المشتري هو المستخدم هنا
            type: 'PRODUCT_PURCHASE_COMPLETED',
            amount: totalEscrowedInOriginalCurrency, // المبلغ الإجمالي الذي دفعه المشتري (يشمل رسومه إذا كانت هناك)
            currency: originalEscrowCurrency,
            status: 'COMPLETED',
            description: `Purchase of '${product.title}' (Mediation: ${mediationRequestId.toString().slice(-6)}) from seller ${seller.fullName}.`,
            relatedProduct: product._id,
            relatedMediationRequest: mediationRequestId,
            recipient: seller._id // المستفيد من هذه الدفعة هو البائع (وإن كانت معلقة)
        });
        await purchaseTransaction.save({ session });
        console.log(`   Transaction (PRODUCT_PURCHASE_COMPLETED) created: ${purchaseTransaction._id} for buyer ${buyerId}`);

        // 10. Commit Transaction
        await session.commitTransaction();
        console.log(`--- Transaction committed for buyerConfirmReceipt: ${mediationRequestId} ---`);

        // 11. تحديث حالة الوسيط (خارج الـ transaction الرئيسي)
        try {
            const otherActiveMediations = await MediationRequest.countDocuments({
                mediator: mediator._id,
                status: { $in: ['InProgress', 'MediatorAssigned', 'MediationOfferAccepted', 'PartiesConfirmed', 'EscrowFunded'] }
            });
            if (otherActiveMediations === 0 && mediator.mediatorStatus !== 'Available') {
                await User.findByIdAndUpdate(mediator._id, { $set: { mediatorStatus: 'Available' } });
                console.log(`   [Post-Transaction] Mediator ${mediator._id} status updated to 'Available'.`);
            } else if (otherActiveMediations > 0 && mediator.mediatorStatus !== 'Busy') {
                await User.findByIdAndUpdate(mediator._id, { $set: { mediatorStatus: 'Busy' } });
                console.log(`   [Post-Transaction] Mediator ${mediator._id} status ensured to be 'Busy'.`);
            }
        } catch (mediatorStatusError) {
            console.error(`   [Post-Transaction] Error updating mediator status for ${mediator._id}:`, mediatorStatusError);
        }

        // 12. إرسال تحديثات Socket.IO
        if (req.io) {
            const roomName = mediationRequestId.toString();
            const finalUpdatedRequestForSocket = await MediationRequest.findById(mediationRequestId).populate('product seller buyer mediator').lean();
            if (finalUpdatedRequestForSocket) {
                req.io.to(roomName).emit('mediation_details_updated', { mediationRequestId, updatedMediationDetails: finalUpdatedRequestForSocket });
            }

            const usersToUpdateViaSocket = [seller, buyer, mediator];
            for (const userDoc of usersToUpdateViaSocket) {
                // أعد جلب المستخدم للحصول على أحدث حالة (خاصة الأرصدة)
                const freshUserDoc = await User.findById(userDoc._id).lean(); // .lean() مهم هنا
                if (freshUserDoc && req.onlineUsers && req.onlineUsers[freshUserDoc._id.toString()]) {
                    const userProfileSummaryForSocket = {
                        _id: freshUserDoc._id.toString(), reputationPoints: freshUserDoc.reputationPoints, level: freshUserDoc.level,
                        reputationLevel: freshUserDoc.reputationLevel, balance: freshUserDoc.balance,
                        sellerPendingBalance: freshUserDoc.sellerPendingBalance, sellerAvailableBalance: freshUserDoc.sellerAvailableBalance,
                        positiveRatings: freshUserDoc.positiveRatings, negativeRatings: freshUserDoc.negativeRatings,
                        claimedLevelRewards: freshUserDoc.claimedLevelRewards, productsSoldCount: freshUserDoc.productsSoldCount
                    };
                    req.io.to(req.onlineUsers[freshUserDoc._id.toString()]).emit('user_profile_updated', userProfileSummaryForSocket);
                }
            }
            if (seller?._id && product?._id && req.onlineUsers && req.onlineUsers[seller._id.toString()]) {
                req.io.to(req.onlineUsers[seller._id.toString()]).emit('product_list_updated_for_seller', { productId: product._id, newStatus: 'sold' });
            }
        }

        // --- [!!!] هذا هو الجزء الجديد الذي تضيفه هنا [!!!] ---
        const involvedUserIds = [seller._id.toString(), buyer._id.toString(), mediator._id.toString()];
        const uniqueInvolvedUserIds = [...new Set(involvedUserIds)];
        uniqueInvolvedUserIds.forEach(involvedUserIdString => {
            if (req.onlineUsers && req.onlineUsers[involvedUserIdString]) {
                req.io.to(req.onlineUsers[involvedUserIdString]).emit('dashboard_transactions_updated');
                console.log(`SOCKET: Emitted 'dashboard_transactions_updated' to user ${involvedUserIdString} after receipt confirmation.`);
            }
        });
        // --- [!!!] نهاية الجزء الجديد [!!!] ---

        const finalResponseMediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title _id status soldAt buyer')
            .populate('seller', '_id fullName sellerPendingBalance sellerAvailableBalance productsSoldCount level reputationLevel')
            .populate('buyer', '_id fullName level reputationLevel')
            .populate('mediator', '_id fullName balance successfulMediationsCount level reputationLevel mediatorStatus')
            .lean();

        res.status(200).json({
            msg: "Receipt confirmed successfully. Funds processed and transaction is complete.",
            mediationRequest: finalResponseMediationRequest
        });

    } catch (error) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("[Controller buyerConfirmReceipt] CRITICAL Error:", error.message, "\nFull Stack:", error.stack);
        res.status(error.status || 500).json({ msg: error.message || "Server error confirming receipt. Please try again or contact support." });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

exports.openDisputeController = async (req, res) => {
    const { mediationRequestId } = req.params;
    const { reason } = req.body;
    const disputingUserId = req.user._id;
    const disputingUserFullName = req.user.fullName || 'A user'; // احصل عليها مبكرًا

    console.log(`--- Controller: openDispute for ${mediationRequestId} by User: ${disputingUserId} ---`);
    console.log(`   Reason (optional): ${reason}`);

    const session = await mongoose.startSession();
    let updatedMediationRequestGlobal; // لتخزين النتيجة بعد نجاح المعاملة

    try {
        // عدد مرات إعادة المحاولة
        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                await session.withTransaction(async (currentSession) => {
                    const mediationRequest = await MediationRequest.findById(mediationRequestId)
                        .populate('product', 'title _id user') // user هو بائع المنتج
                        .populate('seller', '_id fullName')
                        .populate('buyer', '_id fullName')
                        .populate('mediator', '_id fullName')
                        .session(currentSession);

                    if (!mediationRequest) {
                        // لا حاجة لـ abortTransaction هنا لأن withTransaction يعالجها
                        const err = new Error("Mediation request not found.");
                        err.status = 404; // أضف status للخطأ
                        throw err;
                    }

                    const isSeller = mediationRequest.seller._id.equals(disputingUserId);
                    const isBuyer = mediationRequest.buyer._id.equals(disputingUserId);

                    if (!isSeller && !isBuyer) {
                        const err = new Error("Forbidden: You are not a party to this mediation.");
                        err.status = 403;
                        throw err;
                    }

                    if (mediationRequest.status !== 'InProgress') {
                        const err = new Error(`Cannot open dispute. Current status is '${mediationRequest.status}'.`);
                        err.status = 400;
                        throw err;
                    }

                    // --- التحديثات الأساسية داخل المعاملة ---
                    mediationRequest.status = 'Disputed';
                    mediationRequest.history.push({
                        event: `Dispute opened by ${disputingUserFullName} (${isSeller ? 'Seller' : 'Buyer'})`,
                        userId: disputingUserId,
                        timestamp: new Date(),
                        details: { reasonProvided: reason || "No specific reason provided initially." }
                    });

                    if (mediationRequest.product?._id) {
                        await Product.findByIdAndUpdate(mediationRequest.product._id,
                            { $set: { status: 'Disputed' } },
                            { session: currentSession } // استخدم currentSession
                        );
                        console.log(`   Product ${mediationRequest.product._id} status updated to 'Disputed' in transaction.`);
                    }

                    // احفظ النسخة المحدثة ليتم استخدامها خارج المعاملة
                    updatedMediationRequestGlobal = await mediationRequest.save({ session: currentSession });
                    console.log(`   MediationRequest ${mediationRequestId} status updated to 'Disputed' in transaction.`);
                });

                // إذا نجحت المعاملة، اخرج من حلقة إعادة المحاولة
                console.log(`   Transaction committed successfully for dispute opening on attempt ${attempt + 1}.`);
                break;

            } catch (error) {
                attempt++;
                if (error.errorLabels && error.errorLabels.includes('TransientTransactionError') && attempt < MAX_RETRIES) {
                    console.warn(`[openDisputeController] Write conflict, retrying transaction (attempt ${attempt}/${MAX_RETRIES})...`, error.message);
                    // انتظر قليلاً قبل إعادة المحاولة (اختياري ولكن جيد)
                    await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                } else {
                    // إذا لم يكن خطأ عابرًا أو تم تجاوز عدد المحاولات، أعد رمي الخطأ
                    throw error;
                }
            }
        }

        if (!updatedMediationRequestGlobal) {
            // هذا لا يجب أن يحدث إذا خرجنا من الحلقة بنجاح
            throw new Error("Failed to open dispute after retries or transaction did not complete as expected.");
        }

        // --- العمليات بعد نجاح المعاملة (الإشعارات، Socket.IO) ---
        // جلب الأدمنز (يمكن أن يتم خارج المعاملة)
        const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();

        const partiesToNotify = [];
        if (updatedMediationRequestGlobal.seller?._id && !updatedMediationRequestGlobal.seller._id.equals(disputingUserId)) partiesToNotify.push(updatedMediationRequestGlobal.seller._id);
        if (updatedMediationRequestGlobal.buyer?._id && !updatedMediationRequestGlobal.buyer._id.equals(disputingUserId)) partiesToNotify.push(updatedMediationRequestGlobal.buyer._id);
        if (updatedMediationRequestGlobal.mediator?._id) partiesToNotify.push(updatedMediationRequestGlobal.mediator._id);
        admins.forEach(admin => partiesToNotify.push(admin._id));

        const uniqueNotificationRecipients = [...new Set(partiesToNotify.map(id => id.toString()))];
        const productTitle = updatedMediationRequestGlobal.product?.title || 'the transaction';
        const notificationMessage = `A dispute has been opened by ${disputingUserFullName} for the transaction regarding "${productTitle}". Please review the details.`;

        // ***** [!!!] هذا هو التعديل الأهم هنا [!!!] *****
        const notifications = uniqueNotificationRecipients.map(userIdToNotify => ({
            user: userIdToNotify,
            type: 'MEDIATION_DISPUTED',
            title: 'notification_titles.MEDIATION_DISPUTED', // <-- استخدام مفتاح الترجمة
            message: 'notification_messages.MEDIATION_DISPUTED', // <-- استخدام مفتاح الترجمة
            messageParams: { // <-- إضافة المتغيرات
                userName: disputingUserFullName,
                productName: productTitle
            },
            relatedEntity: { id: updatedMediationRequestGlobal._id, modelName: 'MediationRequest' }
        }));
        // ***** نهاية التعديل *****

        if (notifications.length > 0) {
            try {
                await Notification.insertMany(notifications); // لا تحتاج session هنا
                console.log("   Dispute notifications created successfully after transaction commit.");
            } catch (notificationError) {
                console.error("   Error creating notifications after transaction commit (non-critical for dispute itself):", notificationError);
                // يمكنك تسجيل هذا الخطأ لكن لا توقف العملية بسببه
            }
        }

        // إرسال تحديثات عبر Socket.IO
        if (req.io && updatedMediationRequestGlobal) {
            const roomName = mediationRequestId.toString();
            // أعد جلب الطلب مع كل populate اللازم للـ socket إذا أردت أحدث البيانات
            const finalUpdatedRequestForSocket = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title imageUrls currency agreedPrice bidAmount bidCurrency status')
                .populate('seller', '_id fullName avatarUrl userRole')
                .populate('buyer', '_id fullName avatarUrl userRole')
                .populate('mediator', '_id fullName avatarUrl userRole')
                .lean();

            if (finalUpdatedRequestForSocket) {
                req.io.to(roomName).emit('mediation_details_updated', {
                    mediationRequestId: mediationRequestId,
                    updatedMediationDetails: finalUpdatedRequestForSocket
                });
                console.log(`   Socket event 'mediation_details_updated' emitted for room ${roomName} after dispute opened.`);

                if (finalUpdatedRequestForSocket.seller?._id && finalUpdatedRequestForSocket.product) {
                    const sellerSocketId = req.onlineUsers[finalUpdatedRequestForSocket.seller._id.toString()];
                    if (sellerSocketId) {
                        req.io.to(sellerSocketId).emit('product_list_updated_for_seller', {
                            productId: finalUpdatedRequestForSocket.product._id,
                            newStatus: finalUpdatedRequestForSocket.product.status
                        });
                    }
                }
            }
        }

        if (req.io && admins.length > 0) {
            admins.forEach(admin => {
                const adminSocketId = req.onlineUsers[admin._id.toString()];
                if (adminSocketId) {
                    // Send a specific event to admins to refresh their dispute list/count
                    req.io.to(adminSocketId).emit('dispute_opened_for_admin');
                    console.log(`   Socket event 'dispute_opened_for_admin' emitted to admin ${admin._id}`);
                }
            });
        }

        res.status(200).json({
            msg: "Dispute opened successfully. A mediator/admin will review.",
            mediationRequest: updatedMediationRequestGlobal.toObject() // استخدم المستند المحدث
        });

    } catch (error) {
        console.error("[openDisputeController] Final Error Catch Block:", error.message, "\nStack:", error.stack);
        // `error.status` تم تعيينه في حالات الخطأ المخصصة
        const statusCode = error.status || (error.code === 112 || (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) ? 503 : 500); // 503 للتعارض بعد عدة محاولات
        const message = error.message || "Server error opening dispute.";

        // إذا كان خطأ تعارض بعد كل المحاولات
        if (statusCode === 503 || (error.errorLabels && error.errorLabels.includes('TransientTransactionError'))) {
            return res.status(statusCode).json({
                msg: "Could not open dispute due to high server load or conflicting operations. Please try again shortly.",
                errorDetails: "Write conflict occurred." // لا تعرض تفاصيل الخطأ الكاملة للعميل
            });
        }

        res.status(statusCode).json({ msg: message });
    } finally {
        // تأكد من إنهاء الجلسة دائمًا
        if (session) {
            await session.endSession();
        }
    }
};

exports.getMediatorDisputedCasesController = async (req, res) => {
    const mediatorId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    console.log(`--- Controller: getMediatorDisputedCases for Mediator: ${mediatorId}, Page: ${page} ---`);
    try {
        const query = { mediator: mediatorId, status: 'Disputed' }; // <--- الفلتر هنا
        const options = {
            page, limit, sort: { updatedAt: -1 },
            populate: [
                { path: 'product', select: 'title imageUrls agreedPrice currency' },
                { path: 'seller', select: 'fullName avatarUrl' },
                { path: 'buyer', select: 'fullName avatarUrl' }
            ]
        };
        const result = await MediationRequest.paginate(query, options);
        res.status(200).json({
            assignments: result.docs, // أو اسم مناسب مثل 'disputedCases'
            totalPages: result.totalPages,
            currentPage: result.page,
            totalAssignments: result.totalDocs
        });
    } catch (error) {
        console.error("Error fetching mediator disputed cases:", error);
        res.status(500).json({ msg: "Server error fetching disputed cases." });
    }
};

exports.adminGetDisputedCasesController = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    console.log(`--- Controller: adminGetDisputedCases - Page: ${page}, Limit: ${limit} ---`);
    try {
        const query = { status: 'Disputed' }; // الفلتر: فقط الحالات المتنازع عليها
        const options = {
            page,
            limit,
            sort: { updatedAt: -1 }, // الأحدث أولاً
            populate: [ // نفس populate الذي تستخدمه في أماكن أخرى لعرض التفاصيل
                { path: 'product', select: 'title imageUrls user' }, // user هنا هو البائع
                { path: 'seller', select: '_id fullName avatarUrl' },
                { path: 'buyer', select: '_id fullName avatarUrl' },
                { path: 'mediator', select: '_id fullName avatarUrl' }
            ],
            lean: true
        };
        const result = await MediationRequest.paginate(query, options);
        res.status(200).json({
            requests: result.docs, // أو اسم مناسب مثل 'disputedCases'
            totalPages: result.totalPages,
            currentPage: result.page,
            totalRequests: result.totalDocs
        });
    } catch (error) {
        console.error("[AdminGetDisputedCasesController] Error:", error.message);
        res.status(500).json({ msg: "Server error fetching disputed cases.", errorDetails: error.message });
    }
};

exports.uploadChatImage = async (req, res) => {
    try {
        // تأكد أن الملف موجود
        if (!req.file) {
            return res.status(400).json({ msg: "No image file provided." });
        }

        const file = req.file;

        // تأكد من نوع الصورة
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.mimetype)) {
            // حذف الملف إذا كان غير مدعوم
            fs.unlinkSync(file.path);
            return res.status(400).json({ msg: "Unsupported image format." });
        }

        // إعادة تسميه الملف أو تركه كما هو
        const imageUrl = `/uploads/chat_images/${file.filename}`;

        return res.status(200).json({ msg: "Image uploaded successfully", imageUrl });
    } catch (error) {
        console.error("❌ Error in uploadChatImage:", error);
        return res.status(500).json({ msg: "Internal server error during image upload." });
    }
};

exports.adminResolveDisputeController = async (req, res) => {
    const { mediationRequestId } = req.params;
    const { winnerId, loserId, resolutionNotes, cancelMediation } = req.body;
    const adminUserId = req.user._id;
    const adminFullName = req.user.fullName || `Admin (${adminUserId.toString().slice(-4)})`;

    console.log(`--- Controller: adminResolveDispute for Mediation: ${mediationRequestId} by Admin: ${adminFullName} (ID: ${adminUserId}) ---`);
    console.log(`   Received Data: winnerId=${winnerId}, loserId=${loserId}, cancelMediation=${cancelMediation}, resolutionNotes="${resolutionNotes}"`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID." });
    }
    if (cancelMediation === undefined && (!winnerId || !loserId)) {
        return res.status(400).json({ msg: "Winner ID and Loser ID are required if not cancelling the mediation." });
    }
    if (cancelMediation !== true) {
        if (!mongoose.Types.ObjectId.isValid(winnerId) || !mongoose.Types.ObjectId.isValid(loserId)) {
            return res.status(400).json({ msg: "Invalid Winner ID or Loser ID format." });
        }
        if (winnerId.toString() === loserId.toString()) {
            return res.status(400).json({ msg: "Winner and Loser cannot be the same user." });
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[AdminResolveDispute] MongoDB session started for ${mediationRequestId}.`);

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('seller', '_id fullName email level reputationPoints reputationLevel claimedLevelRewards balance productsSoldCount sellerAvailableBalance sellerPendingBalance mediatorStatus')
            .populate('buyer', '_id fullName email level reputationPoints reputationLevel claimedLevelRewards balance mediatorStatus')
            .populate('mediator', '_id fullName email level reputationPoints reputationLevel claimedLevelRewards balance successfulMediationsCount mediatorStatus')
            .populate('product', 'title _id price currency status currentMediationRequest agreedPrice')
            .session(session);

        if (!mediationRequest) {
            throw new Error("Mediation request not found.");
        }
        if (mediationRequest.status !== 'Disputed') {
            throw new Error(`Cannot resolve. Mediation status is '${mediationRequest.status}', expected 'Disputed'.`);
        }

        const { seller, buyer, mediator, product } = mediationRequest;

        if (!seller || !buyer || !product) {
            throw new Error("Internal Server Error: Essential data (seller, buyer, product) missing for mediation.");
        }

        let finalStatus = 'AdminResolved';
        let historyEvent = `Dispute resolved by Admin ${adminFullName}.`;
        const usersToUpdateAndSave = new Map();
        const addUserToUpdateList = (userDoc) => { if (userDoc && userDoc._id) usersToUpdateAndSave.set(userDoc._id.toString(), userDoc); };

        addUserToUpdateList(seller);
        addUserToUpdateList(buyer);
        if (mediator) addUserToUpdateList(mediator);

        if (cancelMediation === true) {
            finalStatus = 'Cancelled';
            historyEvent = `Mediation cancelled by Admin ${adminFullName}.`;
            mediationRequest.resolutionDetails = resolutionNotes || "Mediation cancelled by administrator decision.";
            console.log(`   [AdminResolveDispute] Mediation ${mediationRequestId} is being cancelled by admin.`);

            if (mediationRequest.escrowedAmount > 0 && buyer && mediator) {
                const totalEscrowedInOriginalCurrency = mediationRequest.escrowedAmount;
                const escrowOriginalCurrency = mediationRequest.escrowedCurrency;
                let productPriceToRefundBuyerInOriginalCurrency = parseFloat(product.agreedPrice != null ? product.agreedPrice : product.price);

                if (product.currency !== escrowOriginalCurrency) {
                    console.warn(`   [AdminResolveDispute - Cancel] Product currency (${product.currency}) differs from escrow currency (${escrowOriginalCurrency}). Assuming conversion is needed.`);
                }
                productPriceToRefundBuyerInOriginalCurrency = parseFloat(productPriceToRefundBuyerInOriginalCurrency.toFixed(4));
                let mediatorFeeToPayNowInOriginalCurrency = totalEscrowedInOriginalCurrency - productPriceToRefundBuyerInOriginalCurrency;
                mediatorFeeToPayNowInOriginalCurrency = parseFloat(mediatorFeeToPayNowInOriginalCurrency.toFixed(4));

                if (mediatorFeeToPayNowInOriginalCurrency < 0) {
                    productPriceToRefundBuyerInOriginalCurrency = totalEscrowedInOriginalCurrency;
                    mediatorFeeToPayNowInOriginalCurrency = 0;
                }

                if (mediatorFeeToPayNowInOriginalCurrency > 0) {
                    let mediatorFeeInPlatformCurrency = mediatorFeeToPayNowInOriginalCurrency;
                    if (escrowOriginalCurrency !== PLATFORM_BASE_CURRENCY) {
                        if (escrowOriginalCurrency === 'USD') mediatorFeeInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                        else if (escrowOriginalCurrency === 'TND') mediatorFeeInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                    }
                    mediatorFeeInPlatformCurrency = parseFloat(mediatorFeeInPlatformCurrency.toFixed(2));
                    mediator.balance = parseFloat(((mediator.balance || 0) + mediatorFeeInPlatformCurrency).toFixed(2));
                    const mediatorFeeTx = new Transaction({ user: mediator._id, type: 'MEDIATION_FEE_RECEIVED', amount: mediatorFeeInPlatformCurrency, currency: PLATFORM_BASE_CURRENCY, status: 'COMPLETED', relatedMediationRequest: mediationRequestId, description: `Fee (admin cancel) for '${product.title}'` });
                    await mediatorFeeTx.save({ session });
                }

                if (productPriceToRefundBuyerInOriginalCurrency > 0) {
                    let productPriceInPlatformCurrency = productPriceToRefundBuyerInOriginalCurrency;
                    if (escrowOriginalCurrency !== PLATFORM_BASE_CURRENCY) {
                        if (escrowOriginalCurrency === 'USD') productPriceInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                        else if (escrowOriginalCurrency === 'TND') productPriceInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                    }
                    productPriceInPlatformCurrency = parseFloat(productPriceInPlatformCurrency.toFixed(2));
                    buyer.balance = parseFloat(((buyer.balance || 0) + productPriceInPlatformCurrency).toFixed(2));
                    const refundTransaction = new Transaction({ user: buyer._id, type: 'ESCROW_RETURNED_MEDIATION_CANCELLED', amount: productPriceInPlatformCurrency, currency: PLATFORM_BASE_CURRENCY, status: 'COMPLETED', description: `Product price refund (admin cancel) for '${product.title}'`, relatedMediationRequest: mediationRequestId });
                    await refundTransaction.save({ session });

                    if (mediatorFeeToPayNowInOriginalCurrency > 0) {
                        let mediatorFeeForBuyerTxInPlatformCurrency = mediatorFeeToPayNowInOriginalCurrency;
                        if (escrowOriginalCurrency !== PLATFORM_BASE_CURRENCY) {
                            if (escrowOriginalCurrency === 'USD') mediatorFeeForBuyerTxInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                            else if (escrowOriginalCurrency === 'TND') mediatorFeeForBuyerTxInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                        }
                        mediatorFeeForBuyerTxInPlatformCurrency = parseFloat(mediatorFeeForBuyerTxInPlatformCurrency.toFixed(2));

                        const buyerMediationFeeTx = new Transaction({
                            user: buyer._id,
                            type: 'MEDIATION_FEE_PAID_BY_BUYER',
                            amount: mediatorFeeForBuyerTxInPlatformCurrency,
                            currency: PLATFORM_BASE_CURRENCY,
                            status: 'COMPLETED',
                            description: `Mediator fee paid from escrow for cancelled mediation of '${product.title}'. Original fee: ${mediatorFeeToPayNowInOriginalCurrency.toFixed(2)} ${escrowOriginalCurrency}.`,
                            relatedMediationRequest: mediationRequestId,
                            metadata: {
                                reason: "Mediator fee deduction from escrow upon admin cancellation.",
                                originalFeeAmount: mediatorFeeToPayNowInOriginalCurrency,
                                originalFeeCurrency: escrowOriginalCurrency
                            }
                        });
                        await buyerMediationFeeTx.save({ session });
                    }
                }
                mediationRequest.escrowedAmount = 0;
                mediationRequest.escrowedCurrency = null;
            } else if (mediationRequest.escrowedAmount > 0 && buyer && !mediator) {
                let amountToReturnToBuyerInPlatformCurrency = mediationRequest.escrowedAmount;
                if (mediationRequest.escrowedCurrency !== PLATFORM_BASE_CURRENCY) {
                    if (mediationRequest.escrowedCurrency === 'USD') amountToReturnToBuyerInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                    else if (mediationRequest.escrowedCurrency === 'TND') amountToReturnToBuyerInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                }
                amountToReturnToBuyerInPlatformCurrency = parseFloat(amountToReturnToBuyerInPlatformCurrency.toFixed(2));
                buyer.balance = parseFloat(((buyer.balance || 0) + amountToReturnToBuyerInPlatformCurrency).toFixed(2));
                const refundTx = new Transaction({ user: buyer._id, type: 'ESCROW_RETURNED_MEDIATION_CANCELLED', amount: amountToReturnToBuyerInPlatformCurrency, currency: PLATFORM_BASE_CURRENCY, status: 'COMPLETED', description: `Full escrow refund (no mediator, admin cancel) for '${product.title}'`, relatedMediationRequest: mediationRequestId });
                await refundTx.save({ session });
                mediationRequest.escrowedAmount = 0; mediationRequest.escrowedCurrency = null;
            }
        } else {
            const winnerUserDoc = [seller, buyer].find(u => u._id.toString() === winnerId);
            const loserUserDoc = [seller, buyer].find(u => u._id.toString() === loserId);

            if (!winnerUserDoc || !loserUserDoc) throw new Error("Winner or Loser user not found in mediation participants.");
            if (mediator && (mediator._id.equals(winnerId) || mediator._id.equals(loserId))) throw new Error("Mediator cannot be designated as a winner or loser.");

            historyEvent += ` Ruled in favor of ${winnerUserDoc.fullName}.`;
            mediationRequest.resolutionDetails = resolutionNotes || `Resolved by admin in favor of ${winnerUserDoc.fullName}.`;

            const oldLevelWinner = winnerUserDoc.level;
            winnerUserDoc.reputationPoints = (winnerUserDoc.reputationPoints || 0) + 1;
            updateUserLevelAndBadge(winnerUserDoc);
            await processLevelUpRewards(winnerUserDoc, oldLevelWinner, session);

            loserUserDoc.reputationPoints = Math.max(0, (loserUserDoc.reputationPoints || 0) - 1);
            updateUserLevelAndBadge(loserUserDoc);

            if (mediationRequest.escrowedAmount > 0) {
                const totalEscrowed = parseFloat(mediationRequest.escrowedAmount);
                const escrowCurrency = mediationRequest.escrowedCurrency;

                if (buyer._id.equals(winnerUserDoc._id)) {
                    let refundAmountInPlatformCurrency = totalEscrowed;
                    if (escrowCurrency !== PLATFORM_BASE_CURRENCY) {
                        if (escrowCurrency === 'USD') refundAmountInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                        else if (escrowCurrency === 'TND') refundAmountInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                    }
                    buyer.balance += parseFloat(refundAmountInPlatformCurrency.toFixed(2));
                    const tx = new Transaction({ user: buyer._id, type: 'ESCROW_REFUND_DISPUTE_WON', amount: refundAmountInPlatformCurrency, currency: PLATFORM_BASE_CURRENCY, status: 'COMPLETED', description: `Escrow refund (won dispute) for '${product.title}'`, relatedMediationRequest: mediationRequestId });
                    await tx.save({ session });
                }
                else if (seller._id.equals(winnerUserDoc._id)) {
                    const mediatorFeeOriginal = parseFloat(mediationRequest.calculatedMediatorFee || 0);
                    const feeCurrency = mediationRequest.mediationFeeCurrency;
                    const netForSellerOriginal = totalEscrowed - mediatorFeeOriginal;

                    if (mediator && mediatorFeeOriginal > 0) {
                        let mediatorFeeInPlatformCurrency = mediatorFeeOriginal;
                        if (feeCurrency !== PLATFORM_BASE_CURRENCY) {
                            if (feeCurrency === 'USD') mediatorFeeInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                            else if (feeCurrency === 'TND') mediatorFeeInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                        }
                        mediator.balance += parseFloat(mediatorFeeInPlatformCurrency.toFixed(2));
                        mediator.successfulMediationsCount = (mediator.successfulMediationsCount || 0) + 1;

                        const feeTx = new Transaction({ user: mediator._id, type: 'MEDIATION_FEE_RECEIVED', amount: mediatorFeeOriginal, currency: feeCurrency, status: 'COMPLETED', description: `Fee from resolved dispute for '${product.title}'`, relatedMediationRequest: mediationRequestId });
                        await feeTx.save({ session });
                    }

                    let netForSellerInPlatformCurrency = netForSellerOriginal;
                    if (escrowCurrency !== PLATFORM_BASE_CURRENCY) {
                        if (escrowCurrency === 'USD') netForSellerInPlatformCurrency *= TND_USD_EXCHANGE_RATE;
                        else if (escrowCurrency === 'TND') netForSellerInPlatformCurrency /= TND_USD_EXCHANGE_RATE;
                    }
                    seller.sellerAvailableBalance += parseFloat(netForSellerInPlatformCurrency.toFixed(2));
                    seller.productsSoldCount = (seller.productsSoldCount || 0) + 1;

                    const payoutTx = new Transaction({ user: seller._id, type: 'DISPUTE_PAYOUT_SELLER_WON', amount: netForSellerOriginal, currency: escrowCurrency, status: 'COMPLETED', description: `Payout from resolved dispute for '${product.title}'`, relatedMediationRequest: mediationRequestId });
                    await payoutTx.save({ session });
                }
                mediationRequest.escrowedAmount = 0;
                mediationRequest.escrowedCurrency = null;
            }
        }

        mediationRequest.status = finalStatus;
        mediationRequest.history.push({ event: historyEvent, userId: adminUserId, timestamp: new Date(), details: { resolutionNotes: resolutionNotes || "N/A" } });

        if (product && product.status === 'Disputed') {
            let newProductStatus = 'approved';
            if (finalStatus === 'AdminResolved' && winnerId && seller._id.toString() === winnerId) {
                newProductStatus = 'sold';
            }
            await Product.findByIdAndUpdate(product._id, { $set: { status: newProductStatus, buyer: (newProductStatus === 'sold' ? buyer._id : null), soldAt: (newProductStatus === 'sold' ? new Date() : null), currentMediationRequest: null } }, { session });
        }

        if (mediator && (mediator.mediatorStatus === 'Busy' || mediator.mediatorStatus === 'Unavailable')) {
            mediator.mediatorStatus = 'Available';
        }

        for (const userDoc of usersToUpdateAndSave.values()) {
            if (userDoc.isModified()) {
                await userDoc.save({ session });
            }
        }
        await mediationRequest.save({ session });

        await session.commitTransaction();
        session.endSession();

        const involvedPartyIds = [seller._id, buyer._id];
        if (mediator?._id) involvedPartyIds.push(mediator._id);
        const uniquePartyIdsForNotification = [...new Set(involvedPartyIds.map(id => id.toString()))];
        const productTitleNotif = product?.title || 'the transaction';
        const notificationTitle = cancelMediation ? 'Mediation Cancelled by Admin' : 'Dispute Resolved by Admin';
        let notificationMessageBase = cancelMediation ?
            `The mediation regarding "${productTitleNotif}" has been cancelled by an administrator.` :
            `The dispute regarding "${productTitleNotif}" has been resolved by an administrator.`;

        if (resolutionNotes && resolutionNotes.trim() !== "") {
            notificationMessageBase += ` Admin notes: ${resolutionNotes.trim()}`;
        }

        const notificationsToSend = uniquePartyIdsForNotification.map(partyId => {
            let specificMessage = notificationMessageBase;
            if (!cancelMediation && winnerId && loserId) {
                if (partyId === winnerId.toString()) specificMessage += ` The decision was in your favor.`;
                else if (partyId === loserId.toString()) specificMessage += ` The decision was not in your favor.`;
            }
            return { user: partyId, type: 'DISPUTE_RESOLVED_ADMIN', title: notificationTitle, message: specificMessage, relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' } };
        });
        if (notificationsToSend.length > 0) { await Notification.insertMany(notificationsToSend); }

        if (req.io) {
            for (const userDoc of usersToUpdateAndSave.values()) {
                if (userDoc && req.onlineUsers && req.onlineUsers[userDoc._id.toString()]) {
                    const freshUserForSocket = await User.findById(userDoc._id).select('-password').lean();
                    if (freshUserForSocket) {
                        req.io.to(req.onlineUsers[userDoc._id.toString()]).emit('user_profile_updated', freshUserForSocket);
                    }
                }
            }
        }

        const responseMediationRequest = await MediationRequest.findById(mediationRequestId).populate('product seller buyer mediator').lean();
        res.status(200).json({ msg: `Dispute process completed: ${historyEvent}`, mediationRequest: responseMediationRequest });

    } catch (error) {
        if (session && session.inTransaction()) await session.abortTransaction();
        console.error(`[AdminResolveDisputeController] CRITICAL Error:`, error.message, "\nFull Stack:", error.stack);
        if (!res.headersSent) res.status(error.statusCode || error.status || 500).json({ msg: error.message || "Server error resolving dispute." });
    } finally {
        if (session && session.id) {
            try { await session.endSession(); } catch (e) { console.error("Session end error", e); }
        }
    }
};

// --- [!!!] دوال جديدة للشات الفرعي الخاص بالأدمن [!!!] ---
exports.adminCreateSubChatController = async (req, res) => {
    const { mediationRequestId } = req.params;
    // participantUserIds: مصفوفة من user IDs للمستخدمين الذين يريد الأدمن إضافتهم (باستثناء الأدمن نفسه)
    const { participantUserIds, title } = req.body;
    const adminUserId = req.user._id; // ID الأدمن الحالي
    const adminFullNameForMessage = req.user.fullName || `Admin (${adminUserId.toString().slice(-4)})`; // اسم الأدمن للرسائل

    console.log(`[Ctrl-CreateSubChat] Admin ${adminUserId} attempting to create/find sub-chat for Mediation ${mediationRequestId}`);
    console.log(`   Participants to add (excluding admin): ${participantUserIds}, Title: ${title}`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID." });
    }
    if (!Array.isArray(participantUserIds) || participantUserIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ msg: "Invalid participant user IDs format." });
    }
    if (participantUserIds.length === 0) {
        return res.status(400).json({ msg: "At least one participant (other than admin) must be selected to start a private chat." });
    }
    if (participantUserIds.includes(adminUserId.toString())) {
        return res.status(400).json({ msg: "Admin cannot select themselves as a participant to add." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title') // Populate product للرسالة في حالة الإنشاء
            .populate('seller', '_id fullName') // للحصول على معلومات الأطراف للتحقق
            .populate('buyer', '_id fullName')
            .populate('mediator', '_id fullName')
            // لا نحتاج لـ populate الشاتات الفرعية هنا بشكل كامل لأننا سنقوم بالبحث اليدوي
            // populate الأولي للشاتات الموجودة سيتم لاحقًا إذا تم العثور على شات موجود
            .session(session);

        if (!mediationRequest) {
            await session.abortTransaction();
            console.warn(`[Ctrl-CreateSubChat] Mediation request ${mediationRequestId} not found.`);
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (mediationRequest.status !== 'Disputed') {
            await session.abortTransaction();
            console.warn(`[Ctrl-CreateSubChat] Mediation ${mediationRequestId} not 'Disputed'. Status: ${mediationRequest.status}.`);
            return res.status(400).json({ msg: `Cannot create sub-chat. Mediation status is '${mediationRequest.status}', expected 'Disputed'.` });
        }

        const validPartyIdsInDispute = [
            mediationRequest.seller?._id?.toString(),
            mediationRequest.buyer?._id?.toString(),
            mediationRequest.mediator?._id?.toString()
        ].filter(id => id); // إزالة القيم الفارغة إذا كان طرف ما غير موجود

        for (const pId of participantUserIds) {
            if (!validPartyIdsInDispute.includes(pId.toString())) {
                await session.abortTransaction();
                console.warn(`[Ctrl-CreateSubChat] Participant ${pId} not valid for ${mediationRequestId}.`);
                return res.status(400).json({ msg: `User ID ${pId} is not a valid party in this mediation.` });
            }
        }

        const allIntendedParticipantIdsInNewChatSorted = [adminUserId.toString(), ...participantUserIds.map(id => id.toString())].sort();

        // البحث في adminSubChats الموجودة في mediationRequest
        // existingSubChatFromDoc هو subdocument غير مأهول بالكامل بعد
        const existingSubChatFromDoc = mediationRequest.adminSubChats.find(sc => {
            const currentSubChatParticipantIdsSorted = sc.participants.map(p => p.userId.toString()).sort();
            const participantsMatch = currentSubChatParticipantIdsSorted.length === allIntendedParticipantIdsInNewChatSorted.length &&
                currentSubChatParticipantIdsSorted.every((id, index) => id === allIntendedParticipantIdsInNewChatSorted[index]);
            if (participantsMatch) {
                // إذا تطابقت قائمة المشاركين تمامًا
                // الآن تحقق من العنوان (إذا تم توفير عنوان للبحث)
                const requestedTitle = title ? title.trim().toLowerCase() : null;
                const existingTitle = sc.title ? sc.title.trim().toLowerCase() : null;

                if (!requestedTitle) { // إذا لم يطلب الأدمن عنوانًا محددًا، أي شات بنفس المشاركين يعتبر مطابقًا
                    return true;
                }
                // إذا طلب الأدمن عنوانًا، فيجب أن يتطابق العنوان أيضًا
                return requestedTitle === existingTitle;
            }
            return false;
        });

        if (existingSubChatFromDoc) {
            console.log(`[Ctrl-CreateSubChat] Found existing sub-chat ID ${existingSubChatFromDoc.subChatId} for Mediation ${mediationRequestId}. Re-populating for response.`);
            // لا نحتاج لـ abortTransaction هنا إذا كنا فقط سنعيد الشات الموجود
            // لكن إذا كنا سنوقف العملية تمامًا ونعيد الشات الموجود، يمكن استخدام abort.
            // هنا، سنفترض أننا سنعيد الشات الموجود ولن ننشئ جديدًا، لذا لا حاجة لـ abort إلا إذا فشل populate.
            // الـ commit سيتم تجاهله لأننا سنعيد الاستجابة قبل الوصول إليه.

            // أعد جلب الطلب مع populate محدد للشات الموجود
            // لا يمكننا استخدام .session() هنا لأننا خرجنا من الـ transaction ضمنيًا بالـ return
            // إذا أردت البقاء في الـ transaction، يجب أن يكون هذا الـ findById داخل try/catch خاص به
            // أو لا تستخدم session هنا. للتبسيط الآن، سنقوم بالـ populate خارج الـ transaction.
            await session.commitTransaction(); // Commit التغييرات التي لم تحدث (لا يوجد تغييرات) أو abort إذا كنت تفضل
            session.endSession(); // أغلق الجلسة قبل الـ populate التالي

            const populatedMediationForExisting = await MediationRequest.findById(mediationRequestId)
                .populate({
                    path: 'adminSubChats',
                    match: { subChatId: existingSubChatFromDoc.subChatId },
                    populate: [
                        { path: 'participants.userId', select: 'fullName avatarUrl userRole' },
                        { path: 'createdBy', select: 'fullName avatarUrl userRole' },
                        { path: 'messages.sender', select: 'fullName avatarUrl userRole' } // Populate لآخر رسالة إذا لزم الأمر
                    ]
                })
                .select('adminSubChats.$')
                .lean();

            let finalExistingSubChatForResponse = null;
            if (populatedMediationForExisting && populatedMediationForExisting.adminSubChats && populatedMediationForExisting.adminSubChats.length > 0) {
                finalExistingSubChatForResponse = populatedMediationForExisting.adminSubChats[0];
            } else {
                console.error("[Ctrl-CreateSubChat] CRITICAL: Could not re-populate existing sub-chat after finding it. Falling back.");
                // كحل بديل، أرجع الشات بمعلومات أقل
                finalExistingSubChatForResponse = {
                    subChatId: existingSubChatFromDoc.subChatId,
                    title: existingSubChatFromDoc.title,
                    createdBy: existingSubChatFromDoc.createdBy, // سيكون ID فقط
                    participants: existingSubChatFromDoc.participants, // سيكونون IDs فقط
                    messages: [], // قد لا تحتاج لإرسال الرسائل هنا
                    createdAt: existingSubChatFromDoc.createdAt,
                    lastMessageAt: existingSubChatFromDoc.lastMessageAt
                };
            }

            return res.status(200).json({
                msg: "An existing private chat with these participants and title (if provided) was found.",
                subChat: finalExistingSubChatForResponse,
                existing: true // علامة للواجهة الأمامية
            });
        }

        // إذا لم يتم العثور على شات مطابق، قم بإنشاء واحد جديد
        const newSubChatId = new mongoose.Types.ObjectId();
        const participantsForNewSubChatObject = [{ userId: adminUserId }];
        participantUserIds.forEach(pId => {
            participantsForNewSubChatObject.push({ userId: new mongoose.Types.ObjectId(pId) });
        });

        const initialSystemMessage = {
            _id: new mongoose.Types.ObjectId(),
            sender: adminUserId,
            message: `Private chat started by Admin ${adminFullNameForMessage}.`,
            type: 'system',
            timestamp: new Date(),
            readBy: [{ readerId: adminUserId, readAt: new Date() }]
        };

        const newSubChatData = {
            subChatId: newSubChatId,
            createdBy: adminUserId,
            title: title ? title.trim() : `Discussion (${mediationRequest.adminSubChats.length + 1})`,
            participants: participantsForNewSubChatObject,
            messages: [initialSystemMessage],
            createdAt: new Date(),
            lastMessageAt: new Date()
        };

        mediationRequest.adminSubChats.push(newSubChatData);
        await mediationRequest.save({ session });
        await session.commitTransaction();
        // session.endSession() سيتم استدعاؤها في finally

        // Populate الشات الجديد *بعد* الحفظ والـ commit
        const newlyCreatedAndPopulated = await MediationRequest.findOne({ _id: mediationRequestId, "adminSubChats.subChatId": newSubChatId })
            .populate({
                path: 'adminSubChats',
                match: { subChatId: newSubChatId },
                populate: [
                    { path: 'participants.userId', select: 'fullName avatarUrl userRole' },
                    { path: 'createdBy', select: 'fullName avatarUrl userRole' },
                    { path: 'messages.sender', select: 'fullName avatarUrl userRole' }
                ]
            })
            .select('adminSubChats.$')
            .lean();

        let finalNewSubChatForResponse = null;
        if (newlyCreatedAndPopulated && newlyCreatedAndPopulated.adminSubChats && newlyCreatedAndPopulated.adminSubChats.length > 0) {
            finalNewSubChatForResponse = newlyCreatedAndPopulated.adminSubChats[0];
        } else {
            console.error("[Ctrl-CreateSubChat] CRITICAL: Could not populate newly created sub-chat. Sending unpopulated.");
            // البحث عن الشات الذي تم إضافته للتو في mediationRequest.adminSubChats
            const justAddedSubChat = mediationRequest.adminSubChats.find(sc => sc.subChatId.equals(newSubChatId));
            finalNewSubChatForResponse = justAddedSubChat ? justAddedSubChat.toObject() : null;
        }

        // إرسال إشعارات للمشاركين (باستثناء الأدمن الذي أنشأه)
        const productTitleForNotif = mediationRequest.product?.title || 'the ongoing dispute';
        const notificationPromises = [];
        participantsForNewSubChatObject.forEach(p => {
            if (p.userId && !p.userId.equals(adminUserId)) { // تأكد من أن p.userId ليس null
                notificationPromises.push(
                    Notification.create({
                        user: p.userId,
                        type: 'NEW_ADMIN_SUBCHAT_INVITATION',
                        title: 'New Private Chat with Admin',
                        message: `Admin ${adminFullNameForMessage} has started a private chat with you regarding "${productTitleForNotif}". Topic: ${finalNewSubChatForResponse?.title || 'Discussion'}`,
                        relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' },
                        metadata: { subChatId: newSubChatId.toString() }
                    })
                );
            }
        });
        if (notificationPromises.length > 0) {
            await Promise.all(notificationPromises).catch(err => console.error("Error sending subchat creation notifications (non-critical):", err));
        }

        if (req.io && finalNewSubChatForResponse) {
            finalNewSubChatForResponse.participants.forEach(p => {
                if (p.userId && p.userId._id) {
                    const targetSocketId = req.onlineUsers[p.userId._id.toString()];
                    if (targetSocketId) {
                        req.io.to(targetSocketId).emit('admin_sub_chat_created', {
                            mediationRequestId: mediationRequestId.toString(),
                            subChat: finalNewSubChatForResponse
                        });
                    }
                }
            });
            console.log(`[Ctrl-CreateSubChat] Emitted 'admin_sub_chat_created' for SubChat ${newSubChatId}`);
        }

        res.status(201).json({
            msg: "Admin sub-chat created successfully.",
            subChat: finalNewSubChatForResponse
        });

    } catch (error) {
        if (session.inTransaction()) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error("[Ctrl-CreateSubChat] Error aborting transaction:", abortError);
            }
        }
        console.error("[Ctrl-CreateSubChat] Error in main try-catch:", error.message, error.stack);
        res.status(error.status || 500).json({ msg: error.message || "Server error creating admin sub-chat.", errorDetails: error.message });
    } finally {
        if (session) {
            try {
                await session.endSession();
            } catch (endSessionError) {
                console.error("[Ctrl-CreateSubChat] Error ending session:", endSessionError);
            }
        }
    }
};

// (Admin) جلب جميع الشاتات الفرعية لنزاع معين
exports.adminGetAllSubChatsForDisputeController = async (req, res) => {
    const { mediationRequestId } = req.params;
    const adminUserId = req.user._id;

    console.log(`[Ctrl-GetAllSubChats] Admin ${adminUserId} fetching all sub-chats for Mediation ${mediationRequestId}`);

    try {
        // --- FIX STARTS HERE ---
        // We will fetch the document first and then populate it manually.
        // This gives more control over populating nested arrays.
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .select('adminSubChats status product buyer seller mediator')
            .lean();

        if (!mediationRequest) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        // Now, populate the necessary fields on the retrieved document
        await User.populate(mediationRequest, [
            { path: 'product', select: 'title' },
            { path: 'seller', select: 'fullName' },
            { path: 'buyer', select: 'fullName' },
            { path: 'mediator', select: 'fullName' },
        ]);

        if (mediationRequest.adminSubChats && mediationRequest.adminSubChats.length > 0) {
            await User.populate(mediationRequest.adminSubChats, [
                { path: 'createdBy', select: 'fullName avatarUrl' },
                { path: 'participants.userId', select: 'fullName avatarUrl' },
                { path: 'messages.sender', select: 'fullName avatarUrl' },
                // This is the most important part that often fails with direct population
                { path: 'messages.readBy.readerId', select: 'fullName avatarUrl' }
            ]);
        }
        // --- FIX ENDS HERE ---

        const sortedSubChats = (mediationRequest.adminSubChats || []).sort((a, b) => {
            return new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt);
        });

        const subChatsWithOtherPartyInfo = sortedSubChats.map(sc => {
            const lastMessage = sc.messages && sc.messages.length > 0 ? sc.messages[sc.messages.length - 1] : null;
            let unreadCount = 0;

            // Recalculate unread count here with fully populated data
            if (sc.messages && sc.messages.length > 0) {
                sc.messages.forEach(msg => {
                    // Check if message is from another user and not read by the current admin
                    if (msg.sender && msg.sender._id.toString() !== adminUserId.toString() &&
                        (!msg.readBy || !msg.readBy.some(rb => rb.readerId &&
                            rb.readerId._id.toString() === adminUserId.toString()))) {
                        unreadCount++;
                    }
                });
            }

            const createSnippet = (msg) => {
                if (!msg) return "No messages yet.";
                if (msg.type === 'system') return "Chat started.";
                if (msg.type === 'image') return "[Image]";
                if (msg.message) return msg.message.substring(0, 25) + (msg.message.length > 25 ? "..." : "");
                return "New message";
            };

            return {
                ...sc,
                lastMessageSnippet: createSnippet(lastMessage),
                unreadMessagesCount: unreadCount
            };
        });

        res.status(200).json({
            subChats: subChatsWithOtherPartyInfo,
            mediationStatus: mediationRequest.status,
            productTitle: mediationRequest.product?.title,
            parties: {
                seller: mediationRequest.seller,
                buyer: mediationRequest.buyer,
                mediator: mediationRequest.mediator
            }
        });

    } catch (error) {
        console.error("[Ctrl-GetAllSubChats] Error:", error);
        res.status(500).json({ msg: "Server error fetching admin sub-chats.", errorDetails: error.message });
    }
};

// (Admin/Participant) إرسال رسالة في شات فرعي محدد
exports.adminSendSubChatMessageController = async (req, res) => {
    const { mediationRequestId, subChatId } = req.params;
    const { messageText, imageUrl } = req.body; // imageUrl إذا تم رفع صورة عبر مسار آخر أولاً
    const senderId = req.user._id;
    const senderFullName = req.user.fullName; // من verifyAuth
    const senderAvatarUrl = req.user.avatarUrl; // من verifyAuth

    // req.adminSubChat و req.mediationRequest يجب أن يكونا متاحين من middleware `canAccessAdminSubChat`
    const subChat = req.adminSubChat;
    // const mediationRequest = req.mediationRequest; //  MediationRequest الرئيسي إذا لزم الأمر

    if ((!messageText || messageText.trim() === "") && !imageUrl) {
        return res.status(400).json({ msg: "Message content or image URL is required." });
    }

    try {
        const newMessageObjectId = new mongoose.Types.ObjectId();
        const newMessageData = {
            _id: newMessageObjectId,
            sender: senderId,
            message: (imageUrl && !messageText) ? null : messageText?.trim(), // إذا صورة فقط، النص null
            imageUrl: imageUrl || null,
            type: imageUrl ? 'image' : 'text',
            timestamp: new Date(),
            readBy: [{ readerId: senderId, readAt: new Date() }] // المرسل يقرأ رسالته تلقائيًا
        };

        if (newMessageData.type === 'text' && (!newMessageData.message || newMessageData.message.trim() === "")) {
            return res.status(400).json({ msg: "Cannot send empty text message." });
        }


        // تحديث الرسالة في الشات الفرعي وتاريخ آخر رسالة
        const updateResult = await MediationRequest.updateOne(
            { _id: mediationRequestId, "adminSubChats.subChatId": subChatId },
            {
                $push: { "adminSubChats.$.messages": newMessageData },
                $set: { "adminSubChats.$.lastMessageAt": newMessageData.timestamp }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ msg: "Mediation request or sub-chat not found." });
        }
        if (updateResult.modifiedCount === 0) {
            // هذا قد يحدث إذا كان هناك خطأ في $addToSet أو شرط آخر
            console.warn(`[Ctrl-SendSubChatMessage] Message might not have been pushed. SubChatID: ${subChatId}`);
            // يمكنك محاولة إعادة جلب الطلب للتحقق
        }

        // إرسال إشعار + Socket.IO event
        const populatedMessageForEmit = {
            ...newMessageData,
            sender: { _id: senderId, fullName: senderFullName, avatarUrl: senderAvatarUrl }
        };

        const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
        if (req.io) {
            req.io.to(subChatRoomName).emit('new_admin_sub_chat_message', {
                mediationRequestId: mediationRequestId.toString(),
                subChatId: subChatId.toString(),
                message: populatedMessageForEmit
            });
            console.log(`[Ctrl-SendSubChatMessage] Emitted 'new_admin_sub_chat_message' to room ${subChatRoomName}`);
        }

        // إرسال إشعارات للمشاركين الآخرين في الشات الفرعي
        const currentMediationRequest = await MediationRequest.findById(mediationRequestId)
            .select('adminSubChats product')
            .populate('adminSubChats.participants.userId', '_id')
            .populate('product', 'title')
            .lean();

        const targetSubChat = currentMediationRequest.adminSubChats.find(sc => sc.subChatId.equals(subChatId));

        if (targetSubChat && targetSubChat.participants) {
            const productTitle = currentMediationRequest.product?.title || 'the dispute';
            const notificationPromises = targetSubChat.participants
                .filter(p => p.userId && !p.userId._id.equals(senderId)) // استبعاد المرسل
                .map(p => {
                    // تحقق مما إذا كان المستخدم متصلاً بنفس غرفة الشات الفرعي هذه
                    let isUserInSubChatRoom = false;
                    const targetSocketId = req.onlineUsers[p.userId._id.toString()];
                    if (targetSocketId && req.io.sockets.sockets.get(targetSocketId)?.rooms.has(subChatRoomName)) {
                        isUserInSubChatRoom = true;
                    }

                    if (!isUserInSubChatRoom) { // أرسل إشعارًا فقط إذا لم يكن المستخدم في الغرفة
                        return Notification.create({
                            user: p.userId._id,
                            type: 'NEW_ADMIN_SUBCHAT_MESSAGE',
                            title: `New Message in Private Chat (${targetSubChat.title || 'Admin Chat'})`,
                            message: `${senderFullName} sent a new message regarding "${productTitle}".`,
                            relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' },
                            metadata: { subChatId: subChatId.toString(), messageId: newMessageObjectId.toString() }
                        });
                    }
                    return null;
                }).filter(Boolean); // إزالة القيم null
            if (notificationPromises.length > 0) {
                await Promise.all(notificationPromises);
                console.log(`[Ctrl-SendSubChatMessage] Sent ${notificationPromises.length} notifications for new sub-chat message.`);
            }
        }

        res.status(201).json({
            msg: "Message sent to admin sub-chat.",
            message: populatedMessageForEmit
        });

    } catch (error) {
        console.error("[Ctrl-SendSubChatMessage] Error:", error);
        res.status(500).json({ msg: "Server error sending message to admin sub-chat.", errorDetails: error.message });
    }
};

// (Admin/Participant) جلب رسائل شات فرعي محدد
exports.adminGetSubChatMessagesController = async (req, res) => {
    const { mediationRequestId, subChatId } = req.params; // من الـ URL
    const currentUserId = req.user._id;

    // req.adminSubChat يجب أن يكون متاحًا من middleware `canAccessAdminSubChat`
    const subChat = req.adminSubChat;

    if (!subChat) { // هذا لا يجب أن يحدث إذا كان الـ middleware يعمل بشكل صحيح
        return res.status(404).json({ msg: "Sub-chat not found in request context." });
    }

    try {
        // جلب طلب الوساطة الأصلي مع populate للـ subChat المحدد ورسائله ومرسليها وقارئيها
        const mediationRequestWithPopulatedSubChat = await MediationRequest.findOne(
            { _id: mediationRequestId, "adminSubChats.subChatId": subChatId }
        )
            .populate({
                path: 'adminSubChats',
                match: { subChatId: subChatId }, // مطابقة الشات الفرعي المحدد
                populate: [
                    { path: 'messages.sender', select: 'fullName avatarUrl userRole' },
                    { path: 'messages.readBy.readerId', select: 'fullName avatarUrl' },
                    { path: 'participants.userId', select: 'fullName avatarUrl userRole' }, // لجلب معلومات المشاركين
                    { path: 'createdBy', select: 'fullName avatarUrl userRole' } // لجلب معلومات منشئ الشات
                ]
            })
            .select('adminSubChats.$') // جلب الشات الفرعي المطابق فقط
            .lean();

        if (!mediationRequestWithPopulatedSubChat || !mediationRequestWithPopulatedSubChat.adminSubChats || mediationRequestWithPopulatedSubChat.adminSubChats.length === 0) {
            return res.status(404).json({ msg: "Sub-chat messages not found or access denied." });
        }

        const populatedSubChat = mediationRequestWithPopulatedSubChat.adminSubChats[0];

        // (اختياري) تحديث readBy للرسائل التي لم يقرأها المستخدم الحالي بعد
        // هذا يمكن أن يتم هنا أو عبر Socket.IO عند فتح الشات
        const now = new Date();
        let messagesMarkedAsRead = 0;
        const messageIdsToUpdateReadStatus = [];

        populatedSubChat.messages.forEach(message => {
            // إذا كانت الرسالة ليست من المستخدم الحالي ولم يقرأها بعد
            if (message.sender && !message.sender._id.equals(currentUserId) &&
                (!message.readBy || !message.readBy.some(rb => rb.readerId && rb.readerId._id.equals(currentUserId)))) {
                messageIdsToUpdateReadStatus.push(message._id);
            }
        });

        if (messageIdsToUpdateReadStatus.length > 0) {
            const updateReadResult = await MediationRequest.updateOne(
                { _id: mediationRequestId, "adminSubChats.subChatId": subChatId },
                {
                    $addToSet: {
                        "adminSubChats.$[outer].messages.$[inner].readBy": {
                            readerId: currentUserId,
                            readAt: now
                        }
                    }
                },
                {
                    arrayFilters: [
                        { "outer.subChatId": subChatId },
                        { "inner._id": { $in: messageIdsToUpdateReadStatus }, "inner.readBy.readerId": { $ne: currentUserId } }
                    ]
                }
            );
            if (updateReadResult.modifiedCount > 0) {
                messagesMarkedAsRead = messageIdsToUpdateReadStatus.length;
                console.log(`[Ctrl-GetSubChatMessages] Marked ${updateReadResult.modifiedCount} messages as read by ${currentUserId} in SubChat ${subChatId}`);

                if (req.io) {
                    const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;

                    // --- [!!!] بداية الحل [!!!] ---

                    // 1. قم بإنشاء كائن readerInfo الكامل الذي يتوقعه الـ Reducer
                    const readerInfoPayload = {
                        readerId: currentUserId,
                        readAt: now,
                        fullName: req.user.fullName,
                        avatarUrl: req.user.avatarUrl
                    };

                    // 2. قم بإنشاء الـ payload النهائي الذي يتطابق مع ما يتوقعه الـ Reducer
                    const finalPayloadForSocket = {
                        mediationRequestId: mediationRequestId.toString(),
                        subChatId: subChatId.toString(),
                        readerInfo: readerInfoPayload, // <--- أرسل كائن readerInfo
                        messageIds: messageIdsToUpdateReadStatus, // <--- أرسل مصفوفة الـ IDs
                    };

                    // 3. أرسل الـ payload النهائي والصحيح
                    req.io.to(subChatRoomName).emit('admin_sub_chat_messages_status_updated', finalPayloadForSocket);

                    console.log(`[Ctrl-GetSubChatMessages] Emitted 'status_updated' with correct payload to room ${subChatRoomName}`);

                    // --- [!!!] نهاية الحل [!!!] ---
                }
            }
        }

        // إعادة جلب الرسائل بعد تحديث حالة القراءة (إذا كنت تريد أحدث بيانات readBy فورًا في الاستجابة)
        // أو يمكنك تحديث الكائن populatedSubChat يدويًا في الذاكرة
        // للتبسيط الآن، سنفترض أن العميل سيتعامل مع التحديث عبر Socket.IO أو سيعيد الجلب إذا لزم الأمر

        res.status(200).json({
            subChatId: populatedSubChat.subChatId,
            title: populatedSubChat.title,
            createdBy: populatedSubChat.createdBy,
            participants: populatedSubChat.participants,
            messages: populatedSubChat.messages,
            messagesMarkedAsReadCount: messagesMarkedAsRead // عدد الرسائل التي تم تحديثها للتو
        });

    } catch (error) {
        console.error("[Ctrl-GetSubChatMessages] Error:", error);
        res.status(500).json({ msg: "Server error fetching admin sub-chat messages.", errorDetails: error.message });
    }
};

// (Admin/Participant) وضع علامة على الرسائل كمقروءة في شات فرعي
exports.adminMarkSubChatMessagesReadController = async (req, res) => {
    const { mediationRequestId, subChatId } = req.params;
    const { messageIds } = req.body; // مصفوفة من IDs للرسائل
    const readerUserId = req.user._id;
    const readerFullName = req.user.fullName;
    const readerAvatarUrl = req.user.avatarUrl;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({ msg: "Message IDs array is required." });
    }
    if (messageIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ msg: "Invalid message ID format found in array." });
    }

    // req.adminSubChat متاح من middleware
    const subChat = req.adminSubChat;
    if (!subChat) return res.status(404).json({ msg: "Sub-chat context not found." });

    try {
        const objectMessageIds = messageIds.map(id => new mongoose.Types.ObjectId(id));
        const now = new Date();

        const updateResult = await MediationRequest.updateOne(
            { _id: mediationRequestId, "adminSubChats.subChatId": subChatId },
            {
                $addToSet: {
                    "adminSubChats.$[outer].messages.$[inner].readBy": {
                        readerId: readerUserId,
                        readAt: now
                    }
                }
            },
            {
                arrayFilters: [
                    { "outer.subChatId": subChatId },
                    { "inner._id": { $in: objectMessageIds }, "inner.readBy.readerId": { $ne: readerUserId } }
                ]
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ msg: "Mediation request or sub-chat not found for marking messages." });
        }

        console.log(`[Ctrl-MarkSubRead] User ${readerUserId} marked messages in SubChat ${subChatId}. Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`);

        if (updateResult.modifiedCount > 0) {
            // إرسال تحديث عبر Socket.IO
            if (req.io) {
                const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
                const updatedMessageInfos = objectMessageIds.map(msgId => ({
                    _id: msgId,
                    readBy: [{ readerId: readerUserId, readAt: now, fullName: readerFullName, avatarUrl: readerAvatarUrl }]
                }));
                req.io.to(subChatRoomName).emit('admin_sub_chat_messages_status_updated', {
                    mediationRequestId: mediationRequestId.toString(),
                    subChatId: subChatId.toString(),
                    updatedMessages: updatedMessageInfos // أرسل فقط IDs الرسائل التي تم تحديثها ومعلومات القارئ الجديد
                });
                console.log(`[Ctrl-MarkSubRead] Emitted 'admin_sub_chat_messages_status_updated' to ${subChatRoomName}`);
            }
        }

        res.status(200).json({
            msg: "Messages marked as read successfully.",
            modifiedCount: updateResult.modifiedCount
        });

    } catch (error) {
        console.error("[Ctrl-MarkSubRead] Error:", error);
        res.status(500).json({ msg: "Server error marking messages as read.", errorDetails: error.message });
    }
};