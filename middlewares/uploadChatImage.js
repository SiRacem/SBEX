// server/middlewares/uploadChatImage.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const chatImageUploadPath = 'uploads/chat_images/'; // مجلد مختلف لصور المحادثة

if (!fs.existsSync(chatImageUploadPath)) {
    fs.mkdirSync(chatImageUploadPath, { recursive: true });
    console.log(`[uploadChatImage] Created directory: ${chatImageUploadPath}`);
} else {
    console.log(`[uploadChatImage] Directory already exists: ${chatImageUploadPath}`);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, chatImageUploadPath);
    },
    filename: function (req, file, cb) {
        // اسم ملف فريد: mediationRequestId-senderId-timestamp.extension
        // نحتاج mediationRequestId من req.body (سنضيفه في الواجهة الأمامية)
        const mediationId = req.body.mediationRequestId || 'unknownMedId'; // احتياطي
        const senderId = req.user._id || 'unknownUser';
        const uniqueSuffix = `${mediationId}-${senderId}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueSuffix);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { // اسمح بجميع أنواع الصور
        cb(null, true);
    } else {
        cb(new Error('Invalid file type, only images are allowed for chat!'), false);
    }
};

const uploadChatImage = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB حد أقصى لصور المحادثة (يمكنك تعديله)
    },
    fileFilter: fileFilter
});

module.exports = uploadChatImage;