// server/models/Achievement.js

const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    title: {
        ar: { type: String, required: true, trim: true },
        en: { type: String, trim: true },
        fr: { type: String, trim: true },
        tn: { type: String, trim: true },
    },
    description: {
        ar: { type: String, required: true, trim: true },
        en: { type: String, trim: true },
        fr: { type: String, trim: true },
        tn: { type: String, trim: true },
    },
    icon: {
        type: String,
        required: true,
        // يمكن أن يكون اسم أيقونة من مكتبة (مثل 'fa-solid fa-trophy') أو رابط URL لصورة
    },
    category: {
        type: String,
        enum: ['SALES', 'PURCHASES', 'COMMUNITY', 'SPECIAL'], // إنجازات البيع، الشراء، المجتمع، أو خاصة
        required: true,
    },
    // `criteria` هو كائن يصف شروط فتح الإنجاز. نستخدم `Mixed` لمرونة عالية.
    criteria: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        // أمثلة:
        // { type: 'SALES_COUNT', value: 10 }
        // { type: 'REPUTATION_LEVEL_REACHED', value: 'Gold' }
        // { type: 'SUCCESSFUL_MEDIATIONS', value: 5 }
        // { type: 'ACCOUNT_AGE_DAYS', value: 365 }
    },
    pointsAwarded: {
        type: Number,
        default: 0,
        // يمكن أن تكون نقاط سمعة أو نقاط خبرة في المستقبل
    },
    isEnabled: {
        type: Boolean,
        default: true,
        index: true
        // يسمح للمسؤول بتعطيل إنجاز مؤقتًا
    },
    secret: {
        type: Boolean,
        default: false
        // إذا كان `true`، لن يظهر الإنجاز للمستخدم إلا بعد الحصول عليه
    },
}, {
    timestamps: true
});

// دالة مساعدة لضمان وجود ترجمات احتياطية
achievementSchema.pre('save', function (next) {
    const fallbackTitle = this.title.ar;
    this.title.en = this.title.en || fallbackTitle;
    this.title.fr = this.title.fr || fallbackTitle;
    this.title.tn = this.title.tn || fallbackTitle;

    const fallbackDesc = this.description.ar;
    this.description.en = this.description.en || fallbackDesc;
    this.description.fr = this.description.fr || fallbackDesc;
    this.description.tn = this.description.tn || fallbackDesc;

    next();
});

const Achievement = mongoose.model('Achievement', achievementSchema);
module.exports = Achievement;