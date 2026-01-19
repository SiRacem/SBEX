const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Notification = require('../models/Notification');
const { advanceWinnerToNextRound } = require('./tournamentEngine');

// ⏱️ إعدادات الوقت (بالدقائق)
const ROUND_DURATION_MINUTES = 30;
const FINAL_ROUND_DURATION_MINUTES = 45;
const INACTIVITY_TIMEOUT_MINUTES = 10; // إذا لاعب غير نشط لـ 10 دقائق يُعتبر غائب

/**
 * حساب ما إذا كان اللاعب "نشطاً" أم لا
 * اللاعب نشط إذا:
 * 1. ضغط زر "جاهز"
 * 2. آخر نشاط له كان خلال الـ 10 دقائق الأخيرة
 */
function isPlayerActive(playerReadyState) {
    if (!playerReadyState || !playerReadyState.isReady) {
        return false;
    }

    // ⚡ FIX: If player is marked as ready, they are considered active regardless of time
    // This prevents cases where a player clicks ready early and then is marked "inactive" at the deadline
    return true;
}

/**
 * معالجة مباراة واحدة انتهى وقتها
 */
async function processMatchTimeout(match, io) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const p1Active = isPlayerActive(match.player1Ready);
        const p2Active = isPlayerActive(match.player2Ready);

        console.log(`[MatchTimeout] Processing match ${match._id}: P1 active=${p1Active}, P2 active=${p2Active}`);

        let winner = null;
        let loser = null;
        let completionReason = null;

        if (p1Active && p2Active) {
            // كلا اللاعبين نشطين
            if (!match.extraTimeTriggered) {
                // منح وقت إضافي (10 دقائق)
                console.log(`[MatchTimeout] Adding Extra Time for match ${match._id}`);
                const EXTRA_TIME_MINUTES = 10;
                match.roundDeadline = new Date(match.roundDeadline.getTime() + (EXTRA_TIME_MINUTES * 60 * 1000));
                match.extraTimeTriggered = true;
                await match.save({ session });

                // إشعار اللاعبين بالوقت الإضافي
                // (يمكن إضافة إشعارات هنا إذا لزم الأمر، لكن تحديث السوكت وتغير الوقت كافٍ مبدئياً)

                await session.commitTransaction();
                if (io) {
                    const roomName = `match_${match._id.toString()}`;
                    // نرسل تحديث كامل للمباراة ليظهر الوقت الجديد
                    io.to(roomName).emit('match_updated', {
                        _id: match._id,
                        roundDeadline: match.roundDeadline,
                        extraTimeTriggered: true
                    });
                    // تحديث القائمة الرئيسية
                    io.emit('tournament_updated', { _id: match.tournament });
                }
                return { processed: true, completionReason: 'extra_time_added' };
            } else {
                // انتهى الوقت الإضافي ولم يتم تقديم نتيجة -> إلغاء المباراة
                console.log(`[MatchTimeout] Extra time ended for match ${match._id}. Cancelling.`);
                completionReason = 'timeout_draw_after_extra';
                match.status = 'cancelled';
            }
        } else if (p1Active && !p2Active) {
            // اللاعب 1 نشط، اللاعب 2 غائب → اللاعب 1 يفوز
            winner = match.player1;
            loser = match.player2;
            completionReason = 'timeout_player2';
            match.scorePlayer1 = 3;
            match.scorePlayer2 = 0;
        } else if (!p1Active && p2Active) {
            // اللاعب 2 نشط، اللاعب 1 غائب → اللاعب 2 يفوز
            winner = match.player2;
            loser = match.player1;
            completionReason = 'timeout_player1';
            match.scorePlayer1 = 0;
            match.scorePlayer2 = 3;
        } else if (!p1Active && !p2Active) {
            // كلاهما غائب → إلغاء المباراة
            completionReason = 'timeout_both';
            match.status = 'cancelled';
        }

        if (winner) {
            match.winner = winner;
            match.loser = loser;
            match.status = 'completed';
        }

        match.completionReason = completionReason;
        await match.save({ session });

        // إرسال إشعارات للاعبين
        const notifications = [];

        if (completionReason === 'timeout_player2' && match.player2) {
            notifications.push({
                user: match.player2,
                type: 'MATCH_TIMEOUT_LOSS',
                title: 'notification_titles.MATCH_TIMEOUT_LOSS',
                message: 'notification_messages.MATCH_TIMEOUT_LOSS',
                relatedEntity: { id: match._id, modelName: 'Match' }
            });
            notifications.push({
                user: match.player1,
                type: 'MATCH_TIMEOUT_WIN',
                title: 'notification_titles.MATCH_TIMEOUT_WIN',
                message: 'notification_messages.MATCH_TIMEOUT_WIN',
                relatedEntity: { id: match._id, modelName: 'Match' }
            });
        } else if (completionReason === 'timeout_player1' && match.player1) {
            notifications.push({
                user: match.player1,
                type: 'MATCH_TIMEOUT_LOSS',
                title: 'notification_titles.MATCH_TIMEOUT_LOSS',
                message: 'notification_messages.MATCH_TIMEOUT_LOSS',
                relatedEntity: { id: match._id, modelName: 'Match' }
            });
            notifications.push({
                user: match.player2,
                type: 'MATCH_TIMEOUT_WIN',
                title: 'notification_titles.MATCH_TIMEOUT_WIN',
                message: 'notification_messages.MATCH_TIMEOUT_WIN',
                relatedEntity: { id: match._id, modelName: 'Match' }
            });
        } else if (completionReason === 'timeout_both') {
            if (match.player1) {
                notifications.push({
                    user: match.player1,
                    type: 'MATCH_TIMEOUT_CANCELLED',
                    title: 'notification_titles.MATCH_TIMEOUT_CANCELLED',
                    message: 'notification_messages.MATCH_TIMEOUT_CANCELLED',
                    relatedEntity: { id: match._id, modelName: 'Match' }
                });
            }
            if (match.player2) {
                notifications.push({
                    user: match.player2,
                    type: 'MATCH_TIMEOUT_CANCELLED',
                    title: 'notification_titles.MATCH_TIMEOUT_CANCELLED',
                    message: 'notification_messages.MATCH_TIMEOUT_CANCELLED',
                    relatedEntity: { id: match._id, modelName: 'Match' }
                });
            }
        }

        if (notifications.length > 0) {
            await Notification.insertMany(notifications, { session });
        }

        await session.commitTransaction();

        // تصعيد الفائز للدور التالي (إذا وجد)
        if (winner) {
            await advanceWinnerToNextRound(match, null, io);
        } else if (match.status === 'cancelled') {
            // ⚡ FIX: عندما يتم إلغاء المباراة، يجب التحقق مما إذا كان هناك خصم (من المباراة المجاورة) ينتظر بالفعل في الدور التالي
            // إذا كان الخصم موجوداً، يجب تصعيده فوراً (Bye) لأن هذا الفرع أصبح ميتاً

            const MatchModel = mongoose.model('Match'); // لمنع مشاكل الـ Circular Dependency
            const nextRound = match.round + 1;
            const nextMatchIndex = Math.floor(match.matchIndex / 2);

            const nextMatch = await MatchModel.findOne({
                tournament: match.tournament,
                round: nextRound,
                matchIndex: nextMatchIndex
            }).session(session);

            if (nextMatch) {
                // معرفة ما إذا كان الخصم قد وصل بالفعل
                const isPlayer1Slot = (match.matchIndex % 2 === 0);
                const opponentId = isPlayer1Slot ? nextMatch.player2 : nextMatch.player1;

                if (opponentId) {
                    console.log(`[MatchTimeout] Match ${match._id} cancelled. Found opponent ${opponentId} waiting in next match. Promoting them!`);

                    nextMatch.status = 'completed';
                    nextMatch.isBye = true;
                    nextMatch.winner = opponentId;

                    if (isPlayer1Slot) {
                        nextMatch.scorePlayer2 = 3;
                        nextMatch.scorePlayer1 = 0;
                    } else {
                        nextMatch.scorePlayer1 = 3;
                        nextMatch.scorePlayer2 = 0;
                    }

                    await nextMatch.save({ session });

                    // استدعاء التصعيد للمباراة التالية أيضاً (Recursion)
                    // نحتاج لاستيراد الدالة أو استخدامها إذا كانت متوفرة
                    // بما أننا داخل matchTimeoutService، قد نحتاج لاستيراد tournamentEngine
                    const { advanceWinnerToNextRound } = require('./tournamentEngine');
                    await advanceWinnerToNextRound(nextMatch, session, io);
                }
            }
        }

        // إرسال تحديثات Socket
        if (io) {
            const roomName = `match_${match._id.toString()}`;
            io.to(roomName).emit('match_updated', {
                _id: match._id,
                status: match.status,
                winner: match.winner,
                loser: match.loser,
                scorePlayer1: match.scorePlayer1,
                scorePlayer2: match.scorePlayer2,
                completionReason: match.completionReason
            });

            io.emit('tournament_updated', { _id: match.tournament });
        }

        return { processed: true, completionReason };

    } catch (error) {
        console.error('[MatchTimeout] Error processing match:', error);
        if (session.inTransaction()) await session.abortTransaction();
        return { processed: false, error: error.message };
    } finally {
        session.endSession();
    }
}

