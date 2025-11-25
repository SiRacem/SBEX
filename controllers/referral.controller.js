// server/controllers/referral.controller.js

const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// 1. ربط المستخدم بكود إحالة (Bind Referral)
exports.bindReferralCode = async (req, res) => {
    const userId = req.user._id;
    const { referralCode } = req.body;

    if (!referralCode) return res.status(400).json({ msg: "Referral code is required." });

    try {
        const user = await User.findById(userId);
        
        // شروط الربط:
        // 1. المستخدم لم يتم ربطه من قبل.
        if (user.referredBy) {
            return res.status(400).json({ msg: "You have already been referred by someone." });
        }
        
        // 2. لا يمكن للمستخدم إدخال كوده الخاص.
        if (user.referralCode === referralCode) {
            return res.status(400).json({ msg: "You cannot use your own referral code." });
        }

        // البحث عن صاحب الكود (الداعي)
        const referrer = await User.findOne({ referralCode });
        if (!referrer) {
            return res.status(404).json({ msg: "Invalid referral code." });
        }

        // الربط
        user.referredBy = referrer._id;
        await user.save();

        // (اختياري) إرسال إشعار للداعي
        // لكننا اتفقنا أن المكافأة تأتي عند الإيداع، لذا لا داعي لإشعار الآن،
        // أو يمكن إرسال إشعار "شخص ما استخدم كودك" كنوع من التحفيز المعنوي.

        res.status(200).json({ msg: "Referral code linked successfully!", referrerName: referrer.fullName });

    } catch (error) {
        console.error("Bind Referral Error:", error);
        res.status(500).json({ msg: "Server error." });
    }
};

// 2. تحويل رصيد الإحالات (Transfer Referral Balance)
exports.transferReferralBalance = async (req, res) => {
    const userId = req.user._id;
    const { amount } = req.body;
    const numericAmount = Number(amount);

    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ msg: "Invalid amount." });
    }

    const session = await User.startSession();
    session.startTransaction();

    try {
        // جلب الإعدادات
        const settingsDoc = await SystemSetting.findOne({ key: 'referral_config' });
        const config = settingsDoc ? settingsDoc.value : { minTransferAmount: 30, transferFee: 2 };

        if (numericAmount < config.minTransferAmount) {
            throw new Error(`Minimum transfer amount is ${config.minTransferAmount} TND.`);
        }

        const user = await User.findById(userId).session(session);

        if (user.referralBalance < numericAmount) {
            throw new Error("Insufficient referral balance.");
        }

        // حساب الرسوم والصافي
        const feeAmount = (numericAmount * config.transferFee) / 100;
        const netAmount = numericAmount - feeAmount;

        // تنفيذ التحويل
        user.referralBalance -= numericAmount;
        user.balance += netAmount;
        await user.save({ session });

        // تسجيل المعاملة
        const transaction = new Transaction({
            user: userId,
            type: 'REFERRAL_BALANCE_TRANSFER',
            amount: netAmount,
            currency: 'TND',
            status: 'COMPLETED',
            
            descriptionKey: 'transactionDescriptions.referralBalanceTransfer',
            descriptionParams: {
                fee: feeAmount.toFixed(2),
                percent: config.transferFee
            },
            metadata: {
                grossAmount: numericAmount,
                fee: feeAmount
            }
        });
        await transaction.save({ session });

        await session.commitTransaction();

        // تحديث الواجهة
        if (req.io && req.onlineUsers && req.onlineUsers[userId]) {
             req.io.to(req.onlineUsers[userId]).emit('user_profile_updated', {
                _id: userId,
                balance: user.balance,
                referralBalance: user.referralBalance
            });
        }

        res.status(200).json({ 
            msg: "Transfer successful!", 
            netAmount, 
            newMainBalance: user.balance,
            newReferralBalance: user.referralBalance
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ msg: error.message || "Transfer failed." });
    } finally {
        session.endSession();
    }
};

// 3. جلب إحصائيات الإحالة (Get Referral Stats)
exports.getMyReferralStats = async (req, res) => {
    const userId = req.user._id;

    try {
        // جلب المستخدمين الذين دعاهم هذا المستخدم
        const referrals = await User.find({ referredBy: userId })
            .select('fullName avatarUrl createdAt isReferralActive earningsGeneratedForReferrer') // isReferralActive نحتاج إضافته في User model لتتبع من قام بنشاط
            .sort({ createdAt: -1 })
            .lean();

        // جلب إعدادات النسبة الحالية للعرض
        const settingsDoc = await SystemSetting.findOne({ key: 'referral_config' });
        
        // إحصائيات
        const user = await User.findById(userId).select('referralCode referralBalance totalReferralEarnings referralsCount');

        res.status(200).json({
            referralCode: user.referralCode,
            referralBalance: user.referralBalance,
            totalEarnings: user.totalReferralEarnings,
            referralsCount: user.referralsCount || referrals.length, // أو نعتمد على طول المصفوفة
            referralsList: referrals,
            config: settingsDoc ? settingsDoc.value : {}
        });

    } catch (error) {
        console.error("Get Referral Stats Error:", error);
        res.status(500).json({ msg: "Server error." });
    }
};

// 4. جلب الإعدادات (للأدمن)
exports.getReferralSettings = async (req, res) => {
    try {
        const settingsDoc = await SystemSetting.findOne({ key: 'referral_config' });
        res.json(settingsDoc ? settingsDoc.value : { commissionRate: 1, minTransferAmount: 30, transferFee: 2 });
    } catch (error) {
        res.status(500).json({ msg: "Error fetching settings" });
    }
};

// 5. تحديث الإعدادات (للأدمن)
exports.updateReferralSettings = async (req, res) => {
    const { commissionRate, minTransferAmount, transferFee } = req.body;
    
    // تحقق بسيط
    if (commissionRate < 0 || minTransferAmount < 0 || transferFee < 0) {
        return res.status(400).json({ msg: "Values cannot be negative." });
    }

    try {
        const updatedSettings = await SystemSetting.findOneAndUpdate(
            { key: 'referral_config' },
            { 
                value: { 
                    commissionRate: Number(commissionRate), 
                    minTransferAmount: Number(minTransferAmount), 
                    transferFee: Number(transferFee) 
                } 
            },
            { new: true, upsert: true } // upsert: ينشئها إذا لم تكن موجودة
        );
        res.json({ msg: "Settings updated successfully!", settings: updatedSettings.value });
    } catch (error) {
        res.status(500).json({ msg: "Error updating settings" });
    }
};