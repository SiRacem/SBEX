// server/controllers/user.controller.js
const User = require("../models/User");
const Notification = require('../models/Notification');
const Product = require("../models/Product");
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
var jwt = require('jsonwebtoken');
const config = require("config");
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // تأكد من استيراده إذا كنت تتعامل مع أخطاء multer مباشرة

// --- ثوابت الشروط (يمكن نقلها لملف config) ---
const MEDIATOR_REQUIRED_LEVEL = 5;
const MEDIATOR_ESCROW_AMOUNT_TND = 150.00;

// دالة مساعدة لتنسيق العملة (يمكن وضعها في ملف helpers)
const formatCurrency = (amount, currencyCode = "TND") => {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
        return "N/A";
    }
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numericAmount);
    } catch (error) {
        console.warn(`Currency formatting failed for ${currencyCode}. Falling back. Error: ${error.message}`);
        return `${numericAmount.toFixed(2)} ${currencyCode}`;
    }
};

// --- Register ---
exports.Register = async (req, res) => {
    const { fullName, email, phone, address, password, userRole, blocked = false } = req.body;
    console.log("--- Controller: Register Request ---");
    try {
        const existantUser = await User.findOne({ email: email.toLowerCase() });
        if (existantUser) {
            console.warn(`Registration attempt failed: Email ${email} already exists.`);
            return res.status(409).json({ msg: "Email already exists" });
        }

        const newUser = new User({ fullName, email: email.toLowerCase(), phone, address, password, userRole, blocked });
        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(password, salt);
        await newUser.save();
        console.log(`User registered successfully: ${newUser.email} (ID: ${newUser._id})`);

        res.status(201).json({ msg: "Registration successful! Please login." });

    } catch (error) {
        console.error("Registration Controller Error:", error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => ({ msg: el.message, param: el.path }));
            return res.status(400).json({ errors });
        }
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during registration.", error: error.message });
        }
    }
};

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

        const payload = { _id: user._id, fullName: user.fullName, userRole: user.userRole };
        const secret = config.get("secret");
        const token = jwt.sign(payload, secret, { expiresIn: '7d' }); // تم تغيير مدة الصلاحية إلى 7 أيام

        console.log(`User ${email} logged in successfully. Blocked status: ${user.blocked}`);
        res.status(200).json({
            token,
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                address: user.address,
                userRole: user.userRole,
                balance: user.balance,
                sellerAvailableBalance: user.sellerAvailableBalance,
                sellerPendingBalance: user.sellerPendingBalance,
                depositBalance: user.depositBalance,
                withdrawalBalance: user.withdrawalBalance,
                blocked: user.blocked,
                blockReason: user.blockReason,
                blockedAt: user.blockedAt,
                registerDate: user.registerDate,
                avatarUrl: user.avatarUrl,
                isMediatorQualified: user.isMediatorQualified,
                mediatorStatus: user.mediatorStatus,
                mediatorEscrowGuarantee: user.mediatorEscrowGuarantee,
                successfulMediationsCount: user.successfulMediationsCount,
                canWithdrawGuarantee: user.canWithdrawGuarantee,
                mediatorApplicationStatus: user.mediatorApplicationStatus,
                mediatorApplicationBasis: user.mediatorApplicationBasis,
                mediatorApplicationNotes: user.mediatorApplicationNotes,
                reputationPoints: user.reputationPoints,
                level: user.level,
                claimedLevelRewards: user.claimedLevelRewards,
                positiveRatings: user.positiveRatings,
                negativeRatings: user.negativeRatings,
                productsSoldCount: user.productsSoldCount,
                escrowBalance: user.escrowBalance,
                activeListingsCount: await Product.countDocuments({ user: user._id, status: 'approved' }),
            }
        });

    } catch (error) {
        console.error("Login Controller Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during login.", error: error.message });
        }
    }
};

// --- Auth (Get Profile) ---
exports.Auth = async (req, res) => {
    console.log(`--- Controller: Auth (Get Profile) for user ID: ${req.user?._id} ---`);
    if (!req.user || !req.user._id) {
        console.warn("Auth Controller: req.user or req.user._id is missing from token/middleware.");
        return res.status(401).json({ msg: "Not authorized (user data missing from token or middleware)" });
    }

    try {
        const userFromDb = await User.findById(req.user._id).select('-password').lean();
        if (!userFromDb) {
            console.warn(`Auth Controller: User not found in DB for ID: ${req.user._id}. Token might be for a deleted user.`);
            return res.status(401).json({ msg: "User associated with token not found." });
        }

        const activeListingsCount = await Product.countDocuments({
            user: userFromDb._id,
            status: 'approved'
        });

        const userProfileData = {
            ...userFromDb,
            activeListingsCount: activeListingsCount,
        };

        console.log(`Auth Controller: Successfully fetched profile for user ID: ${req.user._id}. Sending data wrapped in 'user' object.`);
        res.status(200).json({ user: userProfileData });

    } catch (error) {
        console.error(`Error fetching full profile for ${req.user._id}:`, error);
        res.status(500).json({ msg: "Server error fetching profile data." });
    }
};

