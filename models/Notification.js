// server/models/Notification.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        enum: [
            // Product related
            'PRODUCT_DELETED', 'PRODUCT_APPROVED', 'PRODUCT_REJECTED',
            'NEW_PRODUCT_PENDING', 'PRODUCT_UPDATE_PENDING',

            // Order/Transaction related
            'ORDER_STATUS_UPDATE', 'FUNDS_SENT', 'FUNDS_RECEIVED',

            // Bidding related
            'NEW_BID', 'BID_REJECTED', 'BID_ACCEPTED_SELLER', // هذا قديم، يمكن إزالته إذا لم يعد مستخدمًا
            'BID_ACCEPTED_BUYER',  // هذا قديم، يمكن إزالته إذا لم يعد مستخدمًا
            'BID_REJECTED_BY_YOU', 'BID_UPDATED',

            // Deposit related
            'NEW_DEPOSIT_REQUEST', 'DEPOSIT_APPROVED', 'DEPOSIT_REJECTED', 'DEPOSIT_PENDING',

            // Withdrawal related
            'NEW_WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_PROCESSING',
            'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_REJECTED',

            // Admin Actions
            'ADMIN_BALANCE_ADJUSTMENT', 'USER_BALANCE_ADJUSTED',

            // --- أنواع إشعارات الوساطة ---
            // 'BID_ACCEPTED_PENDING_MEDIATION',   // للمشتري عند قبول مزايدته وبدء انتظار الوسيط <-- كان مكررًا ومحذوفًا
            'BID_ACCEPTED_AWAITING_SELLER',   // هذا موجود بالفعل
            'BID_ACCEPTED_SELECT_MEDIATOR',   // هذا موجود بالفعل للبائع

            // --- [!!!] إضافة النوع الناقص هنا بشكل واضح ---
            'BID_ACCEPTED_PENDING_MEDIATOR',  // للمشتري: تم قبول مزايدتك، ينتظر البائع اختيار وسيط
            // -----------------------------------------------

            'NEW_MEDIATION_REQUEST_ASSIGNMENT',
            'MEDIATION_ASSIGNED',
            'MEDIATION_ACCEPTED_BY_MEDIATOR',
            'MEDIATION_REJECTED_BY_MEDIATOR',
            'MEDIATION_CONFIRMED_BY_PARTY',
            'MEDIATION_STARTED',
            'MEDIATION_COMPLETED',
            'MEDIATION_CANCELLED',
            'MEDIATION_DISPUTED',

            // --- أنواع طلبات الانضمام كوسيط ---
            'NEW_MEDIATOR_APPLICATION',
            'MEDIATOR_APP_APPROVED',
            'MEDIATOR_APP_REJECTED',
            'MEDIATOR_APP_PENDING',
            'MEDIATOR_SELECTED_BY_SELLER',
            'MEDIATOR_SELECTION_CONFIRMED',
            'MEDIATOR_SELECTION_REJECTED',
            'MEDIATION_TASK_ACCEPTED_SELF',
            'MEDIATION_TASK_REJECTED_SELF',
            'MEDIATION_REJECTED_BY_MEDIATOR_SELECT_NEW',
            'SELLER_CONFIRMED_AWAITING_YOUR_ACTION',
            'BUYER_CONFIRMED_AWAITING_YOUR_ACTION',
            'PARTY_CONFIRMED_READINESS',
            'MEDIATION_REJECTED_BY_BUYER',
            'MEDIATION_CANCELLED_BY_PARTY',
            'MEDIATION_CANCELLATION_CONFIRMED',
            'PARTIES_CONFIRMED_AWAITING_CHAT',

            // General/Other
            'NEW_MESSAGE',
            'WELCOME',

            // --- [!!!] أضف هذا النوع هنا [!!!] ---
            'NEW_CHAT_MESSAGE',
            // ------------------------------------
            'MEDIATION_DISPUTED',
            'RATING_RECEIVED',
            'LEVEL_UP_REWARD',
            'SALE_FUNDS_PENDING',
            'MEDIATION_FEE_RECEIVED',
            'PRODUCT_RECEIPT_CONFIRMED',
            'NEW_USER_REPORT',
            'REPORT_STATUS_UPDATE',
            'DISPUTE_RESOLVED_ADMIN',
            'FUNDS_NOW_AVAILABLE',
            'NEW_ADMIN_SUBCHAT_INVITATION',
            'NEW_ADMIN_SUBCHAT_MESSAGE',
            'NEW_TICKET_CREATED',
            'TICKET_REPLY',
            'TICKET_REPLY_UNASSIGNED',
            'TICKET_CLOSED_BY_USER',
            'TICKET_STATUS_UPDATED',
            'TICKET_ASSIGNED_TO_YOU',
            'TICKET_ASSIGNMENT_UPDATED',
            'MEDIATION_CANCELLED_BY_BUYER',
            'BID_CANCELLED_BY_UPDATE',
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    messageParams: { type: Schema.Types.Mixed, default: {} },
    relatedEntity: {
        id: { type: Schema.Types.ObjectId },
        // --- [!] إضافة MediationRequest هنا [!] ---
        modelName: { type: String, enum: ['Product', 'Order', 'Message', 'User', 'Bid', 'Transaction', 'DepositRequest', 'WithdrawalRequest', 'MediationRequest', 'Report', 'Ticket',] }
        // --------------------------------------
    },
    // --- [!] إضافة حقل ثانوي للربط (مفيد للوساطة) [!] ---
    secondaryRelatedEntity: {
        id: { type: Schema.Types.ObjectId },
        modelName: { type: String, enum: ['Product', 'Order', 'Message', 'User', 'Bid', 'Transaction', 'DepositRequest', 'WithdrawalRequest', 'MediationRequest'] }
    },
    // -------------------------------------------------
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", NotificationSchema);