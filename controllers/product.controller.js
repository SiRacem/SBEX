// controllers/product.controller.js
const Product = require("../models/Product");
const User = require("../models/User");
const Notification = require('../models/Notification');
// --- [!!!] استيراد موديل طلب الوساطة [!!!] ---
const MediationRequest = require('../models/MediationRequest');
const mongoose = require('mongoose');
const config = require('config');

// --- سعر الصرف ---
const TND_USD_EXCHANGE_RATE = config.get('TND_USD_EXCHANGE_RATE') || 3.0;
const MINIMUM_BALANCE_TO_PARTICIPATE = 6; // الحد الأدنى للمشاركة

// --- [!!!] إضافة دالة formatCurrency هنا [!!!] ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) {
        console.warn(`Helper formatCurrency called with invalid amount: ${amount}`);
        return "N/A"; // أو قيمة افتراضية أخرى
    }
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== 'string' || currencyCode.trim() === '') {
        console.warn(`Helper formatCurrency called with invalid currency code: ${currencyCode}. Defaulting to TND.`);
        safeCurrencyCode = "TND";
    }
    try {
        // استخدام Intl.NumberFormat لمرونة أكبر ودعم لغات مختلفة
        return new Intl.NumberFormat('en-US', { // استخدم locale مناسبة
            style: 'currency',
            currency: safeCurrencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    } catch (error) {
        // في حالة خطأ (مثل رمز عملة غير صالح)
        console.error(`Helper formatCurrency failed for code '${safeCurrencyCode}':`, error);
        return `${num.toFixed(2)} ${safeCurrencyCode}`; // عرض احتياطي
    }
};

// --- Add Product ---
exports.addProduct = async (req, res) => {
    const userId = req.user?._id;
    const userRole = req.user?.userRole;
    console.log(`--- Controller: addProduct by User: ${userId} (${userRole}) ---`);

    if (!userId) {
        return res.status(401).json({ msg: "Unauthorized: User ID missing." });
    }

    const {
        title, description, imageUrls, linkType, category, price, currency, quantity
    } = req.body;

    if (!title || !description || !imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0 || !linkType || !price || !currency) {
        return res.status(400).json({ msg: "Missing required fields or invalid image data." });
    }

    try {
        const parsedPrice = parseFloat(price);
        const parsedQuantity = parseInt(quantity, 10) || 1;

        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ msg: "Invalid price format." });
        }
        if (isNaN(parsedQuantity) || parsedQuantity < 1) {
            return res.status(400).json({ msg: "Invalid quantity format." });
        }

        const defaultStatus = userRole === 'Admin' ? 'approved' : 'pending';

        const newProduct = new Product({
            title, description, imageUrls, linkType, category,
            price: parsedPrice, currency, quantity: parsedQuantity,
            user: userId,
            status: (userRole === 'Admin' && ['pending', 'approved', 'rejected'].includes(req.body.status))
                ? req.body.status
                : defaultStatus,
            approvedBy: (userRole === 'Admin' && defaultStatus === 'approved') ? userId : undefined,
            approvedAt: (userRole === 'Admin' && defaultStatus === 'approved') ? Date.now() : undefined,
        });

        const savedProduct = await newProduct.save();
        console.log(`Product ${savedProduct._id} saved with status: ${savedProduct.status}`);

        const populatedProduct = await Product.findById(savedProduct._id)
            .populate('user', 'fullName email')
            .lean();

        // --- إرسال إشعار للمسؤولين إذا أضاف البائع منتجًا معلقًا ---
        if (savedProduct.status === 'pending' && userRole === 'Vendor') {
            try {
                const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();
                if (admins.length > 0) {
                    const notifications = admins.map(admin => ({
                        user: admin._id,
                        type: 'NEW_PRODUCT_PENDING',
                        title: 'New Product Pending Approval',
                        message: `Vendor "${req.user.fullName || 'Unknown'}" submitted a new product "${savedProduct.title || 'Untitled'}" for approval.`,
                        relatedEntity: { id: savedProduct._id, modelName: 'Product' }
                    }));
                    await Notification.insertMany(notifications);
                    console.log(`[addProduct] Sent ${notifications.length} pending product notifications to admins.`);

                    // --- [!] إرسال لحظي للأدمن (اختياري ولكن مفيد) ---
                    admins.forEach(admin => {
                        const adminSocketId = req.onlineUsers[admin._id.toString()];
                        if (adminSocketId) {
                            // نرسل أول إشعار كمثال، أو يمكنك إرسال رسالة عامة
                            req.io.to(adminSocketId).emit('new_notification', notifications[0]); // قد تحتاج لتعديل هذا حسب احتياجك
                            console.log(`[addProduct] Sent real-time notification to admin ${admin._id} via socket ${adminSocketId}`);
                        }
                    });
                    // --- نهاية الإرسال اللحظي للأدمن ---

                }
            } catch (notifyError) {
                console.error("[addProduct] Error creating admin notifications for new product:", notifyError);
            }
        }
        // --- نهاية إشعار المسؤولين ---

        res.status(201).json(populatedProduct || savedProduct.toObject());

    } catch (error) {
        console.error("Error adding product:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ errors: error.message });
        }
        if (!res.headersSent) {
            res.status(500).json({ errors: "Failed to add product due to server error." });
        }
    }
};

// --- Get ALL Products ---
exports.getProducts = async (req, res) => {
    console.log("--- Controller: getProducts ---");
    try {
        const products = await Product.find() // يمكنك إضافة فلتر هنا (مثلاً req.query)
            .sort({ date_added: -1 })
            .populate('user', 'fullName email avatarUrl') // معلومات البائع
            .populate('buyer', 'fullName email avatarUrl') // معلومات المشتري (إذا وجد)
            .populate({ // معلومات طلب الوساطة الحالي (إذا وجد)
                path: 'currentMediationRequest',
                select: '_id status sellerConfirmedStart buyerConfirmedStart mediator bidAmount bidCurrency', // اختر الحقول التي تحتاجها
                populate: { path: 'mediator', select: 'fullName avatarUrl _id' } // جلب معلومات الوسيط إذا تم تعيينه
            })
            .populate('buyer', 'fullName _id avatarUrl')
            .lean(); // .lean() للأداء إذا كنت لا تحتاج إلى طرق Mongoose الكاملة

        console.log(`Fetched ${products.length} products.`);
        res.status(200).json(products);
    } catch (error) {
        console.error("Error in getProducts:", error);
        res.status(500).json({ errors: "Failed to retrieve products." });
    }
};
// --- نهاية تعديل دالة getProducts ---