// --- Check Email Exists ---
exports.checkEmailExists = async (req, res) => {
    const { email } = req.body;
    console.log(`--- Controller: checkEmailExists START for email: ${email} (Requested by: ${req.user?._id}) ---`);
    if (!email) {
        console.warn("[checkEmailExists] Email missing from request body.");
        return res.status(400).json({ msg: "Email is required in the request body." });
    }
    try {
        const normalizedEmail = email.toLowerCase();
        console.log(`[checkEmailExists] Searching for email: ${normalizedEmail}`);
        const foundUser = await User.findOne({ email: normalizedEmail }).select('_id fullName email');
        console.log(`[checkEmailExists] User.findOne result:`, foundUser ? `User found (ID: ${foundUser._id})` : 'null (Not Found)');
        if (foundUser) {
            console.log(`[checkEmailExists] User found. Sending 200 OK with user data.`);
            return res.status(200).json({
                _id: foundUser._id,
                fullName: foundUser.fullName,
                email: foundUser.email
            });
        } else {
            console.log(`[checkEmailExists] User not found. Sending 404 Not Found.`);
            return res.status(404).json({ msg: "User with this email not found." });
        }
    } catch (error) {
        console.error("[checkEmailExists] Error caught in controller:", error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error while checking email." });
        }
    }
};

// --- Get Users (Admin) ---
exports.getUsers = async (req, res) => {
    console.log("--- Controller: getUsers (Admin) ---");
    try {
        const users = await User.find().select('-password').sort({ registerDate: -1 });
        console.log(`Fetched ${users.length} users.`);
        res.status(200).json(users);
    } catch (error) {
        console.error("Error in getUsers:", error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Failed to retrieve users." });
        }
    }
};

