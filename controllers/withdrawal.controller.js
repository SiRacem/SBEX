// controllers/withdrawal.controller.js
// *** نسخة كاملة ومحدثة ***

const WithdrawalRequest = require('../models/WithdrawalRequest'); // تأكد من أن النموذج يحتوي على originalAmount/originalCurrency
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod'); // تأكد من أن النموذج يحتوي على deposit/withdrawalCommissionPercent
const Notification = require('../models/Notification'); // تأكد من أن enum type يحتوي على أنواع السحب
const mongoose = require('mongoose');

/**
 * تنسيق رقم كعملة.
 * @param {number | string | null | undefined} amount - المبلغ المراد تنسيقه.
 * @param {string} [currencyCode="TND"] - كود العملة (مثل 'TND', 'USD').
 * @returns {string} - المبلغ المنسق كنص أو "N/A" عند الخطأ.
 */
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
        return num.toLocaleString("en-US", {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    } catch (error) {
        console.warn(`Could not format currency for code: ${currencyCode}`, error);
        return `${num.toFixed(2)} ${currencyCode}`;
    }
};

/**
 * حساب الرسوم والمبلغ الصافي بعملة محددة بناءً على المبلغ الإجمالي بهذه العملة.
 * @param {object} method - كائن طريقة الدفع من قاعدة البيانات.
 * @param {number} totalAmount - المبلغ الإجمالي المراد تحليل الرسوم منه.
 * @param {string} currency - كود العملة ('TND' أو 'USD').
 * @returns {{fee: number, net: number, error: string | null}} - كائن يحتوي على الرسوم والصافي أو خطأ.
 */
const calculateFeeAndNetInCurrency = (method, totalAmount, currency) => {
    if (!method || isNaN(totalAmount) || totalAmount <= 0) {
        console.warn("[calculateFeeAndNetInCurrency] Invalid input:", { methodExists: !!method, totalAmount, currency });
        return { fee: 0, net: 0, error: "Invalid input for fee calculation." };
    }

    // استخدم نسبة عمولة السحب دائمًا
    const withdrawalPercent = method.withdrawalCommissionPercent ?? 0;
    if (withdrawalPercent < 0 || withdrawalPercent > 100) {
        console.error(`Invalid withdrawalCommissionPercent (${withdrawalPercent}) for method ${method._id}`);
        return { fee: 0, net: 0, error: "Invalid commission setting." };
    }

    // حساب العمولة بناءً على المبلغ الإجمالي ونسبة السحب
    let fee = (totalAmount * withdrawalPercent) / 100;
    fee = Math.max(0, fee); // العمولة لا تكون سالبة

    // المبلغ الصافي = الإجمالي - العمولة
    const netAmountToReceive = totalAmount - fee;

    if (netAmountToReceive < 0) {
        console.error(`[Fee Calc Error - ${currency}] Fee (${fee}) exceeds amount (${totalAmount}) for method ${method._id}`);
        return { fee: Number(fee.toFixed(2)), net: Number(netAmountToReceive.toFixed(2)), error: `Calculated fee (${formatCurrency(fee, currency)}) matches or exceeds withdrawal amount.` };
    }

    return {
        fee: Number(fee.toFixed(2)),
        net: Number(netAmountToReceive.toFixed(2)),
        error: null
    };
};

/**
 * حساب الرسوم والمبلغ الصافي بالدينار TND بناءً على المبلغ الإجمالي بالدينار.
 * (تستخدم للتحقق النهائي وحفظ القيم بالدينار)
 * @param {object} method - كائن طريقة الدفع.
 * @param {number} amountInTND - المبلغ الإجمالي بالدينار.
 * @returns {{fee: number, netAmountToReceive: number, error: string | null}} - كائن يحتوي على الرسوم والصافي بالدينار أو خطأ.
 */
const calculateWithdrawalFeeTND = (method, amountInTND) => {
    if (!method || isNaN(amountInTND) || amountInTND <= 0) {
        return { fee: 0, netAmountToReceive: 0, error: "Invalid input amount for TND fee calculation." };
    }

    // التحقق من الحد الأدنى بالدينار
    const minWithdrawalTND = method.minWithdrawalTND ?? 0;
    if (amountInTND < minWithdrawalTND) {
        return { fee: 0, netAmountToReceive: 0, error: `Minimum withdrawal amount is ${formatCurrency(minWithdrawalTND, 'TND')}.` };
    }

    // حساب الرسوم والصافي باستخدام دالة العملة المحددة
    const calcResult = calculateFeeAndNetInCurrency(method, amountInTND, 'TND');

    // إرجاع النتيجة مع إعادة تسمية الحقل 'net' إلى 'netAmountToReceive' للمطابقة
    return {
        fee: calcResult.fee,
        netAmountToReceive: calcResult.net,
        error: calcResult.error
    };
};


