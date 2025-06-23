// server/router/report.js
const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth'); // <-- سيبقى يستورد verifyAuth
const { isAdmin } = require('../middlewares/roleCheck'); // <--- [!!! تعديل مهم] سنستورد isAdmin من هنا
const uploadReportImages = require('../middlewares/uploadReportImages');
const {
    submitUserReport,
    adminGetReports,
    adminGetReportDetails,
    adminUpdateReportStatus,
} = require('../controllers/report.controller');

// --- مسارات المستخدمين لتقديم التقارير ---
router.post('/user', verifyAuth, uploadReportImages.array('reportImages', 10), submitUserReport);

// --- Admin routes for managing reports ---
router.get(
    '/admin/all',
    verifyAuth,
    isAdmin, // التأكد أن المستخدم هو أدمن
    adminGetReports
);

router.get(
    '/admin/:reportId',
    verifyAuth,
    isAdmin,
    adminGetReportDetails
);

router.put(
    '/admin/:reportId/status',
    verifyAuth,
    isAdmin,
    adminUpdateReportStatus
);

module.exports = router;