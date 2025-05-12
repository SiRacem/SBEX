// server/controllers/mediation.controller.js
// *** نسخة كاملة ومعدلة لدالة adminAssignMediator بدون اختصارات ***

const MediationRequest = require('../models/MediationRequest');
const User = require('../models/User');
const Product = require('../models/Product'); // قد لا نحتاجه مباشرة هنا، لكن ربما في إشعارات أخرى
const Notification = require('../models/Notification');
const { calculateMediatorFeeDetails } = require('../utils/feeCalculator'); // <-- استيراد دالة حساب العمولة
const mongoose = require('mongoose');

// --- دالة تنسيق العملة (تبقى كما هي) ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
        safeCurrencyCode = "TND";
    }
    try {
        return new Intl.NumberFormat('en-US', { // أو 'fr-TN' إذا كنت تفضل التنسيق المحلي للعملات
            style: 'currency',
            currency: safeCurrencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 // أو 3 لـ TND إذا أردت
        }).format(num);
    } catch (error) {
        return `${num.toFixed(2)} ${safeCurrencyCode}`;
    }
};

const TND_USD_EXCHANGE_RATE = 3.0;

// --- دالة جلب الطلبات المعلقة (تبقى كما هي من النسخة السابقة) ---
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
// ----------------------------------------------------------------

/**
 * [Admin] تعيين وسيط لطلب وساطة محدد (مُعدَّل لمنع تعيين الأطراف)
 */
exports.adminAssignMediator = async (req, res) => {
    const { requestId } = req.params; // ID طلب الوساطة
    const { mediatorId } = req.body; // ID الوسيط المراد تعيينه
    const adminUserId = req.user._id; // ID الأدمن الذي يقوم بالتعيين

    console.log(`[MediationCtrl - AssignMediator V3] Admin ${adminUserId} assigning Mediator ${mediatorId} to Request ${requestId}`);

    // التحقق من صلاحية معرفات MongoDB
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(mediatorId)) {
        console.warn(`[MediationCtrl - AssignMediator V3] Invalid ID format. RequestID: ${requestId}, MediatorID: ${mediatorId}`);
        return res.status(400).json({ msg: "Invalid Request ID or Mediator ID format." });
    }

    // بدء معاملة قاعدة البيانات لضمان التزامن
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[MediationCtrl - AssignMediator V3] Transaction started.");

    try {
        // خطوة 1: التحقق من أن المستخدم المختار وسيط مؤهل ونشط
        console.log(`   Checking qualification for user ${mediatorId}...`);
        const mediatorUser = await User.findOne({
            _id: mediatorId,
            isMediatorQualified: true, // تأكد أن هذا الحقل موجود ومُعدّل في موديل User
            blocked: false
        }).select('_id').lean().session(session); // نحتاج فقط للـ ID هنا للتحقق

        if (!mediatorUser) {
            console.warn(`   Mediator validation failed for user ${mediatorId}.`);
            throw new Error(`Selected user (ID: ${mediatorId}) is not a qualified or active mediator.`);
        }
        console.log(`   User ${mediatorId} is qualified.`);

        // خطوة 2: جلب طلب الوساطة الأصلي للتحقق من حالته وأطرافه
        console.log(`   Fetching MediationRequest ${requestId} for validation...`);
        const mediationRequest = await MediationRequest.findOne({
            _id: requestId,
            status: 'PendingAssignment' // يجب أن يكون الطلب لا يزال ينتظر التعيين
        }).select('seller buyer status').session(session); // جلب الحقول المطلوبة للتحقق

        if (!mediationRequest) {
            // محاولة معرفة السبب إذا لم يتم العثور عليه بالحالة المطلوبة
            const existingRequestCheck = await MediationRequest.findById(requestId).select('status').session(session);
            if (!existingRequestCheck) {
                console.warn(`   Mediation request ${requestId} not found.`);
                throw new Error(`Mediation request with ID ${requestId} not found.`);
            } else {
                console.warn(`   Mediation request ${requestId} is already in status "${existingRequestCheck.status}".`);
                throw new Error(`Mediation request is already in status "${existingRequestCheck.status}". Cannot assign mediator.`);
            }
        }
        console.log(`   Found pending request ${requestId}. Seller: ${mediationRequest.seller}, Buyer: ${mediationRequest.buyer}`);

        // خطوة 3: التحقق من أن الوسيط المختار ليس هو البائع أو المشتري
        console.log(`   Validating mediator against seller and buyer...`);
        if (mediationRequest.seller.equals(mediatorId)) {
            console.warn(`   Assignment Blocked: Mediator ${mediatorId} is the seller.`);
            throw new Error("The selected mediator cannot be the seller in this transaction.");
        }
        if (mediationRequest.buyer.equals(mediatorId)) {
            console.warn(`   Assignment Blocked: Mediator ${mediatorId} is the buyer.`);
            throw new Error("The selected mediator cannot be the buyer in this transaction.");
        }
        console.log(`   Mediator validation successful (not seller or buyer).`);

        // خطوة 4: تحديث طلب الوساطة وتعيين الوسيط وتغيير الحالة
        console.log(`   Updating MediationRequest ${requestId} with mediator ${mediatorId}...`);
        // استخدام findByIdAndUpdate آمن هنا بعد التحقق من الحالة
        const updatedMediationRequest = await MediationRequest.findByIdAndUpdate(
            requestId,
            {
                $set: {
                    mediator: mediatorId,
                    status: 'MediatorAssigned' // الحالة الجديدة: تم تعيين وسيط
                }
            },
            { new: true, runValidators: true, session: session } // إرجاع المستند المحدث
        ).populate('product', 'title') // Populate needed fields for notification
            .populate('seller', 'fullName') // Populate needed fields for notification
            .populate('buyer', 'fullName'); // Populate needed fields for notification

        // تحقق إضافي لضمان نجاح التحديث
        if (!updatedMediationRequest) {
            console.error(`   Failed to update mediation request ${requestId} unexpectedly.`);
            throw new Error(`Failed to update mediation request ${requestId} after validation.`);
        }
        console.log(`   Request ${requestId} updated. New status: ${updatedMediationRequest.status}, Mediator: ${updatedMediationRequest.mediator}`);

        // خطوة 5: إنشاء وإرسال إشعار للوسيط المعين
        console.log(`   Creating notification for assigned mediator ${mediatorId}...`);
        const productTitle = updatedMediationRequest.product?.title || 'N/A';
        const bidAmountFormatted = formatCurrency(updatedMediationRequest.bidAmount, updatedMediationRequest.bidCurrency);
        const mediatorMessage = `You have been assigned as a mediator for the transaction regarding product "${productTitle}" (Price: ${bidAmountFormatted}). Please review and accept or reject the task within the allowed time.`;

        const newNotification = await Notification.create([{ // Use create which returns the doc
            user: mediatorId,
            type: 'MEDIATION_ASSIGNED',
            title: 'New Mediation Assignment',
            message: mediatorMessage,
            relatedEntity: { id: updatedMediationRequest._id, modelName: 'MediationRequest' }
        }], { session: session }); // Pass session
        console.log(`   Notification created (ID: ${newNotification[0]._id}) for assigned mediator ${mediatorId}.`);

        // خطوة 6: إرسال الإشعار عبر Socket.IO (إذا كان متاحاً)
        const mediatorSocketId = req.onlineUsers?.[mediatorId.toString()];
        if (mediatorSocketId) {
            req.io.to(mediatorSocketId).emit('new_notification', newNotification[0].toObject()); // Send the full notification object
            console.log(`   Sent real-time notification to mediator ${mediatorId} via socket ${mediatorSocketId}`);
        } else {
            console.log(`   Mediator ${mediatorId} not online for socket notification.`);
        }

        // خطوة 7: إتمام المعاملة
        await session.commitTransaction();
        console.log(`   Transaction committed for assigning mediator to request ${requestId}.`);

        // خطوة 8: إرسال استجابة ناجحة
        res.status(200).json({
            msg: 'Mediator assigned successfully.',
            mediationRequest: updatedMediationRequest // إرجاع الطلب المحدث
        });

    } catch (error) {
        // خطوة 9: معالجة الأخطاء وإلغاء المعاملة
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl - AssignMediator V3] Transaction aborted due to error:", error.message);
        } else {
            console.log("[MediationCtrl - AssignMediator V3] Transaction was not active or already handled.");
        }
        console.error("[MediationCtrl - AssignMediator V3] Error assigning mediator:", error);
        // تحديد كود الحالة المناسب
        const statusCode = error.message.includes("cannot be the seller") || error.message.includes("cannot be the buyer") || error.message.includes("not a qualified") || error.message.includes("already in status") || error.message.includes("not found") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || 'Failed to assign mediator.' });
    } finally {
        // خطوة 10: إنهاء الجلسة
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("[MediationCtrl - AssignMediator V3] Session ended.");
    }
};

