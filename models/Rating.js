// server/models/Rating.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const RatingSchema = new Schema({
    rater: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ratedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mediationRequestId: { // <-- الحقل الجديد/المعدل
        type: Schema.Types.ObjectId,
        ref: 'MediationRequest',
        required: true, // اجعله مطلوبًا
        index: true
    },
    product: { // يمكنك الاحتفاظ به إذا أردت ربطًا إضافيًا بالمنتج، لكن الوساطة قد تكون كافية
        type: Schema.Types.ObjectId,
        ref: 'Product',
        // required: true // قد لا يكون هذا مطلوبًا إذا اعتمدت على الوساطة
    },
    ratingType: { type: String, enum: ['like', 'dislike'], required: true },
    comment: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

// الفهرس لضمان عدم تقييم نفس الوساطة من نفس المقَيِّم لنفس المقَيَّم أكثر من مرة
RatingSchema.index({ rater: 1, ratedUser: 1, mediationRequestId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", RatingSchema);