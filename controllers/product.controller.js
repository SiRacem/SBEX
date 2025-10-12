// controllers/product.controller.js
const Product = require("../models/Product");
const User = require("../models/User");
const Notification = require('../models/Notification');
// --- [!!!] استيراد موديل طلب الوساطة [!!!] ---
const MediationRequest = require('../models/MediationRequest');
const mongoose = require('mongoose');
const config = require('config');
const { sendUserStatsUpdate } = require('./user.controller'); // [!!!] استيراد الدالة الجديدة

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

    if (!userId) {
        return res.status(401).json({ msg: "Unauthorized: User ID missing." });
    }

    const { title, description, imageUrls, linkType, category, price, currency, quantity } = req.body;
    if (!title || !description || !imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0 || !linkType || !price || !currency) {
        return res.status(400).json({ msg: "Missing required fields or invalid image data." });
    }

    try {
        const parsedPrice = parseFloat(price);
        const parsedQuantity = parseInt(quantity, 10) || 1;
        if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ msg: "Invalid price format." });
        if (isNaN(parsedQuantity) || parsedQuantity < 1) return res.status(400).json({ msg: "Invalid quantity format." });

        const defaultStatus = userRole === 'Admin' ? 'approved' : 'pending';
        const newProduct = new Product({
            title, description, imageUrls, linkType, category,
            price: parsedPrice, currency, quantity: parsedQuantity, user: userId,
            status: (userRole === 'Admin' && ['pending', 'approved', 'rejected'].includes(req.body.status)) ? req.body.status : defaultStatus,
            approvedBy: (userRole === 'Admin' && defaultStatus === 'approved') ? userId : undefined,
            approvedAt: (userRole === 'Admin' && defaultStatus === 'approved') ? Date.now() : undefined,
        });

        const savedProduct = await newProduct.save();
        const populatedProduct = await Product.findById(savedProduct._id).populate('user', 'fullName email').lean();

        if (savedProduct.status === 'pending' && userRole === 'Vendor') {
            const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();
            if (admins.length > 0) {
                // ***** [!!!] هذا هو التعديل الأهم هنا [!!!] *****
                const notificationDocs = admins.map(admin => ({
                    user: admin._id,
                    type: 'NEW_PRODUCT_PENDING',
                    title: 'notification_titles.NEW_PRODUCT_PENDING', // <-- استخدام مفتاح الترجمة
                    message: 'notification_messages.NEW_PRODUCT_PENDING', // <-- استخدام مفتاح الترجمة
                    messageParams: { // <-- إضافة المتغيرات
                        vendorName: req.user.fullName || 'Unknown',
                        productName: savedProduct.title || 'Untitled'
                    },
                    relatedEntity: { id: savedProduct._id, modelName: 'Product' }
                }));
                // ***** نهاية التعديل *****

                const createdNotifications = await Notification.insertMany(notificationDocs);

                if (req.io && req.onlineUsers) {
                    const productForSocket = populatedProduct || savedProduct.toObject();
                    createdNotifications.forEach(notificationFromDB => {
                        const adminSocketId = req.onlineUsers[notificationFromDB.user.toString()];
                        if (adminSocketId) {
                            req.io.to(adminSocketId).emit('new_product_for_approval', productForSocket);
                            req.io.to(adminSocketId).emit('new_notification', notificationFromDB.toObject());
                        }
                    });
                }
            }
        }
        res.status(201).json(populatedProduct || savedProduct.toObject());
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ msg: "Failed to add product due to server error." });
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
            // --- [!!!] هذا هو السطر الحاسم الذي يجب إضافته [!!!] ---
            .populate({
                path: 'bids.user', // المسار: حقل user داخل كل عنصر في مصفوفة bids
                select: 'fullName avatarUrl' // اختر الحقول التي تحتاجها فقط للأداء الأفضل
            })
            // -----------------------------------------------------------
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
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) return res.status(400).json({ msg: "Invalid image data: imageUrls must be a non-empty array." });
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
        if (isNaN(parsedQuantity) || parsedQuantity < 1) return res.status(400).json({ msg: "Invalid quantity format (must be 1 or more)." });
        updateData.quantity = parsedQuantity;
    }

    let statusChangedToPending = false;
    let wasApprovedByAdminUpdate = false;
    let oldBids = [];

    try {
        const product = await Product.findById(productId);
        if (!product) { return res.status(404).json({ msg: "Product not found" }); }

        if (currentUserRole !== 'Admin' && product.user.toString() !== currentUserId.toString()) {
            return res.status(403).json({ msg: "Forbidden: You can only update your own products." });
        }

        if (currentUserRole === 'Admin' && status !== undefined) {
            if (!['pending', 'approved', 'rejected'].includes(status)) {
                return res.status(400).json({ msg: "Invalid status value provided by admin." });
            }
            updateData.status = status;
            if (status === 'approved' && product.status !== 'approved') {
                updateData.approvedBy = currentUserId;
                updateData.approvedAt = Date.now();
                wasApprovedByAdminUpdate = true;
            }
        } else if (currentUserRole !== 'Admin') {
            const criticalFieldsChanged = ['title', 'description', 'imageUrls', 'linkType', 'category', 'price', 'currency', 'quantity']
                .some(field => {
                    if (updateData[field] === undefined) return false;
                    return JSON.stringify(updateData[field]) !== JSON.stringify(product[field]);
                });

            if (criticalFieldsChanged) {
                if (['approved', 'rejected'].includes(product.status)) {
                    updateData.status = 'pending';
                    updateData.approvedBy = undefined;
                    updateData.approvedAt = undefined;
                    statusChangedToPending = true;

                    if (product.bids && product.bids.length > 0) {
                        oldBids = [...product.bids];
                        updateData.bids = [];
                    }
                }
            }
        }

        if (Object.keys(updateData).length === 0) {
            const currentProductPopulated = await Product.findById(productId).populate('user bids.user buyer currentMediationRequest').lean();
            return res.status(200).json(currentProductPopulated);
        }

        const productAfterUpdate = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('user bids.user buyer currentMediationRequest');

        if (!productAfterUpdate) {
            return res.status(404).json({ msg: "Product update failed." });
        }

        if (req.io) {
            req.io.emit('product_updated', productAfterUpdate.toObject());
        }

        // [!!!] الجزء المُصحح لإشعار المزايدين [!!!]
        if (oldBids.length > 0) {
            const uniqueBidders = [...new Set(oldBids.map(bid => bid.user.toString()))];
            const notificationsForBidders = uniqueBidders.map(bidderId => ({
                user: bidderId,
                type: 'BID_CANCELLED_BY_UPDATE',
                title: 'notification_titles.BID_CANCELLED_BY_UPDATE',
                message: 'notification_messages.BID_CANCELLED_BY_UPDATE',
                messageParams: {
                    productName: product.title
                },
                relatedEntity: { id: productId, modelName: 'Product' }
            }));

            // [!!!] الخطوة الصحيحة: استخدم نتيجة insertMany
            const createdNotifications = await Notification.insertMany(notificationsForBidders);

            if (req.io && req.onlineUsers) {
                createdNotifications.forEach(notif => {
                    const socketId = req.onlineUsers[notif.user.toString()];
                    if (socketId) {
                        req.io.to(socketId).emit('new_notification', notif.toObject());
                    }
                });
            }
        }

        if (statusChangedToPending) {
            const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();
            if (admins.length > 0) {
                const notifications = admins.map(admin => ({
                    user: admin._id, type: 'PRODUCT_UPDATE_PENDING',
                    title: 'notification_titles.PRODUCT_UPDATE_PENDING',
                    message: 'notification_messages.PRODUCT_UPDATE_PENDING',
                    messageParams: {
                        vendorName: req.user.fullName || 'Unknown',
                        productName: productAfterUpdate.title
                    },
                    relatedEntity: { id: productAfterUpdate._id, modelName: 'Product' }
                }));
                const createdAdminNotifications = await Notification.insertMany(notifications);

                if (req.io && req.onlineUsers) {
                    createdAdminNotifications.forEach(notif => {
                        const adminSocketId = req.onlineUsers[notif.user.toString()];
                        if (adminSocketId) {
                            req.io.to(adminSocketId).emit('new_notification', notif.toObject());
                        }
                    });
                }
            }
        }

        res.status(200).json(productAfterUpdate.toObject());

    } catch (error) {
        console.error("Error updating product in controller:", error);
        if (!res.headersSent) {
            res.status(500).json({ errors: "Failed to update product due to a server error." });
        }
    }
};

