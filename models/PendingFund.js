// server/models/PendingFund.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PendingFundSchema = new Schema({
    seller: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, "Seller ID is required for pending fund."], 
        index: true 
    },
    mediationRequest: { 
        type: Schema.Types.ObjectId, 
        ref: 'MediationRequest', 
        required: [true, "MediationRequest ID is required for pending fund."], 
        index: true 
    },
    product: { 
        type: Schema.Types.ObjectId, 
        ref: 'Product', 
        required: [true, "Product ID is required for pending fund."] 
    },
    amount: { // المبلغ الأصلي بالعملة الأصلية للمبلغ المعلق (عادةً نفس عملة الوساطة/البيع)
        type: Number, 
        required: [true, "Original amount for pending fund is required."],
        min: [0.01, "Pending amount must be positive."] // تأكد من أن المبلغ المعلق إيجابي
    },
    currency: { // عملة المبلغ الأصلي
        type: String, 
        required: [true, "Currency for pending fund amount is required."] 
    },
    amountInPlatformCurrency: { // المبلغ المعلق بعد تحويله إلى العملة الأساسية للمنصة (مثلاً TND)
        type: Number, 
        required: [true, "Amount in platform base currency is required for pending fund."] 
    },
    platformCurrency: { // العملة الأساسية للمنصة التي تم تحويل المبلغ إليها
        type: String, 
        required: [true, "Platform base currency is required."], 
        default: 'TND' // افترض TND هي الأساسية، يمكن جعلها قابلة للتعديل
    },
    releaseAt: { // التاريخ والوقت المجدول لفك تجميد هذا المبلغ
        type: Date, 
        required: [true, "Release date/time is required for pending fund."], 
        index: true 
    },
    isReleased: { // هل تم فك تجميد هذا المبلغ وانتقل إلى الرصيد المتاح؟
        type: Boolean, 
        default: false, 
        index: true 
    },
    releasedToAvailableAt: { // التاريخ والوقت الفعلي الذي تم فيه فك التجميد
        type: Date, 
        default: null 
    },
    // ربط بسجلات المعاملات لتتبع كامل
    transactionPendingId: { // ID سجل الـ Transaction الذي تم إنشاؤه عند تعليق هذا المبلغ
        type: Schema.Types.ObjectId, 
        ref: 'Transaction',
        // unique: true, // قد لا يكون فريدًا إذا كان يمكن تعديل سجل PendingFund
        // sparse: true
    },
    transactionReleasedId: { // ID سجل الـ Transaction الذي تم إنشاؤه عند فك تجميد هذا المبلغ
        type: Schema.Types.ObjectId, 
        ref: 'Transaction',
        // unique: true,
        // sparse: true
    },
    notes: { // أي ملاحظات إضافية
        type: String,
        trim: true
    }
}, { timestamps: true }); // createdAt (وقت إنشاء هذا السجل المعلق), updatedAt

// فهرس لضمان عدم تكرار نفس الوساطة لنفس البائع كسجل معلق (إذا كان هذا هو القيد المطلوب)
// إذا كان يمكن أن تكون هناك عدة أجزاء معلقة من نفس الوساطة (نادر جدًا)، قد لا تحتاج لهذا الفهرس الفريد
PendingFundSchema.index({ seller: 1, mediationRequest: 1 }, { unique: true, sparse: true }); // sparse للسماح بقيم null إذا لم تكن فريدة

// فهرس للبحث عن الأموال الجاهزة للفك
PendingFundSchema.index({ isReleased: 1, releaseAt: 1 });

module.exports = mongoose.model("PendingFund", PendingFundSchema);