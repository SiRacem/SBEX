// server/controllers/mediation.controller.js
const MediationRequest = require('../models/MediationRequest');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); // <<<<========= ADD THIS LINE
const { calculateMediatorFeeDetails } = require('../utils/feeCalculator');

// --- Helper: Currency Formatting ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") safeCurrencyCode = "TND";
    try {
        return num.toLocaleString("fr-TN", { style: "currency", currency: safeCurrencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) { return `${num.toFixed(2)} ${safeCurrencyCode}`; }
};


const TND_USD_EXCHANGE_RATE = 3.0;
const platformBaseCurrency = 'TND';

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
            await session.abortTransaction(); // Abort if not in correct state before making changes
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
        const userId = req.user._id; // ID المستخدم الحالي (الأدمن في هذه الحالة)
        const userRole = req.user.userRole; // دور المستخدم الحالي

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
            .populate('chatMessages.sender', 'fullName avatarUrl _id');

        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        const isSeller = request.seller && request.seller._id.equals(userId);
        const isBuyer = request.buyer && request.buyer._id.equals(userId);
        const isMediator = request.mediator && request.mediator._id.equals(userId);
        const isAdmin = userRole === 'Admin'; // استخدم userRole من req.user

        // التحقق إذا كان المستخدم الحالي مشرفًا محددًا على هذا النزاع
        const isDesignatedOverseer = request.disputeOverseers &&
            request.disputeOverseers.some(overseer => overseer._id.equals(userId));

        let canAccess = isSeller || isBuyer || isMediator || isDesignatedOverseer;

        // إذا كان المستخدم أدمن والحالة نزاع، اسمح له بالوصول حتى لو لم يكن مشرفًا معينًا
        // هذا يعتمد على سياستك: هل كل الأدمنز يمكنهم رؤية كل النزاعات، أم فقط المشرفون المعينون؟
        // إذا كان كل الأدمنز، فاستخدم:
        if (isAdmin && request.status === 'Disputed') {
            canAccess = true;
        }
        // إذا كان فقط المشرفون المعينون (بالإضافة للأطراف الأخرى):
        // canAccess = isSeller || isBuyer || isMediator || (isDesignatedOverseer && request.status === 'Disputed');
        // أو إذا كنت تريد أن يتمكن أي أدمن من الوصول إذا كانت الحالة نزاع، بالإضافة إلى المشرفين المعينين:
        // canAccess = isSeller || isBuyer || isMediator || isDesignatedOverseer || (isAdmin && request.status === 'Disputed');


        if (!canAccess) {
            console.warn(`[getMediationDetails] User ${userId} (Role: ${userRole}) is FORBIDDEN from accessing details for ${mediationRequestId}. Status: ${request.status}. Parties: S-${request.seller?._id}, B-${request.buyer?._id}, M-${request.mediator?._id}`);
            return res.status(403).json({ msg: "Forbidden: You are not authorized to view these mediation details." });
        }

        console.log(`[getMediationDetails] User ${userId} (Role: ${userRole}) GRANTED access to details for ${mediationRequestId}.`);
        res.status(200).json({ mediationRequest: request });

    } catch (error) {
        console.error("[getMediationDetails] Error fetching mediation request details:", error.message, error.stack);
        res.status(500).json({ msg: "Server error fetching mediation details.", errorDetails: error.message });
    }
};

// --- Admin: Get Pending Assignment Requests ---
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

