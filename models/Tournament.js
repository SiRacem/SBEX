const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },

  entryFee: { type: Number, required: true },
  prizePool: { type: Number, required: true },
  prizesDistribution: {
    firstPlace: { type: Number, required: true },
    secondPlace: { type: Number, default: 0 },
    thirdPlace: { type: Number, default: 0 },
    bestAttack: { type: Number, default: 0 },
    bestDefense: { type: Number, default: 0 }
  },

  maxParticipants: {
    type: Number,
    enum: [8, 16, 32],
    required: true
  },

  // [جديد] نوع البطولة
  format: {
    type: String,
    enum: ['knockout', 'league', 'hybrid'], // knockout=كأس, league=دوري فقط, hybrid=مجموعات ثم كأس
    default: 'knockout',
    required: true
  },

  // [جديد] إعدادات المجموعات (تستخدم فقط إذا كان النوع league أو hybrid)
  groupSettings: {
    numberOfGroups: { type: Number, default: 4 }, // مثلاً 4 مجموعات
    qualifiersPerGroup: { type: Number, default: 2 }, // يتأهل 2 من كل مجموعة
    pointsWin: { type: Number, default: 3 },
    pointsDraw: { type: Number, default: 1 },
    pointsLoss: { type: Number, default: 0 }
  },

  status: {
    type: String,
    enum: ['open', 'check-in', 'active', 'completed', 'cancelled'],
    default: 'open'
  },

  // يمكن أن نستخدم هذا لتتبع المرحلة الحالية (هل نحن في المجموعات أم في الأدوار الإقصائية)
  currentStage: {
    type: String,
    enum: ['group_stage', 'knockout_stage', 'finished'],
    default: 'group_stage'
  },

  currentRound: { type: Number, default: 1 },

  incompleteAction: {
    type: String,
    enum: ['cancel', 'play_with_byes'],
    default: 'cancel',
    required: true
  },

  startDate: { type: Date, required: true },
  checkInOpenDate: { type: Date },
  checkInDurationMinutes: { type: Number, default: 15 },

  rules: {
    teamCategory: {
      type: String,
      enum: ['Clubs', 'National Teams'],
      required: true
    },
    specificLeague: { type: mongoose.Schema.Types.ObjectId, ref: 'League', default: null },
    matchDurationMinutes: { type: Number, default: 15 },
    breakDurationMinutes: { type: Number, default: 10 },
    eFootballMatchTime: { type: String, default: '6 mins' },
    extraTime: { type: Boolean, default: true },
    penalties: { type: Boolean, default: true }
  },

  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    avatar: { type: String },
    selectedTeam: { type: String, required: true },
    selectedTeamLogo: { type: String },
    isCheckedIn: { type: Boolean, default: false },

    // [جديد] تتبع احصائيات المجموعات لكل لاعب
    groupStats: {
      groupId: { type: String }, // A, B, C...
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 },
      drawn: { type: Number, default: 0 },
      lost: { type: Number, default: 0 },
      goalsFor: { type: Number, default: 0 },
      goalsAgainst: { type: Number, default: 0 },
      points: { type: Number, default: 0 },
      rank: { type: Number, default: 0 } // ترتيبه في المجموعة
    },

    status: {
      type: String,
      enum: ['registered', 'active', 'eliminated', 'disqualified', 'winner'],
      default: 'registered'
    },
    joinedAt: { type: Date, default: Date.now }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

TournamentSchema.pre('save', function (next) {
  if (this.startDate && this.checkInDurationMinutes) {
    this.checkInOpenDate = new Date(this.startDate.getTime() - (this.checkInDurationMinutes * 60000));
  }
  next();
});

module.exports = mongoose.model('Tournament', TournamentSchema);