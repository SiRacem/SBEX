// models/DepositRequest.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2'); // <-- 1. استيراد الإضافة

const DepositRequestSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentMethod: { type: Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['TND', 'USD'] },
    status: { type: String, required: true, enum: ['pending', 'approved', 'rejected', 'processing'], default: 'pending', index: true },
    feeAmount: { type: Number, default: 0, min: 0 },
    netAmountCredited: { type: Number, default: 0, min: 0 },
    transactionId: { type: String, trim: true },
    senderInfo: { type: String, trim: true },
    screenshotUrl: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
    adminNotes: { type: String, trim: true }
}, { timestamps: true });

DepositRequestSchema.index({ user: 1, status: 1 });

DepositRequestSchema.plugin(mongoosePaginate); // <-- 2. إضافة الـ Plugin للـ Schema

module.exports = mongoose.model("DepositRequest", DepositRequestSchema);