// --- دوال الإشعارات ---

/**
 * إرسال إشعار لجميع الأدمنز.
 * @param {object} req - كائن الطلب (لتمرير io و onlineUsers).
 * @param {string} title - عنوان الإشعار.
 * @param {string} message - نص الإشعار.
 * @param {mongoose.Types.ObjectId} relatedEntityId - معرف الكائن المرتبط (WithdrawalRequest).
 */
const notifyAdminsWithdrawalRequest = async (req, title, message, relatedEntityId) => {
    let createdNotifications = [];
    try {
        console.log("[WithdrawCtrl - notifyAdmins] Finding admins...");
        const admins = await User.find({ userRole: 'Admin' }).select('_id');
        console.log(`[WithdrawCtrl - notifyAdmins] Found ${admins.length} admins.`);

        if (admins.length > 0) {
            const notificationsData = admins.map(admin => ({
                user: admin._id,
                type: 'NEW_WITHDRAWAL_REQUEST', // تأكد أن هذا النوع موجود في Notification model enum
                title: title,
                message: message,
                relatedEntity: { id: relatedEntityId, modelName: 'WithdrawalRequest' }
            }));

            // حفظ الإشعارات في قاعدة البيانات
            createdNotifications = await Notification.insertMany(notificationsData);
            console.log(`[WithdrawCtrl - notifyAdmins] Successfully INSERTED ${createdNotifications.length} admin notifications.`);

            // إرسال عبر Socket.IO إذا كانت متاحة
            if (req.io && req.onlineUsers) {
                createdNotifications.forEach(notification => {
                    const adminUserId = notification.user.toString();
                    const adminSocketId = req.onlineUsers[adminUserId];
                    if (adminSocketId) {
                        req.io.to(adminSocketId).emit('new_notification', notification.toObject());
                        console.log(`[WithdrawCtrl - notifyAdmins] Emitted notification to admin socket ${adminSocketId}`);
                    } else {
                        console.log(`[WithdrawCtrl - notifyAdmins] Admin user ${adminUserId} is not online for socket emission.`);
                    }
                });
            } else {
                console.warn("[WithdrawCtrl - notifyAdmins] req.io or req.onlineUsers not available for Socket.IO emission.");
            }
        }
    } catch (error) {
        console.error("[WithdrawCtrl - notifyAdmins] >>> ERROR creating/sending admin withdrawal notifications:", error);
        // ملاحظة: لا يتم إيقاف العملية الرئيسية هنا لأن الخطأ قد يكون مؤقتًا في الإشعارات
    }
    // إرجاع الإشعارات التي تم إنشاؤها (قد تكون فارغة)
    return createdNotifications;
};

/**
 * إرسال إشعار لمستخدم محدد.
 * @param {object} req - كائن الطلب (لتمرير io و onlineUsers).
 * @param {mongoose.Types.ObjectId} userId - معرف المستخدم المستلم.
 * @param {string} type - نوع الإشعار (مثل 'NEW_WITHDRAWAL_REQUEST', 'WITHDRAWAL_COMPLETED').
 * @param {string} title - عنوان الإشعار.
 * @param {string} message - نص الإشعار.
 * @param {mongoose.Types.ObjectId} relatedEntityId - معرف الكائن المرتبط (WithdrawalRequest).
 */
const notifyUserWithdrawalStatus = async (req, userId, type, title, message, relatedEntityId) => {
    let newNotification = null;
    try {
        console.log(`[WithdrawCtrl - notifyUser] Attempting to create ${type} notification for user ${userId}.`);
        const notificationData = {
            user: userId,
            type: type, // تأكد أن هذا النوع موجود في Notification model enum
            title: title,
            message: message,
            relatedEntity: { id: relatedEntityId, modelName: 'WithdrawalRequest' }
        };

        // حفظ الإشعار في قاعدة البيانات
        newNotification = await Notification.create(notificationData);
        console.log(`[WithdrawCtrl - notifyUser] Successfully CREATED notification ${newNotification._id} for user ${userId}.`);

        // إرسال عبر Socket.IO إذا كانت متاحة
        if (req.io && req.onlineUsers) {
            const recipientSocketId = req.onlineUsers[userId.toString()];
            if (recipientSocketId) {
                req.io.to(recipientSocketId).emit('new_notification', newNotification.toObject());
                console.log(`[WithdrawCtrl - notifyUser] Emitted notification to user socket ${recipientSocketId}`);
            } else {
                console.log(`[WithdrawCtrl - notifyUser] User ${userId} is not online for socket emission.`);
            }
        } else {
            console.warn("[WithdrawCtrl - notifyUser] req.io or req.onlineUsers not available for Socket.IO emission.");
        }

    } catch (error) {
        console.error(`[WithdrawCtrl - notifyUser] >>> ERROR creating/sending ${type} notification for user ${userId}:`, error);
        // ملاحظة: لا يتم إيقاف العملية الرئيسية هنا
    }
    // إرجاع الإشعار الذي تم إنشاؤه (قد يكون null)
    return newNotification;
};


