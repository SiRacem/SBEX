// router/rating.js
const express = require('express');
const { verifyAuth } = require('../middlewares/verifyAuth');
const ratingControllerModule = require('../controllers/rating.controller'); // استورد الكائن كله أولاً

console.log("Imported ratingControllerModule:", ratingControllerModule); // افحص هذا الكائن

const { submitRating, getRatingsForMediation } = ratingControllerModule; // ثم قم بالـ destructuring

console.log("submitRating function after destructuring:", submitRating); // هل هي دالة أم undefined؟
console.log("getRatingsForMediation function after destructuring:", getRatingsForMediation);

const router = express.Router();

// استخدم الدوال كخصائص للكائن المستورد
router.post('/submit', verifyAuth, submitRating); // أو ratingControllerModule.submitRating
router.post('/', verifyAuth, submitRating); // أو ratingControllerModule.submitRating
router.get('/mediation/:mediationRequestId', verifyAuth, getRatingsForMediation); // أو ratingControllerModule.getRatingsForMediation

module.exports = router;