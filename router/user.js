// router/user.js
const express = require('express');
// --- تأكد من استيراد checkEmailExists هنا ---
const {
    Register, Login, Auth,
    getUsers, updateUsers, deleteUsers,
    checkEmailExists, // <-- تأكد من وجودها هنا
    getUserPublicProfile, // <-- [!] إضافة الدالة الجديدة
    adminGetAvailableMediators, // <-- استيراد الدالة الجديدة
    // --- [!!!] استيراد الدوال الجديدة [!!!] ---
    applyForMediator, adminGetPendingMediatorApplications,
    adminApproveMediatorApplication, adminRejectMediatorApplication,updateMyMediatorStatus,updateUserProfilePicture,
    // ------------------------------------
} = require('../controllers/user.controller'); // <-- تأكد من المسار الصحيح
// -------------------------------------------
const { registerRules, validatorMiddleware } = require('../middlewares/validator');
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');
const { isMediator } = require('../middlewares/roleCheck'); // قد تحتاج لـ middleware جديد للتحقق من isMediatorQualified
const uploadAvatar = require('../middlewares/uploadAvatar');
// -------------------------------------------

const router = express.Router();

// -- Auth Routes --
router.post("/register", registerRules(), validatorMiddleware, Register);
router.post("/login", Login);
router.get("/auth", verifyAuth, Auth);

// --- *** تأكد من وجود هذا السطر بالضبط *** ---
// يستخدم POST، محمي بـ verifyAuth، ويستدعي checkEmailExists
router.post("/check-email", verifyAuth, checkEmailExists);

// -- Public Profile Route --
router.get('/profile/:userId', getUserPublicProfile);

// --- [!!!] مسار تقديم طلب الوساطة (للمستخدم المسجل) [!!!] ---
router.post('/apply-mediator', verifyAuth, applyForMediator);
// ----------------------------------------------------------

// -- User Management Routes --
router.get("/get_users", verifyAuth, /* isAdmin, */ getUsers);
router.put('/update_users/:id', verifyAuth, /* isAdminOrSelf, */ updateUsers);
router.delete('/delete_users/:id', verifyAuth, /* isAdmin, */ deleteUsers);

// --- [!!!] إضافة مسار جديد للأدمن لجلب الوسطاء [!!!] ---
router.get('/admin/mediators', verifyAuth, isAdmin, adminGetAvailableMediators);

// --- [!!!] مسارات إدارة طلبات الوسطاء (للأدمن) [!!!] ---
router.get('/admin/mediator-applications', verifyAuth, isAdmin, adminGetPendingMediatorApplications);
router.put('/admin/mediator-application/:userId/approve', verifyAuth, isAdmin, adminApproveMediatorApplication);
router.put('/admin/mediator-application/:userId/reject', verifyAuth, isAdmin, adminRejectMediatorApplication);
// ------------------------------------------------------
router.put('/mediator/status', verifyAuth, /* isMediator, */ updateMyMediatorStatus);

router.put('/profile/avatar', verifyAuth, uploadAvatar.single('avatar'), updateUserProfilePicture);

module.exports = router;