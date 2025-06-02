// models/MediationRequest.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const SubChatMessageSchema = new Schema({ // Schema فرعي لرسائل الشات الفرعي
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: {
        type: String,
        trim: true,
        required: function () { return this.type !== 'image' && this.type !== 'file'; },
    },
    timestamp: { type: Date, default: Date.now, index: true },
    type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
    imageUrl: { type: String, default: null },
    readBy: {
        type: [{
            readerId: { type: Schema.Types.ObjectId, ref: 'User' },
            readAt: { type: Date, default: Date.now }
        }],
        default: []
    },
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() } // لضمان وجود ID لكل رسالة
});

const AdminSubChatSchema = new Schema({ // Schema للشات الفرعي الواحد
    subChatId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId(), index: true }, // ID فريد للشات الفرعي
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // الأدمن الذي أنشأ الشات
    title: { type: String, trim: true }, // عنوان اختياري يضعه الأدمن (مثال: "نقاش حول الدليل X مع البائع")
    participants: [{ // المشاركون في هذا الشات الفرعي المحدد (الأدمن + المستخدمون المختارون)
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        // يمكنك إضافة دور المشارك في النزاع هنا إذا أردت, مثال: roleInDispute: String
    }],
    messages: [SubChatMessageSchema], // مصفوفة رسائل هذا الشات الفرعي
    createdAt: { type: Date, default: Date.now },
    lastMessageAt: { type: Date, default: Date.now, index: true } // لتسهيل ترتيب الشاتات الفرعية
});


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
            'PartiesConfirmed', // <<< تأكد من أن هذه الحالة موجودة إذا كنت ستستخدمها
            'EscrowFunded',
            'InProgress',
            'PendingSellerAction',
            'PendingBuyerAction',
            'ResolutionProposed',
            'Completed',
            'Cancelled',
            'Disputed',
            'AdminResolved',
            // 'PartiesConfirmed', // <<< مكررة، احذف واحدة
        ],
        default: 'PendingMediatorSelection'
    },
    disputeOverseers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mediationFee: { type: Number, default: 0 },
    mediationFeeCurrency: { type: String, default: 'TND' },
    history: {
        type: [{
            event: String,
            userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
            timestamp: { type: Date, default: Date.now },
            details: Schema.Types.Mixed
        }],
        default: []
    },
    chatMessages: [ // هذا هو الشات الرئيسي للنزاع
        {
            sender: { type: Schema.Types.ObjectId, ref: 'User' },
            message: {
                type: String,
                trim: true,
                required: function () { return this.type !== 'system' && this.type !== 'image' && this.type !== 'file'; },
            },
            timestamp: { type: Date, default: Date.now, index: true },
            type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
            imageUrl: { type: String, default: null },
            readBy: {
                type: [{
                    readerId: { type: Schema.Types.ObjectId, ref: 'User' },
                    readAt: { type: Date, default: Date.now }
                }],
                default: []
            },
            // _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() } // تأكد من وجود ID للرسائل الرئيسية أيضاً
        }
    ],
    previouslySuggestedMediators: {
        type: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    suggestionRefreshCount: {
        type: Number,
        default: 0
    },
    sellerMediationFeePaid: { type: Boolean, default: false },
    buyerMediationFeePaid: { type: Boolean, default: false },
    sellerConfirmedStart: { type: Boolean, default: false },
    buyerConfirmedStart: { type: Boolean, default: false },
    escrowedAmount: { type: Number, default: 0 },
    escrowedCurrency: { type: String },
    calculatedMediatorFee: { type: Number, default: 0 },
    calculatedBuyerFeeShare: { type: Number, default: 0 },
    calculatedSellerFeeShare: { type: Number, default: 0 },
    chatId: { type: String }, // هل ما زلت تستخدم هذا؟ إذا كان الشات مدمجًا، قد لا يكون ضروريًا
    resolutionDetails: { type: String },
    adminNotes: { type: String },
    adminJoinMessageSent: { type: Boolean, default: false }, // للشات الرئيسي

    // --- [!!!] الحقل الجديد للشاتات الفرعية للأدمن [!!!] ---
    adminSubChats: [AdminSubChatSchema], // مصفوفة من الشاتات الفرعية

}, { timestamps: true });

MediationRequestSchema.index({ status: 1, mediator: 1 });
MediationRequestSchema.index({ "adminSubChats.subChatId": 1 }); // فهرس للبحث السريع عن شات فرعي

// إضافة _id تلقائيًا لـ chatMessages إذا لم يكن موجودًا
MediationRequestSchema.pre('save', function (next) {
    if (this.chatMessages && this.chatMessages.length > 0) {
        this.chatMessages.forEach(msg => {
            if (!msg._id) {
                msg._id = new mongoose.Types.ObjectId();
            }
        });
    }
    next();
});


MediationRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("MediationRequest", MediationRequestSchema);