// server/models/MediationRequest.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const MediationRequestSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bidAmount: { type: Number, required: true },
    bidCurrency: { type: String, required: true, enum: ['TND', 'USD'] },
    mediator: { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    status: {
        type: String,
        required: true,
        enum: [
            'PendingMediatorSelection',
            'MediatorAssigned',
            'MediationOfferAccepted',
            'PartiesConfirmed',
            'EscrowFunded',
            'InProgress',
            'PendingSellerAction',
            'PendingBuyerAction',
            'ResolutionProposed',
            'Completed',
            'Cancelled',
            'Disputed',
            'AdminResolved',
            'PartiesConfirmed',
        ],
        default: 'PendingMediatorSelection'
    },

    // --- [!!!] الحقل الجديد للمشرفين على النزاع [!!!] ---
    disputeOverseers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mediationFee: { type: Number, default: 0 },
    mediationFeeCurrency: { type: String, default: 'TND' },
    history: { // سجل أحداث للوساطة
        type: [{ // تأكد من أن type هو مصفوفة من الكائنات
            event: String,
            userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
            timestamp: { type: Date, default: Date.now },
            details: Schema.Types.Mixed
        }],
        default: [] // القيمة الافتراضية كمصفوفة فارغة
    },
    chatMessages: [
        {
            sender: { type: Schema.Types.ObjectId, ref: 'User' /* , required: true */ },
            message: {
                type: String,
                trim: true,
                required: function() { return this.type !== 'system' && this.type !== 'image' && this.type !== 'file'; },
                /* default: null */
            },
            timestamp: { type: Date, default: Date.now, index: true },
            type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
            imageUrl: { type: String, default: null },
            readBy: { // <--- هذا الحقل مهم
                type: [{
                    readerId: { type: Schema.Types.ObjectId, ref: 'User' },
                    readAt: { type: Date, default: Date.now }
                }],
                default: []
            }
        }
    ],
    // --- [!!!] إضافة الحقل الجديد هنا [!!!] ---
    previouslySuggestedMediators: {
        type: [{ // يجب أن يكون نوعه مصفوفة من ObjectIds
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: [] // القيمة الافتراضية هي مصفوفة فارغة
    },
    suggestionRefreshCount: { // لتتبع عدد مرات طلب اقتراحات جديدة (إذا أردت تحديد حد أقصى)
        type: Number,
        default: 0
    },
    // ---------------------------------------
    sellerMediationFeePaid: { type: Boolean, default: false },
    buyerMediationFeePaid: { type: Boolean, default: false },
    sellerConfirmedStart: { type: Boolean, default: false },
    buyerConfirmedStart: { type: Boolean, default: false },
    escrowedAmount: { type: Number, default: 0 }, // المبلغ الذي جمده المشتري
    escrowedCurrency: { type: String },

    // تفاصيل عمولة الوسيط المحسوبة
    calculatedMediatorFee: { type: Number, default: 0 },
    calculatedBuyerFeeShare: { type: Number, default: 0 },
    calculatedSellerFeeShare: { type: Number, default: 0 },
    chatId: { type: String },
    resolutionDetails: { type: String },
    adminNotes: { type: String },
    adminJoinMessageSent: { type: Boolean, default: false },
}, { timestamps: true });

MediationRequestSchema.index({ status: 1, mediator: 1 });
MediationRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("MediationRequest", MediationRequestSchema);