// --- Update User (Admin) ---
exports.updateUsers = async (req, res) => {
    const userIdToUpdate = req.params.id;
    const updateData = req.body;
    const adminUserId = req.user?._id;
    const adminFullName = req.user?.fullName;
    const adminUserRole = req.user?.userRole;

    console.log(`--- Controller: updateUsers attempt for User ID: ${userIdToUpdate} by Admin ID: ${adminUserId} ---`);
    console.log("Update data received:", updateData);

    if (adminUserRole !== 'Admin') {
        console.warn(`Forbidden: User ${adminUserId} (${adminUserRole}) attempted to update user ${userIdToUpdate}.`);
        return res.status(403).json({ msg: "Forbidden: You do not have permission to update users." });
    }
    if (adminUserId.toString() === userIdToUpdate.toString()) {
        console.warn(`Admin ${adminUserId} attempted to update their own data via admin route.`);
        return res.status(400).json({ msg: "Admins cannot update their own data using this specific endpoint. Use profile update." });
    }

    delete updateData.password;
    delete updateData.userRole;
    delete updateData.email;
    delete updateData._id;
    delete updateData.registerDate;

    const balanceFields = ['balance', 'sellerAvailableBalance', 'sellerPendingBalance', 'depositBalance', 'withdrawalBalance', 'mediatorEscrowGuarantee'];
    let originalUser;

    try {
        originalUser = await User.findById(userIdToUpdate).lean();
        if (!originalUser) {
            console.warn(`Update failed: User ${userIdToUpdate} not found.`);
            return res.status(404).json({ msg: "User not found" });
        }
        console.log("Original user data fetched:", { _id: originalUser._id, email: originalUser.email });

        const updatedUser = await User.findByIdAndUpdate(
            userIdToUpdate,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password').lean();

        if (!updatedUser) {
            console.error(`Update failed unexpectedly after finding user ${userIdToUpdate}.`);
            return res.status(500).json({ msg: "Update failed unexpectedly." });
        }
        console.log(`User ${userIdToUpdate} updated successfully in DB.`);

        let balanceChanged = false;
        let changesSummary = [];
        balanceFields.forEach(field => {
            const oldValue = originalUser[field] ?? 0;
            const newValue = updatedUser[field] ?? 0;
            if (newValue.toFixed(2) !== oldValue.toFixed(2)) { // مقارنة الأرقام العشرية بدقة
                balanceChanged = true;
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

            try {
                await Promise.all([
                    Notification.create({
                        user: userIdToUpdate, type: 'ADMIN_BALANCE_ADJUSTMENT',
                        title: 'Account Balance Adjusted by Admin', message: notificationMessageForUser,
                        relatedEntity: { id: adminUserId, modelName: 'User' }
                    }),
                    Notification.create({
                        user: adminUserId, type: 'USER_BALANCE_ADJUSTED',
                        title: `Balances Adjusted for ${targetUserFullName}`, message: notificationMessageForAdmin,
                        relatedEntity: { id: userIdToUpdate, modelName: 'User' }
                    })
                ]);
                console.log(`Notifications created successfully for balance update of user ${userIdToUpdate}.`);

                const targetUserSocketId = req.onlineUsers[userIdToUpdate.toString()];
                if (targetUserSocketId && req.io) {
                    const balancesPayload = {
                        _id: updatedUser._id,
                        balance: updatedUser.balance,
                        sellerAvailableBalance: updatedUser.sellerAvailableBalance,
                        sellerPendingBalance: updatedUser.sellerPendingBalance,
                        mediatorEscrowGuarantee: updatedUser.mediatorEscrowGuarantee,
                    };
                    req.io.to(targetUserSocketId).emit('user_balances_updated', balancesPayload);
                    console.log(`   Socket event 'user_balances_updated' emitted to user ${userIdToUpdate} with payload:`, balancesPayload);
                } else {
                    console.log(`   User ${userIdToUpdate} is not online to receive real-time balance update.`);
                }
            } catch (notifyError) {
                console.error(`Error creating balance update notifications for user ${userIdToUpdate}:`, notifyError);
            }
        } else {
            console.log("No balance changes detected. Skipping balance notifications and socket update.");
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error(`Error processing update for user ${userIdToUpdate}:`, error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(el => ({ msg: el.message, param: el.path }));
            return res.status(400).json({ errors });
        }
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error during user update." });
        }
    }
};

// --- Delete User (Admin) ---
exports.deleteUsers = async (req, res) => {
    const userIdToDelete = req.params.id;
    console.log(`--- Controller: deleteUsers attempt for ID: ${userIdToDelete} by Admin: ${req.user?._id} ---`);
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
exports.getUserPublicProfile = async (req, res) => {
    const { userId } = req.params;
    console.log(`--- Controller: getUserPublicProfile for ID: ${userId} ---`);
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ msg: "Invalid User ID format." });
    try {
        const userProfile = await User.findById(userId)
            .select('fullName registerDate userRole avatarUrl positiveRatings negativeRatings blocked productsSoldCount');
        if (!userProfile) return res.status(404).json({ msg: "User not found." });
        const approvedProductCount = await Product.countDocuments({ user: userId, status: 'approved' });
        const publicProfileData = {
            _id: userProfile._id,
            fullName: userProfile.fullName,
            memberSince: userProfile.registerDate,
            role: userProfile.userRole,
            avatarUrl: userProfile.avatarUrl,
            approvedProducts: approvedProductCount,
            soldProducts: userProfile.productsSoldCount,
            blocked: userProfile.blocked,
            positiveRatings: userProfile.positiveRatings,
            negativeRatings: userProfile.negativeRatings
        };
        res.status(200).json(publicProfileData);
    } catch (error) {
        console.error(`Error fetching public profile for ${userId}:`, error);
        if (!res.headersSent) res.status(500).json({ msg: "Server error fetching profile data." });
    }
};

// --- Admin Get Available Mediators ---
exports.adminGetAvailableMediators = async (req, res) => {
    console.log(`--- Controller: adminGetAvailableMediators ---`);
    try {
        const mediators = await User.find({
            isMediatorQualified: true,
            blocked: false,
            mediatorStatus: 'Available'
        })
            .select('_id fullName email avatarUrl reputationPoints level mediatorStatus successfulMediationsCount')
            .sort({ fullName: 1 });
        console.log(`Found ${mediators.length} available qualified mediators.`);
        res.status(200).json(mediators);
    } catch (error) {
        console.error("Error fetching available mediators:", error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error fetching mediators." });
        }
    }
};

// --- Apply For Mediator ---
exports.applyForMediator = async (req, res) => {
    const userId = req.user._id;
    const { applicationType } = req.body;
    console.log(`--- Controller: applyForMediator - User: ${userId}, Type Requested: ${applicationType} ---`);

    if (!['reputation', 'guarantee'].includes(applicationType)) {
        return res.status(400).json({ msg: "Invalid application type specified." });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    // --- [!!! تعريف المتغير هنا في بداية الدالة ليكون متاحًا دائمًا !!!] ---
    let createdAdminNotifications = [];
    let admins = []; // تعريف admins هنا أيضًا

    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            // لا حاجة لـ abort و end هنا، سيتم في finally أو catch
            return res.status(404).json({ msg: "User not found." });
        }
        if (user.isMediatorQualified) {
            return res.status(400).json({ msg: "You are already a qualified mediator." });
        }
        // السماح بإعادة التقديم إذا كان الطلب السابق مرفوضًا
        if (user.mediatorApplicationStatus === 'Pending') {
            return res.status(400).json({ msg: "You already have a pending application." });
        }

        let basisForApplication = 'Unknown';
        let previousApplicationStatus = user.mediatorApplicationStatus; // حفظ الحالة السابقة
        let previousRejectionReason = user.mediatorApplicationNotes; // حفظ سبب الرفض السابق

        // إعادة تعيين ملاحظات التطبيق القديمة قبل التقديم الجديد
        user.mediatorApplicationNotes = undefined;


        if (applicationType === 'reputation') {
            if (user.level >= MEDIATOR_REQUIRED_LEVEL) {
                basisForApplication = 'Reputation';
            } else {
                throw new Error(`You do not meet the required Level ${MEDIATOR_REQUIRED_LEVEL}. Your current level: ${user.level}.`);
            }
        } else if (applicationType === 'guarantee') {
            if (user.balance >= MEDIATOR_ESCROW_AMOUNT_TND) {
                basisForApplication = 'Guarantee';
                const balanceBefore = user.balance;
                user.balance -= MEDIATOR_ESCROW_AMOUNT_TND;
                user.mediatorEscrowGuarantee = (user.mediatorEscrowGuarantee || 0) + MEDIATOR_ESCROW_AMOUNT_TND;
                console.log(`   Guarantee ${MEDIATOR_ESCROW_AMOUNT_TND} TND moved from balance (${balanceBefore}) to escrow (${user.mediatorEscrowGuarantee}) upon application.`);
            } else {
                throw new Error(`Insufficient balance (${formatCurrency(user.balance, "TND")}) for the guarantee deposit (${formatCurrency(MEDIATOR_ESCROW_AMOUNT_TND, 'TND')}).`);
            }
        }

        user.mediatorApplicationStatus = 'Pending';
        user.mediatorApplicationBasis = basisForApplication;
        user.mediatorApplicationSubmittedAt = new Date(); // <--- أضف هذا
        await user.save({ session });
        console.log(`   User ${userId} application status set to Pending. Basis: ${basisForApplication}.`);

        // إشعار للمستخدم نفسه
        let userMessage = `Your application to become a mediator (based on ${basisForApplication}) is now pending review.`;
        if (applicationType === 'guarantee') {
            userMessage += ` ${formatCurrency(MEDIATOR_ESCROW_AMOUNT_TND, "TND")} has been reserved from your balance.`;
        }
        const userAppNotifications = await Notification.create([{ user: userId, type: 'MEDIATOR_APP_PENDING', title: 'Mediator Application Submitted', message: userMessage }], { session, ordered: true }); // أضفت ordered: true هنا أيضًا
        console.log(`   User notification created: ${userAppNotifications[0]._id}`);
        if (req.io && req.onlineUsers && req.onlineUsers[userId.toString()]) {
            req.io.to(req.onlineUsers[userId.toString()]).emit('new_notification', userAppNotifications[0].toObject());
        }

        // إشعارات للمسؤولين
        admins = await User.find({ userRole: 'Admin' }).select('_id').session(session); // إعطاء قيمة لـ admins المعرفة في الأعلى
        if (admins.length > 0) {
            const adminNotificationsData = admins.map(admin => ({
                user: admin._id, type: 'NEW_MEDIATOR_APPLICATION',
                title: 'New Mediator Application',
                message: `User "${user.fullName || user.email}" has applied to become a mediator (Basis: ${basisForApplication}). Please review.`,
                relatedEntity: { id: userId, modelName: 'User' }
            }));
            createdAdminNotifications = await Notification.insertMany(adminNotificationsData, { session, ordered: true }); // إعطاء قيمة لـ createdAdminNotifications
            console.log(`   ${createdAdminNotifications.length} Admin notifications created in DB.`);
        }

        // إرسال تحديث رصيد المستخدم إذا كان guarantee
        if (applicationType === 'guarantee') {
            const targetUserSocketId = req.onlineUsers[userId.toString()];
            if (targetUserSocketId && req.io) {
                const balancesPayload = {
                    _id: user._id.toString(), balance: user.balance,
                    mediatorEscrowGuarantee: user.mediatorEscrowGuarantee,
                };
                req.io.to(targetUserSocketId).emit('user_balances_updated', balancesPayload);
                console.log(`   Socket event 'user_balances_updated' emitted to user ${userId} after reserving guarantee.`);
            }
        }

        await session.commitTransaction();
        // session.endSession() ستستدعى في finally

        // --- إرسال حدث Socket.IO للمسؤولين بعد الـ Commit ---
        // هذا الجزء الآن يستخدم createdAdminNotifications و admins المعرفة في نطاق الدالة
if (req.io && req.onlineUsers) {
         const applicantDataForSocket = {
             _id: user._id, fullName: user.fullName, email: user.email,
             mediatorApplicationStatus: user.mediatorApplicationStatus,
             mediatorApplicationBasis: user.mediatorApplicationBasis,
             // أضف الحقول التي تحتاجها واجهة المراجعة مثل الرصيد والمستوى وتاريخ التقديم
             level: user.level,
             balance: user.balance, // الرصيد الحالي بعد أي خصم للضمان
             mediatorEscrowGuarantee: user.mediatorEscrowGuarantee,
             // استخدم تاريخ التقديم الفعلي إذا سجلته، أو updatedAt
             updatedAt: user.updatedAt, // أو mediatorApplicationSubmittedAt إذا أضفته
             createdAt: user.createdAt // قد يكون مفيدًا
         };

         if (createdAdminNotifications.length > 0) {
             createdAdminNotifications.forEach(adminNotification => {
                 const adminSocketId = req.onlineUsers[adminNotification.user.toString()];
                 if (adminSocketId) {
                     req.io.to(adminSocketId).emit('new_notification', adminNotification.toObject());
                     req.io.to(adminSocketId).emit('new_pending_mediator_application', applicantDataForSocket);
                     console.log(`   [Socket] Emitted 'new_notification' and 'new_pending_mediator_application' to admin ${adminNotification.user}`);
                 }
             });
         } else if (admins.length > 0) { // إذا كان هناك مسؤولون ولكن لم يتم إنشاء إشعارات (نادر)
             admins.forEach(admin => {
                 const adminSocketId = req.onlineUsers[admin._id.toString()];
                 if (adminSocketId) {
                     req.io.to(adminSocketId).emit('new_pending_mediator_application', applicantDataForSocket);
                 }
             });
         }
     }
        // --- نهاية إرسال السوكيت ---

        res.status(200).json({ msg: "Your application has been submitted successfully and is pending review." });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        // session.endSession(); // ستستدعى في finally
        console.error("[applyForMediator] Error:", error.message, error.stack);
        if (!res.headersSent) {
            res.status(400).json({ msg: error.message || 'Failed to submit application.' });
        }
    } finally {
        if (session && session.endSession) {
            await session.endSession();
        }
    }
};

// --- Admin Get Pending Mediator Applications ---
exports.adminGetPendingMediatorApplications = async (req, res) => {
    const { page = 1, limit = 15 } = req.query;
    console.log(`--- Controller: adminGetPendingMediatorApplications - Page: ${page}, Limit: ${limit} ---`);
    try {
        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 15,
            sort: { updatedAt: -1 },
            select: '_id fullName email level balance mediatorEscrowGuarantee mediatorApplicationStatus mediatorApplicationBasis updatedAt', // أضفت mediatorEscrowGuarantee
            lean: true
        };
        const result = await User.paginate({ mediatorApplicationStatus: 'Pending' }, options);
        console.log(`   Found ${result.totalDocs || 0} pending mediator applications.`);
        res.status(200).json({
            applications: result.docs || [],
            totalPages: result.totalPages || 0,
            currentPage: result.page || 1,
            totalApplications: result.totalDocs || 0
        });
    } catch (error) {
        console.error("[adminGetPendingMediatorApplications] Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error fetching pending mediator applications." });
        }
    }
};

