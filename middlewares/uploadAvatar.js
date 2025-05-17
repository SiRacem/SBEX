// server/middlewares/uploadAvatar.js
const multer = require('multer');
const path = require('path');

// تحديد مكان تخزين صور البروفايل وأنواع الملفات المسموح بها
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/avatars/'); // تأكد من أن مجلد uploads/avatars موجود
    },
    filename: function (req, file, cb) {
        // اسم ملف فريد: userId-timestamp.extension
        const uniqueSuffix = req.user._id + '-' + Date.now() + path.extname(file.originalname);
        cb(null, uniqueSuffix);
    }
});

const fileFilter = (req, file, cb) => {
    // السماح فقط بملفات الصور
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif' || file.mimetype === 'image/webp') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type, only JPEG, PNG, GIF, or WEBP is allowed!'), false);
    }
};

const uploadAvatar = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 2 // 2MB حد أقصى لحجم الملف
    },
    fileFilter: fileFilter
});

module.exports = uploadAvatar;