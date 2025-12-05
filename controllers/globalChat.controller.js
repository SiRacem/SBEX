// server/controllers/globalChat.controller.js

const GlobalMessage = require('../models/GlobalMessage');
const User = require('../models/User');
const mongoose = require('mongoose');

// إعدادات الحماية من السبام (2 ثانية بين الرسائل)
const SPAM_COOLDOWN_MS = 2000; 
const userMessageTimestamps = new Map();

// --- 1. جلب الرسائل ---
const getRecentMessages = async (req, res) => {
    try {
        const messages = await GlobalMessage.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('sender', 'fullName avatarUrl userRole level reputationLevel')
            .populate('replyTo');
        
        const pinnedMessage = await GlobalMessage.findOne({ isPinned: true })
            .populate('sender', 'fullName avatarUrl');

        res.status(200).json({ 
            messages: messages.reverse(), 
            pinnedMessage 
        });
    } catch (error) {
        res.status(500).json({ msg: "Error fetching messages" });
    }
};

// --- 2. التحقق من الرسالة (حظر + سبام) ---
const validateMessage = async (userId, content) => {
    const user = await User.findById(userId).select('chatMutedUntil userRole');
    
    // أ) التحقق من الحظر (Mute)
    if (user.chatMutedUntil && new Date() < user.chatMutedUntil) {
        const timeLeft = Math.ceil((user.chatMutedUntil - new Date()) / 60000);
        
        // رمي خطأ يحتوي على مفتاح الترجمة والمتغيرات
        const error = new Error('User is muted');
        error.translationKey = 'apiErrors.userMuted'; 
        error.translationParams = { minutes: timeLeft };
        throw error;
    }

    // ب) التحقق من السبام (لغير الأدمن)
    if (user.userRole !== 'Admin') {
        const lastTime = userMessageTimestamps.get(userId.toString());
        if (lastTime && (Date.now() - lastTime < SPAM_COOLDOWN_MS)) {
             const error = new Error('Spam cooldown');
             error.translationKey = 'apiErrors.spamCooldown'; // تأكد من إضافتها في translation.json
             throw error;
        }
        userMessageTimestamps.set(userId.toString(), Date.now());
    }

    return user;
};

// --- 3. أدوات الأدمن (Mute User) ---
const adminMuteUser = async (req, res) => {
    const { userId, duration, unit, reason } = req.body; 
    if (req.user.userRole !== 'Admin') return res.status(403).json({ msg: "Admins only." });

    let multiplier = 60 * 1000;
    if (unit === 'hours') multiplier = 60 * 60 * 1000;
    if (unit === 'days') multiplier = 24 * 60 * 60 * 1000;

    const durationNum = parseInt(duration, 10); // تحويل للنظام العشري
    const muteUntil = new Date(Date.now() + (durationNum * multiplier));

    try {
        await User.findByIdAndUpdate(userId, { chatMutedUntil: muteUntil });
        if (req.io) {
            req.io.emit('global_chat_event', { 
                type: 'system', 
                content: `User was muted for ${duration} ${unit}. Reason: ${reason || 'Violation'}` 
            });
        }
        res.status(200).json({ msg: "User muted successfully" });
    } catch (error) {
        res.status(500).json({ msg: "Error muting user" });
    }
};

// --- 4. أدوات الأدمن (Delete Message) ---
const adminDeleteMessage = async (req, res) => {
    if (req.user.userRole !== 'Admin') return res.status(403).json({ msg: "Admins only." });
    try {
        await GlobalMessage.findByIdAndDelete(req.params.id);
        if (req.io) req.io.emit('message_deleted', req.params.id);
        res.status(200).json({ msg: "Deleted" });
    } catch (error) {
        res.status(500).json({ msg: "Error deleting" });
    }
};

// --- 5. أدوات الأدمن (Pin Message) ---
const adminPinMessage = async (req, res) => {
    if (req.user.userRole !== 'Admin') return res.status(403).json({ msg: "Admins only." });
    const { messageId } = req.body;
    try {
        await GlobalMessage.updateMany({}, { isPinned: false });
        const msg = await GlobalMessage.findByIdAndUpdate(messageId, { isPinned: true }, { new: true })
            .populate('sender', 'fullName avatarUrl'); 
        if (req.io) req.io.emit('message_pinned', msg);
        res.status(200).json({ msg: "Pinned" });
    } catch (error) {
        res.status(500).json({ msg: "Error pinning" });
    }
};

// --- 6. أدوات الأدمن (Clear Chat) ---
const adminClearChat = async (req, res) => {
    if (req.user.userRole !== 'Admin') return res.status(403).json({ msg: "Admins only." });
    try {
        await GlobalMessage.deleteMany({});
        if (req.io) req.io.emit('chat_cleared');
        res.status(200).json({ msg: "Chat cleared" });
    } catch (error) {
        res.status(500).json({ msg: "Error clearing chat" });
    }
};

module.exports = {
    getRecentMessages,
    validateMessage,
    adminMuteUser,
    adminDeleteMessage,
    adminPinMessage,
    adminClearChat
};