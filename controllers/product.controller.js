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
                    const notificationDocs = admins.map(admin => ({
                        user: admin._id,
                        type: 'NEW_PRODUCT_PENDING',
                        title: 'New Product Pending Approval',
                        message: `Vendor "${req.user.fullName || 'Unknown'}" submitted a new product "${savedProduct.title || 'Untitled'}" for approval.`,
                        relatedEntity: { id: savedProduct._id, modelName: 'Product' }
                    }));
                    // [!] انتظر حتى يتم إنشاء الإشعارات في قاعدة البيانات واحصل عليها مع الـ IDs
                    const createdNotifications = await Notification.insertMany(notificationDocs);
                    console.log(`[addProduct] Created ${createdNotifications.length} pending product notifications in DB.`);

                    if (req.io && req.onlineUsers) {
                        const productForSocket = populatedProduct || savedProduct.toObject();
                        admins.forEach(admin => {
                            const adminSocketId = req.onlineUsers[admin._id.toString()];
                            if (adminSocketId) {
                                // Send the new product data directly to the admin's UI
                                req.io.to(adminSocketId).emit('new_product_for_approval', productForSocket);
                                console.log(`[addProduct] Emitted 'new_product_for_approval' to admin ${admin._id}`);
                            }
                        });
                    }
                    
                    // --- [!] إرسال لحظي للأدمن ---
                    createdNotifications.forEach(notificationFromDB => {
                        // ابحث عن socketId الخاص بالأدمن
                        const adminSocketId = req.onlineUsers[notificationFromDB.user.toString()];
                        if (adminSocketId) {
                            // أرسل كائن الإشعار الفعلي من قاعدة البيانات (الذي يحتوي على _id)
                            req.io.to(adminSocketId).emit('new_notification', notificationFromDB.toObject());
                            console.log(`[addProduct] Sent real-time notification to admin ${notificationFromDB.user.toString()} via socket ${adminSocketId}`);
                        } else {
                            console.log(`[addProduct] Admin ${notificationFromDB.user.toString()} not online for real-time notification.`);
                        }
                    });
                    // --- نهاية الإرسال اللحظي للأدمن ---
                }
            } catch (notifyError) {
                console.error("[addProduct] Error creating/sending admin notifications for new product:", notifyError);
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

    // تعبئة updateData بالحقول التي تم توفيرها فقط
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

    try {
        const product = await Product.findById(productId);
        if (!product) { return res.status(404).json({ msg: "Product not found" }); }

        // التحقق من الصلاحيات
        if (currentUserRole !== 'Admin' && product.user.toString() !== currentUserId.toString()) {
            return res.status(403).json({ msg: "Forbidden: You can only update your own products." });
        }

        // --- منطق تحديث الحالة ---
        if (currentUserRole === 'Admin' && status !== undefined) { // الأدمن يمكنه تغيير الحالة
            if (!['pending', 'approved', 'rejected'].includes(status)) {
                return res.status(400).json({ msg: "Invalid status value provided by admin." });
            }
            updateData.status = status;
            if (status === 'approved' && product.status !== 'approved') {
                updateData.approvedBy = currentUserId;
                updateData.approvedAt = Date.now();
                wasApprovedByAdminUpdate = true;
            } else if (status === 'rejected' && product.status !== 'rejected') {
                console.log(`[updateProducts] Admin rejected update for product ${productId}.`);
                // يمكنك إضافة إشعار هنا إذا أردت إعلام البائع برفض التحديث
            }
        } else if (currentUserRole === 'Vendor') {
            // إذا كان البائع يقوم بتحديث أي من الحقول الرئيسية لمنتج معتمد، يجب أن يعود المنتج إلى pending
            const criticalFieldsChanged = ['title', 'description', 'imageUrls', 'linkType', 'category', 'price', 'currency', 'quantity']
                .some(field => updateData[field] !== undefined && updateData[field] !== product[field]);

            if (criticalFieldsChanged) {
                if (product.status === 'approved') {
                    console.log(`[updateProducts] Vendor modified an approved product. Resetting status to 'pending'.`);
                    updateData.status = 'pending';
                    updateData.approvedBy = undefined; // إزالة الموافقة السابقة
                    updateData.approvedAt = undefined;
                    statusChangedToPending = true;
                } else if (product.status === 'rejected') { // إذا كان البائع يعدل منتجًا مرفوضًا
                    console.log("[updateProducts] Vendor updating a previously rejected product. Setting status back to 'pending'.");
                    updateData.status = 'pending';
                    statusChangedToPending = true;
                } else if (product.status === 'pending') {
                    console.log("[updateProducts] Vendor updating an already pending product. Status remains 'pending'.");
                    // لا حاجة لتغيير الحالة، ستبقى pending
                }
            }
            // إذا كان البائع يحاول تغيير الحالة مباشرة، تجاهل ذلك (الأدمن فقط يمكنه تغيير الحالة مباشرة)
            if (updateData.status && currentUserRole === 'Vendor' && updateData.status !== 'pending' && product.status !== updateData.status) {
                console.warn(`[updateProducts] Vendor attempted to change status directly to '${updateData.status}'. This is not allowed. Status will be determined by logic or remain as is if no critical fields changed.`);
                // إذا لم يتم تغيير أي حقل حرج ولم يتم ضبط الحالة إلى pending أعلاه، احتفظ بالحالة الأصلية
                if (!statusChangedToPending) delete updateData.status;
            }
        }
        // --- نهاية منطق الحالة ---

        // منع البائع من تغيير مالك المنتج
        if (currentUserRole === 'Vendor') {
            delete updateData.user;
        }

        // إذا لم يتم توفير أي بيانات للتحديث (بعد كل المنطق أعلاه)
        if (Object.keys(updateData).length === 0) {
            console.log("[updateProducts] No actual data changes provided or necessary. Skipping database update.");
            // أرجع المنتج الحالي مع populate لضمان الاتساق مع الردود الأخرى
            const currentProductPopulated = await Product.findById(productId)
                .populate('user', 'fullName email avatarUrl')
                .populate('bids.user', 'fullName email avatarUrl')
                .populate('buyer', 'fullName email avatarUrl')
                .populate({
                    path: 'currentMediationRequest',
                    select: '_id status sellerConfirmedStart buyerConfirmedStart mediator bidAmount bidCurrency',
                    populate: { path: 'mediator', select: 'fullName avatarUrl _id' }
                })
                .lean();
            return res.status(200).json(currentProductPopulated);
        }

        // --- تحديث المنتج في قاعدة البيانات ---
        const productAfterUpdate = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            // --- [!!! Populate مهم جدًا هنا للبيانات المرسلة عبر السوكيت وفي الرد !!!] ---
            .populate('user', 'fullName email avatarUrl')         // معلومات البائع
            .populate('bids.user', 'fullName email avatarUrl') // معلومات المستخدمين في المزايدات
            .populate('buyer', 'fullName email avatarUrl')         // معلومات المشتري (إذا تم البيع)
            .populate({                                          // معلومات طلب الوساطة الحالي
                path: 'currentMediationRequest',
                select: '_id status sellerConfirmedStart buyerConfirmedStart mediator bidAmount bidCurrency',
                populate: { path: 'mediator', select: 'fullName avatarUrl _id' }
            });
        // لا تستخدم .lean() هنا إذا كنت ستستدعي .save() أو طرق Mongoose أخرى لاحقًا،
        // ولكن إذا كان هذا هو الإجراء الأخير قبل الإرسال، يمكنك استخدام .lean() ثم .toObject() أو إرساله مباشرة.
        // للتبسيط، سنستخدم .toObject() عند الإرسال.

        if (!productAfterUpdate) {
            console.error(`[updateProducts] Product update failed for ID: ${productId}. findByIdAndUpdate returned null.`);
            return res.status(404).json({ msg: "Product update failed (product not found after update or validation error)." });
        }

        console.log(`[updateProducts] Product ${productId} updated successfully in DB. New status: ${productAfterUpdate.status}`);

        // --- [!!! هذا هو السطر المفقود والمهم جدًا !!!] ---
        // إرسال حدث Socket.IO لإعلام جميع العملاء المتصلين بتحديث المنتج
        if (req.io) {
            const productToSendViaSocket = productAfterUpdate.toObject(); // تحويل مستند Mongoose إلى كائن عادي للإرسال
            console.log("[ProductCtrl Update] Emitting 'product_updated' with data:", JSON.stringify(productToSendViaSocket, null, 2));
            req.io.emit('product_updated', productToSendViaSocket);
            console.log(`[ProductCtrl Update] Successfully emitted 'product_updated' for product ID: ${productAfterUpdate._id}`);
        } else {
            console.warn("[ProductCtrl Update] req.io (Socket.IO instance) is not available. Cannot emit 'product_updated' event.");
        }
        // --- نهاية إضافة سطر Socket.IO ---


        // --- إرسال الإشعارات كما في الكود الأصلي ---
        // إشعار للمسؤولين إذا أعاد البائع المنتج للحالة المعلقة
        if (statusChangedToPending) {
            try {
                const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();
                if (admins.length > 0) {
                    const notifications = admins.map(admin => ({
                        user: admin._id, type: 'PRODUCT_UPDATE_PENDING',
                        title: 'Product Update Requires Re-Approval',
                        message: `Vendor "${req.user.fullName || 'Unknown'}" updated product "${productAfterUpdate.title}". It now requires re-approval.`,
                        relatedEntity: { id: productAfterUpdate._id, modelName: 'Product' }
                    }));
                    const createdNotifications = await Notification.insertMany(notifications);
                    // إرسال لحظي للأدمن
                    if (req.io && req.onlineUsers) {
                        createdNotifications.forEach(notificationFromDB => {
                            const adminSocketId = req.onlineUsers[notificationFromDB.user.toString()];
                            if (adminSocketId) {
                                req.io.to(adminSocketId).emit('new_notification', notificationFromDB.toObject());
                            }
                        });
                    }
                    console.log("[updateProducts] Sent 'PRODUCT_UPDATE_PENDING' notifications to admins.");
                }
            } catch (notifyError) { console.error("[updateProducts] Error creating/sending admin notifications for product update requiring re-approval:", notifyError); }
        }

        // إشعار للبائع إذا وافق الأدمن على التحديث (هذا السيناريو يحدث عندما يغير الأدمن الحالة إلى approved)
        if (wasApprovedByAdminUpdate) {
            const sellerId = productAfterUpdate.user?._id; // ID البائع
            const adminFullName = req.user?.fullName || 'Admin';

            if (sellerId && sellerId.toString() !== currentUserId.toString()) { // تأكد أن الأدمن لا يوافق على منتجه
                try {
                    const updateApprovalNotification = new Notification({
                        user: sellerId,
                        type: 'PRODUCT_APPROVED', // يمكن استخدام نفس نوع إشعار الموافقة الأولية
                        title: `Product Update Approved: ${productAfterUpdate.title}`,
                        message: `Your updated product "${productAfterUpdate.title}" has been approved by administrator "${adminFullName}".`,
                        relatedEntity: { id: productAfterUpdate._id, modelName: 'Product' }
                    });
                    await updateApprovalNotification.save();
                    console.log(`[updateProducts] Update approval notification saved for user ${sellerId}.`);

                    if (req.io && req.onlineUsers) {
                        const sellerSocketId = req.onlineUsers[sellerId.toString()];
                        if (sellerSocketId) {
                            req.io.to(sellerSocketId).emit('new_notification', updateApprovalNotification.toObject());
                            console.log(`[updateProducts] Socket update approval notification sent to user ${sellerId}`);
                        }
                    }
                } catch (notifyError) {
                    console.error(`[updateProducts] Error creating/sending update approval notification for user ${sellerId}:`, notifyError);
                }
            }
        }
        // --- نهاية إرسال الإشعارات ---

        // إرجاع المنتج المحدث للعميل الذي قام بالطلب
        res.status(200).json(productAfterUpdate.toObject()); // أرجع الكائن المحول

    } catch (error) {
        console.error("Error updating product in controller:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ errors: error.message });
        }
        if (!res.headersSent) { // تأكد من عدم إرسال استجابة بالفعل
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
                    title: `Product Deleted: ${product.title}`, // استخدم product.title من الكائن الذي تم جلبه قبل الحذف
                    message: `Your product "${product.title}" was deleted by administrator "${req.user.fullName}". Reason: ${reason || 'No specific reason provided.'}`,
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

    console.log(`--- Controller: approveProduct for ID: ${productId} by Admin: ${adminUserId} ---`);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ msg: "Invalid Product ID." });
    }
    if (!adminUserId || !adminFullName) {
        return res.status(401).json({ msg: "Unauthorized or missing admin details." });
    }

    // --- [!!!] START: TRANSACTION LOGIC [!!!] ---
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // الخطوة 1: البحث عن المنتج وتحديث حالته داخل المعاملة
        const product = await Product.findOneAndUpdate(
            { _id: productId, status: 'pending' },
            { $set: { status: 'approved', approvedBy: adminUserId, approvedAt: Date.now() } },
            { new: true, session: session }
        ).populate('user', '_id fullName'); // نحتاج ID واسم البائع

        if (!product) {
            // تحقق مما إذا كان المنتج موجودًا ولكن ليس في حالة "pending"
            const existingProduct = await Product.findById(productId).session(session);
            if (existingProduct) {
                await session.abortTransaction();
                return res.status(400).json({ msg: `Product already processed. Current status: ${existingProduct.status}` });
            }
            await session.abortTransaction();
            return res.status(404).json({ msg: `Product with ID ${productId} not found.` });
        }

        console.log(`[approveProduct] Product ${productId} status updated to 'approved' in DB.`);
        const seller = product.user;

        // الخطوة 2: تحديث إحصائيات البائع داخل نفس المعاملة
        const userUpdateResult = await User.updateOne(
            { _id: seller._id },
            { $inc: { activeListingsCount: 1 } },
            { session: session }
        );

        if (userUpdateResult.modifiedCount === 0) {
            console.warn(`[approveProduct] User ${seller._id} activeListingsCount was not incremented. Maybe user not found?`);
        } else {
            console.log(`[approveProduct] Seller ${seller._id} activeListingsCount incremented.`);
        }

        // الخطوة 3: إنشاء إشعار للبائع داخل المعاملة
        const approvalNotification = new Notification({
            user: seller._id,
            type: 'PRODUCT_APPROVED',
            title: `Product Approved: ${product.title}`,
            message: `Congratulations! Your product "${product.title}" has been approved by administrator "${adminFullName}".`,
            relatedEntity: { id: product._id, modelName: 'Product' }
        });
        await approvalNotification.save({ session: session });
        console.log(`[approveProduct] Approval notification saved to DB for user ${seller._id}.`);

        // الخطوة 4: إتمام المعاملة قبل إرسال الأحداث
        await session.commitTransaction();
        console.log("[approveProduct] Transaction committed successfully.");

        // --- [!!!] START: SOCKET.IO EMISSIONS (AFTER SUCCESSFUL COMMIT) [!!!] ---
        if (req.io) {
            // 4.1: إرسال تحديث المنتج الكامل للجميع
            const populatedProduct = await Product.findById(product._id)
                .populate('user', 'fullName email avatarUrl')
                .populate('bids.user', 'fullName email avatarUrl')
                .lean(); // استخدم .lean() للأداء

            if (populatedProduct) {
                req.io.emit('product_updated', populatedProduct);
                console.log(`[Socket] Emitted 'product_updated' for approved product ID: ${product._id}`);
            }

            // 4.2: إرسال تحديث إشعار للبائع
            const sellerSocketId = req.onlineUsers[seller._id.toString()];
            if (sellerSocketId) {
                req.io.to(sellerSocketId).emit('new_notification', approvalNotification.toObject());
                console.log(`[Socket] Emitted 'new_notification' to seller ${seller._id}`);

                // 4.3: [الحل المباشر لمشكلتك] إرسال تحديث لملف البائع الشخصي
                const updatedSellerProfile = await User.findById(seller._id).select('-password').lean();
                if (updatedSellerProfile) {
                    req.io.to(sellerSocketId).emit('user_profile_updated', updatedSellerProfile);
                    console.log(`[Socket] Emitted 'user_profile_updated' to seller ${seller._id} to refresh stats.`);
                }
            }
        }
        // --- [!!!] END: SOCKET.IO EMISSIONS [!!!] ---

        res.status(200).json(product); // أرجع المنتج المحدث (بدون populate كامل، لأن الواجهة ستتحدث عبر السوكيت)

    } catch (error) {
        // إذا حدث خطأ في أي خطوة، قم بإلغاء المعاملة
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Error approving product:", error);
        if (!res.headersSent) {
            res.status(500).json({ errors: "Failed to approve product due to a server error." });
        }
    } finally {
        // إنهاء الجلسة دائمًا
        session.endSession();
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
    const { productId } = req.params; // ID المنتج من مسار الطلب
    const bidderId = req.user._id; // ID المستخدم الحالي (المزايد) من المصادقة
    const bidderFullName = req.user.fullName; // اسم المزايد الكامل للإشعارات
    const { amount } = req.body; // المبلغ المقدم في المزايدة من جسم الطلب

    console.log(`--- Controller: placeOrUpdateBid on Product: ${productId} by User: ${bidderId} for Amount: ${amount} ---`);

    // 1. التحقق الأولي من المدخلات
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        console.warn("   Validation Error: Invalid Product ID format.");
        return res.status(400).json({ msg: "Invalid Product ID format." });
    }
    const numericAmount = Number(amount); // تحويل المبلغ إلى رقم
    if (isNaN(numericAmount) || numericAmount <= 0) {
        console.warn("   Validation Error: Invalid bid amount (not a positive number).");
        return res.status(400).json({ msg: 'Invalid bid amount specified (must be a positive number).' });
    }

    // 2. بدء معاملة قاعدة البيانات لضمان التناسق (Atomicity)
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("   MongoDB session started for placeBidOnProduct.");

    let isNewBid = true; // متغير لتتبع ما إذا كانت هذه مزايدة جديدة أم تحديث لمزايدة موجودة

    try {
        // 3. جلب المنتج والمستخدم المزايد من قاعدة البيانات باستخدام الجلسة
        console.log("   Fetching product and bidder details from database...");
        const product = await Product.findById(productId).session(session); // لا نحتاج لـ populate هنا الآن
        const bidder = await User.findById(bidderId).session(session);

        // 4. التحقق من وجود المنتج والمزايد، وصلاحيات المزايدة
        if (!product) {
            console.error("   Error: Product not found in database.");
            throw new Error('Product not found.'); // سيتم التقاط هذا الخطأ في catch block
        }
        if (!bidder) {
            console.error("   Error: Bidder (User) not found in database.");
            throw new Error('Bidder (User) not found.');
        }
        if (product.user.equals(bidderId)) { // التحقق مما إذا كان المزايد هو مالك المنتج
            console.warn("   Authorization Error: User cannot bid on their own product.");
            throw new Error('You cannot bid on your own product.');
        }
        if (product.status !== 'approved') { // التحقق من أن المنتج معتمد وقابل للمزايدة
            console.warn(`   Validation Error: Product status is '${product.status}', not 'approved'.`);
            throw new Error('Bids can only be placed on approved products.');
        }
        // التحقق من أن رصيد المزايد كافٍ للمشاركة (حد أدنى عام)
        if (bidder.balance < MINIMUM_BALANCE_TO_PARTICIPATE) {
            const requiredCurrencyForParticipation = bidder.currency || 'TND'; // استخدام عملة المستخدم أو الافتراضية
            console.warn(`   Validation Error: Bidder balance (${bidder.balance} TND) is less than MINIMUM_BALANCE_TO_PARTICIPATE (${MINIMUM_BALANCE_TO_PARTICIPATE}).`);
            throw new Error(`You need at least ${formatCurrency(MINIMUM_BALANCE_TO_PARTICIPATE, requiredCurrencyForParticipation)} in your balance to place any bid.`);
        }

        // 5. التحقق من أن رصيد المزايد يغطي مبلغ المزايدة (بعد تحويل العملة إذا لزم الأمر)
        const bidCurrency = product.currency; // عملة المزايدة هي نفسها عملة المنتج
        let bidAmountInTND; // حساب قيمة المزايدة بالدينار التونسي للمقارنة مع رصيد المستخدم
        if (bidCurrency === 'USD') {
            bidAmountInTND = numericAmount * TND_USD_EXCHANGE_RATE;
        } else { // يفترض أن العملة هي TND إذا لم تكن USD
            bidAmountInTND = numericAmount;
        }
        bidAmountInTND = Number(bidAmountInTND.toFixed(2)); // تقريب لـ 2 خانات عشرية

        if (bidder.balance < bidAmountInTND) {
            console.warn(`   Validation Error: Insufficient balance. Bidder needs ${bidAmountInTND} TND, but has ${bidder.balance} TND.`);
            throw new Error(`Insufficient balance. You need ${formatCurrency(bidAmountInTND, 'TND')} (approx. ${formatCurrency(numericAmount, bidCurrency)}) to cover this bid, but you only have ${formatCurrency(bidder.balance, 'TND')}.`);
        }
        console.log(`   Balance check passed. Bidder balance: ${bidder.balance} TND, Bid in TND: ${bidAmountInTND} TND.`);

        // 6. التحقق مما إذا كان المستخدم قد قدم مزايدة سابقة على هذا المنتج
        const existingBidIndex = product.bids.findIndex(bid => bid.user.equals(bidderId));

        if (existingBidIndex > -1) {
            // إذا وجدت مزايدة سابقة، فهذا تحديث لمزايدة
            isNewBid = false; // تعيين المتغير للدلالة على تحديث
            const existingBidAmount = product.bids[existingBidIndex].amount;
            if (existingBidAmount === numericAmount) {
                // إذا كان المبلغ الجديد هو نفس المبلغ القديم، لا داعي للتحديث
                console.log(`   Bid amount (${numericAmount}) for user ${bidderId} is the same as current bid. No update needed.`);
                await session.commitTransaction(); // إنهاء المعاملة بنجاح لأنه لا يوجد تغيير فعلي
                // لا حاجة لـ session.endSession() هنا، سيتم في finally
                const currentBidsPopulatedNoChange = await Product.findById(productId).select('bids').populate('bids.user', 'fullName email avatarUrl'); // جلب المزايدات الحالية
                return res.status(200).json({ msg: "Bid amount is the same as your current bid.", bids: currentBidsPopulatedNoChange.bids });
            }
            // تحديث مبلغ المزايدة وتاريخها
            console.log(`   Updating existing bid for user ${bidderId}. Old amount: ${existingBidAmount}, New amount: ${numericAmount}`);
            product.bids[existingBidIndex].amount = numericAmount;
            product.bids[existingBidIndex].currency = bidCurrency; // تأكيد العملة
            product.bids[existingBidIndex].createdAt = new Date(); // تحديث وقت المزايدة
        } else {
            // إذا لم توجد مزايدة سابقة، فهذه مزايدة جديدة
            isNewBid = true; // المتغير مضبوط بالفعل على true
            console.log(`   Adding new bid for user ${bidderId}. Amount: ${numericAmount} ${bidCurrency}`);
            const newBidObject = {
                user: bidderId,
                amount: numericAmount,
                currency: bidCurrency,
                createdAt: new Date()
            };
            product.bids.push(newBidObject); // إضافة المزايدة الجديدة إلى مصفوفة المزايدات
        }

        // 7. فرز مصفوفة المزايدات دائمًا (من الأعلى إلى الأقل) بعد أي إضافة أو تعديل
        product.bids.sort((a, b) => b.amount - a.amount);

        // 8. حفظ التغييرات في المنتج (بما في ذلك المزايدات المحدثة) داخل الجلسة
        await product.save({ session });
        console.log(`   Product bids updated and saved successfully in database within session.`);

        // 9. إنشاء إشعار للبائع
        if (product.user) { // التأكد من أن للمنتج بائع
            let notificationMessage;
            let notificationTitle;
            let notificationType;

            if (isNewBid) {
                notificationTitle = 'New Bid Received!';
                notificationMessage = `User "${bidderFullName}" placed a new bid of ${formatCurrency(numericAmount, bidCurrency)} on your product "${product.title}".`;
                notificationType = 'NEW_BID';
            } else { // تحديث مزايدة
                notificationTitle = 'Bid Updated!';
                notificationMessage = `User "${bidderFullName}" updated their bid to ${formatCurrency(numericAmount, bidCurrency)} on your product "${product.title}".`;
                notificationType = 'BID_UPDATED'; // تأكد من وجود هذا النوع في نموذج الإشعارات
            }

            const notificationForSeller = new Notification({
                user: product.user, // ID بائع المنتج
                type: notificationType,
                title: notificationTitle,
                message: notificationMessage,
                relatedEntity: { id: productId, modelName: 'Product' }
            });
            await notificationForSeller.save({ session }); // حفظ الإشعار داخل الجلسة
            console.log(`   Notification for bid action (type: ${notificationType}) created for seller ${product.user}.`);

            // إرسال الإشعار الفوري للبائع إذا كان متصلاً
            if (req.io && req.onlineUsers) {
                const sellerSocketId = req.onlineUsers[product.user.toString()];
                if (sellerSocketId) {
                    req.io.to(sellerSocketId).emit('new_notification', notificationForSeller.toObject());
                    console.log(`   [Socket] Sent 'new_notification' for bid to seller ${product.user} via socket ${sellerSocketId}.`);
                } else {
                    console.log(`   Seller ${product.user} not online for real-time bid notification.`);
                }
            }
        } else {
            console.warn("   Product does not have an associated seller (product.user is null/undefined). Skipping seller notification.");
        }

        // 10. إتمام المعاملة (Commit) لحفظ كل التغييرات في قاعدة البيانات
        await session.commitTransaction();
        console.log("   Place/Update bid transaction committed successfully.");

        // 11. جلب المنتج المحدث بالكامل مع كل البيانات اللازمة (populate) لإرساله
        // هذا يضمن أن البيانات المرسلة للسوكيت وللرد هي الأحدث وتحتوي على كل التفاصيل.
        const finalUpdatedProduct = await Product.findById(productId)
            .populate('user', 'fullName email avatarUrl')         // معلومات البائع
            .populate('bids.user', 'fullName email avatarUrl') // معلومات المستخدمين في المزايدات
            .populate('buyer', 'fullName email avatarUrl')         // معلومات المشتري (إذا تم البيع)
            .populate({                                          // معلومات طلب الوساطة الحالي
                path: 'currentMediationRequest',
                select: '_id status sellerConfirmedStart buyerConfirmedStart mediator bidAmount bidCurrency',
                populate: { path: 'mediator', select: 'fullName avatarUrl _id' }
            })
            .lean(); // .lean() للحصول على كائن JavaScript عادي بدلاً من مستند Mongoose

        // 12. إرسال حدث Socket.IO لجميع العملاء المتصلين لإعلامهم بتحديث المنتج (بما في ذلك المزايدات)
        if (req.io && finalUpdatedProduct) {
            // إرسال الكائن المحول لـ JavaScript العادي
            req.io.emit('product_updated', finalUpdatedProduct); // لا حاجة لـ .toObject() لأننا استخدمنا .lean()
            console.log(`   [Socket] Emitted 'product_updated' after bid for product ID: ${finalUpdatedProduct._id} to all clients.`);
        } else {
            console.warn("   Socket.IO (req.io) not available or finalUpdatedProduct is null. Skipping socket emission.");
        }

        // 13. إرسال استجابة ناجحة للعميل الذي قام بالمزايدة
        res.status(isNewBid ? 201 : 200).json({ // 201 للمزايدة الجديدة، 200 للتحديث
            msg: isNewBid ? "Bid placed successfully!" : "Bid updated successfully!",
            bids: finalUpdatedProduct ? finalUpdatedProduct.bids : [], // أرجع مصفوفة المزايدات المحدثة
            updatedProduct: finalUpdatedProduct // أرجع المنتج المحدث بالكامل
        });

    } catch (error) {
        // 14. في حالة حدوث أي خطأ، قم بإلغاء المعاملة (Abort)
        if (session.inTransaction()) { // تحقق أولاً أن المعاملة لا تزال نشطة
            await session.abortTransaction();
            console.error("   Transaction aborted due to error:", error.message);
        } else {
            console.error("   Error occurred, but transaction was not active (already committed or aborted).");
        }
        console.error("--- Controller: placeBidOnProduct ERROR ---:", error); // طباعة الخطأ الكامل
        // إرجاع رسالة الخطأ التي تم رميها في try block أو رسالة عامة
        res.status(400).json({ msg: error.message || 'Failed to place/update bid due to a server error.' });
    } finally {
        // 15. إنهاء جلسة قاعدة البيانات دائمًا في كتلة finally
        if (session && typeof session.endSession === 'function') { // تحقق من وجود الجلسة وأنها تحتوي على دالة endSession
            // إذا كانت المعاملة لا تزال نشطة هنا (وهو أمر غير متوقع)، أجهضها
            if (session.inTransaction()) {
                console.warn("   [placeBidOnProduct Finally] Session was still in transaction. Aborting now before ending session.");
                await session.abortTransaction();
            }
            await session.endSession();
            console.log("   MongoDB session ended for placeBidOnProduct.");
        } else {
            console.warn("   Session object or endSession method not available in finally block.");
        }
        console.log("--- Controller: placeBidOnProduct END ---");
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

        // --- [!!! التعديل المهم هنا: إرسال حدث للمشتري لتحديث قائمة طلبات الوساطة !!!] ---
        if (req.io && req.onlineUsers && buyer && buyer._id) {
            const buyerSocketId = req.onlineUsers[buyer._id.toString()];
            if (buyerSocketId) {
                // يمكنك إرسال newMediationRequest.toObject() إذا كنت تريد أن يقوم العميل بإضافته محليًا
                // أو يمكنك فقط إرسال إشارة لإعادة الجلب
                req.io.to(buyerSocketId).emit('new_mediation_request_for_buyer', {
                    message: "You have a new mediation request.",
                    mediationRequestId: newMediationRequest._id.toString(), // أرسل ID الطلب الجديد
                    // يمكنك إرسال newMediationRequest.toObject() هنا إذا أردت أن يقوم العميل بإضافته مباشرة للـ state
                    // newMediationRequestData: newMediationRequest.toObject()
                });
                console.log(`   [Socket] Emitted 'new_mediation_request_for_buyer' to buyer ${buyer._id}`);
            }
        }
        // --- نهاية التعديل ---

        const populatedUpdatedProductForSocket = await Product.findById(product._id)
            .populate('user', 'fullName email avatarUrl')
            .populate('buyer', 'fullName email avatarUrl')
            .populate({
                path: 'currentMediationRequest',
                select: '_id status' // أضف الحقول التي تحتاجها الواجهة
            })
            .lean();

        if (req.io && populatedUpdatedProductForSocket) {
            req.io.emit('product_updated', populatedUpdatedProductForSocket);
            console.log(`   [Socket] Emitted 'product_updated' for product ${product._id} after bid acceptance.`);
        }
        // --- نهاية إرسال product_updated ---


        // 8. إرجاع المنتج المحدث للبائع (الذي قام بالإجراء)
        const populatedUpdatedProductForResponse = await Product.findById(product._id) // نفس populatedUpdatedProductForSocket
            .populate('user', 'fullName email avatarUrl')
            .populate('buyer', 'fullName email avatarUrl')
            .populate({
                path: 'currentMediationRequest',
                select: '_id status'
            })
            .lean();

        console.log("   Returning updated product:", JSON.stringify(populatedUpdatedProductForResponse, null, 2));
        
        // --- [!!!] هذا هو التعديل الحاسم هنا [!!!] ---
        // أرسل تحديثًا لإحصائيات البائع نفسه
        const sellerSocketId = req.onlineUsers[sellerId.toString()];
        if (sellerSocketId) {
            // أعد حساب العدد الجديد للمنتجات النشطة
            const newActiveListingsCount = await Product.countDocuments({
                user: sellerId,
                status: 'approved'
            });

            const profileUpdatePayload = {
                _id: sellerId.toString(),
                activeListingsCount: newActiveListingsCount
            };

            req.io.to(sellerSocketId).emit('user_profile_updated', profileUpdatePayload);
            console.log(`   [Socket acceptBid] Emitted 'user_profile_updated' to seller ${sellerId} with new count: ${newActiveListingsCount}`);
        }
        // --- نهاية التعديل ---
        await sendUserStatsUpdate(req, sellerId);
        res.status(200).json({
            msg: "Bid accepted successfully! Please select a mediator to proceed.",
            updatedProduct: populatedUpdatedProductForResponse
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

    // 1. التحقق من المدخلات (كما هو)
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
        const product = await Product.findById(productId).session(session); // لا حاجة لـ populate هنا الآن
        const bidUser = await User.findById(bidUserId).select('fullName').session(session);

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
            // يمكنك إرجاع خطأ أو المتابعة. حاليًا، سنفترض أنه إذا لم توجد المزايدة، فلا مشكلة ونكمل.
            // throw new Error("Specified bid not found on this product.");
        } else {
            product.bids.splice(bidIndex, 1); // إزالة المزايدة من المصفوفة
            await product.save({ session }); // حفظ المنتج بعد إزالة المزايدة
            console.log(`   Bid from ${bidUserId} removed from product ${productId}.`);
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
        const createdNotifications = await Notification.insertMany(notificationsToCreate, { session: session, ordered: true });
        console.log("   Rejection notifications created and saved successfully.");

        // إرسال الإشعارات الفورية عبر السوكيت
        if (req.io && req.onlineUsers) {
            createdNotifications.forEach(notificationDoc => {
                const targetUserSocketId = req.onlineUsers[notificationDoc.user.toString()];
                if (targetUserSocketId) {
                    req.io.to(targetUserSocketId).emit('new_notification', notificationDoc.toObject());
                    console.log(`   [Socket] Sent 'new_notification' for bid rejection to user ${notificationDoc.user}`);
                }
            });
        }


        // 5. إتمام المعاملة
        await session.commitTransaction();
        console.log("   rejectBid transaction committed successfully.");

        // 6. جلب المنتج المحدث بالكامل مع populate لإرساله
        const finalUpdatedProductAfterReject = await Product.findById(productId)
            .populate('user', 'fullName email avatarUrl')
            .populate('bids.user', 'fullName email avatarUrl') // Populate المزايدات المتبقية
            .populate('buyer', 'fullName email avatarUrl')
            .populate({
                path: 'currentMediationRequest',
                select: '_id status sellerConfirmedStart buyerConfirmedStart mediator bidAmount bidCurrency',
                populate: { path: 'mediator', select: 'fullName avatarUrl _id' }
            })
            .lean(); // .lean() للحصول على كائن JavaScript عادي

        // --- [!!! التعديل المهم هنا: إرسال حدث Socket.IO لتحديث المنتج للجميع !!!] ---
        if (req.io && finalUpdatedProductAfterReject) {
            req.io.emit('product_updated', finalUpdatedProductAfterReject); // لا حاجة لـ .toObject() بسبب .lean()
            console.log(`   [Socket] Emitted 'product_updated' after bid rejection for product ID: ${finalUpdatedProductAfterReject._id} to all clients.`);
        } else {
            console.warn("   Socket.IO (req.io) not available or finalUpdatedProductAfterReject is null. Skipping socket emission for product_updated.");
        }
        // --- نهاية التعديل ---


        // 7. إرجاع المنتج المحدث (مع المزايدات المحدثة)
        console.log("   Returning updated product after rejection:", JSON.stringify(finalUpdatedProductAfterReject, null, 2));
        res.status(200).json({
            msg: "Bid rejected successfully.",
            updatedProduct: finalUpdatedProductAfterReject // إرجاع المنتج المحدث لـ Redux
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[ProductCtrl rejectBid] Transaction aborted due to error:", error.message);
        }
        console.error("--- Controller: rejectBid ERROR ---", error);
        res.status(400).json({ msg: error.message || "Failed to reject bid." });
    } finally {
        if (session && typeof session.endSession === 'function') {
            if (session.inTransaction()) {
                console.warn("[rejectBid Finally] Session was still in transaction. Aborting.");
                await session.abortTransaction();
            }
            await session.endSession();
        }
        console.log("--- Controller: rejectBid END --- Session ended.");
    }
};