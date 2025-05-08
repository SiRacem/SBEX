// server/controllers/mediation.controller.js
// *** نسخة معدلة لاستخدام isMediatorQualified ***

const MediationRequest = require('../models/MediationRequest');
const User = require('../models/User'); // تأكد من أن موديل User يحتوي على isMediatorQualified
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// دالة تنسيق العملة
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    try { return num.toLocaleString("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch (error) { return `${num.toFixed(2)} ${currencyCode}`; }
};

/**
 * [Admin] جلب طلبات الوساطة التي تنتظر تعيين وسيط
 */
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

        // تأكد من أن mongoose-paginate-v2 مضاف لـ MediationRequest Schema
        const result = await MediationRequest.paginate(
            { status: 'PendingAssignment' },
            options
        );

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


/**
 * [Admin] تعيين وسيط لطلب وساطة محدد (مُعدَّل للتحقق من isMediatorQualified)
 */
exports.adminAssignMediator = async (req, res) => {
    const { requestId } = req.params;
    const { mediatorId } = req.body;
    const adminUserId = req.user._id;

    console.log(`[MediationCtrl - AssignMediator V2] Admin ${adminUserId} assigning Mediator ${mediatorId} to Request ${requestId}`);

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(mediatorId)) {
        return res.status(400).json({ msg: "Invalid Request ID or Mediator ID format." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[MediationCtrl - AssignMediator V2] Transaction started.");

    try {
        // 1. التحقق من أن المستخدم المحدد وسيط مؤهل ونشط (لا تغيير هنا، الكود صحيح)
        console.log(`   Checking if user ${mediatorId} is a qualified mediator...`);
        const mediatorUser = await User.findOne({
            _id: mediatorId,
            isMediatorQualified: true, // <-- تحقق من هذا
            blocked: false             // <-- وتحقق من هذا
        }).session(session);
        if (!mediatorUser) { throw new Error(`Selected user (ID: ${mediatorId}) is not a qualified or active mediator.`); }
        console.log(`   User ${mediatorId} is a qualified mediator.`);
        // -----------------------------------------------------------------

        // 2. تحديث طلب الوساطة (يبقى كما هو)
        console.log(`   Updating MediationRequest ${requestId}...`);
        const updatedMediationRequest = await MediationRequest.findOneAndUpdate(
            { _id: requestId, status: 'PendingAssignment' },
            { $set: { mediator: mediatorId, status: 'MediatorAssigned' } },
            { new: true, runValidators: true, session: session }
        ).populate('product seller buyer'); // جلب البيانات للإشعارات

        if (!updatedMediationRequest) {
            const existingRequest = await MediationRequest.findById(requestId).session(session);
            if (!existingRequest) throw new Error(`Mediation request with ID ${requestId} not found.`);
            else throw new Error(`Mediation request is already in status "${existingRequest.status}". Cannot assign mediator.`);
        }
        console.log(`   Request ${requestId} status updated to MediatorAssigned. Mediator: ${mediatorId}`);

        // 3. إرسال إشعار للوسيط المعين (يبقى كما هو)
        console.log(`   Creating notification for assigned mediator ${mediatorId}...`);
        const productTitle = updatedMediationRequest.product?.title || 'N/A';
        const bidAmountFormatted = formatCurrency(updatedMediationRequest.bidAmount, updatedMediationRequest.bidCurrency);
        const mediatorMessage = `You have been assigned as a mediator for the transaction regarding product "${productTitle}" (Price: ${bidAmountFormatted}). Please review and accept or reject the task.`;

        await Notification.create([{
            user: mediatorId,
            type: 'MEDIATION_ASSIGNED',
            title: 'New Mediation Assignment',
            message: mediatorMessage,
            relatedEntity: { id: updatedMediationRequest._id, modelName: 'MediationRequest' }
        }], { session });
        console.log(`   Notification created for assigned mediator ${mediatorId}.`);

        // إرسال Socket.IO للوسيط
        const mediatorSocketId = req.onlineUsers?.[mediatorId.toString()]; // استخدام Optional Chaining
        if (mediatorSocketId) {
            req.io.to(mediatorSocketId).emit('mediation_assigned', { requestId: updatedMediationRequest._id, message: mediatorMessage });
            console.log(`   Sent real-time notification to mediator ${mediatorId} via socket ${mediatorSocketId}`);
        } else {
            console.log(`   Mediator ${mediatorId} not online for socket notification.`);
        }

        // 4. إتمام المعاملة
        await session.commitTransaction();
        console.log(`   Transaction committed for request ${requestId}.`);

        res.status(200).json({ msg: 'Mediator assigned successfully.', mediationRequest: updatedMediationRequest });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[MediationCtrl - AssignMediator V2] Transaction aborted due to error:", error.message);
        }
        console.error("[MediationCtrl - AssignMediator V2] Error assigning mediator:", error);
        res.status(400).json({ msg: error.message || 'Failed to assign mediator.' });
    } finally {
        // التأكد من وجود الدالة قبل استدعائها
        if (session && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("[MediationCtrl - AssignMediator V2] Session ended.");
    }
};
// ----------------------------------------------------------

// --- دوال أخرى للوساطة سيتم إضافتها لاحقًا ---
// exports.mediatorAcceptTask = async (req, res) => { ... };
// exports.mediatorRejectTask = async (req, res) => { ... };
// ...