/**
 * CRON Job: فحص المباريات المنتهية وقتها
 */
async function checkMatchTimeouts(io) {
    try {
        const now = new Date();

        // جلب المباريات التي:
        // 1. حالتها scheduled (لم تبدأ بعد أو لم تنته)
        // 2. لديها roundDeadline وانتهى
        // 3. في مرحلة knockout فقط (المجموعات لا تحتاج timeout)
        const expiredMatches = await Match.find({
            status: 'scheduled',
            stage: 'knockout',
            roundDeadline: { $lte: now, $ne: null },
            // يجب أن يكون هناك لاعب واحد على الأقل
            $or: [
                { player1: { $ne: null } },
                { player2: { $ne: null } }
            ]
        });

        if (expiredMatches.length === 0) {
            return { processed: 0 };
        }

        console.log(`[MatchTimeout] Found ${expiredMatches.length} expired matches`);

        let processedCount = 0;
        for (const match of expiredMatches) {
            const result = await processMatchTimeout(match, io);
            if (result.processed) processedCount++;
        }

        return { processed: processedCount };

    } catch (error) {
        console.error('[MatchTimeout] Error in checkMatchTimeouts:', error);
        return { processed: 0, error: error.message };
    }
}

/**
 * تحديث حالة "جاهز" للاعب
 */