// --- دوال الـ Controller الرئيسية ---

/**
 * [User] إنشاء طلب سحب جديد.
 */
exports.createWithdrawalRequest = async (req, res) => {
    const userId = req.user._id; // ID المستخدم الحالي من المصادقة
    const {
        amount,           // المبلغ الإجمالي *بالدينار* للخصم (محسوب ومحول في Frontend)
        methodId,         // ID طريقة الدفع المختارة
        withdrawalInfo,   // معلومات وجهة السحب (مثل رقم هاتف، عنوان محفظة)
        originalAmount,   // المبلغ الأصلي الذي أدخله المستخدم قبل حساب الرسوم والتحويل
        originalCurrency  // العملة الأصلية التي أدخلها المستخدم ('TND' أو 'USD')
    } = req.body;

    console.log(`[WithdrawCtrl - create] User ${userId} starting withdrawal. Initial: ${originalAmount} ${originalCurrency}. Final TND Deduct Target: ${amount}. Method: ${methodId}`);

    // --- 1. التحقق من المدخلات الأساسية ---
    if (!amount || !methodId || !withdrawalInfo || !originalAmount || !originalCurrency || !['TND', 'USD'].includes(originalCurrency)) {
        console.warn("[WithdrawCtrl - create] Validation failed: Missing required fields.");
        return res.status(400).json({ msg: "Amount (TND), method ID, withdrawal info, original amount, and a valid original currency (TND/USD) are required." });
    }
    const numericAmountTND = Number(amount); // المبلغ النهائي بالدينار للخصم
    if (isNaN(numericAmountTND) || numericAmountTND <= 0) {
        console.warn("[WithdrawCtrl - create] Validation failed: Invalid final TND amount.");
        return res.status(400).json({ msg: "Invalid final TND withdrawal amount." });
    }
    const numericOriginalAmount = Number(originalAmount); // المبلغ الأصلي الذي أدخله المستخدم
    if (isNaN(numericOriginalAmount) || numericOriginalAmount <= 0) {
        console.warn("[WithdrawCtrl - create] Validation failed: Invalid original amount.");
        return res.status(400).json({ msg: "Invalid original withdrawal amount." });
    }
    if (!mongoose.Types.ObjectId.isValid(methodId)) {
        console.warn("[WithdrawCtrl - create] Validation failed: Invalid method ID format.");
        return res.status(400).json({ msg: "Invalid payment method ID." });
    }

    // --- 2. بدء المعاملة بقاعدة البيانات ---
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[WithdrawCtrl - create] Transaction started.");

    try {
        // --- 3. جلب المستخدم وطريقة الدفع والتحقق منهما ---
        const [user, paymentMethod] = await Promise.all([
            User.findById(userId).session(session), // جلب المستخدم ضمن الجلسة
            PaymentMethod.findOne({ _id: methodId, isActive: true, type: { $in: ['withdrawal', 'both'] } }) // جلب الطريقة النشطة للسحب
        ]);

        if (!user) throw new Error("User session invalid or user not found.");
        if (!paymentMethod) throw new Error(`Withdrawal method not found, inactive, or invalid.`);

        // --- 4. التحقق من الحد الأدنى للسحب بالدينار ---
        const minWithdrawalTND = paymentMethod.minWithdrawalTND ?? 0;
        if (numericAmountTND < minWithdrawalTND) {
            throw new Error(`Withdrawal amount (TND ${numericAmountTND.toFixed(2)}) is below the minimum of ${formatCurrency(minWithdrawalTND, 'TND')}.`);
        }

        // --- 5. التحقق من رصيد المستخدم (مقابل الإجمالي بالدينار) ---
        if (user.balance < numericAmountTND) {
            throw new Error(`Insufficient balance. Required: ${formatCurrency(numericAmountTND, 'TND')}, Available: ${formatCurrency(user.balance, 'TND')}.`);
        }

        // --- 6. حساب الرسوم والصافي بالدينار (للتخزين في قاعدة البيانات) ---
        const feeCalcTND = calculateFeeAndNetInCurrency(paymentMethod, numericAmountTND, 'TND');
        if (feeCalcTND.error) {
            // هذا الخطأ يجب أن يتم التقاطه في الواجهة الأمامية أيضًا
            console.error("[WithdrawCtrl - create] Error recalculating final TND fee/net:", feeCalcTND.error);
            throw new Error("Internal error calculating final withdrawal fee.");
        }
        const feeAmountTND = feeCalcTND.fee; // الرسوم النهائية بالدينار
        const netAmountToReceiveTND = feeCalcTND.net; // الصافي النهائي بالدينار

        // --- 7. خصم الرصيد من المستخدم ---
        const previousBalance = user.balance;
        user.balance -= numericAmountTND; // خصم المبلغ الإجمالي بالدينار
        await user.save({ session }); // حفظ المستخدم المحدث داخل المعاملة
        console.log(`[WithdrawCtrl - create] Deducted total TND ${numericAmountTND} from user ${userId}. Balance: ${previousBalance} -> ${user.balance}`);

        // --- 8. إنشاء سجل طلب السحب ---
        const newWithdrawalRequest = new WithdrawalRequest({
            user: userId,
            paymentMethod: paymentMethod._id,
            amount: numericAmountTND,           // الإجمالي المخصوم بالدينار
            currency: 'TND',                    // العملة المحفوظة
            status: 'Pending',
            feeAmount: feeAmountTND,            // الرسوم بالدينار
            netAmountToReceive: netAmountToReceiveTND, // الصافي بالدينار
            withdrawalInfo: withdrawalInfo,     // معلومات السحب
            originalAmount: numericOriginalAmount, // المبلغ الأصلي
            originalCurrency: originalCurrency,   // العملة الأصلية
        });
        await newWithdrawalRequest.save({ session }); // حفظ الطلب داخل المعاملة
        console.log(`[WithdrawCtrl - create] WithdrawalRequest object created with ID: ${newWithdrawalRequest._id}`);

        // --- 9. إتمام المعاملة (Commit) ---
        await session.commitTransaction();
        console.log(`[WithdrawCtrl - create] Transaction committed successfully for request ${newWithdrawalRequest._id}.`);

        // --- 10. إرسال الإشعارات *بعد* الـ Commit ---
        console.log("[WithdrawCtrl - create] Attempting to send notifications (post-commit)...");
        try {
            // إعادة حساب الصافي بالعملة الأصلية لغرض الإشعار
            const feeCalcOriginal = calculateFeeAndNetInCurrency(paymentMethod, numericOriginalAmount, originalCurrency);
            const netAmountInOriginal = feeCalcOriginal.net; // الصافي بالعملة الأصلية (قد يكون به خطأ طفيف بسبب التقريب إذا كانت النسبة معقدة)

            // بناء رسائل الإشعارات بالقيم الأصلية
            const adminMessage = `${user.fullName || user.email} requested withdrawal of ${formatCurrency(numericOriginalAmount, originalCurrency)} via ${paymentMethod.displayName || paymentMethod.name}. Net: ${formatCurrency(netAmountInOriginal, originalCurrency)}. (TND Deducted: ${formatCurrency(numericAmountTND, 'TND')})`;
            const userMessage = `Your withdrawal request of ${formatCurrency(numericOriginalAmount, originalCurrency)} via ${paymentMethod.displayName || paymentMethod.name} is pending. You should receive approx. ${formatCurrency(netAmountInOriginal, originalCurrency)}.`;

            // إرسال الإشعارات
            await notifyAdminsWithdrawalRequest(req, 'New Withdrawal Request', adminMessage, newWithdrawalRequest._id);
            await notifyUserWithdrawalStatus(req, userId, 'NEW_WITHDRAWAL_REQUEST', 'Withdrawal Request Submitted', userMessage, newWithdrawalRequest._id);

            console.log("[WithdrawCtrl - create] Finished attempting notifications in original currency.");

            // --- START: MODIFICATION FOR ADMIN UI ---
            const populatedRequestForSocket = await WithdrawalRequest.findById(newWithdrawalRequest._id)
                .populate('user', 'fullName email avatarUrl')
                .lean();

            const admins = await User.find({ userRole: 'Admin' }).select('_id');
            admins.forEach(admin => {
                const adminSocketId = req.onlineUsers ? req.onlineUsers[admin._id.toString()] : null;
                if (adminSocketId) {
                    req.io.to(adminSocketId).emit('new_admin_transaction_request', { type: 'withdrawal', request: populatedRequestForSocket });
                }
            });
            // --- END: MODIFICATION FOR ADMIN UI ---
        } catch (notificationError) {
            // سجل الخطأ فقط، لا توقف العملية لأن الطلب تم حفظه
            console.error("[WithdrawCtrl - create] Error occurred during notification calls (after commit):", notificationError);
        }
        // ----------------------------------------------------------

        // --- 11. إرسال استجابة ناجحة للـ Frontend ---
        res.status(201).json({
            msg: "Withdrawal request submitted successfully.",
            requestId: newWithdrawalRequest._id,
            newBalance: user.balance // إرسال الرصيد المحدث
        });

    } catch (error) {
        // --- معالجة الأخطاء وإلغاء المعاملة ---
        console.error("[WithdrawCtrl - create] Error occurred during transaction:", error.message || error);
        // التأكد من إلغاء المعاملة فقط إذا كانت نشطة
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[WithdrawCtrl - create] Transaction aborted due to error.");
        } else {
            console.log("[WithdrawCtrl - create] Transaction was not active or already aborted/committed.");
        }
        // إرسال استجابة خطأ مناسبة
        res.status(400).json({ msg: error.message || "Failed to submit withdrawal request due to an internal error." });
    } finally {
        // --- إنهاء الجلسة دائمًا ---
        session.endSession();
        console.log("[WithdrawCtrl - create] Session ended.");
    }
};


