// models/WithdrawalRequest.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const WithdrawalRequestSchema = new Schema({
    user: { // المستخدم الذي طلب السحب
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    paymentMethod: { // طريقة الدفع المستخدمة للسحب
        type: Schema.Types.ObjectId,
        ref: 'PaymentMethod',
        required: true
    },
    amount: { // المبلغ الإجمالي المخصوم (دائماً TND)
        type: Number,
        required: true,
        min: 0
    },
    currency: { // عملة المبلغ المحفوظ (دائماً TND)
        type: String,
        required: true,
        enum: ['TND'], // <-- العملة المحفوظة دائماً TND
        default: 'TND'
    },
    status: { // حالة الطلب
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Completed', 'Rejected', 'Failed'],
        default: 'Pending',
        index: true
    },
    // --- تفاصيل حسابية وقت الطلب (بالدينار TND) ---
    feeAmount: { // قيمة رسوم السحب المحسوبة بالدينار
        type: Number,
        default: 0,
        min: 0
    },
    netAmountToReceive: { // المبلغ الصافي المتوقع استلامه (محسوب بالدينار)
        type: Number,
        default: 0,
        min: 0
    },
    // --- معلومات مقدمة من المستخدم (لوجهة السحب) ---
    withdrawalInfo: {
        type: Schema.Types.Mixed, // يسمح بتخزين أنواع مختلفة
        required: true
    },

    // --- [!!! إضافة الحقول الأصلية هنا !!!] ---
    originalAmount: { // المبلغ الإجمالي الذي أدخله المستخدم أصلاً
        type: Number,
        required: [true, "Original amount is required for reference."] // اجعله مطلوباً
    },
    originalCurrency: { // العملة الأصلية التي أدخلها المستخدم
        type: String,
        required: [true, "Original currency is required for reference."], // اجعله مطلوباً
        enum: ['TND', 'USD'] // العملات المسموح بإدخالها
    },
    // ------------------------------------------

    // --- معلومات المعالجة من الأدمن ---
    rejectionReason: { // سبب الرفض
        type: String,
        trim: true
    },
    processedBy: { // الأدمن الذي قام بالمعالجة
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: { // تاريخ المعالجة
        type: Date
    },
    adminNotes: { // ملاحظات الأدمن
        type: String,
        trim: true
    },
    transactionReference: { // مرجع الدفع الفعلي
        type: String,
        trim: true
    }

}, { timestamps: true }); // يضيف createdAt و updatedAt تلقائياً

// Index مركب لتحسين البحث عن طلبات مستخدم معين بحالة معينة
WithdrawalRequestSchema.index({ user: 1, status: 1 });

WithdrawalRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("WithdrawalRequest", WithdrawalRequestSchema);