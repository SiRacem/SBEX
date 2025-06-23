// server/router/ticket.router.js
const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const { isAdmin, isSupport, isAdminOrSupport } = require('../middlewares/roleCheck'); // <--- [!!! تعديل مهم]
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
    isAdminOrSupport,
    ticketController.getAllTicketsForAdmin
);
// ***** مسار الأدمن لجلب تذكرة معينة *****
router.get(
    '/panel/tickets/:ticketId',
    verifyAuth,
    isAdminOrSupport,
    ticketController.getTicketByIdForAdmin // دالة مختلفة للأدمن
);
// ***********************************

// ... (بقية مسارات الأدمن) ...
router.post(
    '/panel/tickets/:ticketId/replies',
    verifyAuth,
    isAdminOrSupport,
    handleFileUpload([{ name: 'attachments', maxCount: 5 }]),
    ticketController.addReplyToTicket
);
router.put(
    '/panel/tickets/:ticketId/status',
    verifyAuth,
    isAdminOrSupport,
    ticketController.updateTicketStatusBySupport
);
router.put(
    '/panel/tickets/:ticketId/priority',
    verifyAuth,
    isAdminOrSupport,
    ticketController.updateTicketPriorityBySupport
);
router.put(
    '/panel/tickets/:ticketId/assign',
    verifyAuth,
    isAdminOrSupport,
    ticketController.assignTicketToSupport
);

module.exports = router;