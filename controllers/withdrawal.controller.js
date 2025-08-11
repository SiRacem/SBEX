// server/controllers/withdrawal.controller.js
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) {
        console.warn(`formatCurrency received invalid amount: ${amount}`);
        return "N/A";
    }
    if (typeof currencyCode !== 'string' || currencyCode.trim() === '') {
        console.warn(`formatCurrency received invalid currency code: ${currencyCode}. Falling back to TND.`);
        currencyCode = "TND";
    }
    try {
        return num.toLocaleString("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) {
        console.warn(`Could not format currency for code: ${currencyCode}`, error);
        return `${num.toFixed(2)} ${currencyCode}`;
    }
};

const calculateFeeAndNetInCurrency = (method, totalAmount, currency) => {
    if (!method || isNaN(totalAmount) || totalAmount <= 0) {
        console.warn("[calculateFeeAndNetInCurrency] Invalid input:", { methodExists: !!method, totalAmount, currency });
        return { fee: 0, net: 0, error: "Invalid input for fee calculation." };
    }
    const withdrawalPercent = method.withdrawalCommissionPercent ?? 0;
    if (withdrawalPercent < 0 || withdrawalPercent > 100) {
        console.error(`Invalid withdrawalCommissionPercent (${withdrawalPercent}) for method ${method._id}`);
        return { fee: 0, net: 0, error: "Invalid commission setting." };
    }
    let fee = (totalAmount * withdrawalPercent) / 100;
    fee = Math.max(0, fee);
    const netAmountToReceive = totalAmount - fee;
    if (netAmountToReceive < 0) {
        console.error(`[Fee Calc Error - ${currency}] Fee (${fee}) exceeds amount (${totalAmount}) for method ${method._id}`);
        return { fee: Number(fee.toFixed(2)), net: Number(netAmountToReceive.toFixed(2)), error: `Calculated fee (${formatCurrency(fee, currency)}) matches or exceeds withdrawal amount.` };
    }
    return { fee: Number(fee.toFixed(2)), net: Number(netAmountToReceive.toFixed(2)), error: null };
};

const calculateWithdrawalFeeTND = (method, amountInTND) => {
    if (!method || isNaN(amountInTND) || amountInTND <= 0) {
        return { fee: 0, netAmountToReceive: 0, error: "Invalid input amount for TND fee calculation." };
    }
    const minWithdrawalTND = method.minWithdrawalTND ?? 0;
    if (amountInTND < minWithdrawalTND) {
        return { fee: 0, netAmountToReceive: 0, error: `Minimum withdrawal amount is ${formatCurrency(minWithdrawalTND, 'TND')}.` };
    }
    const calcResult = calculateFeeAndNetInCurrency(method, amountInTND, 'TND');
    return { fee: calcResult.fee, netAmountToReceive: calcResult.net, error: calcResult.error };
};

const notifyUserAndAdminsOnCreate = async (req, newRequest, user) => {
    try {
        const admins = await User.find({ userRole: 'Admin' }).select('_id').lean();

        const userNotification = {
            user: user._id,
            type: 'NEW_WITHDRAWAL_REQUEST',
            title: 'notification_titles.NEW_WITHDRAWAL_REQUEST',
            message: 'notification_messages.NEW_WITHDRAWAL_REQUEST',
            messageParams: {
                amount: formatCurrency(newRequest.originalAmount, newRequest.originalCurrency)
            },
            relatedEntity: { id: newRequest._id, modelName: 'WithdrawalRequest' }
        };

        const adminNotifications = admins.map(admin => ({
            user: admin._id,
            type: 'NEW_WITHDRAWAL_REQUEST',
            title: 'notification_titles.NEW_WITHDRAWAL_REQUEST',
            message: 'notification_messages.NEW_WITHDRAWAL_REQUEST_ADMIN',
            messageParams: {
                userName: user.fullName || user.email,
                amount: formatCurrency(newRequest.originalAmount, newRequest.originalCurrency)
            },
            relatedEntity: { id: newRequest._id, modelName: 'WithdrawalRequest' }
        }));

        const notificationsToCreate = [userNotification, ...adminNotifications];
        const createdNotifications = await Notification.insertMany(notificationsToCreate);

        const populatedRequestForSocket = await WithdrawalRequest.findById(newRequest._id).populate('user', 'fullName email avatarUrl').lean();

        createdNotifications.forEach(notif => {
            const socketId = req.onlineUsers ? req.onlineUsers[notif.user.toString()] : null;
            if (socketId) {
                req.io.to(socketId).emit('new_notification', notif.toObject());
                if (admins.some(a => a._id.equals(notif.user))) {
                    req.io.to(socketId).emit('new_admin_transaction_request', { type: 'withdrawal', request: populatedRequestForSocket });
                }
            }
        });
    } catch (error) {
        console.error("Error sending withdrawal creation notifications:", error);
    }
};

