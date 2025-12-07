// server/router/match.router.js
const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');

// [!] تصحيح الاستيراد: إضافة الأقواس { }
const { verifyAuth } = require('../middlewares/verifyAuth');

// [!] تصحيح استيراد الصلاحيات
const { isAdmin } = require('../middlewares/roleCheck');

// ==========================================
// 1. التفاعل مع المباراة (للاعبين)
// ==========================================
router.post('/:matchId/submit', verifyAuth, matchController.submitResult);
router.post('/:matchId/confirm', verifyAuth, matchController.confirmResult);

// ==========================================
// 2. النزاعات (Disputes)
// ==========================================
router.post('/:matchId/dispute', verifyAuth, matchController.reportDispute);

// ==========================================
// 3. الأتمتة والإدارة (Admin Only)
// ==========================================
// [!] استخدام isAdmin مباشرة بدلاً من roleCheck(['admin'])
router.get('/auto-confirm', verifyAuth, isAdmin, matchController.autoConfirmMatches);

module.exports = router;