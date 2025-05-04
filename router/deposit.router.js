// router/deposit.router.js
const express = require('express');
const router = express.Router(); // <-- تأكد من وجود هذا السطر هنا
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');

// استيراد دوال controller الإيداع
const {
    createDepositRequest,
    adminGetDepositRequests, // تأكد من تطابق هذا الاسم مع الكونترولر
    adminApproveDeposit,
    adminRejectDeposit,
    getUserDepositRequests // تأكد من تطابق هذا الاسم مع الكونترولر
} = require('../controllers/deposit.controller');

// --- مسارات المستخدم ---
router.post('/', verifyAuth, createDepositRequest);
router.get('/my-requests', verifyAuth, getUserDepositRequests);

// --- مسارات الأدمن ---
router.get('/admin', verifyAuth, isAdmin, adminGetDepositRequests);
router.put('/admin/:id/approve', verifyAuth, isAdmin, adminApproveDeposit);
router.put('/admin/:id/reject', verifyAuth, isAdmin, adminRejectDeposit);

module.exports = router; // تصدير الراوتر