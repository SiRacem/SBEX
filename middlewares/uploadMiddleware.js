// server/middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // للتحقق من وجود المجلد

// تحديد مجلد التخزين والتحقق من وجوده
const proofStoragePath = path.join(__dirname, '../uploads/proofs'); // المسار النسبي من ملف middleware
if (!fs.existsSync(proofStoragePath)) {
    fs.mkdirSync(proofStoragePath, { recursive: true }); // إنشاء المجلد إذا لم يكن موجودًا
    console.log(`Created directory: ${proofStoragePath}`);
} else {
    console.log(`Directory exists: ${proofStoragePath}`);
}


// إعدادات تخزين Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, proofStoragePath); // مجلد التخزين
    },
    filename: function (req, file, cb) {
        // إنشاء اسم فريد للملف (مثال: timestamp-userId-originalname)
        const uniqueSuffix = Date.now() + '-' + (req.user?._id || 'unknown') + '-' + Math.round(Math.random() * 1E5);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // إضافة امتداد الملف الأصلي
    }
});

// فلتر للتحقق من نوع الملف (السماح بالصور فقط)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // قبول الملف
    } else {
        cb(new Error('Invalid file type, only images are allowed!'), false); // رفض الملف
    }
};

// تهيئة middleware Multer
const uploadProof = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // حد أقصى 5MB للملف
});

module.exports = { uploadProof }; // تصدير middleware