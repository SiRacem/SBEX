// router/withdrawal.router.js
const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck'); // سنحتاجه لاحقًا

// استيراد دوال الـ Controller
const {
    createWithdrawalRequest,
    adminGetRequests,            // <-- إضافة
    adminGetRequestDetails,    // <-- إضافة
    adminCompleteWithdrawal,     // <-- إضافة (استخدمت اسم complete بدل approve)
    adminRejectWithdrawal,
    getUserRequests        // <-- إضافة
} = require('../controllers/withdrawal.controller');

// --- المسارات الخاصة بالمستخدم ---
router.get('/my-requests', verifyAuth, getUserRequests);

// POST /withdrawals - إنشاء طلب سحب جديد
router.post('/', verifyAuth, createWithdrawalRequest);

// --- المسارات الخاصة بالأدمن ---
router.get('/admin', verifyAuth, isAdmin, adminGetRequests);
router.get('/admin/:requestId', verifyAuth, isAdmin, adminGetRequestDetails);
router.put('/admin/:requestId/complete', verifyAuth, isAdmin, adminCompleteWithdrawal); // <-- استخدام complete
router.put('/admin/:requestId/reject', verifyAuth, isAdmin, adminRejectWithdrawal);

module.exports = router;