/**
 * [User] جلب طلبات السحب الخاصة بالمستخدم الحالي.
 */
exports.getUserRequests = async (req, res) => {
    const userId = req.user?._id; // استخدام Optional Chaining
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
        return res.status(401).json({ msg: "User not authenticated." });
    }

    console.log(`[WithdrawCtrl - getUserRequests] Fetching withdrawal requests for User ID: ${userId}, Page: ${page}, Limit: ${limit}`);

    try {
        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 10,
            sort: { createdAt: -1 }, // الأحدث أولاً
            // جلب تفاصيل الطريقة، بما في ذلك النسبة المطلوبة للحساب المحتمل في الواجهة
            populate: [{ path: 'paymentMethod', select: 'name displayName logoUrl withdrawalCommissionPercent' }],
            lean: true // للقراءة فقط أسرع
        };

        // استخدام paginate إذا كان متاحاً، وإلا find().skip().limit()
        let result;
        if (WithdrawalRequest.paginate) { // التحقق من وجود دالة paginate
            console.log("[WithdrawCtrl - getUserRequests] Using paginate...");
            result = await WithdrawalRequest.paginate({ user: userId }, options);
        } else {
            console.log("[WithdrawCtrl - getUserRequests] Using find().skip().limit()...");
            const skip = (options.page - 1) * options.limit;
            const requests = await WithdrawalRequest.find({ user: userId })
                .populate(options.populate)
                .sort(options.sort)
                .skip(skip)
                .limit(options.limit)
                .lean();
            const totalRequests = await WithdrawalRequest.countDocuments({ user: userId });
            result = {
                docs: requests, // أو requests: requests
                totalDocs: totalRequests, // أو totalRequests: totalRequests
                totalPages: Math.ceil(totalRequests / options.limit),
                page: options.page,
                limit: options.limit,
            };
        }


        // إرسال البيانات للواجهة الأمامية بالتنسيق المتوقع (requests بدلاً من docs)
        res.status(200).json({
            requests: result.docs || result.requests,
            totalPages: result.totalPages,
            currentPage: result.page, // أو result.currentPage
            totalRequests: result.totalDocs || result.totalRequests
        });

    } catch (error) {
        console.error("[WithdrawCtrl - getUserRequests] Error fetching user withdrawal requests:", error);
        res.status(500).json({ msg: "Server error fetching your withdrawal requests." });
    }
};


