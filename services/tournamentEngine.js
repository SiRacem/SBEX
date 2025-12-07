// server/services/tournamentEngine.js
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User'); // نستخدم User بدلاً من Wallet
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

// دالة مساعدة لتحويل الأموال (معدلة لتعمل مع User وتدعم الترجمة)
async function processReward(userId, amount, tournament, rankPosition, session) {
    // نستخدم User مباشرة بدلاً من Wallet
    const user = await User.findById(userId).session(session);
    
    if (user) {
        user.balance += amount; // إضافة الرصيد للمستخدم
        await user.save({ session });

        // تسجيل المعاملة (بمفاتيح ترجمة)
        await Transaction.create([{
            user: userId,
            amount: amount,
            type: 'TOURNAMENT_PRIZE', 
            // نرسل المفتاح بدلاً من النص
            description: 'transactions.tournament_prize', 
            // نرسل البارامترات ليتم تعويضها في الفرونت
            metadata: { 
                tournamentTitle: tournament.title,
                rank: rankPosition
            },
            status: 'completed',
            balanceAfter: user.balance
        }], { session });

        // إرسال إشعار (بمفاتيح ترجمة)
        await Notification.create([{
            user: userId,
            type: 'TOURNAMENT_WIN',
            title: 'notification_titles.TOURNAMENT_WIN', // مفتاح العنوان
            message: 'notification_messages.TOURNAMENT_WIN', // مفتاح الرسالة
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

    const winnerTeam = currentMatch.player1 && currentMatch.player1.toString() === winnerId.toString() 
                       ? currentMatch.player1Team 
                       : currentMatch.player2Team;

    const nextRound = currentRound + 1;
    const nextMatchIndex = Math.floor(currentIndex / 2);

    let nextMatch = await Match.findOne({
        tournament: tournamentId,
        round: nextRound,
        matchIndex: nextMatchIndex
    }).session(session);

    if (!nextMatch) {
        console.log(`🏆 Tournament Finished! Winner: ${winnerId}`);
        await distributePrizes(tournamentId, currentMatch, session);
        return;
    }

    const isPlayer1Slot = (currentIndex % 2 === 0);
    if (isPlayer1Slot) {
        nextMatch.player1 = winnerId;
        nextMatch.player1Team = winnerTeam;
    } else {
        nextMatch.player2 = winnerId;
        nextMatch.player2Team = winnerTeam;
    }

    await nextMatch.save({ session });
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
                        matchId: match._id, 
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