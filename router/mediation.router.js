// server/router/mediation.router.js
const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin, isAssignedMediator } = require('../middlewares/roleCheck');
const { isSellerOfMediation, isBuyerOfMediation } = require('../middlewares/mediationPartyCheck'); // Middleware جديد
const {
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
    getBuyerMediationRequests
} = require('../controllers/mediation.controller');

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

// POST /mediation/complete/:requestId (للوسيط لإتمام الصفقة)
// ... والمزيد ...

module.exports = router;