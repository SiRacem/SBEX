// server/router/achievement.router.js

const express = require('express');
const router = express.Router();
const {
    createAchievement,
    getAllAchievements,
    getAchievementById,
    updateAchievement,
    deleteAchievement,
    getAvailableAchievementsForUser
} = require('../controllers/achievement.controller');

const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');

// --- Public Route ---
// أي مستخدم (أو زائر) يمكنه رؤية الإنجازات المتاحة
router.get('/available', getAvailableAchievementsForUser);

// --- Admin-Only Routes ---
// هذه المسارات محمية وتتطلب صلاحيات المسؤول
router.post('/', verifyAuth, isAdmin, createAchievement);
router.get('/', verifyAuth, isAdmin, getAllAchievements);
router.get('/:id', verifyAuth, isAdmin, getAchievementById);
router.put('/:id', verifyAuth, isAdmin, updateAchievement);
router.delete('/:id', verifyAuth, isAdmin, deleteAchievement);

module.exports = router;