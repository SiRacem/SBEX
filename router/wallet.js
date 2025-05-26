// router/wallet.js

const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth'); // حماية المسارات
const {
    sendFundsController,
    getTransactionsController, // <-- استيراد الدالة الجديدة
    getSellerPendingFundsDetailsController,
    getDashboardTransactionsController, // <-- استيراد الدالة الجديدة للداشبورد
} = require('../controllers/wallet.controller');
// ---------------------------------------------------------

// --- تعريف المسارات ---
router.post('/send', verifyAuth, sendFundsController);
router.get('/transactions', verifyAuth, getTransactionsController);
router.get('/transactions/dashboard', verifyAuth, getDashboardTransactionsController);
// --- [!!!] المسار الجديد لجلب تفاصيل الأموال المعلقة للبائع [!!!] ---
router.get('/seller-pending-details', verifyAuth, getSellerPendingFundsDetailsController);
// --------------------------------------------------------------------

module.exports = router;