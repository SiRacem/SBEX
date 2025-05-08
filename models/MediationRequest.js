const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// --- [!!!] تأكد من وجود هذا الاستيراد [!!!] ---
const mongoosePaginate = require('mongoose-paginate-v2');

const MediationRequestSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // البائع
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },  // المشتري الذي تم قبول مزايدته
    bidAmount: { type: Number, required: true }, // قيمة المزايدة المقبولة
    bidCurrency: { type: String, required: true, enum: ['TND', 'USD'] }, // عملة المزايدة المقبولة
    mediator: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // الوسيط المعين (اختياري مبدئيًا)
    status: {
        type: String,
        required: true,
        enum: [
            'PendingAssignment',    // في انتظار تعيين وسيط
            'MediatorAssigned',     // تم تعيين وسيط، في انتظار قبوله
            'MediationOfferAccepted', // الوسيط قبل المهمة، في انتظار تأكيد الأطراف
            'PartiesConfirmed',     // الأطراف أكدت، في انتظار تجميد الرصيد (أو يتم التجميد هنا)
            'EscrowFunded',         // تم تجميد الأرصدة (مبلغ الصفقة + رسوم الوساطة)
            'InProgress',           // الوساطة جارية (المحادثة مفتوحة)
            'PendingSellerAction',  // الوسيط ينتظر إجراء من البائع (مثلاً تسليم المنتج)
            'PendingBuyerAction',   // الوسيط ينتظر إجراء من المشتري (مثلاً تأكيد الاستلام)
            'ResolutionProposed',   // الوسيط اقترح حلاً
            'Completed',            // تمت الوساطة بنجاح
            'CancelledBySeller',
            'CancelledByBuyer',
            'CancelledByMediator',
            'Disputed',             // تم فتح نزاع (تصعيد للأدمن)
            'AdminResolved'
        ],
        default: 'PendingAssignment'
    },
    mediationFee: { type: Number, default: 0 }, // إجمالي رسوم الوساطة المحسوبة (بالدينار)
    mediationFeeCurrency: { type: String, default: 'TND' }, // عملة رسوم الوساطة
    sellerMediationFeePaid: { type: Boolean, default: false },
    buyerMediationFeePaid: { type: Boolean, default: false },
    // حقول لتتبع تأكيد الأطراف
    sellerConfirmedStart: { type: Boolean, default: false },
    buyerConfirmedStart: { type: Boolean, default: false },
    chatId: { type: String }, // لتحديد المحادثة المرتبطة (اختياري)
    resolutionDetails: { type: String }, // تفاصيل الحل إذا كان هناك نزاع
    adminNotes: { type: String } // ملاحظات الأدمن على طلب الوساطة
}, { timestamps: true });

MediationRequestSchema.index({ status: 1, mediator: 1 }); // لتحسين البحث عن طلبات وسيط معين أو بحالة معينة

// --- [!!!] تأكد من وجود هذا السطر لإضافة الـ Plugin [!!!] ---
MediationRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("MediationRequest", MediationRequestSchema);