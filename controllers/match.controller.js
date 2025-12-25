// server/controllers/match.controller.js
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { advanceWinnerToNextRound } = require('../services/tournamentEngine');

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
            .populate('submittedBy', 'fullName');

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

        // [جديد] التحقق من التعادل وركلات الترجيح - فقط في مباريات غير الدوري
        const isLeagueMatch = match.stage === 'league';
        if (parseInt(scoreMy) === parseInt(scoreOpponent) && !isLeagueMatch) {
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
            if (isLeagueMatch) {
                // في الدوري: لا يوجد فائز في حالة التعادل
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
        const isLeagueMatch = match.stage === 'league';

        if (match.scorePlayer1 > match.scorePlayer2) {
            finalWinnerId = match.player1;
            finalLoserId = match.player2;
        } else if (match.scorePlayer2 > match.scorePlayer1) {
            finalWinnerId = match.player2;
            finalLoserId = match.player1;
        } else {
            // حالة التعادل
            if (isLeagueMatch) {
                // في الدوري: لا يوجد فائز في حالة التعادل
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

        // تصعيد الفائز (فقط في غير الدوري)
        if (!isLeagueMatch && finalWinnerId) {
            await advanceWinnerToNextRound(match, session);
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
            await advanceWinnerToNextRound(match, session);
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
        const { winnerId } = req.body; // الأدمن يرسل ID الفائز المختار

        // تحقق أن المستخدم أدمن (يمكنك إضافتها في Middleware أيضاً)
        if (req.user.userRole !== 'Admin') {
            throw new Error("Unauthorized: Admins only.");
        }

        const match = await Match.findById(matchId).session(session);
        if (!match) throw new Error("Match not found");

        // تحديد الفائز والخاسر بناءً على قرار الأدمن
        if (winnerId === match.player1.toString()) {
            match.winner = match.player1;
            match.loser = match.player2;
            // يمكن للأدمن تعديل النتيجة يدوياً هنا لو أردنا، لكن سنبقيها كما هي
        } else if (winnerId === match.player2.toString()) {
            match.winner = match.player2;
            match.loser = match.player1;
        } else {
            throw new Error("Selected winner is not a participant.");
        }

        match.status = 'completed';
        match.dispute.isOpen = false;
        match.dispute.adminDecision = "Resolved by Admin";
        match.dispute.resolvedAt = new Date();

        await match.save({ session });

        // تصعيد الفائز
        const { advanceWinnerToNextRound } = require('../services/tournamentEngine');
        await advanceWinnerToNextRound(match, session);

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

        res.status(200).json({ success: true, message: "Dispute resolved, winner advanced." });

    } catch (error) {
        await session.abortTransaction();
        console.error("Resolve Dispute Error:", error);
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
};