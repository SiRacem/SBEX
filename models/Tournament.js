// server/models/Tournament.js
const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  
  // إعدادات الدخول والجوائز
  entryFee: { type: Number, required: true }, // التكلفة (TND)
  prizePool: { type: Number, required: true }, // مجموع الجوائز
  prizesDistribution: {
    firstPlace: { type: Number, required: true },
    secondPlace: { type: Number, default: 0 },
    thirdPlace: { type: Number, default: 0 }
  },

  // هيكلية البطولة
  maxParticipants: { 
    type: Number, 
    enum: [16, 32], 
    required: true 
  },
  
  // حالة البطولة
  status: {
    type: String,
    enum: ['open', 'check-in', 'active', 'completed', 'cancelled'],
    default: 'open'
  },
  
  currentRound: { type: Number, default: 1 },

  // إعدادات مصير البطولة إذا لم يكتمل العدد (طلبك الثاني)
  incompleteAction: {
    type: String,
    enum: ['cancel', 'play_with_byes'], // إلغاء وإرجاع المال، أو إكمال بوجود Byes
    default: 'cancel',
    required: true
  },

  // التوقيت
  startDate: { type: Date, required: true },
  checkInOpenDate: { type: Date }, 
  checkInDurationMinutes: { type: Number, default: 15 },

  // القوانين واختيار الفرق (طلبك الأول)
  rules: {
    teamCategory: { 
      type: String, 
      enum: ['Clubs', 'National Teams'], // أندية أو منتخبات
      required: true 
    },
    matchDurationMinutes: { type: Number, default: 15 }, 
    eFootballMatchTime: { type: String, default: '6 mins' },
    extraTime: { type: Boolean, default: true },
    penalties: { type: Boolean, default: true }
  },

  // المشاركون
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }, // للتسريع
    avatar: { type: String },   // للتسريع
    
    // الفريق المختار (يجب أن يكون فريداً داخل هذه البطولة)
    selectedTeam: { type: String, required: true }, 
    selectedTeamLogo: { type: String }, // رابط شعار الفريق

    isCheckedIn: { type: Boolean, default: false }, // حالة الـ Check-in
    
    status: {
      type: String,
      enum: ['registered', 'eliminated', 'disqualified', 'winner'],
      default: 'registered'
    },
    joinedAt: { type: Date, default: Date.now }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// ضبط توقيت الـ Check-in تلقائياً
TournamentSchema.pre('save', function(next) {
  if (this.startDate && this.checkInDurationMinutes) {
    this.checkInOpenDate = new Date(this.startDate.getTime() - (this.checkInDurationMinutes * 60000));
  }
  next();
});

module.exports = mongoose.model('Tournament', TournamentSchema);