// --- دوال الأدمن ---

/**
 * [Admin] جلب طلبات السحب (مع فلترة بالحالة وترقيم الصفحات).
 */
exports.adminGetRequests = async (req, res) => {
    const { status, page = 1, limit = 15 } = req.query;
    console.log(`[WithdrawCtrl - adminGetRequests] Admin fetching requests. Status: ${status || 'All'}, Page: ${page}, Limit: ${limit}`);

    const filter = {};
    if (status) {
        const lowerStatus = status.toLowerCase();
        const validStatuses = {
            pending: 'Pending',
            processing: 'Processing',
            completed: 'Completed',
            rejected: 'Rejected',
            failed: 'Failed'
        };
        if (validStatuses[lowerStatus]) {
            filter.status = validStatuses[lowerStatus];
        }
    }

    try {
        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 15,
            sort: { createdAt: -1 },
            // جلب معلومات المستخدم وطريقة الدفع
            populate: [
                { path: 'user', select: 'fullName email avatarUrl' }, // معلومات أساسية للمستخدم
                { path: 'paymentMethod', select: 'name displayName logoUrl' } // معلومات أساسية للطريقة
            ],
            lean: true
        };

        // استخدام paginate إذا كان متاحاً
        let result;
        if (WithdrawalRequest.paginate) {
            console.log("[WithdrawCtrl - adminGetRequests] Using paginate...");
            result = await WithdrawalRequest.paginate(filter, options);
        } else {
            console.log("[WithdrawCtrl - adminGetRequests] Using find().skip().limit()...");
            const skip = (options.page - 1) * options.limit;
            const requests = await WithdrawalRequest.find(filter)
                .populate(options.populate)
                .sort(options.sort)
                .skip(skip)
                .limit(options.limit)
                .lean();
            const totalRequests = await WithdrawalRequest.countDocuments(filter);
            result = { docs: requests, totalDocs: totalRequests, totalPages: Math.ceil(totalRequests / options.limit), page: options.page, limit: options.limit };
        }


        res.status(200).json({
            requests: result.docs || result.requests,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalRequests: result.totalDocs || result.totalRequests
        });

    } catch (error) {
        console.error("[WithdrawCtrl - adminGetRequests] Error fetching withdrawal requests for admin:", error);
        res.status(500).json({ msg: "Server error fetching requests." });
    }
};