// --- Get ONE Product by ID ---
exports.getOneProduct = async (req, res) => {
    const productId = req.params.id;
    console.log(`--- Controller: getOneProduct for ID: ${productId} ---`);
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ errors: "Invalid Product ID format" });
    }
    try {
        const product = await Product.findById(productId)
            .populate('user', 'fullName email');
        if (!product) {
            console.log(`Product ${productId} not found.`);
            return res.status(404).json({ errors: "Product not found" });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error(`Error fetching product ${productId}:`, error);
        res.status(500).json({ errors: "Failed to retrieve product." });
    }
};

// --- Update Product ---
exports.updateProducts = async (req, res) => {
    const productId = req.params.id;
    const currentUserId = req.user?._id;
    const currentUserRole = req.user?.userRole;
    console.log(`--- Controller: updateProducts for ID: ${productId} by User: ${currentUserId} (${currentUserRole}) ---`);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ msg: "Invalid Product ID format." });
    }
    if (!currentUserId) {
        return res.status(401).json({ msg: "Unauthorized: User ID missing." });
    }

    const { title, description, imageUrls, linkType, category, price, currency, quantity, status } = req.body;
    let updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (imageUrls !== undefined) {
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) return res.status(400).json({ msg: "Invalid image data." });
        updateData.imageUrls = imageUrls;
    }
    if (linkType !== undefined) updateData.linkType = linkType;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) {
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ msg: "Invalid price format." });
        updateData.price = parsedPrice;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (quantity !== undefined) {
        const parsedQuantity = parseInt(quantity, 10);
        if (isNaN(parsedQuantity) || parsedQuantity < 1) return res.status(400).json({ msg: "Invalid quantity format." });
        updateData.quantity = parsedQuantity;
    }

    let statusChangedToPending = false;
    let wasApprovedByAdminUpdate = false; // متغير جديد لتتبع موافقة الأدمن هنا

    try {
        const product = await Product.findById(productId);
        if (!product) { return res.status(404).json({ msg: "Product not found" }); }

        if (currentUserRole !== 'Admin' && product.user.toString() !== currentUserId.toString()) {
            return res.status(403).json({ msg: "Forbidden: You can only update your own products." });
        }

        // --- منطق تحديث الحالة (تم تصحيحه ومراجعته) ---
        if (currentUserRole === 'Admin' && status !== undefined) {
            // الأدمن يمكنه تغيير الحالة
            if (!['pending', 'approved', 'rejected'].includes(status)) {
                return res.status(400).json({ msg: "Invalid status value." });
            }
            updateData.status = status;
            // إذا وافق الأدمن على منتج غير موافق عليه
            if (status === 'approved' && product.status !== 'approved') {
                updateData.approvedBy = currentUserId;
                updateData.approvedAt = Date.now();
                wasApprovedByAdminUpdate = true; // <-- الأدمن وافق هنا
            } else if (status === 'rejected' && product.status !== 'rejected') {
                // يمكنك إضافة منطق إشعار الرفض هنا إذا أردت إرسال إشعار عند رفض التحديث
                console.log(`[updateProducts] Admin rejected update for product ${productId}.`)
            }
        } else if (currentUserRole === 'Vendor') {
            // البائع يقوم بتحديث
            if (Object.keys(updateData).length > 0) { // فقط إذا كان هناك تغيير فعلي
                if (product.status === 'approved') { // <-- هل المنتج الحالي معتمد؟
                    console.log(`[updateProducts] Vendor update on approved product. Resetting status to 'pending'.`);
                    updateData.status = 'pending'; // <-- ✅ تعيين الحالة إلى pending
                    updateData.approvedBy = undefined;
                    updateData.approvedAt = undefined;
                    statusChangedToPending = true;    // <-- ✅ تعيين متغير الإشعار
                } else if (product.status === 'rejected') {
                    console.log("[updateProducts] Vendor updating a rejected product. Setting status back to pending.");
                    updateData.status = 'pending'; // <-- ✅ تعيين الحالة إلى pending
                    statusChangedToPending = true; // <-- ✅ تعيين متغير الإشعار
                } else if (product.status === 'pending') {
                    console.log("[updateProducts] Vendor updating a pending product.");
                    // لا نغير الحالة هنا، تبقى pending
                }
            }
            // --- *** المشكلة المحتملة هنا *** ---
            // delete updateData.status; // <--- ❌❌❌ هذا السطر يحذف الحالة التي قمت بتعيينها أعلاه!
            // --- *** نهاية المشكلة المحتملة *** ---
        }
        // --- نهاية منطق الحالة ---

        // منع البائع من تغيير المالك
        if (currentUserRole === 'Vendor') { delete updateData.user; }

        // لا تحديث إذا لم يكن هناك بيانات للتحديث
        if (Object.keys(updateData).length === 0) {
            console.log("[updateProducts] No actual data changes provided. Skipping update.");
            // أرجع المنتج الحالي بدون تغيير أو برسالة مناسبة
            return res.status(200).json(product.toObject());
        }

        // --- [!] تحديث المنتج أولاً ---
        const updatedProductResult = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData }, // <-- يتم استخدام updateData هنا
            { new: true, runValidators: true }
        ).populate('user', 'fullName email');

        if (!updatedProductResult) { return res.status(404).json({ msg: "Product update failed (maybe validation error)." }); }

        console.log(`[updateProducts] Product ${productId} updated. New status: ${updatedProductResult.status}`);

        // --- إرسال إشعار للمسؤولين إذا أعاد البائع المنتج للحالة المعلقة ---
        if (statusChangedToPending) {
            try {
                const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();
                if (admins.length > 0) {
                    const notifications = admins.map(admin => ({
                        user: admin._id, type: 'PRODUCT_UPDATE_PENDING',
                        title: 'Product Update Requires Re-Approval',
                        message: `Vendor "${req.user.fullName || 'Unknown'}" updated product "${updatedProductResult.title}". It requires re-approval.`,
                        relatedEntity: { id: updatedProductResult._id, modelName: 'Product' }
                    }));
                    await Notification.insertMany(notifications);
                    console.log("[updateProducts] Sent updated product pending notifications to admins.");
                    // يمكنك إضافة إرسال Socket.IO للأدمن هنا أيضاً إذا أردت
                }
            } catch (notifyError) { console.error("[updateProducts] Error creating admin notifications for updated product:", notifyError); }
        }
        // --- نهاية إشعار المسؤولين ---

        // --- [!] إرسال إشعار للبائع إذا وافق الأدمن على التحديث ---
        if (wasApprovedByAdminUpdate) { // <-- استخدم المتغير الصحيح
            const sellerId = updatedProductResult.user?._id;
            const adminFullName = req.user?.fullName || 'Admin';

            if (sellerId && sellerId.toString() !== currentUserId.toString()) { // تأكد أن الأدمن لا يوافق على منتجه بنفسه
                try {
                    const updateApprovalNotification = new Notification({
                        user: sellerId,
                        type: 'PRODUCT_APPROVED', // نفس نوع إشعار الموافقة
                        title: `Product Update Approved: ${updatedProductResult.title}`,
                        message: `Your updated product "${updatedProductResult.title}" has been approved by administrator "${adminFullName}".`,
                        relatedEntity: { id: updatedProductResult._id, modelName: 'Product' }
                    });
                    await updateApprovalNotification.save();
                    console.log(`[updateProducts] Update approval notification saved for user ${sellerId}.`);

                    // --- [!] إرسال عبر Socket ---
                    console.log(`[updateProducts] Attempting to send update approval notification to seller: ${sellerId}`);
                    const sellerSocketId = req.onlineUsers[sellerId.toString()];
                    console.log(`[updateProducts] Seller Socket ID found: ${sellerSocketId}`);
                    console.log('[updateProducts] Current onlineUsers:', req.onlineUsers);

                    if (sellerSocketId) {
                        req.io.to(sellerSocketId).emit('new_notification', updateApprovalNotification.toObject());
                        console.log(`[updateProducts] Socket update approval notification sent to user ${sellerId} via socket ${sellerSocketId}`);
                    } else {
                        console.log(`[updateProducts] User ${sellerId} not found in onlineUsers for update approval. Notification saved to DB.`);
                    }
                    // --- نهاية إرسال Socket ---

                } catch (notifyError) {
                    console.error(`[updateProducts] Error creating/sending update approval notification for user ${sellerId}:`, notifyError);
                }
            }
        }
        // --- نهاية إشعار قبول التحديث ---

        res.status(200).json(updatedProductResult.toObject());

    } catch (error) {
        console.error("Error updating product:", error);
        if (error.name === 'ValidationError') return res.status(400).json({ errors: error.message });
        if (!res.headersSent) res.status(500).json({ errors: "Failed to update product." });
    }
};

