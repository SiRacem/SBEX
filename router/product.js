const express = require('express');
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin, isOwnerOrAdmin } = require('../middlewares/roleCheck');

const {
    addProduct,
    getProducts,
    getMyProducts,
    getOneProduct,
    updateProducts,
    deleteProducts,
    getProductCountsByUser,
    getUserById,
    getPendingProducts,
    approveProduct,
    rejectProduct,
    toggleLikeProduct,
    placeBidOnProduct,
    getProductBids,
    markProductAsSold,
    acceptBid,
    rejectBid,
    returnToSale
} = require('../controllers/product.controller');

const router = express.Router();

// --- مسارات عامة ---
router.get('/get_products', getProducts);       // جلب كل المنتجات
router.get('/get_products/:id', getOneProduct); // جلب منتج واحد
router.get("/get_user/:id", getUserById);       // جلب بيانات مستخدم
router.get('/:productId/bids', getProductBids); // جلب مزايدات منتج
router.get('/my-products', verifyAuth, getMyProducts); // جلب منتجات المستخدم الحالي

// --- مسارات تحتاج تسجيل دخول ---
router.post('/add_product', verifyAuth, addProduct);        // إضافة منتج
router.put('/update_products/:id', verifyAuth, updateProducts); // تحديث منتج
router.delete('/delete_products/:id', verifyAuth, deleteProducts); // حذف منتج
router.get('/get_product_counts/:userId', verifyAuth, isOwnerOrAdmin, getProductCountsByUser); // إحصائيات منتجات مستخدم
router.put('/:productId/like', verifyAuth, toggleLikeProduct); // تبديل الإعجاب بمنتج
router.post('/:productId/bids', verifyAuth, placeBidOnProduct); // وضع مزايدة على منتج

// --- [!] إضافة مسار قبول المزايدة (يتطلب تسجيل دخول البائع) ---
// يستخدم PUT لأنه يعدل حالة المنتج والمستخدمين
router.put('/:productId/accept-bid', verifyAuth, acceptBid);
router.put('/:productId/reject-bid', verifyAuth, rejectBid);
router.put("/:productId/return-to-sale", verifyAuth, returnToSale); // إرجاع المنتج للبيع من جديد

// --- [!] إضافة مسار تحديد المنتج كمباع (يحتاج تسجيل دخول البائع) ---
router.put('/:productId/sell', verifyAuth, markProductAsSold);

// --- مسارات الأدمن ---
router.get('/pending', verifyAuth, isAdmin, getPendingProducts); // جلب المنتجات المعلقة
router.put('/approve/:id', verifyAuth, isAdmin, approveProduct); // الموافقة على منتج
router.put('/reject/:id', verifyAuth, isAdmin, rejectProduct);   // رفض منتج

module.exports = router;