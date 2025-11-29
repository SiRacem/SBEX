const User = require('../models/User');
const Quest = require('../models/Quest');
const UserQuest = require('../models/UserQuest');
const Notification = require('../models/Notification');
const { triggerQuestEvent } = require('../services/questService');
const mongoose = require('mongoose');
const { updateUserLevelAndBadge, processLevelUpRewards } = require('./rating.controller');
const SystemSetting = require('../models/SystemSetting');
const SpinHistory = require('../models/SpinHistory');
const Transaction = require('../models/Transaction'); // لتسجيل المعاملة المالية

// إعدادات جوائز الـ Check-in لمدة 7 أيام (Credits)
const DEFAULT_REWARDS = [10, 20, 30, 40, 50, 60, 100];
const SPIN_COST = 100; // تكلفة اللفة الواحدة

// الإعدادات الافتراضية للعجلة (في حال لم يقم الأدمن بضبطها)
const DEFAULT_WHEEL_CONFIG = [
    { type: 'credits', amount: 50, chance: 30, color: '#e74c3c', text: '50 Credits' },
    { type: 'credits', amount: 150, chance: 30, color: '#2ecc71', text: '150 Credits' },
    { type: 'xp', amount: 10, chance: 20, color: '#3498db', text: '10 XP' },
    { type: 'balance', amount: 1, chance: 5, color: '#f1c40f', text: '1 TND' },
    { type: 'empty', amount: 0, chance: 15, color: '#95a5a6', text: 'Hard Luck' }
];

// --- Helper: Get Config ---
const getCheckInConfig = async () => {
    let setting = await SystemSetting.findOne({ key: 'daily_check_in_rewards' });
    if (!setting) {
        // إنشاء الإعدادات الافتراضية لأول مرة
        setting = await SystemSetting.create({
            key: 'daily_check_in_rewards',
            value: DEFAULT_REWARDS,
            description: 'Array of credits for daily check-in rewards'
        });
    }
    return setting.value; // يرجع مصفوفة الأرقام
};

// --- Admin: Update Check-in Config ---
const adminUpdateCheckInConfig = async (req, res) => {
    const { rewards } = req.body; // مصفوفة أرقام [10, 20, ...]

    if (!Array.isArray(rewards) || rewards.length === 0) {
        return res.status(400).json({ msg: "Invalid rewards array." });
    }

    try {
        await SystemSetting.findOneAndUpdate(
            { key: 'daily_check_in_rewards' },
            { $set: { value: rewards } },
            { upsert: true, new: true }
        );

        // إشعار السوكت لتحديث الواجهات فوراً
        if (req.io) req.io.emit('check_in_config_updated', rewards);

        res.status(200).json({ msg: "Check-in rewards updated successfully", rewards });
    } catch (error) {
        res.status(500).json({ msg: "Failed to update settings" });
    }
};

// --- Admin: Get Check-in Config ---
const adminGetCheckInConfig = async (req, res) => {
    try {
        const rewards = await getCheckInConfig();
        res.status(200).json(rewards);
    } catch (error) {
        res.status(500).json({ msg: "Failed to fetch settings" });
    }
};

// --- تعديل دالة: Perform Daily Check-In ---
const performDailyCheckIn = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: "User not found" });

        // [!!!] جلب الإعدادات من القاعدة بدلاً من الثابت [!!!]
        const rewardsConfig = await getCheckInConfig();
        const cycleLength = rewardsConfig.length; // عدد الأيام (ديناميكي)

        const now = new Date();
        const lastCheckIn = user.dailyCheckIn.lastCheckInDate ? new Date(user.dailyCheckIn.lastCheckInDate) : null;

        if (lastCheckIn && lastCheckIn.toDateString() === now.toDateString()) {
            return res.status(400).json({ msg: "Already checked in today." });
        }

        let newStreak = user.dailyCheckIn.streak || 0;

        // منطق الـ Streak (كما هو)
        if (lastCheckIn) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastCheckIn.toDateString() === yesterday.toDateString()) {
                newStreak += 1;
            } else {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }

        // [!!!] استخدام طول الدورة الديناميكي [!!!]
        // المعادلة: (Streak - 1) % عدد الأيام الكلي
        let dayIndex = (newStreak - 1) % cycleLength;
        const rewardCredits = rewardsConfig[dayIndex];

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
            nextReset: cycleLength // نرسل طول الدورة للواجهة لتعرف متى تعيد الرسم
        });

    } catch (error) {
        console.error("Check-in Error:", error);
        res.status(500).json({ msg: "Server error during check-in." });
    }
};

