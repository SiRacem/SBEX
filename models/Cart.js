const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: [1],
        default: 1,
    },
});

const CartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [CartItemSchema],
    bill: {
        type: Number,
        required: true,
        default: 0,
    },
});

module.exports = mongoose.model("Cart", CartSchema);
