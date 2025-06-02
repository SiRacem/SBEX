const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const multer = require("multer"); // ستحتاجه إذا أردت إرفاق ملفات في الشات الفرعي
const path = require("path");
const fs = require("fs");

// استيراد middleware و controllers
const { isAdmin, isAssignedMediator, canAccessAdminSubChat } = require('../middlewares/roleCheck'); // أضف canAccessAdminSubChat
const {
    // ... (جميع الـ controllers الموجودة لديك) ...
    adminGetPendingAssignmentRequests,
    adminAssignMediator,
    getAvailableRandomMediators,
    sellerAssignSelectedMediator,
    mediatorAcceptAssignment,
    mediatorRejectAssignment,
    getMediatorPendingAssignments,
    getMediatorAcceptedAwaitingParties,
    sellerConfirmReadiness,
    buyerConfirmReadinessAndEscrow,
    getBuyerMediationRequests,
    buyerRejectMediation,
    getMediationChatHistory,
    getMediationRequestDetailsController,
    uploadChatImage, // <--- تأكد من أن هذا هو الـ controller وليس الـ middleware مباشرة
    handleChatImageUpload, // أو إذا كان اسم الدالة هكذا
    getMyMediationSummariesController,
    buyerConfirmReceiptController,
    openDisputeController,
    getMediatorDisputedCasesController,
    adminGetDisputedCasesController,
    adminResolveDisputeController,

    // --- [!!!] Controllers جديدة للشات الفرعي [!!!] ---
    adminCreateSubChatController,
    adminSendSubChatMessageController,
    adminGetSubChatMessagesController,
    adminGetAllSubChatsForDisputeController, // لجلب قائمة الشاتات الفرعية للأدمن
    adminMarkSubChatMessagesReadController // لقراءة الرسائل

} = require('../controllers/mediation.controller');
const isQualifiedMediator = require('../middlewares/isQualifiedMediator');
const { isSellerOfMediation, isBuyerOfMediation } = require('../middlewares/mediationPartyCheck');
// --- مسارات الأدمن ---

// GET /mediation/admin/pending-assignment - جلب الطلبات التي تنتظر تعيين وسيط
router.get('/admin/pending-assignment', verifyAuth, isAdmin, adminGetPendingAssignmentRequests);

// PUT /mediation/admin/assign/:requestId - تعيين وسيط لطلب محدد
router.put('/admin/assign/:requestId', verifyAuth, isAdmin, adminAssignMediator);

router.get(
    '/available-random/:mediationRequestId', verifyAuth, getAvailableRandomMediators // الدالة الجديدة في الـ controller
);

// --- [!!!] ROUTE جديد للبائع لتعيين الوسيط المختار [!!!] ---
router.put(
    '/assign-selected/:mediationRequestId',
    verifyAuth, // يجب أن يكون البائع مسجلاً للدخول
    sellerAssignSelectedMediator // <--- دالة جديدة في الـ controller
);

// --- [!!!] ROUTE جديد للوسيط لجلب مهامه المعلقة [!!!] ---
router.get(
    '/mediator/my-assignments', // أو اسم آخر مثل /mediator/pending-tasks
    verifyAuth, // يجب أن يكون الوسيط مسجلاً
    // يمكنك إضافة middleware للتحقق من أنه isMediatorQualified إذا أردت
    getMediatorPendingAssignments // دالة جديدة في الـ controller
);

// --- [!!!] ROUTES جديدة للوسيط [!!!] ---
router.put(
    '/mediator/accept/:mediationRequestId',
    verifyAuth, // يجب أن يكون الوسيط مسجلاً
    isAssignedMediator, // Middleware للتحقق من أنه الوسيط المعين لهذا الطلب
    mediatorAcceptAssignment // دالة جديدة في الـ controller
);

router.put(
    '/mediator/reject/:mediationRequestId',
    verifyAuth,
    isAssignedMediator,
    mediatorRejectAssignment // دالة جديدة في الـ controller
);

// --- [!!!] ROUTE جديد للوسيط لجلب مهامه التي قبلها وتنتظر الأطراف [!!!] ---
router.get(
    '/mediator/accepted-awaiting-parties',
    verifyAuth,
    // isMediatorQualified (اختياري)
    getMediatorAcceptedAwaitingParties // دالة جديدة في الـ controller
);

// --- [!!!] ROUTES جديدة لتأكيد استعداد الأطراف [!!!] ---
// البائع يؤكد استعداده
router.put(
    '/seller/confirm-readiness/:mediationRequestId',
    verifyAuth,
    isSellerOfMediation, // Middleware للتحقق من أن المستخدم هو بائع هذا الطلب
    sellerConfirmReadiness // دالة جديدة في الـ controller
);