// --- Delete Product ---
exports.deleteProducts = async (req, res) => {
    const productId = req.params.id;
    const currentUserId = req.user?._id;
    const currentUserRole = req.user?.userRole;
    const reason = req.body?.reason;

    console.log(`--- Controller: deleteProducts for ID: ${productId} by User: ${currentUserId} (${currentUserRole}) ---`);
    if (reason) { console.log("Reason provided:", reason); }
    else { console.log("No reason provided."); }

    if (!mongoose.Types.ObjectId.isValid(productId)) { return res.status(400).json({ msg: "Invalid Product ID." }); }
    if (!currentUserId) { return res.status(401).json({ msg: "Unauthorized" }); }

    try {
        const product = await Product.findById(productId).populate('user', 'fullName');
        if (!product) { return res.status(404).json({ msg: "Product not found" }); }

        if (currentUserRole !== 'Admin' && product.user._id.toString() !== currentUserId.toString()) {
            return res.status(403).json({ msg: "Forbidden: You can only delete your own products." });
        }

        await Product.findByIdAndDelete(productId);
        console.log("[deleteProducts] Product deleted successfully from database.");

        // --- إنشاء إشعار للمالك (إذا حذف المسؤول منتج البائع) ---
        const productOwnerId = product.user?._id;
        if (currentUserRole === 'Admin' && productOwnerId && productOwnerId.toString() !== currentUserId.toString()) {
            console.log(`[deleteProducts] Admin deletion detected. Creating notification for user: ${productOwnerId}`);
            try {
                const deletionNotification = new Notification({
                    user: productOwnerId,
                    type: 'PRODUCT_DELETED',
                    title: `Product Deleted: ${product.title}`,
                    message: `Your product "${product.title}" was deleted by administrator "${req.user.fullName}". Reason: ${reason || 'No specific reason provided.'}`,
                    relatedEntity: { id: productId, modelName: 'Product' } // ID المنتج المحذوف
                });
                await deletionNotification.save();
                console.log("[deleteProducts] Deletion notification saved successfully.");

                // --- [!] إرسال عبر Socket ---
                console.log(`[deleteProducts] Attempting to send deletion notification to user: ${productOwnerId}`);
                const ownerSocketId = req.onlineUsers[productOwnerId.toString()];
                console.log(`[deleteProducts] Owner Socket ID found: ${ownerSocketId}`);
                console.log('[deleteProducts] Current onlineUsers:', req.onlineUsers);

                if (ownerSocketId) {
                    req.io.to(ownerSocketId).emit('new_notification', deletionNotification.toObject());
                    console.log(`[deleteProducts] Socket deletion notification sent to user ${productOwnerId} via socket ${ownerSocketId}`);
                } else {
                    console.log(`[deleteProducts] User ${productOwnerId} not found in onlineUsers for deletion. Notification saved to DB.`);
                }
                // --- نهاية إرسال Socket ---

            } catch (notifyError) { console.error("[deleteProducts] Error creating/sending deletion notification:", notifyError); }
        }
        // --- نهاية الإشعار ---

        res.status(200).json({ msg: "Product deleted successfully.", productId: productId });

    } catch (error) {
        console.error("Error in deleteProducts controller:", error);
        if (!res.headersSent) res.status(500).json({ errors: "Failed to delete product." });
    }
};

