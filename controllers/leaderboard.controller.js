// server/controllers/leaderboard.controller.js

const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// دالة مساعدة لجلب الترتيب
const getTopUsers = async (criteria, limit) => {
    return await User.find({ blocked: false, [criteria]: { $gt: 0 } })
        .sort({ [criteria]: -1, level: -1 })
        .select('fullName avatarUrl level reputationLevel previousRanks ' + criteria)
        .limit(limit)
        .lean();
};

// دالة مساعدة لمعرفة ترتيب المستخدم الحالي
const getUserRank = async (userId, criteria) => {
    if (!userId) return null;

    const user = await User.findById(userId).select(criteria).lean();
    if (!user || !user[criteria]) return null;

    const score = user[criteria];
    // احسب عدد الأشخاص الذين لديهم نقاط أكثر منه
    const rank = await User.countDocuments({
        blocked: false,
        [criteria]: { $gt: score }
    });

    return {
        rank: rank + 1, // الترتيب (1-based)
        score: score
    };
};

// @desc    Get leaderboard data
// @route   GET /leaderboards
// @access  Public (User ID optional for "My Rank")
exports.getLeaderboards = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20; // نجلب 20 ليكون لدينا قائمة جيدة
    const currentUserId = req.user?._id; // اختياري

    // 1. جلب القوائم (Tabs)
    const [topReputation, topSellers, topMediators, topBuyers, topBidders, topReferrers] = await Promise.all([
        getTopUsers('reputationPoints', limit),
        getTopUsers('productsSoldCount', limit),
        getTopUsers('successfulMediationsCount', limit),
        getTopUsers('productsBoughtCount', limit),
        getTopUsers('bidsPlacedCount', limit),
        getTopUsers('referralsCount', limit)
    ]);

    // 2. حساب ترتيب المستخدم الحالي (إذا كان مسجلاً)
    let myRanks = {};
    if (currentUserId) {
        const [rankReputation, rankSeller, rankMediator, rankBuyer, rankBidder, rankReferrer] = await Promise.all([
            getUserRank(currentUserId, 'reputationPoints'),
            getUserRank(currentUserId, 'productsSoldCount'),
            getUserRank(currentUserId, 'successfulMediationsCount'),
            getUserRank(currentUserId, 'productsBoughtCount'),
            getUserRank(currentUserId, 'bidsPlacedCount'),
            getUserRank(currentUserId, 'referralsCount')
        ]);

        myRanks = {
            topReputation: rankReputation,
            topSellers: rankSeller,
            topMediators: rankMediator,
            topBuyers: rankBuyer,
            topBidders: rankBidder,
            topReferrers: rankReferrer
        };
    }

    res.status(200).json({
        leaderboards: {
            topReputation,
            topSellers,
            topMediators,
            topBuyers,
            topBidders,
            topReferrers
        },
        myRanks
    });
});