// --- Delete Product ---
exports.deleteProducts = async (req, res) => {
    const productId = req.params.id;
    const currentUserId = req.user?._id;
    const currentUserRole = req.user?.userRole;
    const reason = req.body?.reason; // سبب الحذف إذا قدمه الأدمن

    console.log(`--- Controller: deleteProducts for ID: ${productId} by User: ${currentUserId} (${currentUserRole}) ---`);
    if (reason) { console.log("Reason provided:", reason); }
    else { console.log("No reason provided."); }

    if (!mongoose.Types.ObjectId.isValid(productId)) { return res.status(400).json({ msg: "Invalid Product ID." }); }
    if (!currentUserId) { return res.status(401).json({ msg: "Unauthorized" }); }

    try {
        const product = await Product.findById(productId).populate('user', 'fullName'); // جلب المنتج للتحقق من الملكية وللإشعار
        if (!product) { return res.status(404).json({ msg: "Product not found" }); }

        // التحقق من صلاحيات الحذف
        if (currentUserRole !== 'Admin' && product.user._id.toString() !== currentUserId.toString()) {
            return res.status(403).json({ msg: "Forbidden: You can only delete your own products." });
        }

        // --- [!] حذف المنتج من قاعدة البيانات ---
        const deletedProductResult = await Product.findByIdAndDelete(productId);
        // findByIdAndDelete يرجع المنتج المحذوف أو null إذا لم يتم العثور عليه

        if (!deletedProductResult) {
            // هذا لا ينبغي أن يحدث إذا كان التحقق الأول من المنتج ناجحًا، لكن كإجراء احترازي
            console.warn(`[deleteProducts] Product ${productId} was not found for deletion, though it was found earlier.`);
            return res.status(404).json({ msg: "Product could not be deleted (not found)." });
        }
        console.log("[deleteProducts] Product deleted successfully from database.");


        // --- [!!! التعديل المهم هنا: إرسال حدث Socket.IO !!!] ---
        if (req.io) {
            // أرسل فقط ID المنتج المحذوف
            req.io.emit('product_deleted', { productId: productId }); // استخدم productId من req.params
            console.log(`[ProductCtrl Delete] Emitted 'product_deleted' for product ID: ${productId} to all clients.`);
        } else {
            console.warn("[ProductCtrl Delete] Socket.IO (req.io) not available. Skipping socket emission for product_deleted.");
        }
        // --- نهاية التعديل ---


        // --- إنشاء إشعار للمالك (إذا حذف المسؤول منتج البائع) ---
        const productOwnerId = product.user?._id;
        if (currentUserRole === 'Admin' && productOwnerId && productOwnerId.toString() !== currentUserId.toString()) {
            console.log(`[deleteProducts] Admin deletion detected. Creating notification for user: ${productOwnerId}`);
            try {
                const deletionNotification = new Notification({
                    user: productOwnerId,
                    type: 'PRODUCT_DELETED',
                    title: 'notification_titles.PRODUCT_DELETED',
                    message: 'notification_messages.PRODUCT_DELETED',
                    messageParams: {
                        productName: product.title,
                        adminName: req.user.fullName,
                        reason: reason
                    },
                    relatedEntity: { id: productId, modelName: 'Product' }
                });
                await deletionNotification.save();
                console.log("[deleteProducts] Deletion notification saved successfully.");

                // إرسال عبر Socket للمالك
                if (req.io && req.onlineUsers) {
                    const ownerSocketId = req.onlineUsers[productOwnerId.toString()];
                    if (ownerSocketId) {
                        req.io.to(ownerSocketId).emit('new_notification', deletionNotification.toObject());
                        console.log(`[deleteProducts] Socket deletion notification sent to user ${productOwnerId}`);
                    }
                }
            } catch (notifyError) { console.error("[deleteProducts] Error creating/sending deletion notification:", notifyError); }
        }
        // --- نهاية الإشعار ---

        // إرجاع رسالة نجاح و ID المنتج المحذوف
        res.status(200).json({ msg: "Product deleted successfully.", productId: productId });

    } catch (error) {
        console.error("Error in deleteProducts controller:", error);
        if (!res.headersSent) {
            res.status(500).json({ errors: "Failed to delete product." });
        }
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Product.findOneAndUpdate(
            { _id: productId, status: 'pending' },
            { $set: { status: 'approved', approvedBy: adminUserId, approvedAt: Date.now() } },
            { new: true, session: session }
        ).populate('user', '_id fullName');

        if (!product) {
            const existingProduct = await Product.findById(productId).session(session);
            await session.abortTransaction();
            if (existingProduct) return res.status(400).json({ msg: `Product already processed. Current status: ${existingProduct.status}` });
            return res.status(404).json({ msg: `Product with ID ${productId} not found.` });
        }

        const seller = product.user;
        await User.updateOne({ _id: seller._id }, { $inc: { activeListingsCount: 1 } }, { session: session });

        const approvalNotification = new Notification({
            user: seller._id,
            type: 'PRODUCT_APPROVED',
            title: 'notification_titles.PRODUCT_APPROVED',
            message: 'notification_messages.PRODUCT_APPROVED',
            messageParams: { productName: product.title, adminName: adminFullName },
            relatedEntity: { id: product._id, modelName: 'Product' }
        });
        await approvalNotification.save({ session: session });
        await session.commitTransaction();

        if (req.io) {
            const populatedProduct = await Product.findById(product._id).populate('user', 'fullName email').lean();
            if (populatedProduct) {
                req.io.emit('product_updated', populatedProduct);
            }
            const sellerSocketId = req.onlineUsers[seller._id.toString()];
            if (sellerSocketId) {
                req.io.to(sellerSocketId).emit('new_notification', approvalNotification.toObject());
                sendUserStatsUpdate(req, seller._id);
            }
        }
        res.status(200).json(product);
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error approving product:", error);
        res.status(500).json({ errors: "Failed to approve product due to a server error." });
    } finally {
        session.endSession();
    }
};

