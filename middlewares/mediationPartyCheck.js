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

        // [!!!] START: هذا هو المنطق الجديد والمُحسّن
        // سنتحقق من الحالة بناءً على المسار المطلوب
        const requestedPath = req.path;

        if (requestedPath.includes('/available-random')) {
            // الحالة الخاصة بمسار جلب الوسطاء
            if (request.status !== 'PendingMediatorSelection') {
                return res.status(400).json({
                    msg: `Action 'get mediators' not allowed at status '${request.status}'. Expected 'PendingMediatorSelection'.`
                });
            }
        } else if (requestedPath.includes('/confirm-readiness')) {
            // الحالة الخاصة بمسار تأكيد الاستعداد
            const allowedStatuses = ['MediationOfferAccepted', 'EscrowFunded'];
            if (!allowedStatuses.includes(request.status)) {
                return res.status(400).json({
                    msg: `Action 'confirm readiness' not allowed at status '${request.status}'. Expected one of: ${allowedStatuses.join(', ')}.`
                });
            }
        }
        // يمكنك إضافة شروط 'else if' أخرى هنا لمسارات مستقبلية يستخدم فيها هذا الـ middleware
        // [!!!] END: نهاية المنطق الجديد

        req.mediationRequestFromMiddleware = request;
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

        const request = await MediationRequest.findById(mediationRequestId)
            .select('buyer seller status product agreedPrice bidAmount bidCurrency mediator')
            .populate('product', 'currency');

        if (!request) {
            return res.status(404).json({ msg: "Mediation request not found." });
        }
        if (!request.buyer.equals(userId)) {
            return res.status(403).json({ msg: "Forbidden: You are not the buyer for this request." });
        }

        // --- تعديل مماثل هنا إذا كان المشتري يحتاج للتحقق من حالات متعددة ---
        // في حالة تأكيد المشتري والدفع، الحالة المتوقعة هي 'MediationOfferAccepted' فقط
        // لذا الشرط الحالي هنا قد يكون صحيحًا لـ buyerConfirmReadinessAndEscrow
        // ولكن إذا كان هناك إجراءات أخرى للمشتري في حالات أخرى، يجب توسيع هذا الشرط.
        const allowedStatusesForBuyerAction = ['MediationOfferAccepted']; // حاليًا، المشتري يؤكد فقط عندما تكون الحالة هكذا
        if (req.path.includes('confirm-readiness-and-escrow')) { // تطبيق الشرط فقط على هذا الـ endpoint
            if (!allowedStatusesForBuyerAction.includes(request.status)) {
                return res.status(400).json({
                    msg: `Action not allowed for buyer at current request status: '${request.status}'. Expected one of: ${allowedStatusesForBuyerAction.join(', ')}.`
                });
            }
        }
        // إذا كان هناك مسارات أخرى يستخدم فيها isBuyerOfMediation، قد تحتاج لمرونة أكثر في التحقق من الحالة.
        // --- نهاية التعديل المقترح (إذا لزم الأمر للمشتري) ---

        req.mediationRequestFromMiddleware = request;
        next();
    } catch (error) {
        console.error("Error in isBuyerOfMediation middleware:", error);
        res.status(500).json({ msg: "Server error during buyer authorization for mediation." });
    }
};