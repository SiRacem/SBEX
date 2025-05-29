// server/controllers/wallet.controller.js
// *** نسخة معدلة لحساب الرسوم وتحويل العملة في sendFundsController ***

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const PendingFund = require('../models/PendingFund'); // <<< استيراد PendingFund
const config = require('config');

// --- ثوابت ---
const TRANSFER_FEE_PERCENT = 2; // 2%
// --- سعر الصرف ---
const TND_USD_EXCHANGE_RATE = config.get('TND_USD_EXCHANGE_RATE') || 3.0;
const PLATFORM_BASE_CURRENCY = config.get('PLATFORM_BASE_CURRENCY') || 'TND'; // العملة الأساسية للمنصة (افتراضيًا TND)
// ----------------------------------------------------------

// --- دالة مساعدة لتنسيق العملة (يمكن استيرادها إذا كانت في ملف منفصل) ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    try { return num.toLocaleString("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch (error) { return `${num.toFixed(2)} ${currencyCode}`; }
};

// --- [!!!] تعديل دالة إرسال الرصيد [!!!] ---
exports.sendFundsController = async (req, res) => {
    const senderId = req.user._id; // يفترض أن verifyAuth middleware يضيف req.user
    const { recipientId, amount, currency } = req.body;

    console.log(`[WalletCtrl Send V2] Attempt: Sender=${senderId}, Recipient=${recipientId}, Amount=${amount} ${currency}`);

    // --- التحقق الأساسي من المدخلات ---
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
        console.error("[WalletCtrl Send V2] Validation failed: Invalid or missing recipientId.", { recipientId });
        return res.status(400).json({ msg: 'Invalid or missing recipient ID.' });
    }
    if (!amount || !currency || !['TND', 'USD'].includes(currency.toUpperCase())) { // تحويل currency إلى حروف كبيرة للمقارنة
        console.error("[WalletCtrl Send V2] Validation failed: Missing or invalid amount/currency fields.", { amount, currency });
        return res.status(400).json({ msg: 'Amount and a valid currency (TND/USD) are required.' });
    }
    if (senderId.toString() === recipientId.toString()) {
        console.error("[WalletCtrl Send V2] Validation failed: Sender and recipient are the same.");
        return res.status(400).json({ msg: 'Cannot send funds to yourself.' });
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        console.error("[WalletCtrl Send V2] Validation failed: Invalid amount (not a positive number).", { numericAmount });
        return res.status(400).json({ msg: 'Invalid amount specified. Must be a positive number.' });
    }
    const minSend = currency.toUpperCase() === 'USD' ? (6.0 / TND_USD_EXCHANGE_RATE) : 6.0;
    if (numericAmount < minSend) {
        console.error(`[WalletCtrl Send V2] Validation failed: Amount below minimum. Amount: ${numericAmount}, Min: ${minSend}, Currency: ${currency}`);
        return res.status(400).json({ msg: `Minimum send amount is ${formatCurrency(minSend, currency.toUpperCase())}.` });
    }
    // --------------------------------------

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[WalletCtrl Send V2] Transaction session started.");

    let newTransaction; // سيتم تعيينه لاحقًا
    let sender;
    let recipient;

    try {
        // --- 1. جلب المرسل والمستلم ---
        sender = await User.findById(senderId).session(session);
        recipient = await User.findById(recipientId).session(session);

        if (!sender) {
            throw new Error('Sender not found.'); // سيتم التقاطه بواسطة catch block
        }
        if (!recipient) {
            throw new Error('Recipient not found.'); // سيتم التقاطه بواسطة catch block
        }
        console.log(`[WalletCtrl Send V2] Sender Balance (Before): ${sender.balance.toFixed(2)} TND`);
        console.log(`[WalletCtrl Send V2] Recipient Balance (Before): ${recipient.balance.toFixed(2)} TND`);

        // --- 2. حساب الرسوم بنفس عملة الإرسال ---
        const transferFee = (numericAmount * TRANSFER_FEE_PERCENT) / 100;
        console.log(`[WalletCtrl Send V2] Calculated Fee: ${transferFee.toFixed(2)} ${currency.toUpperCase()}`);

        // --- 3. حساب المبلغ الإجمالي للخصم (بالدينار TND) ---
        let totalDeductedTND;
        if (currency.toUpperCase() === 'USD') {
            totalDeductedTND = (numericAmount + transferFee) * TND_USD_EXCHANGE_RATE;
        } else { // currency === 'TND'
            totalDeductedTND = numericAmount + transferFee;
        }
        totalDeductedTND = Number(totalDeductedTND.toFixed(2));
        console.log(`[WalletCtrl Send V2] Total to Deduct (TND): ${totalDeductedTND}`);

        // --- 4. التحقق من رصيد المرسل ---
        if (sender.balance < totalDeductedTND) {
            // لا ترمي خطأ هنا مباشرة، بل أرجع استجابة 400 برسالة واضحة
            console.error(`[WalletCtrl Send V2] Insufficient balance. Sender Balance: ${sender.balance.toFixed(2)} TND, Required: ${totalDeductedTND} TND`);
            await session.abortTransaction();
            session.endSession(); // تأكد من إنهاء الجلسة
            return res.status(400).json({ msg: `Insufficient balance. You need ${formatCurrency(totalDeductedTND, PLATFORM_BASE_CURRENCY)} but only have ${formatCurrency(sender.balance, PLATFORM_BASE_CURRENCY)}.` });
        }

        // --- 5. خصم المبلغ الإجمالي بالدينار من المرسل ---
        sender.balance -= totalDeductedTND;
        await sender.save({ session });
        console.log(`[WalletCtrl Send V2] Sender balance updated: ${sender.balance.toFixed(2)} TND`);

        // --- 6. حساب المبلغ الصافي للمستلم (بالدينار TND) ---
        let netAmountForRecipientTND;
        if (currency.toUpperCase() === 'USD') {
            netAmountForRecipientTND = numericAmount * TND_USD_EXCHANGE_RATE;
        } else { // currency === 'TND'
            netAmountForRecipientTND = numericAmount;
        }
        netAmountForRecipientTND = Number(netAmountForRecipientTND.toFixed(2));
        console.log(`[WalletCtrl Send V2] Net Amount for Recipient (TND): ${netAmountForRecipientTND}`);

        // --- 7. إضافة المبلغ الصافي بالدينار لرصيد المستلم ---
        recipient.balance += netAmountForRecipientTND;
        await recipient.save({ session });
        console.log(`[WalletCtrl Send V2] Recipient balance updated: ${recipient.balance.toFixed(2)} TND`);

        // --- 8. تسجيل المعاملة ---
        newTransaction = new Transaction({
            user: senderId, // *** التعديل الرئيسي: تعيين حقل user إلى المرسل ***
            sender: senderId,
            recipient: recipientId,
            amount: numericAmount,
            currency: currency.toUpperCase(),
            type: 'TRANSFER',
            status: 'COMPLETED',
            description: `Transfer from ${sender.fullName || senderId} to ${recipient.fullName || recipientId}`,
            metadata: { // يمكنك إضافة بيانات إضافية هنا إذا أردت
                feeAmount: transferFee,
                feeCurrency: currency.toUpperCase(),
                totalDeductedTND: totalDeductedTND,
                netAmountForRecipientTND: netAmountForRecipientTND
            }
        });
        await newTransaction.save({ session });
        console.log("[WalletCtrl Send V2] Transaction logged. ID:", newTransaction._id);

        // --- 9. إنشاء الإشعارات ---
        const senderMsg = `You sent ${formatCurrency(numericAmount, currency.toUpperCase())} to ${recipient.fullName}. A fee of ${formatCurrency(transferFee, currency.toUpperCase())} was applied.`;
        const recipientMsg = `You received ${formatCurrency(numericAmount, currency.toUpperCase())} from ${sender.fullName}.`;

        await Promise.all([
            Notification.create([{ user: senderId, type: 'FUNDS_SENT', title: 'Funds Sent', message: senderMsg, relatedEntity: { id: newTransaction._id, modelName: 'Transaction' } }], { session }),
            Notification.create([{ user: recipientId, type: 'FUNDS_RECEIVED', title: 'Funds Received', message: recipientMsg, relatedEntity: { id: newTransaction._id, modelName: 'Transaction' } }], { session })
        ]);
        console.log("[WalletCtrl Send V2] Notifications created.");

        // --- 10. إرسال تحديثات Socket.IO ---
        const senderSocketId = req.onlineUsers[senderId.toString()];
        if (senderSocketId && req.io) {
            req.io.to(senderSocketId).emit('user_balances_updated', {
                _id: sender._id.toString(), // للتأكيد في الواجهة
                balance: sender.balance,
                // أضف أي أرصدة أخرى قد تكون تغيرت للمرسل
            });
            console.log(`[WalletCtrl Send V2] Socket event 'user_balances_updated' emitted to sender ${senderId}.`);
        }
        const recipientSocketId = req.onlineUsers[recipientId.toString()];
        if (recipientSocketId && req.io) {
            req.io.to(recipientSocketId).emit('user_balances_updated', {
                _id: recipient._id.toString(), // للتأكيد في الواجهة
                balance: recipient.balance,
            });
            // يمكنك إرسال إشعار فوري أيضًا
            req.io.to(recipientSocketId).emit('new_notification', {
                title: 'Funds Received',
                message: recipientMsg,
                type: 'FUNDS_RECEIVED', // أو أي نوع تستخدمه في الواجهة
                createdAt: new Date()
            });
            console.log(`[WalletCtrl Send V2] Socket events 'user_balances_updated' and 'new_notification' emitted to recipient ${recipientId}.`);
        }
        // -------------------------------

        await session.commitTransaction();
        console.log("[WalletCtrl Send V2] Transaction committed successfully.");
        res.status(200).json({
            msg: `Successfully sent ${formatCurrency(numericAmount, currency.toUpperCase())} to ${recipient.fullName}.`,
            newSenderBalance: sender.balance,
            transactionId: newTransaction._id
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.error("[WalletCtrl Send V2] Transaction aborted due to error:", error.message, error.stack);
        } else {
            // إذا لم تكن المعاملة نشطة، فقد يكون الخطأ حدث قبل بدء المعاملة
            console.error("[WalletCtrl Send V2] Error occurred (possibly before transaction start):", error.message, error.stack);
        }

        let userFriendlyError = 'Transaction failed. Please try again later.';
        if (error.message.includes('not found')) {
            userFriendlyError = 'Sender or Recipient user not found.';
        } else if (error.name === 'ValidationError') {
            userFriendlyError = "Transaction data validation failed. Please check your inputs or contact support.";
            // يمكنك إضافة تفاصيل أكثر هنا إذا أردت بناءً على error.errors
            console.error("[WalletCtrl Send V2] Mongoose Validation Error Details:", error.errors);
        } else {
            // للأخطاء العامة الأخرى
            console.error("[WalletCtrl Send V2] Generic catch block error (not handled above):", error.message, error.stack);
        }

        if (!res.headersSent) { // تأكد من عدم إرسال استجابة بالفعل
            res.status(400).json({ msg: userFriendlyError });
        }
    } finally {
        // تأكد من أن الجلسة يتم إنهاؤها دائمًا
        if (session && session.endSession) { // تحقق من وجود session و session.endSession
            try {
                await session.endSession();
                console.log("[WalletCtrl Send V2] Session ended.");
            } catch (sessionEndError) {
                console.error("[WalletCtrl Send V2] Error ending session:", sessionEndError);
            }
        }
    }
};
// ----------------------------------------------------------

