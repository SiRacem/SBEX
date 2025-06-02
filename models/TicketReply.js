// server/models/TicketReply.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketReplySchema = new Schema({
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isSupportReply: { type: Boolean, default: false },
    message: { type: String, required: [true, "Reply message is required."], trim: true, maxlength: [5000] },
    attachments: [{ fileName: String, filePath: String, fileType: String, fileSize: Number }],
}, { timestamps: true });

// --- [!!! قم بإزالة هذا الـ HOOK بالكامل أو تعليقه !!!] ---
/*
TicketReplySchema.post('save', async function(doc, next) {
    // ... منطق التحديث تم نقله إلى الـ controller ...
    next();
});
*/
// --- [!!! نهاية الجزء المراد إزالته/تعليقه !!!] ---

module.exports = mongoose.model('TicketReply', TicketReplySchema);