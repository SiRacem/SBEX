const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const { runAutoConfirmJob, advanceWinnerToNextRound } = require('../services/tournamentEngine');

// دالة مساعدة لتوليد ترتيب التوزيع (Seeding Order) لتباعد الأقوياء
const getSeedingOrder = (numMatches) => {
    if (numMatches <= 1) return [0];
    const half = getSeedingOrder(numMatches / 2);
    // لكل عنصر x في النصف الأول، العنصر المقابل هو (عدد المباريات - 1 - x)
    return half.flatMap(x => [x, numMatches - 1 - x]);
};

// --- Helper: المنطق الأساسي لتوليد الجدول كاملاً (Smart Bracket Generation) ---
const generateFullBracketAndStart = async (tournament, activeParticipants, session, io) => {
    const maxParticipants = tournament.maxParticipants;
    const totalRounds = Math.log2(maxParticipants);
    
    // 1. خلط المشاركين عشوائياً (Shuffle)
    for (let i = activeParticipants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [activeParticipants[i], activeParticipants[j]] = [activeParticipants[j], activeParticipants[i]];
    }

    // 2. تحضير أزواج الجولة الأولى باستخدام التوزيع (Seeding)
    const round1MatchesCount = maxParticipants / 2;
    let round1Pairs = Array.from({ length: round1MatchesCount }, () => [null, null]);
    
    const seedingOrder = getSeedingOrder(round1MatchesCount);
    let currentParticipantIdx = 0;

    // ملء الخانة الأولى
    for (let i = 0; i < seedingOrder.length && currentParticipantIdx < activeParticipants.length; i++) {
        const matchIndex = seedingOrder[i];
        round1Pairs[matchIndex][0] = activeParticipants[currentParticipantIdx++];
    }
    // ملء الخانة الثانية (عكسياً)
    const reverseSeedingOrder = [...seedingOrder].reverse();
    for (let i = 0; i < reverseSeedingOrder.length && currentParticipantIdx < activeParticipants.length; i++) {
        const matchIndex = reverseSeedingOrder[i];
        round1Pairs[matchIndex][1] = activeParticipants[currentParticipantIdx++];
    }

    const allMatchesToCreate = [];
    
    // خريطة لتتبع حالة المباريات: 'round-index' -> status
    // نستخدمها لمعرفة ما إذا كانت الجولات القادمة ستكون ملغاة تلقائياً
    const matchesStatusMap = {};

    // 3. إنشاء الجولات بالتسلسل (من 1 إلى النهائي)
    for (let r = 1; r <= totalRounds; r++) {
        const matchesInRound = maxParticipants / Math.pow(2, r);
        
        for (let i = 0; i < matchesInRound; i++) {
            let matchData = {
                _id: new mongoose.Types.ObjectId(),
                tournament: tournament._id,
                round: r,
                matchIndex: i,
                status: 'scheduled',
                isBye: false,
                player1: null, player2: null,
                player1Team: null, player2Team: null,
                player1TeamLogo: null, player2TeamLogo: null,
                winner: null
            };

            if (r === 1) {
                // --- منطق الجولة الأولى ---
                const p1 = round1Pairs[i][0];
                const p2 = round1Pairs[i][1];

                matchData.player1 = p1 ? p1.user : null;
                matchData.player1Team = p1 ? p1.selectedTeam : null;
                matchData.player1TeamLogo = p1 ? p1.selectedTeamLogo : null;

                matchData.player2 = p2 ? p2.user : null;
                matchData.player2Team = p2 ? p2.selectedTeam : null;
                matchData.player2TeamLogo = p2 ? p2.selectedTeamLogo : null;

                if (p1 && p2) {
                    matchData.status = 'scheduled';
                } else if (p1 && !p2) {
                    // Bye للاعب 1
                    matchData.isBye = true;
                    matchData.status = 'completed';
                    matchData.winner = p1.user;
                    matchData.scorePlayer1 = 3; 
                } else if (!p1 && p2) {
                    // Bye للاعب 2
                    matchData.isBye = true;
                    matchData.status = 'completed';
                    matchData.winner = p2.user;
                    matchData.scorePlayer2 = 3;
                } else {
                    // لا يوجد لاعبين = مباراة ملغاة (مسار ميت)
                    matchData.status = 'cancelled'; 
                }

            } else {
                // --- منطق الجولات اللاحقة (2, 3, 4...) ---
                // نتحقق من مصادر هذه المباراة (المباريات في الجولة السابقة)
                // في النظام الشجري الثنائي: الوالدين هما i*2 و i*2+1 من الجولة السابقة
                const parent1Index = i * 2;
                const parent2Index = i * 2 + 1;
                const prevRound = r - 1;

                const parent1Status = matchesStatusMap[`${prevRound}-${parent1Index}`];
                const parent2Status = matchesStatusMap[`${prevRound}-${parent2Index}`];

                // إذا كان كلا الوالدين "ملغيين" (Cancelled)، فهذا يعني لن يأتي أحد لهذه المباراة أبداً
                if (parent1Status === 'cancelled' && parent2Status === 'cancelled') {
                    matchData.status = 'cancelled';
                } 
                // عدا ذلك تبقى 'scheduled' بانتظار الفائزين
            }

            // تسجيل الحالة لاستخدامها في حساب الجولة التالية
            matchesStatusMap[`${r}-${i}`] = matchData.status;
            allMatchesToCreate.push(matchData);
        }
    }

    await Match.insertMany(allMatchesToCreate, { session });

    tournament.status = 'active';
    tournament.startDate = new Date();
    await tournament.save({ session });

    // إرجاع المباريات التي تحتاج لتصعيد فوري (Byes من الجولة الأولى)
    const matchesToAdvance = allMatchesToCreate.filter(m => m.round === 1 && m.isBye && m.status === 'completed');
    
    return matchesToAdvance;
};