// جلب إعدادات العجلة
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

// --- Admin: Update Wheel Config ---
const adminUpdateWheelConfig = async (req, res) => {
    const { segments } = req.body; // مصفوفة القطاعات
    if (!Array.isArray(segments) || segments.length < 2) {
        return res.status(400).json({ msg: "Wheel must have at least 2 segments." });
    }
    try {
        await SystemSetting.findOneAndUpdate(
            { key: 'lucky_wheel_config' },
            { $set: { value: segments } },
            { upsert: true, new: true }
        );
        // إشعار السوكت لتحديث الواجهة فوراً
        if (req.io) req.io.emit('wheel_config_updated', segments);
        res.status(200).json({ msg: "Wheel settings updated", segments });
    } catch (error) {
        res.status(500).json({ msg: "Failed to update settings" });
    }
};

// --- Admin/User: Get Wheel Config ---
const getWheelConfig = async (req, res) => {
    try {
        const config = await getWheelConfigData();
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ msg: "Failed to fetch wheel config" });
    }
};

// --- Spin the Wheel (Fixed Logic) ---
const spinWheel = async (req, res) => {
    const userId = req.user._id;
    const SPIN_COST = 100; 

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if (user.credits < SPIN_COST) {
            return res.status(400).json({ msg: "Insufficient credits." });
        }

        user.credits -= SPIN_COST;

        // جلب الإعدادات واختيار الجائزة (كما هو)
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

        // [!!!] تطبيق الجائزة مع المنطق الصحيح [!!!]
        if (selectedItem.type === 'credits') {
            user.credits += selectedItem.amount;
        } 
        else if (selectedItem.type === 'xp') {
            const oldLevel = user.level;
            user.reputationPoints += selectedItem.amount;
            
            // [1] التحقق من الترقية
            updateUserLevelAndBadge(user);
            // [2] صرف مكافآت المستوى الجديد
            await processLevelUpRewards(user, oldLevel, req, session);
        } 
        else if (selectedItem.type === 'balance') {
            user.balance += selectedItem.amount;
            
            // [3] تسجيل المعاملة المالية (لتظهر في الداشبورد)
            const rewardTransaction = new Transaction({
                user: userId,
                type: 'LUCKY_WHEEL_REWARD', // نوع جديد
                amount: selectedItem.amount,
                currency: 'TND', // أو العملة الافتراضية للمنصة
                status: 'COMPLETED',
                descriptionKey: 'transactionDescriptions.luckyWheelReward', // مفتاح ترجمة
                descriptionParams: { amount: selectedItem.amount },
                description: `Won ${selectedItem.amount} TND from Lucky Wheel`
            });
            await rewardTransaction.save({ session });
        }

        // تسجيل في السجل (SpinHistory)
        const SpinHistory = require('../models/SpinHistory');
        await SpinHistory.create([{
            user: userId,
            cost: SPIN_COST,
            reward: {
                type: selectedItem.type,
                amount: selectedItem.amount
            }
        }], { session });

        await user.save({ session });
        await session.commitTransaction();

        // إشعار السوكت بالتحديث الشامل
        if (req.io && req.onlineUsers[userId.toString()]) {
            req.io.to(req.onlineUsers[userId.toString()]).emit('user_profile_updated', {
                _id: userId,
                credits: user.credits,
                balance: user.balance,
                reputationPoints: user.reputationPoints,
                level: user.level,
                reputationLevel: user.reputationLevel
            });
            // لتحديث قائمة المعاملات في الداشبورد
            if (selectedItem.type === 'balance') {
                req.io.to(req.onlineUsers[userId.toString()]).emit('dashboard_transactions_updated');
            }
        }

        res.status(200).json({
            msg: "Spin successful!",
            reward: selectedItem,
            remainingCredits: user.credits,
            newBalance: user.balance
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Spin Wheel Error:", error);
        res.status(500).json({ msg: "Server error during spin." });
    } finally {
        session.endSession();
    }
};

// --- 3. Get User Quests & Check-in Status ---
const getUserQuests = async (req, res) => {
    const userId = req.user._id;
    try {
        const user = await User.findById(userId).select('credits dailyCheckIn');

        // جلب كل المهمات النشطة
        const allQuests = await Quest.find({ isActive: true }).lean();

        // جلب تقدم المستخدم
        const userProgress = await UserQuest.find({ user: userId }).lean();

        // دمج البيانات
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

        res.status(200).json({
            credits: user.credits,
            checkIn: user.dailyCheckIn,
            quests: questsWithProgress
        });

    } catch (error) {
        console.error("Get Quests Error:", error);
        res.status(500).json({ msg: "Server error fetching quests." });
    }
};

const claimQuestReward = async (req, res) => {
    const userId = req.user._id;
    const { questId } = req.body;

    // نستخدم Session لضمان أن التحديثات المالية والمستوى تتم معاً أو تفشل معاً
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userQuest = await UserQuest.findOne({ user: userId, quest: questId }).populate('quest').session(session);

        if (!userQuest) throw new Error("Quest progress not found.");
        if (!userQuest.isCompleted) throw new Error("Quest not completed yet.");
        if (userQuest.isClaimed) throw new Error("Reward already claimed.");

        const user = await User.findById(userId).session(session);

        // 1. منح الجائزة (Credits)
        if (userQuest.quest.reward.credits > 0) {
            user.credits = (user.credits || 0) + userQuest.quest.reward.credits;
        }

        // 2. منح الجائزة (XP) + [!!!] معالجة الترقية [!!!]
        if (userQuest.quest.reward.xp > 0) {
            const oldLevel = user.level; // حفظ المستوى القديم

            // إضافة نقاط السمعة
            user.reputationPoints = (user.reputationPoints || 0) + userQuest.quest.reward.xp;

            // استدعاء دالة حساب المستوى والشارات
            // هذه الدالة تعدل الـ user object مباشرة (by reference)
            const badgeChanged = updateUserLevelAndBadge(user);

            // استدعاء دالة مكافآت المستوى (أموال المستوى)
            // نمرر req لأن الدالة قد تحتاج لإرسال socket داخلياً
            await processLevelUpRewards(user, oldLevel, req, session);
        }

        userQuest.isClaimed = true;
        await userQuest.save({ session });
        await user.save({ session });

        await session.commitTransaction();

        // 3. [!!!] إرسال تحديث Socket فوري للواجهة [!!!]
        // هذا سيجعل النقاط والمستوى والمال يتحدثون فوراً في Sidebar و Profile
        if (req.io && req.onlineUsers && req.onlineUsers[userId.toString()]) {
            const socketId = req.onlineUsers[userId.toString()];

            // نرسل البروفايل المحدث بالكامل
            req.io.to(socketId).emit('user_profile_updated', {
                _id: user._id,
                credits: user.credits,
                reputationPoints: user.reputationPoints,
                level: user.level,
                balance: user.balance, // في حال حصل على مكافأة مالية
                reputationLevel: user.reputationLevel
            });

            // إشعار صغير (اختياري)
            if (userQuest.quest.reward.credits > 0 || userQuest.quest.reward.xp > 0) {
                // يمكن إرسال إشعار توست هنا، لكن الواجهة تعرضه بالفعل عند النجاح
            }
        }

        res.status(200).json({
            msg: "Reward claimed successfully!",
            credits: user.credits,
            reputation: user.reputationPoints,
            questId: questId // مهم للريديوسر
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Claim Reward Error:", error);
        res.status(500).json({ msg: error.message || "Server error claiming reward." });
    } finally {
        session.endSession();
    }
};

// دالة مساعدة لملء اللغات المفقودة
const fillMissingLanguages = (obj) => {
    // إذا لم يكتب الإنجليزية، نضع العربية
    if (!obj.en || obj.en.trim() === "") obj.en = obj.ar;
    // إذا لم يكتب الفرنسية، نضع العربية (أو الإنجليزية)
    if (!obj.fr || obj.fr.trim() === "") obj.fr = obj.ar;
    // إذا لم يكتب التونسية، نضع العربية
    if (!obj.tn || obj.tn.trim() === "") obj.tn = obj.ar;
    return obj;
};

// --- Admin: Create/Update Quest (Utility) ---
const adminCreateQuest = async (req, res) => {
    // نفكك البيانات القادمة
    let { title, description, type, eventTrigger, targetCount, reward, icon, isActive } = req.body;

    try {
        // [!!!] تطبيق منطق الملء التلقائي [!!!]
        if (title && title.ar) {
            title = fillMissingLanguages(title);
        }
        if (description && description.ar) {
            description = fillMissingLanguages(description);
        }

        const newQuest = new Quest({
            title, description, type, eventTrigger, targetCount, reward, icon, isActive
        });
        await newQuest.save();
        if (req.io) {
            req.io.emit('achievements_list_updated'); // يمكننا استخدام نفس الحدث أو إنشاء 'quests_list_updated'
            // الأفضل إنشاء حدث جديد:
            req.io.emit('quests_updated', { type: 'create', quest: newQuest });
        }
        res.status(201).json(newQuest);
    } catch (error) {
        console.error("Create Quest Error:", error);
        res.status(500).json({ msg: error.message });
    }
};

// --- Admin: Get All Quests (Including inactive) ---
const adminGetAllQuests = async (req, res) => {
    try {
        const quests = await Quest.find().sort({ createdAt: -1 });
        res.status(200).json(quests);
    } catch (error) {
        res.status(500).json({ msg: "Server Error" });
    }
};

// --- Admin: Update Quest ---
const adminUpdateQuest = async (req, res) => {
    const { id } = req.params;
    let updateData = req.body;

    try {
        if (updateData.title && updateData.title.ar) {
            updateData.title = fillMissingLanguages(updateData.title);
        }
        if (updateData.description && updateData.description.ar) {
            updateData.description = fillMissingLanguages(updateData.description);
        }

        const updatedQuest = await Quest.findByIdAndUpdate(id, updateData, { new: true });

        // [!!!] إرسال إشعار التحديث [!!!]
        if (req.io) req.io.emit('quests_updated');

        res.status(200).json(updatedQuest);
    } catch (error) {
        res.status(500).json({ msg: "Update failed" });
    }
};

// --- Admin: Delete Quest ---
const adminDeleteQuest = async (req, res) => {
    const { id } = req.params;
    try {
        await Quest.findByIdAndDelete(id);
        await UserQuest.deleteMany({ quest: id });

        // [!!!] إرسال إشعار الحذف [!!!]
        if (req.io) req.io.emit('quests_updated');

        res.status(200).json({ msg: "Quest deleted", questId: id });
    } catch (error) {
        res.status(500).json({ msg: "Delete failed" });
    }
};

// --- Get Spin History ---
const getSpinHistory = async (req, res) => {
    try {
        const history = await SpinHistory.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ msg: "Error fetching history" });
    }
};

module.exports = {
    performDailyCheckIn,
    spinWheel,
    getUserQuests,
    claimQuestReward,
    adminCreateQuest,
    adminGetAllQuests,
    adminUpdateQuest,
    adminDeleteQuest,
    adminUpdateCheckInConfig,
    adminGetCheckInConfig,
    getSpinHistory,
    adminUpdateWheelConfig,
    getWheelConfig
};