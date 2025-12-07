// server/router/leagues.router.js
const express = require('express');
const router = express.Router();
const leaguesController = require('../controllers/leagues.controller');
const { verifyAuth } = require('../middlewares/verifyAuth'); // [!] لاحظ الأقواس
const { isAdmin } = require('../middlewares/roleCheck'); // [!] لاحظ الأقواس

// --- Leagues Routes ---
// Public or User routes
router.get('/active', verifyAuth, leaguesController.getActiveLeagues); // للمستخدمين (عند الانضمام)

// Admin Routes
router.post('/create', verifyAuth, isAdmin, leaguesController.createLeague);
router.get('/', verifyAuth, isAdmin, leaguesController.getAllLeagues); // للأدمن (صفحة الإدارة)
router.put('/:id', verifyAuth, isAdmin, leaguesController.updateLeague);
router.delete('/:id', verifyAuth, isAdmin, leaguesController.deleteLeague);

// --- Teams Routes ---
router.get('/:leagueId/teams', verifyAuth, leaguesController.getTeamsByLeague); // جلب فرق دوري معين
router.post('/teams/add', verifyAuth, isAdmin, leaguesController.addTeam);
router.put('/teams/:id', verifyAuth, isAdmin, leaguesController.updateTeam);
router.delete('/teams/:id', verifyAuth, isAdmin, leaguesController.deleteTeam);

module.exports = router;