/**
 * [Admin] جلب تفاصيل طلب سحب محدد.
 */
exports.adminGetRequestDetails = async (req, res) => {
    const { requestId } = req.params;
    console.log(`[WithdrawCtrl - adminGetRequestDetails] Admin fetching details for request ID: ${requestId}`);

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ msg: "Invalid request ID format." });
    }

    try {
        const request = await WithdrawalRequest.findById(requestId)
            .populate('user', 'fullName email phone balance') // جلب معلومات المستخدم
            .populate('paymentMethod') // جلب كل معلومات طريقة الدفع
            .populate('processedBy', 'fullName email') // جلب معلومات الأدمن المعالج
            .lean(); // للقراءة فقط

        if (!request) {
            return res.status(404).json({ msg: "Withdrawal request not found." });
        }

        res.status(200).json(request);

    } catch (error) {
        console.error("[WithdrawCtrl - adminGetRequestDetails] Error fetching withdrawal request details:", error);
        res.status(500).json({ msg: "Server error fetching request details." });
    }
};

/**
 * [Admin] الموافقة (الإكمال) على طلب سحب.
 */
exports.adminCompleteWithdrawal = async (req, res) => {
    const { requestId } = req.params;
    const { transactionReference, adminNotes } = req.body;
    const adminUserId = req.user._id;
    console.log(`[WithdrawCtrl - adminCompleteWithdrawal] Admin ${adminUserId} completing request ID: ${requestId}`);

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
        ).populate('paymentMethod user'); // 'user' هنا هو كائن المستخدم الكامل

        if (!updatedRequest) {
            const existingRequest = await WithdrawalRequest.findById(requestId);
            if (!existingRequest) {
                throw new Error("Request not found.");
            } else {
                throw new Error(`Request is already ${existingRequest.status}. Cannot complete.`);
            }
        }

        console.log(`[WithdrawCtrl - adminCompleteWithdrawal] Withdrawal request ${requestId} marked as completed.`);

        // --- START: Update user's cumulative withdrawal balance ---
        try {
            // We use $inc to increment the withdrawalBalance. updatedRequest.amount is in TND.
            await User.updateOne(
                { _id: updatedRequest.user._id },
                { $inc: { withdrawalBalance: updatedRequest.amount } }
            );
            console.log(`[WithdrawCtrl - adminCompleteWithdrawal] Updated user withdrawalBalance for user ${updatedRequest.user._id}.`);
        } catch (userUpdateError) {
            console.error("[WithdrawCtrl - adminCompleteWithdrawal] Error updating user withdrawalBalance:", userUpdateError);
        }
        // --- END: Update user's cumulative withdrawal balance ---

        // --- START: Notify user of completion ---
        console.log("[WithdrawCtrl - adminCompleteWithdrawal] Attempting to notify user...");
        try {
            const userMessage = `Your withdrawal request via ${updatedRequest.paymentMethod?.displayName || 'N/A'} has been processed and completed. You should receive approx. ${formatCurrency(updatedRequest.netAmountToReceive, 'TND')} shortly.`;
            // This function handles both DB save and socket emit for the notification itself
            await notifyUserWithdrawalStatus(req, updatedRequest.user._id, 'WITHDRAWAL_COMPLETED', 'Withdrawal Completed', userMessage, updatedRequest._id);
            console.log("[WithdrawCtrl - adminCompleteWithdrawal] Finished attempting completion notification.");
        } catch (notificationError) {
            console.error("[WithdrawCtrl - adminCompleteWithdrawal] >>> ERROR occurred during notification function call:", notificationError);
        }
        // --- END: Notify user of completion ---

        // --- [!!!] START: REAL-TIME UPDATES VIA SOCKET.IO [!!!] ---
        const userToNotify = updatedRequest.user;
        const userSocketId = req.onlineUsers ? req.onlineUsers[userToNotify._id.toString()] : null;

        if (userSocketId && req.io) {
            // 1. Fetch the absolute latest user profile to send all balances
            const latestUserProfile = await User.findById(userToNotify._id).select('-password').lean();

            if (latestUserProfile) {
                // Emit the full, updated balance profile to the user
                req.io.to(userSocketId).emit('user_balances_updated', latestUserProfile);
                console.log(`   [Socket] Sent 'user_balances_updated' (for completion) to user ${userToNotify._id}`);
            }

            // 2. Also send the general transaction update signal to refresh lists
            req.io.to(userSocketId).emit('dashboard_transactions_updated', {
                message: 'Your withdrawal request has been completed.',
                requestId: updatedRequest._id.toString(),
            });
            console.log(`   [Socket] Sent 'dashboard_transactions_updated' (for completion) to user ${userToNotify._id}`);
        } else {
            console.log(`   User ${userToNotify._id} is not online for real-time updates for withdrawal completion.`);
        }
        // --- [!!!] END: REAL-TIME UPDATES VIA SOCKET.IO [!!!] ---

        // Populate the final response for the frontend
        const finalCompletedRequest = await WithdrawalRequest.findById(updatedRequest._id)
            .populate('user', 'fullName email balance sellerAvailableBalance sellerPendingBalance withdrawalBalance') // Include all relevant balances
            .populate('paymentMethod')
            .populate('processedBy', 'fullName email')
            .lean();

        res.status(200).json({ msg: "Withdrawal marked as completed.", updatedRequest: finalCompletedRequest });

    } catch (error) {
        console.error("[WithdrawCtrl - adminCompleteWithdrawal] Error completing withdrawal:", error);
        res.status(400).json({ msg: error.message || "Failed to complete withdrawal request." });
    }
};

