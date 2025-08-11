// server/controllers/deposit.controller.js

const DepositRequest = require('../models/DepositRequest');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const config = require('config');

// --- سعر الصرف ---
const TND_USD_EXCHANGE_RATE = config.get('TND_USD_EXCHANGE_RATE') || 3.0;

// --- دالة تنسيق العملة ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || !currencyCode) return "N/A";
    try {
        // Use a consistent locale for backend formatting to avoid server-specific issues
        return num.toLocaleString("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) { return `${num.toFixed(2)} ${currencyCode}`; }
};

// --- دالة حساب العمولة في الخادم (المنطق الكامل) ---
const calculateCommissionServer = (method, amount, currency) => {
    if (!method || isNaN(amount) || amount <= 0) {
        return { fee: 0, netAmount: 0 };
    }
    const depositPercent = method.depositCommissionPercent ?? 0;
    let fee = (amount * depositPercent) / 100;
    fee = Math.max(0, fee);
    const netAmount = amount - fee;
    if (netAmount < 0 && amount > 0) {
        return { fee: Number(fee.toFixed(2)), netAmount: 0 };
    }
    return { fee: Number(fee.toFixed(2)), netAmount: Number(netAmount.toFixed(2)) };
};


// --- إنشاء طلب إيداع جديد ---
exports.createDepositRequest = async (req, res) => {
    const userId = req.user._id;
    const userFullName = req.user.fullName;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { amount, currency, methodName, transactionId, senderInfo, screenshotUrl } = req.body;
        if (!amount || !currency || !methodName) throw new Error("Missing required fields.");
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) throw new Error("Invalid amount.");
        const paymentMethodDoc = await PaymentMethod.findOne({ name: methodName, isActive: true }).session(session);
        if (!paymentMethodDoc) throw new Error(`Payment method '${methodName}' not found or inactive.`);

        const { fee, netAmount } = calculateCommissionServer(paymentMethodDoc, numericAmount, currency);

        const newDepositRequest = new DepositRequest({
            user: userId,
            amount: numericAmount,
            currency,
            paymentMethod: paymentMethodDoc._id,
            transactionId: transactionId || undefined,
            senderInfo: senderInfo || undefined,
            screenshotUrl: screenshotUrl || undefined,
            feeAmount: fee,
            netAmountCredited: netAmount,
            status: 'pending'
        });
        await newDepositRequest.save({ session });

        const admins = await User.find({ userRole: 'Admin' }).select('_id').lean().session(session);
        const notificationsToCreate = [];

        // [!!!] تعديل: إشعار المستخدم يستخدم مفاتيح الترجمة
        notificationsToCreate.push({
            user: userId,
            type: 'DEPOSIT_PENDING',
            title: 'notification_titles.DEPOSIT_PENDING',
            message: 'notification_messages.DEPOSIT_PENDING',
            messageParams: { amount: formatCurrency(numericAmount, currency) },
            relatedEntity: { id: newDepositRequest._id, modelName: 'DepositRequest' }
        });

        // [!!!] تعديل: إشعار الأدمن يستخدم مفاتيح الترجمة
        admins.forEach(admin => {
            notificationsToCreate.push({
                user: admin._id,
                type: 'NEW_DEPOSIT_REQUEST',
                title: 'notification_titles.NEW_DEPOSIT_REQUEST',
                message: 'notification_messages.NEW_DEPOSIT_REQUEST',
                messageParams: {
                    amount: formatCurrency(numericAmount, currency),
                    userName: userFullName
                },
                relatedEntity: { id: newDepositRequest._id, modelName: 'DepositRequest' }
            });
        });

        const createdNotifications = await Notification.insertMany(notificationsToCreate, { session });

        await session.commitTransaction();

        const populatedRequestForSocket = await DepositRequest.findById(newDepositRequest._id)
            .populate('user', 'fullName email avatarUrl')
            .lean();

        // إرسال الإشعارات عبر Socket.IO
        createdNotifications.forEach(notif => {
            const socketId = req.onlineUsers ? req.onlineUsers[notif.user.toString()] : null;
            if (socketId) {
                req.io.to(socketId).emit('new_notification', notif);
                // إرسال طلب جديد للأدمن لتحديث القائمة
                if (notif.type === 'NEW_DEPOSIT_REQUEST') {
                    req.io.to(socketId).emit('new_admin_transaction_request', { type: 'deposit', request: populatedRequestForSocket });
                }
            }
        });

        // [!!!] تعديل: رسالة النجاح تستخدم مفاتيح الترجمة
        res.status(201).json({
            successMessage: 'api_success.depositRequestSubmitted', // مفتاح الترجمة للـ Toast
            successMessageParams: {
                amount: formatCurrency(numericAmount, currency)
            },
            request: newDepositRequest.toObject()
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("--- CreateDepositRequest ERROR ---:", error);
        // [!!!] تعديل: رسالة الخطأ تستخدم مفاتيح الترجمة
        res.status(400).json({
            errorMessage: {
                key: 'api_error.createDepositFail',
                fallback: error.message || "Failed to create deposit request."
            }
        });
    } finally {
        session.endSession();
    }
};

// --- [جديد] جلب طلبات الإيداع الخاصة بالمستخدم المسجل ---
exports.getUserDepositRequests = async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    try {
        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { createdAt: -1 },
            populate: { path: 'paymentMethod', select: 'name displayName logoUrl' },
            lean: true,
        };
        // باستخدام mongoose-paginate-v2 مباشرة
        const result = await DepositRequest.paginate({ user: userId }, options);
        res.status(200).json(result.docs); // أرسل المصفوفة مباشرة كما تتوقعها الواجهة الأمامية

    } catch (error) {
        console.error("--- GetUserDepositRequests ERROR ---:", error);
        res.status(500).json({ msg: "Server error fetching your deposit requests." });
    }
};


