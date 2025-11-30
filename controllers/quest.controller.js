const User = require('../models/User');
const Quest = require('../models/Quest');
const UserQuest = require('../models/UserQuest');
const { triggerQuestEvent } = require('../services/questService');
const mongoose = require('mongoose');
const { updateUserLevelAndBadge, processLevelUpRewards } = require('./rating.controller');
const SystemSetting = require('../models/SystemSetting');
const SpinHistory = require('../models/SpinHistory');
const Transaction = require('../models/Transaction');

const DEFAULT_REWARDS = [10, 20, 30, 40, 50, 60, 100];
const SPIN_COST = 100;

// ... (باقي الثوابت ودوال الإعدادات getCheckInConfig كما هي) ...
const DEFAULT_WHEEL_CONFIG = [
    { type: 'credits', amount: 50, chance: 30, color: '#e74c3c', text: '50 Credits' },
    { type: 'credits', amount: 150, chance: 30, color: '#2ecc71', text: '150 Credits' },
    { type: 'xp', amount: 10, chance: 20, color: '#3498db', text: '10 XP' },
    { type: 'balance', amount: 1, chance: 5, color: '#f1c40f', text: '1 TND' },
    { type: 'empty', amount: 0, chance: 15, color: '#95a5a6', text: 'Hard Luck' }
];

const getCheckInConfig = async () => {
    let setting = await SystemSetting.findOne({ key: 'daily_check_in_rewards' });
    if (!setting) {
        setting = await SystemSetting.create({
            key: 'daily_check_in_rewards',
            value: DEFAULT_REWARDS,
            description: 'Array of credits for daily check-in rewards'
        });
    }
    return setting.value;
};

// ... (getWheelConfigData, adminUpdateCheckInConfig, adminGetCheckInConfig كما هي) ...
const getWheelConfigData = async () => {
    let setting = await SystemSetting.findOne({ key: 'lucky_wheel_config' });
    if (!setting) {
        setting = await SystemSetting.create({
            key: 'lucky_wheel_config',
            value: DEFAULT_WHEEL_CONFIG,
            description: 'Lucky Wheel Segments Configuration'
        });
    }
    return setting.value;
};

const adminUpdateCheckInConfig = async (req, res) => {
    try {
        await SystemSetting.findOneAndUpdate(
            { key: 'daily_check_in_rewards' },
            { $set: { value: req.body.rewards } },
            { upsert: true }
        );
        if (req.io) req.io.emit('check_in_config_updated', req.body.rewards);
        res.status(200).json({ msg: "Updated" });
    } catch (e) { res.status(500).json({ msg: "Error" }); }
};

const adminGetCheckInConfig = async (req, res) => {
    try { res.status(200).json(await getCheckInConfig()); } catch (e) { res.status(500).json({ msg: "Error" }); }
};

const adminUpdateWheelConfig = async (req, res) => {
    try {
        await SystemSetting.findOneAndUpdate(
            { key: 'lucky_wheel_config' },
            { $set: { value: req.body.segments } },
            { upsert: true }
        );
        if (req.io) req.io.emit('wheel_config_updated', req.body.segments);
        res.status(200).json({ msg: "Updated" });
    } catch (e) { res.status(500).json({ msg: "Error" }); }
};

const getWheelConfig = async (req, res) => {
    try { res.status(200).json(await getWheelConfigData()); } catch (e) { res.status(500).json({ msg: "Error" }); }
};


// [!!!] دالة مساعدة لمقارنة التواريخ بدقة (تتجاهل الوقت) [!!!]
const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

const isYesterday = (lastDate, nowDate) => {
    // ننشئ نسخة لتجنب تعديل الأصل
    const yesterday = new Date(nowDate);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(lastDate, yesterday);
};


