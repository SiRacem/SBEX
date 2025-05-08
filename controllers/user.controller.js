const User = require("../models/User");
const Notification = require('../models/Notification'); // <-- استدعاء موديل الإشعارات
const Product = require("../models/Product"); // <-- نحتاج موديل المنتج لحساب الإحصائيات
const mongoose = require('mongoose'); // <-- تأكد من استدعائه إذا لم يكن موجوداً
const bcrypt = require("bcryptjs")
var jwt = require('jsonwebtoken');
const config = require("config")

// --- [!!!] إضافة ثوابت الشروط (يمكن نقلها لملف config) [!!!] ---
const MEDIATOR_REQUIRED_LEVEL = 3; // المستوى المطلوب للتأهيل عبر السمعة
const MEDIATOR_ESCROW_AMOUNT_TND = 150.00; // مبلغ الضمان المطلوب بالدينار
// ----------------------------------------------------------

// --- Register ---
exports.Register = async (req, res) => {
    const { fullName, email, phone, address, password, userRole, blocked = false } = req.body;
    console.log("--- Controller: Register Request ---"); // Log
    try {
        const existantUser = await User.findOne({ email: email.toLowerCase() });
        if (existantUser) {
            console.warn(`Registration attempt failed: Email ${email} already exists.`); // Log
            return res.status(409).json({ msg: "Email already exists" });
        }

        const newUser = new User({ fullName, email: email.toLowerCase(), phone, address, password, userRole, blocked });
        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(password, salt);
        await newUser.save();
        console.log(`User registered successfully: ${newUser.email} (ID: ${newUser._id})`); // Log

        // --- لا نعيد التوكن أو المستخدم هنا، فقط رسالة نجاح ---
        res.status(201).json({ msg: "Registration successful! Please login." });

    } catch (error) {
        console.error("Registration Controller Error:", error); // Log
        if (error.name === 'ValidationError') {
            // تنسيق أخطاء التحقق من الصحة
            const errors = Object.values(error.errors).map(el => ({ msg: el.message, param: el.path }));
            return res.status(400).json({ errors });
        }
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during registration.", error: error.message });
        }
    }
}

// --- Login ---
exports.Login = async (req, res) => {
    const { email, password } = req.body;
    console.log(`--- Controller: Login attempt for ${email} ---`);
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.warn(`Login failed: User ${email} not found.`);
            return res.status(401).json({ msg: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`Login failed: Incorrect password for ${email}.`);
            return res.status(401).json({ msg: "Invalid credentials" });
        }

        // --- [!] التعديل الرئيسي: إزالة التحقق المانع ---
        // if (user.blocked) {
        //     console.warn(`Login failed: Account ${email} is blocked.`);
        //     // <<< هذا السطر هو الذي نلغيه >>>
        //     // return res.status(403).json({ msg: "Account is blocked" });
        // }
        // --- نهاية التعديل ---
        // سيتم التعامل مع حالة الحظر في الواجهة الأمامية الآن

        const payload = { _id: user._id, fullName: user.fullName, userRole: user.userRole }; // إضافة الدور مفيد هنا
        const secret = config.get("secret");
        const token = jwt.sign(payload, secret, { expiresIn: '1h' });

        console.log(`User ${email} logged in successfully. Blocked status: ${user.blocked}`); // Log status
        // إرجاع التوكن وبيانات المستخدم كاملة (بما في ذلك حالة الحظر)
        res.status(200).json({
            token,
            user: {
                _id: user._id, fullName: user.fullName, email: user.email,
                phone: user.phone, address: user.address, userRole: user.userRole,
                balance: user.balance, sellerAvailableBalance: user.sellerAvailableBalance,
                sellerPendingBalance: user.sellerPendingBalance, depositBalance: user.depositBalance,
                withdrawalBalance: user.withdrawalBalance,
                blocked: user.blocked, // <-- تأكد من إرجاع هذه القيمة
                registerDate: user.registerDate,
            }
        });

    } catch (error) {
        console.error("Login Controller Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during login.", error: error.message });
        }
    }
}

