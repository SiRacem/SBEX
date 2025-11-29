const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');
const { 
    performDailyCheckIn, 
    spinWheel, 
    getUserQuests, 
    claimQuestReward,
    adminCreateQuest,
    adminGetAllQuests,
    adminUpdateQuest,
    adminDeleteQuest,
    adminUpdateCheckInConfig,
    adminGetCheckInConfig,
    getSpinHistory,
    getWheelConfig,
    adminUpdateWheelConfig
} = require('../controllers/quest.controller');

// مسارات المستخدم
router.post('/check-in', verifyAuth, performDailyCheckIn);
router.post('/spin', verifyAuth, spinWheel);
router.get('/my-quests', verifyAuth, getUserQuests);
router.post('/claim', verifyAuth, claimQuestReward);

// مسارات الإدارة
router.get('/admin/all', verifyAuth, isAdmin, adminGetAllQuests); // جلب الكل
router.post('/admin/create', verifyAuth, isAdmin, adminCreateQuest); // إنشاء
router.put('/admin/update/:id', verifyAuth, isAdmin, adminUpdateQuest); // تعديل
router.delete('/admin/delete/:id', verifyAuth, isAdmin, adminDeleteQuest); // حذف
router.put('/admin/config/check-in', verifyAuth, isAdmin, adminUpdateCheckInConfig); // تعديل
router.get('/config/check-in', verifyAuth, adminGetCheckInConfig); // جلب
router.get('/spin-history', verifyAuth, getSpinHistory); // جلب سجل اللفات

// مسارات العجلة
router.get('/config/wheel', verifyAuth, getWheelConfig);
router.put('/admin/config/wheel', verifyAuth, isAdmin, adminUpdateWheelConfig);

module.exports = router;