// --- Admin Approve Mediator Application ---
exports.adminApproveMediatorApplication = async (req, res) => {
    const { userId } = req.params;
    const adminUserId = req.user._id;
    const adminFullName = req.user.fullName;
    console.log(`--- Controller: adminApproveMediatorApplication - User: ${userId}, Admin: ${adminUserId} ---`);

    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ msg: "Invalid User ID." });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findOne({ _id: userId, mediatorApplicationStatus: 'Pending' }).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ msg: "Pending application not found for this user." });
        }

        if (user.mediatorApplicationBasis === 'Guarantee') {
            if (user.mediatorEscrowGuarantee < MEDIATOR_ESCROW_AMOUNT_TND) {
                console.error(`   Critical Error: User ${userId} applied on guarantee basis but escrow (${user.mediatorEscrowGuarantee}) is less than required (${MEDIATOR_ESCROW_AMOUNT_TND}). This implies an issue in the application process.`);
                throw new Error(`Guarantee amount seems incorrect. Expected ${formatCurrency(MEDIATOR_ESCROW_AMOUNT_TND, 'TND')}, found ${formatCurrency(user.mediatorEscrowGuarantee, 'TND')}. Please check logs or ask user to re-apply if balance was adjusted after application.`);
            }
            console.log(`   Confirmed guarantee of ${user.mediatorEscrowGuarantee} TND is held for user ${userId}.`);
        } else if (user.mediatorApplicationBasis === 'Reputation') {
            if (user.level < MEDIATOR_REQUIRED_LEVEL) {
                throw new Error(`User no longer meets the required Level ${MEDIATOR_REQUIRED_LEVEL} for reputation-based application. Current level: ${user.level}.`);
            }
            console.log(`   Confirmed user ${userId} meets reputation level ${user.level} (Required: ${MEDIATOR_REQUIRED_LEVEL}).`);
        }


        user.isMediatorQualified = true;
        user.mediatorApplicationStatus = 'Approved';
        user.mediatorStatus = 'Available';
        user.mediatorApplicationNotes = `Approved by ${adminFullName || adminUserId} on ${new Date().toLocaleDateString()}`;
        await user.save({ session });
        console.log(`   User ${userId} approved as mediator.`);

        const userMessage = `Congratulations! Your application to become a mediator has been approved by admin "${adminFullName}". You can now be assigned mediation tasks when your status is 'Available'.`;
        await Notification.create([{
            user: userId, type: 'MEDIATOR_APP_APPROVED',
            title: 'Mediator Application Approved!', message: userMessage
        }], { session });
        console.log(`   Approval notification created for user ${userId}.`);

        const targetUserSocketId = req.onlineUsers[userId.toString()];
        if (targetUserSocketId && req.io) {
            const userProfileUpdatePayload = {
                _id: user._id.toString(),
                isMediatorQualified: user.isMediatorQualified,
                mediatorStatus: user.mediatorStatus,
                mediatorApplicationStatus: user.mediatorApplicationStatus,
                mediatorEscrowGuarantee: user.mediatorEscrowGuarantee, // أرسل الضمان أيضًا
                balance: user.balance // أرسل الرصيد إذا تغير (لم يتغير هنا ولكن للاكتمال)
            };
            req.io.to(targetUserSocketId).emit('user_profile_updated', userProfileUpdatePayload); // قد ترغب في إرسال 'user_balances_updated' أيضًا إذا تغير الرصيد
            req.io.to(targetUserSocketId).emit('user_balances_updated', {
                _id: user._id.toString(),
                balance: user.balance,
                mediatorEscrowGuarantee: user.mediatorEscrowGuarantee
            });
            console.log(`   Socket events 'user_profile_updated' and 'user_balances_updated' emitted to user ${userId} after mediator approval.`);
        }

        await session.commitTransaction();
        session.endSession();
        console.log("   Approval transaction committed.");

        const updatedUserForResponse = user.toObject();
        delete updatedUserForResponse.password;
        res.status(200).json({ msg: "Mediator application approved successfully.", user: updatedUserForResponse });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("[adminApproveMediatorApplication] Error:", error.message, error.stack);
        if (!res.headersSent) {
            res.status(400).json({ msg: error.message || 'Failed to approve application.' });
        }
    }
};

