const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// 1. توزيع الجوائز
async function distributePrizes(tournamentId, finalMatch, session) {
    const tournament = await Tournament.findById(tournamentId).session(session);
    if (!tournament) return;

    console.log(`💰 Distributing prizes for Tournament: ${tournament.title}`);
    const winnerId = finalMatch.winner;
    const runnerUpId = finalMatch.loser;
    const prizes = tournament.prizesDistribution;

    if (winnerId && prizes.firstPlace > 0) {
        await processReward(winnerId, prizes.firstPlace, tournament, '1', session);
    }
    if (runnerUpId && prizes.secondPlace > 0) {
        await processReward(runnerUpId, prizes.secondPlace, tournament, '2', session);
    }

    tournament.status = 'completed';
    await tournament.save({ session });
}

// دالة مساعدة لتحويل الأموال
async function processReward(userId, amount, tournament, rankPosition, session) {
    const user = await User.findById(userId).session(session);
    if (user) {
        user.balance += amount;
        await user.save({ session });

        await Transaction.create([{
            user: userId,
            amount: amount,
            currency: 'TND',
            type: 'TOURNAMENT_PRIZE',
            descriptionKey: 'transactionDescriptions.tournament_prize',
            descriptionParams: {
                tournamentTitle: tournament.title,
                rank: rankPosition
            },
            status: 'COMPLETED',
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });

        await Notification.create([{
            user: userId,
            type: 'TOURNAMENT_WIN',
            title: 'notification_titles.TOURNAMENT_WIN',
            message: 'notification_messages.TOURNAMENT_WIN',
            messageParams: {
                amount: amount,
                tournamentTitle: tournament.title,
                rank: rankPosition
            },
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });
    }
}

// 2. تصعيد الفائز (محدث للتوافق مع الجدول المولد مسبقاً)
async function advanceWinnerToNextRound(currentMatch, session) {
    // إنشاء جلسة محلية إذا لم يتم تمرير واحدة، لضمان عمليات قاعدة البيانات الذرية
    const localSession = session || await mongoose.startSession();
    if (!session) localSession.startTransaction();

    try {
        const tournamentId = currentMatch.tournament;
        const currentRound = currentMatch.round;
        const currentIndex = currentMatch.matchIndex;
        const winnerId = currentMatch.winner;

        if (!winnerId) {
            console.log("No winner to advance.");
            if (!session) await localSession.commitTransaction();
            return;
        }

        // نقل بيانات الفريق والشعار
        let winnerTeamName = null;
        let winnerTeamLogo = null;

        const wId = winnerId.toString();
        const p1Id = currentMatch.player1 ? currentMatch.player1.toString() : null;
        const p2Id = currentMatch.player2 ? currentMatch.player2.toString() : null;

        if (p1Id === wId) {
            winnerTeamName = currentMatch.player1Team;
            winnerTeamLogo = currentMatch.player1TeamLogo;
        } else if (p2Id === wId) {
            winnerTeamName = currentMatch.player2Team;
            winnerTeamLogo = currentMatch.player2TeamLogo;
        }

        const tournament = await Tournament.findById(tournamentId).session(localSession);
        const totalRounds = Math.log2(tournament.maxParticipants);

        // إذا وصلنا للنهاية
        if (currentRound >= totalRounds) {
            console.log(`🏆 Tournament Finished! Winner: ${winnerId}`);
            await distributePrizes(tournamentId, currentMatch, localSession);
            if (!session) await localSession.commitTransaction();
            return;
        }

        // البحث عن المباراة التالية (الموجودة مسبقاً)
        const nextRound = currentRound + 1;
        const nextMatchIndex = Math.floor(currentIndex / 2);

        let nextMatch = await Match.findOne({
            tournament: tournamentId,
            round: nextRound,
            matchIndex: nextMatchIndex
        }).session(localSession);

        if (!nextMatch) {
            console.error(`Next match not found! Round ${nextRound}, Index ${nextMatchIndex}`);
            if (!session) await localSession.abortTransaction();
            return;
        }

        // تصحيح الحالة إذا كانت المباراة معلمة بالخطأ كـ ملغاة ولكن وصلها لاعب
        if (nextMatch.status === 'cancelled') {
             nextMatch.status = 'scheduled';
        }

        const isPlayer1Slot = (currentIndex % 2 === 0);

        if (isPlayer1Slot) {
            nextMatch.player1 = winnerId;
            nextMatch.player1Team = winnerTeamName;
            nextMatch.player1TeamLogo = winnerTeamLogo;
        } else {
            nextMatch.player2 = winnerId;
            nextMatch.player2Team = winnerTeamName;
            nextMatch.player2TeamLogo = winnerTeamLogo;
        }

        await nextMatch.save({ session: localSession });

        // --- الفحص الذكي: هل الخصم ميت (Cancelled)؟ ---
        // الخصم هو الذي يأتي من المباراة المجاورة في نفس الجولة الحالية
        const opponentPrevMatchIndex = isPlayer1Slot ? (currentIndex + 1) : (currentIndex - 1);
        
        const opponentPrevMatch = await Match.findOne({
            tournament: tournamentId,
            round: currentRound,
            matchIndex: opponentPrevMatchIndex
        }).session(localSession);

        // إذا كانت المباراة السابقة للخصم "ملغاة"، هذا يعني أن الخصم لن يأتي أبداً
        const isOpponentBranchDead = opponentPrevMatch && opponentPrevMatch.status === 'cancelled';

        if (isOpponentBranchDead) {
            console.log(`Auto-advancing winner ${winnerId} through Round ${nextRound} (Opponent branch is dead).`);

            nextMatch.status = 'completed';
            nextMatch.isBye = true;
            nextMatch.winner = winnerId;

            // تصفية النتائج تلقائياً
            if (isPlayer1Slot) {
                nextMatch.scorePlayer1 = 3;
                nextMatch.scorePlayer2 = 0;
            } else {
                nextMatch.scorePlayer2 = 3;
                nextMatch.scorePlayer1 = 0;
            }

            await nextMatch.save({ session: localSession });

            // [!!!] استدعاء تكراري (Recursion) للصعود للدور الذي يليه فوراً
            // نغلق الترانزكشن الحالية أولاً لتجنب تراكم القفلات
            if (!session) await localSession.commitTransaction();

            // نستدعي الدالة مرة أخرى للمباراة الجديدة
            await advanceWinnerToNextRound(nextMatch, null);
            return;
        }

        if (!session) await localSession.commitTransaction();

    } catch (error) {
        console.error("Error in advanceWinnerToNextRound:", error);
        if (!session && localSession.inTransaction()) await localSession.abortTransaction();
    } finally {
        if (!session) localSession.endSession();
    }
}

// 3. الأتمتة (Auto Confirm)
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
            }
        }
        await session.commitTransaction();

        // معالجة التصعيد خارج الترانزكشن لتجنب المشاكل مع التكرار
        for (const match of pendingMatches) {
            await advanceWinnerToNextRound(match, null);
            processedCount++;
            if (io) {
                io.to(match._id.toString()).emit('match_updated', {
                    _id: match._id,
                    status: 'completed',
                    winner: match.winner
                });
            }
        }
    } catch (error) {
        console.error("[TournamentEngine] Error:", error);
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