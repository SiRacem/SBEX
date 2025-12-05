const mongoose = require("mongoose");

const GlobalMessageSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    content: { 
        type: String, 
        required: true, 
        maxlength: 500,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'system'], // system لرسائل التنبيهات
        default: 'text'
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlobalMessage',
        default: null
    }
}, { timestamps: true });

// فهرس لسرعة جلب الرسائل الأخيرة
GlobalMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("GlobalMessage", GlobalMessageSchema);