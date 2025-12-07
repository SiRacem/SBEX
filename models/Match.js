// server/models/Match.js
const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  tournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  
  // الموقع في الشجرة
  round: { type: Number, required: true }, // 1, 2, 3...
  matchIndex: { type: Number, required: true }, // 0, 1, 2...
  
  // أطراف المباراة
  player1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // هل هذه المباراة محسومة تلقائياً (Bye)؟
  isBye: { type: Boolean, default: false },

  // حالة المباراة
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'review', 'completed', 'dispute', 'cancelled'],
    default: 'scheduled'
  },

  // النتائج
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  loser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // نحتاجه للإقصاء
  
  // تفاصيل الروم والنتيجة
  roomID: { type: String }, // يرسله اللاعبون في الشات
  scorePlayer1: { type: Number, default: 0 },
  scorePlayer2: { type: Number, default: 0 },

  // الأدلة
  proofScreenshot: { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // النزاعات (الاحتراز)
  dispute: {
    isOpen: { type: Boolean, default: false },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String }, // e.g. "Wrong Team Selected"
    proofImage: { type: String },
    adminDecision: { type: String },
    resolvedAt: { type: Date }
  }

}, { timestamps: true });

module.exports = mongoose.model('Match', MatchSchema);