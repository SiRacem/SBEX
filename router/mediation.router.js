// router/mediation.router.js

const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// استيراد middleware و controllers
const { isAdmin, isAssignedMediator, canAccessAdminSubChat } = require('../middlewares/roleCheck');
const {
    adminGetPendingAssignmentRequests,
    adminAssignMediator,
    getAvailableRandomMediators,
    sellerAssignSelectedMediator,
    mediatorAcceptAssignment,
    mediatorRejectAssignment,
    getMediatorPendingAssignments,
    getMediatorAcceptedAwaitingParties,
    sellerConfirmReadiness,
    buyerConfirmReadinessAndEscrow,
    getBuyerMediationRequests,
    buyerRejectMediation,
    getMediationChatHistory,
    getMediationRequestDetailsController,
    uploadChatImage, // <-- الدالة الصحيحة موجودة
    getMyMediationSummariesController,
    buyerConfirmReceiptController,
    openDisputeController,
    getMediatorDisputedCasesController,
    adminGetDisputedCasesController,
    adminResolveDisputeController,
    getMyAllMediationRequests, // <-- الدالة الصحيحة موجودة
    adminCreateSubChatController,
    adminSendSubChatMessageController,
    adminGetSubChatMessagesController,
    adminGetAllSubChatsForDisputeController,
    adminMarkSubChatMessagesReadController
} = require('../controllers/mediation.controller');
const isQualifiedMediator = require('../middlewares/isQualifiedMediator');
const { isSellerOfMediation, isBuyerOfMediation } = require('../middlewares/mediationPartyCheck');

// --- [!!!] تم نقل هذا المسار إلى هنا ليكون مع المسارات العامة للمستخدم [!!!] ---
router.get('/my-requests/all', verifyAuth, getMyAllMediationRequests);


// --- مسارات الأدمن ---
router.get('/admin/pending-assignment', verifyAuth, isAdmin, adminGetPendingAssignmentRequests);
router.put('/admin/assign/:requestId', verifyAuth, isAdmin, adminAssignMediator);
router.get('/admin/disputed-cases', verifyAuth, isAdmin, adminGetDisputedCasesController);
router.put('/admin/resolve-dispute/:mediationRequestId', verifyAuth, isAdmin, adminResolveDisputeController);

// --- مسارات البائع ---
router.get('/available-random/:mediationRequestId', verifyAuth, isSellerOfMediation, getAvailableRandomMediators);
router.put('/assign-selected/:mediationRequestId', verifyAuth, sellerAssignSelectedMediator);
router.put('/seller/confirm-readiness/:mediationRequestId', verifyAuth, isSellerOfMediation, sellerConfirmReadiness);

// --- مسارات المشتري ---
router.put('/buyer/confirm-readiness-and-escrow/:mediationRequestId', verifyAuth, isBuyerOfMediation, buyerConfirmReadinessAndEscrow);
router.get('/buyer/my-requests', verifyAuth, getBuyerMediationRequests);
router.put('/buyer/reject-mediation/:mediationRequestId', verifyAuth, isBuyerOfMediation, buyerRejectMediation);

// --- مسارات الوسيط ---
router.get('/mediator/my-assignments', verifyAuth, isQualifiedMediator, getMediatorPendingAssignments);
router.put('/mediator/accept/:mediationRequestId', verifyAuth, isAssignedMediator, mediatorAcceptAssignment);
router.put('/mediator/reject/:mediationRequestId', verifyAuth, isAssignedMediator, mediatorRejectAssignment);
router.get('/mediator/accepted-awaiting-parties', verifyAuth, isQualifiedMediator, getMediatorAcceptedAwaitingParties);
router.get('/mediator/disputed-cases', verifyAuth, isQualifiedMediator, getMediatorDisputedCasesController);

// --- مسارات عامة ومشتركة ---
router.get('/request-details/:mediationRequestId', verifyAuth, getMediationRequestDetailsController);
router.get('/my-summaries', verifyAuth, getMyMediationSummariesController);
router.put('/buyer/confirm-receipt/:mediationRequestId', verifyAuth, buyerConfirmReceiptController);
router.put('/open-dispute/:mediationRequestId', verifyAuth, openDisputeController);

// --- مسارات المحادثة ---
router.get('/chat/:mediationRequestId/history', verifyAuth, getMediationChatHistory);

const uploadDir = path.join(__dirname, "..", "uploads", "chat_images");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
        cb(null, uniqueName);
    },
});
const upload = multer({ storage });
router.post("/chat/upload-image", verifyAuth, upload.single("image"), uploadChatImage);


// --- مسارات المحادثات الفرعية للأدمن ---
router.post('/:mediationRequestId/admin/subchats', verifyAuth, isAdmin, adminCreateSubChatController);
router.get('/:mediationRequestId/admin/subchats', verifyAuth, isAdmin, adminGetAllSubChatsForDisputeController);
router.post('/:mediationRequestId/admin/subchats/:subChatId/messages', verifyAuth, canAccessAdminSubChat, adminSendSubChatMessageController);
router.get('/:mediationRequestId/admin/subchats/:subChatId/messages', verifyAuth, canAccessAdminSubChat, adminGetSubChatMessagesController);
router.post('/:mediationRequestId/admin/subchats/:subChatId/messages/read', verifyAuth, canAccessAdminSubChat, adminMarkSubChatMessagesReadController);


module.exports = router;