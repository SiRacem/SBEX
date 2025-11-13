// middlewares/uploadNewsMedia.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log("--- [3] uploadNewsMedia Middleware: destination() CALLED ---");
        const uploadPath = 'uploads/news_media';
        // تأكد من إنشاء المجلد إذا لم يكن موجودًا
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        console.log("--- [3] uploadNewsMedia Middleware: filename() CALLED ---");
        // إنشاء اسم ملف فريد لتجنب التداخل
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});

const fileFilter = (req, file, cb) => {
    // قبول الصور والفيديوهات فقط
    if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type, only images and videos are allowed!'), false);
    }
};

const uploadNewsMedia = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = uploadNewsMedia;