const notifyUserOnStatusChange = async (req, request, status, reason = '') => {
    try {
        const type = status === 'Completed' ? 'WITHDRAWAL_COMPLETED' : 'WITHDRAWAL_REJECTED';
        const titleKey = `notification_titles.${type}`;
        const messageKey = `notification_messages.${type}`;

        const messageParams = {
            amount: formatCurrency(request.originalAmount, request.originalCurrency),
            methodName: request.paymentMethod?.displayName || 'N/A'
        };
        if (status === 'Rejected') {
            messageParams.reason = reason;
        }

        const notification = await Notification.create({
            user: request.user._id, type, title: titleKey, message: messageKey,
            messageParams, relatedEntity: { id: request._id, modelName: 'WithdrawalRequest' }
        });

        const socketId = req.onlineUsers ? req.onlineUsers[request.user._id.toString()] : null;
        if (socketId && req.io) {
            req.io.to(socketId).emit('new_notification', notification.toObject());

            const latestUser = await User.findById(request.user._id).select('-password').lean();
            if (latestUser) {
                req.io.to(socketId).emit('user_balances_updated', latestUser);
            }
            req.io.to(socketId).emit('dashboard_transactions_updated', { requestId: request._id });
        }
    } catch (error) {
        console.error(`Error sending ${status} notification for withdrawal ${request._id}:`, error);
    }
};

