// server/controllers/match.controller.js
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { advanceWinnerToNextRound } = require('../services/tournamentEngine');

// ==========================================
// Helper: تحديث إحصائيات المجموعات
// ==========================================
const updateGroupStats = async (match, session) => {
    // فقط للمباريات من نوع group أو league
    if (match.stage !== 'group' && match.stage !== 'league') return;

    const tournament = await Tournament.findById(match.tournament).session(session);
    if (!tournament) return;

    // التعامل مع ObjectId أو Object (populated)
    const player1Id = match.player1?._id?.toString() || match.player1?.toString();
    const player2Id = match.player2?._id?.toString() || match.player2?.toString();

    if (!player1Id || !player2Id) {
        console.log('[GroupStats] Missing player IDs, skipping update');
        return;
    }

    const score1 = match.scorePlayer1 || 0;
    const score2 = match.scorePlayer2 || 0;

    console.log(`[GroupStats] Raw scores from match: scorePlayer1=${match.scorePlayer1}, scorePlayer2=${match.scorePlayer2}`);
    console.log(`[GroupStats] Using scores: score1=${score1}, score2=${score2}, isDraw=${score1 === score2}`);

    // الحصول على إعدادات النقاط
    const pointsWin = tournament.groupSettings?.pointsWin || 3;
    const pointsDraw = tournament.groupSettings?.pointsDraw || 1;
    const pointsLoss = tournament.groupSettings?.pointsLoss || 0;

    console.log(`[GroupStats] Updating stats: P1=${player1Id} (${score1}), P2=${player2Id} (${score2})`);
    console.log(`[GroupStats] Tournament has ${tournament.participants.length} participants`);

    // Debug: عرض جميع المشاركين
    tournament.participants.forEach((p, i) => {
        console.log(`[GroupStats] Participant ${i}: user=${p.user?.toString()}, hasGroupStats=${!!p.groupStats}`);
    });

    // تحديث إحصائيات اللاعب الأول
    const participant1 = tournament.participants.find(p => p.user?.toString() === player1Id);
    console.log(`[GroupStats] participant1 found: ${!!participant1}, hasGroupStats: ${!!participant1?.groupStats}`);

    if (participant1 && participant1.groupStats) {
        participant1.groupStats.played += 1;
        participant1.groupStats.goalsFor += score1;
        participant1.groupStats.goalsAgainst += score2;

        if (score1 > score2) {
            participant1.groupStats.won += 1;
            participant1.groupStats.points += pointsWin;
        } else if (score1 < score2) {
            participant1.groupStats.lost += 1;
            participant1.groupStats.points += pointsLoss;
        } else {
            participant1.groupStats.drawn += 1;
            participant1.groupStats.points += pointsDraw;
        }
        console.log(`[GroupStats] P1 updated: played=${participant1.groupStats.played}, points=${participant1.groupStats.points}`);
    } else {
        console.log('[GroupStats] ⚠️ participant1 NOT found or no groupStats!');
    }

    // تحديث إحصائيات اللاعب الثاني
    const participant2 = tournament.participants.find(p => p.user?.toString() === player2Id);
    console.log(`[GroupStats] participant2 found: ${!!participant2}, hasGroupStats: ${!!participant2?.groupStats}`);

    if (participant2 && participant2.groupStats) {
        participant2.groupStats.played += 1;
        participant2.groupStats.goalsFor += score2;
        participant2.groupStats.goalsAgainst += score1;

        if (score2 > score1) {
            participant2.groupStats.won += 1;
            participant2.groupStats.points += pointsWin;
        } else if (score2 < score1) {
            participant2.groupStats.lost += 1;
            participant2.groupStats.points += pointsLoss;
        } else {
            participant2.groupStats.drawn += 1;
            participant2.groupStats.points += pointsDraw;
        }
        console.log(`[GroupStats] P2 updated: played=${participant2.groupStats.played}, points=${participant2.groupStats.points}`);
    } else {
        console.log('[GroupStats] ⚠️ participant2 NOT found or no groupStats!');
    }

    // حفظ التحديثات - markModified ضروري للـ nested arrays
    tournament.markModified('participants');
    await tournament.save({ session });
    console.log(`[GroupStats] ✅ Tournament saved! Match ${match._id}`);
};

