// server/models/Report.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2'); // <-- استيراد mongoose-paginate-v2

const ReportSchema = new Schema({
    reporterUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    reportedUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    reasonCategory: {
        type: String,
        required: true,
        enum: [
            'INAPPROPRIATE_BEHAVIOR', 'HARASSMENT_OR_BULLYING', 'SPAM_OR_SCAM',
            'IMPERSONATION', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT',
            'TRANSACTION_ISSUE', 'POLICY_VIOLATION', 'OTHER'
        ]
    },
    details: {
        type: String,
        required: true,
        trim: true,
        minlength: [10, "Details must be at least 10 characters long."],
        maxlength: [1000, "Details cannot exceed 1000 characters."]
    },
    mediationContext: {
        type: Schema.Types.ObjectId,
        ref: 'MediationRequest',
        default: null
    },
    imageUrls: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'ACTION_TAKEN', 'DISMISSED', 'NEEDS_MORE_INFO'],
        default: 'PENDING_REVIEW',
        index: true
    },
    adminNotes: {
        type: String,
        trim: true
    },
    resolutionDetails: {
        type: String,
        trim: true
    }
    // يمكنك إضافة حقل history إذا أردت تتبع تغييرات الحالة
    // history: [{
    //     adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
    //     action: String, // e.g., 'STATUS_CHANGED', 'NOTE_ADDED'
    //     oldValue: String,
    //     newValue: String,
    //     timestamp: { type: Date, default: Date.now }
    // }]
}, { timestamps: true });

ReportSchema.index({ status: 1, createdAt: -1 });

ReportSchema.plugin(mongoosePaginate); // <-- إضافة الـ plugin هنا

module.exports = mongoose.model("Report", ReportSchema);