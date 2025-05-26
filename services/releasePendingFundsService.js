// server/services/releasePendingFundsService.js
const mongoose = require('mongoose');
const User = require('../models/User');
const PendingFund = require('../models/PendingFund');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { PLATFORM_BASE_CURRENCY } = require('../config/default'); // افترض أن لديك ملف ثوابت أو عرفه هنا

// دالة مساعدة لتنسيق العملة (يمكن استيرادها من ملف utils مشترك)
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") safeCurrencyCode = "TND";
    try {
        return num.toLocaleString("fr-TN", { style: "currency", currency: safeCurrencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) { return `${num.toFixed(2)} ${safeCurrencyCode}`; }
};

/**
 * يبحث عن الأموال المعلقة التي حان وقت الإفراج عنها ويقوم بمعالجتها.
 */
async function releaseDuePendingFunds() {
    console.log(`[CRON SERVICE] Checking for due pending funds to release at ${new Date().toISOString()}`);
    let fundsReleasedCount = 0;
    let errorsEncountered = 0;

    try {
        const duePendingFunds = await PendingFund.find({
            isReleased: false,
            releaseAt: { $lte: new Date() }
        }).populate('seller', '_id sellerPendingBalance sellerAvailableBalance fullName') // جلب الحقول اللازمة من البائع
            .populate('product', 'title'); // جلب عنوان المنتج

        if (duePendingFunds.length === 0) {
            console.log("[CRON SERVICE] No pending funds are due for release at this time.");
            return { fundsReleasedCount, errorsEncountered };
        }

        console.log(`[CRON SERVICE] Found ${duePendingFunds.length} pending fund(s) due for release.`);

        for (const pendingFund of duePendingFunds) {
            const session = await mongoose.startSession();
            session.startTransaction();
            console.log(`   [CRON SERVICE] Processing pending fund ID: ${pendingFund._id} for seller ID: ${pendingFund.seller._id}`);

            try {
                const seller = pendingFund.seller; // تم جلبه بالفعل مع populate

                if (!seller) {
                    console.error(`   [CRON SERVICE] ERROR: Seller not found for pendingFund ID: ${pendingFund._id}. Skipping.`);
                    await session.abortTransaction(); // ألغِ المعاملة لهذا السجل
                    errorsEncountered++;
                    continue; // انتقل للسجل التالي
                }

                // التحقق من أن المبلغ المعلق لا يتجاوز الرصيد المعلق الفعلي للبائع (للأمان)
                if (pendingFund.amountInPlatformCurrency > (seller.sellerPendingBalance || 0)) {
                    console.warn(`   [CRON SERVICE] WARNING: Pending fund amount (${pendingFund.amountInPlatformCurrency}) for seller ${seller._id} is greater than current sellerPendingBalance (${seller.sellerPendingBalance || 0}). This might indicate an issue or previous partial release. Clamping amount.`);
                    // يمكنك هنا أن تقرر كيفية التعامل مع هذا. هل تفترض أن المبلغ الصحيح هو sellerPendingBalance؟
                    // أو تمنع العملية؟ للآن، سنستمر مع amountInPlatformCurrency من pendingFund.
                    // إذا كان هذا يحدث بشكل متكرر، يجب مراجعة منطق تحديث sellerPendingBalance.
                }

                const amountToRelease = pendingFund.amountInPlatformCurrency;

                // 1. تحديث أرصدة البائع
                seller.sellerPendingBalance = parseFloat(((seller.sellerPendingBalance || 0) - amountToRelease).toFixed(2));
                if (seller.sellerPendingBalance < 0) seller.sellerPendingBalance = 0; // ضمان عدم السلبية

                seller.sellerAvailableBalance = parseFloat(((seller.sellerAvailableBalance || 0) + amountToRelease).toFixed(2));

                await seller.save({ session });
                console.log(`      [CRON SERVICE] Seller ${seller._id} balances updated: Pending: ${seller.sellerPendingBalance}, Available: ${seller.sellerAvailableBalance}`);

                // 2. تحديث سجل PendingFund
                pendingFund.isReleased = true;
                pendingFund.releasedToAvailableAt = new Date();

                // 3. إنشاء سجل Transaction لفك التجميد
                const releaseTransaction = new Transaction({
                    user: seller._id,
                    type: 'PRODUCT_SALE_FUNDS_RELEASED',
                    amount: pendingFund.amount, // المبلغ الأصلي
                    currency: pendingFund.currency, // العملة الأصلية
                    // amountInPlatformCurrency: amountToRelease, // يمكنك إضافة هذا إذا أردت
                    // platformCurrency: PLATFORM_BASE_CURRENCY,
                    status: 'COMPLETED',
                    description: `Funds from sale of '${pendingFund.product?.title || 'product'}' (Mediation: ${pendingFund.mediationRequest.toString().slice(-6)}) now available.`,
                    relatedProduct: pendingFund.product?._id,
                    relatedMediationRequest: pendingFund.mediationRequest,
                    relatedPendingFund: pendingFund._id // ربط بسجل PendingFund
                });
                await releaseTransaction.save({ session });
                console.log(`      [CRON SERVICE] Transaction (PRODUCT_SALE_FUNDS_RELEASED) created: ${releaseTransaction._id}`);

                pendingFund.transactionReleasedId = releaseTransaction._id; // ربط سجل فك التجميد
                await pendingFund.save({ session });
                console.log(`      [CRON SERVICE] PendingFund record ID: ${pendingFund._id} marked as released.`);

                // 4. (اختياري) إرسال إشعار للبائع
                const productTitle = pendingFund.product?.title || 'a previous sale';
                await Notification.create([{
                    user: seller._id,
                    type: 'FUNDS_AVAILABLE_FOR_WITHDRAWAL',
                    title: 'Funds Released!',
                    message: `Funds amounting to ${formatCurrency(pendingFund.amount, pendingFund.currency)} from the sale of '${productTitle}' are now available in your withdrawable balance.`,
                    relatedEntity: { id: pendingFund.mediationRequest, modelName: 'MediationRequest' }
                }], { session });
                console.log(`      [CRON SERVICE] Notification sent to seller ${seller._id} for funds release.`);

                await session.commitTransaction();
                console.log(`   [CRON SERVICE] Successfully released funds for pendingFund ID: ${pendingFund._id}`);
                fundsReleasedCount++;

                // 5. (اختياري) إرسال حدث Socket.IO لتحديث واجهة البائع
                // هذا يتطلب تمرير io و onlineUsers لهذه الدالة إذا كنت ستفعل ذلك من هنا
                // أو يمكن أن يتم من مكان آخر يراقب تغييرات Transaction أو User
                // if (io && onlineUsers && onlineUsers[seller._id.toString()]) {
                //     io.to(onlineUsers[seller._id.toString()]).emit('user_profile_updated', {
                //         _id: seller._id.toString(),
                //         sellerPendingBalance: seller.sellerPendingBalance,
                //         sellerAvailableBalance: seller.sellerAvailableBalance,
                //         // ... أي بيانات أخرى ذات صلة بالملف الشخصي
                //     });
                // }

            } catch (error) {
                console.error(`   [CRON SERVICE] ERROR processing pendingFund ID: ${pendingFund._id}. Rolling back transaction. Error:`, error);
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                errorsEncountered++;
            } finally {
                await session.endSession();
            }
        } // نهاية حلقة for

    } catch (error) {
        console.error("[CRON SERVICE] CRITICAL ERROR fetching or iterating due pending funds:", error);
        errorsEncountered++;
    }
    console.log(`[CRON SERVICE] Finished. Released: ${fundsReleasedCount}, Errors: ${errorsEncountered}`);
    return { fundsReleasedCount, errorsEncountered };
}

module.exports = {
    releaseDuePendingFunds
};