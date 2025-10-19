// middlewares/mediationPartyCheck.js

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
            return res.status(403).json({
                translationKey: "apiErrors.notTheSellerForThisRequest",
                msg: "Forbidden: You are not the seller for this request."
            });
        }

        const requestedPath = req.path;
        if (requestedPath.includes('/available-random')) {
            if (request.status !== 'PendingMediatorSelection') {
                return res.status(400).json({
                    translationKey: "apiErrors.actionNotAllowedAtStatus",
                    translationParams: { action: "'get mediators'", status: request.status },
                    msg: `Action 'get mediators' not allowed at status '${request.status}'.`
                });
            }
        } else if (requestedPath.includes('/confirm-readiness')) {
            const allowedStatuses = ['MediationOfferAccepted', 'EscrowFunded'];
            if (!allowedStatuses.includes(request.status)) {
                return res.status(400).json({
                    translationKey: "apiErrors.actionNotAllowedAtStatus",
                    translationParams: { action: "'confirm readiness'", status: request.status },
                    msg: `Action 'confirm readiness' not allowed at status '${request.status}'.`
                });
            }
        }

        req.mediationRequestFromMiddleware = request;
        next();
    } catch (error) {
        console.error("Error in isSellerOfMediation middleware:", error);
        res.status(500).json({ msg: "Server error during seller authorization." });
    }
};

exports.isBuyerOfMediation = async (req, res, next) => {
    try {
        const { mediationRequestId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return res.status(400).json({ msg: "Invalid Mediation Request ID." });
        }

        const request = await MediationRequest.findById(mediationRequestId)
            .select('buyer seller status product agreedPrice bidAmount bidCurrency mediator')
            .populate('product', 'currency');

        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }

        // [!!!] START: تعديل رسالة الخطأ للترجمة [!!!]
        if (!request.buyer.equals(userId)) {
            return res.status(403).json({
                translationKey: "apiErrors.notTheBuyerForThisRequest",
                msg: "Forbidden: You are not the buyer for this request."
            });
        }

        const allowedStatusesForBuyerAction = ['MediationOfferAccepted'];
        if (req.path.includes('confirm-readiness-and-escrow')) {
            if (!allowedStatusesForBuyerAction.includes(request.status)) {
                return res.status(400).json({
                    translationKey: "apiErrors.actionNotAllowedAtStatus",
                    translationParams: { action: "'confirm and escrow'", status: request.status },
                    msg: `Action 'confirm and escrow' not allowed for buyer at current request status: '${request.status}'.`
                });
            }
        }
        // [!!!] END: نهاية التعديل [!!!]

        req.mediationRequestFromMiddleware = request;
        next();
    } catch (error) {
        console.error("Error in isBuyerOfMediation middleware:", error);
        res.status(500).json({ msg: "Server error during buyer authorization." });
    }
};