// --- جلب طلبات الإيداع للأدمن ---
exports.adminGetDepositRequests = async (req, res) => {
    const { status, page = 1, limit = 15 } = req.query;
    const filter = {};
    if (status && ['pending', 'approved', 'rejected', 'processing'].includes(status.toLowerCase())) {
        filter.status = status.toLowerCase();
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    try {
        const totalRequests = await DepositRequest.countDocuments(filter);
        const requests = await DepositRequest.find(filter)
            .populate([
                { path: 'user', select: 'fullName email avatarUrl balance phone' },
                { path: 'paymentMethod', select: 'name displayName logoUrl' }
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();
        res.status(200).json({ requests, currentPage: pageNum, totalPages: Math.ceil(totalRequests / limitNum), totalRequests });
    } catch (error) {
        console.error("--- AdminGetDepositRequests ERROR ---:", error);
        res.status(500).json({ msg: "Server error fetching requests." });
    }
};

// --- الموافقة على طلب الإيداع ---
exports.adminApproveDeposit = async (req, res) => {
    const { id } = req.params;
    const adminUserId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ msg: "Invalid ID." });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const depositRequest = await DepositRequest.findById(id)
            .populate('paymentMethod')
            .populate('user', 'balance sellerAvailableBalance sellerPendingBalance')
            .session(session);

        if (!depositRequest) throw new Error("Request not found.");
        if (depositRequest.status !== 'pending') throw new Error(`Request already ${depositRequest.status}.`);

        const userToUpdate = depositRequest.user;
        if (!userToUpdate) throw new Error("User associated with the deposit request not found.");

        let amountToAdd = depositRequest.netAmountCredited;
        const userBalanceCurrency = 'TND';

        if (depositRequest.currency.toUpperCase() !== userBalanceCurrency) {
            if (depositRequest.currency.toUpperCase() === 'USD') amountToAdd = depositRequest.netAmountCredited * TND_USD_EXCHANGE_RATE;
            else throw new Error(`Unsupported currency conversion from ${depositRequest.currency} to ${userBalanceCurrency}.`);
            amountToAdd = Number(amountToAdd.toFixed(2));
        }

        const updatedUserAfterDeposit = await User.findByIdAndUpdate(
            userToUpdate._id,
            { $inc: { balance: amountToAdd, depositBalance: amountToAdd } },
            { session, new: true, runValidators: true }
        ).select('balance depositBalance withdrawalBalance sellerAvailableBalance sellerPendingBalance');

        if (!updatedUserAfterDeposit) throw new Error("User not found or failed to update balance.");

        depositRequest.status = 'approved';
        depositRequest.processedAt = new Date();
        depositRequest.processedBy = adminUserId;
        await depositRequest.save({ session });

        const completedTransaction = new Transaction({
            user: userToUpdate._id, amount: amountToAdd, currency: userBalanceCurrency,
            type: 'DEPOSIT_COMPLETED', // Changed for clarity in history
            status: 'COMPLETED',
            description: `Approved Deposit: ${formatCurrency(depositRequest.amount, depositRequest.currency)} via ${depositRequest.paymentMethod?.name || 'N/A'}`,
            relatedEntity: { id: depositRequest._id, modelName: 'DepositRequest' },
        });
        await completedTransaction.save({ session });

        // [!!!] تعديل: إشعار الموافقة يستخدم مفاتيح الترجمة
        const approvalNotification = new Notification({
            user: userToUpdate._id,
            type: 'DEPOSIT_APPROVED',
            title: 'notification_titles.DEPOSIT_APPROVED',
            message: 'notification_messages.DEPOSIT_APPROVED',
            messageParams: { amount: formatCurrency(depositRequest.amount, depositRequest.currency) },
            relatedEntity: { id: depositRequest._id, modelName: 'DepositRequest' }
        });
        await approvalNotification.save({ session });

        await session.commitTransaction();

        const userSocketId = req.onlineUsers ? req.onlineUsers[userToUpdate._id.toString()] : null;
        if (userSocketId) {
            req.io.to(userSocketId).emit('new_notification', approvalNotification.toObject());
            req.io.to(userSocketId).emit('user_balances_updated', {
                _id: userToUpdate._id.toString(),
                balance: updatedUserAfterDeposit.balance,
                depositBalance: updatedUserAfterDeposit.depositBalance,
                withdrawalBalance: updatedUserAfterDeposit.withdrawalBalance,
                sellerAvailableBalance: updatedUserAfterDeposit.sellerAvailableBalance,
                sellerPendingBalance: updatedUserAfterDeposit.sellerPendingBalance
            });
            req.io.to(userSocketId).emit('dashboard_transactions_updated', {});
        }

        const finalUpdatedRequest = await DepositRequest.findById(id)
            .populate('user', 'fullName email balance phone depositBalance sellerAvailableBalance sellerPendingBalance')
            .populate('paymentMethod')
            .lean();

        // [!!!] تعديل: رسالة النجاح للادمن تستخدم نصا ثابتا (لا يحتاج ترجمة)
        res.status(200).json({ msg: "Deposit approved and balance updated.", request: finalUpdatedRequest });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("--- ApproveDeposit ERROR ---:", error);
        res.status(400).json({ msg: error.message || "Approval failed." });
    } finally {
        session.endSession();
    }
};