/**
 * [Admin] رفض طلب سحب.
 */
exports.adminRejectWithdrawal = async (req, res) => {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const adminUserId = req.user._id;
    console.log(`[WithdrawCtrl - adminRejectWithdrawal] Admin ${adminUserId} attempting to reject request ID: ${requestId}`);

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ msg: "Invalid request ID format." });
    }
    if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ msg: "Rejection reason is required." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("[WithdrawCtrl - adminRejectWithdrawal] Database transaction started.");

    try {
        const withdrawalRequest = await WithdrawalRequest.findOne({ _id: requestId, status: 'Pending' })
            .session(session)
            .populate('paymentMethod')
            .populate('user'); // جلب كائن المستخدم الكامل

        if (!withdrawalRequest) {
            const existingRequest = await WithdrawalRequest.findById(requestId).session(session);
            if (!existingRequest) throw new Error(`Withdrawal request with ID ${requestId} not found.`);
            else throw new Error(`Request is already ${existingRequest.status}. Cannot reject.`);
        }

        const userToRefund = withdrawalRequest.user;
        if (!userToRefund) throw new Error(`User (ID: ${withdrawalRequest.user?._id || 'unknown'}) associated with the request not found.`);

        const amountToRefundTND = withdrawalRequest.amount;
        const previousBalance = userToRefund.balance;

        userToRefund.balance += amountToRefundTND;
        await userToRefund.save({ session });
        console.log(`[WithdrawCtrl - adminRejectWithdrawal] Refunding user ${userToRefund._id} TND ${amountToRefundTND}. Balance: ${previousBalance} -> ${userToRefund.balance}`);

        withdrawalRequest.status = 'Rejected';
        withdrawalRequest.rejectionReason = rejectionReason.trim();
        withdrawalRequest.adminNotes = rejectionReason.trim();
        withdrawalRequest.processedBy = adminUserId;
        withdrawalRequest.processedAt = new Date();
        const updatedRequest = await withdrawalRequest.save({ session });
        console.log(`[WithdrawCtrl - adminRejectWithdrawal] Withdrawal request ${requestId} marked as 'Rejected'.`);

        await session.commitTransaction();
        console.log(`[WithdrawCtrl - adminRejectWithdrawal] Database transaction committed for rejected request ${requestId}.`);

        const userSocketId = req.onlineUsers ? req.onlineUsers[userToRefund._id.toString()] : null;

        if (userSocketId && req.io) {
            req.io.to(userSocketId).emit('user_balances_updated', {
                _id: userToRefund._id.toString(),
                balance: userToRefund.balance, // This is the updated balance
                depositBalance: userToRefund.depositBalance,
                withdrawalBalance: userToRefund.withdrawalBalance, // This should also be updated if you track it
                sellerAvailableBalance: userToRefund.sellerAvailableBalance,
                sellerPendingBalance: userToRefund.sellerPendingBalance
            });
            console.log(`   [Socket] Sent 'user_balances_updated' to user ${userToRefund._id}`);

            const userMessage = `Your withdrawal request of ${formatCurrency(updatedRequest.originalAmount, updatedRequest.originalCurrency)} via ${updatedRequest.paymentMethod?.displayName || 'N/A'} was rejected. Reason: ${rejectionReason.trim()}`;
            await notifyUserWithdrawalStatus(req, userToRefund._id, 'WITHDRAWAL_REJECTED', 'Withdrawal Request Rejected', userMessage, updatedRequest._id);
            // notifyUserWithdrawalStatus handles its own socket emit for 'new_notification'

            req.io.to(userSocketId).emit('dashboard_transactions_updated', {
                message: 'Your withdrawal request has been updated.',
                transactionType: 'WITHDRAWAL_REQUEST_REJECTED',
                requestId: updatedRequest._id.toString(),
                status: 'Rejected' // يمكن إضافة الحالة الجديدة هنا
            });
            console.log(`   [Socket] Sent 'dashboard_transactions_updated' (for rejection) to user ${userToRefund._id}`);

        } else {
            console.log(`   User ${userToRefund._id} is not online for real-time updates after rejection.`);
            // إذا لم يكن متصلاً، لا يزال إشعار الرفض يُحفظ في DB عبر notifyUserWithdrawalStatus
            // وسيراه عند التحديث.
            const userMessage = `Your withdrawal request of ${formatCurrency(updatedRequest.originalAmount, updatedRequest.originalCurrency)} via ${updatedRequest.paymentMethod?.displayName || 'N/A'} was rejected. Reason: ${rejectionReason.trim()}`;
            await notifyUserWithdrawalStatus(req, userToRefund._id, 'WITHDRAWAL_REJECTED', 'Withdrawal Request Rejected', userMessage, updatedRequest._id);

        }

        const finalRejectedRequest = await WithdrawalRequest.findById(updatedRequest._id)
            .populate('user', 'fullName email balance sellerAvailableBalance sellerPendingBalance')
            .populate('paymentMethod')
            .populate('processedBy', 'fullName email')
            .lean();

        res.status(200).json({ msg: "Withdrawal rejected successfully. User balance has been refunded.", updatedRequest: finalRejectedRequest });

    } catch (error) {
        console.error("[WithdrawCtrl - adminRejectWithdrawal] Error occurred:", error);
        if (session.inTransaction()) {
            await session.abortTransaction();
            console.log("[WithdrawCtrl - adminRejectWithdrawal] Transaction aborted due to error.");
        }
        let statusCode = 500;
        if (error.message.includes("not found")) statusCode = 404;
        else if (error.message.includes("already")) statusCode = 400;
        res.status(statusCode).json({ msg: error.message || "Failed to reject withdrawal request." });
    } finally {
        // التأكد من أن الجلسة لم تعد نشطة قبل محاولة إنهائها
        if (session.inTransaction()) {
            console.warn("[WithdrawCtrl - adminRejectWithdrawal] Session was not committed or aborted explicitly before endSession. Aborting now.");
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error("[WithdrawCtrl - adminRejectWithdrawal] Error aborting lingering transaction:", abortError);
            }
        }
        try {
            await session.endSession();
            console.log("[WithdrawCtrl - adminRejectWithdrawal] Session ended.");
        } catch (sessionEndError) {
             console.error("[WithdrawCtrl - adminRejectWithdrawal] Error ending session (might have already ended):", sessionEndError);
        }
    }
};