// --- Perform Daily Check-In (المصححة) ---
const performDailyCheckIn = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: "User not found" });

        const rewardsConfig = await getCheckInConfig();
        const cycleLength = rewardsConfig.length;

        const now = new Date();
        const lastCheckIn = user.dailyCheckIn.lastCheckInDate ? new Date(user.dailyCheckIn.lastCheckInDate) : null;

        // 1. التحقق من التكرار في نفس اليوم
        if (lastCheckIn && isSameDay(lastCheckIn, now)) {
            return res.status(400).json({ msg: "Already checked in today." });
        }

        let newStreak = user.dailyCheckIn.streak || 0;

        // 2. منطق حساب الـ Streak الجديد
        if (lastCheckIn) {
            if (isYesterday(lastCheckIn, now)) {
                // إذا كان آخر تسجيل هو الأمس تماماً -> زيادة العداد
                newStreak += 1;
            } else {
                // إذا فاته يوم أو أكثر -> إعادة تعيين لـ 1
                newStreak = 1;
            }
        } else {
            // أول مرة يسجل فيها
            newStreak = 1;
        }

        // 3. تحديد المكافأة بناءً على العداد الجديد
        // ملاحظة: العداد 1 يعني الاندكس 0 (اليوم الأول)
        let dayIndex = (newStreak - 1) % cycleLength;
        const rewardCredits = rewardsConfig[dayIndex];

        // تحديث بيانات المستخدم
        user.dailyCheckIn.streak = newStreak;
        user.dailyCheckIn.lastCheckInDate = now;
        user.dailyCheckIn.claimedToday = true;
        user.credits = (user.credits || 0) + rewardCredits;

        await user.save();
        await triggerQuestEvent(userId, 'CHECK_IN', req.io, req.onlineUsers);

        res.status(200).json({
            msg: "Check-in successful!",
            reward: rewardCredits,
            streak: newStreak,
            totalCredits: user.credits,
            nextReset: cycleLength
        });

    } catch (error) {
        console.error("Check-in Error:", error);
        res.status(500).json({ msg: "Server error during check-in." });
    }
};

// ... (دوال العجلة spinWheel وباقي الملف كما هو دون تغيير، فقط تأكد أن spinWheel تستخدم Transaction كما في الرد السابق) ...
const spinWheel = async (req, res) => {
    const userId = req.user._id;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if ((user.credits || 0) < SPIN_COST) {
            await session.abortTransaction();
            return res.status(400).json({ msg: "Insufficient credits." });
        }

        user.credits -= SPIN_COST;

        const items = await getWheelConfigData();
        const totalChance = items.reduce((sum, item) => sum + Number(item.chance), 0);
        let random = Math.random() * totalChance;
        let selectedItem = items[0];

        for (const item of items) {
            if (random < item.chance) {
                selectedItem = item;
                break;
            }
            random -= item.chance;
        }

        const amount = Number(selectedItem.amount);

        if (selectedItem.type === 'credits') {
            user.credits += amount;
        } 
        else if (selectedItem.type === 'xp') {
            const oldLevel = user.level;
            user.reputationPoints = (user.reputationPoints || 0) + amount;
            updateUserLevelAndBadge(user);
            await processLevelUpRewards(user, oldLevel, req, session);
        } 
        else if (selectedItem.type === 'balance') {
            user.balance = (user.balance || 0) + amount;
            const rewardTransaction = new Transaction({
                user: userId,
                type: 'LUCKY_WHEEL_REWARD',
                amount: amount,
                currency: 'TND',
                status: 'COMPLETED',
                descriptionKey: 'transactionDescriptions.luckyWheelReward',
                descriptionParams: { amount: amount },
                description: `Won ${amount} TND from Lucky Wheel`
            });
            await rewardTransaction.save({ session });
        }

        await SpinHistory.create([{
            user: userId,
            cost: SPIN_COST,
            reward: {
                type: selectedItem.type,
                amount: amount
            }
        }], { session });

        await user.save({ session });
        await session.commitTransaction();

        if (req.io && req.onlineUsers[userId.toString()]) {
            const socketId = req.onlineUsers[userId.toString()];
            req.io.to(socketId).emit('user_profile_updated', {
                _id: userId,
                credits: user.credits,
                balance: user.balance,
                reputationPoints: user.reputationPoints,
                level: user.level,
                reputationLevel: user.reputationLevel
            });
            if (selectedItem.type === 'balance') {
                req.io.to(socketId).emit('dashboard_transactions_updated');
            }
        }

        res.status(200).json({
            msg: "Spin successful!",
            reward: selectedItem,
            remainingCredits: user.credits,
            newBalance: user.balance
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(500).json({ msg: "Server error during spin." });
    } finally {
        session.endSession();
    }
};

const claimQuestReward = async (req, res) => {
    const userId = req.user._id;
    const { questId } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userQuest = await UserQuest.findOne({ user: userId, quest: questId }).populate('quest').session(session);
        if (!userQuest || !userQuest.isCompleted || userQuest.isClaimed) throw new Error("Invalid claim request.");

        const user = await User.findById(userId).session(session);
        if (userQuest.quest.reward.credits > 0) user.credits = (user.credits || 0) + userQuest.quest.reward.credits;
        if (userQuest.quest.reward.xp > 0) {
            const oldLevel = user.level;
            user.reputationPoints = (user.reputationPoints || 0) + userQuest.quest.reward.xp;
            updateUserLevelAndBadge(user);
            await processLevelUpRewards(user, oldLevel, req, session);
        }

        userQuest.isClaimed = true;
        await userQuest.save({ session });
        await user.save({ session });
        await session.commitTransaction();

        if (req.io && req.onlineUsers[userId.toString()]) {
            req.io.to(req.onlineUsers[userId.toString()]).emit('user_profile_updated', {
                _id: user._id, credits: user.credits, reputationPoints: user.reputationPoints,
                level: user.level, balance: user.balance, reputationLevel: user.reputationLevel
            });
        }
        res.status(200).json({ msg: "Reward claimed", credits: user.credits });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        res.status(500).json({ msg: error.message });
    } finally { session.endSession(); }
};

