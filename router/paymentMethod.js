// router/paymentMethod.js
const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth'); // المصادقة مطلوبة للأدمن
const { isAdmin } = require('../middlewares/roleCheck'); // التحقق من دور الأدمن

// استيراد دوال الـ Controller
const {
    adminGetAllPaymentMethods,
    adminAddPaymentMethod,
    adminUpdatePaymentMethod,
    adminDeletePaymentMethod,
    getActivePaymentMethods
} = require('../controllers/paymentMethod.controller');

// --- المسارات العامة (للمستخدمين) ---
// GET /payment-methods - جلب الطرق النشطة (يمكن إضافة ?type=deposit أو ?type=withdrawal)
router.get('/', getActivePaymentMethods);


// --- المسارات الخاصة بالأدمن ---
// يجب تطبيق verifyAuth و isAdmin على هذه المسارات

// GET /payment-methods/admin/all - جلب جميع الطرق للأدمن
router.get('/admin/all', verifyAuth, isAdmin, adminGetAllPaymentMethods);

// POST /payment-methods/admin - إضافة طريقة جديدة
router.post('/admin', verifyAuth, isAdmin, adminAddPaymentMethod);

// PUT /payment-methods/admin/:id - تعديل طريقة موجودة
router.put('/admin/:id', verifyAuth, isAdmin, adminUpdatePaymentMethod);

// DELETE /payment-methods/admin/:id - حذف طريقة
router.delete('/admin/:id', verifyAuth, isAdmin, adminDeletePaymentMethod);


module.exports = router;