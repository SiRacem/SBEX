// models/MediationRequest.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const SubChatMessageSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: function() { return this.type !== 'system'; } // The Fix
    },
    message: {
        type: String,
        trim: true,
        required: function () { return this.type !== 'image' && this.type !== 'file' && this.type !== 'system'; },
    },
    timestamp: { type: Date, default: Date.now, index: true },
    type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
    imageUrl: { type: String, default: null },
    // Add support for translation keys and parameters for system messages
    messageKey: {
        type: String,
        required: function() { return this.type === 'system'; }
    },
    messageParams: {
        type: Schema.Types.Mixed,
        default: {}
    },
    readBy: {
        type: [{
            readerId: { type: Schema.Types.ObjectId, ref: 'User' },
            readAt: { type: Date, default: Date.now }
        }],
        default: []
    },
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() }
});

const AdminSubChatSchema = new Schema({
    subChatId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId(), index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true },
    participants: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    }],
    messages: [SubChatMessageSchema],
    createdAt: { type: Date, default: Date.now },
    lastMessageAt: { type: Date, default: Date.now, index: true }
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
        ],
        default: 'PendingMediatorSelection'
    },

    // --- [!!!] أضف هذا الحقل الجديد هنا [!!!] ---
    cancellationDetails: {
        cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
        cancelledByType: { type: String, enum: ['Seller', 'Buyer', 'Mediator', 'Admin'] },
        reason: { type: String, trim: true },
        cancelledAt: { type: Date }
    },
    // --- نهاية الإضافة ---
    
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
    chatMessages: [
        {
            sender: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: function() { return this.type !== 'system'; } // The Fix
            },
            message: {
                type: String,
                trim: true,
                required: function () { return this.type !== 'system' && this.type !== 'image' && this.type !== 'file'; },
            },
            timestamp: { type: Date, default: Date.now, index: true },
            type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
            imageUrl: { type: String, default: null },
            // Add support for translation keys and parameters for system messages
            messageKey: {
                type: String,
                required: function() { return this.type === 'system'; }
            },
            messageParams: {
                type: Schema.Types.Mixed,
                default: {}
            },
            readBy: {
                type: [{
                    readerId: { type: Schema.Types.ObjectId, ref: 'User' },
                    readAt: { type: Date, default: Date.now }
                }],
                default: []
            },
        }
    ],
    previouslySuggestedMediators: {
        type: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    suggestionRefreshCount: { type: Number, default: 0 },
    sellerMediationFeePaid: { type: Boolean, default: false },
    buyerMediationFeePaid: { type: Boolean, default: false },
    sellerConfirmedStart: { type: Boolean, default: false },
    buyerConfirmedStart: { type: Boolean, default: false },
    escrowedAmount: { type: Number, default: 0 },
    escrowedCurrency: { type: String },
    calculatedMediatorFee: { type: Number, default: 0 },
    calculatedBuyerFeeShare: { type: Number, default: 0 },
    calculatedSellerFeeShare: { type: Number, default: 0 },
    chatId: { type: String },
    resolutionDetails: { type: String },
    adminNotes: { type: String },
    adminJoinMessageSent: { type: Boolean, default: false },
    adminSubChats: [AdminSubChatSchema],

}, { timestamps: true });

MediationRequestSchema.index({ status: 1, mediator: 1 });
MediationRequestSchema.index({ "adminSubChats.subChatId": 1 });

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