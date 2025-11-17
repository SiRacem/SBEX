// server/services/achievementService.js

const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Product = require('../models/Product');
const Rating = require('../models/Rating');

const notifyUserOfNewAchievement = async (io, userId, achievement, userSocketId) => {
    try {
        const notification = new Notification({
            user: userId,
            type: 'ACHIEVEMENT_UNLOCKED',
            title: 'notification_titles.ACHIEVEMENT_UNLOCKED',
            message: 'notification_messages.ACHIEVEMENT_UNLOCKED',
            messageParams: { achievementName: achievement.title },
        });
        await notification.save();

        if (io && userSocketId) {
            io.to(userSocketId).emit('new_notification', notification.toObject());
            io.to(userSocketId).emit('achievement_unlocked', { achievement });
        }
    } catch (error) {
        console.error(`[AchievementService] Failed to send notification for user ${userId}:`, error);
    }
};


exports.checkAndAwardAchievements = async ({ userId, event, data = {}, req, session }) => {
    console.log(`[AchievementService] Checking achievements for user ${userId} triggered by event: ${event}`);

    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            console.warn(`[AchievementService] User ${userId} not found.`);
            return;
        }
        const userUnlockedAchievementIds = new Set(user.achievements.map(a => a.achievement.toString()));

        const potentialAchievements = await Achievement.find({
            isEnabled: true,
            _id: { $nin: Array.from(userUnlockedAchievementIds) }
        }).lean();

        if (potentialAchievements.length === 0) {
            return;
        }

        const newlyUnlockedAchievements = [];

        // --- جلب البيانات المساعدة مرة واحدة لتحسين الأداء ---
        let productCount, approvedProductCount, purchaseCount, ratingsGivenCount = null;

        for (const ach of potentialAchievements) {
            let unlocked = false;
            const criteria = ach.criteria;

            switch (criteria.type) {
                // --- إنجازات البائع ---
                case 'PRODUCTS_PUBLISHED':
                    if (event === 'PRODUCT_PUBLISHED') {
                        if (productCount === null) productCount = await Product.countDocuments({ user: userId }).session(session);
                        if (productCount >= criteria.value) unlocked = true;
                    }
                    break;

                case 'PRODUCTS_APPROVED':
                    if (event === 'PRODUCT_APPROVED') {
                        if (approvedProductCount === null) approvedProductCount = await Product.countDocuments({ user: userId, status: 'approved' }).session(session);
                        if (approvedProductCount >= criteria.value) unlocked = true;
                    }
                    break;

                case 'SALES_COUNT':
                    if (event === 'SALE_COMPLETED' && user.productsSoldCount >= criteria.value) {
                        unlocked = true;
                    }
                    break;

                case 'POSITIVE_RATINGS_RECEIVED':
                    if (event === 'RATING_RECEIVED' && user.positiveRatings >= criteria.value) {
                        unlocked = true;
                    }
                    break;

                // --- إنجازات المشتري ---
                case 'PURCHASES_COMPLETED':
                    if (event === 'PURCHASE_COMPLETED') {
                        if (purchaseCount === null) {
                            // طريقة دقيقة لحساب عدد المشتريات
                            purchaseCount = await MediationRequest.countDocuments({ buyer: userId, status: 'Completed' }).session(session);
                        }
                        if (purchaseCount >= criteria.value) unlocked = true;
                    }
                    break;

                case 'RATINGS_GIVEN':
                    if (event === 'RATING_GIVEN') {
                        if (ratingsGivenCount === null) ratingsGivenCount = await Rating.countDocuments({ rater: userId }).session(session);
                        if (ratingsGivenCount >= criteria.value) unlocked = true;
                    }
                    break;

                // --- إنجازات الوسيط ---
                case 'SUCCESSFUL_MEDIATIONS':
                    if (event === 'MEDIATION_COMPLETED' && user.successfulMediationsCount >= criteria.value) {
                        unlocked = true;
                    }
                    break;

                // --- إنجازات عامة ---
                case 'PROFILE_PICTURE_UPDATED':
                    if (event === 'PROFILE_PICTURE_UPDATED') {
                        unlocked = true; // الحدث نفسه كافٍ
                    }
                    break;

                case 'USER_LEVEL_REACHED':
                    if (event === 'LEVEL_UP' && user.level >= criteria.value) {
                        unlocked = true;
                    }
                    break;

                case 'REPUTATION_LEVEL_REACHED':
                    if (event === 'LEVEL_UP' && user.reputationLevel === criteria.value) {
                        unlocked = true;
                    }
                    break;

                case 'ACCOUNT_AGE_DAYS':
                    // يمكن تفعيل هذا الحدث عند تسجيل الدخول مثلاً
                    if (event === 'USER_LOGIN') {
                        const accountAge = (new Date() - user.createdAt) / (1000 * 60 * 60 * 24);
                        if (accountAge >= criteria.value) unlocked = true;
                    }
                    break;

                default:
                    break;
            }

            if (unlocked) {
                newlyUnlockedAchievements.push(ach);
            }
        }

        if (newlyUnlockedAchievements.length > 0) {
            const achievementsToPush = newlyUnlockedAchievements.map(ach => ({ achievement: ach._id }));

            // استخدم findOneAndUpdate للحصول على المستخدم المحدث
            const updatedUser = await User.findOneAndUpdate(
                { _id: userId },
                { $push: { achievements: { $each: achievementsToPush } } },
                { new: true, session: session }
            );

            // إرسال الإشعارات
            if (req && req.io && req.onlineUsers) {
                const userSocketId = req.onlineUsers[userId.toString()];
                for (const ach of newlyUnlockedAchievements) {
                    await notifyUserOfNewAchievement(req.io, userId, ach, userSocketId);
                }
                // إرسال تحديث للملف الشخصي للمستخدم ليشمل الإنجازات الجديدة
                if (userSocketId && updatedUser) {
                    req.io.to(userSocketId).emit('user_profile_updated', updatedUser.toObject());
                }
            }
        }

    } catch (error) {
        console.error(`[AchievementService] CRITICAL ERROR for user ${userId}:`, error);
    }
};