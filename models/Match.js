const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },

  // [جديد] نوع المرحلة لهذه المباراة
  stage: {
    type: String,
    enum: ['group', 'knockout', 'league'],
    default: 'knockout',
    required: true
  },

  groupIndex: { type: Number, default: null },

  round: { type: Number, required: true },
  matchIndex: { type: Number, required: true },

  player1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  player1Team: { type: String },
  player1TeamLogo: { type: String },
  player2Team: { type: String },
  player2TeamLogo: { type: String },

  isBye: { type: Boolean, default: false },

  // ⏱️ نظام الوقت المحدد للمباريات
  roundStartTime: { type: Date, default: null },
  roundDeadline: { type: Date, default: null },
  extraTimeTriggered: { type: Boolean, default: false },

  // 🎮 حالة جهوزية اللاعبين
  player1Ready: {
    isReady: { type: Boolean, default: false },
    readyAt: { type: Date, default: null },
    lastActivity: { type: Date, default: null }
  },
  player2Ready: {
    isReady: { type: Boolean, default: false },
    readyAt: { type: Date, default: null },
    lastActivity: { type: Date, default: null }
  },

  // سبب انتهاء المباراة
  completionReason: {
    type: String,
    enum: ['normal', 'timeout_player1', 'timeout_player2', 'timeout_both', 'walkover', 'bye', 'timeout_draw_after_extra'],
    default: null
  },

  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'review', 'completed', 'dispute', 'cancelled'],
    default: 'scheduled'
  },

  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  loser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  roomID: { type: String },

  scorePlayer1: { type: Number, default: 0 },
  scorePlayer2: { type: Number, default: 0 },

  penaltiesPlayer1: { type: Number, default: 0 },
  penaltiesPlayer2: { type: Number, default: 0 },

  proofScreenshot: { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  dispute: {
    isOpen: { type: Boolean, default: false },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String },
    proofImage: { type: String },
    adminDecision: { type: String },
    resolvedAt: { type: Date }
  },

  chatMessages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: String,
    text: String,
    imageUrl: String,
    timestamp: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

module.exports = mongoose.model('Match', MatchSchema);