// ==========================================
// 0. جلب مباراة واحدة بالـ ID
// ==========================================
exports.getMatchById = async (req, res) => {
    try {
        const { id } = req.params;
        const match = await Match.findById(id)
            .populate('player1', 'fullName avatarUrl')
            .populate('player2', 'fullName avatarUrl')
            .populate('winner', 'fullName')
            .populate('submittedBy', 'fullName')
            .populate('chatMessages.senderId', 'fullName avatarUrl');

        if (!match) {
            return res.status(404).json({ message: "Match not found" });
        }

        res.status(200).json(match);
    } catch (error) {
        console.error("Get Match Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ==========================================
// 1. رفع النتيجة (Submit Score / Proof)
// ==========================================
exports.submitResult = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { scoreMy, scoreOpponent, penaltiesMy, penaltiesOpponent, proofScreenshot } = req.body;
        const userId = req.user.id;

        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        // التحقق من أن المستخدم هو أحد الطرفين
        const isPlayer1 = match.player1 && match.player1.toString() === userId;
        const isPlayer2 = match.player2 && match.player2.toString() === userId;

        if (!isPlayer1 && !isPlayer2) {
            return res.status(403).json({ message: "You are not a participant in this match" });
        }

        if (match.status !== 'ongoing' && match.status !== 'scheduled') {
            return res.status(400).json({ message: "Match is not active or already completed" });
        }

        // [جديد] التحقق من التعادل وركلات الترجيح - فقط في مباريات knockout
        const isKnockoutMatch = match.stage === 'knockout';
        if (parseInt(scoreMy) === parseInt(scoreOpponent) && isKnockoutMatch) {
            if (penaltiesMy === undefined || penaltiesOpponent === undefined || penaltiesMy === '' || penaltiesOpponent === '') {
                return res.status(400).json({ message: "Draw score requires penalties result." });
            }
            if (parseInt(penaltiesMy) === parseInt(penaltiesOpponent)) {
                return res.status(400).json({ message: "Penalties cannot end in a draw." });
            }
        }

        // تحديث حالة المباراة للمراجعة
        match.status = 'review';
        match.submittedBy = userId;
        match.proofScreenshot = proofScreenshot;

        // حفظ النتيجة المقترحة
        if (isPlayer1) {
            match.scorePlayer1 = scoreMy;
            match.scorePlayer2 = scoreOpponent;
            // حفظ ركلات الترجيح إن وجدت
            if (penaltiesMy !== undefined) match.penaltiesPlayer1 = penaltiesMy;
            if (penaltiesOpponent !== undefined) match.penaltiesPlayer2 = penaltiesOpponent;
        } else {
            match.scorePlayer2 = scoreMy;
            match.scorePlayer1 = scoreOpponent;
            // حفظ ركلات الترجيح إن وجدت
            if (penaltiesMy !== undefined) match.penaltiesPlayer2 = penaltiesMy;
            if (penaltiesOpponent !== undefined) match.penaltiesPlayer1 = penaltiesOpponent;
        }

        // تحديد الفائز المبدئي (Tentative Winner)
        let tentativeWinnerId = null;
        let tentativeLoserId = null;

        if (parseInt(scoreMy) > parseInt(scoreOpponent)) {
            tentativeWinnerId = userId;
            tentativeLoserId = isPlayer1 ? match.player2 : match.player1;
        } else if (parseInt(scoreOpponent) > parseInt(scoreMy)) {
            tentativeWinnerId = isPlayer1 ? match.player2 : match.player1;
            tentativeLoserId = userId;
        } else {
            // حالة التعادل
            if (!isKnockoutMatch) {
                // في الدوري/المجموعات: لا يوجد فائز في حالة التعادل
                tentativeWinnerId = null;
                tentativeLoserId = null;
            } else {
                // خروج المغلوب: الاحتكام لركلات الترجيح
                if (parseInt(penaltiesMy) > parseInt(penaltiesOpponent)) {
                    tentativeWinnerId = userId;
                    tentativeLoserId = isPlayer1 ? match.player2 : match.player1;
                } else {
                    tentativeWinnerId = isPlayer1 ? match.player2 : match.player1;
                    tentativeLoserId = userId;
                }
            }
        }

        match.winner = tentativeWinnerId;
        match.loser = tentativeLoserId;

        await match.save();

        // إعلام الجميع في الغرفة بأن المباراة تحدثت
        if (req.io) {
            const updatedMatch = await Match.findById(matchId)
                .populate('player1', 'fullName avatarUrl')
                .populate('player2', 'fullName avatarUrl')
                .populate('winner', 'fullName')
                .populate('submittedBy', 'fullName');

            req.io.to(`match_${matchId}`).emit('match_updated', updatedMatch);
            // إرسال تحديث للجدول العام أيضاً
            req.io.emit('match_updated', updatedMatch);
        }

        res.status(200).json({
            success: true,
            message: "matchRoom.toasts.resultSubmitted",
            match
        });

    } catch (error) {
        console.error("Submit Result Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ==========================================
// 2. تأكيد النتيجة (Confirm Result)
// ==========================================
exports.confirmResult = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { matchId } = req.params;
        const { action } = req.body; // 'confirm' or 'reject'
        const userId = req.user.id;

        const match = await Match.findById(matchId).session(session);

        if (!match) throw new Error("Match not found");

        if (match.status !== 'review') {
            throw new Error("No result submitted to confirm, or match is not in review state.");
        }

        // منطق الرفض (Reject) -> فتح نزاع
        if (action === 'reject') {
            match.status = 'dispute';
            match.dispute = {
                isOpen: true,
                openedBy: userId,
                reason: "Result rejected by opponent",
                resolvedAt: null
            };
            await match.save({ session });
            await session.commitTransaction();

            if (req.io) {
                const updatedMatch = await Match.findById(matchId)
                    .populate('player1', 'fullName avatarUrl')
                    .populate('player2', 'fullName avatarUrl');
                req.io.to(`match_${matchId}`).emit('match_updated', updatedMatch);
                req.io.emit('match_updated', updatedMatch);

                // 🔔 Notify all admins about new dispute
                const Tournament = require('../models/Tournament');
                const User = require('../models/User');
                const Notification = require('../models/Notification');

                const tournament = await Tournament.findById(match.tournament);

                // Find all admin users and create notifications
                const adminUsers = await User.find({ userRole: 'Admin' }).select('_id');

                for (const admin of adminUsers) {
                    const notification = new Notification({
                        user: admin._id,
                        type: 'TOURNAMENT_DISPUTE',
                        title: 'نزاع جديد في البطولة',
                        message: `نزاع جديد: ${updatedMatch.player1?.fullName || 'لاعب 1'} vs ${updatedMatch.player2?.fullName || 'لاعب 2'} في بطولة "${tournament?.title || 'غير معروف'}"`,
                        messageParams: {
                            player1: updatedMatch.player1?.fullName,
                            player2: updatedMatch.player2?.fullName,
                            tournamentTitle: tournament?.title
                        },
                        relatedEntity: {
                            id: matchId,
                            modelName: 'Match'
                        }
                    });
                    await notification.save();

                    // Emit socket to specific admin
                    req.io.emit('new_notification', { userId: admin._id, notification });
                }

                // Also emit general admin notification for toast
                req.io.emit('admin_notification', {
                    type: 'new_dispute',
                    matchId: matchId,
                    tournamentId: match.tournament,
                    tournamentTitle: tournament?.title || 'Unknown',
                    player1: updatedMatch.player1?.fullName,
                    player2: updatedMatch.player2?.fullName,
                    message: 'نزاع جديد مفتوح في المباراة'
                });
            }
            return res.status(200).json({ success: true, message: "Dispute opened successfully" });
        }

        // منطق التأكيد (Confirm)
        if (match.submittedBy && match.submittedBy.toString() === userId) {
            throw new Error("You cannot confirm your own submission.");
        }

        // التأكد من الفائز النهائي (إعادة حساب للأمان)
        let finalWinnerId = null;
        let finalLoserId = null;
        const isKnockoutMatch = match.stage === 'knockout';

        if (match.scorePlayer1 > match.scorePlayer2) {
            finalWinnerId = match.player1;
            finalLoserId = match.player2;
        } else if (match.scorePlayer2 > match.scorePlayer1) {
            finalWinnerId = match.player2;
            finalLoserId = match.player1;
        } else {
            // حالة التعادل
            if (!isKnockoutMatch) {
                // في الدوري/المجموعات: لا يوجد فائز في حالة التعادل
                finalWinnerId = null;
                finalLoserId = null;
            } else {
                // خروج المغلوب -> ركلات الترجيح
                if (match.penaltiesPlayer1 > match.penaltiesPlayer2) {
                    finalWinnerId = match.player1;
                    finalLoserId = match.player2;
                } else {
                    finalWinnerId = match.player2;
                    finalLoserId = match.player1;
                }
            }
        }

        match.winner = finalWinnerId;
        match.loser = finalLoserId;
        match.status = 'completed';

        await match.save({ session });

        // تصعيد الفائز (فقط في knockout)
        if (isKnockoutMatch && finalWinnerId) {
            await advanceWinnerToNextRound(match, session, req.io);
        }

        // تحديث إحصائيات المجموعات (للـ group و league)
        console.log(`[ConfirmResult] Match stage: ${match.stage}, checking if group/league...`);
        if (match.stage === 'group' || match.stage === 'league') {
            console.log('[ConfirmResult] Calling updateGroupStats...');
            await updateGroupStats(match, session);
            console.log('[ConfirmResult] updateGroupStats completed');
        } else {
            console.log(`[ConfirmResult] Skipping updateGroupStats - stage is ${match.stage}`);
        }

        await session.commitTransaction();
        session.endSession();

        // Fetch updated match for response and socket (outside transaction)
        let updatedMatch = null;
        if (req.io) {
            updatedMatch = await Match.findById(matchId)
                .populate('player1', 'fullName avatarUrl')
                .populate('player2', 'fullName avatarUrl')
                .populate('winner', 'fullName');
            req.io.to(`match_${matchId}`).emit('match_updated', updatedMatch);
            req.io.emit('match_updated', updatedMatch);

            // إرسال تحديث البطولة مع الإحصائيات الجديدة
            const updatedTournament = await Tournament.findById(match.tournament)
                .populate('participants.user', 'fullName avatarUrl')
                .lean();
            if (updatedTournament) {
                const tournamentMatches = await Match.find({ tournament: match.tournament }).lean();
                updatedTournament.matches = tournamentMatches;
                req.io.emit('tournament_updated', updatedTournament);
                console.log('[ConfirmResult] Tournament updated event sent with groupStats');
            }
        }

        // 🏆 Check if tournament is complete and distribute prizes
        try {
            console.log('[PRIZE CHECK] Calling checkAndDistributePrizes for tournament:', match.tournament);
            const { checkAndDistributePrizes } = require('../services/tournamentPrize.service');
            const prizeResult = await checkAndDistributePrizes(match.tournament, req.io);
            if (prizeResult) {
                console.log('[PRIZE CHECK] ✅ Tournament completed! Prizes distributed:', prizeResult);
            } else {
                console.log('[PRIZE CHECK] Tournament not yet complete or prizes already distributed');
            }
        } catch (prizeError) {
            console.error('[PRIZE CHECK] ❌ Prize distribution check failed:', prizeError.message);
        }

        res.status(200).json({
            success: true,
            message: "Result confirmed successfully.",
            match: updatedMatch
        });

    } catch (error) {
        // Only abort if session is still in transaction
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error("Confirm Result Error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Server error during confirmation"
        });
    }
};

// ==========================================
// 3. النزاعات (Dispute)
// ==========================================
exports.reportDispute = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { reason, proofImage } = req.body;
        const userId = req.user.id;

        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: "Match not found" });

        match.status = 'dispute';
        match.dispute = {
            isOpen: true,
            openedBy: userId,
            reason,
            proofImage
        };
        await match.save();

        if (req.io) {
            req.io.to(`match_${matchId}`).emit('match_updated', match);
            req.io.emit('match_updated', match);
        }

        res.status(200).json({ success: true, message: "Dispute submitted" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ==========================================
// 4. الاعتماد التلقائي للنتائج (Auto Confirm)
// ==========================================
exports.autoConfirmMatches = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const pendingMatches = await Match.find({
            status: 'review',
            updatedAt: { $lte: fiveMinutesAgo },
            'dispute.isOpen': false
        }).session(session);

        if (pendingMatches.length === 0) {
            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({ message: "No matches to auto-confirm." });
        }

        const confirmedMatchesIds = [];

        for (const match of pendingMatches) {
            match.status = 'completed';
            // الفائز محدد مسبقاً في submitResult، لذا نعتمد عليه
            await match.save({ session });
            await advanceWinnerToNextRound(match, session, req.io);
            confirmedMatchesIds.push(match._id);
        }

        await session.commitTransaction();

        // إشعار بالسوكيت
        if (req.io && confirmedMatchesIds.length > 0) {
            confirmedMatchesIds.forEach(async (id) => {
                const m = await Match.findById(id).populate('winner', 'fullName');
                req.io.to(`match_${id}`).emit('match_updated', m);
                req.io.emit('match_updated', m);
            });
        }

        session.endSession();

        res.status(200).json({
            success: true,
            count: confirmedMatchesIds.length,
            message: `Successfully auto-confirmed ${confirmedMatchesIds.length} matches.`
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Auto Confirm Error:", error);
        res.status(500).json({ message: "Server error during auto-confirm" });
    }
};

// ==========================================
// 5. حل النزاع (Admin Only)
// ==========================================
exports.resolveDispute = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { matchId } = req.params;
        const { winnerId, scorePlayer1, scorePlayer2, penaltiesPlayer1, penaltiesPlayer2, isDraw } = req.body;

        // تحقق أن المستخدم أدمن
        if (req.user.userRole !== 'Admin') {
            throw new Error("Unauthorized: Admins only.");
        }

        const match = await Match.findById(matchId).session(session);
        if (!match) throw new Error("Match not found");

        // تحديث النتائج إذا تم تقديمها
        if (scorePlayer1 !== undefined) match.scorePlayer1 = scorePlayer1;
        if (scorePlayer2 !== undefined) match.scorePlayer2 = scorePlayer2;

        // تحديث ضربات الجزاء إذا تم تقديمها (للـ knockout)
        if (penaltiesPlayer1 !== undefined) match.penaltiesPlayer1 = penaltiesPlayer1;
        if (penaltiesPlayer2 !== undefined) match.penaltiesPlayer2 = penaltiesPlayer2;

        // التعامل مع التعادل (للدوري فقط)
        if (isDraw) {
            // في الدوري، لا يوجد فائز أو خاسر
            match.winner = null;
            match.loser = null;
        } else if (winnerId) {
            // تحديد الفائز والخاسر بناءً على قرار الأدمن
            if (winnerId === match.player1.toString()) {
                match.winner = match.player1;
                match.loser = match.player2;
            } else if (winnerId === match.player2.toString()) {
                match.winner = match.player2;
                match.loser = match.player1;
            } else {
                throw new Error("Selected winner is not a participant.");
            }
        } else {
            throw new Error("Must select a winner or mark as draw.");
        }

        match.status = 'completed';
        match.dispute.isOpen = false;
        match.dispute.adminDecision = isDraw ? "Resolved as Draw by Admin" : "Resolved by Admin";
        match.dispute.resolvedAt = new Date();

        await match.save({ session });

        // تصعيد الفائز (فقط في غير الدوري/المجموعات)
        const isGroupOrLeague = match.stage === 'group' || match.stage === 'league';
        if (!isGroupOrLeague && !isDraw && match.winner) {
            const { advanceWinnerToNextRound } = require('../services/tournamentEngine');
            await advanceWinnerToNextRound(match, session, req.io);
        }

        // تحديث إحصائيات المجموعات (للـ group و league)
        if (isGroupOrLeague) {
            await updateGroupStats(match, session);
        }

        await session.commitTransaction();

        // إشعار الجميع
        if (req.io) {
            const updatedMatch = await Match.findById(matchId)
                .populate('player1', 'fullName avatarUrl')
                .populate('player2', 'fullName avatarUrl')
                .populate('winner', 'fullName');

            const roomName = `match_${matchId}`;
            req.io.to(roomName).emit('match_updated', updatedMatch);
            req.io.emit('tournament_updated', { _id: match.tournament });
            req.io.emit('match_updated', updatedMatch); // للجدول
        }

        // 🏆 Check if tournament is complete and distribute prizes
        try {
            const { checkAndDistributePrizes } = require('../services/tournamentPrize.service');
            await checkAndDistributePrizes(match.tournament, req.io);
        } catch (prizeError) {
            console.error('Prize distribution check failed (non-critical):', prizeError.message);
        }

        res.status(200).json({ success: true, message: "Dispute resolved, winner advanced." });

    } catch (error) {
        await session.abortTransaction();
        console.error("Resolve Dispute Error:", error);
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
};