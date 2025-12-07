// server/router/tournament.router.js
const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournament.controller');

// [!] تصحيح 1: استيراد verifyAuth بالأقواس إذا كانت module.exports = { verifyAuth }
// جرب هذا أولاً:
const { verifyAuth } = require('../middlewares/verifyAuth'); 
// إذا فشل وجاء خطأ "verifyAuth is not a function"، جرب: const verifyAuth = require('../middlewares/verifyAuth');

// [!] تصحيح 2: استيراد isAdmin بالأقواس لأنها export منفصلة
const { isAdmin } = require('../middlewares/roleCheck');

// ==========================================
// 1. إدارة البطولات (Admin Only)
// ==========================================
// [!] استخدام isAdmin كدالة، و verifyAuth كدالة
router.post('/create', verifyAuth, isAdmin, tournamentController.createTournament);

// ==========================================
// 2. تفاعل المستخدمين (Users)
// ==========================================
router.get('/', tournamentController.getAllTournaments); 
router.get('/:id', tournamentController.getTournamentDetails); 

// التسجيل واختيار الفريق
router.post('/:id/join', verifyAuth, tournamentController.joinTournament);

// تغيير الفريق
router.put('/:id/change-team', verifyAuth, tournamentController.changeTeam);

// ==========================================
// 3. نظام المباريات والبطولة (Check-in & Matches)
// ==========================================
router.post('/:id/check-in', verifyAuth, tournamentController.checkInUser);

// جلب شجرة البطولة
router.get('/:id/matches', tournamentController.getTournamentMatches);

// بدء البطولة (Admin Only)
router.post('/:id/start', verifyAuth, isAdmin, tournamentController.startTournament);

module.exports = router;