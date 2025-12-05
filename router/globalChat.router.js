const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/verifyAuth');
const controller = require('../controllers/globalChat.controller');

// العامة
router.get('/messages', verifyAuth, controller.getRecentMessages);

// الأدمن (تأكد من تطابق هذه المسارات مع chatAction.js)
router.post('/admin/mute', verifyAuth, controller.adminMuteUser);
router.delete('/admin/delete/:id', verifyAuth, controller.adminDeleteMessage);
router.put('/admin/pin', verifyAuth, controller.adminPinMessage); // لاحظ: PUT وليس POST
router.delete('/admin/clear', verifyAuth, controller.adminClearChat); // لاحظ: DELETE وليس POST

module.exports = router;