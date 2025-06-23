// router/user.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    Register, Login, Auth,
    getUsers, updateUsers, deleteUsers,
    checkEmailExists, // <-- تأكد من وجودها هنا
    getUserPublicProfile, // <-- [!] إضافة الدالة الجديدة
    adminGetAvailableMediators, // <-- استيراد الدالة الجديدة
    applyForMediator, adminGetPendingMediatorApplications,
    adminApproveMediatorApplication, adminRejectMediatorApplication,updateMyMediatorStatus,updateUserProfilePicture,
    adminUpdateUserBlockStatus,
    // ------------------------------------
} = require('../controllers/user.controller');
const { registerRules, validatorMiddleware } = require('../middlewares/validator');
const { verifyAuth } = require('../middlewares/verifyAuth'); // <--- استورد الكائن
const { isAdmin } = require('../middlewares/roleCheck'); // <--- استورد من roleCheck
const uploadAvatar = require('../middlewares/uploadAvatar');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { msg: "Too many login attempts, please try again later." }
});

// -- Auth Routes --
router.post("/register", registerRules(), validatorMiddleware, Register);
router.post("/login", loginLimiter, Login);
router.get("/auth", verifyAuth, Auth); // <-- استدعاء verifyAuth صحيح
router.post("/check-email", verifyAuth, checkEmailExists);

// -- Public Profile Route --
router.get('/profile/:userId', getUserPublicProfile);

// --- [!!!] مسار تقديم طلب الوساطة (للمستخدم المسجل) [!!!] ---
router.post('/apply-mediator', verifyAuth, applyForMediator);

// -- User Management Routes --
router.get("/get_users", verifyAuth, isAdmin, getUsers);
router.put('/update_users/:id', verifyAuth, isAdmin, updateUsers);
router.delete('/delete_users/:id', verifyAuth, isAdmin, deleteUsers);

// --- [!!!] مسارات إدارة طلبات الوسطاء (للأدمن) [!!!] ---
router.put('/admin/users/:userId/block-status', verifyAuth, isAdmin, adminUpdateUserBlockStatus);
router.get('/admin/mediators', verifyAuth, isAdmin, adminGetAvailableMediators);
router.get('/admin/mediator-applications', verifyAuth, isAdmin, adminGetPendingMediatorApplications);
router.put('/admin/mediator-application/:userId/approve', verifyAuth, isAdmin, adminApproveMediatorApplication);
router.put('/admin/mediator-application/:userId/reject', verifyAuth, isAdmin, adminRejectMediatorApplication);
// ------------------------------------------------------
router.put('/mediator/status', verifyAuth, updateMyMediatorStatus);

router.put('/profile/avatar', verifyAuth, uploadAvatar.single('avatar'), updateUserProfilePicture);

module.exports = router;