// middlewares/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const TICKET_ATTACHMENTS_DIR = path.join(__dirname, '..', 'uploads', 'ticket_attachments');

if (!fs.existsSync(TICKET_ATTACHMENTS_DIR)) {
    try {
        fs.mkdirSync(TICKET_ATTACHMENTS_DIR, { recursive: true });
        console.log(`[FileUpload] Created directory for ticket attachments: ${TICKET_ATTACHMENTS_DIR}`);
    } catch (err) {
        console.error(`[FileUpload] Error creating directory ${TICKET_ATTACHMENTS_DIR}:`, err);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TICKET_ATTACHMENTS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// --- THIS IS THE FIX ---
const fileFilter = (req, file, cb) => {
    // Expanded list of allowed types
    const allowedMimeTypes = [
        'image/jpeg', 'image/pjpeg', 'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'application/vnd.rar',
        'application/x-rar-compressed',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'application/octet-stream'
    ];

    // Expanded list of allowed extensions
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|zip|rar|mp4|webm|mov|mp3|wav|ogg)$/i;

    const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);
    const isExtensionAllowed = allowedExtensions.test(path.extname(file.originalname).toLowerCase());

    console.log(`[FileUpload Filter] Checking file: ${file.originalname} | MIME: ${file.mimetype} | Ext Allowed: ${isExtensionAllowed} | MIME Allowed: ${isMimeTypeAllowed}`);

    // Simplified Logic: Allow if either MIME type or extension is recognized
    if (isMimeTypeAllowed || isExtensionAllowed) {
        cb(null, true);
    } else {
        console.log(`[FileUpload Filter] File REJECTED: ${file.originalname}`);
        cb(new Error('File type not allowed. Please upload a valid file format.'), false);
    }
};
// --- END OF FIX ---

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES
    },
    fileFilter: fileFilter
});

exports.handleFileUpload = (fieldsConfig) => (req, res, next) => {
    if (!Array.isArray(fieldsConfig) || fieldsConfig.length === 0) {
        console.error("[FileUpload] fieldsConfig is missing or invalid.");
        return res.status(500).json({ msg: "File upload configuration error." });
    }

    const uploader = upload.fields(fieldsConfig);

    uploader(req, res, function (err) {
        if (err) {
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
            } else if (err.message) {
                errorMessage = err.message;
            }
            return res.status(400).json({ msg: errorMessage, field: err.field });
        }
        next();
    });
};