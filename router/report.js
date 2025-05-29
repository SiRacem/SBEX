// server/router/report.js
const express = require('express');
const router = express.Router();
const { verifyAuth, verifyAdmin } = require('../middlewares/verifyAuth'); // استيراد verifyAdmin
const uploadReportImages = require('../middlewares/uploadReportImages');
const {
    submitUserReport,
    adminGetReports,         // <-- دالة جديدة
    adminGetReportDetails,   // <-- دالة جديدة
    adminUpdateReportStatus,  // <-- دالة جديدة
} = require('../controllers/report.controller');

// @route   POST /user (سيكون المسار الكامل مثلاً /reports/user بناءً على server.js)
// @desc    Submit a report against a user
// @access  Private (Authenticated users)
router.post(
    '/user',
    verifyAuth,
    uploadReportImages.array('reportImages', 10),
    submitUserReport
);

// --- Admin routes for managing reports ---

// @route   GET /admin/all
// @desc    Admin: Get all reports with pagination and filters
// @access  Private (Admin only)
router.get(
    '/admin/all',
    verifyAuth,
    verifyAdmin, // التأكد أن المستخدم هو أدمن
    adminGetReports
);

// @route   GET /admin/:reportId
// @desc    Admin: Get details of a specific report
// @access  Private (Admin only)
router.get(
    '/admin/:reportId',
    verifyAuth,
    verifyAdmin,
    adminGetReportDetails
);

// @route   PUT /admin/:reportId/status
// @desc    Admin: Update status and notes of a report
// @access  Private (Admin only)
router.put(
    '/admin/:reportId/status',
    verifyAuth,
    verifyAdmin,
    adminUpdateReportStatus
);

module.exports = router;