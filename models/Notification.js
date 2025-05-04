// models/Notification.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        enum: [
            // ... (الأنواع الأخرى) ...
            'PRODUCT_DELETED', 'PRODUCT_APPROVED', 'PRODUCT_REJECTED',
            'NEW_PRODUCT_PENDING', 'ORDER_STATUS_UPDATE', 'NEW_MESSAGE',
            'PRODUCT_UPDATE_PENDING', 'ADMIN_BALANCE_ADJUSTMENT',
            'USER_BALANCE_ADJUSTED', 'FUNDS_SENT', 'FUNDS_RECEIVED',
            'NEW_BID', 'BID_REJECTED', 'BID_ACCEPTED_SELLER',
            'BID_ACCEPTED_BUYER', 'BID_REJECTED_BY_YOU', 'BID_UPDATED',

            // --- أنواع إشعارات الإيداع ---
            'NEW_DEPOSIT_REQUEST',    // <-- [!] تأكد من وجود هذا (للأدمن)
            'DEPOSIT_APPROVED',       // للمستخدم
            'DEPOSIT_REJECTED',       // للمستخدم
            'DEPOSIT_PENDING',        // للمستخدم

            // --- أنواع إشعارات السحب ---
            'NEW_WITHDRAWAL_REQUEST',   // للأدمن و/أو المستخدم
            'WITHDRAWAL_APPROVED',
            'WITHDRAWAL_PROCESSING',
            'WITHDRAWAL_COMPLETED',
            'WITHDRAWAL_REJECTED'
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedEntity: {
        id: { type: Schema.Types.ObjectId },
        modelName: { type: String, enum: ['Product', 'Order', 'Message', 'User', 'Bid', 'Transaction', 'DepositRequest', 'WithdrawalRequest'] }
    },
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);