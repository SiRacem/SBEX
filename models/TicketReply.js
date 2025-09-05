// server/models/TicketReply.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketReplySchema = new Schema({
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isSupportReply: { type: Boolean, default: false },
    // --- THIS IS THE FIX: The 'required' property has been removed ---
    message: { type: String, trim: true, maxlength: [5000] },
    // --- END OF FIX ---
    attachments: [{ fileName: String, filePath: String, fileType: String, fileSize: Number }],
}, { timestamps: true });

module.exports = mongoose.model('TicketReply', TicketReplySchema);