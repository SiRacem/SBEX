// server/middlewares/uploadReportImages.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// تحديد مجلد حفظ صور البلاغات
const reportImagesDir = path.join(__dirname, '../uploads/report_images');
if (!fs.existsSync(reportImagesDir)) {
    fs.mkdirSync(reportImagesDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, reportImagesDir);
    },
    filename: function (req, file, cb) {
        // اسم فريد للملف لتجنب التعارض
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user._id + '-report-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // السماح فقط بملفات الصور
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const uploadReportImages = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 2, // 2MB حد أقصى لكل ملف
        files: 10 // حد أقصى 10 ملفات
    },
    fileFilter: fileFilter
});

module.exports = uploadReportImages;