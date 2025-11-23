// server/router/leaderboard.router.js

const express = require('express');
const router = express.Router();
const { getLeaderboards } = require('../controllers/leaderboard.controller');
const { verifyAuth } = require('../middlewares/verifyAuth'); // سنحتاج هذا لجلب ترتيب المستخدم الحالي

// نستخدم verifyAuth بشكل اختياري (إذا كان مسجلاً، نعرف ترتيبه)
// ملاحظة: verifyAuth عادة يمنع الدخول إذا لم يكن هناك توكن.
// لجعلها اختيارية، نحتاج لـ middleware أخف، أو نستخدم verifyAuth ونقبل الخطأ في الـ frontend.
// للتبسيط، سنجعل المسار "عامًا" ولكن إذا أرسل الـ frontend التوكن، سنستخدمه.
// الطريقة الأفضل: نستخدم verifyAuth فقط إذا أردنا "ترتيبي أنا".
// لكن بما أننا دمجنا الطلبين، سنستخدم middleware مخصص بسيط يستخرج التوكن إن وجد ولا يفشل إن لم يوجد.

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        // ... منطق استخراج التوكن مشابه لـ verifyAuth ...
        // ... تعيين req.user ...
        // سنستخدم verifyAuth الموجودة لديك ولكن بطريقة لا توقف الطلب
        // (يمكنك تجاهل هذا التعقيد الآن واستخدام المسار كـ Public، والـ controller سيعمل حتى لو لم يكن هناك req.user)
    }
    next();
};

// الأفضل والأبسط: استخدم التوكن دائمًا في الطلب من الـ frontend
// وسيقوم الـ backend (leaderboard.controller.js) بالتحقق من req.user
// لكن في الـ router، لا تضع verifyAuth كـ middleware إلزامي للمسار العام.
// ولكن بما أننا نريد `req.user`، يجب أن نمرر التوكن.
// الحل: في leaderboard.controller.js، نحن نستخدم `req.user?._id`.
// لكي يتم ملء `req.user`، يجب أن يمر الطلب عبر `verifyAuth`.
// لذا، اجعل المسار محميًا بـ verifyAuth إذا أردت ميزة "ترتيبي".
// إذا أردته عامًا، فلن يرى الزائر ترتيبه (وهذا منطقي).

// الخلاصة: سنستخدم verifyAuth. الزوار غير المسجلين لن يروا الصفحة أصلاً لأننا حميناها في Frontend بـ <ProtectedRoute>.

router.get('/', verifyAuth, getLeaderboards); 

module.exports = router;