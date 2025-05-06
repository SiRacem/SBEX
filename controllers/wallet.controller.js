// server/controllers/wallet.controller.js
// *** نسخة معدلة لحساب الرسوم وتحويل العملة في sendFundsController ***

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// --- ثوابت ---
const TRANSFER_FEE_PERCENT = 2; // 2%
const TND_TO_USD_RATE = 3.0; // تأكد من تطابقه مع الواجهة الأمامية والإعدادات

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
    const minSend = currency === 'USD' ? (6.0 / TND_TO_USD_RATE) : 6.0;
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
            totalDeductedTND = (numericAmount + transferFee) * TND_TO_USD_RATE;
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
            netAmountForRecipientTND = numericAmount * TND_TO_USD_RATE;
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
        const transactions = await Transaction.find({ $or: [{ user: userId }, { sender: userId }, { recipient: userId }] })
            .populate('sender', 'fullName email avatarUrl')
            .populate('recipient', 'fullName email avatarUrl')
            .populate('user', 'fullName email avatarUrl')
            .sort({ createdAt: -1 })
            .limit(50); // Consider pagination for large histories
        console.log(`[WalletCtrl GetTx] Found ${transactions.length} transactions.`);
        res.status(200).json(transactions);
    } catch (error) {
        console.error("[WalletCtrl GetTx] Error fetching transactions:", error);
        res.status(500).json({ msg: "Failed to retrieve transactions." });
    }
};
// -------------------------------------