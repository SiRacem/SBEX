// server/controllers/wallet.controller.js

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const PendingFund = require('../models/PendingFund');
const config = require('config');

// --- ثوابت ---
const TRANSFER_FEE_PERCENT = config.get('TRANSFER_FEE_PERCENT') || 2; // 2%
const TND_USD_EXCHANGE_RATE = config.get('TND_USD_EXCHANGE_RATE') || 3.0;
const PLATFORM_BASE_CURRENCY = config.get('PLATFORM_BASE_CURRENCY') || 'TND';

// --- دالة مساعدة لتنسيق العملة ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    try {
        return num.toLocaleString("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) {
        return `${num.toFixed(2)} ${currencyCode}`;
    }
};

// =================================================================
// [!!!]  الدالة الرئيسية لإرسال الأموال (النسخة النهائية المعدلة)  [!!!]
// =================================================================
exports.sendFundsController = async (req, res) => {
    // 1. [تعديل] استقبال 'source' من الطلب
    const { recipientId, amount, currency, source } = req.body;
    const senderId = req.user._id;

    console.log(`[WalletCtrl Send V3] Attempt: Sender=${senderId}, Recipient=${recipientId}, Amount=${amount} ${currency}, Source=${source || 'principal'}`);

    // --- 2. التحقق الأولي من المدخلات (بدون تغيير) ---
    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
        console.error("[WalletCtrl Send V3] Validation failed: Invalid or missing recipientId.", { recipientId });
        return res.status(400).json({ msg: 'Invalid or missing recipient ID.' });
    }
    if (!amount || !currency || !['TND', 'USD'].includes(currency.toUpperCase())) {
        console.error("[WalletCtrl Send V3] Validation failed: Missing or invalid amount/currency fields.", { amount, currency });
        return res.status(400).json({ msg: 'Amount and a valid currency (TND/USD) are required.' });
    }
    if (senderId.toString() === recipientId.toString()) {
        console.error("[WalletCtrl Send V3] Validation failed: Sender and recipient are the same.");
        return res.status(400).json({ msg: 'Cannot send funds to yourself.' });
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        console.error("[WalletCtrl Send V3] Validation failed: Invalid amount (not a positive number).", { numericAmount });
        return res.status(400).json({ msg: 'Invalid amount specified. Must be a positive number.' });
    }
    const minSend = currency.toUpperCase() === 'USD' ? (6.0 / TND_USD_EXCHANGE_RATE) : 6.0;
    if (numericAmount < minSend) {
        console.error(`[WalletCtrl Send V3] Validation failed: Amount below minimum. Amount: ${numericAmount}, Min: ${minSend}, Currency: ${currency}`);
        return res.status(400).json({ msg: `Minimum send amount is ${formatCurrency(minSend, currency.toUpperCase())}.` });
    }

    // --- 3. بدء جلسة Mongoose Transaction (بدون تغيير) ---
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[WalletCtrl Send V3] Transaction session started.");

    try {
        const sender = await User.findById(senderId).session(session);
        const recipient = await User.findById(recipientId).session(session);

        if (!sender) throw new Error('Sender not found.');
        if (!recipient) throw new Error('Recipient not found.');

        console.log(`[WalletCtrl Send V3] Sender Balances (Before): Principal=${sender.balance.toFixed(2)}, Seller=${(sender.sellerAvailableBalance || 0).toFixed(2)}`);
        console.log(`[WalletCtrl Send V3] Recipient Balance (Before): ${recipient.balance.toFixed(2)} TND`);

        // --- 4. حساب الرسوم والمبلغ الإجمالي (بدون تغيير) ---
        const transferFee = (numericAmount * TRANSFER_FEE_PERCENT) / 100;
        console.log(`[WalletCtrl Send V3] Calculated Fee: ${transferFee.toFixed(2)} ${currency.toUpperCase()}`);

        let totalDeductedTND;
        if (currency.toUpperCase() === 'USD') {
            totalDeductedTND = (numericAmount + transferFee) * TND_USD_EXCHANGE_RATE;
        } else {
            totalDeductedTND = numericAmount + transferFee;
        }
        totalDeductedTND = Number(totalDeductedTND.toFixed(2));
        console.log(`[WalletCtrl Send V3] Total to Deduct (TND): ${totalDeductedTND}`);

        // --- 5. [!!! تعديل رئيسي !!!] تحديد مصدر الرصيد والتحقق منه ---
        let senderBalanceField = 'balance'; // القيمة الافتراضية
        let sourceNameForMsg = 'Principal Balance';

        // إذا كان المصدر المحدد هو 'seller' وكان المستخدم لديه الصلاحية
        if (source === 'seller' && (sender.userRole === 'Vendor' || sender.userRole === 'Admin')) {
            senderBalanceField = 'sellerAvailableBalance';
            sourceNameForMsg = 'Seller Available Balance';
        } else if (source === 'seller') {
            // إذا طلب المصدر 'seller' ولكن المستخدم ليس بائعًا أو أدمن
            throw new Error(`User is not authorized to use the seller balance.`);
        }

        console.log(`[WalletCtrl Send V3] Selected source balance field: '${senderBalanceField}'`);

        // التحقق من كفاية الرصيد في الحقل المحدد
        if (sender[senderBalanceField] < totalDeductedTND) {
            console.error(`[WalletCtrl Send V3] Insufficient balance in ${sourceNameForMsg}. Required: ${totalDeductedTND}, Available: ${sender[senderBalanceField]}`);
            const errorMsg = `Insufficient funds in your ${sourceNameForMsg}. You need ${formatCurrency(totalDeductedTND, PLATFORM_BASE_CURRENCY)} but only have ${formatCurrency(sender[senderBalanceField], PLATFORM_BASE_CURRENCY)}.`;
            // نلقي بالخطأ ليتم التعامل معه في catch block
            throw new Error(errorMsg);
        }

        // --- 6. [!!! تعديل رئيسي !!!] خصم المبلغ من المصدر الصحيح ---
        sender[senderBalanceField] -= totalDeductedTND;
        await sender.save({ session });
        console.log(`[WalletCtrl Send V3] Sender '${senderBalanceField}' updated: ${sender[senderBalanceField].toFixed(2)} TND`);

        // --- 7. إضافة المبلغ للمستلم (بدون تغيير، المستلم دائمًا يستقبل في الرصيد الأساسي) ---
        let netAmountForRecipientTND;
        if (currency.toUpperCase() === 'USD') {
            netAmountForRecipientTND = numericAmount * TND_USD_EXCHANGE_RATE;
        } else {
            netAmountForRecipientTND = numericAmount;
        }
        netAmountForRecipientTND = Number(netAmountForRecipientTND.toFixed(2));
        console.log(`[WalletCtrl Send V3] Net Amount for Recipient (TND): ${netAmountForRecipientTND}`);

        recipient.balance += netAmountForRecipientTND;
        await recipient.save({ session });
        console.log(`[WalletCtrl Send V3] Recipient balance updated: ${recipient.balance.toFixed(2)} TND`);

        // --- 8. [!!! تعديل !!!] إنشاء سجل المعاملة مع توضيح المصدر ---
        const newTransaction = new Transaction({
            user: senderId, // من قام بالعملية
            sender: senderId,
            recipient: recipientId,
            amount: numericAmount,
            currency: currency.toUpperCase(),
            type: 'TRANSFER',
            status: 'COMPLETED',
            description: `Transfer from ${sender.fullName || sender.email} to ${recipient.fullName || recipient.email}`,
            metadata: {
                feeAmount: transferFee,
                feeCurrency: currency.toUpperCase(),
                totalDeductedTND: totalDeductedTND,
                netAmountForRecipientTND: netAmountForRecipientTND,
                source: source || 'principal' // حفظ المصدر في بيانات المعاملة
            }
        });
        await newTransaction.save({ session });
        console.log("[WalletCtrl Send V3] Transaction logged. ID:", newTransaction._id);

        // --- 9. إنشاء وإرسال الإشعارات (بدون تغيير) ---
        const senderMsg = `You sent ${formatCurrency(numericAmount, currency.toUpperCase())} to ${recipient.fullName || recipient.email}. A fee of ${formatCurrency(transferFee, currency.toUpperCase())} was applied.`;
        const recipientMsg = `You received ${formatCurrency(numericAmount, currency.toUpperCase())} from ${sender.fullName || sender.email}.`;

        const senderNotificationForSocket = {
            _id: new mongoose.Types.ObjectId(),
            user: senderId,
            type: 'FUNDS_SENT',
            title: 'notification_titles.FUNDS_SENT', // <-- مفتاح
            message: 'notification_messages.FUNDS_SENT', // <-- مفتاح
            messageParams: { // <-- متغيرات
                amount: formatCurrency(numericAmount, currency.toUpperCase()),
                recipientName: recipient.fullName || recipient.email
            },
            relatedEntity: { id: newTransaction._id, modelName: 'Transaction' },
            isRead: false,
            createdAt: new Date()
        };
        const recipientNotificationForSocket = {
            _id: new mongoose.Types.ObjectId(),
            user: recipientId,
            type: 'FUNDS_RECEIVED',
            title: 'notification_titles.FUNDS_RECEIVED', // <-- مفتاح
            message: 'notification_messages.FUNDS_RECEIVED', // <-- مفتاح
            messageParams: { // <-- متغيرات
                amount: formatCurrency(numericAmount, currency.toUpperCase()),
                senderName: sender.fullName || sender.email
            },
            relatedEntity: { id: newTransaction._id, modelName: 'Transaction' },
            isRead: false,
            createdAt: new Date()
        };
        // ***** نهاية التعديل *****

        await Notification.insertMany([senderNotificationForSocket, recipientNotificationForSocket], { session });
        console.log("[WalletCtrl Send V3] Notifications created in DB.");

        // --- 10. إرسال تحديثات Socket.IO (بدون تغيير) ---
        const senderSocketId = req.onlineUsers ? req.onlineUsers[senderId.toString()] : null;
        if (senderSocketId && req.io) {
            req.io.to(senderSocketId).emit('user_balances_updated', {
                _id: sender._id.toString(),
                balance: sender.balance,
                sellerAvailableBalance: sender.sellerAvailableBalance
            });
            req.io.to(senderSocketId).emit('new_notification', senderNotificationForSocket);
            console.log(`[WalletCtrl Send V3] Socket events emitted to sender ${senderId}.`);
        }

        const recipientSocketId = req.onlineUsers ? req.onlineUsers[recipientId.toString()] : null;
        if (recipientSocketId && req.io) {
            req.io.to(recipientSocketId).emit('user_balances_updated', {
                _id: recipient._id.toString(),
                balance: recipient.balance,
                sellerAvailableBalance: recipient.sellerAvailableBalance
            });
            req.io.to(recipientSocketId).emit('new_notification', recipientNotificationForSocket);
            console.log(`[WalletCtrl Send V3] Socket events emitted to recipient ${recipientId}.`);
        }

        // --- 11. إتمام المعاملة بنجاح (بدون تغيير) ---
        await session.commitTransaction();
        console.log("[WalletCtrl Send V3] Transaction committed successfully.");
        res.status(200).json({
            msg: `Successfully sent ${formatCurrency(numericAmount, currency.toUpperCase())} to ${recipient.fullName || recipient.email}.`,
            transactionId: newTransaction._id
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.error("[WalletCtrl Send V3] Transaction aborted due to error:", error.message, error.stack);
        } else {
            console.error("[WalletCtrl Send V3] Error occurred (possibly before transaction start):", error.message, error.stack);
        }

        let userFriendlyError = 'Transaction failed. Please try again later.';
        if (error.message.includes('not found')) {
            userFriendlyError = 'Sender or Recipient user not found.';
        } else if (error.message.includes('Insufficient funds')) {
            userFriendlyError = error.message;
        } else if (error.message.includes('not authorized')) {
            userFriendlyError = 'You are not authorized to perform this action.';
        } else if (error.name === 'ValidationError') {
            userFriendlyError = "Transaction data validation failed.";
            console.error("[WalletCtrl Send V3] Mongoose Validation Error Details:", error.errors);
        }

        if (!res.headersSent) {
            res.status(400).json({ msg: userFriendlyError });
        }
    } finally {
        if (session && session.endSession) {
            await session.endSession();
            console.log("[WalletCtrl Send V3] Session ended.");
        }
    }
};