// --- Admin Reject Mediator Application ---
exports.adminRejectMediatorApplication = async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user._id;
    const adminFullName = req.user.fullName;
    console.log(`--- Controller: adminRejectMediatorApplication - User: ${userId}, Admin: ${adminUserId}, Reason: ${reason} ---`);

    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ msg: "Invalid User ID." });
    if (!reason || reason.trim() === '') return res.status(400).json({ msg: "Rejection reason is required." });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findOne({ _id: userId, mediatorApplicationStatus: 'Pending' }).session(session);

        if (!user) {
            const existingUser = await User.findById(userId).session(session);
            if (existingUser && existingUser.mediatorApplicationStatus !== 'Pending') {
                throw new Error(`Application for user ${userId} is already processed (Status: ${existingUser.mediatorApplicationStatus}). Cannot reject.`);
            } else {
                throw new Error("Pending application not found for this user. Cannot reject.");
            }
        }

        let balanceUpdated = false;
        if (user.mediatorApplicationBasis === 'Guarantee' && user.mediatorEscrowGuarantee > 0) {
            const escrowAmountToReturn = user.mediatorEscrowGuarantee;
            user.balance += escrowAmountToReturn;
            user.mediatorEscrowGuarantee = 0;
            balanceUpdated = true;
            console.log(`   Guarantee of ${escrowAmountToReturn} TND returned to balance for user ${userId} upon rejection. New Balance: ${user.balance}`);
        }

        user.mediatorApplicationStatus = 'Rejected';
        user.mediatorApplicationNotes = `Rejected by ${adminFullName || adminUserId}: ${reason.trim()}`;

        await user.save({ session });
        console.log(`   User ${userId} mediator application rejected.`);

        let userMessage = `We regret to inform you that your application to become a mediator was rejected by admin "${adminFullName}". Reason: ${reason.trim()}`;
        if (balanceUpdated) {
            userMessage += ` The guarantee amount has been returned to your main balance.`;
        }
        await Notification.create([{
            user: userId, type: 'MEDIATOR_APP_REJECTED',
            title: 'Mediator Application Rejected', message: userMessage
        }], { session });
        console.log(`   Rejection notification created for user ${userId}.`);

        const targetUserSocketId = req.onlineUsers[userId.toString()];
        if (targetUserSocketId && req.io) {
            const profileUpdatePayload = {
                _id: user._id.toString(),
                mediatorApplicationStatus: user.mediatorApplicationStatus,
                mediatorApplicationNotes: user.mediatorApplicationNotes,
            };
            req.io.to(targetUserSocketId).emit('user_profile_updated', profileUpdatePayload);
            console.log(`   Socket event 'user_profile_updated' (for app status) emitted to user ${userId} after rejection.`);

            if (balanceUpdated) {
                const balancesPayload = {
                    _id: user._id.toString(),
                    balance: user.balance,
                    mediatorEscrowGuarantee: user.mediatorEscrowGuarantee
                };
                req.io.to(targetUserSocketId).emit('user_balances_updated', balancesPayload);
                console.log(`   Socket event 'user_balances_updated' emitted to user ${userId} after application rejection and guarantee return.`);
            }
        }

        await session.commitTransaction();
        session.endSession();
        console.log("   Rejection transaction committed.");

        const updatedUserForResponse = user.toObject();
        delete updatedUserForResponse.password;
        res.status(200).json({ msg: "Mediator application rejected.", user: updatedUserForResponse });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("[adminRejectMediatorApplication] Error:", error.message, error.stack);
        if (!res.headersSent) {
            res.status(400).json({ msg: error.message || 'Failed to reject application.' });
        }
    }
};

