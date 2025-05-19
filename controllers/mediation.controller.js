// server/controllers/mediation.controller.js

const MediationRequest = require('../models/MediationRequest');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { calculateMediatorFeeDetails } = require('../utils/feeCalculator');
const mongoose = require('mongoose');
const fs = require('fs'); // تأكد من وجود هذا إذا كنت تستخدمه في handleChatImageUpload
const path = require('path'); // تأكد من وجود هذا

// --- Helper: Currency Formatting ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
        safeCurrencyCode = "TND";
    }
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: safeCurrencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    } catch (error) {
        return `${num.toFixed(2)} ${safeCurrencyCode}`;
    }
};
const TND_USD_EXCHANGE_RATE = 3.0;

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
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID." });
        }

        const request = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title imageUrls currency agreedPrice bidAmount bidCurrency') // أضفت bidAmount و bidCurrency
            .populate('seller', '_id fullName avatarUrl userRole')
            .populate('buyer', '_id fullName avatarUrl userRole')
            .populate('mediator', '_id fullName avatarUrl userRole isMediatorQualified')
            .populate({ // Populate sender details within each chat message's readBy array
                path: 'chatMessages.readBy.readerId',
                select: 'fullName avatarUrl _id'
            })
            .populate('chatMessages.sender', 'fullName avatarUrl _id'); // Populate sender of messages

        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        const isSeller = request.seller && request.seller._id.equals(userId);
        const isBuyer = request.buyer && request.buyer._id.equals(userId);
        const isMediator = request.mediator && request.mediator._id.equals(userId);
        const isAdminUser = req.user.userRole === 'Admin';

        if (!(isSeller || isBuyer || isMediator || isAdminUser)) {
            return res.status(403).json({ msg: "Forbidden: You are not authorized to view these details." });
        }

        res.status(200).json({ mediationRequest: request });

    } catch (error) {
        console.error("[getMediationDetails] Error fetching mediation request details:", error);
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
    // ... (الكود الكامل لهذه الدالة كما قدمته سابقاً، بدون تغييرات هنا) ...
    // (تأكد أن $in يتضمن PartiesConfirmed إذا أردت أن يراها المشتري)
    const buyerId = req.user._id;
    const { page = 1, limit = 10, status: statusFilterFromQuery } = req.query;
    try {
        const query = { buyer: buyerId };
        if (statusFilterFromQuery) {
            query.status = statusFilterFromQuery;
        } else {
            query.status = { $in: ['PendingMediatorSelection', 'MediatorAssigned', 'MediationOfferAccepted', 'EscrowFunded', 'InProgress', 'PendingBuyerAction', 'PartiesConfirmed', 'Completed', 'Cancelled'] }; // أضفت حالات أكثر للمشتري
        }
        const options = { page: parseInt(page), limit: parseInt(limit), sort: { updatedAt: -1 }, populate: [{ path: 'product', select: 'title imageUrls agreedPrice currency user' }, { path: 'seller', select: 'fullName avatarUrl' }, { path: 'mediator', select: 'fullName avatarUrl' }], lean: true };
        const result = await MediationRequest.paginate(query, options);
        res.status(200).json({ requests: result.docs, totalPages: result.totalPages, currentPage: result.page, totalRequests: result.totalDocs });
    } catch (error) {
        console.error("Error fetching buyer's mediation requests:", error);
        res.status(500).json({ msg: "Server error fetching requests.", errorDetails: error.message });
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
    console.log(`--- Controller: buyerConfirmReadinessAndEscrow for MediationRequest: ${mediationRequestId} by Buyer: ${buyerId} ---`);

    const session = await mongoose.startSession();
    session.startTransaction();
    let mediationRequestInstance;

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title currency _id') // تأكد أن product.currency موجودة أو bidCurrency
            .populate('seller', '_id fullName')
            .populate('mediator', '_id fullName')
            .session(session);
        mediationRequestInstance = mediationRequest;

        const buyerUser = await User.findById(buyerId).session(session);

        if (!mediationRequest) throw new Error("Mediation request not found.");
        if (!buyerUser) throw new Error("Buyer user not found.");
        if (!mediationRequest.buyer.equals(buyerId)) throw new Error("Forbidden: Not the buyer.");
        if (mediationRequest.status !== 'MediationOfferAccepted') {
            throw new Error(`Action not allowed. Request status is '${mediationRequest.status}', expected 'MediationOfferAccepted'.`);
        }
        if (mediationRequest.buyerConfirmedStart) {
            throw new Error("Already confirmed readiness and escrowed funds.");
        }

        console.log("   [buyerConfirm] About to calculate fees. Bid Amount:", mediationRequest.bidAmount, "Bid Currency:", mediationRequest.bidCurrency, "Product Currency:", mediationRequest.product?.currency);

        // --- [!!!] التحقق من وجود bidAmount و bidCurrency [!!!] ---
        if (typeof mediationRequest.bidAmount !== 'number' || !mediationRequest.bidCurrency) {
            console.error("   [buyerConfirm] Error: bidAmount or bidCurrency is missing from mediationRequest.", mediationRequest);
            throw new Error("Transaction details (bid amount or currency) are incomplete for fee calculation.");
        }
        // -------------------------------------------------------

        const feeDetails = calculateMediatorFeeDetails(
            mediationRequest.bidAmount,
            mediationRequest.bidCurrency // استخدم bidCurrency من الطلب مباشرة
        );

        console.log("   [buyerConfirm] Fee details calculated:", feeDetails);

        if (feeDetails.error) {
            console.error("   [buyerConfirm] Fee calculation error from helper:", feeDetails.error);
            throw new Error(`Fee calculation error: ${feeDetails.error}`);
        }

        // المتغير الذي يجب أن يكون معرفاً هو feeDetails.totalForBuyerAfterFee
        const amountToEscrowInRequestCurrency = feeDetails.totalForBuyerAfterFee;
        const requestCurrencyForEscrow = feeDetails.currencyUsed; // العملة التي تم بها حساب الرسوم والمبلغ الإجمالي

        console.log(`   [buyerConfirm] Amount to Escrow in ${requestCurrencyForEscrow}: ${amountToEscrowInRequestCurrency}`);

        if (typeof amountToEscrowInRequestCurrency !== 'number') {
            console.error("   [buyerConfirm] Error: amountToEscrowInRequestCurrency is not a number after fee calculation.", feeDetails);
            throw new Error("Failed to determine the amount to escrow. Fee calculation might have an issue.");
        }

        // --- منطق خصم الرصيد (تأكد من صحته) ---
        const platformBaseCurrency = 'TND'; // أو عملتك الأساسية
        let amountToDeductFromBalanceInPlatformCurrency = amountToEscrowInRequestCurrency;

        if (requestCurrencyForEscrow !== platformBaseCurrency) {
            if (requestCurrencyForEscrow === 'USD' && platformBaseCurrency === 'TND') {
                amountToDeductFromBalanceInPlatformCurrency = amountToEscrowInRequestCurrency * TND_USD_EXCHANGE_RATE;
            } else if (requestCurrencyForEscrow === 'TND' && platformBaseCurrency === 'USD') {
                amountToDeductFromBalanceInPlatformCurrency = amountToEscrowInRequestCurrency / TND_USD_EXCHANGE_RATE;
            } else if (requestCurrencyForEscrow !== platformBaseCurrency) {
                console.error(`   [buyerConfirm] Currency conversion error: Cannot convert ${requestCurrencyForEscrow} to ${platformBaseCurrency}.`);
                throw new Error(`Currency mismatch for escrow: Request is ${requestCurrencyForEscrow}, platform base is ${platformBaseCurrency}. Conversion rule needed or not supported.`);
            }
        }
        amountToDeductFromBalanceInPlatformCurrency = parseFloat(amountToDeductFromBalanceInPlatformCurrency.toFixed(3));
        console.log(`   [buyerConfirm] Amount to deduct from balance in ${platformBaseCurrency}: ${amountToDeductFromBalanceInPlatformCurrency}`);

        if (buyerUser.balance < amountToDeductFromBalanceInPlatformCurrency) {
            console.warn(`   [buyerConfirm] Insufficient balance for user ${buyerId}. Required: ${amountToDeductFromBalanceInPlatformCurrency}, Available: ${buyerUser.balance}`);
            throw new Error(`Insufficient balance. Required: ${formatCurrency(amountToDeductFromBalanceInPlatformCurrency, platformBaseCurrency)}, Available: ${formatCurrency(buyerUser.balance, platformBaseCurrency)}`);
        }

        buyerUser.balance = parseFloat((buyerUser.balance - amountToDeductFromBalanceInPlatformCurrency).toFixed(3));
        await buyerUser.save({ session });
        console.log(`   [buyerConfirm] Buyer ${buyerId} balance updated. New balance: ${buyerUser.balance} ${platformBaseCurrency}`);
        // --- نهاية منطق خصم الرصيد ---

        mediationRequest.escrowedAmount = amountToEscrowInRequestCurrency;
        mediationRequest.escrowedCurrency = requestCurrencyForEscrow;
        mediationRequest.calculatedMediatorFee = feeDetails.fee;
        mediationRequest.calculatedBuyerFeeShare = feeDetails.buyerShare;
        mediationRequest.calculatedSellerFeeShare = feeDetails.sellerShare;
        mediationRequest.mediationFeeCurrency = feeDetails.currencyUsed;
        mediationRequest.buyerConfirmedStart = true;

        let msg = "Readiness confirmed, funds escrowed. Waiting for seller.";

        if (mediationRequest.sellerConfirmedStart) {
            mediationRequest.status = 'PartiesConfirmed';
            msg = "Readiness confirmed, funds escrowed. Both parties ready. Chat will open shortly.";
            if (mediationRequest.product?._id) {
                await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'PartiesConfirmed' } }, { session });
            }
            // ... (إشعارات PartiesConfirmed) ...
        } else {
            mediationRequest.status = 'EscrowFunded';
            // ... (إشعار للبائع) ...
        }

        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({
            event: "Buyer confirmed and escrowed",
            userId: buyerId,
            details: { amount: amountToEscrowInRequestCurrency, currency: requestCurrencyForEscrow },
            timestamp: new Date()
        });

        await mediationRequest.save({ session });
        await session.commitTransaction();
        console.log("   buyerConfirmReadinessAndEscrow transaction committed.");

        if (mediationRequestInstance?.status === 'PartiesConfirmed') {
            initiateMediationChat(mediationRequestInstance._id, "buyerConfirmReadinessAndEscrow").catch(err => {
                console.error("Error triggering initiateMediationChat from buyerConfirmReadinessAndEscrow:", err);
            });
        }

        const finalResponse = await MediationRequest.findById(mediationRequestInstance._id)
            .populate('product', 'title status currentMediationRequest agreedPrice imageUrls currency user')
            .populate('seller', 'fullName avatarUrl')
            .populate('buyer', 'fullName avatarUrl')
            .populate('mediator', 'fullName avatarUrl')
            .populate('history.userId', 'fullName')
            .lean();

        res.status(200).json({
            msg,
            mediationRequest: finalResponse,
            updatedBuyerBalance: buyerUser.balance
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error in buyerConfirmReadinessAndEscrow:", error.message, error.stack); // طباعة الخطأ ومكدسه
        // أرسل رسالة الخطأ الفعلية التي جاءت من الـ try block
        res.status(400).json({ msg: error.message || 'Failed to confirm readiness or escrow funds.' });
    } finally {
        if (session && session.endSession) {
            await session.endSession();
        }
        console.log("--- Controller: buyerConfirmReadinessAndEscrow END ---");
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
    // ... (الكود الكامل لهذه الدالة كما قدمته سابقاً، بدون تغييرات هنا) ...
    const { mediationRequestId } = req.params;
    const userId = req.user._id;
    try {
        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) return res.status(400).json({ msg: "Invalid ID." });
        const request = await MediationRequest.findById(mediationRequestId).select('seller buyer mediator status chatMessages').populate('chatMessages.sender', 'fullName avatarUrl _id');
        if (!request) return res.status(404).json({ msg: "Request not found." });
        const isParty = request.seller.equals(userId) || request.buyer.equals(userId) || (request.mediator && request.mediator.equals(userId));
        if (!isParty) return res.status(403).json({ msg: "Forbidden: Not a party." });
        res.status(200).json(request.chatMessages || []);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ msg: "Server error.", errorDetails: error.message });
    }
};