// --- Auth (Get Profile) ---
exports.Auth = async (req, res) => {
    // req.user يتم تعيينه بواسطة verifyAuth middleware (ويجب أن يستثني كلمة المرور)
    console.log(`--- Controller: Auth (Get Profile) for user ID: ${req.user?._id} ---`); // Log
    if (!req.user) {
        console.warn("Auth Controller: req.user is missing after verifyAuth."); // Log
        return res.status(401).json({ msg: "Not authorized (user data missing)" });
    }
    // إرجاع بيانات المستخدم من req.user
    res.status(200).json(req.user);
};

// --- *** دالة التحقق من الإيميل مع Logs *** ---
exports.checkEmailExists = async (req, res) => {
    const { email } = req.body;
    // --- Log 1: بداية الدالة ---
    console.log(`--- Controller: checkEmailExists START for email: ${email} (Requested by: ${req.user?._id}) ---`);

    if (!email) {
        console.warn("[checkEmailExists] Email missing from request body.");
        return res.status(400).json({ msg: "Email is required in the request body." });
    }

    try {
        const normalizedEmail = email.toLowerCase();
        // --- Log 2: قبل البحث ---
        console.log(`[checkEmailExists] Searching for email: ${normalizedEmail}`);
        const foundUser = await User.findOne({ email: normalizedEmail }).select('_id fullName email'); // جلب الحقول المطلوبة فقط
        // --- Log 3: نتيجة البحث ---
        console.log(`[checkEmailExists] User.findOne result:`, foundUser ? `User found (ID: ${foundUser._id})` : 'null (Not Found)');

        if (foundUser) {
            // --- Log 4: قبل إرسال 200 ---
            console.log(`[checkEmailExists] User found. Sending 200 OK with user data.`);
            return res.status(200).json({ // إرجاع البيانات الأساسية فقط
                _id: foundUser._id,
                fullName: foundUser.fullName,
                email: foundUser.email
            });
        } else {
            // --- Log 5: قبل إرسال 404 ---
            console.log(`[checkEmailExists] User not found. Sending 404 Not Found.`);
            return res.status(404).json({ msg: "User with this email not found." });
        }
    } catch (error) {
        // --- Log 6: عند حدوث خطأ ---
        console.error("[checkEmailExists] Error caught in controller:", error);
        // التأكد من إرسال استجابة خطأ
        // لا ترسل error.message مباشرة للعميل في الإنتاج عادةً لأسباب أمنية
        return res.status(500).json({ msg: "Server error while checking email." });
    }
};
// --- *** نهاية دالة التحقق من الإيميل *** ---

// --- Get Users ---
exports.getUsers = async (req, res) => {
    console.log("--- Controller: getUsers ---");
    try {
        const users = await User.find().select('-password').sort({ registerDate: -1 });
        console.log(`Fetched ${users.length} users.`);
        res.status(200).json(users);
    } catch (error) {
        console.error("Error in getUsers:", error);
        res.status(500).json({ msg: "Failed to retrieve users." });
    }
};

