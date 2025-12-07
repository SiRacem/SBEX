// server/controllers/leagues.controller.js
const League = require('../models/League');
const Team = require('../models/Team');

// =======================
// LEAGUES (الدوريات)
// =======================

// 1. إنشاء دوري جديد
exports.createLeague = async (req, res) => {
    try {
        const { name, logo, type, region } = req.body;
        const newLeague = new League({ name, logo, type, region });
        await newLeague.save();
        res.status(201).json({ success: true, message: "League created successfully", league: newLeague });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 2. جلب جميع الدوريات (للأدمن)
exports.getAllLeagues = async (req, res) => {
    try {
        const leagues = await League.find().sort({ createdAt: -1 });
        res.status(200).json(leagues);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// 3. جلب الدوريات النشطة فقط (للمستخدم عند إنشاء بطولة)
exports.getActiveLeagues = async (req, res) => {
    try {
        const { type } = req.query; // يمكن الفلترة حسب النوع (Club/National)
        const filter = { isActive: true };
        if (type) filter.type = type;
        
        const leagues = await League.find(filter).sort({ name: 1 });
        res.status(200).json(leagues);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// 4. تعديل دوري (تغيير حالة، اسم، شعار)
exports.updateLeague = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedLeague = await League.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedLeague) return res.status(404).json({ message: "League not found" });
        res.status(200).json({ success: true, message: "League updated", league: updatedLeague });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// 5. حذف دوري (يجب حذف الفرق التابعة له أو تحذير الأدمن)
exports.deleteLeague = async (req, res) => {
    try {
        const { id } = req.params;
        // حذف الفرق المرتبطة أولاً
        await Team.deleteMany({ league: id });
        // حذف الدوري
        await League.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "League and its teams deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// =======================
// TEAMS (الفرق)
// =======================

// 6. إضافة فريق لدوري معين
exports.addTeam = async (req, res) => {
    try {
        const { name, logo, leagueId } = req.body;
        
        // التحقق من الدوري
        const league = await League.findById(leagueId);
        if (!league) return res.status(404).json({ message: "League not found" });

        const newTeam = new Team({ name, logo, league: leagueId });
        await newTeam.save();
        
        res.status(201).json({ success: true, message: "Team added successfully", team: newTeam });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// 7. جلب الفرق التابعة لدوري معين
exports.getTeamsByLeague = async (req, res) => {
    try {
        const { leagueId } = req.params;
        const teams = await Team.find({ league: leagueId }).sort({ name: 1 });
        res.status(200).json(teams);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// 8. تعديل فريق
exports.updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTeam = await Team.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json({ success: true, message: "Team updated", team: updatedTeam });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// 9. حذف فريق
exports.deleteTeam = async (req, res) => {
    try {
        await Team.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Team deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};