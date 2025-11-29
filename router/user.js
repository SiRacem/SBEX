// router/user.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    Register, Login, Auth,
    getUsers, updateUsers, deleteUsers,
    checkEmailExists,
    getUserPublicProfile,
    adminGetAvailableMediators,
    applyForMediator, adminGetPendingMediatorApplications,
    adminApproveMediatorApplication, adminRejectMediatorApplication,
    updateMyMediatorStatus, updateUserProfilePicture,
    adminUpdateUserBlockStatus,
    toggleWishlist,
    toggleFollowUser,
    getMyWishlist // سنحتاج هذه الدالة لصفحة المفضلة
} = require('../controllers/user.controller');
const { registerRules, validatorMiddleware } = require('../middlewares/validator');
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');
const uploadAvatar = require('../middlewares/uploadAvatar');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res, next, options) => {
        const retryAfterMinutes = Math.ceil(options.windowMs / 60000);
        res.status(options.statusCode).json({
            errorMessage: {
                key: "apiErrors.tooManyLoginAttempts",
                fallback: `Too many login attempts, please try again after ${retryAfterMinutes} minutes.`,
                params: { minutes: retryAfterMinutes },
                rateLimit: {
                    limit: options.max,
                    remaining: 0,
                    resetTime: new Date(Date.now() + options.windowMs)
                }
            }
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// -- Auth Routes --
router.post("/register", registerRules(), validatorMiddleware, Register);
router.post("/login", loginLimiter, Login);
router.get("/auth", verifyAuth, Auth);
router.post("/check-email", verifyAuth, checkEmailExists);

// -- Public Profile Route --
router.get('/profile/:userId', getUserPublicProfile);

// --- [!!!] Wishlist & Following Routes (New) [!!!] ---
router.put('/wishlist/toggle', verifyAuth, toggleWishlist);
router.put('/follow/toggle', verifyAuth, toggleFollowUser);
router.get('/my-wishlist', verifyAuth, getMyWishlist); // مسار جديد لجلب القائمة
// -----------------------------------------------------

// -- Mediator Routes --
router.post('/apply-mediator', verifyAuth, applyForMediator);
router.put('/mediator/status', verifyAuth, updateMyMediatorStatus);

// -- User Management Routes --
router.get("/get_users", verifyAuth, isAdmin, getUsers);
router.put('/update_users/:id', verifyAuth, isAdmin, updateUsers);
router.delete('/delete_users/:id', verifyAuth, isAdmin, deleteUsers);

// -- Admin Mediator Management --
router.put('/admin/users/:userId/block-status', verifyAuth, isAdmin, adminUpdateUserBlockStatus);
router.get('/admin/mediators', verifyAuth, isAdmin, adminGetAvailableMediators);
router.get('/admin/mediator-applications', verifyAuth, isAdmin, adminGetPendingMediatorApplications);
router.put('/admin/mediator-application/:userId/approve', verifyAuth, isAdmin, adminApproveMediatorApplication);
router.put('/admin/mediator-application/:userId/reject', verifyAuth, isAdmin, adminRejectMediatorApplication);

// -- Avatar Upload --
router.put('/profile/avatar', verifyAuth, uploadAvatar.single('avatar'), updateUserProfilePicture);

module.exports = router;