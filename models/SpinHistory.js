const mongoose = require("mongoose");

const SpinHistorySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cost: { type: Number, required: true },
    reward: {
        type: { type: String, required: true }, // 'credits', 'reputation', 'balance'
        amount: { type: Number, required: true }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("SpinHistory", SpinHistorySchema);