// المشتري يؤكد استعداده ويقوم بتجميد الرصيد
router.put(
    '/buyer/confirm-readiness-and-escrow/:mediationRequestId',
    verifyAuth,
    isBuyerOfMediation, // Middleware للتحقق من أن المستخدم هو مشتري هذا الطلب
    buyerConfirmReadinessAndEscrow // دالة جديدة في الـ controller
);

// --- [!!!] ROUTE جديد للمشتري لجلب طلبات الوساطة الخاصة به [!!!] ---
router.get(
    '/buyer/my-requests', // أو اسم آخر مثل /buyer/active-mediations
    verifyAuth, // يجب أن يكون المشتري مسجلاً
    getBuyerMediationRequests // دالة جديدة في الـ controller
);

// --- [!!!] ROUTE جديد لرفض المشتري للوساطة [!!!] ---
router.put(
    '/buyer/reject-mediation/:mediationRequestId',
    verifyAuth,
    isBuyerOfMediation, // Middleware للتحقق من أن المستخدم هو مشتري هذا الطلب
    buyerRejectMediation // دالة جديدة في الـ controller
);

router.get('/request-details/:mediationRequestId', verifyAuth, getMediationRequestDetailsController);

// --- [!!!] ROUTE جديد لجلب سجل محادثة الوساطة [!!!] ---
router.get(
    '/chat/:mediationRequestId/history',
    verifyAuth,
    // يمكنك إضافة middleware للتحقق من أن المستخدم طرف في هذه الوساطة
    getMediationChatHistory // دالة جديدة
);

// --- [!!! NEW ROUTE FOR UPLOADING CHAT IMAGES !!!] ---
// إنشاء المجلد إن لم يكن موجودًا
const uploadDir = path.join(__dirname, "..", "uploads", "chat_images");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueName + ext);
    },
});

const upload = multer({ storage });

// حماية الراوت
router.post("/chat/upload-image", verifyAuth, upload.single("image"), uploadChatImage);

// --- المسار الجديد لجلب ملخصات الوساطات للمستخدم ---
router.get('/my-summaries', verifyAuth, getMyMediationSummariesController);

router.put('/buyer/confirm-receipt/:mediationRequestId', verifyAuth, buyerConfirmReceiptController);

router.put('/open-dispute/:mediationRequestId', verifyAuth, openDisputeController);

router.get('/mediator/disputed-cases', verifyAuth, isQualifiedMediator, getMediatorDisputedCasesController); // افترض أن لديك middleware isQualifiedMediator

router.get('/admin/disputed-cases', verifyAuth, isAdmin, adminGetDisputedCasesController);

// مسار لحل النزاع من قبل الأدمن
router.put('/admin/resolve-dispute/:mediationRequestId', verifyAuth, isAdmin, adminResolveDisputeController);

// --- [!!!] مسارات جديدة للشات الفرعي الخاص بالأدمن [!!!] ---

// (Admin) إنشاء شات فرعي جديد داخل نزاع
router.post(
    '/:mediationRequestId/admin/subchats',
    verifyAuth,
    isAdmin, // فقط الأدمن يمكنه إنشاء شات فرعي
    adminCreateSubChatController
);

// (Admin) جلب جميع الشاتات الفرعية لنزاع معين (لعرض قائمة بها للأدمن)
router.get(
    '/:mediationRequestId/admin/subchats',
    verifyAuth,
    isAdmin, // فقط الأدمن يمكنه رؤية قائمة جميع الشاتات الفرعية
    adminGetAllSubChatsForDisputeController
);

// (Admin/Participant) إرسال رسالة في شات فرعي محدد
router.post(
    '/:mediationRequestId/admin/subchats/:subChatId/messages',
    verifyAuth,
    canAccessAdminSubChat, // الأدمن أو المشارك في الشChat الفرعي
    // يمكنك استخدام نفس middleware رفع الصور للشات الرئيسي هنا إذا أردت
    // upload.single("image"), // إذا كنت ستسمح برفع الصور
    adminSendSubChatMessageController
);

// (Admin/Participant) جلب رسائل شات فرعي محدد
router.get(
    '/:mediationRequestId/admin/subchats/:subChatId/messages',
    verifyAuth,
    canAccessAdminSubChat, // الأدمن أو المشارك في الشChat الفرعي
    adminGetSubChatMessagesController
);

// (Admin/Participant) وضع علامة على الرسائل كمقروءة في شات فرعي
router.post(
    '/:mediationRequestId/admin/subchats/:subChatId/messages/read',
    verifyAuth,
    canAccessAdminSubChat,
    adminMarkSubChatMessagesReadController
);

module.exports = router;