// --- Update My Mediator Status (User) ---
exports.updateMyMediatorStatus = async (req, res) => {
    const userId = req.user._id;
    const { status } = req.body;
    console.log(`--- Controller: updateMyMediatorStatus - User: ${userId}, New Status: ${status} ---`);
    if (!['Available', 'Unavailable'].includes(status)) {
        return res.status(400).json({ msg: "Invalid status value. Can only set to 'Available' or 'Unavailable'." });
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: "User not found." });
        }
        if (!user.isMediatorQualified) {
            return res.status(403).json({ msg: "User is not a qualified mediator." });
        }
        if (user.mediatorStatus === 'Busy') {
            return res.status(400).json({ msg: "Cannot change status while assigned to a mediation task." });
        }
        user.mediatorStatus = status;
        await user.save();
        console.log(`   Mediator status for user ${userId} updated to ${status}.`);
        // إرسال تحديث للمستخدم عبر Socket.IO
        const targetUserSocketId = req.onlineUsers[userId.toString()];
        if (targetUserSocketId && req.io) {
            req.io.to(targetUserSocketId).emit('user_profile_updated', {
                _id: user._id.toString(),
                mediatorStatus: user.mediatorStatus
            });
            console.log(`   Socket event 'user_profile_updated' (for mediator status) emitted to user ${userId}.`);
        }
        res.status(200).json({ msg: `Your mediator status has been updated to ${status}.`, newStatus: status });
    } catch (error) {
        console.error("[updateMyMediatorStatus] Error:", error);
        if (!res.headersSent) {
            res.status(400).json({ msg: error.message || 'Failed to update mediator status.' });
        }
    }
};

