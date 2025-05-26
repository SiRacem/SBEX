// server/services/pendingFundsReleaseService.js
const mongoose = require('mongoose');
const User = require('../models/User');
const PendingFund = require('../models/PendingFund');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const config = require('config'); // لجلب PLATFORM_BASE_CURRENCY إذا احتجت إليه هنا

const PLATFORM_BASE_CURRENCY = config.get('PLATFORM_BASE_CURRENCY') || 'TND';

const releaseDuePendingFunds = async () => {
    console.log(`[CRON_JOB_RELEASE_FUNDS] Starting job at ${new Date().toISOString()}`);
    const now = new Date();
    let fundsReleasedCount = 0;
    let errorsCount = 0;

    // جلب جميع الأموال المعلقة التي حان وقت فك تجميدها ولم يتم فكها بعد
    const duePendingFunds = await PendingFund.find({
        isReleased: false,
        releaseAt: { $lte: now }
    }).populate('seller', '_id fullName sellerPendingBalance sellerAvailableBalance') // جلب البائع
        .populate('product', 'title'); // جلب المنتج لاسم المنتج

    if (duePendingFunds.length === 0) {
        console.log("[CRON_JOB_RELEASE_FUNDS] No pending funds due for release.");
        return;
    }

    console.log(`[CRON_JOB_RELEASE_FUNDS] Found ${duePendingFunds.length} pending fund(s) to process.`);

    for (const pendingFund of duePendingFunds) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const seller = pendingFund.seller; // البائع تم جلبه عبر populate

            if (!seller) {
                console.error(`[CRON_JOB_RELEASE_FUNDS] Seller not found for PendingFund ID: ${pendingFund._id}. Skipping.`);
                await session.abortTransaction(); // ألغِ المعاملة لهذا السجل فقط
                errorsCount++;
                continue; // انتقل للسجل التالي
            }

            // التحقق من أن الرصيد المعلق للبائع كافٍ (للأمان الإضافي)
            if (seller.sellerPendingBalance < pendingFund.amountInPlatformCurrency) {
                console.warn(`[CRON_JOB_RELEASE_FUNDS] Seller ${seller._id} has insufficient pending balance (${seller.sellerPendingBalance} ${PLATFORM_BASE_CURRENCY}) for PendingFund ${pendingFund._id} (Amount: ${pendingFund.amountInPlatformCurrency} ${PLATFORM_BASE_CURRENCY}). This might indicate an issue. Skipping for now.`);
                // قد تحتاج لتسجيل هذا كخطأ جسيم للمراجعة
                await session.abortTransaction();
                errorsCount++;
                continue;
            }

            // 1. خصم المبلغ من الرصيد المعلق للبائع
            seller.sellerPendingBalance = parseFloat(((seller.sellerPendingBalance || 0) - pendingFund.amountInPlatformCurrency).toFixed(2));

            // 2. إضافة المبلغ إلى الرصيد المتاح للبائع
            seller.sellerAvailableBalance = parseFloat(((seller.sellerAvailableBalance || 0) + pendingFund.amountInPlatformCurrency).toFixed(2));

            await seller.save({ session });

            // 3. تحديث سجل PendingFund
            pendingFund.isReleased = true;
            pendingFund.releasedToAvailableAt = new Date();

            // 4. إنشاء سجل Transaction لعملية فك التجميد
            const releaseTransaction = new Transaction({
                user: seller._id, // البائع هو المستخدم المرتبط
                type: 'PRODUCT_SALE_FUNDS_RELEASED',
                amount: pendingFund.amount, // المبلغ الأصلي بالعملة الأصلية
                currency: pendingFund.currency,
                // amountInPlatformCurrency: pendingFund.amountInPlatformCurrency, // يمكنك إضافته إذا أردت
                // platformCurrency: PLATFORM_BASE_CURRENCY,
                status: 'COMPLETED',
                description: `Funds from sale of '${pendingFund.product?.title || 'product'}' (Mediation: ${pendingFund.mediationRequest.toString().slice(-6)}) now available.`,
                relatedProduct: pendingFund.product?._id,
                relatedMediationRequest: pendingFund.mediationRequest,
                relatedPendingFund: pendingFund._id // ربط بسجل PendingFund
            });
            await releaseTransaction.save({ session });

            // ربط سجل Transaction بسجل PendingFund
            pendingFund.transactionReleasedId = releaseTransaction._id;
            await pendingFund.save({ session });

            // 5. (اختياري) إرسال إشعار للبائع
            const productTitle = pendingFund.product?.title || 'a previous sale';
            await Notification.create([{
                user: seller._id,
                type: 'FUNDS_NOW_AVAILABLE',
                title: 'Funds Released!',
                message: `Funds amounting to ${formatCurrency(pendingFund.amount, pendingFund.currency)} from the sale of '${productTitle}' are now available in your account.`,
                relatedEntity: { id: pendingFund.mediationRequest, modelName: 'MediationRequest' }
            }], { session });

            await session.commitTransaction();
            console.log(`[CRON_JOB_RELEASE_FUNDS] Successfully released PendingFund ID: ${pendingFund._id} for seller ${seller._id}`);
            fundsReleasedCount++;

            // 6. (اختياري) إرسال حدث Socket.IO لتحديث رصيد البائع في الواجهة الأمامية
            // --- [!!!] هذا هو الجزء الذي تضيفه هنا (داخل الـ loop بعد commit) [!!!] ---
            if (io && onlineUsers && onlineUsers[seller._id.toString()]) {
                const sellerSocketId = onlineUsers[seller._id.toString()];

                // 1. إرسال تحديث البروفايل (الأرصدة)
                // من الأفضل جلب أحدث بيانات للبائع من قاعدة البيانات بعد الـ commit لضمان الدقة
                const freshSellerData = await User.findById(seller._id)
                    .select('balance sellerPendingBalance sellerAvailableBalance reputationPoints level reputationLevel claimedLevelRewards productsSoldCount positiveRatings negativeRatings') // أضف الحقول التي تحتاجها
                    .lean();

                if (freshSellerData) {
                    const profileSummary = {
                        _id: freshSellerData._id.toString(),
                        balance: freshSellerData.balance,
                        sellerPendingBalance: freshSellerData.sellerPendingBalance,
                        sellerAvailableBalance: freshSellerData.sellerAvailableBalance,
                        reputationPoints: freshSellerData.reputationPoints,
                        level: freshSellerData.level,
                        reputationLevel: freshSellerData.reputationLevel,
                        claimedLevelRewards: freshSellerData.claimedLevelRewards,
                        productsSoldCount: freshSellerData.productsSoldCount,
                        positiveRatings: freshSellerData.positiveRatings,
                        negativeRatings: freshSellerData.negativeRatings
                    };
                    io.to(sellerSocketId).emit('user_profile_updated', profileSummary);
                    console.log(`[CRON_JOB_RELEASE_FUNDS] Emitted 'user_profile_updated' to seller ${seller._id}`);
                }

                // 2. إرسال حدث لتحديث سجل المعاملات في الداشبورد
                io.to(sellerSocketId).emit('dashboard_transactions_updated');
                console.log(`[CRON_JOB_RELEASE_FUNDS] Emitted 'dashboard_transactions_updated' to seller ${seller._id}`);
            }
            // --- [!!!] نهاية الجزء الجديد [!!!] ---

        } catch (error) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            console.error(`[CRON_JOB_RELEASE_FUNDS] Error processing PendingFund ID: ${pendingFund._id}. Error: ${error.message}`, error.stack);
            errorsCount++;
        } finally {
            await session.endSession();
        }
    }
    console.log(`[CRON_JOB_RELEASE_FUNDS] Job finished. Released: ${fundsReleasedCount}, Errors: ${errorsCount}.`);
};

module.exports = {
    releaseDuePendingFunds
};