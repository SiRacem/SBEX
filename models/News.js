const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video'] },
    title: {
        ar: { type: String, required: true },
        en: { type: String },
        fr: { type: String },
        tn: { type: String },
    },
    content: {
        ar: { type: String, required: true },
        en: { type: String },
        fr: { type: String },
        tn: { type: String },
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    category: {
        type: String,
        enum: ['Platform Update', 'Promotion', 'Security Alert', 'General'],
        default: 'General'
    },
}, {
    timestamps: true
});

const News = mongoose.model('News', newsSchema);
module.exports = News;