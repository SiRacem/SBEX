// server/controllers/deposit.controller.js
// *** نسخة نهائية كاملة ومفصلة ***

const DepositRequest = require('../models/DepositRequest');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const config = require('config');

// --- سعر الصرف ---
const TND_TO_USD_RATE = config.get('TND_TO_USD_RATE') || 3.1;
console.log(`[DepositCtrl] Using TND_TO_USD_RATE: ${TND_TO_USD_RATE}`);

// --- دالة تنسيق العملة ---
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || !currencyCode) return "N/A";
    try {
        return num.toLocaleString(undefined, { style: "currency", currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) { return `${num.toFixed(2)} ${currencyCode}`; }
};

// --- دالة حساب العمولة في الخادم (المنطق الكامل) ---
const calculateCommissionServer = (method, amount, currency) => {
    console.log(`[CalcComm] Calculating for Method: ${method?.name || 'Unknown'}, Amount: ${amount} ${currency}`);
    if (!method) {
        console.error("[CalcComm] Error: Payment method details are missing.");
        return { fee: 0, netAmount: amount };
    }
    if (isNaN(amount) || amount <= 0) {
        return { fee: 0, netAmount: 0 };
    }

    // --- استخدم فقط النسبة المئوية للإيداع ---
    const depositPercent = method.depositCommissionPercent ?? 0;
    console.log(`   [CalcComm] Using depositPercent: ${depositPercent}`); // <-- أضف هذا
    let fee = (amount * depositPercent) / 100;
    console.log(`   [CalcComm] Calculated initial fee: ${fee}`);
    // --------------------------------------

    fee = Math.max(0, fee);
    const netAmount = amount - fee;

    if (netAmount < 0 && amount > 0) {
        console.error(`[CalcComm] Fee (${fee.toFixed(2)}) exceeds amount (${amount}) for method ${method.name}`);
        return { fee: Number(fee.toFixed(2)), netAmount: 0 };
    }

    console.log(`[CalcComm] Result - Fee: ${fee.toFixed(2)}, Net: ${netAmount.toFixed(2)}`);
    return { fee: Number(fee.toFixed(2)), netAmount: Number(netAmount.toFixed(2)) };
};
// ------------------------------------------

// --- إنشاء طلب إيداع جديد ---
exports.createDepositRequest = async (req, res) => {
    const userId = req.user._id;
    const userFullName = req.user.fullName;
    console.log(`--- CreateDepositRequest Start User: ${userId} ---`);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { amount, currency, methodName, transactionId, senderInfo, screenshotUrl } = req.body;
        console.log("   Body Data:", { amount, currency, methodName, transactionId, senderInfo, screenshotUrl });
        if (!amount || !currency || !methodName) throw new Error("Missing required fields.");
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) throw new Error("Invalid amount.");
        const paymentMethodDoc = await PaymentMethod.findOne({ name: methodName, isActive: true }).session(session);
        console.log("Found Payment Method Doc:", paymentMethodDoc);
        if (!paymentMethodDoc) throw new Error(`Payment method '${methodName}' not found or inactive.`);
        const { fee, netAmount } = calculateCommissionServer(paymentMethodDoc, numericAmount, currency); // حساب العمولة هنا
        const newDepositRequest = new DepositRequest({
            user: userId, amount: numericAmount, currency, method: methodName, paymentMethod: paymentMethodDoc._id,
            transactionId: transactionId || undefined, senderInfo: senderInfo || undefined,
            screenshotUrl: screenshotUrl || undefined, feeAmount: fee, netAmountCredited: netAmount, status: 'pending'
        });
        await newDepositRequest.save({ session });
        console.log("   DepositRequest saved:", newDepositRequest._id);
        const depositTransaction = new Transaction({
            user: userId, amount: netAmount, currency, type: 'DEPOSIT', status: 'PENDING',
            description: `Deposit: ${numericAmount} ${currency} via ${methodName}. Fee: ${fee}`,
            relatedDepositRequest: newDepositRequest._id
        });
        await depositTransaction.save({ session });
        console.log("   Transaction saved:", depositTransaction._id);
        const admins = await User.find({ userRole: 'Admin' }).select('_id').lean().session(session);
        const notifications = [];
        notifications.push({ user: userId, type: 'DEPOSIT_PENDING', title: 'Deposit Pending', message: `Request for ${formatCurrency(numericAmount, currency)} is pending.`, relatedEntity: { id: newDepositRequest._id, modelName: 'DepositRequest' } });
        admins.forEach(admin => notifications.push({ user: admin._id, type: 'NEW_DEPOSIT_REQUEST', title: 'New Deposit', message: `User ${userFullName} requested ${formatCurrency(numericAmount, currency)}. Fee: ${formatCurrency(fee, currency)}`, relatedEntity: { id: newDepositRequest._id, modelName: 'DepositRequest' } }));
        const createdNotifications = await Notification.insertMany(notifications, { session });
        console.log(`   ${createdNotifications.length} notifications saved.`);
        await session.commitTransaction();
        console.log("   Transaction committed.");
        createdNotifications.forEach(notif => {
            const targetSocketId = req.onlineUsers ? req.onlineUsers[notif.user.toString()] : null;
            if (targetSocketId) req.io.to(targetSocketId).emit('new_notification', notif.toObject());
        });
        res.status(201).json({ msg: "Deposit request submitted.", request: newDepositRequest.toObject() });
    } catch (error) {
        await session.abortTransaction();
        console.error("--- CreateDepositRequest ERROR ---:", error);
        res.status(400).json({ msg: error.message || "Failed to create deposit request." });
    } finally {
        session.endSession();
        console.log("   CreateDepositRequest Session Ended.");
    }
};
// -------------------------------------------------------------