exports.handleChatImageUpload = async (req, res) => {
    const senderId = req.user._id;
    const { mediationRequestId } = req.body;
    console.log(`--- Controller: handleChatImageUpload for MedReq: ${mediationRequestId}, Sender: ${senderId} ---`);

    if (!req.file) return res.status(400).json({ msg: "No image file provided." });
    if (!mediationRequestId || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ msg: "Invalid or missing mediationRequestId." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title') // For notification
            .populate('seller', '_id')    // For notification recipients
            .populate('buyer', '_id')
            .populate('mediator', '_id')
            .session(session);
        if (!mediationRequest) {
            if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            throw new Error("Mediation request not found.");
        }
        const isParty = (mediationRequest.seller.equals(senderId) || mediationRequest.buyer.equals(senderId) || (mediationRequest.mediator && mediationRequest.mediator.equals(senderId)));
        if (!isParty) { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); throw new Error("Forbidden: Not a party."); }
        if (mediationRequest.status !== 'InProgress') { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); throw new Error("Forbidden: Chat not active."); }

        let relativeImagePath = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        if (!relativeImagePath) { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); throw new Error("Error processing file path."); }
        relativeImagePath = `uploads/${relativeImagePath}`;

        const imageMessageObject = {
            sender: senderId,
            message: `[Image: ${req.file.originalname}]`,
            type: 'image',
            imageUrl: relativeImagePath,
            timestamp: new Date(),
            readBy: [] // يبدأ فارغاً
        };
        if (!Array.isArray(mediationRequest.chatMessages)) mediationRequest.chatMessages = [];
        mediationRequest.chatMessages.push(imageMessageObject);
        await mediationRequest.save({ session });
        await session.commitTransaction();

        const senderDetails = await User.findById(senderId).select('fullName avatarUrl').lean();
        const savedMessageFromDb = mediationRequest.chatMessages[mediationRequest.chatMessages.length - 1].toObject();
        const messageToBroadcast = { ...savedMessageFromDb, sender: senderDetails };

        console.log("[handleChatImageUpload] Broadcasting image message:", messageToBroadcast);
        if (req.io) req.io.to(mediationRequestId.toString()).emit('newMediationMessage', messageToBroadcast);

        // --- [!!!] الجزء الجديد: إرسال تحديث للرسائل غير المقروءة للمستلمين [!!!] ---
        const senderIdString = senderId.toString();
        const participantsToNotifyAboutUnread = [];

        if (mediationRequest.seller && mediationRequest.seller._id.toString() !== senderIdString) {
            participantsToNotifyAboutUnread.push(mediationRequest.seller._id.toString());
        }
        if (mediationRequest.buyer && mediationRequest.buyer._id.toString() !== senderIdString) {
            participantsToNotifyAboutUnread.push(mediationRequest.buyer._id.toString());
        }
        if (mediationRequest.mediator && mediationRequest.mediator._id.toString() !== senderIdString) {
            participantsToNotifyAboutUnread.push(mediationRequest.mediator._id.toString());
        }

        // إزالة أي تكرار (احتياطي)
        const uniqueRecipients = [...new Set(participantsToNotifyAboutUnread)];

        uniqueRecipients.forEach(recipientId => {
            const recipientSocketId = onlineUsers[recipientId]; // onlineUsers هو الكائن الذي يخزن { userId: socketId }
            if (recipientSocketId) {
                // نحتاج لحساب عدد الرسائل غير المقروءة لهذا المستلم في هذه الوساطة
                // هذا يمكن أن يكون مكلفًا إذا تم حسابه عند كل رسالة.
                // طريقة أفضل قد تكون إرسال إشارة فقط، والعميل يزيد العداد،
                // أو الخادم يحسبها بشكل غير متزامن.

                // للتبسيط الآن، سنرسل فقط معرف الوساطة ومعلومات أساسية.
                // العميل يمكنه زيادة العداد أو جلب الملخصات مرة أخرى.
                // ولكن الطريقة الأفضل هي أن يحسب الخادم العدد الجديد ويرسله.

                // --- طريقة محسنة: حساب العدد الجديد للرسائل غير المقروءة للمستلم ---
                let unreadCountForRecipientInThisMediation = 0;
                mediationRequest.chatMessages.forEach(msg => {
                    if (msg.sender && !msg.sender.equals(recipientId) &&
                        (!msg.readBy || !msg.readBy.some(rb => rb.readerId && rb.readerId.equals(recipientId)))) {
                        unreadCountForRecipientInThisMediation++;
                    }
                });
                // -------------------------------------------------------------

                console.log(`   [sendMediationMessage] Emitting 'update_unread_summary' to user ${recipientId} (socket ${recipientSocketId}) for mediation ${mediationRequestId} with unread count ${unreadCountForRecipientInThisMediation}`);
                io.to(recipientSocketId).emit('update_unread_summary', {
                    mediationId: mediationRequestId.toString(),
                    // senderName: senderDetailsForBroadcast.fullName, // اسم مرسل الرسالة الجديدة
                    // messageSnippet: messageToBroadcast.message.substring(0, 50), // مقتطف من الرسالة
                    newUnreadCount: unreadCountForRecipientInThisMediation, // العدد الجديد للرسائل غير المقروءة لهذه الوساطة لهذا المستلم
                    lastMessageTimestamp: messageToBroadcast.timestamp, // وقت آخر رسالة
                    productTitle: mediationRequest.product?.title || 'Mediation Chat', // عنوان المنتج
                    otherPartyForRecipient: senderDetailsForBroadcast, // مرسل الرسالة هو "الطرف الآخر" بالنسبة للمستلم الآن
                });
            } else {
                console.log(`   [sendMediationMessage] User ${recipientId} is not online to receive unread summary update.`);
                // هنا يمكنك تخزين علامة في قاعدة البيانات أن المستخدم لديه رسائل غير مقروءة ليراها عند تسجيل الدخول التالي
                // أو الاعتماد على الحساب الديناميكي عند getMyMediationSummaries
            }
        });
        // --- [!!!] نهاية الجزء الجديد [!!!] ---

        res.status(201).json({ msg: "Image uploaded successfully.", message: messageToBroadcast });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("[handleChatImageUpload] Error:", error.message);
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ msg: error.message || "Failed to upload image." });
    } finally {
        if (session.endSession) await session.endSession();
    }
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