// --- Admin: Assign Mediator ---
exports.adminAssignMediator = async (req, res) => {
    // ... (الكود الكامل لهذه الدالة كما قدمته سابقاً، بدون تغييرات هنا) ...
    // (سأفترض أنه لا يحتاج لتعديلات بناءً على طلبك الأخير)
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
    // ... (الكود الكامل لهذه الدالة كما قدمته سابقاً، مع تعديل حساب التقييم ليشمل 0.0) ...
    const { mediationRequestId } = req.params;
    const requestingUserId = req.user._id;
    const { refresh, exclude } = req.query;
    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId).select('seller buyer previouslySuggestedMediators suggestionRefreshCount status').lean();
        if (!mediationRequest) return res.status(404).json({ msg: "Mediation request not found." });
        if (!mediationRequest.seller.equals(requestingUserId)) return res.status(403).json({ msg: "Forbidden: You are not the seller." });
        if (mediationRequest.status !== 'PendingMediatorSelection') return res.status(400).json({ msg: `Cannot select mediator. Status: ${mediationRequest.status}.` });

        let exclusionIds = [mediationRequest.seller, mediationRequest.buyer];
        if (refresh === 'true' && mediationRequest.previouslySuggestedMediators?.length) {
            exclusionIds = [...exclusionIds, ...mediationRequest.previouslySuggestedMediators];
        }
        if (exclude) {
            const excludeArray = exclude.split(',').filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
            exclusionIds = [...new Set([...exclusionIds, ...excludeArray])];
        }
        const finalExclusionObjectIds = exclusionIds.filter(id => id).map(id => new mongoose.Types.ObjectId(id.toString()));

        const query = { isMediatorQualified: true, mediatorStatus: 'Available', blocked: false, _id: { $nin: finalExclusionObjectIds } };
        const allAvailableMediators = await User.find(query).select('fullName avatarUrl mediatorStatus successfulMediationsCount reputationPoints level positiveRatings negativeRatings').lean();

        if (allAvailableMediators.length === 0) {
            const message = refresh === 'true' ? "No new distinct mediators found." : "No available mediators found.";
            return res.status(200).json({ mediators: [], message, refreshCountRemaining: Math.max(0, 1 - (mediationRequest.suggestionRefreshCount + (refresh === 'true' ? 1 : 0))) });
        }

        const shuffledMediators = [...allAvailableMediators].sort(() => 0.5 - Math.random());
        const selectedMediatorsRaw = shuffledMediators.slice(0, 3);
        const selectedMediatorsWithRating = selectedMediatorsRaw.map(mediator => {
            const totalRatings = (mediator.positiveRatings || 0) + (mediator.negativeRatings || 0);
            let calculatedRatingValue = 0.0; // Default to 0.0
            if (totalRatings > 0) {
                calculatedRatingValue = parseFloat((((mediator.positiveRatings || 0) / totalRatings) * 5).toFixed(1));
            }
            return { ...mediator, calculatedRating: calculatedRatingValue };
        });

        if (refresh !== 'true' && selectedMediatorsWithRating.length > 0) {
            await MediationRequest.findByIdAndUpdate(mediationRequestId, { $addToSet: { previouslySuggestedMediators: { $each: selectedMediatorsWithRating.map(m => m._id) } } });
        }
        let currentRefreshCount = mediationRequest.suggestionRefreshCount || 0;
        if (refresh === 'true' && currentRefreshCount < 1) {
            await MediationRequest.findByIdAndUpdate(mediationRequestId, { $inc: { suggestionRefreshCount: 1 } });
            currentRefreshCount++;
        }
        res.status(200).json({ mediators: selectedMediatorsWithRating, suggestionsRefreshed: refresh === 'true', refreshCountRemaining: Math.max(0, 1 - currentRefreshCount) });
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
            .populate('product', 'title _id') // جلب _id للمنتج
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

        if (mediationRequest.product && mediationRequest.product._id) { // التأكد من وجود _id
            await Product.findByIdAndUpdate(mediationRequest.product._id,
                { $set: { status: 'MediatorAssigned' } },
                { session: session } // لا نحتاج new: true هنا بالضرورة
            );
            console.log(`   Product ${mediationRequest.product._id} status updated to 'MediatorAssigned' in DB.`);
        }

        const productTitleForNotification = mediationRequest.product?.title || 'the specified product';
        const sellerFullNameForNotification = req.user.fullName || 'The Seller';
        const buyerFullNameForNotification = mediationRequest.buyer?.fullName || 'The Buyer';

        const sellerConfirmationMsg = `You have successfully selected ${mediatorUser.fullName} as the mediator for "${productTitleForNotification}". They have been notified and you will be updated on their decision.`;
        const mediatorNotificationMsg = `You have been selected as a mediator by ${sellerFullNameForNotification} for a transaction regarding "${productTitleForNotification}" with ${buyerFullNameForNotification}. Please review and accept or reject this assignment.`;
        const buyerNotificationMsg = `${sellerFullNameForNotification} has selected ${mediatorUser.fullName} as the mediator for your transaction regarding "${productTitleForNotification}". Please wait for the mediator to accept the assignment.`;

        // --- التعديل هنا ---
        await Notification.create([
            { user: sellerId, type: 'MEDIATOR_SELECTION_CONFIRMED', title: 'Mediator Selection Confirmed', message: sellerConfirmationMsg, relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' } },
            { user: selectedMediatorId, type: 'MEDIATION_ASSIGNED', title: 'New Mediation Assignment', message: mediatorNotificationMsg, relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' } },
            { user: mediationRequest.buyer._id, type: 'MEDIATOR_SELECTED_BY_SELLER', title: 'Mediator Selected for Your Transaction', message: buyerNotificationMsg, relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' } }
        ], { session, ordered: true }); // <--- أضف ordered: true
        // --- نهاية التعديل ---
        console.log(`   Notifications sent for mediator assignment on request ${updatedMediationRequestDoc._id}.`);

        await session.commitTransaction();
        console.log("   sellerAssignSelectedMediator transaction committed successfully.");

        const finalResponseRequest = await MediationRequest.findById(updatedMediationRequestDoc._id)
            .populate('product', 'title status currentMediationRequest agreedPrice imageUrls currency')
            .populate('seller', 'fullName avatarUrl')
            .populate('buyer', 'fullName avatarUrl')
            .populate('mediator', 'fullName avatarUrl')
            .lean();

        res.status(200).json({
            msg: `Mediator ${mediatorUser.fullName} has been assigned. They will be notified.`,
            mediationRequest: finalResponseRequest
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl sellerAssignSelectedMediator] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: sellerAssignSelectedMediator ERROR ---", error);
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Cannot assign mediator") || error.message.includes("not valid") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || 'Failed to assign mediator.' });
    } finally {
        if (session && session.endSession) { // تأكد من أن session موجود قبل استدعاء endSession
            await session.endSession();
        }
        console.log("--- Controller: sellerAssignSelectedMediator END --- Session ended.");
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
    // req.mediationRequest يفترض أنه يتم توفيره بواسطة middleware مثل isAssignedMediator
    // إذا لم يكن كذلك، ستحتاج لجلب mediationRequestId من req.params
    const mediationRequestIdToAccept = req.mediationRequest?._id || req.params.mediationRequestId;
    const mediatorId = req.user._id; // الوسيط الذي يقوم بالقبول

    console.log(`--- Controller: mediatorAcceptAssignment ---`);
    console.log(`   MediationRequestID: ${mediationRequestIdToAccept}, Accepting MediatorID: ${mediatorId}`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestIdToAccept)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID provided." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for mediatorAcceptAssignment.");

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestIdToAccept).session(session);
        if (!mediationRequest) {
            throw new Error("Mediation request not found or disappeared during transaction.");
        }

        // التحقق من أن المستخدم الحالي هو الوسيط المعين لهذا الطلب
        if (!mediationRequest.mediator || !mediationRequest.mediator.equals(mediatorId)) {
            throw new Error("Forbidden: You are not the assigned mediator for this request.");
        }
        // التحقق من أن حالة الطلب تسمح بالقبول
        if (mediationRequest.status !== 'MediatorAssigned') {
            throw new Error(`Cannot accept assignment. Request status is '${mediationRequest.status}', expected 'MediatorAssigned'.`);
        }

        // تحديث حالة طلب الوساطة
        mediationRequest.status = 'MediationOfferAccepted'; // الوسيط قبل، ننتظر تأكيد الأطراف
        if (!Array.isArray(mediationRequest.history)) {
            mediationRequest.history = [];
        }
        mediationRequest.history.push({
            event: "Mediator accepted assignment",
            userId: mediatorId,
            timestamp: new Date()
        });
        await mediationRequest.save({ session });
        console.log(`   MediationRequest ${mediationRequest._id} status updated to '${mediationRequest.status}'.`);

        // جلب البيانات المعبأة للإشعارات
        const populatedRequest = await MediationRequest.findById(mediationRequest._id)
            .populate('product', 'title')
            .populate('seller', '_id fullName') // نحتاج _id و fullName
            .populate('buyer', '_id fullName')  // نحتاج _id و fullName
            .populate('mediator', '_id fullName')// نحتاج _id و fullName
            .lean() // استخدام lean هنا آمن لأننا لا نعدل الكائن بعد الآن
            .session(session);

        if (!populatedRequest) {
            // هذا لا يجب أن يحدث
            throw new Error("Failed to repopulate mediation request for notifications after update.");
        }

        const productTitle = populatedRequest.product?.title || 'the product';
        const mediatorFullName = populatedRequest.mediator?.fullName || 'The Mediator';
        const sellerFullName = populatedRequest.seller?.fullName || 'The Seller'; // اسم البائع للإشعار
        const buyerFullName = populatedRequest.buyer?.fullName || 'The Buyer';   // اسم المشتري للإشعار


        // إنشاء وإرسال الإشعارات
        console.log("   Preparing notifications for mediator acceptance...");
        const mediatorConfirmationMsg = `You have successfully accepted the mediation assignment for "${productTitle}". You will be notified when both parties are ready.`;
        const sellerMessage = `${mediatorFullName} has accepted the assignment to mediate your transaction for "${productTitle}" (with buyer: ${buyerFullName}). Please proceed to confirm your readiness for mediation.`;
        const buyerMessage = `${mediatorFullName} has accepted the assignment to mediate your transaction for "${productTitle}" (with seller: ${sellerFullName}). Please proceed to confirm your readiness for mediation.`;

        // --- التعديل هنا ---
        await Notification.create([
            { // إشعار للوسيط (تأكيد)
                user: mediatorId,
                type: 'MEDIATION_TASK_ACCEPTED_SELF',
                title: 'Assignment Accepted',
                message: mediatorConfirmationMsg,
                relatedEntity: { id: populatedRequest._id, modelName: 'MediationRequest' }
            },
            { // إشعار للبائع
                user: populatedRequest.seller._id,
                type: 'MEDIATION_ACCEPTED_BY_MEDIATOR',
                title: 'Mediator Accepted - Confirm Readiness',
                message: sellerMessage,
                relatedEntity: { id: populatedRequest._id, modelName: 'MediationRequest' }
            },
            { // إشعار للمشتري
                user: populatedRequest.buyer._id,
                type: 'MEDIATION_ACCEPTED_BY_MEDIATOR',
                title: 'Mediator Accepted - Confirm Readiness',
                message: buyerMessage,
                relatedEntity: { id: populatedRequest._id, modelName: 'MediationRequest' }
            }
        ], { session, ordered: true }); // <--- أضف ordered: true
        // --- نهاية التعديل ---
        console.log(`   Notifications sent for mediator acceptance on request ${populatedRequest._id}.`);

        await session.commitTransaction();
        console.log("   mediatorAcceptAssignment transaction committed.");

        res.status(200).json({
            msg: "Mediation assignment accepted successfully. Parties will be notified to confirm readiness.",
            mediationRequest: populatedRequest // إرجاع الطلب المحدث مع البيانات المعبأة
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl mediatorAcceptAssignment] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: mediatorAcceptAssignment ERROR ---", error);
        // تحديد رمز الحالة المناسب
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Cannot accept assignment") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || "Failed to accept mediation assignment." });
    } finally {
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: mediatorAcceptAssignment END ---");
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
            sort: { updatedAt: -1 }, // ترتيب حسب آخر تحديث (الأحدث أولاً)
            populate: [
                { path: 'product', select: 'title imageUrls agreedPrice currency user' }, // user هنا هو بائع المنتج
                { path: 'seller', select: '_id fullName avatarUrl' },
                { path: 'mediator', select: '_id fullName avatarUrl' },
                // يمكنك إضافة populate لسجل الأحداث إذا أردت عرضه في القائمة
                // { path: 'history.userId', select: 'fullName' } 
            ],
            lean: true // للأداء الأفضل عند القراءة فقط
        };

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

// --- Buyer: Confirm Readiness and Escrow (MODIFIED with PartiesConfirmed) ---
exports.buyerConfirmReadinessAndEscrow = async (req, res) => {
    const { mediationRequestId } = req.params;
    const buyerId = req.user._id;
    console.log(`--- [SERVER] buyerConfirmReadinessAndEscrow START - MediationID: ${mediationRequestId}, BuyerID: ${buyerId} ---`);

    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title currency _id') // أضفت currency
            .populate('seller', '_id fullName balance sellerPendingBalance') // للتأكد من وجود sellerPendingBalance
            .populate('mediator', '_id fullName balance')
            .session(session);

        if (!mediationRequest) {
            await session.abortTransaction();
            console.warn(`   [SERVER buyerConfirm] Mediation request ${mediationRequestId} not found.`);
            throw new Error("Mediation request not found.");
        }
        if (!mediationRequest.buyer.equals(buyerId)) {
            await session.abortTransaction();
            console.warn(`   [SERVER buyerConfirm] User ${buyerId} is not the buyer for request ${mediationRequestId}.`);
            throw new Error("Forbidden: You are not the buyer for this request.");
        }
        if (mediationRequest.status !== 'MediationOfferAccepted') {
            await session.abortTransaction();
            console.warn(`   [SERVER buyerConfirm] Action not allowed. Request status is '${mediationRequest.status}', expected 'MediationOfferAccepted'.`);
            throw new Error(`Action not allowed. Request status is '${mediationRequest.status}', expected 'MediationOfferAccepted'.`);
        }
        if (mediationRequest.buyerConfirmedStart) {
            await session.abortTransaction();
            console.warn(`   [SERVER buyerConfirm] Buyer ${buyerId} already confirmed readiness and escrowed funds.`);
            throw new Error("Already confirmed readiness and escrowed funds.");
        }

        console.log("   [SERVER buyerConfirm] mediationRequest.bidAmount:", mediationRequest.bidAmount, "Type:", typeof mediationRequest.bidAmount);
        console.log("   [SERVER buyerConfirm] mediationRequest.bidCurrency:", mediationRequest.bidCurrency, "Type:", typeof mediationRequest.bidCurrency);

        if (typeof mediationRequest.bidAmount !== 'number' || !mediationRequest.bidCurrency) {
            await session.abortTransaction(); // مهم: إلغاء الـ transaction قبل throw
            console.error("   [SERVER buyerConfirm] CRITICAL ERROR: bidAmount or bidCurrency is missing/invalid in mediationRequest.", {
                bidAmount: mediationRequest.bidAmount,
                bidCurrency: mediationRequest.bidCurrency
            });
            throw new Error("Transaction details (bid amount or currency) are incomplete for fee calculation.");
        }

        const feeDetails = calculateMediatorFeeDetails(
            mediationRequest.bidAmount,
            mediationRequest.bidCurrency
        );

        console.log("   [SERVER buyerConfirm] Fee details calculated by SERVER's feeCalculator:", JSON.stringify(feeDetails, null, 2));

        if (feeDetails.error) {
            await session.abortTransaction();
            console.error("   [SERVER buyerConfirm] Fee calculation returned an error:", feeDetails.error);
            throw new Error(`Fee calculation error: ${feeDetails.error}`);
        }

        const amountToEscrowInRequestCurrency = feeDetails.totalForBuyer;

        console.log("   [SERVER buyerConfirm] amountToEscrowInRequestCurrency extracted:", amountToEscrowInRequestCurrency, "Type:", typeof amountToEscrowInRequestCurrency);

        if (typeof amountToEscrowInRequestCurrency !== 'number' || isNaN(amountToEscrowInRequestCurrency)) {
            await session.abortTransaction();
            console.error("   [SERVER buyerConfirm] ERROR: amountToEscrowInRequestCurrency is NOT a valid number after fee calculation.", {
                value: amountToEscrowInRequestCurrency,
                type: typeof amountToEscrowInRequestCurrency,
                fullFeeDetails: feeDetails
            });
            throw new Error("Failed to determine the amount to escrow. Fee calculation might have an issue.");
        }

        const buyerUser = await User.findById(buyerId).session(session);
        if (!buyerUser) {
            await session.abortTransaction();
            console.error(`   [SERVER buyerConfirm] Buyer user ${buyerId} not found.`);
            throw new Error("Buyer user not found.");
        }
        console.log(`   [SERVER buyerConfirm] Buyer current balance (in ${platformBaseCurrency}): ${buyerUser.balance}`);

        let amountToDeductFromBalanceInPlatformCurrency = amountToEscrowInRequestCurrency;
        if (feeDetails.currencyUsed === 'USD' && platformBaseCurrency === 'TND') {
            amountToDeductFromBalanceInPlatformCurrency = amountToEscrowInRequestCurrency * TND_USD_EXCHANGE_RATE;
        } else if (feeDetails.currencyUsed === 'TND' && platformBaseCurrency === 'USD') {
            amountToDeductFromBalanceInPlatformCurrency = amountToEscrowInRequestCurrency / TND_USD_EXCHANGE_RATE;
        }
        amountToDeductFromBalanceInPlatformCurrency = parseFloat(amountToDeductFromBalanceInPlatformCurrency.toFixed(3));
        console.log(`   [SERVER buyerConfirm] Amount to deduct from buyer's balance (in ${platformBaseCurrency}): ${amountToDeductFromBalanceInPlatformCurrency}`);

        if (buyerUser.balance < amountToDeductFromBalanceInPlatformCurrency) {
            await session.abortTransaction();
            console.warn(`   [SERVER buyerConfirm] Insufficient balance for user ${buyerId}. Required: ${amountToDeductFromBalanceInPlatformCurrency}, Available: ${buyerUser.balance}`);
            throw new Error(`Insufficient balance. Required: ${formatCurrency(amountToDeductFromBalanceInPlatformCurrency, platformBaseCurrency)}, Available: ${formatCurrency(buyerUser.balance, platformBaseCurrency)}`);
        }

        buyerUser.balance = parseFloat((buyerUser.balance - amountToDeductFromBalanceInPlatformCurrency).toFixed(3));
        await buyerUser.save({ session });
        console.log(`   [SERVER buyerConfirm] Buyer ${buyerId} balance updated. New balance: ${buyerUser.balance} ${platformBaseCurrency}`);

        mediationRequest.escrowedAmount = amountToEscrowInRequestCurrency;
        mediationRequest.escrowedCurrency = feeDetails.currencyUsed;
        mediationRequest.calculatedMediatorFee = feeDetails.fee;
        mediationRequest.calculatedBuyerFeeShare = feeDetails.buyerShare;
        mediationRequest.calculatedSellerFeeShare = feeDetails.sellerShare;
        mediationRequest.mediationFeeCurrency = feeDetails.currencyUsed;
        mediationRequest.buyerConfirmedStart = true;

        let nextStatus = 'EscrowFunded'; // الحالة الافتراضية بعد الإيداع
        let buyerAlertMessage = "Readiness confirmed and funds escrowed successfully. Waiting for seller to confirm.";

        if (mediationRequest.sellerConfirmedStart) { // إذا كان البائع قد أكد بالفعل
            nextStatus = 'PartiesConfirmed';
            buyerAlertMessage = "Readiness confirmed, funds escrowed. Both parties ready. Chat will open shortly.";
            if (mediationRequest.product?._id) {
                await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'PartiesConfirmed' } }, { session });
                console.log(`   [SERVER buyerConfirm] Product ${mediationRequest.product._id} status updated to PartiesConfirmed.`);
            }
        }
        mediationRequest.status = nextStatus;

        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({
            event: "Buyer confirmed readiness and escrowed funds.",
            userId: buyerId,
            details: {
                amount: amountToEscrowInRequestCurrency,
                currency: feeDetails.currencyUsed,
                previousStatus: 'MediationOfferAccepted', // الحالة قبل هذا الإجراء
                newStatus: nextStatus
            },
            timestamp: new Date()
        });

        const updatedMediationRequest = await mediationRequest.save({ session });

        // --- [!!!] منح نقاط السمعة للأطراف المشاركة [!!!] ---
        const participantsToReward = [];
        if (mediationRequest.seller?._id) participantsToReward.push(mediationRequest.seller._id);
        if (mediationRequest.buyer?._id) participantsToReward.push(mediationRequest.buyer._id); // المشتري الذي أكد
        if (mediationRequest.mediator?._id) participantsToReward.push(mediationRequest.mediator._id);

        const uniqueParticipants = [...new Set(participantsToReward.map(id => id.toString()))];
        let reputationUpdatePromises = [];

        for (const participantId of uniqueParticipants) {
            if (mongoose.Types.ObjectId.isValid(participantId)) {
                // زيادة reputationPoints بمقدار 1
                // $inc يزيد القيمة، إذا لم يكن الحقل موجودًا، سيقوم بإنشائه وتعيين القيمة له
                reputationUpdatePromises.push(
                    User.findByIdAndUpdate(participantId,
                        { $inc: { reputationPoints: 1, successfulMediationsCount: (participantId === mediationRequest.mediator?._id.toString() ? 1 : 0) } }, // زيادة successfulMediationsCount للوسيط فقط
                        { session, new: true } // new: true ليس ضروريًا هنا إذا لم تكن بحاجة للبيانات المحدثة فورًا
                    )
                );
                console.log(`   [Reputation] Queued +1 reputation point for user ${participantId}`);
            }
        }

        if (reputationUpdatePromises.length > 0) {
            try {
                await Promise.all(reputationUpdatePromises);
                console.log(`   [Reputation] Successfully updated reputation points for ${reputationUpdatePromises.length} participants.`);
            } catch (reputationError) {
                // هذا الخطأ لا يجب أن يوقف الـ transaction الرئيسي إذا كان تحديث السمعة ثانويًا
                // لكن من المهم تسجيله
                console.error("   [Reputation] Error updating reputation points within transaction:", reputationError);
                // يمكنك هنا أن تقرر ما إذا كنت ستلغي الـ transaction أم لا
                // إذا كان تحديث السمعة حرجًا، قم بإلغاء الـ transaction:
                // await session.abortTransaction();
                // throw new Error("Failed to update reputation points for all participants.");
            }
        }
        // --- نهاية منح نقاط السمعة ---

        // إشعارات
        const productTitle = mediationRequest.product?.title || 'the transaction';
        const buyerFullName = req.user.fullName || 'The Buyer';

        // إشعار للبائع (إذا لم يكن قد أكد بعد)
        if (!mediationRequest.sellerConfirmedStart && mediationRequest.seller?._id) {
            await Notification.create([{
                user: mediationRequest.seller._id,
                type: 'BUYER_CONFIRMED_AWAITING_YOUR_ACTION',
                title: 'Buyer Confirmed & Paid - Your Turn!',
                message: `${buyerFullName} has confirmed readiness and escrowed funds for "${productTitle}". Please confirm your readiness to proceed.`,
                relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }], { session });
        }
        // إشعار للمشتري
        await Notification.create([{
            user: buyerId,
            type: 'MEDIATION_CONFIRMED_BY_PARTY', // نوع عام لتأكيد الطرف
            title: 'Readiness & Escrow Confirmed',
            message: buyerAlertMessage,
            relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
        }], { session });

        // إذا تم تأكيد كلا الطرفين، أرسل إشعارًا لجميع الأطراف (بما في ذلك الوسيط)
        if (nextStatus === 'PartiesConfirmed') {
            const partiesConfirmedNotifMessage = `All parties (Seller & Buyer) have confirmed readiness for "${productTitle}". The mediation chat will be initiated shortly.`;
            const participantsToNotify = [mediationRequest.seller._id, buyerId];
            if (mediationRequest.mediator?._id) participantsToNotify.push(mediationRequest.mediator._id);

            const partiesConfirmedNotifications = [...new Set(participantsToNotify)].map(pId => ({
                user: pId,
                type: 'PARTIES_CONFIRMED_AWAITING_CHAT',
                title: 'All Parties Confirmed!',
                message: partiesConfirmedNotifMessage,
                relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }));
            await Notification.insertMany(partiesConfirmedNotifications, { session });
        }

        await session.commitTransaction();
        console.log(`   [SERVER buyerConfirm] Transaction committed. MediationRequest ${mediationRequestId} status: ${nextStatus}.`);

        if (nextStatus === 'PartiesConfirmed') {
            initiateMediationChat(mediationRequest._id, "buyerConfirmReadinessAndEscrow").catch(err => {
                console.error("Error triggering initiateMediationChat from buyerConfirmReadinessAndEscrow:", err);
            });
        }

        // إرسال تحديث عبر Socket.IO بعد commit
        if (req.io) {
            const roomName = mediationRequestId.toString();
            const finalUpdatedRequestForSocket = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title imageUrls currency agreedPrice bidAmount bidCurrency')
                .populate('seller', '_id fullName avatarUrl userRole')
                .populate('buyer', '_id fullName avatarUrl userRole')
                .populate('mediator', '_id fullName avatarUrl userRole')
                .lean();
            if (finalUpdatedRequestForSocket) {
                req.io.to(roomName).emit('mediation_details_updated', {
                    mediationRequestId: mediationRequestId,
                    updatedMediationDetails: finalUpdatedRequestForSocket
                });
                console.log(`   [SERVER buyerConfirm] Socket event 'mediation_details_updated' emitted for room ${roomName}`);
            }
        }

        res.status(200).json({
            msg: buyerAlertMessage, // استخدم الرسالة الديناميكية
            mediationRequest: updatedMediationRequest.toObject(), // أرجع الطلب المحدث
            updatedBuyerBalance: buyerUser.balance // أرجع رصيد المشتري المحدث
        });

    } catch (error) {
        if (session && session.inTransaction()) {
            console.warn(`   [SERVER buyerConfirm] Transaction aborted due to error for request ${mediationRequestId}.`);
            await session.abortTransaction();
        }
        console.error("[SERVER buyerConfirmReadinessAndEscrow] CATCH BLOCK Error:", error.message, "\nStack:", error.stack);
        res.status(400).json({ msg: error.message || 'Failed to confirm readiness or escrow funds.' });
    } finally {
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log(`--- [SERVER] buyerConfirmReadinessAndEscrow END - MediationID: ${mediationRequestId} ---`);
    }
};

