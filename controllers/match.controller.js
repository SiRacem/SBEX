// server/controllers/match.controller.js
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const User = require('../models/User'); // قد نحتاجه للإشعارات
const { advanceWinnerToNextRound } = require('../services/tournamentEngine');
// const notificationService = require('../services/notificationService'); // لاحقاً

// ==========================================
// 1. رفع النتيجة (Submit Score / Proof)
// ==========================================
exports.submitResult = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { scoreMy, scoreOpponent, proofScreenshot } = req.body;
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

        // تحديث حالة المباراة للمراجعة
        match.status = 'review';
        match.submittedBy = userId;
        match.proofScreenshot = proofScreenshot; // رابط الصورة من Cloudinary/Multer
        
        // حفظ النتيجة المقترحة (مؤقتاً)
        if (isPlayer1) {
            match.scorePlayer1 = scoreMy;
            match.scorePlayer2 = scoreOpponent;
        } else {
            match.scorePlayer2 = scoreMy;
            match.scorePlayer1 = scoreOpponent;
        }

        // تحديد الفائز المبدئي بناءً على الأرقام المدخلة
        // (ملاحظة: هذا مجرد اقتراح، الاعتماد النهائي يتطلب تأكيد الخصم أو الأدمن)
        if (scoreMy > scoreOpponent) {
            match.winner = userId; 
            match.loser = isPlayer1 ? match.player2 : match.player1;
        } else {
             // منطق غريب أن يرفع شخص أنه خسر ومعه صورة، لكن ندعمها
            match.loser = userId;
            match.winner = isPlayer1 ? match.player2 : match.player1;
        }

        await match.save();

        // إشعار الخصم لتأكيد النتيجة (ToDo: Socket.io)
        
        res.status(200).json({ 
            success: true, 
            message: "Result submitted. Waiting for opponent confirmation.",
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
        const userId = req.user.id; // المستخدم الذي يضغط "Confirm"

        // 1. جلب المباراة ضمن جلسة المعاملة (Transaction Session)
        const match = await Match.findById(matchId).session(session);
        
        if (!match) {
            throw new Error("Match not found");
        }

        // 2. التحقق من الحالة
        if (match.status !== 'review') {
            throw new Error("No result submitted to confirm, or match is not in review state.");
        }

        // 3. التحقق من أن المُؤكِّد ليس هو نفس الشخص الذي رفع النتيجة
        if (match.submittedBy && match.submittedBy.toString() === userId) {
            throw new Error("You cannot confirm your own submission. Wait for the opponent or auto-confirmation.");
        }

        // 4. اعتماد النتيجة نهائياً
        match.status = 'completed';
        
        // حفظ التغييرات
        await match.save({ session });

        // 5. [الخطوة الحاسمة] تصعيد الفائز للدور التالي أو إنهاء البطولة
        // نمرر الـ match والـ session لضمان تكامل البيانات
        await advanceWinnerToNextRound(match, session);

        // 6. اعتماد المعاملة (Commit)
        await session.commitTransaction();
        
        // إرسال رد النجاح
        res.status(200).json({ 
            success: true, 
            message: "Result confirmed successfully. Winner has been advanced." 
        });

    } catch (error) {
        // التراجع عن التغييرات في حال حدوث أي خطأ
        await session.abortTransaction();
        console.error("Confirm Result Error:", error);
        
        res.status(400).json({ 
            success: false, 
            message: error.message || "Server error during confirmation" 
        });
    } finally {
        // إنهاء الجلسة
        session.endSession();
    }
};

// ==========================================
// 3. النزاعات (Dispute) - للأدمن أو المستخدم
// ==========================================
exports.reportDispute = async (req, res) => {
    // سنضيف منطق النزاع لاحقاً (بسيط نسبياً: تغيير الحالة لـ dispute وحفظ السبب)
    // ...
};


// ==========================================
// دالة مساعدة: إعلان الفائز بالبطولة
// ==========================================
async function declareTournamentWinner(tournamentId, winnerId, session) {
    const tournament = await Tournament.findById(tournamentId).session(session);
    tournament.status = 'completed';
    
    // تحديث حالة الفائز في قائمة المشاركين
    const winnerParticipant = tournament.participants.find(p => p.user.toString() === winnerId.toString());
    if (winnerParticipant) {
        winnerParticipant.status = 'winner';
    }

    await tournament.save({ session });

    // هنا يتم استدعاء دالة تحويل الأموال للفائز (سنكتبها في ملف walletController لاحقاً)
    // await distributePrizes(tournament, winnerId, session); 
    console.log(`Tournament ${tournament.title} Finished. Winner: ${winnerId}`);
}

// ==========================================
// 4. الاعتماد التلقائي للنتائج (Auto Confirm)
// ==========================================
exports.autoConfirmMatches = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // نحدد الوقت: قبل 5 دقائق من الآن
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        // نبحث عن المباريات التي:
        // 1. حالتها 'review' (تم رفع نتيجة)
        // 2. آخر تحديث لها كان قبل أكثر من 5 دقائق
        // 3. ليست في حالة نزاع (dispute)
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
            // نعتمد النتيجة تلقائياً
            match.status = 'completed';
            
            // إضافة ملاحظة في الـ Logs (اختياري)
            console.log(`Auto-confirming match ${match._id}`);

            await match.save({ session });
            
            // تصعيد الفائز
            // ملاحظة: دالة advanceWinnerToNextRound يجب أن تكون متاحة هنا
            // تأكد من تمرير الـ session للحفاظ على التزامن
            await advanceWinnerToNextRound(match, session);

            confirmedMatchesIds.push(match._id);
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            count: confirmedMatchesIds.length,
            confirmedMatches: confirmedMatchesIds,
            message: `Successfully auto-confirmed ${confirmedMatchesIds.length} matches.`
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Auto Confirm Error:", error);
        res.status(500).json({ message: "Server error during auto-confirm" });
    }
};