// --- Update User Profile Picture ---
exports.updateUserProfilePicture = async (req, res) => {
    const userId = req.user._id;
    console.log(`--- Controller: updateUserProfilePicture for User ID: ${userId} ---`);
    if (!req.file) {
        console.warn("No file uploaded for avatar update.");
        return res.status(400).json({ msg: "No image file provided." });
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
            if (req.file && req.file.path) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Error deleting orphaned uploaded avatar:", err);
                });
            }
            return res.status(404).json({ msg: "User not found." });
        }
        if (user.avatarUrl) {
            if (!user.avatarUrl.startsWith('http://') && !user.avatarUrl.startsWith('https://')) {
                const oldAvatarPath = path.join(__dirname, '..', '..', user.avatarUrl);
                if (fs.existsSync(oldAvatarPath)) {
                    fs.unlink(oldAvatarPath, (err) => {
                        if (err) console.error("Error deleting old avatar:", oldAvatarPath, err);
                        else console.log("Old avatar deleted:", oldAvatarPath);
                    });
                } else {
                    console.log("Old avatar path not found or already deleted:", oldAvatarPath);
                }
            } else {
                console.log("Old avatar is an external URL, not deleting from server:", user.avatarUrl);
            }
        }
        const relativePath = req.file.path.replace(/\\/g, '/').split('uploads/')[1];
        user.avatarUrl = `uploads/${relativePath}`;
        await user.save();
        const userToReturn = user.toObject();
        delete userToReturn.password;
        console.log(`Avatar updated successfully for user ${userId}. New URL: ${user.avatarUrl}`);
        // إرسال تحديث للمستخدم عبر Socket.IO
        const targetUserSocketId = req.onlineUsers[userId.toString()];
        if (targetUserSocketId && req.io) {
            req.io.to(targetUserSocketId).emit('user_profile_updated', {
                _id: user._id.toString(),
                avatarUrl: user.avatarUrl
            });
            console.log(`   Socket event 'user_profile_updated' (for avatar) emitted to user ${userId}.`);
        }
        res.status(200).json({
            msg: "Profile picture updated successfully!",
            user: userToReturn
        });
    } catch (error) {
        console.error("Error updating profile picture in controller:", error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (errUnlink) => {
                if (errUnlink) console.error("Error deleting uploaded avatar after controller error:", errUnlink);
            });
        }
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ msg: 'File too large. Max 2MB allowed.' });
            }
            return res.status(400).json({ msg: `File upload error: ${error.message}` });
        }
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error while updating profile picture.", details: error.message });
        }
    }
};