// --- Buyer: Reject Mediation ---
exports.buyerRejectMediation = async (req, res) => {
    // ... (الكود الكامل لهذه الدالة كما قدمته سابقاً، بدون تغييرات هنا) ...
    const { mediationRequestId } = req.params;
    const buyerId = req.user._id;
    const { reason } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId).populate('product', 'title _id user').populate('seller', 'fullName _id').populate('mediator', 'fullName _id').session(session);
        if (!mediationRequest) throw new Error("Mediation request not found.");
        if (!mediationRequest.buyer.equals(buyerId)) throw new Error("Forbidden: Not the buyer.");
        if (!['MediatorAssigned', 'MediationOfferAccepted'].includes(mediationRequest.status)) throw new Error(`Action not allowed. Status is '${mediationRequest.status}'.`);
        if (!reason || reason.trim() === "") throw new Error("Rejection reason required.");

        const originalStatus = mediationRequest.status;
        mediationRequest.status = 'Cancelled';
        mediationRequest.history.push({ event: "Buyer rejected/cancelled mediation", userId: buyerId, details: { reason, previousStatus: originalStatus }, timestamp: new Date() });
        const updatedRequest = await mediationRequest.save({ session });

        if (mediationRequest.product?._id) {
            const productDoc = await Product.findById(mediationRequest.product._id).session(session);
            if (productDoc && !['sold', 'Completed'].includes(productDoc.status)) {
                productDoc.status = 'approved';
                productDoc.currentMediationRequest = null;
                await productDoc.save({ session });
            }
        }
        if (mediationRequest.mediator?._id) {
            const otherActive = await MediationRequest.countDocuments({ mediator: mediationRequest.mediator._id, status: { $in: ['MediatorAssigned', 'MediationOfferAccepted', 'InProgress', 'PartiesConfirmed'] } }).session(session);
            if (otherActive === 0) {
                await User.findByIdAndUpdate(mediationRequest.mediator._id, { $set: { mediatorStatus: 'Available' } }, { session });
            }
        }

        const productTitle = mediationRequest.product?.title || 'transaction';
        const buyerName = req.user.fullName || 'Buyer';
        await Notification.create([
            { user: mediationRequest.seller._id, type: 'MEDIATION_REJECTED_BY_BUYER', title: 'Mediation Cancelled by Buyer', message: `${buyerName} cancelled mediation for "${productTitle}". Reason: "${reason}".`, relatedEntity: { id: updatedRequest._id, modelName: 'MediationRequest' } },
            ...(mediationRequest.mediator?._id ? [{ user: mediationRequest.mediator._id, type: 'MEDIATION_CANCELLED_BY_PARTY', title: 'Mediation Cancelled by Buyer', message: `Mediation for "${productTitle}" cancelled by buyer ${buyerName}. Reason: "${reason}".`, relatedEntity: { id: updatedRequest._id, modelName: 'MediationRequest' } }] : []),
            { user: buyerId, type: 'MEDIATION_CANCELLATION_CONFIRMED', title: 'Cancellation Confirmed', message: `You cancelled mediation for "${productTitle}".`, relatedEntity: { id: updatedRequest._id, modelName: 'MediationRequest' } }
        ], { session });

        await session.commitTransaction();
        res.status(200).json({ msg: "Mediation cancelled.", mediationRequest: await MediationRequest.findById(updatedRequest._id).populate('product seller buyer mediator').lean() });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error in buyerRejectMediation:", error);
        res.status(400).json({ msg: error.message || 'Failed to cancel mediation.' });
    } finally {
        if (session.endSession) await session.endSession();
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
            .populate('chatMessages.sender', 'fullName avatarUrl _id');
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

// exports.handleChatImageUpload = async (req, res) => {
//     const senderId = req.user._id;
//     const { mediationRequestId } = req.body;
//     // --- [!!!] احصل على io و onlineUsers من req [!!!] ---
//     const io = req.io;
//     const onlineUsers = req.onlineUsers;
//     // ----------------------------------------------------
//     console.log(`--- Controller: handleChatImageUpload for MedReq: ${mediationRequestId}, Sender: ${senderId} ---`);
//     console.log(`   [handleChatImageUpload] Available onlineUsers:`, onlineUsers ? Object.keys(onlineUsers) : 'Not available'); // للتحقق

//     if (!req.file) return res.status(400).json({ msg: "No image file provided." });
//     if (!mediationRequestId || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
//         if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//         return res.status(400).json({ msg: "Invalid or missing mediationRequestId." });
//     }

//     let session;
//     try {
//         session = await mongoose.startSession();
//         session.startTransaction();

//         const mediationRequest = await MediationRequest.findById(mediationRequestId)
//             .populate('product', 'title _id') // أضفت _id هنا أيضًا
//             .populate('seller', '_id fullName avatarUrl') // أضفت avatarUrl
//             .populate('buyer', '_id fullName avatarUrl')  // أضفت avatarUrl
//             .populate('mediator', '_id fullName avatarUrl') // أضفت avatarUrl
//             .session(session);

//         if (!mediationRequest) {
//             if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//             throw new Error("Mediation request not found.");
//         }
//         const isParty = (mediationRequest.seller._id.equals(senderId) ||
//             mediationRequest.buyer._id.equals(senderId) ||
//             (mediationRequest.mediator && mediationRequest.mediator._id.equals(senderId)));
//         if (!isParty) {
//             if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//             throw new Error("Forbidden: Not a party to this mediation.");
//         }
//         if (mediationRequest.status !== 'InProgress') {
//             if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//             throw new Error("Forbidden: Chat is not active for this mediation request.");
//         }

//         let relativeImagePath = req.file.path.replace(/\\/g, '/');
//         if (relativeImagePath.includes('uploads/chat_images/')) {
//             relativeImagePath = relativeImagePath.split('uploads/chat_images/')[1];
//             relativeImagePath = `chat_images/${relativeImagePath}`; // المسار النسبي من مجلد uploads الرئيسي
//         } else if (relativeImagePath.includes('uploads/')) {
//             relativeImagePath = relativeImagePath.split('uploads/')[1]; // إذا كان في uploads مباشرة
//         } else {
//             // إذا لم يكن المسار متوقعًا، قد تحتاج لمراجعة إعدادات Multer
//             console.warn("[handleChatImageUpload] Unexpected file path from Multer:", req.file.path);
//             // افتراضيًا، إذا لم يتم العثور على 'uploads/', استخدم اسم الملف فقط (قد لا يكون هذا صحيحًا دائمًا)
//             relativeImagePath = req.file.filename;
//         }

//         console.log("[handleChatImageUpload] Calculated relativeImagePath:", relativeImagePath); // <--- أضف هذا
//         // تأكد أن المسار المخزن في DB صحيح بالنسبة لمجلد static الخاص بك
//         // إذا كان مجلد static هو 'uploads', والملفات في 'uploads/chat_images', فالقيمة يجب أن تكون 'chat_images/filename.ext'

//         const imageMessageObject = {
//             sender: senderId,
//             message: `[Image: ${req.file.originalname}]`,
//             type: 'image',
//             imageUrl: relativeImagePath, // <--- القيمة التي تُحفظ وتُرسل
//             timestamp: new Date(),
//             readBy: []
//         };
//         mediationRequest.chatMessages.push(imageMessageObject);
//         await mediationRequest.save({ session });
//         await session.commitTransaction(); // <--- تم الحفظ في قاعدة البيانات هنا بنجاح

//         const senderDetails = await User.findById(senderId).select('fullName avatarUrl _id').lean();
//         const savedMessageFromDb = mediationRequest.chatMessages[mediationRequest.chatMessages.length - 1].toObject();
//         const messageToBroadcast = { ...savedMessageFromDb, sender: senderDetails || { fullName: 'User', _id: senderId } };

//         console.log("[handleChatImageUpload] Broadcasting image message (messageToBroadcast):", JSON.stringify(messageToBroadcast, null, 2)); // <--- أضف هذا

//         if (io) {
//             io.to(mediationRequestId.toString()).emit('newMediationMessage', messageToBroadcast);
//         }

//         // --- الجزء الخاص بإرسال update_unread_summary ---
//         const senderIdString = senderId.toString();
//         const participantsForUnreadSummary = [];
//         if (mediationRequest.seller?._id && mediationRequest.seller._id.toString() !== senderIdString) {
//             participantsForUnreadSummary.push(mediationRequest.seller._id.toString());
//         }
//         if (mediationRequest.buyer?._id && mediationRequest.buyer._id.toString() !== senderIdString) {
//             participantsForUnreadSummary.push(mediationRequest.buyer._id.toString());
//         }
//         if (mediationRequest.mediator?._id && mediationRequest.mediator._id.toString() !== senderIdString) {
//             participantsForUnreadSummary.push(mediationRequest.mediator._id.toString());
//         }
//         const uniqueRecipients = [...new Set(participantsForUnreadSummary)];

//         // لا نحتاج لإعادة جلب mediationRequest هنا لأننا لم نعدل chatMessages بعد الـ commit
//         // والـ transaction انتهى
//         if (mediationRequest && onlineUsers && io) { // التأكد من وجود onlineUsers و io
//             uniqueRecipients.forEach(async (recipientId) => {
//                 let unreadCountForRecipient = 0;
//                 mediationRequest.chatMessages.forEach(msg => { // استخدم mediationRequest الذي تم جلبه في بداية الدالة
//                     if (msg.sender && !msg.sender.equals(recipientId) &&
//                         (!msg.readBy || !msg.readBy.some(rb => rb.readerId && rb.readerId.equals(recipientId)))) {
//                         unreadCountForRecipient++;
//                     }
//                 });

//                 const recipientSocketId = onlineUsers[recipientId];
//                 if (recipientSocketId) {
//                     const payloadForUnreadSummary = {
//                         mediationId: mediationRequestId.toString(),
//                         newUnreadCount: unreadCountForRecipient,
//                         lastMessageTimestamp: messageToBroadcast.timestamp,
//                         productTitle: mediationRequest.product?.title || 'Mediation Chat',
//                         otherPartyForRecipient: senderDetails ? {
//                             _id: senderDetails._id.toString(),
//                             fullName: senderDetails.fullName,
//                             avatarUrl: senderDetails.avatarUrl
//                         } : { fullName: 'User', _id: senderIdString },
//                     };
//                     console.log(`   [handleChatImageUpload] Emitting 'update_unread_summary' to user ${recipientId} (socket ${recipientSocketId}) with payload:`, payloadForUnreadSummary);
//                     io.to(recipientSocketId).emit('update_unread_summary', payloadForUnreadSummary);
//                 } else {
//                     console.log(`   [handleChatImageUpload] User ${recipientId} is not online for 'update_unread_summary'.`);
//                 }
//             });
//         }
//         // --- نهاية الجزء الخاص بإرسال update_unread_summary ---

//         res.status(201).json({ msg: "Image uploaded and message sent.", message: messageToBroadcast });

//     } catch (error) {
//         if (session && session.inTransaction()) { // تحقق أن session معرف
//             await session.abortTransaction();
//         }
//         console.error("[handleChatImageUpload] Error caught:", error.message, error.stack); // طباعة الـ stack للخطأ
//         // لا تحذف الملف إذا كان الخطأ ليس بسبب فشل في الـ transaction أو الـ DB
//         // الحذف يجب أن يتم فقط إذا فشل الحفظ في الـ DB بعد تحميل الملف بنجاح
//         // إذا كان الخطأ "onlineUsers is not defined"، فهذا يحدث بعد commitTransaction
//         // لذا لا يجب حذف الملف أو عمل abort.
//         // ولكن إذا كان الخطأ قبل الـ commit، فالمنطق الحالي صحيح.

//         // إذا كان الخطأ بسبب onlineUsers is not defined، يجب ألا يتم حذف الملف
//         if (error.message !== "onlineUsers is not defined" && req.file?.path && fs.existsSync(req.file.path)) {
//             console.log("[handleChatImageUpload] Unlinking file due to error (not onlineUsers error):", req.file.path);
//             fs.unlinkSync(req.file.path);
//         }
//         res.status(400).json({ msg: error.message || "Failed to process image upload." });
//     } finally {
//         if (session && typeof session.endSession === 'function') {
//             await session.endSession();
//         }
//     }
// };

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

exports.buyerConfirmReceiptController = async (req, res) => {
    const { mediationRequestId } = req.params;
    const buyerId = req.user._id;

    console.log(`--- Controller: buyerConfirmReceipt for ${mediationRequestId} by Buyer: ${buyerId} ---`);

    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('seller', '_id balance sellerPendingBalance sellerAvailableBalance')
            .populate('mediator', '_id balance')
            .populate('product', 'title _id')
            .session(session);

        if (!mediationRequest) {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] Mediation request ${mediationRequestId} not found.`);
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        console.log(`   [SERVER buyerConfirm] mediationRequest.buyer ID: ${mediationRequest.buyer}`);
        console.log(`   [SERVER buyerConfirm] req.user._id (buyerId performing action): ${buyerId}`);
        console.log(`   [SERVER buyerConfirm] Are they equal? : ${mediationRequest.buyer.equals(buyerId)}`);

        if (!mediationRequest.buyer.equals(buyerId)) {
            await session.abortTransaction();
            console.warn(`   [SERVER buyerConfirm] FORBIDDEN: User ${buyerId} (logged in) is not the buyer for request ${mediationRequestId}. Actual buyer in DB: ${mediationRequest.buyer}`);
            throw new Error("Forbidden: You are not the buyer for this request.");
        }
        if (mediationRequest.status !== 'InProgress') {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] Action not allowed for request ${mediationRequestId}. Current status: '${mediationRequest.status}'.`);
            return res.status(400).json({ msg: `Action not allowed. Current status is '${mediationRequest.status}'.` });
        }
        if (!mediationRequest.escrowedAmount || mediationRequest.escrowedAmount <= 0) {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] No funds in escrow for mediation ${mediationRequestId}.`);
            return res.status(400).json({ msg: "No funds in escrow for this mediation." });
        }

        const totalEscrowed = parseFloat(mediationRequest.escrowedAmount);
        const mediatorFeeOriginal = parseFloat(mediationRequest.calculatedMediatorFee || 0);
        const feeOriginalCurrency = mediationRequest.mediationFeeCurrency || mediationRequest.escrowedCurrency || platformBaseCurrency;

        const amountForSellerOriginalInEscrowCurrency = totalEscrowed - mediatorFeeOriginal;

        console.log(`   [ConfirmReceipt] Total Escrowed: ${totalEscrowed} ${mediationRequest.escrowedCurrency}`);
        console.log(`   [ConfirmReceipt] Mediator Fee (Original): ${mediatorFeeOriginal} ${feeOriginalCurrency}`);
        console.log(`   [ConfirmReceipt] Amount for Seller (Original in Escrow Currency): ${amountForSellerOriginalInEscrowCurrency} ${mediationRequest.escrowedCurrency}`);

        if (amountForSellerOriginalInEscrowCurrency < 0) {
            await session.abortTransaction();
            console.error(`[ConfirmReceipt] Calculation Error: Amount for seller is negative.`);
            return res.status(500).json({ msg: "Calculation error: Negative amount for seller." });
        }

        const seller = mediationRequest.seller;
        const mediator = mediationRequest.mediator;

        if (!seller) {
            await session.abortTransaction(); console.error(`[ConfirmReceipt] Seller document not found.`);
            return res.status(404).json({ msg: "Seller not found for this request." });
        }
        if (!mediator) {
            await session.abortTransaction(); console.error(`[ConfirmReceipt] Mediator document not found.`);
            return res.status(404).json({ msg: "Mediator not found for this request." });
        }

        // 1. تحويل وتحديث رصيد البائع (إلى الرصيد المعلق بالعملة الأساسية للنظام)
        let amountForSellerInPlatformCurrency = amountForSellerOriginalInEscrowCurrency;
        if (mediationRequest.escrowedCurrency === 'USD' && platformBaseCurrency === 'TND') {
            amountForSellerInPlatformCurrency = amountForSellerOriginalInEscrowCurrency * TND_USD_EXCHANGE_RATE;
        } else if (mediationRequest.escrowedCurrency === 'TND' && platformBaseCurrency === 'USD') {
            amountForSellerInPlatformCurrency = amountForSellerOriginalInEscrowCurrency / TND_USD_EXCHANGE_RATE;
        }
        // إذا كانت العملات متطابقة، لا تغيير

        console.log(`   [ConfirmReceipt] Seller current sellerPendingBalance: ${seller.sellerPendingBalance}`);
        console.log(`   [ConfirmReceipt] Amount to add to sellerPendingBalance (in ${platformBaseCurrency}): ${amountForSellerInPlatformCurrency}`);

        seller.sellerPendingBalance = parseFloat(((seller.sellerPendingBalance || 0) + amountForSellerInPlatformCurrency).toFixed(2));
        await seller.save({ session });
        console.log(`   Seller ${seller._id} pending balance updated. New pending balance: ${seller.sellerPendingBalance} ${platformBaseCurrency}`);

        // 2. تحويل وتحديث رصيد الوسيط (رسوم الوساطة بالعملة الأساسية للنظام)
        let mediatorFeeInPlatformCurrency = mediatorFeeOriginal;
        if (feeOriginalCurrency === 'USD' && platformBaseCurrency === 'TND') {
            mediatorFeeInPlatformCurrency = mediatorFeeOriginal * TND_USD_EXCHANGE_RATE;
        } else if (feeOriginalCurrency === 'TND' && platformBaseCurrency === 'USD') {
            mediatorFeeInPlatformCurrency = mediatorFeeOriginal / TND_USD_EXCHANGE_RATE;
        }

        console.log(`   [ConfirmReceipt] Mediator current balance: ${mediator.balance}`);
        console.log(`   [ConfirmReceipt] Mediator fee to add (in ${platformBaseCurrency}): ${mediatorFeeInPlatformCurrency}`);
        console.log("--- [ConfirmReceipt] Inspecting chatMessages BEFORE SAVE ---");
        mediationRequest.chatMessages.forEach((msg, index) => {
            console.log(`   Message ${index}:`, JSON.stringify(msg));
            if (!msg.message && msg.type !== 'image' && msg.type !== 'file') { // If it's a text message but message field is missing
                console.error(`   VALIDATION ERROR PREDICTION: Message ${index} is missing 'message' field and is not an image/file.`);
            }
        });

        mediator.balance = parseFloat(((mediator.balance || 0) + mediatorFeeInPlatformCurrency).toFixed(2));
        await mediator.save({ session });
        console.log(`   Mediator ${mediator._id} balance updated. New balance: ${mediator.balance} ${platformBaseCurrency}`);

        mediationRequest.status = 'Completed';
        mediationRequest.history.push({
            event: "Buyer confirmed receipt, funds processed.",
            userId: buyerId,
            timestamp: new Date(),
            details: {
                releasedToSellerPending: amountForSellerOriginalInEscrowCurrency,
                sellerCurrency: mediationRequest.escrowedCurrency,
                mediatorFeePaid: mediatorFeeOriginal,
                mediatorFeeCurrency: feeOriginalCurrency,
            }
        });
        const updatedMediationRequest = await mediationRequest.save({ session });

        const productTitle = mediationRequest.product?.title || 'the transaction';
        const buyerFullName = req.user.fullName || 'The Buyer';

        // --- [!!!] تحديث حالة المنتج المرتبط [!!!] ---
        if (mediationRequest.product && mediationRequest.product._id) {
            try {
                const productToUpdate = await Product.findById(mediationRequest.product._id).session(session);
                if (productToUpdate) {
                    productToUpdate.status = 'sold'; // أو 'Completed' إذا كان هذا هو المصطلح الذي تستخدمه للمنتجات
                    productToUpdate.soldAt = new Date(); // إضافة تاريخ البيع
                    productToUpdate.buyer = buyerId; // ربط المشتري بالمنتج
                    // يمكنك أيضًا مسح currentMediationRequest من المنتج إذا أردت
                    // productToUpdate.currentMediationRequest = null; 
                    await productToUpdate.save({ session });
                    console.log(`   Product ${productToUpdate._id} status updated to '${productToUpdate.status}'.`);
                }
            } catch (productUpdateError) {
                console.error(`   Error updating product status for ${mediationRequest.product._id}:`, productUpdateError);
                // هذا الخطأ لا يجب أن يوقف الـ transaction الأساسي إذا كان تحديث المنتج ثانويًا
                // ولكن من الأفضل التعامل معه بشكل صحيح
            }
        }
        // --- نهاية تحديث حالة المنتج ---

        const notifications = [
            { user: seller._id, type: 'FUNDS_RECEIVED', title: 'Funds Pending Release!', message: `${buyerFullName} confirmed receipt for "${productTitle}". Funds of ${formatCurrency(amountForSellerOriginalInEscrowCurrency, mediationRequest.escrowedCurrency)} have been added to your 'On Hold' balance.`, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } },
            { user: mediator._id, type: 'FUNDS_RECEIVED', title: 'Mediator Fee Paid!', message: `Mediator fee of ${formatCurrency(mediatorFeeOriginal, feeOriginalCurrency)} for "${productTitle}" has been paid to your account.`, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } },
            { user: buyerId, type: 'MEDIATION_COMPLETED', title: 'Transaction Confirmed!', message: `You have successfully confirmed receipt for "${productTitle}". Funds have been processed. The transaction is now marked as complete.`, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' } }
        ];
        await Notification.insertMany(notifications, { session });
        console.log("   Completion and fund processing notifications created.");

        await session.commitTransaction();
        console.log(`   Transaction committed for mediation ${mediationRequestId}. Status: Completed.`);

        // --- تحديث حالة الوسيط بعد اكتمال الوساطة (خارج الـ transaction الرئيسي) ---
        if (mediationRequest.mediator && mediationRequest.mediator._id) {
            const mediatorIdToUpdate = mediationRequest.mediator._id;
            try {
                const otherActiveMediations = await MediationRequest.countDocuments({
                    mediator: mediatorIdToUpdate,
                    status: { $in: ['InProgress', 'MediatorAssigned', 'MediationOfferAccepted', 'PartiesConfirmed', 'EscrowFunded'] }
                });
                console.log(`   [Post-Transaction] Mediator ${mediatorIdToUpdate} has ${otherActiveMediations} other active mediation tasks.`);
                if (otherActiveMediations === 0) {
                    await User.findByIdAndUpdate(mediatorIdToUpdate, { $set: { mediatorStatus: 'Available' } });
                    console.log(`   [Post-Transaction] Mediator ${mediatorIdToUpdate} status updated to 'Available'.`);
                } else {
                    console.log(`   [Post-Transaction] Mediator ${mediatorIdToUpdate} remains 'Busy' due to other active tasks.`);
                }
            } catch (mediatorStatusError) {
                console.error(`   [Post-Transaction] Error updating mediator status for ${mediatorIdToUpdate}:`, mediatorStatusError);
            }
        }
        // --- نهاية تحديث حالة الوسيط ---

        if (req.io) {
            const roomName = mediationRequestId.toString();
            const finalUpdatedRequestForSocket = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title imageUrls currency agreedPrice bidAmount bidCurrency')
                .populate('seller', '_id fullName avatarUrl userRole')
                .populate('buyer', '_id fullName avatarUrl userRole')
                .populate('mediator', '_id fullName avatarUrl userRole')
                .lean();
            if (finalUpdatedRequestForSocket) {
                req.io.to(roomName).emit('mediation_details_updated', {
                    mediationRequestId: mediationRequestId,
                    updatedMediationDetails: finalUpdatedRequestForSocket
                });
                console.log(`   Socket event 'mediation_details_updated' emitted for room ${roomName}`);
            }
        }

        if (req.io) {
            const sellerSocketId = req.onlineUsers[seller._id.toString()];
            if (sellerSocketId) {
                req.io.to(sellerSocketId).emit('balance_updated', {
                    balance: seller.balance, // الرصيد الأساسي المحدث
                    sellerAvailableBalance: seller.sellerAvailableBalance,
                    sellerPendingBalance: seller.sellerPendingBalance
                });
            }
            const mediatorSocketId = req.onlineUsers[mediator._id.toString()];
            if (mediatorSocketId) {
                req.io.to(mediatorSocketId).emit('balance_updated', {
                    balance: mediator.balance
                });
            }
        }

        // --- [!!!] إرسال حدث لتحديث قائمة المنتجات (اختياري إذا كنت ستعتمد على إعادة الجلب اليدوي) [!!!] ---
        if (req.io && mediationRequest.seller?._id) {
            const sellerSocketId = req.onlineUsers[mediationRequest.seller._id.toString()];
            if (sellerSocketId) {
                req.io.to(sellerSocketId).emit('product_list_updated_for_seller', {
                    productId: mediationRequest.product?._id,
                    newStatus: 'sold' // أو الحالة الجديدة للمنتج
                });
                console.log(`   Socket event 'product_list_updated_for_seller' emitted to seller ${mediationRequest.seller._id}`);
            }
        }

        res.status(200).json({
            msg: "Receipt confirmed successfully. Funds have been processed accordingly.",
            mediationRequest: updatedMediationRequest.toObject()
        });

    } catch (error) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
            console.warn(`[ConfirmReceipt] Transaction aborted due to error for request ${mediationRequestId}.`);
        }
        console.error("[buyerConfirmReceiptController] Error:", error.message, error.stack);
        res.status(500).json({ msg: error.message || "Server error confirming receipt." });
    } finally {
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
            console.log(`   [ConfirmReceipt] Session ended for request ${mediationRequestId}`);
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

        const notifications = uniqueNotificationRecipients.map(userIdToNotify => ({
            user: userIdToNotify, type: 'MEDIATION_DISPUTED', title: 'Dispute Opened for Mediation',
            message: notificationMessage + (reason ? ` Reason: ${reason}` : ''),
            relatedEntity: { id: updatedMediationRequestGlobal._id, modelName: 'MediationRequest' }
        }));

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