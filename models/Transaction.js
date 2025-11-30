// server/models/Transaction.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // المستخدم الرئيسي للمعاملة (البائع في حالات البيع، الوسيط لرسومه، إلخ)
    sender: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // المرسل (في التحويلات بين المستخدمين)
    recipient: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // المستلم (في التحويلات بين المستخدمين)
    
    amount: { type: Number, required: true }, // المبلغ الأساسي للمعاملة
    currency: { type: String, required: true }, // عملة المبلغ الأساسي (مثل TND, USD)
    
    // (اختياري) لتخزين المبلغ المحول إلى العملة الأساسية للمنصة إذا كانت مختلفة
    // amountInPlatformCurrency: { type: Number }, 
    // platformCurrency: { type: String },

    type: {
        type: String,
        required: true,
        enum: [
            'TRANSFER_SENT',        // أموال مرسلة من هذا المستخدم لطرف آخر
            'TRANSFER_RECEIVED',    // أموال مستلمة لهذا المستخدم من طرف آخر
            'DEPOSIT_COMPLETED',    // إيداع ناجح أضاف للرصيد الرئيسي (بعد موافقة الأدمن)
            'DEPOSIT_REQUESTED',    // طلب إيداع تم إنشاؤه (ينتظر الموافقة)
            'WITHDRAWAL_COMPLETED', // سحب ناجح خصم من الرصيد (بعد موافقة الأدمن)
            'WITHDRAWAL_REQUESTED', // طلب سحب تم إنشاؤه
            'PLATFORM_COMMISSION_PAID',  // عمولة دفعت للمنصة (من قبل المستخدم)
            'PLATFORM_COMMISSION_EARNED',// عمولة ربحتها المنصة (سجل داخلي للمنصة)
            'REFUND_ISSUED',        // استرداد صادر من هذا المستخدم لطرف آخر
            'REFUND_RECEIVED',      // استرداد مستلم لهذا المستخدم من طرف آخر
            'PRODUCT_SALE_FUNDS_PENDING', // أموال بيع منتج أُضيفت إلى الرصيد المعلق للبائع
            'PRODUCT_SALE_FUNDS_RELEASED',// أموال بيع منتج تم فك تجميدها وأصبحت متاحة للبائع
            'PRODUCT_PURCHASE_COMPLETED', // (للمشتري) شراء منتج اكتمل، الأموال ذهبت للبائع (معلقة أو متاحة)
            'MEDIATION_FEE_RECEIVED',// رسوم وساطة استلمها الوسيط
            'LEVEL_UP_REWARD_RECEIVED',  // مكافأة ترقية مستوى استلمها المستخدم
            'ESCROW_FUNDED_BY_BUYER',    // المشتري قام بتمويل الضمان (تجميد من رصيده)
            'ESCROW_RELEASED_TO_SELLER', // تحرير مبلغ الضمان للبائع (إضافة لرصيده)
            'ESCROW_RETURNED_TO_BUYER',  // إرجاع مبلغ الضمان للمشتري (إضافة لرصيده)
            'OTHER_CREDIT',         // أي إضافة أخرى للرصيد
            'OTHER_DEBIT',           // أي خصم آخر من الرصيد
            'DEPOSIT', // إيداع مالي (مثل تحويل بنكي أو بطاقة ائتمان)
            'ESCROW_REFUND_DISPUTE_WON', // استرداد الأموال من الضمان بسبب نزاع
            'MEDIATION_FEE_DISPUTE', // رسوم الوساطة بسبب نزاع
            'DISPUTE_PAYOUT_SELLER_WON', // دفع تعويض للبائع في حالة فوز النزاع
            'TRANSFER', // تحويل أموال بين المستخدمين (يمكن أن يكون داخلي أو خارجي)
            'ESCROW_RETURNED_MEDIATION_CANCELLED', // إرجاع الأموال من الضمان في حالة إلغاء الوساطة
            'MEDIATION_FEE_PAID_BY_BUYER', //  عمولة الوساطة مدفوعة من المشتري (عادة من الضمان عند الإلغاء)
            "SELLER_BALANCE_TRANSFER", // تحويل رصيد البائع إلى رصيد الأساسي
            "REFERRAL_COMMISSION_EARNED", // عمولة الإحالة
            "REFERRAL_BALANCE_TRANSFER", // تحويل رصيد الإحالة إلى رصيد الأساسي
            "LUCKY_WHEEL_REWARD", // جائزة عجلة الزهر
            "LEVEL_UP_REWARD" // مكافأة ترقية مستوى
        ],
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'PROCESSING', 'ON_HOLD', 'PARTIALLY_COMPLETED'],
        default: 'PENDING',
        index: true
    },
    description: { type: String, trim: true, maxlength: 500 }, // وصف أكثر تفصيلاً للمعاملة
    notes: { type: String, trim: true, maxlength: 1000 }, // ملاحظات إضافية (من الأدمن مثلاً أو تفاصيل فنية)

    // حقول الربط بالكيانات الأخرى
    relatedDepositRequest: { type: Schema.Types.ObjectId, ref: 'DepositRequest' },
    relatedWithdrawalRequest: { type: Schema.Types.ObjectId, ref: 'WithdrawalRequest' },
    relatedProduct: { type: Schema.Types.ObjectId, ref: 'Product' },
    relatedMediationRequest: { type: Schema.Types.ObjectId, ref: 'MediationRequest', index: true },
    relatedPendingFund: { type: Schema.Types.ObjectId, ref: 'PendingFund', index: true }, // ربط بسجل الأموال المعلقة
    relatedTransaction: { type: Schema.Types.ObjectId, ref: 'Transaction' }, // لربط معاملات ببعضها (مثل استرداد مرتبط ببيع)
    
    // (اختياري) بيانات إضافية خاصة بنوع المعاملة، مثل تفاصيل وسيلة الدفع، معرف خارجي، إلخ.
    metadata: { type: Schema.Types.Mixed },

    // مفاتيح الترجمة للواجهة الأمامية
    descriptionKey: { type: String },
    descriptionParams: { type: Schema.Types.Mixed }

}, { timestamps: true }); // createdAt و updatedAt

// لتحديث updatedAt تلقائيًا عند كل حفظ أو تحديث
TransactionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});
TransactionSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: Date.now() });
    next();
});

// فهارس إضافية لتحسين أداء الاستعلامات الشائعة
TransactionSchema.index({ user: 1, type: 1, status: 1, createdAt: -1 }); // استعلامات شائعة للمستخدم
TransactionSchema.index({ createdAt: -1 }); // للترتيب العام حسب الأحدث

module.exports = mongoose.model("Transaction", TransactionSchema);