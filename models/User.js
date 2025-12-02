// server/models/User.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const UserAchievementSchema = new Schema({
    achievement: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement', required: true },
    unlockedAt: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema({
    fullName: { type: String, trim: true, required: true },
    email: { type: String, unique: true, lowercase: true, trim: true, match: [/\S+@\S+\.\S+/, 'auth.validation.emailInvalid'] },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    password: { type: String, required: true },
    userRole: { type: String, enum: ['User', 'Vendor', 'Admin'], default: 'User' },
    registerDate: { type: Date, default: Date.now },
    balance: { type: Number, required: true, default: 0, min: 0 },
    sellerAvailableBalance: { type: Number, default: 0, min: 0 },
    sellerPendingBalance: { type: Number, default: 0, min: 0 },
    depositBalance: { type: Number, default: 0, min: 0 },
    withdrawalBalance: { type: Number, default: 0, min: 0 },
    blocked: { type: Boolean, default: false, index: true },
    blockReason: { type: String, trim: true, default: null },
    blockedAt: { type: Date, default: null },
    blockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    avatarUrl: { type: String, default: null },
    escrowBalance: { type: Number, default: 0, min: 0 },

    // Mediator Fields
    isMediatorQualified: { type: Boolean, default: false, index: true },
    mediatorStatus: { type: String, enum: ['Available', 'Unavailable', 'Busy'], default: 'Unavailable', index: true },
    mediatorEscrowGuarantee: { type: Number, default: 0, min: 0 },
    mediatorApplicationSubmittedAt: { type: Date },
    successfulMediationsCount: { type: Number, default: 0, min: 0 },
    canWithdrawGuarantee: { type: Boolean, default: false },
    mediatorApplicationStatus: { type: String, enum: ['None', 'Pending', 'Approved', 'Rejected'], default: 'None' },
    mediatorApplicationBasis: { type: String, enum: ['Reputation', 'Guarantee', 'Unknown'], default: 'Unknown' },
    mediatorApplicationNotes: { type: String, trim: true },
    
    // Level & Reputation
    reputationPoints: { type: Number, default: 0, index: true },
    reputationLevel: { type: String, enum: ['Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Legend', 'Mythic'], default: 'Novice' },
    level: { type: Number, default: 1, min: 1 },
    claimedLevelRewards: { type: [Number], default: [] },
    positiveRatings: { type: Number, default: 0, min: 0 },
    negativeRatings: { type: Number, default: 0, min: 0 },
    productsSoldCount: { type: Number, default: 0, min: 0 },
    achievements: { type: [UserAchievementSchema], default: [] },

    // Stats
    productsBoughtCount: { type: Number, default: 0, index: true },
    bidsPlacedCount: { type: Number, default: 0, index: true },
    
    // Leaderboard Ranks
    previousRanks: {
        reputation: { type: Number, default: 0 },
        sales: { type: Number, default: 0 },
        mediation: { type: Number, default: 0 },
        buys: { type: Number, default: 0 },
        bids: { type: Number, default: 0 },
        referrals: { type: Number, default: 0 }
    },

    // Referrals
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    referralBalance: { type: Number, default: 0, min: 0 },
    totalReferralEarnings: { type: Number, default: 0 },
    referralsCount: { type: Number, default: 0, index: true },
    isReferralActive: { type: Boolean, default: false },
    earningsGeneratedForReferrer: { type: Number, default: 0 },

    // Wishlist & Following
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    followersCount: { type: Number, default: 0, min: 0 },

    // Gamification
    credits: { type: Number, default: 0, min: 0 },
    // [!!!] حقل اللفات المجانية الجديد [!!!]
    freeSpins: { type: Number, default: 0, min: 0 }, 
    
    dailyCheckIn: {
        lastCheckInDate: { type: Date, default: null },
        streak: { type: Number, default: 0 },
        claimedToday: { type: Boolean, default: false }
    },

}, { timestamps: true });

UserSchema.index({ mediatorStatus: 1, isMediatorQualified: 1 });
UserSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("User", UserSchema);