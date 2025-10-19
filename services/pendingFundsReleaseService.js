// server/services/pendingFundsReleaseService.js
const mongoose = require('mongoose');
const User = require('../models/User');
const PendingFund = require('../models/PendingFund');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const config = require('config');

const PLATFORM_BASE_CURRENCY = config.get('PLATFORM_BASE_CURRENCY') || 'TND';

// دالة مساعدة لتنسيق العملة
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") safeCurrencyCode = "TND";
    try {
        return num.toLocaleString("fr-TN", { style: "currency", currency: safeCurrencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) { return `${num.toFixed(2)} ${safeCurrencyCode}`; }
};

const releaseDuePendingFunds = async (io, onlineUsers) => {
    console.log(`[CRON_JOB_RELEASE_FUNDS] Starting job at ${new Date().toISOString()}`);
    const now = new Date();
    let fundsReleasedCount = 0;
    let errorsCount = 0;

    const duePendingFunds = await PendingFund.find({
        isReleased: false,
        releaseAt: { $lte: now }
    }).populate('seller', '_id fullName sellerPendingBalance sellerAvailableBalance balance')
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

            if (typeof pendingFund.amountInPlatformCurrency !== 'number' || isNaN(pendingFund.amountInPlatformCurrency)) {
                console.error(`   [CRON_JOB_RELEASE_FUNDS] PendingFund ${pendingFund._id} amountInPlatformCurrency is invalid. Skipping.`);
                await session.abortTransaction();
                errorsCount++;
                continue;
            }

            // [تحسين] التحقق من تطابق الأرصدة
            if (pendingFund.amountInPlatformCurrency > (seller.sellerPendingBalance || 0)) {
                console.warn(`   [CRON WARNING] Pending fund amount (${pendingFund.amountInPlatformCurrency}) for seller ${seller._id} is greater than their current pending balance (${seller.sellerPendingBalance || 0}). This may indicate a data inconsistency. Proceeding with the smaller amount.`);
            }
            const amountToReleaseFromPending = Math.min(seller.sellerPendingBalance, pendingFund.amountInPlatformCurrency);

            // تحديث أرصدة البائع
            seller.sellerPendingBalance = parseFloat(((seller.sellerPendingBalance || 0) - amountToReleaseFromPending).toFixed(2));
            if (seller.sellerPendingBalance < 0) seller.sellerPendingBalance = 0;
            seller.sellerAvailableBalance = parseFloat(((seller.sellerAvailableBalance || 0) + amountToReleaseFromPending).toFixed(2));
            await seller.save({ session });

            // تحديث سجل PendingFund
            pendingFund.isReleased = true;
            pendingFund.releasedToAvailableAt = new Date();

            // إنشاء سجل Transaction للإفراج
            const releaseTransaction = new Transaction({
                user: seller._id,
                type: 'PRODUCT_SALE_FUNDS_RELEASED',
                amount: pendingFund.amount,
                currency: pendingFund.currency,
                status: 'COMPLETED',
                descriptionKey: 'transactionDescriptions.saleFundsReleased', // <-- تعديل
                descriptionParams: { productName: pendingFund.product?.title || 'product' }, // <-- إضافة
                description: `Funds from sale of '${pendingFund.product?.title || 'product'}' now available.`, // قيمة احتياطية
                relatedProduct: pendingFund.product?._id,
                relatedMediationRequest: pendingFund.mediationRequest,
            });
            await releaseTransaction.save({ session });
            pendingFund.transactionReleasedId = releaseTransaction._id;
            await pendingFund.save({ session });

            // إنشاء الإشعار بمفاتيح الترجمة
            const notification = await Notification.create([{
                user: seller._id,
                type: 'FUNDS_NOW_AVAILABLE',
                title: 'notification_titles.FUNDS_NOW_AVAILABLE',
                message: 'notification_messages.FUNDS_NOW_AVAILABLE',
                messageParams: {
                    amount: formatCurrency(pendingFund.amount, pendingFund.currency),
                    productName: pendingFund.product?.title || 'a previous sale'
                },
                relatedEntity: { id: pendingFund.product?._id, modelName: 'Product' }
            }], { session });

            await session.commitTransaction();
            fundsReleasedCount++;

            // إرسال تحديثات Socket.IO للمستخدم المتصل
            if (io && onlineUsers && onlineUsers[seller._id.toString()]) {
                const sellerSocketId = onlineUsers[seller._id.toString()];
                
                // [تحسين] إرسال تحديث كامل للأرصدة
                io.to(sellerSocketId).emit('user_balances_updated', {
                    _id: seller._id.toString(),
                    balance: seller.balance,
                    sellerPendingBalance: seller.sellerPendingBalance,
                    sellerAvailableBalance: seller.sellerAvailableBalance,
                });
                
                // [تحسين] إرسال إشعار فوري وتحديث قائمة المعاملات
                io.to(sellerSocketId).emit('new_notification', notification[0].toObject());
                io.to(sellerSocketId).emit('dashboard_transactions_updated');
            }

        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
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