const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const { advanceWinnerToNextRound } = require('../services/tournamentEngine');

// ==========================================
// Helper Functions (دوال مساعدة)
// ==========================================

// 1. توزيع اللاعبين (Seeding) لتباعد الأقوياء في الإقصائيات
const getSeedingOrder = (numMatches) => {
    if (numMatches <= 1) return [0];
    const half = getSeedingOrder(numMatches / 2);
    return half.flatMap(x => [x, numMatches - 1 - x]);
};

// 2. خلط مصفوفة عشوائياً (Shuffle)
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// 3. توليد مباريات المجموعات (Round Robin)
const generateGroupMatches = (participants, tournamentId, groupIndex) => {
    const matches = [];
    const n = participants.length;

    // خوارزمية الكل ضد الكل (ذهاب فقط)
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            matches.push({
                _id: new mongoose.Types.ObjectId(),
                tournament: tournamentId,
                stage: 'group',
                groupIndex: groupIndex,
                round: 1, // كل مباريات المجموعات تعتبر في الجولة الأولى (Group Stage)
                matchIndex: matches.length,
                status: 'scheduled',

                player1: participants[i].user,
                player1Team: participants[i].selectedTeam,
                player1TeamLogo: participants[i].selectedTeamLogo,

                player2: participants[j].user,
                player2Team: participants[j].selectedTeam,
                player2TeamLogo: participants[j].selectedTeamLogo,
            });
        }
    }
    return matches;
};

// 4. توليد شجرة خروج المغلوب (Knockout Bracket)
const generateKnockoutBracket = async (tournament, activeParticipants, session) => {
    const maxParticipants = tournament.maxParticipants;
    const totalRounds = Math.log2(maxParticipants);

    // خلط وتوزيع
    shuffleArray(activeParticipants);

    const round1MatchesCount = maxParticipants / 2;
    let round1Pairs = Array.from({ length: round1MatchesCount }, () => [null, null]);

    const seedingOrder = getSeedingOrder(round1MatchesCount);
    let currentParticipantIdx = 0;

    // ملء الخانات
    for (let i = 0; i < seedingOrder.length && currentParticipantIdx < activeParticipants.length; i++) {
        const matchIndex = seedingOrder[i];
        round1Pairs[matchIndex][0] = activeParticipants[currentParticipantIdx++];
    }
    const reverseSeedingOrder = [...seedingOrder].reverse();
    for (let i = 0; i < reverseSeedingOrder.length && currentParticipantIdx < activeParticipants.length; i++) {
        const matchIndex = reverseSeedingOrder[i];
        round1Pairs[matchIndex][1] = activeParticipants[currentParticipantIdx++];
    }

    const allMatchesToCreate = [];
    const matchesStatusMap = {};

    for (let r = 1; r <= totalRounds; r++) {
        const matchesInRound = maxParticipants / Math.pow(2, r);

        for (let i = 0; i < matchesInRound; i++) {
            let matchData = {
                _id: new mongoose.Types.ObjectId(),
                tournament: tournament._id,
                stage: 'knockout',
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
                const p1 = round1Pairs[i][0];
                const p2 = round1Pairs[i][1];

                matchData.player1 = p1 ? p1.user : null;
                matchData.player1Team = p1 ? p1.selectedTeam : null;
                matchData.player1TeamLogo = p1 ? p1.selectedTeamLogo : null;

                matchData.player2 = p2 ? p2.user : null;
                matchData.player2Team = p2 ? p2.selectedTeam : null;
                matchData.player2TeamLogo = p2 ? p2.selectedTeamLogo : null;

                if (p1 && !p2) {
                    matchData.isBye = true; matchData.status = 'completed'; matchData.winner = p1.user; matchData.scorePlayer1 = 3;
                } else if (!p1 && p2) {
                    matchData.isBye = true; matchData.status = 'completed'; matchData.winner = p2.user; matchData.scorePlayer2 = 3;
                } else if (!p1 && !p2) {
                    matchData.status = 'cancelled';
                }
            } else {
                const parent1Index = i * 2;
                const parent2Index = i * 2 + 1;
                const prevRound = r - 1;
                const parent1Status = matchesStatusMap[`${prevRound}-${parent1Index}`];
                const parent2Status = matchesStatusMap[`${prevRound}-${parent2Index}`];

                if (parent1Status === 'cancelled' && parent2Status === 'cancelled') {
                    matchData.status = 'cancelled';
                }
            }
            matchesStatusMap[`${r}-${i}`] = matchData.status;
            allMatchesToCreate.push(matchData);
        }
    }

    await Match.insertMany(allMatchesToCreate, { session });

    // إرجاع المباريات التي تحتاج لتصعيد فوري (Byes)
    return allMatchesToCreate.filter(m => m.round === 1 && m.isBye && m.status === 'completed');
};

// ==========================================
// Controllers
// ==========================================