// ==========================================
// 1. إنشاء البطولة (Admin Only)
// ==========================================
exports.createTournament = async (req, res) => {
    try {
        const {
            title, description, entryFee, prizePool, prizesDistribution,
            maxParticipants, startDate, incompleteAction, 
            rules 
        } = req.body;

        if (new Date(startDate) <= new Date()) {
            return res.status(400).json({ message: "Start date must be in the future." });
        }

        const tournamentRules = {
            teamCategory: rules.teamCategory,
            matchDurationMinutes: rules.matchDurationMinutes,
            breakDurationMinutes: rules.breakDurationMinutes || 10,
            eFootballMatchTime: rules.eFootballMatchTime,
            specificLeague: rules.specificLeague || null
        };

        const newTournament = new Tournament({
            title, description, entryFee, prizePool, prizesDistribution,
            maxParticipants, startDate, incompleteAction,
            rules: tournamentRules,
            createdBy: req.user._id
        });

        const savedTournament = await newTournament.save();

        if (req.io) {
            req.io.emit('tournament_created', savedTournament);
        }
        
        res.status(201).json({
            success: true,
            message: "Tournament created successfully",
            tournament: savedTournament
        });

    } catch (error) {
        console.error("Create Tournament Error:", error);
        res.status(500).json({ message: "Server error while creating tournament" });
    }
};

// ==========================================
// 2. الانضمام للبطولة
// ==========================================
exports.joinTournament = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { selectedTeam, selectedTeamLogo } = req.body;
        const userId = req.user._id;

        const tournament = await Tournament.findById(id).session(session);
        const user = await User.findById(userId).session(session);

        if (!tournament) throw new Error("Tournament not found");
        if (!user) throw new Error("User not found");

        if (tournament.status !== 'open') throw new Error("apiErrors.registrationClosed");
        if (tournament.participants.length >= tournament.maxParticipants) throw new Error("Tournament is full");

        const isAlreadyJoined = tournament.participants.some(p => p.user.toString() === userId.toString());
        if (isAlreadyJoined) throw new Error("You have already joined this tournament");

        const isTeamTaken = tournament.participants.some(
            p => p.selectedTeam.toLowerCase() === selectedTeam.toLowerCase()
        );
        if (isTeamTaken) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: `The team '${selectedTeam}' is already taken.` });
        }

        if (user.balance < tournament.entryFee) {
            throw new Error("Insufficient balance");
        }

        user.balance -= tournament.entryFee;
        await user.save({ session });

        await Transaction.create([{
            user: userId,
            amount: -tournament.entryFee,
            currency: 'TND',
            type: 'TOURNAMENT_ENTRY',
            descriptionKey: 'transactionDescriptions.tournament_entry',
            descriptionParams: { tournamentTitle: tournament.title },
            status: 'COMPLETED',
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });

        const newParticipant = {
            user: userId,
            username: user.fullName,
            avatar: user.avatarUrl,
            selectedTeam: selectedTeam,
            selectedTeamLogo: selectedTeamLogo,
            status: 'registered',
            joinedAt: new Date()
        };

        tournament.participants.push(newParticipant);
        await tournament.save({ session });

        await Notification.create([{
            user: userId,
            type: 'TOURNAMENT_JOIN_SUCCESS',
            title: 'notification_titles.TOURNAMENT_JOIN_SUCCESS',
            message: 'notification_messages.TOURNAMENT_JOIN_SUCCESS',
            messageParams: { title: tournament.title },
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });

        await session.commitTransaction();
        
        if (req.io) {
            req.io.to(userId.toString()).emit('user_balances_updated', { _id: userId, balance: user.balance });
            req.io.to(userId.toString()).emit('dashboard_transactions_updated');
            req.io.emit('tournament_participant_joined', { 
                tournamentId: id, 
                participant: newParticipant,
                takenTeam: selectedTeam 
            });
        }

        res.status(200).json({ success: true, message: "Successfully joined", selectedTeam });

    } catch (error) {
        await session.abortTransaction();
        console.error("Join Tournament Error:", error);
        
        if (error.message.includes('Write conflict') || error.codeName === 'WriteConflict') {
            return res.status(409).json({ success: false, message: "apiErrors.writeConflict" });
        }
        
        res.status(400).json({ 
            success: false, 
            message: error.message.includes(' ') ? "apiErrors.serverError" : error.message 
        });
    } finally {
        session.endSession();
    }
};

