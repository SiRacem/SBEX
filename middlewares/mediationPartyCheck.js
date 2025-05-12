// server/middlewares/mediationPartyCheck.js
const MediationRequest = require('../models/MediationRequest');
const mongoose = require('mongoose');

exports.isSellerOfMediation = async (req, res, next) => {
    try {
        const { mediationRequestId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID." });
        }

        const request = await MediationRequest.findById(mediationRequestId).select('seller status');
        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (!request.seller.equals(userId)) {
            return res.status(403).json({ msg: "Forbidden: You are not the seller for this request." });
        }
        // يمكنك إضافة تحقق من الحالة هنا إذا أردت (مثلاً، يجب أن تكون 'MediationOfferAccepted')
        if (request.status !== 'MediationOfferAccepted') {
            return res.status(400).json({ msg: `Action not allowed for current request status: ${request.status}. Expected 'MediationOfferAccepted'.` });
        }

        req.mediationRequest = request; // تمرير الطلب للـ controller
        next();
    } catch (error) {
        console.error("Error in isSellerOfMediation middleware:", error);
        res.status(500).json({ msg: "Server error during seller authorization for mediation." });
    }
};

exports.isBuyerOfMediation = async (req, res, next) => {
    try {
        const { mediationRequestId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID." });
        }
        // جلب حقول إضافية للمشتري (مثل السعر والمنتج) إذا احتجنا إليها هنا أو في الـ controller
        const request = await MediationRequest.findById(mediationRequestId)
            .select('buyer seller status product agreedPrice bidAmount bidCurrency mediator') // جلب agreedPrice/bidAmount
            .populate('product', 'currency'); // نحتاج عملة المنتج الأساسية إذا كانت bidCurrency غير موجودة

        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (!request.buyer.equals(userId)) {
            return res.status(403).json({ msg: "Forbidden: You are not the buyer for this request." });
        }
        if (request.status !== 'MediationOfferAccepted') {
            return res.status(400).json({ msg: `Action not allowed for current request status: ${request.status}. Expected 'MediationOfferAccepted'.` });
        }

        req.mediationRequest = request;
        next();
    } catch (error) {
        console.error("Error in isBuyerOfMediation middleware:", error);
        res.status(500).json({ msg: "Server error during buyer authorization for mediation." });
    }
};