// --- Get Pending Products ---
exports.getPendingProducts = async (req, res) => {
    console.log("--- Controller: getPendingProducts (Admin) ---");
    try {
        const pendingProducts = await Product.find({ status: 'pending' })
            .sort({ date_added: 1 })
            .populate('user', 'fullName email');
        console.log(`Found ${pendingProducts.length} pending products.`);
        res.status(200).json(pendingProducts);
    } catch (error) {
        console.error("Error fetching pending products:", error);
        res.status(500).json({ errors: "Failed to retrieve pending products." });
    }
};

// --- Approve Product ---
exports.approveProduct = async (req, res) => {
    const productId = req.params.id;
    const adminUserId = req.user?._id;
    const adminFullName = req.user?.fullName;

    console.log(`--- Controller: approveProduct for ID: ${productId} by Admin: ${adminUserId} ---`);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ msg: "Invalid Product ID." });
    }
    if (!adminUserId || !adminFullName) {
        console.error("[approveProduct] Admin user data missing in request after authentication.");
        return res.status(401).json({ msg: "Unauthorized or missing admin details." });
    }

    try {
        const product = await Product.findById(productId);

        if (!product) {
            console.log(`[approveProduct] Product ${productId} not found.`);
            return res.status(404).json({ msg: `Product with ID ${productId} not found.` });
        }

        console.log(`[approveProduct] Found product. Current status: ${product.status}`);

        if (product.status !== 'pending') {
            console.log(`[approveProduct] Product status is not 'pending'. Aborting approval.`);
            return res.status(400).json({ msg: `Product is already processed (Current status: ${product.status}).` });
        }

        product.status = 'approved';
        product.approvedBy = adminUserId;
        product.approvedAt = Date.now();

        const updatedProduct = await product.save();
        console.log(`[approveProduct] Product saved. New status: ${updatedProduct.status}`);

        // --- [!] إنشاء وإرسال إشعار للبائع ---
        const sellerId = updatedProduct.user; // <-- ID البائع

        if (sellerId && sellerId.toString() !== adminUserId.toString()) {
            console.log(`[approveProduct] Creating approval notification for seller: ${sellerId}`);
            try {
                const approvalNotification = new Notification({
                    user: sellerId,
                    type: 'PRODUCT_APPROVED',
                    title: `Product Approved: ${updatedProduct.title}`,
                    message: `Congratulations! Your product "${updatedProduct.title || 'Untitled'}" has been approved by administrator "${adminFullName}".`,
                    relatedEntity: { id: updatedProduct._id, modelName: 'Product' }
                });
                await approvalNotification.save();
                console.log(`[approveProduct] Approval notification saved to DB for user ${sellerId}.`);

                // --- [!] إرسال عبر Socket ---
                console.log(`[approveProduct] Attempting to send approval notification to seller: ${sellerId}`);
                const sellerSocketId = req.onlineUsers[sellerId.toString()]; // البحث عن socket id للبائع
                console.log(`[approveProduct] Seller Socket ID found: ${sellerSocketId}`); // <--- طباعة ID الذي تم العثور عليه
                console.log('[approveProduct] Current onlineUsers:', req.onlineUsers); // <--- طباعة كل المسجلين للمقارنة

                if (sellerSocketId) {
                    req.io.to(sellerSocketId).emit('new_notification', approvalNotification.toObject());
                    console.log(`[approveProduct] Socket approval notification sent to user ${sellerId} via socket ${sellerSocketId}`);
                } else {
                    console.log(`[approveProduct] User ${sellerId} not found in onlineUsers. Notification only saved to DB.`); // <--- تحقق من هذه الرسالة
                }
                // --- نهاية إرسال Socket ---

            } catch (notifyError) {
                console.error(`[approveProduct] Error creating/sending approval notification for user ${sellerId}:`, notifyError);
            }
        } else if (sellerId && sellerId.toString() === adminUserId.toString()) {
            console.log("[approveProduct] Skipping notification: Admin approved their own product.");
        } else {
            console.log("[approveProduct] Skipping notification: Seller ID not found on the product.");
        }
        // --- نهاية إنشاء الإشعار ---

        const populatedProduct = await Product.findById(updatedProduct._id)
            .populate('user', 'fullName email')
            .lean();

        res.status(200).json(populatedProduct || updatedProduct.toObject());

    } catch (error) {
        console.error("Error approving product:", error);
        if (!res.headersSent) {
            res.status(500).json({ errors: "Failed to approve product due to a server error." });
        }
    }
};

