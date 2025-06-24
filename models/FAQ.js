// server/models/FAQ.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FAQSchema = new Schema({
    question: {
        en: String, ar: String, tn: String,
        type: String,
        required: [true, "Question is required."],
        trim: true,
        maxlength: [250, "Question cannot exceed 250 characters."]
    },
    answer: {
        en: String, ar: String, tn: String,
        type: String,
        required: [true, "Answer is required."],
    },
    category: {
        type: String,
        required: [true, "Category is required."],
        trim: true,
        index: true, // لفهرسة الفئات وتسريع التجميع
        default: 'General' // فئة افتراضية
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true // لفهرسة الأسئلة النشطة
    },
    displayOrder: {
        type: Number,
        default: 0 // للتحكم في الترتيب، 0 يعني في النهاية
    }
}, { timestamps: true }); // لإضافة createdAt و updatedAt

module.exports = mongoose.model("FAQ", FAQSchema);