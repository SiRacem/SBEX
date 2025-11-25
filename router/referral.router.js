const express = require('express');
const router = express.Router();
const { bindReferralCode, transferReferralBalance, getMyReferralStats, getReferralSettings, updateReferralSettings } = require('../controllers/referral.controller');
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin } = require('../middlewares/roleCheck');

router.use(verifyAuth); // كل المسارات محمية

router.post('/bind', bindReferralCode);
router.post('/transfer', transferReferralBalance);
router.get('/my-stats', getMyReferralStats);
router.get('/admin/settings', verifyAuth, isAdmin, getReferralSettings);
router.put('/admin/settings', verifyAuth, isAdmin, updateReferralSettings);

module.exports = router;