// --- دالة جلب المعاملات (تبقى كما هي) ---
exports.getTransactionsController = async (req, res) => {
    const userId = req.user._id;
    console.log(`[WalletCtrl GetTx] Fetching transactions for User ID: ${userId}`);
    try {
        const walletTransactionTypes = [
            'DEPOSIT_COMPLETED',    // أو النوع الذي تستخدمه للإيداع المكتمل
            'WITHDRAWAL_COMPLETED', // أو النوع الذي تستخدمه للسحب المكتمل
            'TRANSFER', // تحويل أموال بين المستخدمين
            // --- [!!! إضافة الأنواع الجديدة هنا !!!] ---
            'DISPUTE_PAYOUT_SELLER_WON', // للبائع
            'MEDIATION_FEE_DISPUTE',    // للوسيط (إذا كان هو المستخدم الحالي)
            'ESCROW_REFUND_DISPUTE_WON',// للمشتري
            'LEVEL_UP_REWARD_RECEIVED', // مكافآت الترقية قد تكون ذات صلة بالمحفظة
            'PRODUCT_SALE_FUNDS_RELEASED' // عندما يتم فك تجميد أموال البائع
            // -------------------------------------------
        ];
        const transactions = await Transaction.find({
            // ابحث عن المعاملات حيث المستخدم هو user أو sender أو recipient
            // ونوع المعاملة ضمن الأنواع المحددة للمحفظة
            $and: [
                { $or: [{ user: userId }, { sender: userId }, { recipient: userId }] },
                { type: { $in: walletTransactionTypes } }
            ]
        })
            .populate('sender', 'fullName email avatarUrl')
            .populate('recipient', 'fullName email avatarUrl')
            .populate('user', 'fullName email avatarUrl') // إذا كان حقل user مستخدمًا لأنواع أخرى
            .sort({ createdAt: -1 })
            .limit(50); // يمكنك إضافة pagination هنا أيضًا إذا أردت

        console.log(`[WalletCtrl GetTxForWallet] Found ${transactions.length} wallet transactions.`);
        res.status(200).json(transactions);
    } catch (error) {
        console.error("[WalletCtrl GetTxForWallet] Error fetching wallet transactions:", error);
        res.status(500).json({ msg: "Failed to retrieve wallet transactions." });
    }
};
// -------------------------------------