// 1. إنشاء البطولة (Admin Only)
exports.createTournament = async (req, res) => {
    try {
        const {
            title, description, entryFee, prizePool, prizesDistribution,
            maxParticipants, startDate, incompleteAction,
            rules,
            format, // knockout, league, hybrid
            groupSettings
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
            createdBy: req.user._id,
            // الحقول الجديدة
            format: format || 'knockout',
            groupSettings: groupSettings || {},
            currentStage: format === 'knockout' ? 'knockout_stage' : 'group_stage'
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

// 2. الانضمام للبطولة
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
            return res.status(400).json({
                success: false,
                message: "apiErrors.teamAlreadyTaken",
                messageParams: { team: selectedTeam }
            });
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

            // إرسال بيانات المشارك مع معلومات المستخدم الكاملة لتحديث الـ UI
            const participantWithUser = {
                ...newParticipant,
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    avatarUrl: user.avatarUrl
                }
            };

            req.io.emit('tournament_participant_joined', {
                tournamentId: id,
                participant: participantWithUser,
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

// 3. بدء البطولة (يدوياً)
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

        // --- التفرع حسب نوع البطولة ---
        if (tournament.format === 'knockout') {
            // [A] نظام الكأس
            console.log("Starting Knockout Tournament...");
            const byeMatches = await generateKnockoutBracket(tournament, activeParticipants, session);
            tournament.status = 'active';
            tournament.startDate = new Date();
            await tournament.save({ session });
            await session.commitTransaction();

            // معالجة الـ Byes
            for (const m of byeMatches) {
                const matchDoc = await Match.findById(m._id);
                await advanceWinnerToNextRound(matchDoc, null);
            }

        } else if (tournament.format === 'league') {
            // [B] نظام الدوري العادي (Round Robin - الكل ضد الكل)
            console.log("Starting Regular League Tournament (Round Robin)...");
            console.log("[League] Active participants count:", activeParticipants.length);

            shuffleArray(activeParticipants);

            // كل اللاعبين في "مجموعة" واحدة (فعلياً بدون مجموعات)
            activeParticipants.forEach((p, index) => {
                p.groupStats = {
                    groupId: 'LEAGUE', // تعريف خاص للدوري
                    played: 0, won: 0, drawn: 0, lost: 0,
                    goalsFor: 0, goalsAgainst: 0, points: 0, rank: 0
                };
            });

            // توليد مباريات الكل ضد الكل (Round Robin)
            const allLeagueMatches = generateGroupMatches(activeParticipants, tournament._id, 0);
            console.log("[League] Generated matches count:", allLeagueMatches.length);
            if (allLeagueMatches.length > 0) {
                console.log("[League] First match sample:", JSON.stringify({
                    player1: allLeagueMatches[0].player1,
                    player2: allLeagueMatches[0].player2,
                    tournament: allLeagueMatches[0].tournament
                }));
            }

            // تحديث الـ stage للمباريات ليكون 'league' بدلاً من 'group'
            allLeagueMatches.forEach(m => {
                m.stage = 'league';
                m.groupIndex = null;
            });

            const insertedMatches = await Match.insertMany(allLeagueMatches, { session });
            console.log("[League] Inserted matches count:", insertedMatches.length);

            tournament.status = 'active';
            tournament.currentStage = 'group_stage'; // نستخدم نفس المرحلة للتوافق
            tournament.startDate = new Date();
            await tournament.save({ session });

            await session.commitTransaction();
            console.log("[League] Tournament started successfully!");

        } else if (tournament.format === 'hybrid') {
            // [C] نظام هجين (مجموعات + خروج المغلوب)
            console.log("Starting Hybrid Tournament (Groups + Knockout)...");

            // نحتاج على الأقل 2 لاعبين لكل مجموعة
            let numGroups = tournament.groupSettings.numberOfGroups || 4;
            const minPlayersPerGroup = 2;

            const maxPossibleGroups = Math.floor(activeParticipants.length / minPlayersPerGroup);
            if (maxPossibleGroups < numGroups) {
                console.log(`[Group Stage] Reducing groups from ${numGroups} to ${maxPossibleGroups}`);
                numGroups = Math.max(1, maxPossibleGroups);
            }

            shuffleArray(activeParticipants);

            // تقسيم المشاركين على المجموعات (Snake Distribution)
            const groups = Array.from({ length: numGroups }, () => []);
            let direction = 1;
            let groupIdx = 0;

            activeParticipants.forEach((p, index) => {
                groups[groupIdx].push(p);
                p.groupStats = {
                    groupId: String.fromCharCode(65 + groupIdx), // A, B, C...
                    played: 0, won: 0, drawn: 0, lost: 0,
                    goalsFor: 0, goalsAgainst: 0, points: 0, rank: 0
                };

                groupIdx += direction;
                if (groupIdx >= numGroups) {
                    groupIdx = numGroups - 1;
                    direction = -1;
                } else if (groupIdx < 0) {
                    groupIdx = 0;
                    direction = 1;
                }
            });

            // توليد المباريات لكل مجموعة
            let allGroupMatches = [];
            groups.forEach((groupParticipants, index) => {
                if (groupParticipants.length >= 2) {
                    const groupMatches = generateGroupMatches(groupParticipants, tournament._id, index);
                    allGroupMatches = [...allGroupMatches, ...groupMatches];
                }
            });

            await Match.insertMany(allGroupMatches, { session });

            tournament.status = 'active';
            tournament.currentStage = 'group_stage';
            tournament.startDate = new Date();
            await tournament.save({ session });

            await session.commitTransaction();
        }

        // جلب البطولة كاملة مع المباريات والمشاركين لإرسالها عبر السوكت
        const fullTournament = await Tournament.findById(id)
            .populate('participants.user', 'fullName avatarUrl')
            .lean();

        const matches = await Match.find({ tournament: id }).lean();
        fullTournament.matches = matches;

        if (req.io) {
            req.io.emit('tournament_updated', fullTournament);
        }

        res.status(200).json({
            success: true,
            message: `Tournament started successfully (${tournament.format})`
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Start Tournament Error:", error);
        res.status(500).json({ message: error.message || "Server error" });
    } finally {
        session.endSession();
    }
};

// 4. CRON JOB (بدء البطولات المجدولة تلقائياً)
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
                    // بدء البطولة (المنطق الكامل هنا)
                    console.log(`[Tournament Cron] Starting tournament ${t.title} (${t.format})`);

                    if (t.format === 'knockout') {
                        // [A] Knockout
                        const byeMatches = await generateKnockoutBracket(t, activeParticipants, session);
                        t.status = 'active';
                        t.startDate = now;
                        await t.save({ session });
                        await session.commitTransaction();

                        for (const m of byeMatches) {
                            const matchDoc = await Match.findById(m._id);
                            await advanceWinnerToNextRound(matchDoc, null);
                        }

                    } else if (t.format === 'league') {
                        // [B] نظام الدوري العادي (Round Robin - الكل ضد الكل)
                        console.log("[CRON League] Starting league tournament...");
                        console.log("[CRON League] Active participants:", activeParticipants.length);

                        shuffleArray(activeParticipants);

                        // كل اللاعبين في مجموعة واحدة
                        activeParticipants.forEach((p, index) => {
                            p.groupStats = {
                                groupId: 'LEAGUE',
                                played: 0, won: 0, drawn: 0, lost: 0,
                                goalsFor: 0, goalsAgainst: 0, points: 0, rank: 0
                            };
                        });

                        // توليد مباريات الكل ضد الكل
                        const allLeagueMatches = generateGroupMatches(activeParticipants, t._id, 0);
                        console.log("[CRON League] Generated matches:", allLeagueMatches.length);

                        // تحديث الـ stage للمباريات
                        allLeagueMatches.forEach(m => {
                            m.stage = 'league';
                            m.groupIndex = null;
                        });

                        const insertedMatches = await Match.insertMany(allLeagueMatches, { session });
                        console.log("[CRON League] Inserted matches:", insertedMatches.length);

                        t.status = 'active';
                        t.currentStage = 'group_stage';
                        t.startDate = now;
                        await t.save({ session });
                        await session.commitTransaction();
                        console.log("[CRON League] Tournament started successfully!");

                    } else if (t.format === 'hybrid') {
                        // [C] نظام هجين (مجموعات + خروج المغلوب)
                        const numGroups = t.groupSettings?.numberOfGroups || 4;
                        shuffleArray(activeParticipants);

                        const groups = Array.from({ length: numGroups }, () => []);
                        activeParticipants.forEach((p, index) => {
                            const groupIdx = index % numGroups;
                            groups[groupIdx].push(p);
                            p.groupStats = {
                                groupId: String.fromCharCode(65 + groupIdx),
                                played: 0, won: 0, drawn: 0, lost: 0,
                                goalsFor: 0, goalsAgainst: 0, points: 0, rank: 0
                            };
                        });

                        let allGroupMatches = [];
                        groups.forEach((groupParticipants, index) => {
                            const groupMatches = generateGroupMatches(groupParticipants, t._id, index);
                            allGroupMatches = [...allGroupMatches, ...groupMatches];
                        });

                        await Match.insertMany(allGroupMatches, { session });
                        t.status = 'active';
                        t.currentStage = 'group_stage';
                        t.startDate = now;
                        await t.save({ session });
                        await session.commitTransaction();
                    }

                    if (io) io.emit('tournament_updated', { _id: t._id, status: 'active' });

                    // متابعة الدورة
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
        console.log('[getTournamentMatches] Fetching matches for tournament:', req.params.id);
        const matches = await Match.find({ tournament: req.params.id })
            .populate('player1', 'fullName avatarUrl')
            .populate('player2', 'fullName avatarUrl')
            .populate('winner', 'fullName')
            .sort({ round: 1, matchIndex: 1 });
        console.log('[getTournamentMatches] Found matches:', matches.length);
        res.status(200).json(matches);
    } catch (error) {
        console.error('[getTournamentMatches] Error:', error);
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