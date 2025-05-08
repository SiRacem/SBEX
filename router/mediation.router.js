// server/router/mediation.router.js
const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');
const {
    adminGetPendingAssignmentRequests,
    adminAssignMediator
} = require('../controllers/mediation.controller');

// --- مسارات الأدمن ---

// GET /mediation/admin/pending-assignment - جلب الطلبات التي تنتظر تعيين وسيط
router.get('/admin/pending-assignment', verifyAuth, isAdmin, adminGetPendingAssignmentRequests);

// PUT /mediation/admin/assign/:requestId - تعيين وسيط لطلب محدد
router.put('/admin/assign/:requestId', verifyAuth, isAdmin, adminAssignMediator);

// --- مسارات لاحقة للوسيط والأطراف ---
// PUT /mediation/mediator/accept/:requestId (للوسيط لقبول المهمة)
// PUT /mediation/mediator/reject/:requestId (للوسيط لرفض المهمة)
// PUT /mediation/confirm-start/:requestId (للبائع/المشتري لتأكيد البدء)
// POST /mediation/complete/:requestId (للوسيط لإتمام الصفقة)
// ... والمزيد ...

module.exports = router;