// server/services/pendingFundsReleaseService.js
const mongoose = require('mongoose');
const User = require('../models/User');
const PendingFund = require('../models/PendingFund');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const config = require('config');

const PLATFORM_BASE_CURRENCY = config.get('PLATFORM_BASE_CURRENCY') || 'TND';

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

const releaseDuePendingFunds = async (io, onlineUsers) => { // <<< استقبال io و onlineUsers
    console.log(`[CRON_JOB_RELEASE_FUNDS] Starting job at ${new Date().toISOString()}`);
    const now = new Date();
    let fundsReleasedCount = 0;
    let errorsCount = 0;

    const duePendingFunds = await PendingFund.find({
        isReleased: false,
        releaseAt: { $lte: now }
    }).populate('seller', '_id fullName sellerPendingBalance sellerAvailableBalance balance depositBalance withdrawalBalance level reputationPoints reputationLevel claimedLevelRewards productsSoldCount positiveRatings negativeRatings')
        .populate('product', 'title');

    if (duePendingFunds.length === 0) {
        console.log("[CRON_JOB_RELEASE_FUNDS] No pending funds due for release.");
        return { fundsReleasedCount, errorsCount };
    }

    console.log(`[CRON_JOB_RELEASE_FUNDS] Found ${duePendingFunds.length} pending fund(s) to process.`);

    for (const pendingFund of duePendingFunds) {
        const session = await mongoose.startSession();
        session.startTransaction();
        console.log(`   [CRON_JOB_RELEASE_FUNDS] Processing PendingFund ID: ${pendingFund._id} for seller ${pendingFund.seller?._id}`);

        try {
            const seller = pendingFund.seller;

            if (!seller) {
                console.error(`   [CRON_JOB_RELEASE_FUNDS] Seller not found for PendingFund ID: ${pendingFund._id}. Skipping.`);
                await session.abortTransaction();
                errorsCount++;
                continue;
            }

            if (typeof seller.sellerPendingBalance !== 'number') {
                seller.sellerPendingBalance = 0;
                console.warn(`   [CRON_JOB_RELEASE_FUNDS] Seller ${seller._id} sellerPendingBalance was not a number, defaulted to 0.`);
            }
            if (typeof pendingFund.amountInPlatformCurrency !== 'number' || isNaN(pendingFund.amountInPlatformCurrency)) {
                console.error(`   [CRON_JOB_RELEASE_FUNDS] PendingFund ${pendingFund._id} amountInPlatformCurrency is not a number or NaN: ${pendingFund.amountInPlatformCurrency}. Skipping.`);
                await session.abortTransaction();
                errorsCount++;
                continue;
            }

            const amountToReleaseFromPending = Math.min(seller.sellerPendingBalance, pendingFund.amountInPlatformCurrency);
            if (amountToReleaseFromPending <= 0 && pendingFund.amountInPlatformCurrency > 0) {
                console.warn(`   [CRON_JOB_RELEASE_FUNDS] Amount to release from pending for seller ${seller._id} is zero or negative (${amountToReleaseFromPending}), but pending fund amount is positive (${pendingFund.amountInPlatformCurrency}). PendingFund ID: ${pendingFund._id}. Skipping.`);
                await session.abortTransaction();
                errorsCount++;
                continue;
            }

            seller.sellerPendingBalance = parseFloat(((seller.sellerPendingBalance || 0) - amountToReleaseFromPending).toFixed(2));
            if (seller.sellerPendingBalance < 0) seller.sellerPendingBalance = 0;

            if (typeof seller.sellerAvailableBalance !== 'number') seller.sellerAvailableBalance = 0;
            seller.sellerAvailableBalance = parseFloat(((seller.sellerAvailableBalance || 0) + amountToReleaseFromPending).toFixed(2));

            await seller.save({ session });
            console.log(`      [CRON_JOB_RELEASE_FUNDS] Seller ${seller._id} balances updated: Pending: ${seller.sellerPendingBalance}, Available: ${seller.sellerAvailableBalance}`);

            pendingFund.isReleased = true;
            pendingFund.releasedToAvailableAt = new Date();

            const releaseTransaction = new Transaction({
                user: seller._id,
                type: 'PRODUCT_SALE_FUNDS_RELEASED',
                amount: pendingFund.amount,
                currency: pendingFund.currency,
                amountInPlatformCurrency: pendingFund.amountInPlatformCurrency,
                platformCurrency: PLATFORM_BASE_CURRENCY,
                status: 'COMPLETED',
                description: `Funds from sale of '${pendingFund.product?.title || 'product'}' (Mediation: ${pendingFund.mediationRequest.toString().slice(-6)}) now available.`,
                relatedProduct: pendingFund.product?._id,
                relatedMediationRequest: pendingFund.mediationRequest,
                relatedPendingFund: pendingFund._id
            });
            await releaseTransaction.save({ session });
            console.log(`      [CRON_JOB_RELEASE_FUNDS] Transaction (PRODUCT_SALE_FUNDS_RELEASED) created: ${releaseTransaction._id}`);

            pendingFund.transactionReleasedId = releaseTransaction._id;
            await pendingFund.save({ session });
            console.log(`      [CRON_JOB_RELEASE_FUNDS] PendingFund record ID: ${pendingFund._id} marked as released.`);

            const productTitle = pendingFund.product?.title || 'a previous sale';
            await Notification.create([{
                user: seller._id,
                type: 'FUNDS_NOW_AVAILABLE',
                title: 'Funds Released!',
                message: `Funds amounting to ${formatCurrency(pendingFund.amount, pendingFund.currency)} from the sale of '${productTitle}' are now available in your account.`,
                relatedEntity: { id: pendingFund.mediationRequest, modelName: 'MediationRequest' }
            }], { session });
            console.log(`      [CRON_JOB_RELEASE_FUNDS] Notification sent to seller ${seller._id} for funds release.`);

            await session.commitTransaction();
            console.log(`   [CRON_JOB_RELEASE_FUNDS] Successfully released PendingFund ID: ${pendingFund._id} for seller ${seller._id}`);
            fundsReleasedCount++;

            if (io && onlineUsers && onlineUsers[seller._id.toString()]) {
                const sellerSocketId = onlineUsers[seller._id.toString()];

                const freshSellerBalances = await User.findById(seller._id)
                    .select('balance sellerPendingBalance sellerAvailableBalance')
                    .lean();

                if (freshSellerBalances) {
                    const balancesPayload = {
                        _id: seller._id.toString(),
                        balance: freshSellerBalances.balance,
                        sellerPendingBalance: freshSellerBalances.sellerPendingBalance,
                        sellerAvailableBalance: freshSellerBalances.sellerAvailableBalance,
                    };
                    io.to(sellerSocketId).emit('user_balances_updated', balancesPayload); // <<< إرسال الحدث
                    console.log(`      [CRON_JOB_RELEASE_FUNDS] Emitted 'user_balances_updated' to seller ${seller._id} with payload:`, balancesPayload);
                } else {
                    console.warn(`      [CRON_JOB_RELEASE_FUNDS] Could not fetch fresh seller balances for socket update (ID: ${seller._id})`);
                }

                io.to(sellerSocketId).emit('dashboard_transactions_updated');
                console.log(`      [CRON_JOB_RELEASE_FUNDS] Emitted 'dashboard_transactions_updated' to seller ${seller._id} via socket ${sellerSocketId}`);
            } else {
                console.log(`      [CRON_JOB_RELEASE_FUNDS] Seller ${seller._id} is not online or io/onlineUsers not available. Skipping socket emit for balances.`);
            }

        } catch (error) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            console.error(`   [CRON_JOB_RELEASE_FUNDS] Error processing PendingFund ID: ${pendingFund._id}. Error: ${error.message}`, error.stack);
            errorsCount++;
        } finally {
            await session.endSession();
        }
    }
    console.log(`[CRON_JOB_RELEASE_FUNDS] Job finished. Released: ${fundsReleasedCount}, Errors: ${errorsCount}.`);
    return { fundsReleasedCount, errorsCount };
};

module.exports = {
    releaseDuePendingFunds
};