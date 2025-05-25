// router/rating.js
const express = require('express');
const { verifyAuth } = require('../middlewares/verifyAuth'); // المصادقة مطلوبة للتقييم
const { submitRating, getRatingsForMediation } = require('../controllers/rating.controller');

const router = express.Router();

router.post('/', verifyAuth, submitRating);
router.post('/submit', verifyAuth, submitRating);
router.get('/mediation/:mediationRequestId', verifyAuth, getRatingsForMediation);

module.exports = router;