exports.getAvailableRandomMediators = async (req, res) => {
    const { mediationRequestId } = req.params;
    const requestingUserId = req.user._id;
    const { refresh, exclude } = req.query;

    console.log(`--- Controller: getAvailableRandomMediators ---`);
    console.log(`   MediationRequestID: ${mediationRequestId}, Requesting User: ${requestingUserId}`);
    console.log(`   Refresh: ${refresh}, Exclude: ${exclude}`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID format." });
    }

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .select('seller buyer product status previouslySuggestedMediators suggestionRefreshCount')
            .lean();

        console.log("   Fetched mediationRequest:", mediationRequest);

        if (!mediationRequest) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (!mediationRequest.seller.equals(requestingUserId)) {
            return res.status(403).json({ msg: "Forbidden: You are not the seller for this mediation request." });
        }
        if (mediationRequest.status !== 'PendingMediatorSelection') {
            if (mediationRequest.status === 'MediatorAssigned' || mediationRequest.status === 'MediationOfferAccepted') {
                return res.status(400).json({ msg: `Mediator has already been assigned or selection process is beyond this stage. Status: ${mediationRequest.status}` });
            }
            return res.status(400).json({ msg: `Cannot select mediator for a request with status: ${mediationRequest.status}.` });
        }

        let exclusionIds = [];
        if (mediationRequest.seller) exclusionIds.push(mediationRequest.seller);
        if (mediationRequest.buyer) exclusionIds.push(mediationRequest.buyer);
        // console.log("   Initial exclusionIds (seller, buyer):", exclusionIds.map(id => id?.toString()));

        if (refresh === 'true' && mediationRequest.previouslySuggestedMediators && mediationRequest.previouslySuggestedMediators.length > 0) {
            exclusionIds = [...exclusionIds, ...mediationRequest.previouslySuggestedMediators];
        }
        // console.log("   ExclusionIds after previouslySuggested:", exclusionIds.map(id => id?.toString()));

        if (exclude) {
            const excludeArray = exclude.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
            if (excludeArray.length > 0) {
                exclusionIds = [...new Set([...exclusionIds, ...excludeArray.map(id => new mongoose.Types.ObjectId(id))])];
            }
        }
        // console.log("   ExclusionIds after query param 'exclude':", exclusionIds.map(id => id?.toString()));

        const finalExclusionObjectIds = exclusionIds
            .filter(id => id && mongoose.Types.ObjectId.isValid(id.toString()))
            .map(id => new mongoose.Types.ObjectId(id.toString()));
        // console.log("   Final valid exclusion ObjectIds for query:", finalExclusionObjectIds.map(id => id.toString()));

        const query = {
            isMediatorQualified: true,
            mediatorStatus: 'Available',
            blocked: false,
            _id: { $nin: finalExclusionObjectIds }
        };
        // console.log("   MongoDB User query:", JSON.stringify(query, null, 2));

        const allAvailableMediators = await User.find(query)
            .select('fullName avatarUrl mediatorStatus successfulMediationsCount reputationPoints level positiveRatings negativeRatings')
            .lean();
        console.log(`   Found ${allAvailableMediators.length} eligible mediators after filtering.`);

        if (allAvailableMediators.length === 0) {
            let message = "No available mediators found matching the criteria.";
            if (refresh === 'true') {
                message = "No new distinct mediators found with the current criteria after refresh.";
            }
            console.log(`   ${message}`);
            return res.status(200).json({ mediators: [], message: message, refreshCountRemaining: Math.max(0, 1 - (mediationRequest.suggestionRefreshCount + (refresh === 'true' ? 1 : 0))) }); // إرجاع 200 مع مصفوفة فارغة ورسالة
        }

        // --- [!!!] عملية الاختيار العشوائي وتخزينها في متغير [!!!] ---
        const shuffledMediators = [...allAvailableMediators].sort(() => 0.5 - Math.random()); // إنشاء نسخة قبل الخلط
        const selectedMediatorsRaw = shuffledMediators.slice(0, 3); // هذا هو المتغير الذي كان مفقودًا
        // -------------------------------------------------------------

        console.log("   Raw selected mediators before rating calculation:", selectedMediatorsRaw); // الآن هذا السطر سيعمل

        const selectedMediatorsWithRating = selectedMediatorsRaw.map(mediator => {
            const totalRatings = (mediator.positiveRatings || 0) + (mediator.negativeRatings || 0);
            let calculatedRatingValue = null;
            if (totalRatings > 0) {
                calculatedRatingValue = parseFloat((((mediator.positiveRatings || 0) / totalRatings) * 5).toFixed(1));
            }
            return { ...mediator, calculatedRating: calculatedRatingValue };
        });
        console.log("   Selected Mediators with Calculated Rating:", selectedMediatorsWithRating);


        if (refresh !== 'true' && selectedMediatorsWithRating.length > 0) {
            console.log("   Attempting to update previouslySuggestedMediators for request:", mediationRequestId, "with IDs:", selectedMediatorsWithRating.map(m => m._id.toString()));
            await MediationRequest.findByIdAndUpdate(mediationRequestId, {
                $addToSet: { previouslySuggestedMediators: { $each: selectedMediatorsWithRating.map(m => m._id) } },
            });
            console.log(`   Updated MediationRequest ${mediationRequestId} with newly suggested mediator IDs.`);
        }

        let currentRefreshCount = mediationRequest.suggestionRefreshCount || 0;
        if (refresh === 'true' && currentRefreshCount < 1) { // افترض أن الحد الأقصى هو 1 تحديث
            await MediationRequest.findByIdAndUpdate(mediationRequestId, {
                $inc: { suggestionRefreshCount: 1 }
            });
            currentRefreshCount++; // تحديث العداد المحلي
            console.log(`   Incremented suggestionRefreshCount for ${mediationRequestId} to ${currentRefreshCount}.`);
        }

        res.status(200).json({
            mediators: selectedMediatorsWithRating,
            suggestionsRefreshed: refresh === 'true',
            refreshCountRemaining: Math.max(0, 1 - currentRefreshCount) // استخدام العداد المحدث
        });

    } catch (error) {
        console.error("--- Controller: getAvailableRandomMediators CATCH BLOCK ERROR ---", error);
        res.status(500).json({ msg: "Server error while fetching available mediators.", errorDetails: error.message });
    } finally {
        console.log("--- Controller: getAvailableRandomMediators END ---");
    }
};

