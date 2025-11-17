// server/controllers/achievement.controller.js

const Achievement = require('../models/Achievement');
const asyncHandler = require('express-async-handler'); // أنت تستخدم هذا في newsController
const mongoose = require('mongoose');

// @desc    Create a new achievement (Admin only)
// @route   POST /api/achievements
// @access  Private/Admin
exports.createAchievement = asyncHandler(async (req, res) => {
    // نفترض أن title و description و criteria ستأتي كـ JSON strings
    // تمامًا مثلما تعاملت معها في newsController
    const { title, description, icon, category, criteria, pointsAwarded, isEnabled, secret } = req.body;

    if (!title || !description || !icon || !category || !criteria) {
        res.status(400);
        throw new Error("Missing required fields: title, description, icon, category, and criteria are required.");
    }

    try {
        const parsedTitle = JSON.parse(title);
        const parsedDescription = JSON.parse(description);
        const parsedCriteria = JSON.parse(criteria);

        // التحقق من وجود اللغة العربية كحد أدنى
        if (!parsedTitle.ar || !parsedDescription.ar) {
            res.status(400);
            throw new Error("Arabic title and description are mandatory.");
        }

        const newAchievement = await Achievement.create({
            title: parsedTitle,
            description: parsedDescription,
            icon,
            category,
            criteria: parsedCriteria,
            pointsAwarded: pointsAwarded ? Number(pointsAwarded) : 0,
            isEnabled: isEnabled !== 'false', // التحويل من string إلى boolean
            secret: secret === 'true'
        });

        if (req.io) {
            req.io.emit('achievements_list_updated');
        }

        // لا نحتاج لـ socket.io هنا لأن هذا تحديث إداري فقط
        res.status(201).json(newAchievement);

    } catch (jsonError) {
        res.status(400);
        throw new Error("Invalid JSON format for title, description, or criteria.");
    }
});


// @desc    Get all achievements with pagination (Admin only for management)
// @route   GET /api/achievements
// @access  Private/Admin
exports.getAllAchievements = asyncHandler(async (req, res) => {
    // سنستخدم paginate إذا كان متاحًا، وإلا سنستخدم الطريقة العادية
    // بما أن Achievement model لا يستخدم plugin mongoose-paginate، سنقوم بالترقيم يدويًا
    const pageSize = parseInt(req.query.limit) || 15;
    const page = parseInt(req.query.page) || 1;

    const count = await Achievement.countDocuments();
    const achievements = await Achievement.find({})
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.status(200).json({
        achievements,
        page,
        totalPages: Math.ceil(count / pageSize),
        totalAchievements: count
    });
});

// @desc    Get a single achievement by ID (Admin only)
// @route   GET /api/achievements/:id
// @access  Private/Admin
exports.getAchievementById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error("Invalid Achievement ID format.");
    }

    const achievement = await Achievement.findById(id);

    if (achievement) {
        res.status(200).json(achievement);
    } else {
        res.status(404);
        throw new Error('Achievement not found.');
    }
});


// @desc    Update an achievement (Admin only)
// @route   PUT /api/achievements/:id
// @access  Private/Admin
exports.updateAchievement = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error("Invalid Achievement ID format.");
    }

    const achievement = await Achievement.findById(id);
    if (!achievement) {
        res.status(404);
        throw new Error('Achievement not found.');
    }

    const { title, description, icon, category, criteria, pointsAwarded, isEnabled, secret } = req.body;

    // دالة مساعدة لتحليل JSON إذا كان سلسلة نصية
    const parseIfString = (value) => {
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (e) {
                return value; // إذا فشل التحليل، أعد القيمة الأصلية
            }
        }
        return value; // إذا كان كائنًا بالفعل، أعده كما هو
    };

    if (title !== undefined) achievement.title = title;
    if (description !== undefined) achievement.description = description;
    if (criteria !== undefined) achievement.criteria = criteria;

    if (icon !== undefined) achievement.icon = icon;
    if (category !== undefined) achievement.category = category;
    if (pointsAwarded !== undefined) achievement.pointsAwarded = Number(pointsAwarded);
    if (isEnabled !== undefined) achievement.isEnabled = String(isEnabled) === 'true';
    if (secret !== undefined) achievement.secret = String(secret) === 'true';

    const updatedAchievement = await achievement.save();

    if (req.io) {
        req.io.emit('achievements_list_updated');
    }

    res.status(200).json(updatedAchievement);
});


// @desc    Delete an achievement (Admin only)
// @route   DELETE /api/achievements/:id
// @access  Private/Admin
exports.deleteAchievement = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error("Invalid Achievement ID format.");
    }

    // ملاحظة: حذف إنجاز لن يزيله من المستخدمين الذين حصلوا عليه بالفعل
    // وهذا هو السلوك المطلوب للحفاظ على سجلات المستخدمين.
    const achievement = await Achievement.findById(id);

    if (achievement) {
        await Achievement.deleteOne({ _id: id });

        if (req.io) {
            req.io.emit('achievements_list_updated');
        }

        res.status(200).json({ message: 'Achievement removed successfully.' });
    } else {
        res.status(404);
        throw new Error('Achievement not found.');
    }
});

// @desc    Get all available achievements for a user to see (Public/Authenticated)
// @route   GET /api/achievements/available
// @access  Public
exports.getAvailableAchievementsForUser = asyncHandler(async (req, res) => {
    // جلب جميع الإنجازات الممكنة والغير سرية
    const achievements = await Achievement.find({ isEnabled: true, secret: false }).sort({ category: 1, createdAt: 1 }).lean();

    res.status(200).json(achievements);
});