// --- رفض طلب إيداع ---
exports.adminRejectDeposit = async (req, res) => {
    const { id } = req.params;
    const adminUserId = req.user._id;
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ msg: "Invalid ID." });
    if (!reason || reason.trim() === '') return res.status(400).json({ msg: "Reason required." });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const rejectedRequest = await DepositRequest.findOneAndUpdate(
            { _id: id, status: 'pending' },
            { $set: { status: 'rejected', rejectionReason: reason, processedAt: new Date(), processedBy: adminUserId } },
            { session, new: true }).populate('paymentMethod');

        if (!rejectedRequest) throw new Error("Pending request not found or already processed.");

        // [!!!] تعديل: إشعار الرفض يستخدم مفاتيح الترجمة
        const notification = new Notification({
            user: rejectedRequest.user,
            type: 'DEPOSIT_REJECTED',
            title: 'notification_titles.DEPOSIT_REJECTED',
            message: 'notification_messages.DEPOSIT_REJECTED',
            messageParams: {
                amount: formatCurrency(rejectedRequest.amount, rejectedRequest.currency),
                reason: reason
            },
            relatedEntity: { id: rejectedRequest._id, modelName: 'DepositRequest' }
        });
        await notification.save({ session });

        await session.commitTransaction();

        const targetSocketId = req.onlineUsers ? req.onlineUsers[notification.user.toString()] : null;
        if (targetSocketId) req.io.to(targetSocketId).emit('new_notification', notification.toObject());

        const finalRejectedRequest = await DepositRequest.findById(id).populate('user', 'fullName email balance phone').populate('paymentMethod').lean();
        res.status(200).json({ msg: "Deposit rejected.", request: finalRejectedRequest });
    } catch (error) {
        await session.abortTransaction();
        console.error("--- RejectDeposit ERROR ---:", error);
        res.status(400).json({ msg: error.message || "Rejection failed." });
    } finally {
        session.endSession();
    }
};