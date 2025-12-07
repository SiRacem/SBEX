// server/controllers/tournament.controller.js

const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

// ==========================================
// 1. إنشاء البطولة (Admin Only)
// ==========================================
exports.createTournament = async (req, res) => {
    try {
        const {
            title, description, entryFee, prizePool, prizesDistribution,
            maxParticipants, startDate, incompleteAction, rules
        } = req.body;

        if (new Date(startDate) <= new Date()) {
            return res.status(400).json({ message: "Start date must be in the future." });
        }

        const newTournament = new Tournament({
            title, description, entryFee, prizePool, prizesDistribution,
            maxParticipants, startDate, incompleteAction, rules,
            createdBy: req.user._id
        });

        await newTournament.save();

        res.status(201).json({
            success: true,
            message: "Tournament created successfully",
            tournament: newTournament
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

        if (tournament.status !== 'open') throw new Error("Registration is closed");
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
            description: 'transactions.tournament_entry',
            descriptionParams: { tournamentTitle: tournament.title },
            status: 'COMPLETED',
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });

        tournament.participants.push({
            user: userId,
            username: user.fullName,
            avatar: user.avatarUrl,
            selectedTeam: selectedTeam,
            selectedTeamLogo: selectedTeamLogo,
            status: 'registered'
        });

        await tournament.save({ session });

        await Notification.create([{
            user: userId,
            type: 'TOURNAMENT_JOIN_SUCCESS', // تأكد من إضافته في Notification Model Enum
            title: 'notification_titles.TOURNAMENT_JOIN_SUCCESS',
            message: 'notification_messages.TOURNAMENT_JOIN_SUCCESS',
            messageParams: { title: tournament.title },
            relatedEntity: { id: tournament._id, modelName: 'Tournament' }
        }], { session });

        await session.commitTransaction();
        
        if (req.io) {
            req.io.to(userId.toString()).emit('user_balances_updated', { _id: userId, balance: user.balance });
        }

        res.status(200).json({ success: true, message: "Successfully joined", selectedTeam });

    } catch (error) {
        await session.abortTransaction();
        console.error("Join Tournament Error:", error);
        res.status(400).json({ success: false, message: error.message || "Server error" });
    } finally {
        session.endSession();
    }
};

// ==========================================
// 3. بدء البطولة
// ==========================================
exports.startTournament = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const tournament = await Tournament.findById(id).session(session);

        if (!tournament) throw new Error("Tournament not found");
        
        // السماح بالبدء إذا كانت الحالة open أو check-in
        if (tournament.status !== 'open' && tournament.status !== 'check-in') {
             // يمكنك إزالة هذا الشرط للاختبار إذا أردت إجبار البدء
             // throw new Error("Tournament status prevents starting");
        }

        let activeParticipants = tournament.participants.filter(p => p.isCheckedIn);
        
        // [تعديل هام] للاختبار: إذا لم يكن هناك check-in، نعتبر كل المسجلين حاضرين
        // قم بإزالة هذا السطر في الإنتاج (Production)
        if (activeParticipants.length === 0 && tournament.participants.length > 0) {
             activeParticipants = tournament.participants;
        }

        const maxPlayers = tournament.maxParticipants;
        
        // خلط اللاعبين
        for (let i = activeParticipants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [activeParticipants[i], activeParticipants[j]] = [activeParticipants[j], activeParticipants[i]];
        }

        const round1MatchesCount = maxPlayers / 2;
        const matchesToCreate = [];

        for (let i = 0; i < round1MatchesCount; i++) {
            const p1 = activeParticipants.pop(); 
            const p2 = activeParticipants.pop();

            let matchData = {
                tournament: tournament._id,
                round: 1,
                matchIndex: i,
                player1: p1 ? p1.user : null,
                player2: p2 ? p2.user : null,
                player1Team: p1 ? p1.selectedTeam : null,
                player2Team: p2 ? p2.selectedTeam : null,
                status: 'scheduled',
                isBye: false
            };

            if (p1 && !p2) {
                matchData.isBye = true;
                matchData.status = 'completed';
                matchData.winner = p1.user;
                matchData.scorePlayer1 = 3; 
            } else if (!p1 && !p2) {
                matchData.status = 'cancelled';
            }

            matchesToCreate.push(matchData);
        }

        await Match.insertMany(matchesToCreate, { session });

        tournament.status = 'active';
        tournament.startDate = new Date();
        await tournament.save({ session });

        await session.commitTransaction();
        
        res.status(200).json({
            success: true,
            message: "Tournament started successfully",
            matchesCount: matchesToCreate.length
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Start Tournament Error:", error);
        res.status(500).json({ message: error.message || "Server error" });
    } finally {
        session.endSession();
    }
};

// ==========================================
// 4. تسجيل الحضور
// ==========================================
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

// ==========================================
// 5. تغيير الفريق
// ==========================================
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

// ==========================================
// 6. Getters
// ==========================================
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