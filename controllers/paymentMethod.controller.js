// controllers/paymentMethod.controller.js
const PaymentMethod = require('../models/PaymentMethod');
const mongoose = require('mongoose');

// --- وظائف خاصة بالأدمن ---

// [Admin] جلب جميع طرق الدفع (بما في ذلك غير النشطة)
exports.adminGetAllPaymentMethods = async (req, res) => {
    console.log("--- Controller: adminGetAllPaymentMethods ---");
    try {
        const methods = await PaymentMethod.find().sort({ name: 1 });
        res.status(200).json(methods);
    } catch (error) {
        console.error("Error fetching all payment methods for admin:", error);
        res.status(500).json({ msg: "Server error fetching payment methods." });
    }
};

// [Admin] إضافة طريقة دفع جديدة (معدل)
exports.adminAddPaymentMethod = async (req, res) => {
    console.log("--- Controller: adminAddPaymentMethod ---");
    const {
        name, type, displayName, description, logoUrl,
        depositTargetInfo,
        minDepositTND, minDepositUSD,
        minWithdrawalTND, minWithdrawalUSD,
        // --- [معدل] ---
        depositCommissionPercent,
        withdrawalCommissionPercent,
        // --- ---
        requiredWithdrawalInfo, isActive, notes
    } = req.body;

    if (!name || !type) {
        return res.status(400).json({ msg: "Method name and type ('deposit', 'withdrawal', 'both') are required." });
    }
    try {
        const existingMethod = await PaymentMethod.findOne({ name: name.trim() });
        if (existingMethod) {
            return res.status(400).json({ msg: `Payment method with name '${name}' already exists.` });
        }
        const newMethod = new PaymentMethod({
            name: name.trim(), type,
            displayName: displayName || name.trim(),
            description, logoUrl, depositTargetInfo,
            minDepositTND, minDepositUSD,
            minWithdrawalTND, minWithdrawalUSD,
            // --- [معدل] ---
            depositCommissionPercent,
            withdrawalCommissionPercent,
            // --- ---
            requiredWithdrawalInfo,
            isActive: isActive !== undefined ? isActive : true,
            notes
        });
        await newMethod.save();
        console.log("New payment method added:", newMethod._id);
        res.status(201).json(newMethod);
    } catch (error) {
        console.error("Error adding payment method:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ msg: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ msg: "Server error adding payment method." });
    }
};

// [Admin] تعديل طريقة دفع موجودة (معدل)
exports.adminUpdatePaymentMethod = async (req, res) => {
    const { id } = req.params;
    console.log(`--- Controller: adminUpdatePaymentMethod for ID: ${id} ---`);
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "Invalid Payment Method ID format." });
    }
    const {
        displayName, description, logoUrl,
        depositTargetInfo,
        minDepositTND, minDepositUSD,
        minWithdrawalTND, minWithdrawalUSD,
        // --- [معدل] ---
        depositCommissionPercent,
        withdrawalCommissionPercent,
        // --- ---
        requiredWithdrawalInfo, isActive, notes
    } = req.body;

    const updateFields = {};
    if (displayName !== undefined) updateFields.displayName = displayName;
    if (description !== undefined) updateFields.description = description;
    if (logoUrl !== undefined) updateFields.logoUrl = logoUrl;
    if (depositTargetInfo !== undefined) updateFields.depositTargetInfo = depositTargetInfo;
    if (minDepositTND !== undefined) updateFields.minDepositTND = minDepositTND;
    if (minDepositUSD !== undefined) updateFields.minDepositUSD = minDepositUSD;
    if (minWithdrawalTND !== undefined) updateFields.minWithdrawalTND = minWithdrawalTND;
    if (minWithdrawalUSD !== undefined) updateFields.minWithdrawalUSD = minWithdrawalUSD;
    // --- [معدل] ---
    if (depositCommissionPercent !== undefined) updateFields.depositCommissionPercent = depositCommissionPercent;
    if (withdrawalCommissionPercent !== undefined) updateFields.withdrawalCommissionPercent = withdrawalCommissionPercent;
    // --- ---
    if (requiredWithdrawalInfo !== undefined) updateFields.requiredWithdrawalInfo = requiredWithdrawalInfo;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (notes !== undefined) updateFields.notes = notes;

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ msg: "No valid fields provided for update." });
    }
    try {
        const updatedMethod = await PaymentMethod.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );
        if (!updatedMethod) {
            return res.status(404).json({ msg: "Payment method not found." });
        }
        console.log("Payment method updated in DB:", updatedMethod);
        res.status(200).json(updatedMethod);
    } catch (error) {
        console.error("Error updating payment method:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ msg: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ msg: "Server error updating payment method." });
    }
};

// [Admin] حذف طريقة دفع
exports.adminDeletePaymentMethod = async (req, res) => {
    const { id } = req.params;
    console.log(`--- Controller: adminDeletePaymentMethod for ID: ${id} ---`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "Invalid Payment Method ID format." });
    }

    try {
        const deletedMethod = await PaymentMethod.findByIdAndDelete(id);

        if (!deletedMethod) {
            return res.status(404).json({ msg: "Payment method not found." });
        }

        console.log("Payment method deleted:", deletedMethod._id);
        res.status(200).json({ msg: "Payment method deleted successfully.", deletedMethodId: id });

    } catch (error) {
        console.error("Error deleting payment method:", error);
        res.status(500).json({ msg: "Server error deleting payment method." });
    }
};

// --- وظائف عامة للمستخدمين ---

// [Public] جلب طرق الدفع النشطة فقط
exports.getActivePaymentMethods = async (req, res) => {
    console.log("--- Controller: getActivePaymentMethods ---");
    const filter = { isActive: true };
    if (req.query.type && ['deposit', 'withdrawal', 'both'].includes(req.query.type)) {
        if (req.query.type !== 'both') {
            filter.type = { $in: [req.query.type, 'both'] };
        }
    }

    try {
        // جلب كل الحقول ما عدا الملاحظات والطوابع الزمنية الداخلية
        // الآن يشمل depositTargetInfo تلقائياً
        const methods = await PaymentMethod.find(filter).select('-notes -createdAt -updatedAt -__v').sort({ name: 1 });
        res.status(200).json(methods);
    } catch (error) {
        console.error("Error fetching active payment methods:", error);
        res.status(500).json({ msg: "Server error fetching payment methods." });
    }
};