exports.createWithdrawalRequest = async (req, res) => {
    const userId = req.user._id;
    const { amount, methodId, withdrawalInfo, originalAmount, originalCurrency } = req.body;

    if (!amount || !methodId || !withdrawalInfo || !originalAmount || !originalCurrency || !['TND', 'USD'].includes(originalCurrency)) {
        return res.status(400).json({ msg: "All fields are required." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const [user, paymentMethod] = await Promise.all([
            User.findById(userId).session(session),
            PaymentMethod.findOne({ _id: methodId, isActive: true, type: { $in: ['withdrawal', 'both'] } }).session(session)
        ]);

        if (!user) throw new Error("User not found.");
        if (!paymentMethod) throw new Error("Withdrawal method not found or is inactive.");

        const numericAmountTND = Number(amount);
        if (user.balance < numericAmountTND) {
            throw new Error(`Insufficient balance.`);
        }

        const feeCalcTND = calculateWithdrawalFeeTND(paymentMethod, numericAmountTND);
        if (feeCalcTND.error) throw new Error(feeCalcTND.error);

        user.balance -= numericAmountTND;
        await user.save({ session });

        const newRequest = new WithdrawalRequest({
            user: userId, paymentMethod: paymentMethod._id, amount: numericAmountTND,
            currency: 'TND', status: 'Pending', feeAmount: feeCalcTND.fee,
            netAmountToReceive: feeCalcTND.netAmountToReceive, withdrawalInfo,
            originalAmount: Number(originalAmount), originalCurrency
        });
        await newRequest.save({ session });

        await session.commitTransaction();

        await notifyUserAndAdminsOnCreate(req, newRequest, user);

        res.status(201).json({
            successMessage: 'api_success.withdrawalRequestSubmitted',
            successMessageParams: { amount: formatCurrency(Number(originalAmount), originalCurrency) },
            request: newRequest.toObject()
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(400).json({ msg: error.message || "Failed to submit withdrawal request." });
    } finally {
        session.endSession();
    }
};

exports.getUserRequests = async (req, res) => {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
        return res.status(401).json({
            errorMessage: { key: 'apiErrors.notAuthorized', fallback: 'User not authenticated.' }
        });
    }

    try {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        // جلب الطلبات والعدد الإجمالي في نفس الوقت لتحسين الأداء
        const [requests, totalRequests] = await Promise.all([
            WithdrawalRequest.find({ user: userId })
                .populate({ path: 'paymentMethod', select: 'name displayName logoUrl' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            WithdrawalRequest.countDocuments({ user: userId })
        ]);

        // إرسال الاستجابة ببنية متوقعة وصحيحة
        res.status(200).json({
            requests: requests, // <--- إرسال المفتاح "requests" دائمًا
            totalPages: Math.ceil(totalRequests / limitNum),
            currentPage: pageNum,
            totalRequests: totalRequests
        });

    } catch (error) {
        console.error("[WithdrawCtrl - getUserRequests] Error fetching user withdrawal requests:", error);
        res.status(500).json({
            errorMessage: { key: 'apiErrors.Failed_to_fetch_withdrawal_requests', fallback: 'Server error fetching your withdrawal requests.' }
        });
    }
};

exports.adminGetRequests = async (req, res) => {
    const { status, page = 1, limit = 15 } = req.query;
    const filter = {};
    if (status && ['pending', 'processing', 'completed', 'rejected', 'failed'].includes(status.toLowerCase())) {
        filter.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }

    try {
        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 15,
            sort: { createdAt: -1 },
            populate: [
                { path: 'user', select: 'fullName email avatarUrl' },
                { path: 'paymentMethod', select: 'name displayName logoUrl' }
            ],
            lean: true
        };

        if (typeof WithdrawalRequest.paginate !== 'function') {
            throw new Error("Server configuration error: Pagination is not available for withdrawals.");
        }

        const result = await WithdrawalRequest.paginate(filter, options);
        res.status(200).json({
            requests: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalRequests: result.totalDocs
        });

    } catch (error) {
        console.error("[WithdrawCtrl - adminGetRequests] Error:", error);
        // [!!!] START OF THE FIX [!!!]
        // أرسل كائن خطأ منظم بدلاً من نص خام
        res.status(500).json({
            errorMessage: { key: 'admin.withdrawals.loadFail', fallback: 'Server error fetching requests.' }
        });
        // [!!!] END OF THE FIX [!!!]
    }
};

exports.adminGetRequestDetails = async (req, res) => {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ msg: "Invalid request ID format." });
    }

    try {
        const request = await WithdrawalRequest.findById(requestId)
            .populate('user', 'fullName email phone balance')
            .populate('paymentMethod')
            .populate('processedBy', 'fullName email')
            .lean();

        if (!request) {
            return res.status(404).json({ msg: "Withdrawal request not found." });
        }
        res.status(200).json(request);
    } catch (error) {
        res.status(500).json({ msg: "Server error fetching request details." });
    }
};

exports.adminCompleteWithdrawal = async (req, res) => {
    const { requestId } = req.params;
    const { transactionReference, adminNotes } = req.body;
    const adminUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ msg: "Invalid request ID format." });
    }

    try {
        const updatedRequest = await WithdrawalRequest.findOneAndUpdate(
            { _id: requestId, status: { $in: ['Pending', 'Processing'] } },
            {
                $set: {
                    status: 'Completed',
                    processedBy: adminUserId,
                    processedAt: new Date(),
                    transactionReference: transactionReference || undefined,
                    adminNotes: adminNotes || undefined
                }
            },
            { new: true, runValidators: true }
        ).populate('paymentMethod user');

        if (!updatedRequest) {
            throw new Error("Request not found or already processed.");
        }

        await User.updateOne(
            { _id: updatedRequest.user._id },
            { $inc: { withdrawalBalance: updatedRequest.amount } }
        );

        await notifyUserOnStatusChange(req, updatedRequest, 'Completed');

        const finalCompletedRequest = await WithdrawalRequest.findById(updatedRequest._id)
            .populate('user', 'fullName email balance')
            .populate('paymentMethod')
            .populate('processedBy', 'fullName email')
            .lean();

        res.status(200).json({ msg: "Withdrawal marked as completed.", updatedRequest: finalCompletedRequest });

    } catch (error) {
        res.status(400).json({ msg: error.message || "Failed to complete withdrawal request." });
    }
};

exports.adminRejectWithdrawal = async (req, res) => {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const adminUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(requestId) || !rejectionReason?.trim()) {
        return res.status(400).json({ msg: "Invalid ID or reason provided." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await WithdrawalRequest.findOne({ _id: requestId, status: 'Pending' })
            .session(session).populate('paymentMethod').populate('user');

        if (!request) {
            throw new Error("Pending request not found or already processed.");
        }

        const userToRefund = request.user;
        const amountToRefundTND = request.amount;

        userToRefund.balance += amountToRefundTND;
        await userToRefund.save({ session });

        request.status = 'Rejected';
        request.rejectionReason = rejectionReason.trim();
        request.processedBy = adminUserId;
        request.processedAt = new Date();
        await request.save({ session });

        await session.commitTransaction();

        await notifyUserOnStatusChange(req, request, 'Rejected', rejectionReason.trim());

        const finalRejectedRequest = await WithdrawalRequest.findById(request._id)
            .populate('user', 'fullName email').populate('paymentMethod').lean();

        res.status(200).json({ msg: "Withdrawal rejected and user refunded.", updatedRequest: finalRejectedRequest });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(400).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};