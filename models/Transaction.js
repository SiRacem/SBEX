// models/Transaction.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // المستخدم المرتبط أساسًا (يمكن أن يكون المرسل أو المستلم أو صاحب الإيداع/السحب)
    sender: { type: Schema.Types.ObjectId, ref: 'User' }, // المرسل (في التحويلات)
    recipient: { type: Schema.Types.ObjectId, ref: 'User' }, // المستلم (في التحويلات والإيداع من جهة خارجية؟)
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'COMMISSION', 'REFUND', 'PRODUCT_SALE', 'BID_ESCROW', 'ESCROW_RELEASE', 'OTHER'] // أضف أنواعًا حسب الحاجة
    },
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'PROCESSING'], // حالات ممكنة
        default: 'PENDING'
    },
    description: { type: String }, // وصف للمعاملة
    relatedDepositRequest: { type: Schema.Types.ObjectId, ref: 'DepositRequest' }, // ربط بطلب الإيداع
    relatedWithdrawalRequest: { type: Schema.Types.ObjectId, ref: 'WithdrawalRequest' }, // ربط بطلب السحب
    relatedProduct: { type: Schema.Types.ObjectId, ref: 'Product' }, // ربط بالمنتج (للبيع أو المزايدة)
    relatedTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' }, // ربط بمعاملة أخرى (مثل استرداد)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// لتحديث updatedAt تلقائيًا
TransactionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});
TransactionSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: Date.now() });
    next();
});


module.exports = mongoose.model("Transaction", TransactionSchema);