// --- [جديد] جلب طلبات الإيداع الخاصة بالمستخدم المسجل ---
exports.getUserDepositRequests = async (req, res) => {
    const userId = req.user._id; // ID المستخدم من verifyAuth middleware
    const { page = 1, limit = 10 } = req.query; // خيارات الترقيم (اختياري)
    console.log(`--- GetUserDepositRequests Start User: ${userId} --- Query:`, req.query);

    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // بناء خيارات الترقيم لـ mongoose-paginate-v2 (إذا كنت تستخدمه)
        // أو للبحث اليدوي
        const options = {
            page: pageNum,
            limit: limitNum,
            sort: { createdAt: -1 }, // الأحدث أولاً
            populate: [ // جلب معلومات طريقة الدفع
                { path: 'paymentMethod', select: 'name displayName logoUrl' }
            ],
            lean: true, // للقراءة فقط أسرع
            // يمكنك إضافة populate لـ 'user' إذا احتجت معلومات المستخدم هنا أيضًا
        };

        // استخدم paginate إذا قمت بتفعيل الإضافة في النموذج
        // const result = await DepositRequest.paginate({ user: userId }, options);
        // res.status(200).json(result); // أرسل النتيجة مباشرة من paginate

        // --- أو البحث اليدوي (إذا لم تستخدم paginate) ---
        const skip = (pageNum - 1) * limitNum;
        const requests = await DepositRequest.find({ user: userId }) // <-- الفلترة حسب المستخدم
            .populate(options.populate)
            .sort(options.sort)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const totalRequests = await DepositRequest.countDocuments({ user: userId });
        console.log(`   Fetched ${requests.length} of ${totalRequests} user requests.`);

        // تأكد من أن الواجهة الأمامية (depositRequestAction.js) تتوقع هذا الهيكل
        res.status(200).json({
            requests, // المصفوفة الرئيسية للطلبات
            totalPages: Math.ceil(totalRequests / limitNum),
            currentPage: pageNum,
            totalRequests
        });
        // --------------------------------------

    } catch (error) {
        console.error("--- GetUserDepositRequests ERROR ---:", error);
        res.status(500).json({ msg: "Server error fetching your deposit requests." });
    }
};