// --- [!!!] دالة جديدة لجلب تفاصيل الأموال المعلقة للبائع [!!!] ---
exports.getSellerPendingFundsDetailsController = async (req, res) => {
    const sellerId = req.user._id; // البائع الحالي
    console.log(`--- Controller: getSellerPendingFundsDetails for Seller: ${sellerId} ---`);

    try {
        // 1. جلب بيانات البائع للأرصدة الإجمالية
        const seller = await User.findById(sellerId)
            .select('sellerPendingBalance sellerAvailableBalance balance depositBalance withdrawalBalance email fullName') // جلب الأرصدة الأساسية أيضًا
            .lean();

        if (!seller) {
            return res.status(404).json({ msg: "Seller profile not found." });
        }

        // 2. جلب الأموال المعلقة حاليًا (التي لم يتم فك تجميدها)
        const pendingItems = await PendingFund.find({
            seller: sellerId,
            isReleased: false
        })
            .populate('product', 'title imageUrls') // جلب عنوان المنتج وصورة واحدة
            .populate('mediationRequest', 'status buyer') // جلب حالة الوساطة والمشتري
            .populate({ // لاسم المشتري
                path: 'mediationRequest',
                populate: {
                    path: 'buyer',
                    select: 'fullName'
                }
            })
            .sort({ releaseAt: 1 }); // الأقرب لفك التجميد أولاً

        // 3. (اختياري) جلب آخر X مبالغ تم فك تجميدها
        const recentlyReleasedItems = await PendingFund.find({
            seller: sellerId,
            isReleased: true
        })
            .populate('product', 'title')
            .populate('mediationRequest', 'status buyer')
            .populate({
                path: 'mediationRequest',
                populate: { path: 'buyer', select: 'fullName' }
            })
            .sort({ releasedToAvailableAt: -1 }) // الأحدث أولاً
            .limit(5); // مثال: آخر 5

        // 4. حساب الوقت المتبقي لكل pendingItem
        const now = new Date();
        const pendingItemsWithRemainingTime = pendingItems.map(item => {
            const remainingMilliseconds = item.releaseAt.getTime() - now.getTime();
            let releasesIn = "Processing...";
            if (remainingMilliseconds <= 0) {
                releasesIn = "Releasing soon / Overdue";
            } else {
                const days = Math.floor(remainingMilliseconds / (1000 * 60 * 60 * 24));
                const hours = Math.floor((remainingMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((remainingMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
                if (days > 0) releasesIn = `in ~${days} day(s), ${hours} hr(s)`;
                else if (hours > 0) releasesIn = `in ~${hours} hr(s), ${minutes} min(s)`;
                else if (minutes > 0) releasesIn = `in ~${minutes} min(s)`;
                else releasesIn = "Releasing very soon";
            }
            return {
                ...item.toObject(), // تحويل مستند Mongoose إلى كائن عادي
                releasesIn,
                productTitle: item.product?.title || "N/A",
                buyerName: item.mediationRequest?.buyer?.fullName || "N/A" // اسم المشتري
            };
        });

        const recentlyReleasedItemsFormatted = recentlyReleasedItems.map(item => ({
            ...item.toObject(),
            productTitle: item.product?.title || "N/A",
            buyerName: item.mediationRequest?.buyer?.fullName || "N/A"
        }));

        res.status(200).json({
            platformBaseCurrency: PLATFORM_BASE_CURRENCY,
            totalPendingBalance: seller.sellerPendingBalance || 0,
            totalAvailableBalance: seller.sellerAvailableBalance || 0,
            // يمكنك إضافة أرصدة أخرى من `seller` إذا أردت عرضها في نفس المودال
            mainBalance: seller.balance || 0,
            depositBalance: seller.depositBalance || 0,
            withdrawalBalance: seller.withdrawalBalance || 0,
            pendingItems: pendingItemsWithRemainingTime,
            recentlyReleasedItems: recentlyReleasedItemsFormatted
        });

    } catch (error) {
        console.error("[getSellerPendingFundsDetailsController] Error:", error.message, error.stack);
        res.status(500).json({ msg: "Server error fetching pending funds details.", errorDetails: error.message });
    }
};
// --- نهاية الدالة الجديدة ---

exports.getDashboardTransactionsController = async (req, res) => {
    const userId = req.user._id; // المستخدم الحالي الذي قام بتسجيل الدخول
    const userRole = req.user.userRole; // دور المستخدم الحالي

    console.log(`[GetDashboardTxCtrl] Fetching for User: ${userId}, Role: ${userRole}`);

    try {
        let queryConditions = [];

        // 1. معاملات البائع
        if (userRole === 'Vendor' || userRole === 'Admin') { // الأدمن قد يرغب برؤية كل شيء أو ما يراه البائع
            queryConditions.push({
                user: userId, // البائع هو "مالك" هذه المعاملات
                type: { $in: ['PRODUCT_SALE_FUNDS_PENDING', 'PRODUCT_SALE_FUNDS_RELEASED', 'DISPUTE_PAYOUT_SELLER_WON'] }
            });
        }

        // 2. معاملات المشتري
        if (userRole === 'User' || userRole === 'Admin') {
            queryConditions.push({
                user: userId,
                type: {
                    $in: [
                        'PRODUCT_PURCHASE_COMPLETED',
                        'ESCROW_REFUND_DISPUTE_WON' // <--- أضف هذا للمشتري
                    ]
                }
            });
        }

        // 3. معاملات الوسيط
        if (userRole === 'Admin' || req.user.isMediatorQualified) {
            queryConditions.push({
                user: userId,
                type: {
                    $in: [
                        'MEDIATION_FEE_RECEIVED',
                        'MEDIATION_FEE_DISPUTE' // <--- أضف هذا للوسيط
                    ]
                }
            });
        }

        // 4. معاملات المكافآت (للجميع)
        queryConditions.push({
            user: userId,
            type: 'LEVEL_UP_REWARD_RECEIVED'
        });


        // إذا لم يكن هناك شروط (مثلاً مستخدم ليس له دور محدد أو لا تنطبق عليه أي من الشروط أعلاه)
        // قد لا يرجع أي شيء، أو يمكنك إضافة منطق افتراضي.
        // حاليًا، إذا كانت queryConditions فارغة، فإن $or فارغة سترجع خطأ.
        // لذا، يجب التأكد من أن هناك شرط واحد على الأقل أو التعامل مع الحالة الفارغة.

        let finalQuery = {};
        if (queryConditions.length > 0) {
            finalQuery = { $or: queryConditions };
        } else {
            // إذا لم يكن المستخدم يطابق أي دور له معاملات خاصة بالداشبورد
            // يمكنك إرجاع مصفوفة فارغة مباشرة أو إضافة نوع معاملة عام جدًا إذا أردت
            console.log(`[GetDashboardTxCtrl] No specific dashboard transaction types for User: ${userId}, Role: ${userRole}`);
            return res.status(200).json([]); // إرجاع مصفوفة فارغة
        }

        console.log("[GetDashboardTxCtrl] Final Query:", JSON.stringify(finalQuery));

        const transactions = await Transaction.find(finalQuery)
            .populate('sender', 'fullName avatarUrl') // قد لا تكون ضرورية دائمًا هنا
            .populate('recipient', 'fullName avatarUrl') // قد لا تكون ضرورية دائمًا هنا
            .populate('relatedProduct', 'title')
            .populate({ // لجلب اسم المشتري/البائع في وصف المعاملة إذا لزم الأمر
                path: 'relatedMediationRequest',
                populate: [
                    { path: 'buyer', select: 'fullName' },
                    { path: 'seller', select: 'fullName' }
                ]
            })
            .sort({ createdAt: -1 })
            .limit(20);

        console.log(`[GetDashboardTxCtrl] Found ${transactions.length} transactions for dashboard.`);
        res.status(200).json(transactions);

    } catch (error) {
        console.error("[GetDashboardTxCtrl] Error:", error.message, error.stack);
        res.status(500).json({ msg: "Failed to retrieve dashboard transactions." });
    }
};