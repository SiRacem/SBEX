// server/models/Ticket.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const TicketSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    ticketId: { // معرف فريد للتذكرة يمكن عرضه للمستخدم
        type: String,
        unique: true,
        // required: false, // <--- قم بإزالة هذا السطر أو تعيينه إلى false
        // أو ببساطة احذفه، الافتراضي ليس مطلوبًا
        sparse: true // يسمح بقيم null متعددة إذا لم يتم تعيينه بعد، مع الحفاظ على التفرد عند التعيين
    },
    title: {
        type: String,
        required: [true, "Ticket title is required."],
        trim: true,
        maxlength: [150, "Title cannot exceed 150 characters."],
    },
    description: {
        type: String,
        required: [true, "Ticket description is required."],
        trim: true,
        maxlength: [5000, "Description cannot exceed 5000 characters."],
    },
    category: {
        type: String,
        required: [true, "Ticket category is required."],
        enum: [
            'TechnicalIssue', 'TransactionInquiry', 'AccountIssue', 'PaymentIssue',
            'MediationIssue', 'BugReport', 'FeatureRequest', 'GeneralInquiry',
            'Complaint', 'Other'
        ],
        default: 'GeneralInquiry',
        index: true,
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium',
        index: true,
    },
    status: {
        type: String,
        enum: [
            'Open', 'PendingUserInput', 'PendingSupportReply', 'InProgress',
            'Resolved', 'Closed', 'OnHold'
        ],
        default: 'Open',
        index: true,
    },
    attachments: [{
        fileName: String,
        filePath: String,
        fileType: String,
        fileSize: Number,
    }],
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    lastReplyAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    lastRepliedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
}, { timestamps: true });

TicketSchema.pre('save', async function (next) {
    if (this.isNew) { // يعمل فقط عند إنشاء مستند جديد
        if (!this.ticketId) { // تأكد من أنه لم يتم تعيينه بالفعل (نادر)
            this.ticketId = `TCKT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            console.log(`[Ticket Model] Generated ticketId: ${this.ticketId} for new ticket.`);
        }
        this.lastReplyAt = this.createdAt || Date.now();
        this.lastRepliedBy = this.user;
    }
    next();
});

TicketSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Ticket', TicketSchema);