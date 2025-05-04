// models/PaymentMethod.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentMethodSchema = new Schema({
    name: {
        type: String,
        required: [true, "Payment method name is required."],
        trim: true,
        unique: true
    },
    type: {
        type: String,
        required: true,
        enum: ['deposit', 'withdrawal', 'both'],
        default: 'both'
    },
    displayName: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    logoUrl: {
        type: String,
        trim: true
    },
    depositTargetInfo: { // معلومات الإيداع (مثل ID, Address)
        type: String,
        trim: true
    },

    // --- الحدود الدنيا ---
    minDepositTND: { type: Number, min: 0, default: 5 },
    minDepositUSD: { type: Number, min: 0, default: 2 },
    minWithdrawalTND: { type: Number, min: 0, default: 5 },
    minWithdrawalUSD: { type: Number, min: 0, default: 2 },

    // --- [جديد] عمولات منفصلة ---
    depositCommissionPercent: { // نسبة عمولة الإيداع
        type: Number,
        min: 0,
        max: 100, // النسبة لا تتجاوز 100
        default: 0
    },
    withdrawalCommissionPercent: { // نسبة عمولة السحب
        type: Number,
        min: 0,
        max: 100, // النسبة لا تتجاوز 100
        default: 0
    },

    requiredWithdrawalInfo: { // وصف للمعلومات المطلوبة للسحب
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    notes: { // ملاحظات داخلية للأدمن
        type: String
    }

}, { timestamps: true });

PaymentMethodSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model("PaymentMethod", PaymentMethodSchema);