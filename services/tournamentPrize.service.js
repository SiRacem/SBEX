// services/tournamentPrize.service.js
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * حساب ترتيب الدوري من المباريات المكتملة
 */
const calculateLeagueStandings = async (tournamentId) => {
    const matches = await Match.find({
        tournament: tournamentId,
        status: 'completed'
    }).populate('player1 player2', '_id fullName');

    // خريطة لحفظ إحصائيات كل لاعب
    const statsMap = {};

    for (const match of matches) {
        const p1Id = match.player1?._id?.toString();
        const p2Id = match.player2?._id?.toString();

        if (!p1Id || !p2Id) continue;

        // تهيئة الإحصائيات
        if (!statsMap[p1Id]) {
            statsMap[p1Id] = {
                playerId: p1Id,
                fullName: match.player1.fullName || 'Unknown',
                points: 0, goalsFor: 0, goalsAgainst: 0, played: 0, won: 0, drawn: 0, lost: 0
            };
        }
        if (!statsMap[p2Id]) {
            statsMap[p2Id] = {
                playerId: p2Id,
                fullName: match.player2.fullName || 'Unknown',
                points: 0, goalsFor: 0, goalsAgainst: 0, played: 0, won: 0, drawn: 0, lost: 0
            };
        }

        const score1 = match.scorePlayer1 || 0;
        const score2 = match.scorePlayer2 || 0;

        // تحديث الإحصائيات
        statsMap[p1Id].played++;
        statsMap[p2Id].played++;
        statsMap[p1Id].goalsFor += score1;
        statsMap[p1Id].goalsAgainst += score2;
        statsMap[p2Id].goalsFor += score2;
        statsMap[p2Id].goalsAgainst += score1;

        if (match.winner) {
            const winnerId = match.winner.toString();
            if (winnerId === p1Id) {
                statsMap[p1Id].won++;
                statsMap[p1Id].points += 3;
                statsMap[p2Id].lost++;
            } else if (winnerId === p2Id) {
                statsMap[p2Id].won++;
                statsMap[p2Id].points += 3;
                statsMap[p1Id].lost++;
            }
        } else {
            // تعادل
            statsMap[p1Id].drawn++;
            statsMap[p2Id].drawn++;
            statsMap[p1Id].points += 1;
            statsMap[p2Id].points += 1;
        }
    }

    // تحويل إلى مصفوفة وترتيب
    const standings = Object.values(statsMap).map(stats => ({
        ...stats,
        goalDifference: stats.goalsFor - stats.goalsAgainst
    }));

    // الترتيب: النقاط أولاً، ثم فارق الأهداف، ثم الأهداف المسجلة
    standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });

    return standings;
};

/**
 * الحصول على هداف البطولة
 */
const getTopScorer = async (tournamentId) => {
    const matches = await Match.find({
        tournament: tournamentId,
        status: 'completed'
    }).populate('player1 player2', '_id fullName');

    const scorerMap = {};

    for (const match of matches) {
        const p1Id = match.player1?._id?.toString();
        const p2Id = match.player2?._id?.toString();

        if (!p1Id || !p2Id) continue;

        if (!scorerMap[p1Id]) scorerMap[p1Id] = { playerId: p1Id, fullName: match.player1.fullName, goals: 0 };
        if (!scorerMap[p2Id]) scorerMap[p2Id] = { playerId: p2Id, fullName: match.player2.fullName, goals: 0 };

        scorerMap[p1Id].goals += (match.scorePlayer1 || 0);
        scorerMap[p2Id].goals += (match.scorePlayer2 || 0);
    }

    const scorers = Object.values(scorerMap);
    scorers.sort((a, b) => b.goals - a.goals);
    return scorers[0] || null;
};

/**
 * الحصول على أفضل دفاع (أقل أهداف ضده)
 */
const getBestDefense = async (tournamentId) => {
    const standings = await calculateLeagueStandings(tournamentId);

    if (standings.length === 0) return null;

    // ترتيب حسب أقل أهداف ضده
    const defenseRanking = [...standings].sort((a, b) => a.goalsAgainst - b.goalsAgainst);
    return defenseRanking[0] || null;
};

