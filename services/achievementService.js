// server/services/achievementService.js

const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Product = require('../models/Product');
const Rating = require('../models/Rating');
const MediationRequest = require('../models/MediationRequest');

const notifyUserOfNewAchievement = async (io, userId, achievement, userSocketId) => {
    try {
        const existingNotif = await Notification.findOne({
            user: userId,
            type: 'ACHIEVEMENT_UNLOCKED',
            'messageParams.achievementName': achievement.title 
        });

        if (existingNotif) return;

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
        console.error(`[AchievementService] Failed to send notification:`, error);
    }
};

exports.checkAndAwardAchievements = async ({ userId, event, data = {}, req, session }) => {
    if (event !== 'USER_LOGIN') { 
        console.log(`🏆 [AchievementService] User: ${userId} | Event: ${event}`);
    }

    try {
        const query = User.findById(userId);
        if (session) query.session(session);
        const user = await query;

        if (!user) return;

        const userUnlockedAchievementIds = new Set(
            (user.achievements || []).map(a => a.achievement ? a.achievement.toString() : null).filter(id => id !== null)
        );

        const potentialAchievements = await Achievement.find({
            isEnabled: true,
            _id: { $nin: Array.from(userUnlockedAchievementIds) }
        }).lean();

        if (potentialAchievements.length === 0) return;

        const newlyUnlockedAchievements = [];

        // Cache variables to avoid redundant DB calls
        let productCount = null;
        let approvedProductCount = null;
        let purchaseCount = null;
        let ratingsGivenCount = null;

        for (const ach of potentialAchievements) {
            let unlocked = false;
            const criteria = ach.criteria;
            
            // Ensure value is a number for comparison
            const criteriaValue = Number(criteria.value);

            switch (criteria.type) {
                // 1. PRODUCTS_PUBLISHED (أول خطوة)
                case 'PRODUCTS_PUBLISHED':
                    if (event === 'PRODUCT_PUBLISHED' || event === 'USER_LOGIN') {
                        if (productCount === null) productCount = await Product.countDocuments({ user: userId });
                        if (productCount >= criteriaValue) unlocked = true;
                    }
                    break;

                // 2. PRODUCTS_APPROVED (تمت الموافقة!)
                case 'PRODUCTS_APPROVED':
                    if (event === 'PRODUCT_APPROVED' || event === 'USER_LOGIN') {
                        if (approvedProductCount === null) {
                            approvedProductCount = await Product.countDocuments({ 
                                user: userId, 
                                status: { $in: ['approved', 'sold', 'PendingMediatorSelection'] } 
                            });
                        }
                        if (approvedProductCount >= criteriaValue) unlocked = true;
                    }
                    break;
                
                // 3. SALES_COUNT (أول عملية بيع / تاجر جاد / خبير السوق)
                case 'SALES_COUNT':
                    if (event === 'SALE_COMPLETED' || event === 'USER_LOGIN') {
                        const userSales = user.productsSoldCount || 0;
                        if (userSales >= criteriaValue) unlocked = true;
                    }
                    break;

                // 4. PURCHASES_COMPLETED (بداية الرحلة / مشتري دائم / جامع الكنوز)
                case 'PURCHASES_COMPLETED':
                    if (event === 'PURCHASE_COMPLETED' || event === 'USER_LOGIN') {
                        if (purchaseCount === null) {
                            purchaseCount = await MediationRequest.countDocuments({ buyer: userId, status: 'Completed' });
                        }
                        if (purchaseCount >= criteriaValue) unlocked = true;
                    }
                    break;

                // 5. RATINGS_GIVEN (صوتك مسموع / ناقد بناء)
                case 'RATINGS_GIVEN':
                    if (event === 'RATING_GIVEN' || event === 'USER_LOGIN') {
                        if (ratingsGivenCount === null) {
                            ratingsGivenCount = await Rating.countDocuments({ rater: userId });
                        }
                        if (ratingsGivenCount >= criteriaValue) unlocked = true;
                    }
                    break;
                
                // 6. POSITIVE_RATINGS_RECEIVED (سمعة طيبة / محبوب الجماهير)
                case 'POSITIVE_RATINGS_RECEIVED':
                    if ((event === 'RATING_RECEIVED' || event === 'USER_LOGIN') && user.positiveRatings >= criteriaValue) {
                        unlocked = true;
                    }
                    break;

                // 7. BOUGHT_SAME_DAY (المحظوظ)
                case 'BOUGHT_SAME_DAY':
                case 'LUCKY_BUYER': // Fallback just in case
                    if (event === 'PURCHASE_COMPLETED' && data.product) {
                        const createdTime = data.product.createdAt ? new Date(data.product.createdAt).getTime() : Date.now();
                        const purchaseTime = new Date().getTime();
                        const diffInHours = (purchaseTime - createdTime) / (1000 * 60 * 60);
                        // Within 24 hours
                        if (diffInHours <= 24) unlocked = true;
                    }
                    break;

                // 8. PROFILE_PICTURE_UPDATED (مكتمل)
                case 'PROFILE_PICTURE_UPDATED':
                    if (event === 'PROFILE_PICTURE_UPDATED') unlocked = true;
                    break;

                // 9. SUCCESSFUL_MEDIATIONS (حارس الثقة / صانع السلام / قاضي محنك)
                case 'SUCCESSFUL_MEDIATIONS':
                    if (event === 'MEDIATION_COMPLETED' || event === 'USER_LOGIN') {
                        if ((user.successfulMediationsCount || 0) >= criteriaValue) {
                            unlocked = true;
                        }
                    }
                    break;

                // 10. USER_LEVEL_REACHED (مخضرم / الوصول للقمة / أسطورة)
                case 'USER_LEVEL_REACHED':
                    if (event === 'LEVEL_UP' || event === 'USER_LOGIN') {
                        if (user.level >= criteriaValue) unlocked = true;
                    }
                    break;
                
                // 11. ACCOUNT_AGE_DAYS (عضو جديد / فضي / ذهبي / ألماسي)
                case 'ACCOUNT_AGE_DAYS':
                    if (event === 'USER_LOGIN') {
                        const accountAge = (new Date() - new Date(user.registerDate)) / (1000 * 60 * 60 * 24);
                        if (accountAge >= criteriaValue) unlocked = true;
                    }
                    break;

                // 12. BARGAIN_HUNTER (صائد الصفقات)
                case 'BARGAIN_HUNTER': 
                    if (event === 'PURCHASE_COMPLETED' && data.product) {
                        const originalPrice = data.product.price;
                        const agreedPrice = data.product.agreedPrice;
                        // criteriaValue here is 0.5 (from your screenshot)
                        const threshold = criteriaValue || 0.5; 

                        if (agreedPrice && originalPrice && agreedPrice <= (originalPrice * threshold)) {
                             unlocked = true;
                        }
                    }
                    break;

                // 13. ACCEPTED_LOWER_BID (المتفاوض)
                case 'ACCEPTED_LOWER_BID':
                    if (event === 'SALE_COMPLETED' && data.product) {
                         const originalPrice = data.product.price;
                         const agreedPrice = data.product.agreedPrice;
                         // Logic: sold for less than listing price
                         if (agreedPrice && originalPrice && agreedPrice < originalPrice) {
                             unlocked = true;
                         }
                    }
                    break;

                // 14. LOYAL_BUYER (الوفي)
                case 'LOYAL_BUYER':
                    if (event === 'PURCHASE_COMPLETED' && data.product && data.product.user) {
                        const sellerId = data.product.user;
                        const loyaltyCount = await Product.countDocuments({ 
                            buyer: userId, 
                            user: sellerId,
                            status: 'sold' 
                        });
                        
                        if (loyaltyCount >= criteriaValue) {
                            unlocked = true;
                        }
                    }
                    break;

                // 15. SUCCESSFUL_BLOCK_REPORT (المنقذ)
                case 'SUCCESSFUL_BLOCK_REPORT':
                    if (event === 'REPORT_ACTION_TAKEN' && data.action === 'block') {
                        // Simple check: award on first successful block report if value is 1
                        unlocked = true;
                    }
                    break;

                // 16. PROFILE_VISITS (الفضولي)
                case 'PROFILE_VISITS':
                    if (event === 'PROFILE_VISITED' || event === 'USER_LOGIN') {
                        if ((user.profileViews || 0) >= criteriaValue) {
                            unlocked = true;
                        }
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
            const achievementsToPush = newlyUnlockedAchievements.map(ach => ({ 
                achievement: ach._id,
                unlockedAt: new Date()
            }));

            await User.updateOne(
                { _id: userId },
                { $push: { achievements: { $each: achievementsToPush } } },
                { session: session }
            );

            if (req && req.io && req.onlineUsers) {
                const userSocketId = req.onlineUsers[userId.toString()];
                for (const ach of newlyUnlockedAchievements) {
                    await notifyUserOfNewAchievement(req.io, userId, ach, userSocketId);
                }
                
                if (userSocketId) {
                    const updatedUser = await User.findById(userId).select('achievements').populate('achievements.achievement').lean();
                    req.io.to(userSocketId).emit('user_profile_updated', { 
                        _id: userId,
                        achievements: updatedUser.achievements 
                    });
                }
            }
        }

    } catch (error) {
        console.error(`[AchievementService] Error:`, error);
    }
};