// --- Reject Product ---
exports.rejectProduct = async (req, res) => {
    const productId = req.params.id;
    const adminUserId = req.user?._id;
    const adminFullName = req.user?.fullName; // اسم الأدمن للإشعار
    const { reason } = req.body;

    console.log(`--- Controller: rejectProduct ID: ${productId} by Admin: ${adminUserId} ---`);
    console.log("Reason:", reason);

    if (!mongoose.Types.ObjectId.isValid(productId)) { return res.status(400).json({ msg: "Invalid Product ID." }); }
    if (!reason || reason.trim() === '') { return res.status(400).json({ msg: "Rejection reason is required." }); }
    if (!adminUserId || !adminFullName) {
        console.error("[rejectProduct] Admin user data missing in request after authentication.");
        return res.status(401).json({ msg: "Unauthorized or missing admin details." });
    }

    try {
        const rejectedProduct = await Product.findOneAndUpdate(
            { _id: productId, status: 'pending' },
            { $set: { status: 'rejected' } },
            { new: true }
        ).populate('user', 'fullName email');

        if (!rejectedProduct) {
            const existing = await Product.findById(productId).lean();
            if (existing && (existing.status === 'approved' || existing.status === 'rejected')) return res.status(400).json({ msg: "Product already processed (approved or rejected)." });
            return res.status(404).json({ msg: "Pending product not found." });
        }
        console.log(`[rejectProduct] Product ${productId} status updated to 'rejected'.`);

        // --- [!] إنشاء وإرسال إشعار للبائع ---
        const sellerId = rejectedProduct.user?._id; // <-- ID البائع

        if (sellerId && sellerId.toString() !== adminUserId.toString()) {
            console.log(`[rejectProduct] Creating rejection notification for seller: ${sellerId}`);
            try {
                const rejectionNotification = new Notification({
                    user: sellerId,
                    type: 'PRODUCT_REJECTED',
                    title: `Product Rejected: ${rejectedProduct.title}`,
                    message: `Unfortunately, your product "${rejectedProduct.title}" was rejected by administrator "${adminFullName}". Reason: ${reason}`,
                    relatedEntity: { id: productId, modelName: 'Product' }
                });
                await rejectionNotification.save();
                console.log(`[rejectProduct] Rejection notification saved to DB for user ${sellerId}.`);

                // --- [!] إرسال عبر Socket ---
                console.log(`[rejectProduct] Attempting to send rejection notification to seller: ${sellerId}`);
                const sellerSocketId = req.onlineUsers[sellerId.toString()]; // البحث عن socket id للبائع
                console.log(`[rejectProduct] Seller Socket ID found: ${sellerSocketId}`); // <--- طباعة ID الذي تم العثور عليه
                console.log('[rejectProduct] Current onlineUsers:', req.onlineUsers); // <--- طباعة كل المسجلين للمقارنة

                if (sellerSocketId) {
                    req.io.to(sellerSocketId).emit('new_notification', rejectionNotification.toObject());
                    console.log(`[rejectProduct] Socket rejection notification sent to user ${sellerId} via socket ${sellerSocketId}`);
                } else {
                    console.log(`[rejectProduct] User ${sellerId} not found in onlineUsers. Notification only saved to DB.`); // <--- تحقق من هذه الرسالة
                }
                // --- نهاية إرسال Socket ---

            } catch (notifyError) {
                console.error(`[rejectProduct] Error creating/sending rejection notification for user ${sellerId}:`, notifyError);
            }
        } else if (sellerId && sellerId.toString() === adminUserId.toString()) {
            console.log("[rejectProduct] Skipping notification: Admin rejected their own product.");
        } else {
            console.log("[rejectProduct] Skipping notification: Seller ID not found on the product.");
        }
        // --- نهاية الإشعار ---

        res.status(200).json({ msg: "Product status updated to rejected.", product: rejectedProduct.toObject() });

    } catch (error) { // تغيير اسم المتغير لتجنب التضارب مع notifyError
        console.error("Error rejecting product:", error);
        if (!res.headersSent) {
            res.status(500).json({ errors: "Failed to reject product." });
        }
    }
};

// --- Get Product Counts by User ---
exports.getProductCountsByUser = async (req, res) => {
    const targetUserId = req.params.userId;
    const requesterUserId = req.user?._id;
    const requesterUserRole = req.user?.userRole;

    console.log(`--- Controller: getProductCountsByUser for User: ${targetUserId} (Requested by: ${requesterUserId}) ---`);
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) { return res.status(400).json({ errors: "Invalid User ID format" }); }

    if (requesterUserRole !== 'Admin' && requesterUserId.toString() !== targetUserId.toString()) {
        console.warn(`[getProductCountsByUser] Forbidden access attempt: User ${requesterUserId} tried to get counts for user ${targetUserId}.`);
        return res.status(403).json({ errors: "Forbidden: You can only view your own product counts." });
    }

    try {
        const approvedCount = await Product.countDocuments({ user: targetUserId, status: 'approved' });
        const pendingCount = await Product.countDocuments({ user: targetUserId, status: 'pending' });
        const rejectedCount = await Product.countDocuments({ user: targetUserId, status: 'rejected' });
        const soldCount = await Product.countDocuments({ user: targetUserId, status: 'sold' }); // <-- إضافة المباع

        // حساب المجموع الكلي
        const totalCount = approvedCount + pendingCount + rejectedCount + soldCount;

        console.log(`Counts for ${targetUserId}: Approved: ${approvedCount}, Pending: ${pendingCount}, Rejected: ${rejectedCount}, Sold: ${soldCount}, Total: ${totalCount}`);
        res.status(200).json({ approvedCount, pendingCount, rejectedCount, soldCount, totalCount }); // <-- إرجاع الكل
    } catch (error) {
        console.error(`Error getting counts for user ${targetUserId}:`, error);
        res.status(500).json({ errors: "Failed to retrieve product counts." });
    }
};

// --- Get User By ID ---
exports.getUserById = async (req, res) => {
    const userId = req.params.id;
    console.log(`--- Controller: getUserById for ID: ${userId} ---`);
    if (!mongoose.Types.ObjectId.isValid(userId)) { return res.status(400).json({ errors: "Invalid User ID format" }); }
    try {
        const user = await User.findById(userId).select('-password');
        if (!user) { return res.status(404).json({ message: "User not found" }); }
        res.status(200).json(user);
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        res.status(500).json({ errors: "Failed to retrieve user." });
    }
};

// --- Toggle Like Product ---
exports.toggleLikeProduct = async (req, res) => {
    const productId = req.params.productId;
    const userId = req.user._id;
    console.log(`--- Controller: toggleLikeProduct for Product: ${productId} by User: ${userId} ---`);
    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ msg: "Invalid Product ID format." });

    try {
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ msg: "Product not found." });

        const isLiked = product.likes.some(likeId => likeId.equals(userId));
        let updateOperation;
        let successMessage;

        if (isLiked) {
            updateOperation = { $pull: { likes: userId } };
            successMessage = "Product unliked successfully.";
            console.log(`[toggleLikeProduct] User ${userId} unliked product ${productId}`);
        } else {
            updateOperation = { $addToSet: { likes: userId } };
            successMessage = "Product liked successfully.";
            console.log(`[toggleLikeProduct] User ${userId} liked product ${productId}`);
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId, updateOperation, { new: true }
        ).select('likes'); // يكفي جلب الإعجابات فقط

        res.status(200).json({
            msg: successMessage,
            likesCount: updatedProduct.likes.length,
            userLiked: !isLiked // الحالة الجديدة للإعجاب
        });

    } catch (error) {
        console.error("Error toggling product like:", error);
        if (!res.headersSent) res.status(500).json({ errors: "Server error while updating like status." });
    }
};