// =================================================================
// بقية الدوال في الملف (تبقى كما هي بدون تغيير)
// =================================================================

exports.getTransactionsController = async (req, res) => {
    const userId = req.user._id;
    console.log(`[WalletCtrl GetTx] Fetching transactions for User ID: ${userId}`);
    try {
        const walletTransactionTypes = [
            'DEPOSIT_COMPLETED',
            'WITHDRAWAL_COMPLETED',
            'TRANSFER',
            'SELLER_BALANCE_TRANSFER',
        ];
        const transactions = await Transaction.find({
            $and: [
                { $or: [{ sender: userId }, { recipient: userId }] },
                { type: { $in: walletTransactionTypes } }
            ]
        })
            .populate('sender', 'fullName email avatarUrl')
            .populate('recipient', 'fullName email avatarUrl')
            .populate('user', 'fullName email avatarUrl')
            .sort({ createdAt: -1 })
            .limit(50);

        console.log(`[WalletCtrl GetTxForWallet] Found ${transactions.length} wallet transactions.`);
        res.status(200).json(transactions);
    } catch (error) {
        console.error("[WalletCtrl GetTxForWallet] Error fetching wallet transactions:", error);
        res.status(500).json({ msg: "Failed to retrieve wallet transactions." });
    }
};

exports.getSellerPendingFundsDetailsController = async (req, res) => {
    const sellerId = req.user._id;
    console.log(`--- Controller: getSellerPendingFundsDetails for Seller: ${sellerId} ---`);

    try {
        const seller = await User.findById(sellerId)
            .select('sellerPendingBalance sellerAvailableBalance balance depositBalance withdrawalBalance email fullName')
            .lean();

        if (!seller) {
            return res.status(404).json({ msg: "Seller profile not found." });
        }

        const pendingItems = await PendingFund.find({
            seller: sellerId,
            isReleased: false
        })
            .populate('product', 'title imageUrls')
            .populate({
                path: 'mediationRequest',
                select: 'status buyer',
                populate: {
                    path: 'buyer',
                    select: 'fullName'
                }
            })
            .sort({ releaseAt: 1 });

        const recentlyReleasedItems = await PendingFund.find({
            seller: sellerId,
            isReleased: true
        })
            .populate('product', 'title')
            .populate({
                path: 'mediationRequest',
                select: 'status buyer',
                populate: { path: 'buyer', select: 'fullName' }
            })
            .sort({ releasedToAvailableAt: -1 })
            .limit(5);

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
                ...item.toObject(),
                releasesIn,
                productTitle: item.product?.title || "N/A",
                buyerName: item.mediationRequest?.buyer?.fullName || "N/A"
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

exports.getDashboardTransactionsController = async (req, res) => {
    const userId = req.user._id;
    const userRole = req.user.userRole;
    console.log(`[GetDashboardTxCtrl] Fetching for User: ${userId}, Role: ${userRole}`);
    try {
        // [!!!] START: العودة إلى المنطق الأصلي مع تحسينات [!!!]
        let queryConditions = [];

        // دائماً أضف هذه الأنواع
        queryConditions.push({ user: userId, type: 'LEVEL_UP_REWARD_RECEIVED' });
        queryConditions.push({ user: userId, type: 'PRODUCT_PURCHASE_COMPLETED' });
        queryConditions.push({ user: userId, type: 'MEDIATION_FEE_RECEIVED' });
        queryConditions.push({ user: userId, type: 'PRODUCT_SALE_FUNDS_PENDING' });
        queryConditions.push({ user: userId, type: 'PRODUCT_SALE_FUNDS_RELEASED' });
        queryConditions.push({ user: userId, type: 'MEDIATION_FEE_PAID_BY_BUYER' });
        queryConditions.push({ user: userId, type: 'SELLER_BALANCE_TRANSFER' });
        queryConditions.push({ user: userId, type: 'REFERRAL_BALANCE_TRANSFER' });
        queryConditions.push({ user: userId, type: 'REFERRAL_COMMISSION_EARNED' });
        queryConditions.push({ user: userId, type: 'LUCKY_WHEEL_REWARD' });
        queryConditions.push({ user: userId, type: 'LEVEL_UP_REWARD' });
        queryConditions.push({ user: userId, type: 'TOURNAMENT_ENTRY' });
        queryConditions.push({ user: userId, type: 'TOURNAMENT_REFUND' });
        queryConditions.push({ user: userId, type: 'TOURNAMENT_PRIZE' });

        // يمكنك إضافة شروط أخرى هنا إذا احتجت
        // ...

        if (queryConditions.length === 0) {
            console.log(`[GetDashboardTxCtrl] No dashboard transaction types defined for User: ${userId}`);
            return res.status(200).json([]); // أرجع مصفوفة فارغة
        }

        const finalQuery = { $or: queryConditions };
        // [!!!] END: نهاية المنطق [!!!]

        console.log("[GetDashboardTxCtrl] Final Query:", JSON.stringify(finalQuery));

        const transactions = await Transaction.find(finalQuery)
            .select('amount currency type status createdAt description descriptionKey descriptionParams relatedMediationRequest')
            .populate('sender', 'fullName avatarUrl')
            .populate('recipient', 'fullName avatarUrl')
            .populate('relatedProduct', 'title')
            .populate({ path: 'relatedMediationRequest', select: '_id' })
            .sort({ createdAt: -1 })
            .limit(10) // يمكنك تغيير الحد
            .lean();

        console.log(`[GetDashboardTxCtrl] Found ${transactions.length} transactions for dashboard.`);
        res.status(200).json(transactions);

    } catch (error) {
        console.error("[GetDashboardTxCtrl] Error:", error.message, error.stack);
        res.status(500).json({ msg: "Failed to retrieve dashboard transactions." });
    }
};

// ---- دالة جديدة: تحويل رصيد البائع إلى الرصيد الأساسي ----
exports.transferSellerBalanceController = async (req, res) => {
    const { amount } = req.body;
    const userId = req.user._id;

    console.log(`[WalletCtrl TransferSeller] User: ${userId} attempting to transfer ${amount} from seller balance.`);

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ msg: "Invalid amount specified." });
    }

    // تطبيق نفس قواعد الإرسال
    const minTransferTND = 6.0; // يعادل تقريبًا 2 دولار
    if (numericAmount < minTransferTND) {
        return res.status(400).json({ msg: `Minimum transfer amount is ${formatCurrency(minTransferTND, 'TND')}.` });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if (!user) throw new Error("User not found.");

        const feeAmount = (numericAmount * TRANSFER_FEE_PERCENT) / 100;
        const totalDeducted = numericAmount + feeAmount;

        if (!user.sellerAvailableBalance || user.sellerAvailableBalance < totalDeducted) {
            throw new Error(`Insufficient seller balance. Required: ${formatCurrency(totalDeducted, 'TND')}, Available: ${formatCurrency(user.sellerAvailableBalance, 'TND')}`);
        }

        // تنفيذ التحويل
        user.sellerAvailableBalance -= totalDeducted;
        user.balance += numericAmount; // إضافة المبلغ الصافي للرصيد الأساسي

        await user.save({ session });

        // تسجيل المعاملة
        const newTransaction = new Transaction({
            user: userId,
            type: 'SELLER_BALANCE_TRANSFER',
            amount: numericAmount,
            currency: PLATFORM_BASE_CURRENCY,
            status: 'COMPLETED',
            descriptionKey: 'transactionDescriptions.sellerBalanceTransfer', // مفتاح الترجمة
            descriptionParams: {
                amount: formatCurrency(numericAmount, PLATFORM_BASE_CURRENCY)
            },
            metadata: {
                feeAmount: feeAmount,
                totalDeducted: totalDeducted
            }
        });
        await newTransaction.save({ session });

        // [!!!] إنشاء الإشعار داخل المعاملة [!!!]
        const notification = new Notification({
            user: userId,
            type: 'SELLER_BALANCE_TRANSFER_SUCCESS',
            title: 'notification_titles.BALANCE_TRANSFER_SUCCESS',
            message: 'notification_messages.BALANCE_TRANSFER_SUCCESS',
            messageParams: {
                amount: formatCurrency(numericAmount, PLATFORM_BASE_CURRENCY)
            },
            relatedEntity: { id: newTransaction._id, modelName: 'Transaction' }
        });
        await notification.save({ session });

        await session.commitTransaction();

        // إرسال تحديثات Socket.IO
        if (req.io && req.onlineUsers[userId.toString()]) {
            const socketId = req.onlineUsers[userId.toString()];
            req.io.to(socketId).emit('user_balances_updated', {
                _id: userId.toString(),
                balance: user.balance,
                sellerAvailableBalance: user.sellerAvailableBalance
            });
            // [!!!] إرسال الإشعار عبر السوكيت [!!!]
            req.io.to(socketId).emit('new_notification', notification.toObject());
        }

        res.status(200).json({
            msg: "Balance transferred successfully!", // رسالة احتياطية
            successMessage: { key: 'transferBalanceModal.success' }, // مفتاح الترجمة للنجاح
            updatedUser: {
                balance: user.balance,
                sellerAvailableBalance: user.sellerAvailableBalance
            }
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("[WalletCtrl TransferSeller] Error:", error.message);
        res.status(400).json({
            errorMessage: {
                key: 'transferBalanceModal.errors.unknown',
                fallback: error.message || "Failed to transfer balance."
            }
        });
    } finally {
        if (session) await session.endSession();
    }
};