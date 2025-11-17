// server/models/User.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const UserAchievementSchema = new Schema({
    achievement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Achievement',
        required: true
    },
    unlockedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // _id: false لمنع mongoose من إنشاء _id لكل عنصر في المصفوفة

const UserSchema = new Schema({
    fullName: { type: String, trim: true, required: true },
    email: { type: String, unique: true, lowercase: true, trim: true, match: [/\S+@\S+\.\S+/, 'auth.validation.emailInvalid'] },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    password: { type: String, required: true },
    userRole: { type: String, enum: ['User', 'Vendor', 'Admin'], default: 'User' }, // الدور الأساسي
    registerDate: { type: Date, default: Date.now },
    balance: { type: Number, required: true, default: 0, min: 0 },
    sellerAvailableBalance: { type: Number, default: 0, min: 0 },
    sellerPendingBalance: { type: Number, default: 0, min: 0 },
    depositBalance: { type: Number, default: 0, min: 0 },
    withdrawalBalance: { type: Number, default: 0, min: 0 },
    blocked: { type: Boolean, default: false, index: true },
    blockReason: { type: String, trim: true, default: null }, // <-- أضف هذا
    blockedAt: { type: Date, default: null }, // <-- اختياري: لتاريخ الحظر
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // <-- اختياري: من قام بالحظر
    avatarUrl: { type: String, default: null },
    escrowBalance: { type: Number, default: 0, min: 0 }, // رصيد المشتري المجمد للمعاملة

    // --- [!!!] حقول الوساطة والسمعة الجديدة [!!!] ---
    isMediatorQualified: { // هل المستخدم مؤهل ليكون وسيط؟
        type: Boolean,
        default: false,
        index: true // لفهرسة البحث عن الوسطاء المؤهلين
    },
    mediatorStatus: { // حالة توفر الوسيط
        type: String,
        enum: ['Available', 'Unavailable', 'Busy'], // متاح، غير متاح، مشغول بمهمة
        default: 'Unavailable', // الافتراضي غير متاح
        index: true // لفهرسة البحث عن الوسطاء المتاحين
    },
    mediatorEscrowGuarantee: { // رصيد ضمان الوسيط (بالدينار TND)
        type: Number,
        default: 0,
        min: 0
    },
    mediatorApplicationSubmittedAt: {
        type: Date
    }, // تاريخ تقديم طلب الانضمام كوسيط
    successfulMediationsCount: { // عداد الوساطات الناجحة
        type: Number,
        default: 0,
        min: 0
    },
    canWithdrawGuarantee: { // هل يستطيع سحب الضمان؟ (بناءً على عدد الوساطات مثلاً)
        type: Boolean,
        default: false
    },
    mediatorApplicationStatus: { // حالة طلب الانضمام كوسيط
        type: String,
        enum: ['None', 'Pending', 'Approved', 'Rejected'],
        default: 'None'
    },
    // --- [!!!] إضافة حقل جديد لأساس الطلب [!!!] ---
    mediatorApplicationBasis: { type: String, enum: ['Reputation', 'Guarantee', 'Unknown'], default: 'Unknown' }, // نوع التأهيل
    mediatorApplicationNotes: { // ملاحظات الأدمن على طلب الانضمام
        type: String,
        trim: true
    },
    reputationPoints: { type: Number, default: 0, index: true }, // نقاط السمعة
    reputationLevel: { // مستوى السمعة بناءً على النقاط
        type: String,
        enum: ['Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Legend', 'Mythic'],
        default: 'Novice' // يبدأ من المستوى المبتدئ
    },
    level: { // مستوى المستخدم بناءً على النقاط
        type: Number,
        default: 1, // يبدأ من المستوى 1
        min: 1
    },
    claimedLevelRewards: {
        type: [Number], // مصفوفة من أرقام المستويات التي تم استلام مكافآتها
        default: []
    },
    // --- حقول التقييم (تبقى كما هي) ---
    positiveRatings: { type: Number, default: 0, min: 0 },
    negativeRatings: { type: Number, default: 0, min: 0 },
    productsSoldCount: { type: Number, default: 0, min: 0 },
    // -----------------------------------------

    // --- [!!!] إضافة حقل الإنجازات الجديد هنا [!!!] ---
    achievements: {
        type: [UserAchievementSchema],
        default: []
    },

}, { timestamps: true });

// Indexes إضافية لتحسين الأداء
UserSchema.index({ mediatorStatus: 1, isMediatorQualified: 1 }); // للبحث عن وسطاء مؤهلين ومتاحين

// --- [!!!] تأكد من وجود هذا السطر لإضافة الـ Plugin [!!!] ---
UserSchema.plugin(mongoosePaginate);
// -----------------------------------------------------------

module.exports = mongoose.model("User", UserSchema);