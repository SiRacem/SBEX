const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const QuestSchema = new Schema({
    title: {
        ar: { type: String, required: true }, // <-- العربية إجبارية
        en: { type: String, default: "" },    // <-- الإنجليزية اختيارية
        fr: { type: String, default: "" },
        tn: { type: String, default: "" }
    },
    description: {
        ar: { type: String }, // الوصف اختياري عموماً، لكن العربية هي الأساس
        en: { type: String, default: "" },
        fr: { type: String, default: "" },
        tn: { type: String, default: "" }
    },
    type: {
        type: String,
        enum: ['Daily', 'OneTime', 'Weekly', 'Milestone'],
        required: true
    },
    eventTrigger: {
        type: String,
        enum: ['LOGIN', 'CHECK_IN', 'SELL_PRODUCT', 'BUY_PRODUCT', 'ADD_PRODUCT', 'REFERRAL'],
        required: true
    },
    targetCount: { type: Number, required: true, default: 1 },
    reward: {
        credits: { type: Number, default: 0 },
        xp: { type: Number, default: 0 }
    },
    icon: { type: String, default: 'FaTasks' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Quest", QuestSchema);