const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserQuestSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true },
    
    progress: { type: Number, default: 0 }, // التقدم الحالي (مثلاً 2/5)
    isCompleted: { type: Boolean, default: false },
    isClaimed: { type: Boolean, default: false }, // هل تم استلام الجائزة؟
    
    // للمهمات اليومية: متى تم آخر تحديث؟ لنعرف متى نصفرها
    lastUpdated: { type: Date, default: Date.now },
    resetDate: { type: Date } // تاريخ انتهاء الصلاحية للمهمة اليومية
}, { timestamps: true });

// فهرس لسرعة البحث عن مهمات المستخدم
UserQuestSchema.index({ user: 1, quest: 1 }, { unique: true });

module.exports = mongoose.model("UserQuest", UserQuestSchema);