// --- Update User ---
exports.updateUsers = async (req, res) => {
    const userIdToUpdate = req.params.id;
    const updateData = req.body;
    const adminUserId = req.user?._id; // معرف الأدمن الذي يقوم بالتحديث
    const adminFullName = req.user?.fullName; // اسم الأدمن
    const adminUserRole = req.user?.userRole; // دور الأدمن

    console.log(`--- Controller: updateUsers attempt for User ID: ${userIdToUpdate} by Admin ID: ${adminUserId} ---`);
    console.log("Update data received:", updateData);

    // --- !! خطوة 1: التحقق من صلاحية الأدمن (مهم جداً) !! ---
    if (adminUserRole !== 'Admin') {
        console.warn(`Forbidden: User ${adminUserId} (${adminUserRole}) attempted to update user ${userIdToUpdate}.`);
        return res.status(403).json({ msg: "Forbidden: You do not have permission to update users." });
    }
    // منع الأدمن من تعديل نفسه عبر هذا المسار (اختياري لكن قد يكون جيداً)
    if (adminUserId.toString() === userIdToUpdate.toString()) {
        console.warn(`Admin ${adminUserId} attempted to update their own data via admin route.`);
        return res.status(400).json({ msg: "Admins cannot update their own data using this specific endpoint. Use profile update." });
    }
    // ---------------------------------------------------------

    // --- خطوة 2: تنظيف بيانات التحديث (الأمان) ---
    delete updateData.password; // لا تسمح بتحديث كلمة المرور
    delete updateData.userRole; // لا تسمح بتحديث الدور
    delete updateData.email;    // لا تسمح بتحديث الإيميل
    delete updateData._id;      // لا تسمح بتحديث الـ ID
    delete updateData.registerDate; // لا تسمح بتحديث تاريخ التسجيل

    // --- تحديد حقول الرصيد التي نهتم بها ---
    const balanceFields = [
        'balance', 'sellerAvailableBalance', 'sellerPendingBalance',
        'depositBalance', 'withdrawalBalance'
    ];

    let originalUser; // لتخزين بيانات المستخدم قبل التحديث

    try {
        // --- خطوة 3: جلب المستخدم الأصلي قبل التحديث ---
        originalUser = await User.findById(userIdToUpdate).lean(); // .lean() للكفاءة
        if (!originalUser) {
            console.warn(`Update failed: User ${userIdToUpdate} not found.`);
            return res.status(404).json({ msg: "User not found" });
        }
        console.log("Original user data fetched:", { _id: originalUser._id, email: originalUser.email });

        // --- خطوة 4: تطبيق التحديث ---
        const updatedUser = await User.findByIdAndUpdate(
            userIdToUpdate,
            { $set: updateData },
            { new: true, runValidators: true } // new: true لإعادة المستخدم المحدث, runValidators لتشغيل التحقق
        ).select('-password').lean(); // .lean() للكفاءة، واستبعاد كلمة المرور

        if (!updatedUser) {
            // هذا لا يجب أن يحدث إذا وجدنا المستخدم في الخطوة 3، لكن للتحسب
            console.error(`Update failed unexpectedly after finding user ${userIdToUpdate}.`);
            return res.status(500).json({ msg: "Update failed unexpectedly." });
        }
        console.log(`User ${userIdToUpdate} updated successfully in DB.`);

        // --- خطوة 5: التحقق من تغيير الرصيد وإنشاء الإشعارات ---
        let balanceChanged = false;
        let changesSummary = []; // لتجميع التغييرات للرسالة

        balanceFields.forEach(field => {
            const oldValue = originalUser[field] ?? 0; // القيمة القديمة (أو 0 إذا كانت غير موجودة)
            const newValue = updatedUser[field] ?? 0; // القيمة الجديدة (أو 0)
            if (newValue !== oldValue) {
                balanceChanged = true;
                // تحويل الأرقام إلى نص منسق (اختياري، يمكن فعله في الـ frontend أيضاً)
                const formattedOld = oldValue.toFixed(2);
                const formattedNew = newValue.toFixed(2);
                changesSummary.push(`${field}: ${formattedOld} -> ${formattedNew}`);
                console.log(`Balance change detected for ${field}: ${formattedOld} -> ${formattedNew}`);
            }
        });

        if (balanceChanged) {
            console.log("Balance change detected, creating notifications...");
            const targetUserFullName = updatedUser.fullName || 'User';
            const notificationMessageForUser = `Admin "${adminFullName}" adjusted your balances. Changes: ${changesSummary.join(', ')}. New total balance: ${updatedUser.balance.toFixed(2)}.`;
            const notificationMessageForAdmin = `You adjusted balances for user "${targetUserFullName}" (ID: ${userIdToUpdate}). Changes: ${changesSummary.join(', ')}.`;

            // إنشاء الإشعارات (نستخدم Promise.all لتشغيلها بالتوازي)
            try {
                await Promise.all([
                    // إشعار للمستخدم الذي تم تعديل رصيده
                    Notification.create({
                        user: userIdToUpdate, // معرف المستخدم المستهدف
                        type: 'ADMIN_BALANCE_ADJUSTMENT',
                        title: 'Account Balance Adjusted by Admin',
                        message: notificationMessageForUser,
                        relatedEntity: { id: adminUserId, modelName: 'User' } // ربط بالأدمن الذي قام بالفعل
                    }),
                    // إشعار للأدمن الذي قام بالتعديل
                    Notification.create({
                        user: adminUserId, // معرف الأدمن
                        type: 'USER_BALANCE_ADJUSTED',
                        title: `Balances Adjusted for ${targetUserFullName}`,
                        message: notificationMessageForAdmin,
                        relatedEntity: { id: userIdToUpdate, modelName: 'User' } // ربط بالمستخدم الذي تم تعديله
                    })
                ]);
                console.log(`Notifications created successfully for balance update of user ${userIdToUpdate}.`);
            } catch (notifyError) {
                console.error(`Error creating balance update notifications for user ${userIdToUpdate}:`, notifyError);
                // لا نوقف العملية بالكامل بسبب فشل الإشعار، لكن نسجل الخطأ
            }
        } else {
            console.log("No balance changes detected. Skipping balance notifications.");
        }
        // --- نهاية خطوة الإشعارات ---

        // --- خطوة 6: إرسال الاستجابة ---
        res.status(200).json(updatedUser); // إرسال المستخدم المحدث

    } catch (error) {
        console.error(`Error processing update for user ${userIdToUpdate}:`, error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => ({ msg: el.message, param: el.path }));
            return res.status(400).json({ errors });
        }
        // التأكد من عدم إرسال استجابة سابقة
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during user update." });
        }
    }
};