// --- Place Bid On Product ---
exports.placeBidOnProduct = async (req, res) => {
    const { productId } = req.params;
    const bidderId = req.user._id;
    const bidderFullName = req.user.fullName;
    const { amount } = req.body;

    console.log(`--- Controller: placeOrUpdateBid on Product: ${productId} by User: ${bidderId} for Amount: ${amount} ---`);

    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ msg: "Invalid Product ID format." });
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return res.status(400).json({ msg: 'Invalid bid amount specified (must be a positive number).' });

    const session = await mongoose.startSession();
    session.startTransaction();
    let isNewBid = true;

    try {
        const product = await Product.findById(productId).session(session);
        const bidder = await User.findById(bidderId).session(session);

        if (!product) throw new Error('Product not found.');
        if (!bidder) throw new Error('Bidder (User) not found.');
        if (product.user.equals(bidderId)) throw new Error('You cannot bid on your own product.');
        if (product.status !== 'approved') throw new Error('Bids can only be placed on approved products.');
        if (bidder.balance < MINIMUM_BALANCE_TO_PARTICIPATE) {
            const requiredCurrency = bidder.currency || 'TND';
            throw new Error(`You need at least ${MINIMUM_BALANCE_TO_PARTICIPATE.toFixed(2)} ${requiredCurrency} in your balance to place any bid.`);
        }

        const bidCurrency = product.currency;
        let bidAmountInTND;
        if (bidCurrency === 'USD') { bidAmountInTND = numericAmount * TND_USD_EXCHANGE_RATE; }
        else { bidAmountInTND = numericAmount; }
        if (bidder.balance < bidAmountInTND) {
            throw new Error(`Insufficient balance. You need ${bidAmountInTND.toFixed(2)} TND to cover this ${numericAmount.toFixed(2)} ${bidCurrency} bid, but you only have ${bidder.balance.toFixed(2)} TND.`);
        }

        const existingBidIndex = product.bids.findIndex(bid => bid.user.equals(bidderId));

        if (existingBidIndex > -1) {
            isNewBid = false;
            if (product.bids[existingBidIndex].amount === numericAmount) {
                await session.commitTransaction();
                session.endSession();
                console.log(`Bid amount for user ${bidderId} is already ${numericAmount}. No update needed.`);
                const currentBids = await Product.findById(productId).select('bids').populate('bids.user', 'fullName email');
                return res.status(200).json({ msg: "Bid amount is the same as your current bid.", bids: currentBids.bids });
            }
            console.log(`Updating existing bid for user ${bidderId}. Old: ${product.bids[existingBidIndex].amount}, New: ${numericAmount}`);
            product.bids[existingBidIndex].amount = numericAmount;
            product.bids[existingBidIndex].createdAt = new Date();
        } else {
            isNewBid = true;
            console.log(`Adding new bid for user ${bidderId}. Amount: ${numericAmount}`);
            const newBid = { user: bidderId, amount: numericAmount, currency: bidCurrency, createdAt: new Date() };
            product.bids.push(newBid);
        }

        product.bids.sort((a, b) => b.amount - a.amount);
        await product.save({ session });
        console.log(`Product bids updated successfully.`);

        if (product.user) {
            let notificationMessage; let notificationTitle; let notificationType;
            if (isNewBid) {
                notificationTitle = 'New Bid Received!';
                notificationMessage = `User "${bidderFullName}" placed a new bid of ${numericAmount.toFixed(2)} ${bidCurrency} on your product "${product.title}".`;
                notificationType = 'NEW_BID';
            } else {
                notificationTitle = 'Bid Updated!';
                notificationMessage = `User "${bidderFullName}" updated their bid to ${numericAmount.toFixed(2)} ${bidCurrency} on your product "${product.title}".`;
                notificationType = 'BID_UPDATED'; // تأكد من إضافة هذا النوع لـ Notification.js
            }
            await Notification.create([{
                user: product.user, type: notificationType, title: notificationTitle,
                message: notificationMessage, relatedEntity: { id: productId, modelName: 'Product' }
            }], { session });
            console.log(`Notification created for seller ${product.user}. Type: ${notificationType}`);
        }

        await session.commitTransaction();
        console.log("Place/Update bid transaction committed.");

        const updatedProductWithBids = await Product.findById(productId).select('bids').populate('bids.user', 'fullName email');
        res.status(isNewBid ? 201 : 200).json({
            msg: isNewBid ? "Bid placed successfully!" : "Bid updated successfully!",
            bids: updatedProductWithBids.bids
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("--- Controller: placeBidOnProduct ERROR ---:", error); // Log الخطأ الكامل
        // --- [!] إرجاع رسالة الخطأ المحددة التي تم رميها ---
        res.status(400).json({ msg: error.message || 'Failed to place/update bid.' });
        // --------------------------------------------------
    } finally {
        session.endSession();
        console.log("--- Controller: placeBidOnProduct END --- Session ended.");
    }
};
// --- نهاية دالة وضع/تعديل المزايدة ---

// --- Get Product Bids ---
// (الكود الخاص بجلب المزايدات يبقى كما هو)
exports.getProductBids = async (req, res) => {
    const productId = req.params.productId;
    console.log(`--- Controller: getProductBids for Product: ${productId} ---`);
    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ msg: "Invalid Product ID format." });

    try {
        const product = await Product.findById(productId)
            .select('bids')
            .populate('bids.user', 'fullName email');

        if (!product) return res.status(404).json({ msg: "Product not found." });
        product.bids.sort((a, b) => b.amount - a.amount);
        res.status(200).json(product.bids);

    } catch (error) {
        console.error("Error fetching product bids:", error);
        if (!res.headersSent) res.status(500).json({ errors: "Server error while fetching bids." });
    }
};