// --- [!!!] دالة البائع لتعيين الوسيط المختار - كاملة ومعدلة [!!!] ---
exports.sellerAssignSelectedMediator = async (req, res) => {
    const { mediationRequestId } = req.params; // ID طلب الوساطة
    const { selectedMediatorId } = req.body;   // ID الوسيط الذي اختاره البائع
    const sellerId = req.user._id;             // ID البائع الحالي (من verifyAuth)

    console.log(`--- Controller: sellerAssignSelectedMediator ---`);
    console.log(`   MediationRequestID: ${mediationRequestId}, SellerID: ${sellerId}, SelectedMediatorID: ${selectedMediatorId}`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId) || !mongoose.Types.ObjectId.isValid(selectedMediatorId)) {
        console.error("   Validation Error: Invalid Request ID or Mediator ID format.");
        return res.status(400).json({ msg: "Invalid Request ID or Mediator ID format." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for sellerAssignSelectedMediator.");

    try {
        // 1. جلب طلب الوساطة والتحقق (مع populate للمنتج والمشتري من البداية)
        console.log("   Fetching current MediationRequest with populated product and buyer...");
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title') // جلب عنوان المنتج للإشعارات وتحديث حالته
            .populate('buyer', 'fullName _id')   // جلب اسم ومعرف المشتري للإشعارات
            .session(session);

        if (!mediationRequest) {
            console.error(`   Error: Mediation request ${mediationRequestId} not found.`);
            throw new Error("Mediation request not found.");
        }
        console.log("   Fetched MediationRequest. Current status:", mediationRequest.status);

        // التحقق من أن المستخدم الحالي هو البائع في هذا الطلب
        if (!mediationRequest.seller.equals(sellerId)) {
            console.error("   Authorization Error: User is not the seller for this request.");
            throw new Error("Forbidden: You are not the seller for this mediation request.");
        }

        // التحقق من أن حالة طلب الوساطة هي 'PendingMediatorSelection'
        if (mediationRequest.status !== 'PendingMediatorSelection') {
            console.warn(`   Action Error: Cannot assign mediator. Request status is already '${mediationRequest.status}'.`);
            throw new Error(`Cannot assign mediator. Request status is already '${mediationRequest.status}'.`);
        }

        // التحقق من أن الوسيط المختار ليس هو البائع أو المشتري
        if (mediationRequest.seller.equals(selectedMediatorId)) {
            console.warn("   Validation Error: Mediator cannot be the seller.");
            throw new Error("The selected mediator cannot be the seller in this transaction.");
        }
        if (mediationRequest.buyer._id.equals(selectedMediatorId)) { // تأكد من المقارنة مع _id إذا كان buyer هو كائن populated
            console.warn("   Validation Error: Mediator cannot be the buyer.");
            throw new Error("The selected mediator cannot be the buyer in this transaction.");
        }
        console.log("   Seller and request status validations passed.");

        // 2. التحقق من أن الوسيط المختار مؤهل ومتاح
        console.log(`   Fetching selected mediator user ${selectedMediatorId} for validation...`);
        const mediatorUser = await User.findOne({
            _id: selectedMediatorId,
            isMediatorQualified: true,
            mediatorStatus: 'Available',
            blocked: false
        }).select('fullName').lean().session(session); // نحتاج الاسم للإشعار

        if (!mediatorUser) {
            console.warn(`   Validation Error: Selected user (ID: ${selectedMediatorId}) is not a valid mediator.`);
            throw new Error(`Selected user (ID: ${selectedMediatorId}) is not a qualified or available mediator, or does not exist.`);
        }
        console.log(`   Selected mediator ${mediatorUser.fullName} (${selectedMediatorId}) is valid and available.`);

        // 3. تحديث طلب الوساطة: تعيين الوسيط وتغيير الحالة وإضافة سجل
        mediationRequest.mediator = selectedMediatorId;
        mediationRequest.status = 'MediatorAssigned'; // الحالة الجديدة: ينتظر قبول الوسيط

        if (!Array.isArray(mediationRequest.history)) { // تهيئة إذا لم تكن موجودة (الأفضل أن يكون لها default: [] في الموديل)
            mediationRequest.history = [];
        }
        mediationRequest.history.push({
            event: "Mediator selected by seller",
            userId: sellerId, // البائع هو من قام بالإجراء
            details: { mediatorId: selectedMediatorId, mediatorName: mediatorUser.fullName },
            timestamp: new Date()
        });

        const updatedMediationRequestDoc = await mediationRequest.save({ session });
        console.log(`   MediationRequest ${updatedMediationRequestDoc._id} updated. New status: ${updatedMediationRequestDoc.status}, Mediator assigned: ${updatedMediationRequestDoc.mediator}`);

        // 4. تحديث حالة المنتج المرتبط إلى 'MediatorAssigned'
        // mediationRequest.product هنا هو كائن المنتج populated من الخطوة الأولى
        if (mediationRequest.product && mediationRequest.product._id) {
            await Product.findByIdAndUpdate(mediationRequest.product._id,
                { $set: { status: 'MediatorAssigned' } }, // استخدام $set للتحديث الصريح
                { session: session, new: true } // new: true لإرجاع المستند المحدث (اختياري هنا)
            );
            console.log(`   Product ${mediationRequest.product._id} status updated to 'MediatorAssigned' in DB.`);
        } else {
            console.warn("   Warning: mediationRequest.product was not available or had no _id for product status update. This is unexpected.");
            // قد ترغب في رمي خطأ هنا أو معالجته بشكل مختلف إذا كان المنتج إلزاميًا دائمًا
        }

        // 5. إنشاء وإرسال الإشعارات
        console.log("   Preparing notifications...");
        const productTitleForNotification = mediationRequest.product?.title || 'the specified product'; // استخدام عنوان المنتج من الكائن populated
        const sellerFullNameForNotification = req.user.fullName || 'The Seller'; // اسم البائع الحالي
        const buyerFullNameForNotification = mediationRequest.buyer?.fullName || 'The Buyer'; // اسم المشتري من الكائن populated

        // إشعار للبائع (تأكيد)
        const sellerConfirmationMsg = `You have successfully selected ${mediatorUser.fullName} as the mediator for "${productTitleForNotification}". They have been notified and you will be updated on their decision.`;
        await Notification.create([{
            user: sellerId,
            type: 'MEDIATOR_SELECTION_CONFIRMED', // تأكد أن هذا النوع موجود في Notification enum
            title: 'Mediator Selection Confirmed',
            message: sellerConfirmationMsg,
            relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Confirmation notification sent to seller: ${sellerId}`);

        // إشعار للوسيط المعين
        const mediatorNotificationMsg = `You have been selected as a mediator by ${sellerFullNameForNotification} for a transaction regarding "${productTitleForNotification}" with ${buyerFullNameForNotification}. Please review and accept or reject this assignment.`;
        await Notification.create([{
            user: selectedMediatorId,
            type: 'MEDIATION_ASSIGNED', // تأكد أن هذا النوع موجود في Notification enum
            title: 'New Mediation Assignment',
            message: mediatorNotificationMsg,
            relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Assignment notification sent to assigned mediator: ${selectedMediatorId}`);

        // إشعار للمشتري
        const buyerNotificationMsg = `${sellerFullNameForNotification} has selected ${mediatorUser.fullName} as the mediator for your transaction regarding "${productTitleForNotification}". Please wait for the mediator to accept the assignment.`;
        await Notification.create([{
            user: mediationRequest.buyer._id, // ID المشتري من الكائن populated
            type: 'MEDIATOR_SELECTED_BY_SELLER', // تأكد أن هذا النوع موجود في Notification enum
            title: 'Mediator Selected for Your Transaction',
            message: buyerNotificationMsg,
            relatedEntity: { id: updatedMediationRequestDoc._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Notification sent to buyer: ${mediationRequest.buyer._id}`);

        await session.commitTransaction();
        console.log("   sellerAssignSelectedMediator transaction committed successfully.");

        // 6. إرجاع طلب الوساطة المحدث مع populate شامل
        const finalResponseRequest = await MediationRequest.findById(updatedMediationRequestDoc._id)
            .populate('product', 'title status currentMediationRequest agreedPrice imageUrls currency') // إضافة حقول المنتج الهامة
            .populate('seller', 'fullName avatarUrl')
            .populate('buyer', 'fullName avatarUrl')
            .populate('mediator', 'fullName avatarUrl') // معلومات الوسيط المعين
            .lean();

        res.status(200).json({
            msg: `Mediator ${mediatorUser.fullName} has been assigned. They will be notified.`,
            mediationRequest: finalResponseRequest // إرجاع الطلب المحدث للواجهة الأمامية
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
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: sellerAssignSelectedMediator END --- Session ended.");
    }
};
// --- نهاية دالة sellerAssignSelectedMediator ---

// --- [!!!] دالة جديدة للوسيط لجلب مهامه المعلقة [!!!] ---
exports.getMediatorPendingAssignments = async (req, res) => {
    const mediatorId = req.user._id; // الوسيط الحالي
    const { page = 1, limit = 10 } = req.query; // للترقيم

    console.log(`--- Controller: getMediatorPendingAssignments for Mediator: ${mediatorId} ---`);

    try {
        // تحقق مما إذا كان المستخدم مؤهلاً ليكون وسيطًا (اختياري، لكن جيد)
        if (!req.user.isMediatorQualified) {
            return res.status(403).json({ msg: "Access denied. You are not a qualified mediator." });
        }

        const query = {
            mediator: mediatorId,
            status: 'MediatorAssigned' // فقط الطلبات التي تنتظر قرار الوسيط
        };

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { createdAt: -1 }, // الأحدث أولاً
            populate: [ // جلب البيانات المرتبطة
                { path: 'product', select: 'title imageUrls agreedPrice currency' }, // معلومات المنتج
                { path: 'seller', select: 'fullName avatarUrl' }, // معلومات البائع
                { path: 'buyer', select: 'fullName avatarUrl' }    // معلومات المشتري
            ],
            lean: true
        };

        const result = await MediationRequest.paginate(query, options);

        res.status(200).json({
            assignments: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalAssignments: result.totalDocs
        });

    } catch (error) {
        console.error("--- Controller: getMediatorPendingAssignments ERROR ---", error);
        res.status(500).json({ msg: "Server error while fetching mediator assignments.", errorDetails: error.message });
    } finally {
        console.log("--- Controller: getMediatorPendingAssignments END ---");
    }
};

// --- [!!!] دالة الوسيط لقبول مهمة الوساطة [!!!] ---
exports.mediatorAcceptAssignment = async (req, res) => {
    const mediationRequestFromMiddleware = req.mediationRequest;
    const mediatorId = req.user._id;

    console.log(`--- Controller: mediatorAcceptAssignment ---`);
    console.log(`   MediationRequestID: ${mediationRequestFromMiddleware._id}, MediatorID: ${mediatorId}`);

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for mediatorAcceptAssignment.");

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestFromMiddleware._id).session(session);
        if (!mediationRequest) throw new Error("Mediation request disappeared during transaction.");

        // 1. تحديث حالة طلب الوساطة
        mediationRequest.status = 'MediationOfferAccepted'; // الوسيط قبل، ننتظر تأكيد الأطراف

        mediationRequest.history.push({
            event: "Mediator accepted assignment",
            userId: mediatorId,
            timestamp: new Date()
        });
        await mediationRequest.save({ session });
        console.log(`   MediationRequest ${mediationRequest._id} status updated to '${mediationRequest.status}'.`);

        // --- [!!!] لا يتم تحديث User.mediatorStatus إلى 'Busy' هنا [!!!] ---
        // سيتم تحديثها لاحقًا عندما يؤكد الطرفان ويبدأ العمل الفعلي.

        // 2. إنشاء وإرسال الإشعارات
        // ... (كود الإشعارات يبقى كما هو من الرد السابق) ...
        const populatedRequest = await MediationRequest.findById(mediationRequest._id)
            .populate('product', 'title')
            .populate('seller', 'fullName')
            .populate('buyer', 'fullName')
            .populate('mediator', 'fullName')
            .lean() // استخدام lean هنا آمن لأننا لا نعدل الكائن بعد الآن
            .session(session);

        if (!populatedRequest) throw new Error("Failed to repopulate mediation request for notifications.");

        const productTitle = populatedRequest.product?.title || 'the product';
        const mediatorFullName = populatedRequest.mediator?.fullName || 'The Mediator';

        // --- [!!!] تفعيل إشعار الوسيط [!!!] ---
        const mediatorConfirmationMsg = `You have successfully accepted the mediation assignment for "${productTitle}". You will be notified when both parties are ready.`;
        await Notification.create([{
            user: mediatorId, // ID الوسيط الحالي
            type: 'MEDIATION_TASK_ACCEPTED_SELF', // تأكد من أن هذا النوع موجود في Notification enum
            title: 'Assignment Accepted',
            message: mediatorConfirmationMsg,
            relatedEntity: { id: populatedRequest._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Confirmation notification sent to mediator ${mediatorId} for accepting the task.`);

        // إشعار للبائع
        const sellerMessage = `${mediatorFullName} has accepted the assignment to mediate your transaction for "${productTitle}". Please proceed to confirm your readiness for mediation.`;
        await Notification.create([{
            user: populatedRequest.seller._id,
            type: 'MEDIATION_ACCEPTED_BY_MEDIATOR', // أو نوع مخصص مثل 'MEDIATOR_ACCEPTED_CONFIRM_READY'
            title: 'Mediator Accepted - Confirm Readiness',
            message: sellerMessage,
            relatedEntity: { id: populatedRequest._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Notification sent to seller ${populatedRequest.seller._id}`);

        // إشعار للمشتري
        const buyerMessage = `${mediatorFullName} has accepted the assignment to mediate your transaction for "${productTitle}". Please proceed to confirm your readiness for mediation.`;
        await Notification.create([{
            user: populatedRequest.buyer._id,
            type: 'MEDIATION_ACCEPTED_BY_MEDIATOR', // أو نوع مخصص مثل 'MEDIATOR_ACCEPTED_CONFIRM_READY'
            title: 'Mediator Accepted - Confirm Readiness',
            message: buyerMessage,
            relatedEntity: { id: populatedRequest._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Notification sent to buyer ${populatedRequest.buyer._id}`);


        await session.commitTransaction();
        console.log("   mediatorAcceptAssignment transaction committed.");

        res.status(200).json({
            msg: "Mediation assignment accepted successfully. Parties will be notified to confirm readiness.",
            mediationRequest: populatedRequest
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("--- Controller: mediatorAcceptAssignment ERROR ---", error);
        res.status(500).json({ msg: error.message || "Failed to accept mediation assignment." });
    } finally {
        if (session && session.endSession && typeof session.endSession === 'function') await session.endSession();
        console.log("--- Controller: mediatorAcceptAssignment END ---");
    }
};
// --- نهاية دالة mediatorAcceptAssignment ---

// --- [!!!] دالة الوسيط لرفض مهمة الوساطة - كاملة ومعدلة [!!!] ---
exports.mediatorRejectAssignment = async (req, res) => {
    const { mediationRequestId } = req.params; // استخدام ID من الـ params
    const mediatorId = req.user._id;
    const { reason } = req.body;

    console.log(`--- Controller: mediatorRejectAssignment ---`);
    console.log(`   MediationRequestID: ${mediationRequestId}, Rejecting MediatorID: ${mediatorId}, Reason: ${reason}`);

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
        // --- [!!!] جلب مستند Mongoose كامل داخل الجلسة [!!!] ---
        const mediationRequest = await MediationRequest.findById(mediationRequestId).session(session);
        // ----------------------------------------------------

        if (!mediationRequest) {
            throw new Error("Mediation request not found.");
        }

        if (!mediationRequest.mediator || !mediationRequest.mediator.equals(mediatorId)) {
            throw new Error("Forbidden: You are not the assigned mediator or no mediator is assigned.");
        }
        if (mediationRequest.status !== 'MediatorAssigned') {
            throw new Error(`Cannot reject assignment. Request status is '${mediationRequest.status}', expected 'MediatorAssigned'.`);
        }

        const originalMediatorId = mediationRequest.mediator;

        mediationRequest.status = 'PendingMediatorSelection';
        mediationRequest.mediator = null;

        if (originalMediatorId) {
            // تأكد أن الحقل موجود كـ array في الموديل (مع default: [] هو الأفضل)
            if (!Array.isArray(mediationRequest.previouslySuggestedMediators)) {
                mediationRequest.previouslySuggestedMediators = [];
            }
            mediationRequest.previouslySuggestedMediators.addToSet(originalMediatorId); // الآن يجب أن تعمل
            console.log(`   Added mediator ${originalMediatorId} to previouslySuggestedMediators for request ${mediationRequest._id}.`);
        }

        if (!Array.isArray(mediationRequest.history)) {
            mediationRequest.history = [];
        }
        mediationRequest.history.push({
            event: "Mediator rejected assignment",
            userId: mediatorId,
            details: { reason: reason, rejectedMediatorId: originalMediatorId?.toString() },
            timestamp: new Date()
        });

        const updatedRequestAfterRejection = await mediationRequest.save({ session });
        console.log(`   MediationRequest ${updatedRequestAfterRejection._id} status updated to '${updatedRequestAfterRejection.status}', mediator removed.`);

        if (originalMediatorId) {
            const otherActiveAssignments = await MediationRequest.countDocuments({
                mediator: originalMediatorId,
                status: { $in: ['MediatorAssigned', 'MediationOfferAccepted', 'InProgress'] }
            });
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

        // جلب البيانات بعد التحديثات للإشعارات
        const populatedRequestForNotifications = await MediationRequest.findById(updatedRequestAfterRejection._id)
            .populate('product', 'title')
            .populate('seller', 'fullName')
            .populate('buyer', 'fullName')
            .lean() // .lean() آمن هنا لأننا فقط نقرأ
            .session(session);

        if (!populatedRequestForNotifications) {
            throw new Error("Critical error: Failed to repopulate mediation request for notifications after rejection.");
        }

        const rejectingMediator = await User.findById(originalMediatorId).select('fullName').lean().session(session);
        const rejectingMediatorName = rejectingMediator?.fullName || 'The previously assigned mediator';
        const productTitle = populatedRequestForNotifications.product?.title || 'the product';

        // إشعار للبائع
        const sellerMessage = `${rejectingMediatorName} has rejected the mediation assignment for "${productTitle}". Reason: "${reason}". Please select a new mediator.`;
        await Notification.create([{
            user: populatedRequestForNotifications.seller._id,
            type: 'MEDIATION_REJECTED_BY_MEDIATOR_SELECT_NEW', // تأكد أن هذا النوع موجود في enum
            title: 'Mediator Rejected - Action Required',
            message: sellerMessage,
            relatedEntity: { id: populatedRequestForNotifications._id, modelName: 'MediationRequest' }
        }], { session, ordered: true }); // استخدام ordered: true مع مصفوفة
        console.log(`   Notification sent to seller ${populatedRequestForNotifications.seller._id} to select a new mediator.`);

        // إشعار للمشتري
        const buyerMessage = `The mediator assignment for your transaction regarding "${productTitle}" was rejected by ${rejectingMediatorName}. The seller will select a new mediator.`;
        await Notification.create([{
            user: populatedRequestForNotifications.buyer._id,
            type: 'MEDIATION_REJECTED_BY_MEDIATOR', // تأكد أن هذا النوع موجود في enum
            title: 'Mediator Assignment Rejected',
            message: buyerMessage,
            relatedEntity: { id: populatedRequestForNotifications._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Notification sent to buyer ${populatedRequestForNotifications.buyer._id}`);

        // (اختياري) إشعار للوسيط الرافض لتأكيد العملية
        const mediatorRejectionConfirmationMsg = `You have successfully rejected the mediation assignment for "${productTitle}". Reason: ${reason}.`;
        await Notification.create([{
            user: originalMediatorId,
            type: 'MEDIATION_TASK_REJECTED_SELF', // تأكد أن هذا النوع موجود في enum
            title: 'Assignment Rejection Confirmed',
            message: mediatorRejectionConfirmationMsg,
            relatedEntity: { id: populatedRequestForNotifications._id, modelName: 'MediationRequest' }
        }], { session, ordered: true });
        console.log(`   Rejection confirmation notification sent to mediator ${originalMediatorId}.`);


        await session.commitTransaction();
        console.log("   mediatorRejectAssignment transaction committed.");

        res.status(200).json({
            msg: "Mediation assignment rejected successfully. Seller has been notified to select a new mediator.",
            mediationRequest: populatedRequestForNotifications
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl mediatorRejectAssignment] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: mediatorRejectAssignment ERROR ---", error);
        // أرجع الخطأ الفعلي للواجهة الأمامية إذا كان خطأ 400 متوقعًا، أو 500 لخطأ خادم
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Cannot reject assignment") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || "Failed to reject mediation assignment." });
    } finally {
        if (session && session.endSession && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: mediatorRejectAssignment END ---");
    }
};

// --- [!!!] دالة جديدة للوسيط لجلب مهامه المقبولة وفي انتظار الأطراف [!!!] ---
exports.getMediatorAcceptedAwaitingParties = async (req, res) => {
    const mediatorId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    console.log(`--- Controller: getMediatorAcceptedAwaitingParties for Mediator: ${mediatorId} ---`);

    try {
        if (!req.user.isMediatorQualified) { // اختياري، لكن جيد
            return res.status(403).json({ msg: "Access denied. You are not a qualified mediator." });
        }

        const query = {
            mediator: mediatorId,
            status: 'MediationOfferAccepted' // الحالة التي نركز عليها
        };

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { updatedAt: -1 }, // يمكن الفرز حسب آخر تحديث
            populate: [
                { path: 'product', select: 'title imageUrls agreedPrice currency' },
                { path: 'seller', select: 'fullName avatarUrl' },
                { path: 'buyer', select: 'fullName avatarUrl' }
            ],
            lean: true
        };

        const result = await MediationRequest.paginate(query, options);

        res.status(200).json({
            assignments: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalAssignments: result.totalDocs
        });

    } catch (error) {
        console.error("--- Controller: getMediatorAcceptedAwaitingParties ERROR ---", error);
        res.status(500).json({ msg: "Server error while fetching accepted assignments.", errorDetails: error.message });
    } finally {
        console.log("--- Controller: getMediatorAcceptedAwaitingParties END ---");
    }
};

// --- [!!!] دالة جديدة للمشتري لجلب طلبات الوساطة الخاصة به [!!!] ---
exports.getBuyerMediationRequests = async (req, res) => {
    const buyerId = req.user._id; 
    const { page = 1, limit = 10, status: statusFilterFromQuery } = req.query; 

    console.log(`BACKEND CONSOLE - getBuyerMediationRequests - CALLED BY BUYER ID: ${buyerId}, Page: ${page}, Status Filter: ${statusFilterFromQuery}`); // <--- سجل 1

    try {
        const query = { buyer: buyerId };
        if (statusFilterFromQuery) {
            query.status = statusFilterFromQuery;
        } else {
            query.status = { $in: [
                'PendingMediatorSelection', 'MediatorAssigned', 'MediationOfferAccepted',
                'EscrowFunded', 'InProgress', 'PendingBuyerAction', 'PartiesConfirmed'
            ] };
        }
        console.log("BACKEND CONSOLE - getBuyerMediationRequests - MongoDB Query being executed:", JSON.stringify(query)); // <--- سجل 2

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { updatedAt: -1 },
            populate: [
                { path: 'product', select: 'title imageUrls agreedPrice currency user' },
                { path: 'seller', select: 'fullName avatarUrl' },
                { path: 'mediator', select: 'fullName avatarUrl' }
            ],
            lean: true
        };

        const result = await MediationRequest.paginate(query, options);

        // --- [!!!] سطر آخر للطباعة هنا [!!!] ---
        console.log(`BACKEND CONSOLE - getBuyerMediationRequests - Found ${result.totalDocs} requests matching query.`); // <--- سجل 3
        if (result.totalDocs > 0) {
            console.log("BACKEND CONSOLE - getBuyerMediationRequests - First request found (from result.docs[0]):", JSON.stringify(result.docs[0], null, 2)); // <--- سجل 4
        }
        
        res.status(200).json({
            requests: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalRequests: result.totalDocs
        });

    } catch (error) {
        console.error("--- Controller: getBuyerMediationRequests ERROR ---", error);
        res.status(500).json({ msg: "Server error while fetching buyer's mediation requests.", errorDetails: error.message });
    } finally {
        console.log("--- Controller: getBuyerMediationRequests END ---");
    }
};

// --- [!!!] دالة البائع لتأكيد الاستعداد - كاملة ومعدلة [!!!] ---
exports.sellerConfirmReadiness = async (req, res) => {
    const { mediationRequestId } = req.params;
    const sellerId = req.user._id;

    console.log(`--- Controller: sellerConfirmReadiness for MediationRequest: ${mediationRequestId} by Seller: ${sellerId} ---`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for sellerConfirmReadiness.");

    try {
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title _id')
            .populate('buyer', '_id fullName')
            .populate('mediator', '_id fullName') // نحتاج الوسيط للإشعار
            .session(session);

        if (!mediationRequest) throw new Error("Mediation request not found.");
        if (!mediationRequest.seller.equals(sellerId)) throw new Error("Forbidden: You are not the seller for this request.");
        
        // اسمح بالتأكيد فقط إذا كانت الحالة مناسبة ولم يؤكد البائع بعد
        if (mediationRequest.status !== 'MediationOfferAccepted') {
            if(mediationRequest.sellerConfirmedStart && (mediationRequest.status === 'EscrowFunded' || mediationRequest.status === 'InProgress')){
                 // إذا كان قد أكد بالفعل والعملية متقدمة، لا تفعل شيئًا أو أرجع رسالة
                 // هذا الشرط قد لا يكون ضروريًا إذا كانت الواجهة تمنع الزر
            } else if (mediationRequest.sellerConfirmedStart) {
                 throw new Error("You have already confirmed your readiness.");
            } else {
                throw new Error(`Action not allowed. Request status is '${mediationRequest.status}', expected 'MediationOfferAccepted'.`);
            }
        }
        
        console.log("   Seller and request status validations passed for seller confirmation.");

        mediationRequest.sellerConfirmedStart = true;
        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({ event: "Seller confirmed readiness", userId: sellerId, timestamp: new Date() });
        console.log(`   Seller ${sellerId} confirmed readiness for request ${mediationRequest._id}.`);

        let mediationStarted = false;
        let sellerConfirmedMsg = "Your readiness has been confirmed. Waiting for the buyer.";


        if (mediationRequest.buyerConfirmedStart && mediationRequest.status === 'EscrowFunded') { // يجب أن تكون الحالة EscrowFunded هنا
            console.log("   Buyer has also confirmed and funds are escrowed. Initiating mediation...");
            mediationRequest.status = 'InProgress';
            mediationStarted = true;
            sellerConfirmedMsg = "Readiness confirmed. Mediation process has started!";

            if (mediationRequest.product && mediationRequest.product._id) {
                await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'InProgress' } }, { session });
                console.log(`   Product ${mediationRequest.product._id} status updated to 'InProgress'.`);
            }
            if (mediationRequest.mediator && mediationRequest.mediator._id) {
                await User.findByIdAndUpdate(mediationRequest.mediator._id, { $set: { mediatorStatus: 'Busy' } }, { session });
                console.log(`   Mediator ${mediationRequest.mediator._id} status updated to 'Busy'.`);
            }
            
            const productTitle = mediationRequest.product?.title || 'the transaction';
            const mediatorName = mediationRequest.mediator?.fullName || 'The Mediator';
            const commonMessage = `All parties have confirmed for "${productTitle}". The mediation process has now started with ${mediatorName}. You can now access the chat (feature coming soon).`;
            const notificationTypeStart = 'MEDIATION_STARTED';

            await Notification.create([
                { user: mediationRequest.seller, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} },
                { user: mediationRequest.buyer._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} },
                { user: mediationRequest.mediator._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} }
            ], { session, ordered: true });
            console.log(`   Mediation started notifications sent to all parties for request ${mediationRequest._id}.`);

        } else if (mediationRequest.buyerConfirmedStart) {
            // هذا السيناريو يعني أن المشتري أكد، لكن لسبب ما حالة الطلب ليست 'EscrowFunded' (ربما خطأ سابق أو تدفق مختلف)
            console.log(`   Seller confirmed. Buyer also confirmed, but request status is '${mediationRequest.status}'. Waiting for escrow or next step by system.`);
            const buyerNotificationMsg = `The seller for "${mediationRequest.product?.title || 'the transaction'}" has also confirmed readiness. The mediation process is pending finalization.`;
            await Notification.create([{
                user: mediationRequest.buyer._id, type: 'SELLER_CONFIRMED_AWAITING_FINALIZATION', title: 'Seller Confirmed - Mediation Pending',
                message: buyerNotificationMsg, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }], { session, ordered: true });
            if (mediationRequest.mediator && mediationRequest.mediator._id){ // إعلام الوسيط إذا كان المشتري قد أكد بالفعل
                 const mediatorNotificationMsg = `Seller (${req.user.fullName}) has confirmed readiness for "${mediationRequest.product?.title}". Buyer has also previously confirmed. Mediation is pending system finalization.`;
                 await Notification.create([{ user: mediationRequest.mediator._id, type: 'BOTH_PARTIES_CONFIRMED_PENDING_START', title: 'Parties Confirmed - Awaiting Start', message: mediatorNotificationMsg, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} }], { session, ordered: true });
            }
        } else {
            // البائع أكد، المشتري لم يؤكد بعد
            console.log(`   Seller confirmed readiness. Waiting for buyer's confirmation and fund escrow.`);
            const buyerAwaitingNotificationMsg = `The seller for "${mediationRequest.product?.title || 'the transaction'}" has confirmed their readiness to proceed with mediation. Please confirm your readiness and ensure funds are available.`;
            await Notification.create([{
                user: mediationRequest.buyer._id, type: 'SELLER_CONFIRMED_AWAITING_YOUR_ACTION', title: 'Action Required: Seller Confirmed Readiness',
                message: buyerAwaitingNotificationMsg, relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }], { session, ordered: true });
            console.log(`   Notification sent to buyer ${mediationRequest.buyer._id} to confirm readiness.`);

            // --- [!!!] إرسال إشعار للوسيط بأن البائع قد أكد [!!!] ---
            if (mediationRequest.mediator && mediationRequest.mediator._id) {
                const mediatorNotificationMsg = `Seller (${req.user.fullName || 'The Seller'}) has confirmed readiness for the mediation regarding "${mediationRequest.product?.title || 'the transaction'}". Waiting for buyer's confirmation and fund escrow.`;
                await Notification.create([{
                    user: mediationRequest.mediator._id,
                    type: 'PARTY_CONFIRMED_READINESS', // تأكد أن هذا النوع موجود في Notification enum
                    title: 'Seller Confirmed Readiness',
                    message: mediatorNotificationMsg,
                    relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
                }], { session, ordered: true });
                console.log(`   Notification sent to mediator ${mediationRequest.mediator._id} about seller confirmation.`);
            }
            // ---------------------------------------------------------
        }

        await mediationRequest.save({ session });
        await session.commitTransaction();
        console.log("   sellerConfirmReadiness transaction committed.");

        const finalResponseRequest = await MediationRequest.findById(mediationRequest._id)
            .populate('product', 'title status currentMediationRequest agreedPrice imageUrls currency user') // أضفت user هنا
            .populate('seller', 'fullName avatarUrl')
            .populate('buyer', 'fullName avatarUrl')
            .populate('mediator', 'fullName avatarUrl')
            .populate('history.userId', 'fullName')
            .lean();

        res.status(200).json({ 
            msg: sellerConfirmedMsg, 
            mediationRequest: finalResponseRequest
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("--- Controller: sellerConfirmReadiness ERROR ---", error);
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Action not allowed") || error.message.includes("already confirmed") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || "Failed to confirm seller readiness." });
    } finally {
        if (session && session.endSession && typeof session.endSession === 'function') await session.endSession();
        console.log("--- Controller: sellerConfirmReadiness END ---");
    }
};
// --- نهاية sellerConfirmReadiness ---

// --- [!!!] دالة المشتري لتأكيد الاستعداد وتجميد الرصيد - كاملة ومعدلة [!!!] ---
exports.buyerConfirmReadinessAndEscrow = async (req, res) => {
    const { mediationRequestId } = req.params;
    const buyerId = req.user._id; // المستخدم الحالي (المشتري)

    console.log(`--- Controller: buyerConfirmReadinessAndEscrow for MediationRequest: ${mediationRequestId} by Buyer: ${buyerId} ---`);

    if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
        return res.status(400).json({ msg: "Invalid Mediation Request ID." });
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for buyerConfirmReadinessAndEscrow.");

    try {
        // جلب طلب الوساطة والمستخدم (المشتري) داخل الجلسة
        const mediationRequest = await MediationRequest.findById(mediationRequestId)
            .populate('product', 'title currency _id') // نحتاج العملة لتمريرها لحساب الرسوم ومعرف المنتج لتحديث حالته
            .populate('seller', '_id fullName')
            .populate('mediator', '_id fullName')
            .session(session);
            
        const buyerUser = await User.findById(buyerId).session(session); // جلب كائن المستخدم المشتري بالكامل

        if (!mediationRequest) {
            throw new Error("Mediation request not found.");
        }
        if (!buyerUser) {
            // هذا لا يجب أن يحدث إذا كان req.user._id صالحًا
            throw new Error("Buyer user (authenticated user) not found for escrow operation.");
        }

        // التحقق من أن المستخدم الحالي هو المشتري في هذا الطلب
        if (!mediationRequest.buyer.equals(buyerId)) {
            throw new Error("Forbidden: You are not the buyer for this request.");
        }

        // التحقق من حالة طلب الوساطة
        if (mediationRequest.status === 'EscrowFunded' || mediationRequest.status === 'InProgress' || mediationRequest.status === 'Completed') {
            if (mediationRequest.buyerConfirmedStart) { // إذا كان قد أكد بالفعل
                throw new Error("You have already confirmed and funds are escrowed or mediation is in progress/completed.");
            }
        } else if (mediationRequest.status !== 'MediationOfferAccepted') {
            throw new Error(`Action not allowed. Request status is '${mediationRequest.status}', expected 'MediationOfferAccepted'.`);
        }
        console.log("   Buyer and request status validations passed.");

        // 1. حساب المبلغ المطلوب تجميده باستخدام دالة الـ backend
        const requestCurrency = mediationRequest.bidCurrency || mediationRequest.product?.currency || 'TND';
        const feeDetails = calculateMediatorFeeDetails(mediationRequest.bidAmount, requestCurrency);

        if (feeDetails.error) {
            console.error("   Fee calculation error:", feeDetails.error);
            throw new Error(`Fee calculation error: ${feeDetails.error}`);
        }

        // totalForBuyerAfterFee هو المبلغ الإجمالي الذي يجب على المشتري دفعه (بعملة الطلب الأصلية)
        const amountToEscrowInRequestCurrency = feeDetails.totalForBuyerAfterFee; 
        console.log(`   Original agreed price: ${mediationRequest.bidAmount} ${requestCurrency}`);
        console.log(`   Calculated fee for mediator (in ${requestCurrency}): ${feeDetails.fee}`);
        console.log(`   Buyer's share of fee (in ${requestCurrency}): ${feeDetails.buyerShare}`);
        console.log(`   Total amount for buyer to escrow (in ${requestCurrency}): ${amountToEscrowInRequestCurrency}`);

        // 2. التحقق من رصيد المشتري وتحويل العملة إذا لزم الأمر
        // نفترض أن buyerUser.balance دائمًا بالعملة الأساسية للمنصة (مثلاً TND)
        const platformBaseCurrency = 'TND'; // العملة الأساسية لرصيد المستخدمين
        let amountToDeductFromBalance = amountToEscrowInRequestCurrency;

        if (requestCurrency !== platformBaseCurrency) {
            if (requestCurrency === 'USD' && platformBaseCurrency === 'TND') {
                amountToDeductFromBalance = amountToEscrowInRequestCurrency * TND_USD_EXCHANGE_RATE;
                console.log(`   Converted escrow amount to platform base currency (TND): ${amountToDeductFromBalance.toFixed(3)} TND`);
            } else if (requestCurrency === 'TND' && platformBaseCurrency === 'USD') {
                // حالة عكسية إذا كان الرصيد بالدولار والطلب بالدينار
                amountToDeductFromBalance = amountToEscrowInRequestCurrency / TND_USD_EXCHANGE_RATE;
                 console.log(`   Converted escrow amount to platform base currency (USD): ${amountToDeductFromBalance.toFixed(3)} USD`);
            } else {
                // حالة عملات أخرى غير مدعومة أو نفس العملة
                console.warn(`   Currency conversion for escrow: Request is ${requestCurrency}, user balance is assumed ${platformBaseCurrency}. No direct conversion rule or same currency.`);
                // إذا كانت العملات مختلفة ولا يوجد سعر صرف، يجب رمي خطأ
                if(requestCurrency !== platformBaseCurrency) {
                    throw new Error(`Currency mismatch for escrow: Request is ${requestCurrency}, platform base currency is ${platformBaseCurrency}. Conversion rule needed.`);
                }
            }
        }
        amountToDeductFromBalance = parseFloat(amountToDeductFromBalance.toFixed(3)); // تقريب لـ 3 أرقام عشرية

        if (buyerUser.balance < amountToDeductFromBalance) {
            throw new Error(`Insufficient balance. Required: ${formatCurrency(amountToDeductFromBalance, platformBaseCurrency)}, Available: ${formatCurrency(buyerUser.balance, platformBaseCurrency)}`);
        }

        // 3. خصم المبلغ من رصيد المشتري وتحديث طلب الوساطة
        buyerUser.balance = parseFloat((buyerUser.balance - amountToDeductFromBalance).toFixed(3));
        await buyerUser.save({ session });
        console.log(`   Buyer ${buyerId} balance updated. New balance: ${buyerUser.balance} ${platformBaseCurrency}`);

        mediationRequest.escrowedAmount = amountToEscrowInRequestCurrency; // المبلغ الأصلي بالعملة الأصلية للطلب
        mediationRequest.escrowedCurrency = requestCurrency;
        mediationRequest.calculatedMediatorFee = feeDetails.fee; // العمولة الإجمالية بعملة الطلب
        mediationRequest.calculatedBuyerFeeShare = feeDetails.buyerShare; // حصة المشتري بعملة الطلب
        mediationRequest.calculatedSellerFeeShare = feeDetails.sellerShare; // حصة البائع بعملة الطلب
        mediationRequest.mediationFeeCurrency = feeDetails.currencyUsed; // تأكيد عملة حساب الرسوم
        
        mediationRequest.buyerConfirmedStart = true;
        mediationRequest.status = 'EscrowFunded'; // تم تجميد الرصيد بنجاح
        
        if (!Array.isArray(mediationRequest.history)) mediationRequest.history = [];
        mediationRequest.history.push({ 
            event: "Buyer confirmed readiness and funds escrowed", 
            userId: buyerId, 
            details: { amount: amountToEscrowInRequestCurrency, currency: requestCurrency },
            timestamp: new Date() 
        });
        console.log(`   MediationRequest ${mediationRequest._id} updated. Status: 'EscrowFunded', Escrowed: ${amountToEscrowInRequestCurrency} ${requestCurrency}.`);
        
        let mediationStarted = false;

        // تحقق مما إذا كان البائع قد أكد أيضًا
        if (mediationRequest.sellerConfirmedStart) {
            console.log("   Seller has also confirmed. Initiating mediation...");
            mediationRequest.status = 'InProgress';
            mediationStarted = true;

            if (mediationRequest.product && mediationRequest.product._id) {
                await Product.findByIdAndUpdate(mediationRequest.product._id, { $set: { status: 'InProgress' } }, { session });
                console.log(`   Product ${mediationRequest.product._id} status updated to 'InProgress'.`);
            }
            if (mediationRequest.mediator && mediationRequest.mediator._id) {
                await User.findByIdAndUpdate(mediationRequest.mediator._id, { $set: { mediatorStatus: 'Busy' } }, { session });
                console.log(`   Mediator ${mediationRequest.mediator._id} status updated to 'Busy'.`);
            }
            
            const productTitle = mediationRequest.product?.title || 'the transaction';
            const mediatorName = mediationRequest.mediator?.fullName || 'The Mediator';
            const commonMessage = `All parties have confirmed for "${productTitle}". The mediation process has now started with ${mediatorName}. You can now access the chat (feature coming soon).`;
            const notificationTypeStart = 'MEDIATION_STARTED'; // تأكد أن هذا النوع موجود في Notification enum

            await Notification.create([
                { user: mediationRequest.seller._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} },
                { user: mediationRequest.buyer._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} },
                { user: mediationRequest.mediator._id, type: notificationTypeStart, title: "Mediation Started!", message: commonMessage, relatedEntity: {id: mediationRequest._id, modelName: 'MediationRequest'} }
            ], { session, ordered: true });
            console.log(`   Mediation started notifications sent for request ${mediationRequest._id}.`);
        } else {
            console.log(`   Buyer confirmed and escrowed. Waiting for seller confirmation.`);
            const sellerAwaitingNotificationMsg = `The buyer for "${mediationRequest.product?.title || 'the transaction'}" has confirmed readiness and deposited funds into escrow. Please confirm your readiness to start the mediation.`;
            await Notification.create([{
                user: mediationRequest.seller._id,
                type: 'BUYER_CONFIRMED_AWAITING_YOUR_ACTION', // تأكد أن هذا النوع موجود
                title: 'Action Required: Buyer Confirmed & Escrowed',
                message: sellerAwaitingNotificationMsg,
                relatedEntity: { id: mediationRequest._id, modelName: 'MediationRequest' }
            }], { session, ordered: true });
            console.log(`   Notification sent to seller ${mediationRequest.seller._id} to confirm readiness.`);
        }

        await mediationRequest.save({ session });
        await session.commitTransaction();
        console.log("   buyerConfirmReadinessAndEscrow transaction committed successfully.");

        const finalResponseRequest = await MediationRequest.findById(mediationRequest._id)
            .populate('product', 'title status currentMediationRequest agreedPrice imageUrls currency user')
            .populate('seller', 'fullName avatarUrl')
            .populate('buyer', 'fullName avatarUrl')
            .populate('mediator', 'fullName avatarUrl')
            .populate('history.userId', 'fullName')
            .lean();

        res.status(200).json({ 
            msg: mediationStarted ? "Readiness confirmed and funds escrowed. Mediation process has started!" : "Your readiness has been confirmed and funds are now in escrow. Waiting for the seller.", 
            mediationRequest: finalResponseRequest,
            updatedBuyerBalance: buyerUser.balance // إرجاع الرصيد المحدث للمشتري
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl buyerConfirmReadinessAndEscrow] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: buyerConfirmReadinessAndEscrow ERROR ---", error);
        const statusCode = error.message.includes("Forbidden") || error.message.includes("not found") || error.message.includes("Action not allowed") || error.message.includes("Insufficient balance") ? 400 : 500;
        res.status(statusCode).json({ msg: error.message || "Failed to confirm buyer readiness or escrow funds." });
    } finally {
        if (session && session.endSession && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: buyerConfirmReadinessAndEscrow END --- Session ended.");
    }
};
// --- نهاية buyerConfirmReadinessAndEscrow ---