// --- Delete User ---
exports.deleteUsers = async (req, res) => {
    const userIdToDelete = req.params.id;
    console.log(`--- Controller: deleteUsers attempt for ID: ${userIdToDelete} by User: ${req.user?._id} ---`);
    // يجب إضافة تحقق هنا للتأكد أن الأدمن فقط هو من يحذف

    try {
        const deletedUser = await User.findByIdAndDelete(userIdToDelete);
        if (!deletedUser) {
            console.warn(`Delete failed: User ${userIdToDelete} not found.`);
            return res.status(404).json({ msg: "User not found" });
        }
        console.log(`User ${userIdToDelete} deleted successfully.`);
        res.status(200).json({ msg: "User deleted successfully", deletedUserId: userIdToDelete });
    } catch (error) {
        console.error(`Error deleting user ${userIdToDelete}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during user deletion." });
        }
    }
};

// --- Get User Public Profile ---
// --- [!] تعديل دالة جلب البروفايل العام ---
exports.getUserPublicProfile = async (req, res) => {
    const { userId } = req.params;
    console.log(`--- Controller: getUserPublicProfile (Updated) for ID: ${userId} ---`);

    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ msg: "Invalid User ID format." });

    try {
        // 1. جلب بيانات المستخدم الأساسية و **التقييمات المجمعة**
        const userProfile = await User.findById(userId)
            .select('fullName registerDate userRole avatarUrl positiveRatings negativeRatings'); // <-- إضافة حقول التقييم والأفاتار

        if (!userProfile) return res.status(404).json({ msg: "User not found." });

        // 2. حساب المنتجات المعتمدة (Active Listings)
        const approvedProductCount = await Product.countDocuments({
            user: userId,
            status: 'approved' // فقط المعتمدة وغير المباعة
        });

        // 3. حساب المنتجات المباعة
        const soldProductCount = await Product.countDocuments({
            user: userId,
            sold: true // أو status: 'sold' إذا كنت تستخدم الحالة الجديدة
        });

        // 4. تجميع البيانات النهائية
        const publicProfileData = {
            _id: userProfile._id,
            fullName: userProfile.fullName,
            memberSince: userProfile.registerDate,
            role: userProfile.userRole,
            avatarUrl: userProfile.avatarUrl, // إرجاع رابط الأفاتار
            approvedProducts: approvedProductCount,
            soldProducts: soldProductCount, // إرجاع عدد المبيعات
            positiveRatings: userProfile.positiveRatings, // إرجاع اللايكات المجمعة
            negativeRatings: userProfile.negativeRatings // إرجاع الديسلايكات المجمعة
        };

        res.status(200).json(publicProfileData);

    } catch (error) {
        console.error(`Error fetching public profile for ${userId}:`, error);
        if (!res.headersSent) res.status(500).json({ msg: "Server error fetching profile data." });
    }
};

// --- [!!!] تعديل دالة جلب الوسطاء المتاحين [!!!] ---
exports.adminGetAvailableMediators = async (req, res) => {
    console.log(`--- Controller: adminGetAvailableMediators (Using isMediatorQualified) ---`);
    try {
        // --- البحث عن الوسطاء المؤهلين، غير المحظورين، والمتاحين ---
        const mediators = await User.find({
            isMediatorQualified: true,
            blocked: false,
            mediatorStatus: 'Available' // <-- إضافة شرط الحالة "متاح"
        })
            .select('_id fullName email avatarUrl reputationPoints level mediatorStatus') // إضافة حالة الوسيط
            .sort({ fullName: 1 });
        // ---------------------------------------------------------

        console.log(`Found ${mediators.length} available qualified mediators.`);
        res.status(200).json(mediators);

    } catch (error) {
        console.error("Error fetching available mediators:", error);
        res.status(500).json({ msg: "Server error fetching mediators." });
    }
};

// --- [!!!] دالة جديدة: تقديم طلب الانضمام كوسيط [!!!] ---
exports.applyForMediator = async (req, res) => {
    const userId = req.user._id;
    const { applicationType } = req.body; // 'reputation' or 'guarantee'

    console.log(`--- Controller: applyForMediator - User: ${userId}, Type: ${applicationType} ---`);

    if (!['reputation', 'guarantee'].includes(applicationType)) {
        return res.status(400).json({ msg: "Invalid application type. Must be 'reputation' or 'guarantee'." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if (!user) throw new Error("User not found.");

        // التحقق إذا كان مؤهلاً بالفعل أو لديه طلب معلق
        if (user.isMediatorQualified) throw new Error("You are already a qualified mediator.");
        if (user.mediatorApplicationStatus === 'Pending') throw new Error("You already have a pending application.");
        if (user.mediatorApplicationStatus === 'Approved') throw new Error("Your application was already approved."); // حالة نادرة

        let canApply = false;
        let conditionMet = '';

        // التحقق من شروط السمعة
        if (user.level >= MEDIATOR_REQUIRED_LEVEL) {
            canApply = true;
            conditionMet = `Level ${user.level} (>=${MEDIATOR_REQUIRED_LEVEL})`;
        }

        // التحقق من شروط الضمان
        if (user.balance >= MEDIATOR_ESCROW_AMOUNT_TND) {
            canApply = true;
            conditionMet = conditionMet ? `${conditionMet} OR Balance Sufficient` : `Balance ${user.balance.toFixed(2)} TND (>=${MEDIATOR_ESCROW_AMOUNT_TND.toFixed(2)} TND)`;
        }

        if (!canApply) {
            throw new Error(`You do not meet the requirements (Level >= ${MEDIATOR_REQUIRED_LEVEL} or Balance >= ${MEDIATOR_ESCROW_AMOUNT_TND.toFixed(2)} TND).`);
        }

        // ---(اختياري: يمكن تجميد الضمان هنا إذا كان النوع guarantee, أو تركه للأدمن)---
        // if (applicationType === 'guarantee') {
        //     if (user.balance < MEDIATOR_ESCROW_AMOUNT_TND) throw new Error("Insufficient balance for guarantee deposit.");
        //     // قد ترغب في تجميده هنا أو عند موافقة الأدمن
        // }
        // -------------------------------------------------------------------

        // تحديث حالة طلب المستخدم
        user.mediatorApplicationStatus = 'Pending';
        // مسح الملاحظات السابقة إن وجدت
        user.mediatorApplicationNotes = undefined;
        await user.save({ session });
        console.log(`   User ${userId} application status set to Pending. Condition met: ${conditionMet}`);

        // إرسال إشعار للأدمن
        const admins = await User.find({ userRole: 'Admin' }).select('_id').session(session);
        if (admins.length > 0) {
            const adminNotifications = admins.map(admin => ({
                user: admin._id, type: 'NEW_MEDIATOR_APPLICATION', // نوع جديد
                title: 'New Mediator Application',
                message: `User "${user.fullName || user.email}" has applied to become a mediator (Condition: ${applicationType}). Please review their application.`,
                relatedEntity: { id: userId, modelName: 'User' }
            }));
            await Notification.insertMany(adminNotifications, { session });
            console.log(`   Admin notifications created for new mediator application.`);
            // يمكنك إضافة إرسال Socket.IO للأدمن هنا
        }

        await session.commitTransaction();
        console.log("   Mediator application submitted and transaction committed.");
        res.status(200).json({ msg: "Your application to become a mediator has been submitted successfully and is pending review." });

    } catch (error) {
        if (session.inTransaction()) { await session.abortTransaction(); }
        console.error("[applyForMediator] Error:", error);
        res.status(400).json({ msg: error.message || 'Failed to submit application.' });
    } finally {
        if (session.endSession) await session.endSession();
        console.log("--- Controller: applyForMediator END ---");
    }
};

// --- [!!!] دالة جديدة: جلب طلبات الانضمام المعلقة (للأدمن) [!!!] ---
exports.adminGetPendingMediatorApplications = async (req, res) => {
    const { page = 1, limit = 15 } = req.query;
    console.log(`--- Controller: adminGetPendingMediatorApplications - Page: ${page}, Limit: ${limit} ---`);

    try {
        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 15,
            sort: { updatedAt: -1 }, // عرض الأحدث أولاً (آخر تحديث للطلب)
            select: '-password', // استبعاد كلمة المرور
            lean: true
        };

        const result = await User.paginate(
            { mediatorApplicationStatus: 'Pending' }, // جلب المستخدمين الذين لديهم طلب معلق
            options
        );

        console.log(`   Found ${result.totalDocs || 0} pending mediator applications.`);
        res.status(200).json({
            applications: result.docs || result.users, // اسم الحقل يعتمد على paginate
            totalPages: result.totalPages,
            currentPage: result.page,
            totalApplications: result.totalDocs || result.totalUsers
        });

    } catch (error) {
        console.error("[adminGetPendingMediatorApplications] Error:", error);
        res.status(500).json({ msg: "Server error fetching pending mediator applications." });
    }
};

// --- [!!!] دالة جديدة: موافقة الأدمن على طلب الانضمام [!!!] ---
exports.adminApproveMediatorApplication = async (req, res) => {
    const { userId } = req.params; // ID المستخدم صاحب الطلب
    const adminUserId = req.user._id;
    const adminFullName = req.user.fullName;

    console.log(`--- Controller: adminApproveMediatorApplication - User: ${userId}, Admin: ${adminUserId} ---`);

    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ msg: "Invalid User ID." });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findOne({ _id: userId, mediatorApplicationStatus: 'Pending' }).session(session);
        if (!user) throw new Error("Pending application not found for this user.");

        // التحقق من شرط الضمان إذا كان مطلوبًا (أو يمكن تركه لـ applyForMediator)
        // if (user.balance < MEDIATOR_ESCROW_AMOUNT_TND) {
        //     throw new Error(`User balance (${user.balance.toFixed(2)}) is insufficient for the required guarantee (${MEDIATOR_ESCROW_AMOUNT_TND.toFixed(2)}). Ask user to deposit first.`);
        // }

        // تجميد الضمان (إذا لم يتم عند التقديم)
        if (user.mediatorEscrowGuarantee <= 0 && user.balance >= MEDIATOR_ESCROW_AMOUNT_TND) { // تجميد فقط إذا لم يكن مجمدًا والرصيد كافٍ
            const balanceBefore = user.balance;
            const guaranteeAmount = MEDIATOR_ESCROW_AMOUNT_TND;
            user.balance -= guaranteeAmount;
            user.mediatorEscrowGuarantee += guaranteeAmount; // إضافة بدلًا من التعيين للاحتياط
            console.log(`   Guarantee ${guaranteeAmount} TND moved from balance to escrow. Balance: ${balanceBefore} -> ${user.balance}`);
        } else if (user.mediatorEscrowGuarantee <= 0 && user.balance < MEDIATOR_ESCROW_AMOUNT_TND && user.level < MEDIATOR_REQUIRED_LEVEL) {
            // إذا كان الضمان مطلوبًا (ليس لديه المستوى الكافي) والرصيد غير كافٍ
            throw new Error(`User does not meet reputation level and has insufficient balance (${user.balance.toFixed(2)} TND) for the guarantee deposit (${MEDIATOR_ESCROW_AMOUNT_TND.toFixed(2)}).`);
        }


        // تحديث حالة المستخدم
        user.isMediatorQualified = true;
        user.mediatorApplicationStatus = 'Approved';
        user.mediatorStatus = 'Available'; // جعله متاحًا افتراضيًا
        user.mediatorApplicationNotes = `Approved by ${adminFullName || adminUserId} on ${new Date().toLocaleDateString()}`;
        await user.save({ session });
        console.log(`   User ${userId} approved as mediator.`);

        // إرسال إشعار للمستخدم
        const userMessage = `Congratulations! Your application to become a mediator has been approved by admin "${adminFullName}". You can now be assigned mediation tasks when your status is 'Available'.`;
        await Notification.create([{
            user: userId, type: 'MEDIATOR_APP_APPROVED', // نوع جديد
            title: 'Mediator Application Approved!', message: userMessage
        }], { session });
        console.log(`   Approval notification created for user ${userId}.`);
        // إرسال Socket.IO للمستخدم

        await session.commitTransaction();
        console.log("   Approval transaction committed.");
        res.status(200).json({ msg: "Mediator application approved successfully.", user: user.toObject() }); // أرجع المستخدم المحدث

    } catch (error) {
        if (session.inTransaction()) { await session.abortTransaction(); }
        console.error("[adminApproveMediatorApplication] Error:", error);
        res.status(400).json({ msg: error.message || 'Failed to approve application.' });
    } finally {
        if (session.endSession) await session.endSession();
        console.log("--- Controller: adminApproveMediatorApplication END ---");
    }
};

// --- [!!!] دالة جديدة: رفض الأدمن لطلب الانضمام [!!!] ---
exports.adminRejectMediatorApplication = async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body; // سبب الرفض من الأدمن
    const adminUserId = req.user._id;
    const adminFullName = req.user.fullName;

    console.log(`--- Controller: adminRejectMediatorApplication - User: ${userId}, Admin: ${adminUserId} ---`);

    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ msg: "Invalid User ID." });
    if (!reason || reason.trim() === '') return res.status(400).json({ msg: "Rejection reason is required." });

    try {
        // لا نحتاج معاملة هنا لأننا فقط نحدث حالة المستخدم
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, mediatorApplicationStatus: 'Pending' },
            {
                $set: {
                    mediatorApplicationStatus: 'Rejected',
                    mediatorApplicationNotes: `Rejected by ${adminFullName || adminUserId}: ${reason.trim()}`,
                    // لا نغير isMediatorQualified أو mediatorStatus
                }
            },
            { new: true }
        ).select('-password'); // استبعاد كلمة المرور

        if (!updatedUser) {
            // التحقق إذا كان الطلب موجودًا ولكن ليس pending
            const existingUser = await User.findById(userId);
            if (existingUser && existingUser.mediatorApplicationStatus !== 'Pending') {
                throw new Error(`Application for user ${userId} is already processed (Status: ${existingUser.mediatorApplicationStatus}).`);
            } else {
                throw new Error("Pending application not found for this user.");
            }
        }
        console.log(`   User ${userId} mediator application rejected.`);

        // إرسال إشعار للمستخدم
        const userMessage = `We regret to inform you that your application to become a mediator was rejected by admin "${adminFullName}". Reason: ${reason.trim()}`;
        await Notification.create({
            user: userId, type: 'MEDIATOR_APP_REJECTED', // نوع جديد
            title: 'Mediator Application Rejected', message: userMessage
        });
        console.log(`   Rejection notification created for user ${userId}.`);
        // إرسال Socket.IO للمستخدم

        res.status(200).json({ msg: "Mediator application rejected.", user: updatedUser });

    } catch (error) {
        console.error("[adminRejectMediatorApplication] Error:", error);
        res.status(400).json({ msg: error.message || 'Failed to reject application.' });
    } finally {
        console.log("--- Controller: adminRejectMediatorApplication END ---");
    }
};
// -----------------------------------------------------