// --- Mark Product As Sold ---
// (الكود الخاص بتحديد المنتج كمباع يبقى كما هو)
exports.markProductAsSold = async (req, res) => {
    const { productId } = req.params;
    const sellerId = req.user._id;
    const { buyerId } = req.body;

    console.log(`--- Controller: markProductAsSold for Product: ${productId} by Seller: ${sellerId} to Buyer: ${buyerId} ---`);

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(buyerId)) {
        return res.status(400).json({ msg: "Invalid Product or Buyer ID format." });
    }

    try {
        const product = await Product.findOne({ _id: productId, user: sellerId, sold: false, status: 'approved' });
        if (!product) {
            return res.status(404).json({ msg: "Product not found, already sold, or you are not the seller." });
        }

        product.sold = true;
        product.status = 'sold';
        product.buyer = buyerId;
        product.soldAt = new Date();
        product.quantity = 0;

        await product.save();
        await User.findByIdAndUpdate(sellerId, { $inc: { productsSoldCount: 1 } });
        // يمكنك إرسال إشعار للمشتري هنا إذا أردت

        console.log(`[markProductAsSold] Product ${productId} marked as sold to ${buyerId}`);
        res.status(200).json({ msg: "Product marked as sold successfully.", product });

    } catch (error) {
        console.error(`Error marking product ${productId} as sold:`, error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error marking product as sold." });
        }
    }
};

