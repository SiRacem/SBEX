// server/models/Product.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');

const BidSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Bid amount must be positive']
    },
    currency: {
        type: String,
        required: true,
        enum: ['USD', 'TND'], // تأكد من أن هذه القيم صحيحة لتطبيقك
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // _id: false للمستندات الفرعية إذا لم تكن بحاجة لمعرف فريد لها

const ProductSchema = new Schema({
    title: { type: String, required: [true, "Product title is required"], trim: true },
    imageUrls: { type: [String], required: [true, "Product must have at least one image"], validate: { validator: (arr) => arr && arr.length > 0, message: "Product must have at least one image URL." } },
    description: { type: String, required: [true, "Product description is required"], trim: true },
    linkType: {
        type: String, required: [true, "Account link type is required"],
        enum: {
            values: ["Konami ID ✅ Gmail ❌ Mail ✅", "Konami ID ✅ Gmail ❌ Mail ❌", "Konami ID ✅ Gmail ✅ Mail ✅", "Konami ID ✅ Gmail ✅ Mail ❌", "Konami ID ❌ Gmail ✅ Mail ✅", "Konami ID ❌ Gmail ✅ Mail ❌"],
            message: '{VALUE} is not a supported link type'
        }
    },
    price: { type: Number, required: [true, "Price is required"], min: [0, "Price cannot be negative"] },
    currency: { type: String, required: [true, "Currency is required"], enum: { values: ['USD', 'TND'], message: '{VALUE} is not a supported currency' }, default: 'TND' },
    quantity: { type: Number, required: [true, "Quantity is required"], min: [0], default: 1 },
    date_added: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: [
            'pending',
            'approved',
            'rejected',
            'sold',
            'Completed',                // تمت الصفقة بنجاح
            'PendingMediatorSelection', // تم قبول مزايدة، البائع يختار وسيطًا
            'MediatorAssigned',         // تم اختيار الوسيط، ينتظر قبول الوسيط
            'PartiesConfirmedForMediation', // تم تاكيد الأطراف للوساطة
            'InProgress',               // الوساطة جارية
            'MediationOfferAccepted',   // الوسيط قبل، ينتظر تأكيد الأطراف
            'EscrowFunded',             // تم تجميد الأرصدة
            'Cancelled',                // تم إلغاء الصفقة/الوساطة
            'Disputed',                 // تم فتح نزاع
            'Archived',               // تمت الأرشفة
            'Disputed',                 // تم فتح نزاع
        ],
        default: 'pending',
        index: true
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // البائع
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    bids: { type: [BidSchema], default: [] },

    // الحقول المتعلقة بالبيع والوساطة
    sold: { type: Boolean, default: false, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // المشتري الفائز
    soldAt: { type: Date },
    agreedPrice: { // السعر الذي تم الاتفاق عليه بعد قبول المزايدة (مهم للوساطة)
        type: Number,
        default: null
    },
    // soldPrice: { type: Number }, // يمكنك استخدام agreedPrice بدلاً من هذا إذا كانا نفس الشيء
    soldCurrency: { type: String }, // عملة السعر المتفق عليه

    // --- [!!!] الحقل الجديد لربط طلب الوساطة النشط [!!!] ---
    currentMediationRequest: {
        type: Schema.Types.ObjectId,
        ref: 'MediationRequest', // يجب أن يكون اسم الموديل صحيحًا
        default: null,
        index: true
    }
    // --------------------------------------------------------

}, { timestamps: true });

// Indexes
ProductSchema.index({ user: 1, status: 1 });
ProductSchema.index({ likes: 1 });
ProductSchema.index({ "bids.user": 1 });
ProductSchema.index({ "bids.createdAt": -1 });

ProductSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Product", ProductSchema);