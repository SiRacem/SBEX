// server/router/ticket.router.js
const express = require('express');
const router = express.Router();
const { verifyAuth, verifyAdmin, verifySupport, verifyAdminOrSupport } = require('../middlewares/verifyAuth');
const { handleFileUpload } = require('../middlewares/fileUpload');
const ticketController = require('../controllers/ticket.controller');

// --- User Routes ---
router.post(
    '/tickets',
    verifyAuth,
    handleFileUpload([{ name: 'attachments', maxCount: 5 }]),
    ticketController.createTicket
);

router.get('/tickets', verifyAuth, ticketController.getUserTickets); // لجلب قائمة تذاكر المستخدم

// ***** هذا هو المسار المهم *****
router.get(
    '/tickets/:ticketId', // تأكد أن هذا هو الشكل: /tickets/ ثم معامل اسمه ticketId
    verifyAuth,
    ticketController.getTicketByIdForUser // الدالة التي يجب أن تُستدعى
);
// *****************************

router.post(
    '/tickets/:ticketId/replies',
    verifyAuth,
    handleFileUpload([{ name: 'attachments', maxCount: 5 }]),
    ticketController.addReplyToTicket
);
router.put('/tickets/:ticketId/close', verifyAuth, ticketController.closeTicketByUser);


// --- Admin/Support Panel Routes ---
router.get(
    '/panel/tickets',
    verifyAuth,
    verifyAdminOrSupport,
    ticketController.getAllTicketsForAdmin
);
// ***** مسار الأدمن لجلب تذكرة معينة *****
router.get(
    '/panel/tickets/:ticketId',
    verifyAuth,
    verifyAdminOrSupport,
    ticketController.getTicketByIdForAdmin // دالة مختلفة للأدمن
);
// ***********************************

// ... (بقية مسارات الأدمن) ...
router.post(
    '/panel/tickets/:ticketId/replies',
    verifyAuth,
    verifyAdminOrSupport,
    handleFileUpload([{ name: 'attachments', maxCount: 5 }]),
    ticketController.addReplyToTicket
);
router.put(
    '/panel/tickets/:ticketId/status',
    verifyAuth,
    verifyAdminOrSupport,
    ticketController.updateTicketStatusBySupport
);
router.put(
    '/panel/tickets/:ticketId/priority',
    verifyAuth,
    verifyAdminOrSupport,
    ticketController.updateTicketPriorityBySupport
);
router.put(
    '/panel/tickets/:ticketId/assign',
    verifyAuth,
    verifyAdminOrSupport,
    ticketController.assignTicketToSupport
);

module.exports = router;