/**
 * إنشاء معاملة جائزة
 */
const createPrizeTransaction = async (userId, amount, tournamentId, prizeType, session) => {
    const transaction = new Transaction({
        user: userId,
        amount: amount,
        currency: 'TND',
        type: 'TOURNAMENT_PRIZE',
        status: 'COMPLETED',
        description: `transactionTypes.TOURNAMENT_PRIZE`,
        descriptionKey: 'transactionTypes.TOURNAMENT_PRIZE',
        descriptionParams: { prizeType },
        metadata: {
            tournamentId,
            prizeType
        }
    });

    await transaction.save({ session });
    return transaction;
};

/**
 * توزيع الجوائز للدوري
 */
const distributeLeaguePrizes = async (tournament, session) => {
    const prizes = tournament.prizesDistribution;
    const results = [];

    // تهيئة winners object
    if (!tournament.winners) tournament.winners = {};

    // المركز الأول
    const standings = await calculateLeagueStandings(tournament._id);
    if (standings.length > 0 && prizes.firstPlace > 0) {
        const winner = standings[0];
        await User.findByIdAndUpdate(
            winner.playerId,
            { $inc: { balance: prizes.firstPlace } },
            { session }
        );
        await createPrizeTransaction(winner.playerId, prizes.firstPlace, tournament._id, 'First Place', session);

        // البحث عن تفاصيل الفريق
        const participant = tournament.participants.find(p => p.user.toString() === winner.playerId);
        tournament.winners.champion = {
            user: winner.playerId,
            teamName: participant?.selectedTeam || winner.fullName,
            teamLogo: participant?.selectedTeamLogo,
            prize: prizes.firstPlace
        };

        results.push({ type: 'firstPlace', player: winner.fullName, amount: prizes.firstPlace });
    }

    // أفضل هداف
    if (prizes.bestAttack > 0) {
        const topScorer = await getTopScorer(tournament._id);
        if (topScorer) {
            await User.findByIdAndUpdate(
                topScorer.playerId,
                { $inc: { balance: prizes.bestAttack } },
                { session }
            );
            await createPrizeTransaction(topScorer.playerId, prizes.bestAttack, tournament._id, 'Top Scorer', session);

            const participant = tournament.participants.find(p => p.user.toString() === topScorer.playerId);
            tournament.winners.topScorer = {
                user: topScorer.playerId,
                teamName: participant?.selectedTeam || topScorer.fullName,
                teamLogo: participant?.selectedTeamLogo,
                goals: topScorer.goals,
                prize: prizes.bestAttack
            };

            results.push({ type: 'topScorer', player: topScorer.fullName, amount: prizes.bestAttack, goals: topScorer.goals });
        }
    }

    // أفضل دفاع
    if (prizes.bestDefense > 0) {
        const bestDef = await getBestDefense(tournament._id);
        if (bestDef) {
            await User.findByIdAndUpdate(
                bestDef.playerId,
                { $inc: { balance: prizes.bestDefense } },
                { session }
            );
            await createPrizeTransaction(bestDef.playerId, prizes.bestDefense, tournament._id, 'Best Defense', session);

            const participant = tournament.participants.find(p => p.user.toString() === bestDef.playerId);
            tournament.winners.bestDefense = {
                user: bestDef.playerId,
                teamName: participant?.selectedTeam || bestDef.fullName,
                teamLogo: participant?.selectedTeamLogo,
                goalsAgainst: bestDef.goalsAgainst,
                prize: prizes.bestDefense
            };

            results.push({ type: 'bestDefense', player: bestDef.fullName, amount: prizes.bestDefense, goalsAgainst: bestDef.goalsAgainst });
        }
    }

    return results;
};

/**
 * توزيع الجوائز للكأس (Knockout)
 */