const getUserQuests = async (req, res) => {
    const userId = req.user._id;
    try {
        const user = await User.findById(userId).select('credits dailyCheckIn');
        const allQuests = await Quest.find({ isActive: true }).lean();
        const userProgress = await UserQuest.find({ user: userId }).lean();
        const questsWithProgress = allQuests.map(quest => {
            const progress = userProgress.find(up => up.quest.toString() === quest._id.toString());
            return {
                ...quest,
                progress: progress ? progress.progress : 0,
                isCompleted: progress ? progress.isCompleted : false,
                isClaimed: progress ? progress.isClaimed : false,
                userQuestId: progress ? progress._id : null
            };
        });
        res.status(200).json({ credits: user.credits, checkIn: user.dailyCheckIn, quests: questsWithProgress });
    } catch (error) { res.status(500).json({ msg: "Error fetching quests" }); }
};

const getSpinHistory = async (req, res) => {
    try {
        const history = await SpinHistory.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
        res.status(200).json(history);
    } catch (e) { res.status(500).json({ msg: "Error" }); }
};

const fillMissingLanguages = (obj) => {
    if (!obj.en || obj.en.trim() === "") obj.en = obj.ar;
    if (!obj.fr || obj.fr.trim() === "") obj.fr = obj.ar;
    if (!obj.tn || obj.tn.trim() === "") obj.tn = obj.ar;
    return obj;
};

const adminCreateQuest = async (req, res) => {
    let { title, description, ...rest } = req.body;
    try {
        if (title && title.ar) title = fillMissingLanguages(title);
        if (description && description.ar) description = fillMissingLanguages(description);
        const newQuest = new Quest({ title, description, ...rest });
        await newQuest.save();
        if (req.io) req.io.emit('quests_updated');
        res.status(201).json(newQuest);
    } catch (e) { res.status(500).json({ msg: e.message }); }
};

const adminUpdateQuest = async (req, res) => {
    let updateData = req.body;
    try {
        if (updateData.title && updateData.title.ar) updateData.title = fillMissingLanguages(updateData.title);
        if (updateData.description && updateData.description.ar) updateData.description = fillMissingLanguages(updateData.description);
        const updated = await Quest.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (req.io) req.io.emit('quests_updated');
        res.status(200).json(updated);
    } catch (e) { res.status(500).json({ msg: "Error" }); }
};

const adminDeleteQuest = async (req, res) => {
    try {
        await Quest.findByIdAndDelete(req.params.id);
        await UserQuest.deleteMany({ quest: req.params.id });
        if (req.io) req.io.emit('quests_updated');
        res.status(200).json({ msg: "Deleted" });
    } catch (e) { res.status(500).json({ msg: "Error" }); }
};

const adminGetAllQuests = async (req, res) => {
    try { res.status(200).json(await Quest.find().sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ msg: "Error" }); }
};

module.exports = {
    performDailyCheckIn, spinWheel, getUserQuests, claimQuestReward,
    adminCreateQuest, adminGetAllQuests, adminUpdateQuest, adminDeleteQuest,
    adminUpdateCheckInConfig, adminGetCheckInConfig, getSpinHistory,
    adminUpdateWheelConfig, getWheelConfig
};