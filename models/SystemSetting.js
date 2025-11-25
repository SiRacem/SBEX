// server/models/SystemSetting.js
const mongoose = require("mongoose");

const SystemSettingSchema = new mongoose.Schema({
    key: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    }, // مثال: 'referral_config'
    value: { 
        type: mongoose.Schema.Types.Mixed, 
        required: true 
    }, // يمكن أن يكون رقمًا، نصًا، أو كائنًا
    description: { type: String }, // شرح للإعداد (للأدمن)
}, { timestamps: true });

module.exports = mongoose.model("SystemSetting", SystemSettingSchema);