const MediationRequest = require('../models/MediationRequest'); // استيراد موديل طلب الوساطة
const mongoose = require('mongoose'); // قد تحتاجه للتحقق من ObjectId

exports.isAdmin = (req, res, next) => {
    // يفترض أن verifyAuth قد أضاف req.user
    if (req.user && req.user.userRole === 'Admin') {
        console.log(`Role check: User ${req.user._id} is Admin. Proceeding.`);
        next(); // المستخدم أدمن، اسمح بالمرور
    } else {
        console.warn(`Role check failed: User ${req.user?._id} Role: ${req.user?.userRole}. Access denied.`);
        res.status(403).json({ msg: 'Forbidden: Access restricted to Administrators.' });
    }
};

// --- [!!!] MIDDLEWARE جديد للتحقق مما إذا كان المستخدم هو الوسيط المعين [!!!] ---
exports.isAssignedMediator = async (req, res, next) => {
    try {
        const { mediationRequestId } = req.params;
        const userId = req.user._id; // المستخدم الحالي من verifyAuth

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID format." });
        }

        const mediationRequest = await MediationRequest.findById(mediationRequestId).select('mediator status');

        if (!mediationRequest) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        // تحقق مما إذا كان هناك وسيط معين أصلاً
        if (!mediationRequest.mediator) {
            return res.status(403).json({ msg: "Access denied. No mediator assigned to this request yet." });
        }

        // تحقق مما إذا كان المستخدم الحالي هو الوسيط المعين
        if (!mediationRequest.mediator.equals(userId)) {
            return res.status(403).json({ msg: "Access denied. You are not the assigned mediator for this request." });
        }

        // (اختياري) يمكنك أيضًا التحقق من حالة طلب الوساطة هنا
        // إذا كنت تريد السماح بقبول/رفض المهمة فقط إذا كانت الحالة 'MediatorAssigned'
        if (mediationRequest.status !== 'MediatorAssigned') {
            return res.status(400).json({ msg: `Action cannot be performed. Request status is '${mediationRequest.status}', not 'MediatorAssigned'.` });
        }


        // إذا تم تمرير كل التحققات، قم بتمرير الطلب إلى الـ controller
        req.mediationRequest = mediationRequest; // يمكن تمرير الطلب لتجنب جلبه مرة أخرى في الـ controller
        next();

    } catch (error) {
        console.error("Error in isAssignedMediator middleware:", error);
        res.status(500).json({ msg: "Server error during mediator authorization." });
    }
};

exports.canAccessAdminSubChat = async (req, res, next) => {
    try {
        const { mediationRequestId, subChatId } = req.params;
        const userId = req.user._id;
        const userRole = req.user.userRole; // افترض أن verifyAuth يضيف req.user مع userRole

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId) || !mongoose.Types.ObjectId.isValid(subChatId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID or Sub-Chat ID format." });
        }

        const mediationRequest = await MediationRequest.findOne({
            _id: mediationRequestId,
            'adminSubChats.subChatId': subChatId
        }).select('adminSubChats.$ status seller buyer mediator'); // جلب الشات الفرعي المحدد فقط

        if (!mediationRequest) {
            return res.status(404).json({ msg: "Mediation request or sub-chat not found." });
        }

        const subChat = mediationRequest.adminSubChats[0]; // بما أننا فلترنا بـ subChatId، ستكون هي الأولى

        if (!subChat) { // احتياطي إضافي
            return res.status(404).json({ msg: "Sub-chat instance not found within the mediation request." });
        }

        // الأدمن الذي أنشأ الشات يمكنه الوصول دائمًا
        // أو أي أدمن آخر إذا كانت سياسة المنصة تسمح بذلك (يمكن تعديل هذا الشرط)
        const isAdminAllowed = userRole === 'Admin'; // حاليًا، أي أدمن يمكنه الوصول

        // المستخدم العادي يجب أن يكون مشاركًا في الشات الفرعي
        const isParticipant = subChat.participants.some(p => p.userId.equals(userId));

        if (!isAdminAllowed && !isParticipant) {
            return res.status(403).json({ msg: "Forbidden: You are not authorized to access this private admin chat." });
        }

        req.mediationRequest = mediationRequest; // الطلب الرئيسي (مفيد إذا احتجت سياقه)
        req.adminSubChat = subChat; // الشات الفرعي المحدد (لتجنب جلبه مرة أخرى في الـ controller)
        next();

    } catch (error) {
        console.error("Error in canAccessAdminSubChat middleware:", error);
        res.status(500).json({ msg: "Server error during sub-chat authorization." });
    }
};