// server/middlewares/isQualifiedMediator.js
const User = require('../models/User'); // افترض أن هذا هو المسار الصحيح لموديل User

module.exports = async function (req, res, next) {
    if (!req.user || !req.user._id) {
        // هذا لا يجب أن يحدث إذا كان auth middleware يعمل بشكل صحيح
        return res.status(401).json({ msg: 'User not authenticated for this action.' });
    }

    try {
        // لا حاجة لجلب المستخدم مرة أخرى إذا كان req.user يحتوي بالفعل على isMediatorQualified
        // إذا كان req.user (من auth middleware) لا يحتوي على isMediatorQualified، قم بإعادة جلبه
        const user = await User.findById(req.user._id).select('isMediatorQualified');

        if (!user) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        if (user.isMediatorQualified !== true) {
            return res.status(403).json({ msg: 'Access denied. User is not a qualified mediator.' });
        }

        // إذا كان وسيطًا مؤهلاً، اسمح للطلب بالمرور إلى الـ controller
        next();
    } catch (error) {
        console.error("Error in isQualifiedMediator middleware:", error.message);
        res.status(500).send('Server Error in authorization process.');
    }
};