const distributeKnockoutPrizes = async (tournament, session) => {
    const prizes = tournament.prizesDistribution;
    const results = [];

    // البحث عن مباراة النهائي
    const finalMatch = await Match.findOne({
        tournament: tournament._id,
        stage: { $in: ['final', 'finals'] },
        status: 'completed'
    }).populate('winner loser', '_id fullName');

    if (!finalMatch) {
        console.log('Final match not found for knockout tournament');
        return results;
    }

    // المركز الأول (الفائز بالنهائي)
    if (finalMatch.winner && prizes.firstPlace > 0) {
        await User.findByIdAndUpdate(
            finalMatch.winner._id,
            { $inc: { balance: prizes.firstPlace } },
            { session }
        );
        await createPrizeTransaction(finalMatch.winner._id, prizes.firstPlace, tournament._id, 'Champion', session);
        results.push({ type: 'champion', player: finalMatch.winner.fullName, amount: prizes.firstPlace });
    }

    // المركز الثاني (الخاسر في النهائي)
    if (finalMatch.loser && prizes.secondPlace > 0) {
        await User.findByIdAndUpdate(
            finalMatch.loser._id,
            { $inc: { balance: prizes.secondPlace } },
            { session }
        );
        await createPrizeTransaction(finalMatch.loser._id, prizes.secondPlace, tournament._id, 'Runner-up', session);
        results.push({ type: 'runnerUp', player: finalMatch.loser.fullName, amount: prizes.secondPlace });
    }

    return results;
};

/**
 * التحقق من اكتمال البطولة وتوزيع الجوائز
 */
const checkAndDistributePrizes = async (tournamentId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const tournament = await Tournament.findById(tournamentId).session(session);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        // التحقق من أن البطولة لم يتم توزيع جوائزها بعد
        if (tournament.status === 'completed') {
            console.log('Tournament already completed, prizes already distributed');
            await session.abortTransaction();
            session.endSession();
            return null;
        }

        // حساب عدد المباريات المطلوبة والمكتملة
        const allMatches = await Match.find({ tournament: tournamentId }).session(session);
        const completedMatches = allMatches.filter(m => m.status === 'completed');
        const pendingMatches = allMatches.filter(m => m.status !== 'completed' && m.status !== 'cancelled' && m.player1 && m.player2);

        console.log('=== Tournament Completion Check ===');
        console.log(`Tournament ID: ${tournamentId}`);
        console.log(`Tournament Format: ${tournament.format}`);
        console.log(`Tournament Status: ${tournament.status}`);
        console.log(`Total Matches: ${allMatches.length}`);
        console.log(`Completed Matches: ${completedMatches.length}`);
        console.log(`Pending Matches: ${pendingMatches.length}`);

        if (pendingMatches.length > 0) {
            console.log('Pending matches details:');
            pendingMatches.forEach((m, i) => {
                console.log(`  ${i + 1}. Match ${m._id}: status=${m.status}, player1=${m.player1}, player2=${m.player2}`);
            });
        }

        // إذا لا تزال هناك مباريات قيد الانتظار، لا تكمل البطولة
        if (pendingMatches.length > 0) {
            console.log('>>> Tournament NOT complete - still has pending matches');
            await session.abortTransaction();
            session.endSession();
            return null;
        }

        console.log('>>> All matches completed! Distributing prizes...');

        // توزيع الجوائز حسب نوع البطولة
        let prizeResults;
        if (tournament.format === 'league') {
            prizeResults = await distributeLeaguePrizes(tournament, session);
        } else {
            prizeResults = await distributeKnockoutPrizes(tournament, session);
        }

        // تحديث حالة البطولة
        tournament.status = 'completed';
        tournament.currentStage = 'finished';
        await tournament.save({ session });

        await session.commitTransaction();

        // إرسال إشعار Socket
        if (io) {
            io.emit('tournament_completed', {
                tournamentId: tournament._id,
                tournamentTitle: tournament.title,
                prizes: prizeResults
            });
            io.emit('tournament_updated', tournament);
        }

        console.log('Tournament completed and prizes distributed:', prizeResults);
        return prizeResults;

    } catch (error) {
        await session.abortTransaction();
        console.error('Error distributing prizes:', error);
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = {
    calculateLeagueStandings,
    getTopScorer,
    getBestDefense,
    checkAndDistributePrizes,
    distributeLeaguePrizes,
    distributeKnockoutPrizes
};
