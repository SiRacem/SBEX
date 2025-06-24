// server/router/faq.router.js
const express = require('express');
const router = express.Router();
const {
    getAllActiveFAQs,
    adminGetAllFAQs,
    adminCreateFAQ,
    adminUpdateFAQ,
    adminDeleteFAQ
} = require('../controllers/faq.controller');
const { verifyAuth } = require('../middlewares/verifyAuth'); // افترض أن لديك هذه الميدلويير
const { isAdmin } = require('../middlewares/roleCheck'); // <--- استورد من roleCheck

// --- Public Route ---
// @route   GET /api/faq
// @desc    Get all active FAQs grouped by category for public view
router.get('/', getAllActiveFAQs);

// --- Admin Routes ---
// تأكد من أن جميع مسارات الأدمن محمية بـ verifyAuth و verifyAdmin

// @route   GET /api/faq/admin/all
// @desc    Get all FAQs (active and inactive) for the admin panel
router.get('/admin/all', verifyAuth, isAdmin, adminGetAllFAQs);

// @route   POST /api/faq/admin
// @desc    Create a new FAQ
router.post('/admin', verifyAuth, isAdmin, adminCreateFAQ);

// @route   PUT /api/faq/admin/:id
// @desc    Update an FAQ
router.put('/admin/:id', verifyAuth, isAdmin, adminUpdateFAQ);

// @route   DELETE /api/faq/admin/:id
// @desc    Delete an FAQ
router.delete('/admin/:id', verifyAuth, isAdmin, adminDeleteFAQ);

module.exports = router;