// ==========================================
// 3. بدء البطولة (يدوياً) - تم تحديثها
// ==========================================
exports.startTournament = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const tournament = await Tournament.findById(id).session(session);

        if (!tournament) throw new Error("Tournament not found");
        
        let activeParticipants = tournament.participants.filter(p => p.isCheckedIn);
        if (activeParticipants.length === 0 && tournament.participants.length > 0) {
             activeParticipants = tournament.participants;
        }

        // استخدام دالة التوليد الكاملة
        const byeMatches = await generateFullBracketAndStart(tournament, activeParticipants, session, req.io);

        await session.commitTransaction();
        
        // معالجة الصعود التلقائي (Byes) بعد الـ commit لضمان عمل التكرار (Recursion)
        console.log(`[StartTournament] Processing ${byeMatches.length} Byes...`);
        for (const m of byeMatches) {
            try {
                // جلب النسخة المحدثة من القاعدة
                const matchDoc = await Match.findById(m._id); 
                // نمرر null كـ session ليقوم المحرك بإدارة الترانزكشن الخاصة به
                await advanceWinnerToNextRound(matchDoc, null);
            } catch (err) {
                console.error(`Failed to advance match ${m._id}:`, err);
            }
        }

        if (req.io) req.io.emit('tournament_updated', { _id: tournament._id, status: 'active' });

        res.status(200).json({
            success: true,
            message: "Tournament started successfully with full bracket."
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Start Tournament Error:", error);
        res.status(500).json({ message: error.message || "Server error" });
    } finally {
        session.endSession();
    }
};