// --- جلب طلبات الإيداع للأدمن ---
exports.adminGetDepositRequests = async (req, res) => {
    const { status, page = 1, limit = 15 } = req.query;
    console.log(`--- AdminGetDepositRequests --- Query:`, req.query);
    const filter = {};
    if (status && ['pending', 'approved', 'rejected', 'processing'].includes(status.toLowerCase())) { // استخدام toLowerCase هنا أيضاً للأمان
        filter.status = status.toLowerCase(); // تطبيق الفلتر
    }
    // ------------------------------------
    console.log(`   Applying filter:`, filter); // تحقق من الفلتر المطبق
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    try {
        const totalRequests = await DepositRequest.countDocuments(filter);
        const requests = await DepositRequest.find(filter)
            .populate([
                { path: 'user', select: 'fullName email avatarUrl balance phone' }, // جلب الرصيد والهاتف
                { path: 'paymentMethod', select: 'name displayName logoUrl' }
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();
        console.log(`   Fetched ${requests.length} of ${totalRequests} requests.`);
        res.status(200).json({ requests, currentPage: pageNum, totalPages: Math.ceil(totalRequests / limitNum), totalRequests });
    } catch (error) {
        console.error("--- AdminGetDepositRequests ERROR ---:", error);
        res.status(500).json({ msg: "Server error fetching requests." });
    }
};
// -------------------------------------------------------------

// --- الموافقة على طلب الإيداع ---
exports.adminApproveDeposit = async (req, res) => {
    const { id } = req.params;
    const adminUserId = req.user._id;
    console.log(`--- ApproveDeposit Start Request ID: ${id} by Admin: ${adminUserId} ---`);
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ msg: "Invalid ID." });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const depositRequest = await DepositRequest.findById(id).populate('paymentMethod').session(session); // Populate method for message
        if (!depositRequest) throw new Error("Request not found.");
        if (depositRequest.status !== 'pending') throw new Error(`Request already ${depositRequest.status}.`);
        console.log(`   Found pending request. Net: ${depositRequest.netAmountCredited} ${depositRequest.currency}, User: ${depositRequest.user}`);

        // حساب المبلغ المضاف مع تحويل العملة
        let amountToAdd = depositRequest.netAmountCredited;
        const userBalanceCurrency = 'TND'; // افترض أن عملة الرصيد هي TND
        if (depositRequest.currency !== userBalanceCurrency) {
            console.log(`   Converting ${depositRequest.currency} to ${userBalanceCurrency}`);
            if (depositRequest.currency === 'USD') amountToAdd = depositRequest.netAmountCredited * TND_TO_USD_RATE;
            else if (depositRequest.currency === 'TND') amountToAdd = depositRequest.netAmountCredited / TND_TO_USD_RATE; // Example if balance was USD
            else throw new Error("Unsupported currency conversion.");
            amountToAdd = Number(amountToAdd.toFixed(2)); // تقريب بعد التحويل
            console.log(`   Converted amount: ${amountToAdd} ${userBalanceCurrency}`);
        }

        // تحديث رصيد المستخدم
        const userUpdateResult = await User.updateOne({ _id: depositRequest.user }, { $inc: { balance: amountToAdd, depositBalance: amountToAdd } }, { session, runValidators: true });
        if (userUpdateResult.matchedCount === 0) throw new Error("User not found for balance update.");
        console.log(`   User balance update command sent.`);

        // تحديث طلب الإيداع
        depositRequest.status = 'approved';
        depositRequest.processedAt = new Date();
        depositRequest.processedBy = adminUserId;
        await depositRequest.save({ session });
        console.log("   Deposit request updated to 'approved'.");

        // تحديث المعاملة
        const transactionUpdateResult = await Transaction.updateOne({ relatedDepositRequest: id, status: 'PENDING' }, { $set: { status: 'COMPLETED', amount: depositRequest.netAmountCredited } }, { session });
        if (transactionUpdateResult.matchedCount > 0) console.log(`   Transaction status updated to 'COMPLETED'.`);
        else console.warn(`   Warning: PENDING transaction not found for request ${id}.`);

        // إنشاء وإرسال الإشعار
        const notification = new Notification({
            user: depositRequest.user, type: 'DEPOSIT_APPROVED', title: 'Deposit Approved',
            message: `Deposit of ${formatCurrency(depositRequest.amount, depositRequest.currency)} approved. ${formatCurrency(amountToAdd, userBalanceCurrency)} added to balance.`,
            relatedEntity: { id: depositRequest._id, modelName: 'DepositRequest' }
        });
        await notification.save({ session });
        console.log("   Notification created.");
        await session.commitTransaction();
        console.log("   Transaction committed.");
        const targetSocketId = req.onlineUsers ? req.onlineUsers[notification.user.toString()] : null;
        if (targetSocketId) req.io.to(targetSocketId).emit('new_notification', notification.toObject());
        const finalUpdatedRequest = await DepositRequest.findById(id).populate('user', 'fullName email balance phone').populate('paymentMethod').lean();
        res.status(200).json({ msg: "Deposit approved.", request: finalUpdatedRequest });
    } catch (error) {
        await session.abortTransaction();
        console.error("--- ApproveDeposit ERROR ---:", error);
        res.status(400).json({ msg: error.message || "Approval failed." });
    } finally {
        session.endSession();
        console.log("   ApproveDeposit Session Ended.");
    }
};
// -------------------------------------------------------------

// --- رفض طلب إيداع ---
exports.adminRejectDeposit = async (req, res) => {
    const { id } = req.params;
    const adminUserId = req.user._id;
    const { reason } = req.body;
    console.log(`--- RejectDeposit Start Request ID: ${id} by Admin: ${adminUserId} ---`);
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ msg: "Invalid ID." });
    if (!reason || reason.trim() === '') return res.status(400).json({ msg: "Reason required." });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const rejectedRequest = await DepositRequest.findOneAndUpdate(
            { _id: id, status: 'pending' },
            { $set: { status: 'rejected', rejectionReason: reason, adminNotes: reason, processedAt: new Date(), processedBy: adminUserId } },
            { session, new: true }).populate('paymentMethod');
        if (!rejectedRequest) throw new Error("Pending request not found or already processed.");
        console.log("   Deposit request updated to 'rejected'.");
        const transactionUpdateResult = await Transaction.updateOne({ relatedDepositRequest: id, status: 'PENDING' }, { $set: { status: 'REJECTED' } }, { session });
        if (transactionUpdateResult.matchedCount > 0) console.log(`   Transaction status updated to 'REJECTED'.`);
        else console.warn(`   Warning: PENDING transaction not found for request ${id}.`);
        const notification = new Notification({
            user: rejectedRequest.user, type: 'DEPOSIT_REJECTED', title: 'Deposit Rejected',
            message: `Deposit request of ${formatCurrency(rejectedRequest.amount, rejectedRequest.currency)} was rejected. Reason: ${reason}`,
            relatedEntity: { id: rejectedRequest._id, modelName: 'DepositRequest' }
        });
        await notification.save({ session });
        console.log("   Notification created.");
        await session.commitTransaction();
        console.log("   Transaction committed.");
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
        console.log("   RejectDeposit Session Ended.");
    }
};
// -------------------------------------------------------------