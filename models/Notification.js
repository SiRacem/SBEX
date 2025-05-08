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

            // Order/Transaction related (Keep or adapt based on your final flow)
            'ORDER_STATUS_UPDATE', 'FUNDS_SENT', 'FUNDS_RECEIVED',

            // Bidding related
            'NEW_BID', 'BID_REJECTED', 'BID_ACCEPTED_SELLER',
            'BID_ACCEPTED_BUYER', 'BID_REJECTED_BY_YOU', 'BID_UPDATED',

            // Deposit related
            'NEW_DEPOSIT_REQUEST', 'DEPOSIT_APPROVED', 'DEPOSIT_REJECTED', 'DEPOSIT_PENDING',

            // Withdrawal related
            'NEW_WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_PROCESSING',
            'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_REJECTED',

            // Admin Actions
            'ADMIN_BALANCE_ADJUSTMENT', 'USER_BALANCE_ADJUSTED',

            // --- [!!!] إضافة أنواع إشعارات الوساطة [!!!] ---
            'BID_ACCEPTED_PENDING_MEDIATION',   // للمشتري عند قبول مزايدته وبدء انتظار الوسيط
            'BID_ACCEPTANCE_INITIATED_MEDIATION', // للبائع عند قبوله للمزايدة وبدء انتظار الوسيط
            'NEW_MEDIATION_REQUEST_ASSIGNMENT',   // للأدمن لإعلامه بحاجة لتعيين وسيط
            'MEDIATION_ASSIGNED',               // للوسيط لإعلامه بتعيينه لمهمة
            'MEDIATION_ACCEPTED_BY_MEDIATOR',   // للأطراف والأدمن عند قبول الوسيط للمهمة
            'MEDIATION_REJECTED_BY_MEDIATOR',   // للأدمن عند رفض الوسيط للمهمة
            'MEDIATION_CONFIRMED_BY_PARTY',     // للوسيط/الطرف الآخر عند تأكيد أحدهما
            'MEDIATION_STARTED',                // للأطراف الثلاثة عند بدء الوساطة (بعد تأكيد الطرفين وتجميد الرصيد)
            'MEDIATION_COMPLETED',              // للأطراف الثلاثة عند إتمام الوسيط للصفقة بنجاح
            'MEDIATION_CANCELLED',              // للأطراف عند إلغاء الوساطة
            'MEDIATION_DISPUTED',               // للأدمن عند تصعيد النزاع
            // ---------------------------------------------

            // General/Other
            'NEW_MESSAGE',
            'WELCOME' // Example
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedEntity: {
        id: { type: Schema.Types.ObjectId },
        // --- [!] إضافة MediationRequest هنا [!] ---
        modelName: { type: String, enum: ['Product', 'Order', 'Message', 'User', 'Bid', 'Transaction', 'DepositRequest', 'WithdrawalRequest', 'MediationRequest'] }
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