// ==========================================
// 8. CRON JOB (التلقائي) - تم تحديثها
// ==========================================
exports.checkAndStartScheduledTournaments = async (io) => {
    const session = await mongoose.startSession();
    
    try {
        const now = new Date();
        const tournamentsToStart = await Tournament.find({
            status: { $in: ['open', 'check-in'] },
            startDate: { $lte: now }
        });

        if (tournamentsToStart.length === 0) return;

        console.log(`[Tournament Cron] Found ${tournamentsToStart.length} tournaments.`);

        for (const tournament of tournamentsToStart) {
            // نبدأ معاملة جديدة لكل بطولة لتجنب تعطل الكل بسبب واحدة
            session.startTransaction();
            try {
                const t = await Tournament.findById(tournament._id).session(session);
                
                let activeParticipants = t.participants;
                if (t.status === 'check-in') {
                    activeParticipants = t.participants.filter(p => p.isCheckedIn);
                }

                const maxPlayers = t.maxParticipants;
                // يجب توفر لاعبين اثنين على الأقل
                if (activeParticipants.length < 2 || 
                   (activeParticipants.length < maxPlayers && t.incompleteAction === 'cancel')) {
                    
                    console.log(`[Tournament Cron] Cancelling tournament ${t.title}`);
                    t.status = 'cancelled';
                    await t.save({ session });

                    // إعادة الأموال
                    for (const p of t.participants) {
                        const user = await User.findById(p.user).session(session);
                        if (user) {
                            user.balance += t.entryFee;
                            await user.save({ session });

                            await Transaction.create([{
                                user: user._id,
                                amount: t.entryFee,
                                currency: 'TND',
                                type: 'TOURNAMENT_REFUND',
                                descriptionKey: 'transactionDescriptions.tournament_refund',
                                descriptionParams: { tournamentTitle: t.title },
                                status: 'COMPLETED',
                                relatedEntity: { id: t._id, modelName: 'Tournament' }
                            }], { session });

                            await Notification.create([{
                                user: user._id,
                                type: 'TOURNAMENT_REFUND',
                                title: 'notification_titles.TOURNAMENT_REFUND',
                                message: 'notification_messages.TOURNAMENT_REFUND',
                                messageParams: { title: t.title, amount: t.entryFee },
                                relatedEntity: { id: t._id, modelName: 'Tournament' }
                            }], { session });

                            if (io) {
                                io.to(user._id.toString()).emit('user_balances_updated', { _id: user._id, balance: user.balance });
                            }
                        }
                    }
                    if (io) io.emit('tournament_updated', { _id: t._id, status: 'cancelled' });

                } else {
                    // بدء البطولة وتوليد الجدول الكامل
                    console.log(`[Tournament Cron] Starting tournament ${t.title}`);
                    const byeMatches = await generateFullBracketAndStart(t, activeParticipants, session, io);
                    
                    await session.commitTransaction();

                    // معالجة الـ Byes بعد الـ Commit
                    for (const m of byeMatches) {
                        const matchDoc = await Match.findById(m._id);
                        await advanceWinnerToNextRound(matchDoc, null);
                    }
                    if (io) io.emit('tournament_updated', { _id: t._id, status: 'active' });
                    
                    // ننتقل للدورة التالية فوراً
                    continue; 
                }

                await session.commitTransaction();

            } catch (err) {
                if (session.inTransaction()) await session.abortTransaction();
                console.error(`[Tournament Cron] Error processing tournament ${tournament._id}:`, err);
            }
        }

    } catch (error) {
        console.error("[Tournament Cron] General Error:", error);
    } finally {
        session.endSession();
    }
};

exports.checkInUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const tournament = await Tournament.findById(id);
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });

        const participant = tournament.participants.find(p => p.user.toString() === userId.toString());
        if (!participant) return res.status(403).json({ message: "Not a participant" });
        
        if (participant.isCheckedIn) return res.status(400).json({ message: "Already checked in" });

        participant.isCheckedIn = true;
        if (tournament.status === 'open') tournament.status = 'check-in';
        
        await tournament.save();

        res.status(200).json({ success: true, message: "Checked in successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.changeTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { newTeam, newTeamLogo } = req.body;
        const userId = req.user._id;

        const tournament = await Tournament.findById(id);
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });

        const participant = tournament.participants.find(p => p.user.toString() === userId.toString());
        if (!participant) return res.status(400).json({ message: "Not registered" });

        const isTeamTaken = tournament.participants.some(
            p => p.selectedTeam.toLowerCase() === newTeam.toLowerCase() && p.user.toString() !== userId.toString()
        );
        if (isTeamTaken) return res.status(400).json({ success: false, message: `Team '${newTeam}' is taken.` });

        participant.selectedTeam = newTeam;
        participant.selectedTeamLogo = newTeamLogo;
        await tournament.save();

        res.status(200).json({ success: true, message: "Team updated", newTeam });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAllTournaments = async (req, res) => {
    try {
        const tournaments = await Tournament.find().sort({ createdAt: -1 });
        res.status(200).json(tournaments);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getTournamentDetails = async (req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id)
            .populate('participants.user', 'fullName avatarUrl level');
        if (!tournament) return res.status(404).json({ message: "Not found" });
        res.status(200).json(tournament);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getTournamentMatches = async (req, res) => {
    try {
        const matches = await Match.find({ tournament: req.params.id })
            .populate('player1', 'fullName avatarUrl')
            .populate('player2', 'fullName avatarUrl')
            .populate('winner', 'fullName')
            .sort({ round: 1, matchIndex: 1 });
        res.status(200).json(matches);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getTakenTeams = async (req, res) => {
    try {
        const { id } = req.params; 
        const tournament = await Tournament.findById(id).select('participants');
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        const takenTeams = tournament.participants.map(p => p.selectedTeam);
        res.status(200).json(takenTeams);
    } catch (error) {
        console.error("Get Taken Teams Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};