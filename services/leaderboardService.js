// server/services/leaderboardService.js
const User = require('../models/User');

/**
 * تحديث لقطة الترتيب (Snapshot) لجميع الفئات
 * يتم تشغيلها عبر Cron Job
 */
exports.updateLeaderboardSnapshots = async (io) => { // <-- أضف io هنا
    console.log('[Leaderboard Service] Starting scheduled rank snapshot update...');
    
    const categories = [
        { dbField: 'reputationPoints', rankField: 'previousRanks.reputation' },
        { dbField: 'productsSoldCount', rankField: 'previousRanks.sales' },
        { dbField: 'successfulMediationsCount', rankField: 'previousRanks.mediation' },
        { dbField: 'productsBoughtCount', rankField: 'previousRanks.buys' },
        { dbField: 'bidsPlacedCount', rankField: 'previousRanks.bids' }
    ];

    try {
        // نقوم بتحديث كل فئة على حدة
        for (const cat of categories) {
            // 1. جلب المستخدمين مرتبين حسب المعيار الحالي
            // نجلب مثلاً أول 100 مستخدم فقط لأن الترتيب بعد الـ 100 لا يهم كثيراً في العرض
            // ولتخفيف الضغط على قاعدة البيانات
            const topUsers = await User.find({ blocked: false, [cat.dbField]: { $gt: 0 } })
                .sort({ [cat.dbField]: -1, level: -1 })
                .select('_id')
                .limit(200) // تتبع حركة أفضل 200 مستخدم
                .lean();

            if (topUsers.length === 0) continue;

            // 2. تجهيز عمليات التحديث بالجملة (Bulk Operations)
            const bulkOps = topUsers.map((user, index) => {
                return {
                    updateOne: {
                        filter: { _id: user._id },
                        update: { $set: { [cat.rankField]: index + 1 } } // الترتيب الحالي يصبح هو "السابق" للمرة القادمة
                    }
                };
            });

            // 3. تنفيذ التحديث
            if (bulkOps.length > 0) {
                await User.bulkWrite(bulkOps);
            }
            console.log(`[Leaderboard Service] Updated snapshot for ${cat.dbField} (${bulkOps.length} users).`);
        }
        console.log('[Leaderboard Service] Rank snapshot update completed successfully.');

        // [!!!] أضف هذا السطر في النهاية [!!!]
        if (io) {
            io.emit('leaderboard_updated'); // إرسال حدث عام للجميع
            console.log('[Leaderboard Service] Emitted leaderboard_updated event.');
        }

    } catch (error) {
        console.error('[Leaderboard Service] Error updating rank snapshots:', error);
    }
};