// --- [!!!] تعديل كامل لدالة قبول المزايدة لتبدأ عملية اختيار الوسيط [!!!] ---
exports.acceptBid = async (req, res) => {
    const { productId } = req.params;
    const sellerId = req.user._id; // المستخدم الحالي (البائع)
    const { bidUserId, bidAmount } = req.body; // ID المزايد والمبلغ

    console.log(`--- Controller: acceptBid (Initiate Mediation) START ---`);
    console.log(`   ProductId: ${productId}, SellerId: ${sellerId}, BidUserId (Buyer): ${bidUserId}, BidAmount: ${bidAmount}`);

    const numericBidAmount = Number(bidAmount);

    // 1. التحقق من المدخلات
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(bidUserId) || !bidAmount || isNaN(numericBidAmount) || numericBidAmount <= 0) {
        console.error("   Validation Error: Invalid input data.");
        return res.status(400).json({ msg: "Invalid input data: Check IDs and bid amount." });
    }
    if (sellerId.equals(bidUserId)) {
        console.error("   Validation Error: Seller cannot accept their own bid.");
        return res.status(400).json({ msg: "Seller cannot accept their own bid." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for acceptBid.");

    try {
        // 2. جلب المنتج والمشتري والتحقق من الصلاحيات
        console.log("   Fetching product and buyer details...");
        const product = await Product.findById(productId).populate('user').session(session);
        const buyer = await User.findById(bidUserId).session(session);

        if (!product) {
            console.error("   Error: Product not found.");
            throw new Error("Product not found.");
        }
        if (!buyer) {
            console.error("   Error: Bidder (Buyer) not found.");
            throw new Error("Bidder (Buyer) not found.");
        }
        if (!product.user || !product.user._id.equals(sellerId)) {
            console.error("   Authorization Error: User is not the seller of this product.");
            throw new Error("You are not the seller of this product.");
        }
        if (product.status !== 'approved') {
            console.error(`   Validation Error: Product status is '${product.status}', not 'approved'.`);
            throw new Error(`Bids can only be accepted on 'approved' products. Current status: ${product.status}`);
        }
        console.log("   Product, buyer, and seller validation passed.");

        // 3. التحقق من وجود المزايدة بالمبلغ المحدد
        const acceptedBidDetails = product.bids.find(
            b => b.user && b.user.equals(bidUserId) && b.amount === numericBidAmount
        );
        if (!acceptedBidDetails) {
            console.error("   Validation Error: Specified bid details do not match.");
            throw new Error("The specified bid details (user and amount) do not match any existing bid on this product.");
        }
        console.log("   Matching bid found in product's bids array.");

        // 4. إنشاء طلب وساطة جديد
        console.log("   Creating new MediationRequest...");
        const newMediationRequest = new MediationRequest({
            product: product._id,
            seller: sellerId,
            buyer: buyer._id,
            bidAmount: numericBidAmount,
            bidCurrency: product.currency,
            status: 'PendingMediatorSelection',
        });
        await newMediationRequest.save({ session });
        console.log(`   MediationRequest created successfully: ${newMediationRequest._id}`);

        // 5. تحديث المنتج: الحالة، المشتري، السعر المتفق عليه، وربط طلب الوساطة
        console.log("   Updating product status and linking MediationRequest...");
        product.status = 'PendingMediatorSelection';
        product.buyer = buyer._id;
        product.agreedPrice = numericBidAmount;
        product.currentMediationRequest = newMediationRequest._id;
        
        await product.save({ session });
        console.log(`   Product ${productId} updated: Status to 'PendingMediatorSelection', buyer set, agreedPrice set, currentMediationRequest linked.`);

        // 6. إنشاء وإرسال الإشعارات
        console.log("   Creating notifications for buyer and seller...");
        const buyerNotificationMessage = `Congratulations! Your bid of ${formatCurrency(numericBidAmount, product.currency)} for "${product.title}" was accepted. The seller will now select a mediator to proceed with the transaction.`;
        const sellerNotificationMessage = `You have accepted the bid of ${formatCurrency(numericBidAmount, product.currency)} from user "${buyer.fullName || 'Bidder'}" for your product "${product.title}". Please select a mediator to continue.`;

        const notificationsForAccept = [
            {
                user: buyer._id,
                type: 'BID_ACCEPTED_PENDING_MEDIATOR', // تأكد أن هذا النوع موجود في Notification model enum
                title: 'Bid Accepted - Awaiting Mediator',
                message: buyerNotificationMessage,
                relatedEntity: { id: product._id, modelName: 'Product' },
                secondaryRelatedEntity: { id: newMediationRequest._id, modelName: 'MediationRequest' }
            },
            {
                user: sellerId,
                type: 'BID_ACCEPTED_SELECT_MEDIATOR', // تأكد أن هذا النوع موجود في Notification model enum
                title: 'Action Required: Select Mediator',
                message: sellerNotificationMessage,
                relatedEntity: { id: product._id, modelName: 'Product' },
                secondaryRelatedEntity: { id: newMediationRequest._id, modelName: 'MediationRequest' }
            }
        ];
        // --- [!!!] استخدام insertMany مع الخيارات الصحيحة داخل الجلسة [!!!] ---
        await Notification.insertMany(notificationsForAccept, { session: session, ordered: true });
        console.log("   Notifications created and saved successfully using insertMany.");

        // 7. إتمام المعاملة
        await session.commitTransaction();
        console.log("   acceptBid transaction committed successfully.");

        // 8. إرجاع المنتج المحدث بالكامل لـ Redux لتحديث الحالة بسهولة
        const populatedUpdatedProduct = await Product.findById(product._id)
            .populate('user', 'fullName email avatarUrl')
            .populate('buyer', 'fullName email avatarUrl')
            .populate({
                path: 'currentMediationRequest',
                select: '_id status'
            })
            .lean();

        console.log("   Returning updated product:", JSON.stringify(populatedUpdatedProduct, null, 2));
        res.status(200).json({
            msg: "Bid accepted successfully! Please select a mediator to proceed.",
            updatedProduct: populatedUpdatedProduct
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[ProductCtrl acceptBid] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: acceptBid ERROR ---", error); // طباعة الخطأ الكامل
        res.status(400).json({ msg: error.message || 'Failed to accept bid. Please try again.' });
    } finally {
        if (session && session.endSession && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: acceptBid END --- Session ended.");
    }
};
// --- نهاية دالة acceptBid ---

// --- [!!!] دالة رفض المزايدة كاملة ومعدلة [!!!] ---
exports.rejectBid = async (req, res) => {
    const { productId } = req.params;
    const sellerId = req.user._id; // المستخدم الحالي (البائع)
    const { bidUserId, reason } = req.body; // ID المزايد وسبب الرفض

    console.log(`--- Controller: rejectBid START ---`);
    console.log(`   ProductId: ${productId}, SellerId: ${sellerId}, BidUserId (Rejected): ${bidUserId}, Reason: ${reason}`);

    // 1. التحقق من المدخلات
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(bidUserId) || !reason || reason.trim() === '') {
        console.error("   Validation Error: Invalid IDs or missing rejection reason.");
        return res.status(400).json({ msg: "Invalid IDs or missing rejection reason." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for rejectBid.");

    try {
        // 2. جلب المنتج والمستخدم المزايد (للحصول على اسمه للإشعار)
        console.log("   Fetching product and rejected bidder details...");
        const product = await Product.findById(productId).session(session);
        const bidUser = await User.findById(bidUserId).select('fullName').session(session); // جلب اسم المزايد فقط

        if (!product) {
            console.error("   Error: Product not found.");
            throw new Error("Product not found.");
        }
        if (!bidUser) {
            console.error("   Error: Bidder (User to be rejected) not found.");
            throw new Error("Bidder (User to be rejected) not found.");
        }
        if (!product.user.equals(sellerId)) {
            console.error("   Authorization Error: User is not the seller of this product.");
            throw new Error("You are not the seller of this product.");
        }
        console.log("   Product and bidder validation passed.");

        // 3. التحقق من وجود المزايدة وإزالتها
        const bidIndex = product.bids.findIndex(b => b.user && b.user.equals(bidUserId));
        if (bidIndex === -1) {
            console.warn(`   Warning: Bid from user ${bidUserId} not found on product ${productId}. No action taken on bids.`);
            // يمكنك أن تقرر إما إرجاع خطأ أو المتابعة بإنشاء الإشعارات فقط
            // throw new Error("Specified bid not found on this product.");
        } else {
            const rejectedBidAmount = product.bids[bidIndex].amount; // لحفظه في الإشعار
            const bidCurrency = product.bids[bidIndex].currency; // لحفظه في الإشعار
            product.bids.splice(bidIndex, 1); // إزالة المزايدة من المصفوفة
            await product.save({ session });
            console.log(`   Bid from ${bidUserId} (Amount: ${rejectedBidAmount} ${bidCurrency}) removed from product ${productId}.`);
        }
        
        // 4. إنشاء وإرسال الإشعارات
        console.log("   Creating rejection notifications...");
        const bidderFullName = bidUser.fullName || 'Bidder';
        const buyerMessage = `Unfortunately, your bid for "${product.title}" was rejected by the seller. Reason: ${reason}`;
        const sellerMessage = `You rejected the bid from ${bidderFullName} for "${product.title}". Reason: ${reason}`;

        const notificationsToCreate = [
            { user: bidUserId, type: 'BID_REJECTED', title: 'Your Bid Was Rejected', message: buyerMessage, relatedEntity: { id: productId, modelName: 'Product' } },
            { user: sellerId, type: 'BID_REJECTED_BY_YOU', title: 'You Rejected a Bid', message: sellerMessage, relatedEntity: { id: productId, modelName: 'Product' } }
        ];
        // --- [!!!] استخدام insertMany مع الخيارات الصحيحة داخل الجلسة [!!!] ---
        await Notification.insertMany(notificationsToCreate, { session: session, ordered: true });
        console.log("   Rejection notifications created and saved successfully using insertMany.");

        // 5. إتمام المعاملة
        await session.commitTransaction();
        console.log("   rejectBid transaction committed successfully.");

        // 6. إرجاع المنتج المحدث (مع المزايدات المحدثة)
        const updatedProductAfterReject = await Product.findById(productId)
            .populate('user', 'fullName email avatarUrl')
            .populate('bids.user', 'fullName email avatarUrl') // Populate المزايدات المتبقية
            .populate({ // Populate طلب الوساطة إذا كان موجودًا (قد لا يكون له علاقة مباشرة بالرفض ولكن جيد للاتساق)
                path: 'currentMediationRequest',
                select: '_id status'
            })
            .lean();

        console.log("   Returning updated product after rejection:", JSON.stringify(updatedProductAfterReject, null, 2));
        res.status(200).json({ 
            msg: "Bid rejected successfully.",
            updatedProduct: updatedProductAfterReject // إرجاع المنتج المحدث لـ Redux
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[ProductCtrl rejectBid] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: rejectBid ERROR ---", error); // طباعة الخطأ الكامل
        res.status(400).json({ msg: error.message || "Failed to reject bid." });
    } finally {
        if (session && session.endSession && typeof session.endSession === 'function') {
            await session.endSession();
        }
        console.log("--- Controller: rejectBid END --- Session ended.");
    }
};