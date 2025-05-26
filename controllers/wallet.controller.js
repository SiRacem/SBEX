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
    const senderId = req.user._id;
    // استلام المبلغ الأصلي والعملة الأصلية
    const { recipientId, amount, currency } = req.body;

    console.log(`[WalletCtrl Send V2] Attempt: Sender=${senderId}, Recipient=${recipientId}, Amount=${amount} ${currency}`);

    // --- التحقق الأساسي ---
    if (!recipientId || !amount || !currency || !['TND', 'USD'].includes(currency)) {
        return res.status(400).json({ msg: 'Recipient ID, amount, and a valid currency (TND/USD) are required.' });
    }
    if (senderId.toString() === recipientId.toString()) {
        return res.status(400).json({ msg: 'Cannot send funds to yourself.' });
    }
    const numericAmount = Number(amount); // المبلغ الأصلي المرسل
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ msg: 'Invalid amount specified.' });
    }
    // التحقق من الحد الأدنى (اختياري في الـ Backend، لكن جيد)
    const minSend = currency === 'USD' ? (6.0 / TND_USD_EXCHANGE_RATE) : 6.0;
    if (numericAmount < minSend) {
        return res.status(400).json({ msg: `Minimum send amount is ${formatCurrency(minSend, currency)}.` });
    }
    // ----------------------

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[WalletCtrl Send V2] Transaction started.");

    let newTransaction;
    let sender; // تعريف sender هنا
    let recipient; // تعريف recipient هنا

    try {
        // --- 1. جلب المرسل والمستلم ---
        sender = await User.findById(senderId).session(session);
        recipient = await User.findById(recipientId).session(session);
        if (!sender) throw new Error('Sender not found.');
        if (!recipient) throw new Error('Recipient not found.');
        console.log(`[WalletCtrl Send V2] Sender Balance (Before): ${sender.balance} TND`);
        console.log(`[WalletCtrl Send V2] Recipient Balance (Before): ${recipient.balance} TND`);

        // --- 2. حساب الرسوم بنفس عملة الإرسال ---
        const transferFee = (numericAmount * TRANSFER_FEE_PERCENT) / 100;
        console.log(`[WalletCtrl Send V2] Calculated Fee: ${transferFee.toFixed(2)} ${currency}`);

        // --- 3. حساب المبلغ الإجمالي للخصم (بالدينار TND) ---
        let totalDeductedTND;
        if (currency === 'USD') {
            // المبلغ المرسل بالدولار + الرسوم بالدولار، ثم الكل * سعر الصرف
            totalDeductedTND = (numericAmount + transferFee) * TND_USD_EXCHANGE_RATE;
        } else { // currency === 'TND'
            // المبلغ المرسل بالدينار + الرسوم بالدينار
            totalDeductedTND = numericAmount + transferFee;
        }
        totalDeductedTND = Number(totalDeductedTND.toFixed(2)); // تقريب لأقرب سنتيم
        console.log(`[WalletCtrl Send V2] Total to Deduct (TND): ${totalDeductedTND}`);

        // --- 4. التحقق من رصيد المرسل (مقابل الإجمالي بالدينار) ---
        if (sender.balance < totalDeductedTND) {
            throw new Error('Insufficient balance to cover amount and transfer fee.');
        }

        // --- 5. خصم المبلغ الإجمالي بالدينار من المرسل ---
        sender.balance -= totalDeductedTND;
        await sender.save({ session });
        console.log(`[WalletCtrl Send V2] Sender balance updated: ${sender.balance} TND`);

        // --- 6. حساب المبلغ الصافي للمستلم (بالدينار TND) ---
        let netAmountForRecipientTND;
        if (currency === 'USD') {
            // فقط المبلغ الأصلي المرسل * سعر الصرف (بدون الرسوم)
            netAmountForRecipientTND = numericAmount * TND_USD_EXCHANGE_RATE;
        } else { // currency === 'TND'
            // فقط المبلغ الأصلي المرسل (بدون الرسوم)
            netAmountForRecipientTND = numericAmount;
        }
        netAmountForRecipientTND = Number(netAmountForRecipientTND.toFixed(2));
        console.log(`[WalletCtrl Send V2] Net Amount for Recipient (TND): ${netAmountForRecipientTND}`);

        // --- 7. إضافة المبلغ الصافي بالدينار لرصيد المستلم ---
        recipient.balance += netAmountForRecipientTND;
        await recipient.save({ session });
        console.log(`[WalletCtrl Send V2] Recipient balance updated: ${recipient.balance} TND`);

        // --- 8. تسجيل المعاملة (بالمبلغ الأصلي والعملة الأصلية) ---
        newTransaction = new Transaction({
            sender: senderId,
            recipient: recipientId,
            amount: numericAmount, // المبلغ الأصلي المرسل
            currency: currency, // العملة الأصلية
            type: 'TRANSFER',
            status: 'COMPLETED',
            // يمكنك إضافة حقل للرسوم إذا أردت تخزينها في المعاملة
            // feeAmount: transferFee,
            // feeCurrency: currency,
            description: `Transfer from ${sender.fullName || senderId} to ${recipient.fullName || recipientId}`
        });
        await newTransaction.save({ session });
        console.log("[WalletCtrl Send V2] Transaction logged. ID:", newTransaction._id);

        // --- 9. إنشاء الإشعارات (بالمبلغ الأصلي والعملة الأصلية) ---
        const senderMsg = `You sent ${formatCurrency(numericAmount, currency)} to ${recipient.fullName}. A fee of ${formatCurrency(transferFee, currency)} was applied.`;
        const recipientMsg = `You received ${formatCurrency(numericAmount, currency)} from ${sender.fullName}.`;

        await Promise.all([
            Notification.create([{ user: senderId, type: 'FUNDS_SENT', title: 'Funds Sent', message: senderMsg, relatedEntity: { id: newTransaction._id, modelName: 'Transaction' } }], { session }),
            Notification.create([{ user: recipientId, type: 'FUNDS_RECEIVED', title: 'Funds Received', message: recipientMsg, relatedEntity: { id: newTransaction._id, modelName: 'Transaction' } }], { session })
        ]);
        console.log("[WalletCtrl Send V2] Notifications created.");

        // --- 10. إتمام المعاملة بنجاح ---
        await session.commitTransaction();
        console.log("[WalletCtrl Send V2] Transaction committed.");
        res.status(200).json({
            msg: `Successfully sent ${formatCurrency(numericAmount, currency)} to ${recipient.fullName}.`,
            newSenderBalance: sender.balance, // الرصيد المحدث للمرسل
            transactionId: newTransaction._id
        });

    } catch (error) {
        // --- معالجة الأخطاء وإلغاء المعاملة ---
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[WalletCtrl Send V2] Transaction aborted due to error:", error.message);
        } else {
            console.log("[WalletCtrl Send V2] Transaction not active or already handled.");
        }
        let userFriendlyError = 'Transaction failed. Please try again later.';
        if (error.message.includes('Insufficient balance')) { userFriendlyError = error.message; }
        else if (error.message.includes('not found')) { userFriendlyError = 'User not found.'; }
        res.status(400).json({ msg: userFriendlyError });

    } finally {
        // --- إنهاء الجلسة ---
        if (session.endSession) { // Check if function exists before calling
            await session.endSession();
            console.log("[WalletCtrl Send V2] Session ended.");
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
            'TRANSFER_SENT',
            'TRANSFER_RECEIVED',
            'DEPOSIT_COMPLETED',    // أو النوع الذي تستخدمه للإيداع المكتمل
            'WITHDRAWAL_COMPLETED', // أو النوع الذي تستخدمه للسحب المكتمل
            // أضف أي أنواع أخرى خاصة بالمحفظة فقط
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
                type: { $in: ['PRODUCT_SALE_FUNDS_PENDING', 'PRODUCT_SALE_FUNDS_RELEASED'] }
            });
        }

        // 2. معاملات المشتري
        if (userRole === 'User' || userRole === 'Admin') { // المشتري هو "User" أو أدمن
            queryConditions.push({
                user: userId, // المشتري هو "مالك" هذه المعاملة
                type: 'PRODUCT_PURCHASE_COMPLETED'
            });
        }

        // 3. معاملات الوسيط
        if (userRole === 'Admin' || req.user.isMediatorQualified) { // إذا كان وسيطًا مؤهلاً أو أدمن
            queryConditions.push({
                user: userId, // الوسيط هو "مالك" هذه المعاملة
                type: 'MEDIATION_FEE_RECEIVED'
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