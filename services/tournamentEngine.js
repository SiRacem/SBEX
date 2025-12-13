const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User'); 
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// =========================================================
// 1. الوظيفة الأساسية: توزيع الجوائز
// =========================================================
async function distributePrizes(tournamentId, finalMatch, session) {
    const tournament = await Tournament.findById(tournamentId).session(session);
    if (!tournament) return;

    console.log(`💰 Distributing prizes for Tournament: ${tournament.title}`);

    const winnerId = finalMatch.winner;
    const runnerUpId = finalMatch.loser; 

    const prizes = tournament.prizesDistribution;

    // --- توزيع جائزة المركز الأول ---
    if (winnerId && prizes.firstPlace > 0) {
        await processReward(winnerId, prizes.firstPlace, tournament, '1', session);
    }

    // --- توزيع جائزة المركز الثاني ---
    if (runnerUpId && prizes.secondPlace > 0) {
        await processReward(runnerUpId, prizes.secondPlace, tournament, '2', session);
    }

    tournament.status = 'completed';
    await tournament.save({ session });
}

// دالة مساعدة لتحويل الأموال (معدلة ومصححة)
async function processReward(userId, amount, tournament, rankPosition, session) {
    const user = await User.findById(userId).session(session);
    
    if (user) {
        user.balance += amount; // إضافة الرصيد للمستخدم
        await user.save({ session });

        // [!] إصلاح المعاملة (Currency + UPPERCASE Status)
        await Transaction.create([{
            user: userId,
            amount: amount,
            currency: 'TND', // [!] إضافة العملة
            type: 'TOURNAMENT_PRIZE', 
            descriptionKey: 'transactionDescriptions.tournament_prize', 
            descriptionParams: { 
                tournamentTitle: tournament.title,
                rank: rankPosition
            },
            status: 'COMPLETED', // [!] أحرف كبيرة
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });

        // [!] إصلاح الإشعار (إرسال نصوص ثابتة للمفاتيح)
        await Notification.create([{
            user: userId,
            type: 'TOURNAMENT_WIN',
            title: 'notification_titles.TOURNAMENT_WIN', // نص ثابت للمفتاح
            message: 'notification_messages.TOURNAMENT_WIN', // نص ثابت للمفتاح
            messageParams: { // المتغيرات
                amount: amount,
                tournamentTitle: tournament.title,
                rank: rankPosition
            },
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });
    }
}

// =========================================================
// 2. الوظيفة الأساسية: تصعيد الفائز
// =========================================================
async function advanceWinnerToNextRound(currentMatch, session) {
    const tournamentId = currentMatch.tournament;
    const currentRound = currentMatch.round;
    const currentIndex = currentMatch.matchIndex;
    const winnerId = currentMatch.winner;

    // [!] استخراج اسم وشعار الفريق الفائز
    let winnerTeamName = null;
    let winnerTeamLogo = null;

    if (currentMatch.player1 && currentMatch.player1.toString() === winnerId.toString()) {
        winnerTeamName = currentMatch.player1Team;
        winnerTeamLogo = currentMatch.player1TeamLogo; // نقل الشعار
    } else if (currentMatch.player2 && currentMatch.player2.toString() === winnerId.toString()) {
        winnerTeamName = currentMatch.player2Team;
        winnerTeamLogo = currentMatch.player2TeamLogo; // نقل الشعار
    }

    // حساب موقع المباراة القادمة
    const nextRound = currentRound + 1;
    const nextMatchIndex = Math.floor(currentIndex / 2);

    // البحث عن المباراة التالية
    let nextMatch = await Match.findOne({
        tournament: tournamentId,
        round: nextRound,
        matchIndex: nextMatchIndex
    }).session(session);

    // [!] إذا لم تكن موجودة (وهذا طبيعي في الجولات الجديدة)، ننشئها
    if (!nextMatch) {
        // تحقق هل وصلنا للنهاية؟ (مثلاً الجولة 5 في بطولة 16 لاعب)
        // يمكن التحقق من MaxParticipants، لكن للتبسيط، إذا لم نجد مباراة، ننشئها
        // إلا إذا كان الفائز هو بطل البطولة بالفعل (تم التعامل معه في distributePrizes)
        
        // هنا سنفترض أننا بحاجة لإنشاء المباراة التالية ديناميكياً
        nextMatch = new Match({
            tournament: tournamentId,
            round: nextRound,
            matchIndex: nextMatchIndex,
            status: 'scheduled'
        });
    }

    // تحديد مكان الفائز (Slot 1 or Slot 2)
    const isPlayer1Slot = (currentIndex % 2 === 0);
    
    if (isPlayer1Slot) {
        nextMatch.player1 = winnerId;
        nextMatch.player1Team = winnerTeamName;
        nextMatch.player1TeamLogo = winnerTeamLogo; // [!] حفظ الشعار
    } else {
        nextMatch.player2 = winnerId;
        nextMatch.player2Team = winnerTeamName;
        nextMatch.player2TeamLogo = winnerTeamLogo; // [!] حفظ الشعار
    }

    // التحقق من اكتمال المباراة (هل أصبح لها طرفان؟)
    // إذا اكتملت، يمكن تغيير حالتها لـ scheduled أو ongoing حسب المنطق
    
    await nextMatch.save({ session });
    console.log(`Advancing winner ${winnerId} to Round ${nextRound}, Match ${nextMatchIndex}`);
}

// =========================================================
// 3. الوظيفة المجدولة: الاعتماد التلقائي
// =========================================================
async function runAutoConfirmJob(io) {
    const session = await mongoose.startSession();
    session.startTransaction();
    let processedCount = 0;

    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        const pendingMatches = await Match.find({
            status: 'review',
            updatedAt: { $lte: fiveMinutesAgo },
            'dispute.isOpen': false 
        }).session(session);

        if (pendingMatches.length > 0) {
            for (const match of pendingMatches) {
                match.status = 'completed';
                await match.save({ session });
                
                await advanceWinnerToNextRound(match, session);
                processedCount++;

                if(io) {
                    io.to(match._id.toString()).emit('match_updated', { 
                        _id: match._id, // [!] تأكد من تطابق الهيكل مع الـ Frontend
                        status: 'completed', 
                        winner: match.winner 
                    });
                }
            }
        }

        await session.commitTransaction();
    } catch (error) {
        console.error("[TournamentEngine] Error in auto-confirm job:", error);
        await session.abortTransaction();
    } finally {
        session.endSession();
    }
    
    return processedCount;
}

module.exports = {
    runAutoConfirmJob,
    advanceWinnerToNextRound,
    distributePrizes
};