// --- Admin Update User Block Status ---
exports.adminUpdateUserBlockStatus = async (req, res) => {
    const { userId } = req.params;
    const { blocked, reason } = req.body;
    const adminPerformerId = req.user._id;
    console.log(`--- Controller: adminUpdateUserBlockStatus for User ID: ${userId} by Admin ID: ${adminPerformerId} ---`);
    console.log(`Received: blocked=${blocked}, reason=${reason}`);
    if (typeof blocked !== 'boolean') {
        return res.status(400).json({ msg: "Invalid 'blocked' value. Must be true or false." });
    }
    if (blocked && (!reason || reason.trim() === "")) {
        return res.status(400).json({ msg: "A reason is required when blocking a user." });
    }
    if (userId === adminPerformerId.toString()) {
        return res.status(400).json({ msg: "Admin cannot block/unblock themselves via this route." });
    }
    try {
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            return res.status(404).json({ msg: "User not found." });
        }
        if (userToUpdate.userRole === 'Admin' && userToUpdate._id.toString() !== adminPerformerId.toString()) {
            console.warn(`Admin ${adminPerformerId} attempted to change block status of another Admin ${userId}.`);
            return res.status(403).json({ msg: "Operation not allowed on other administrators." });
        }
        const previousBlockStatus = userToUpdate.blocked;
        userToUpdate.blocked = blocked;
        if (blocked) {
            userToUpdate.blockReason = reason.trim();
            userToUpdate.blockedAt = new Date();
            userToUpdate.blockedBy = adminPerformerId;
        } else {
            userToUpdate.blockReason = null;
            userToUpdate.blockedAt = null;
            userToUpdate.blockedBy = null;
        }
        await userToUpdate.save();
        if (previousBlockStatus !== blocked) {
            let notificationTitle = '';
            let notificationMessage = '';
            if (blocked) {
                notificationTitle = 'Account Status Update: Blocked';
                notificationMessage = `Your account has been blocked by an administrator. Reason: ${userToUpdate.blockReason}. Please contact support for more information.`;
            } else {
                notificationTitle = 'Account Status Update: Unblocked';
                notificationMessage = `Your account has been unblocked by an administrator. You can now access all site features.`;
            }
            await Notification.create({
                user: userId,
                type: blocked ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_UNBLOCKED',
                title: notificationTitle,
                message: notificationMessage,
                relatedEntity: { id: adminPerformerId, modelName: 'User' }
            });
            console.log(`Notification sent to user ${userId} about block status change.`);
            const targetUserSocketId = req.onlineUsers[userId.toString()];
            if (targetUserSocketId && req.io) {
                req.io.to(targetUserSocketId).emit(blocked ? 'account_blocked' : 'account_unblocked', {
                    blocked: userToUpdate.blocked, // أرسل الحالة الجديدة
                    reason: blocked ? userToUpdate.blockReason : null
                });
                // قد ترغب أيضًا في إرسال user_profile_updated إذا كانت الواجهة الأمامية تعتمد عليه لتحديث حالة الحظر
                req.io.to(targetUserSocketId).emit('user_profile_updated', {
                    _id: userToUpdate._id.toString(),
                    blocked: userToUpdate.blocked,
                    blockReason: userToUpdate.blockReason
                });
                console.log(`Socket event '${blocked ? 'account_blocked' : 'account_unblocked'}' and 'user_profile_updated' emitted to user ${userId}.`);
            }
        }
        console.log(`User ${userId} block status updated to ${blocked}.`);
        const responseUser = {
            _id: userToUpdate._id,
            fullName: userToUpdate.fullName,
            email: userToUpdate.email,
            blocked: userToUpdate.blocked,
            blockReason: userToUpdate.blockReason,
            blockedAt: userToUpdate.blockedAt,
            userRole: userToUpdate.userRole
        };
        res.status(200).json({
            msg: `User ${blocked ? 'blocked' : 'unblocked'} successfully.`,
            user: responseUser
        });
    } catch (error) {
        console.error(`Error updating block status for user ${userId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ msg: "Server error updating user block status." });
        }
    }
};