// middlewares/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// تحديد مجلد التخزين للمرفقات (يمكنك جعله أكثر ديناميكية أو من ملف الإعدادات)
// __dirname يشير إلى المجلد الحالي (middlewares)
// '..' يرجع خطوة للخلف (إلى مجلد server الرئيسي)
// ثم ندخل إلى 'uploads/ticket_attachments'
const TICKET_ATTACHMENTS_DIR = path.join(__dirname, '..', 'uploads', 'ticket_attachments');

// التأكد من وجود مجلد التخزين، وإنشائه إذا لم يكن موجودًا
if (!fs.existsSync(TICKET_ATTACHMENTS_DIR)) {
    try {
        fs.mkdirSync(TICKET_ATTACHMENTS_DIR, { recursive: true });
        console.log(`[FileUpload] Created directory for ticket attachments: ${TICKET_ATTACHMENTS_DIR}`);
    } catch (err) {
        console.error(`[FileUpload] Error creating directory ${TICKET_ATTACHMENTS_DIR}:`, err);
        // يمكنك اختيار إيقاف التطبيق هنا إذا كان هذا المجلد ضروريًا جدًا
        // process.exit(1);
    }
}

// إعدادات التخزين لـ multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TICKET_ATTACHMENTS_DIR); // مكان حفظ الملفات
    },
    filename: function (req, file, cb) {
        // إنشاء اسم ملف فريد لتجنب الكتابة فوق الملفات
        // استخدام اسم الحقل + timestamp + رقم عشوائي + الامتداد الأصلي
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// --- [!!!] بداية التعديل [!!!] ---
// قم بزيادة الحد الأقصى للحجم هنا أيضًا
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

// فلتر للتحقق من أنواع الملفات المسموح بها وحجمها
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        // الأنواع الحالية
        'image/jpeg', 'image/pjpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'application/vnd.rar',
        'application/x-rar-compressed',

        // إضافة أنواع الفيديو
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime', // for .mov files

        // إضافة أنواع الصوت
        'audio/mpeg', // for .mp3
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',

        'application/octet-stream' // اترك هذا كحل بديل
    ];
    // امتدادات الملفات كحل ثانوي وللتحقق الإضافي
    const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp4|webm|mov|mp3|wav|ogg)$/i;
// --- [!!!] نهاية التعديل [!!!] ---

    const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const isExtensionAllowed = allowedExtensions.test(originalExtension);

    // Log لتتبع عملية الفلترة
    console.log(`[FileUpload Filter] Checking file: ${file.originalname}`);
    console.log(`  MIME Type: ${file.mimetype}, Is MimeType Allowed: ${isMimeTypeAllowed}`);
    console.log(`  Extension: ${originalExtension}, Is Extension Allowed: ${isExtensionAllowed}`);
    
    // إذا كان MIME type هو application/octet-stream، اعتمد بشكل أكبر على الامتداد
    if (file.mimetype === 'application/octet-stream' && isExtensionAllowed) {
        console.log(`[FileUpload Filter] File "${file.originalname}" allowed (octet-stream with valid extension).`);
        return cb(null, true);
    }

    if (isMimeTypeAllowed) { // لا نحتاج للتحقق من الامتداد إذا كان الـ MIME type صحيحًا ومسموحًا
        console.log(`[FileUpload Filter] File "${file.originalname}" allowed by MIME type.`);
        return cb(null, true);
    } else if (isExtensionAllowed && !isMimeTypeAllowed) {
        // إذا كان الامتداد مسموحًا ولكن الـ MIME type غير متطابق أو عام (مثل application/octet-stream الذي تم التعامل معه أعلاه)
        // هذا قد يشير إلى أن المتصفح لم يرسل MIME type دقيقًا، يمكن السماح به بحذر
        console.warn(`[FileUpload Filter] File "${file.originalname}" allowed by extension despite mismatched/generic MIME type (${file.mimetype}). Consider reviewing MIME type list if this happens frequently for valid files.`);
        return cb(null, true);
    } else {
        console.log(`[FileUpload Filter] File "${file.originalname}" REJECTED. Mime: ${file.mimetype}, Ext: ${originalExtension}`);
        // نمرر خطأً لـ multer ليعالجه ويعرض رسالة مناسبة
        // إذا أردت رسالة خطأ مخصصة جدًا، يمكنك تمريرها هنا
        // لكن من الأفضل ترك multer يعرض خطأه القياسي الذي يمكن التقاطه في middleware المعالجة
        return cb(new Error('File type not allowed. Please upload a valid file format.'), false);
    }
};

// إعداد multer مع التخزين، حدود الحجم، والفلتر
const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES
    },
    fileFilter: fileFilter
});

/**
 * Middleware لمعالجة رفع الملفات باستخدام multer.
 * يتوقع أن يكون `fieldsConfig` مصفوفة من الكائنات، كل كائن يحدد اسم الحقل و maxCount.
 * مثال: `[{ name: 'attachments', maxCount: 5 }]`
 */
exports.handleFileUpload = (fieldsConfig) => (req, res, next) => {
    if (!Array.isArray(fieldsConfig) || fieldsConfig.length === 0) {
        console.error("[FileUpload] fieldsConfig is missing or invalid.");
        return res.status(500).json({ msg: "File upload configuration error." });
    }
    
    const uploader = upload.fields(fieldsConfig);

    uploader(req, res, function (err) {
        if (err) { // يتضمن MulterError وأي خطأ من fileFilter
            console.error("[FileUpload] Error during file upload process:", err);
            let errorMessage = "File upload failed.";
            if (err instanceof multer.MulterError) {
                switch (err.code) {
                    case 'LIMIT_FILE_SIZE':
                        errorMessage = `File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`;
                        break;
                    case 'LIMIT_FILE_COUNT':
                        errorMessage = "Too many files uploaded.";
                        break;
                    case 'LIMIT_UNEXPECTED_FILE':
                        errorMessage = `Unexpected file field: ${err.field}.`;
                        break;
                    default:
                        errorMessage = `File upload error: ${err.message}`;
                }
            } else if (err.message && err.message.startsWith('File type not allowed')) {
                errorMessage = err.message; // استخدم رسالة الخطأ من fileFilter
            } else {
                errorMessage = err.message || "An unexpected error occurred during file upload.";
            }
            return res.status(400).json({ msg: errorMessage, field: err.field });
        }
        // إذا لم يكن هناك خطأ، فإن الملفات (إذا تم رفعها) موجودة في req.files
        // req.files سيكون كائنًا، مفاتيحه هي أسماء الحقول من fieldsConfig
        // مثال: req.files['attachments'] هي مصفوفة من الملفات
        console.log("[FileUpload] Files processed (if any). req.files:", req.files ? Object.keys(req.files) : 'No files object.');
        next();
    });
};