async function setPlayerReady(matchId, playerId, io) {
    try {
        const match = await Match.findById(matchId);
        if (!match) {
            return { success: false, message: 'Match not found' };
        }

        if (match.status !== 'scheduled') {
            return { success: false, message: 'Match is not in scheduled status' };
        }

        const now = new Date();
        const playerIdStr = playerId.toString();
        const p1Id = match.player1?.toString();
        const p2Id = match.player2?.toString();

        let isPlayer1 = playerIdStr === p1Id;
        let isPlayer2 = playerIdStr === p2Id;

        if (!isPlayer1 && !isPlayer2) {
            return { success: false, message: 'You are not a participant in this match' };
        }

        if (isPlayer1) {
            match.player1Ready = {
                isReady: true,
                readyAt: now,
                lastActivity: now
            };
        } else {
            match.player2Ready = {
                isReady: true,
                readyAt: now,
                lastActivity: now
            };
        }

        await match.save();

        // إشعار الخصم
        const opponentId = isPlayer1 ? p2Id : p1Id;
        if (opponentId && io) {
            const roomName = `match_${matchId}`;
            io.to(roomName).emit('opponent_ready', {
                matchId,
                playerId: playerIdStr,
                isPlayer1,
                readyAt: now
            });
        }

        return {
            success: true,
            isPlayer1,
            bothReady: match.player1Ready?.isReady && match.player2Ready?.isReady
        };

    } catch (error) {
        console.error('[MatchTimeout] Error in setPlayerReady:', error);
        return { success: false, message: error.message };
    }
}

/**
 * تحديث آخر نشاط للاعب (يُستدعى عند إرسال رسالة)
 */
async function updatePlayerActivity(matchId, playerId) {
    try {
        const match = await Match.findById(matchId);
        if (!match) return;

        const playerIdStr = playerId.toString();
        const p1Id = match.player1?.toString();
        const now = new Date();

        if (playerIdStr === p1Id) {
            match.player1Ready.lastActivity = now;
        } else {
            match.player2Ready.lastActivity = now;
        }

        await match.save();
    } catch (error) {
        console.error('[MatchTimeout] Error updating activity:', error);
    }
}

/**
 * الحصول على حالة الـ timeout للمباراة
 */
async function getMatchTimeoutStatus(matchId) {
    try {
        const match = await Match.findById(matchId)
            .select('roundStartTime roundDeadline player1Ready player2Ready player1 player2 status');

        if (!match) {
            return { success: false, message: 'Match not found' };
        }

        const now = new Date();
        const timeRemaining = match.roundDeadline
            ? Math.max(0, new Date(match.roundDeadline).getTime() - now.getTime())
            : null;

        return {
            success: true,
            roundStartTime: match.roundStartTime,
            roundDeadline: match.roundDeadline,
            timeRemaining, // بالميلي ثانية
            player1Ready: match.player1Ready,
            player2Ready: match.player2Ready,
            player1Active: isPlayerActive(match.player1Ready),
            player2Active: isPlayerActive(match.player2Ready)
        };

    } catch (error) {
        console.error('[MatchTimeout] Error getting status:', error);
        return { success: false, message: error.message };
    }
}

/**
 * حساب أوقات الأدوار لبطولة
 */
function calculateRoundTimes(tournamentStartTime, maxParticipants) {
    const totalRounds = Math.log2(maxParticipants);
    const roundTimes = [];

    let currentTime = new Date(tournamentStartTime);

    for (let round = 1; round <= totalRounds; round++) {
        const isFinal = round === totalRounds;
        const duration = isFinal ? FINAL_ROUND_DURATION_MINUTES : ROUND_DURATION_MINUTES;

        roundTimes.push({
            round,
            startTime: new Date(currentTime),
            deadline: new Date(currentTime.getTime() + duration * 60 * 1000),
            durationMinutes: duration
        });

        // الدور التالي يبدأ بعد انتهاء هذا الدور
        currentTime = new Date(currentTime.getTime() + duration * 60 * 1000);
    }

    return roundTimes;
}

module.exports = {
    checkMatchTimeouts,
    setPlayerReady,
    updatePlayerActivity,
    getMatchTimeoutStatus,
    calculateRoundTimes,
    isPlayerActive,
    ROUND_DURATION_MINUTES,
    FINAL_ROUND_DURATION_MINUTES,
    INACTIVITY_TIMEOUT_MINUTES
};
