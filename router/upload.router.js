const express = require('express');
const router = express.Router();
const { uploadProof } = require('../middlewares/uploadMiddleware'); // استيراد middleware الرفع
const verifyAuth = require('../middlewares/verifyAuth'); // middleware التحقق من المصادقة
const config = require('config'); // للوصول إلى BASE_URL إذا لزم الأمر

console.log('>>>> DEBUG: verifyAuth:', verifyAuth); // ضيف هذا السطر

// --- [!] مسار رفع صورة إثبات الدفع ---
// POST /uploads/proof
// يتطلب مصادقة ويستخدم middleware الرفع لملف واحد باسم 'proofImage'
router.post('/proof', verifyAuth.verifyAuth, uploadProof.single('proofImage'), (req, res) => {
    // uploadProof.single('proofImage') سيقوم بمعالجة الملف وإضافته إلى req.file

    if (!req.file) {
        // لم يتم رفع ملف أو تم رفضه بواسطة الفلتر
        return res.status(400).json({ msg: 'No valid image file uploaded.' });
    }

    try {
        console.log('File uploaded successfully:', req.file);
        // --- [معدل] إرجاع المسار النسبي فقط ---
        const relativePath = `/uploads/proofs/${req.file.filename}`; // يبدأ بـ / ليكون مساراً من الجذر
        // ------------------------------------
        console.log('Returning relative path:', relativePath);
        res.status(201).json({
            msg: 'Proof uploaded successfully.',
            filePath: relativePath // <-- اسم الحقل تغير إلى filePath
        });
    } catch (error) {
        console.error("Error processing uploaded file:", error);
        // التعامل مع أخطاء محتملة أخرى
        res.status(500).json({ msg: 'Server error processing upload.' });
    }
});

// يمكنك إضافة مسارات رفع أخرى هنا لأنواع ملفات مختلفة

module.exports = router;