// --- Reject Product ---
exports.rejectProduct = async (req, res) => {
    const productId = req.params.id;
    const adminUserId = req.user?._id;
    const adminFullName = req.user?.fullName;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ msg: "Invalid Product ID." });
    if (!reason || reason.trim() === '') return res.status(400).json({ msg: "Rejection reason is required." });

    try {
        const rejectedProduct = await Product.findOneAndUpdate(
            { _id: productId, status: 'pending' },
            { $set: { status: 'rejected' } },
            { new: true }
        ).populate('user', 'fullName email');

        if (!rejectedProduct) {
            const existing = await Product.findById(productId).lean();
            if (existing && (existing.status === 'approved' || existing.status === 'rejected')) return res.status(400).json({ msg: "Product already processed." });
            return res.status(404).json({ msg: "Pending product not found." });
        }

        const sellerId = rejectedProduct.user?._id;
        if (sellerId && sellerId.toString() !== adminUserId.toString()) {
            const rejectionNotification = new Notification({
                user: sellerId,
                type: 'PRODUCT_REJECTED',
                title: 'notification_titles.PRODUCT_REJECTED',
                message: 'notification_messages.PRODUCT_REJECTED',
                messageParams: { productName: rejectedProduct.title, adminName: adminFullName, reason: reason },
                relatedEntity: { id: productId, modelName: 'Product' }
            });
            await rejectionNotification.save();
            const sellerSocketId = req.onlineUsers[sellerId.toString()];
            if (sellerSocketId && req.io) {
                req.io.to(sellerSocketId).emit('new_notification', rejectionNotification.toObject());
            }
        }
        res.status(200).json({ msg: "Product status updated to rejected.", product: rejectedProduct.toObject() });
    } catch (error) {
        console.error("Error rejecting product:", error);
        res.status(500).json({ errors: "Failed to reject product." });
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

    const numericAmount = Number(amount);
    if (!mongoose.Types.ObjectId.isValid(productId) || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ translationKey: 'apiErrors.invalidInput' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Product.findById(productId).session(session);
        const bidder = await User.findById(bidderId).session(session);

        if (!product || !bidder) throw new Error('Product or Bidder not found.');
        if (product.user.equals(bidderId)) throw new Error('You cannot bid on your own product.');
        if (product.status !== 'approved') throw new Error('Bids can only be placed on approved products.');

        if (bidder.balance < MINIMUM_BALANCE_TO_PARTICIPATE) {
            const error = new Error("Insufficient balance for participation.");
            error.translationKey = "home.bidModal.balanceTooLowError";
            throw error;
        }

        const bidCurrency = product.currency;
        let bidAmountInTND = bidCurrency === 'USD' ? numericAmount * TND_USD_EXCHANGE_RATE : numericAmount;
        if (bidder.balance < bidAmountInTND) {
            const error = new Error("Insufficient balance for this bid.");
            error.translationKey = "home.bidModal.insufficientBalanceError";
            error.translationParams = {
                requiredTND: formatCurrency(bidAmountInTND, 'TND'),
                requiredOriginal: formatCurrency(numericAmount, bidCurrency),
                available: formatCurrency(bidder.balance, 'TND')
            };
            throw error;
        }

        const existingBidIndex = product.bids.findIndex(bid => bid.user.equals(bidderId));
        const isNewBid = existingBidIndex === -1;

        if (!isNewBid) {
            product.bids[existingBidIndex].amount = numericAmount;
            product.bids[existingBidIndex].createdAt = new Date();
        } else {
            product.bids.push({ user: bidderId, amount: numericAmount, currency: bidCurrency, createdAt: new Date() });
        }
        product.bids.sort((a, b) => b.amount - a.amount);
        await product.save({ session });

        if (product.user) {
            const notificationType = isNewBid ? 'NEW_BID' : 'BID_UPDATED';

            const notificationForSeller = new Notification({
                user: product.user,
                type: notificationType,
                title: `notification_titles.${notificationType}`,
                message: `notification_messages.${notificationType}`,
                messageParams: {
                    bidderName: bidderFullName,
                    amount: formatCurrency(numericAmount, bidCurrency),
                    productName: product.title
                },
                relatedEntity: { id: productId, modelName: 'Product' }
            });
            await notificationForSeller.save({ session });

            if (req.io && req.onlineUsers) {
                const sellerSocketId = req.onlineUsers[product.user.toString()];
                if (sellerSocketId) {
                    req.io.to(sellerSocketId).emit('new_notification', notificationForSeller.toObject());
                }
            }
        }

        await session.commitTransaction();

        const finalUpdatedProduct = await Product.findById(productId)
            .populate('user', 'fullName email avatarUrl')
            .populate('bids.user', 'fullName email avatarUrl')
            .lean();

        if (req.io) {
            req.io.emit('product_updated', finalUpdatedProduct);
        }

        res.status(isNewBid ? 201 : 200).json({
            msg: isNewBid ? "Bid placed successfully!" : "Bid updated successfully!",
            updatedProduct: finalUpdatedProduct
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(400).json({
            msg: error.message || 'Failed to place/update bid.',
            translationKey: error.translationKey,
            translationParams: error.translationParams
        });
    } finally {
        if (session) await session.endSession();
    }
};

// --- Get Product Bids ---
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
    const sellerId = req.user._id;
    const { bidUserId, bidAmount } = req.body;
    const numericBidAmount = Number(bidAmount);

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(bidUserId) || isNaN(numericBidAmount) || numericBidAmount <= 0) {
        return res.status(400).json({ msg: "Invalid input data." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Product.findById(productId).session(session);
        const buyer = await User.findById(bidUserId).session(session);

        if (!product || !buyer) throw new Error("Product or Buyer not found.");
        if (!product.user.equals(sellerId)) throw new Error("You are not the seller of this product.");
        if (product.status !== 'approved') throw new Error(`Product status is not 'approved'.`);

        const newMediationRequest = new MediationRequest({
            product: product._id, seller: sellerId, buyer: buyer._id,
            bidAmount: numericBidAmount, bidCurrency: product.currency,
            status: 'PendingMediatorSelection',
        });
        await newMediationRequest.save({ session });

        product.status = 'PendingMediatorSelection';
        product.buyer = buyer._id;
        product.agreedPrice = numericBidAmount;
        product.currentMediationRequest = newMediationRequest._id;
        await product.save({ session });

        const notificationsForAccept = [
            {
                user: buyer._id,
                type: 'BID_ACCEPTED_PENDING_MEDIATOR',
                title: 'notification_titles.BID_ACCEPTED_PENDING_MEDIATOR',
                message: 'notification_messages.BID_ACCEPTED_PENDING_MEDIATOR',
                messageParams: {
                    amount: formatCurrency(numericBidAmount, product.currency),
                    productName: product.title
                },
                relatedEntity: { id: newMediationRequest._id, modelName: 'MediationRequest' }
            },
            {
                user: sellerId,
                type: 'BID_ACCEPTED_SELLER',
                title: 'notification_titles.BID_ACCEPTED_SELLER',
                message: 'notification_messages.BID_ACCEPTED_SELLER',
                messageParams: { productName: product.title },
                relatedEntity: { id: newMediationRequest._id, modelName: 'MediationRequest' }
            }
        ];
        await Notification.insertMany(notificationsForAccept, { session });

        await session.commitTransaction();

        const finalUpdatedProduct = await Product.findById(productId).populate('user buyer bids.user').lean();
        if (req.io) {
            req.io.emit('product_updated', finalUpdatedProduct);
        }

        res.status(200).json({
            msg: "Bid accepted successfully! Please select a mediator.",
            updatedProduct: finalUpdatedProduct
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(400).json({ msg: error.message || 'Failed to accept bid.' });
    } finally {
        if (session) await session.endSession();
    }
};

// --- نهاية دالة acceptBid ---

// --- [!!!] دالة رفض المزايدة كاملة ومعدلة [!!!] ---
exports.rejectBid = async (req, res) => {
    const { productId } = req.params;
    const sellerId = req.user._id;
    const { bidUserId, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(bidUserId) || !reason || reason.trim() === '') {
        return res.status(400).json({ msg: "Invalid input data or missing rejection reason." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Product.findById(productId).session(session);
        const bidUser = await User.findById(bidUserId).select('fullName').session(session);

        if (!product || !bidUser) throw new Error("Product or Bidder not found.");
        if (!product.user.equals(sellerId)) throw new Error("You are not the seller of this product.");

        const bidIndex = product.bids.findIndex(b => b.user && b.user.equals(bidUserId));
        if (bidIndex > -1) {
            product.bids.splice(bidIndex, 1);
            await product.save({ session });
        }

        const bidderFullName = bidUser.fullName || 'Bidder';

        const notificationsToCreate = [
            {
                user: bidUserId,
                type: 'BID_REJECTED',
                title: 'notification_titles.BID_REJECTED',
                message: 'notification_messages.BID_REJECTED',
                messageParams: { productName: product.title, reason },
                relatedEntity: { id: productId, modelName: 'Product' }
            },
            {
                user: sellerId,
                type: 'BID_REJECTED_BY_YOU',
                title: 'notification_titles.BID_REJECTED_BY_YOU',
                message: 'notification_messages.BID_REJECTED_BY_YOU',
                // =========================================================================
                // [!!!] START: هذا هو السطر الذي تم إصلاحه [!!!]
                // =========================================================================
                messageParams: { productName: product.title, bidderName: bidderFullName },
                // =========================================================================
                // [!!!] END: نهاية السطر الذي تم إصلاحه [!!!]
                // =========================================================================
                relatedEntity: { id: productId, modelName: 'Product' }
            }
        ];
        await Notification.insertMany(notificationsToCreate, { session });

        await session.commitTransaction();

        const finalUpdatedProduct = await Product.findById(productId).populate('user bids.user').lean();
        if (req.io) {
            req.io.emit('product_updated', finalUpdatedProduct);
        }

        res.status(200).json({
            msg: "Bid rejected successfully.",
            updatedProduct: finalUpdatedProduct
        });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(400).json({ msg: error.message || "Failed to reject bid." });
    } finally {
        if (session) await session.endSession();
    }
};