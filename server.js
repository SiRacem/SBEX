require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const config = require('config');
const mongoose = require('mongoose');
const fs = require('fs');
const cron = require('node-cron');
const { releaseDuePendingFunds } = require('./services/pendingFundsReleaseService');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { handleExpiredMediationAssignments } = require('./controllers/mediation.controller');
const { updateLeaderboardSnapshots } = require('./services/leaderboardService');
const { runAutoConfirmJob } = require('./services/tournamentEngine'); // استيراد خدمة الأتمتة
const { checkMatchTimeouts, setPlayerReady, updatePlayerActivity, getMatchTimeoutStatus } = require('./services/matchTimeout.service');
const tournamentController = require('./controllers/tournament.controller');

// --- Configuration Reading ---
const PORT = config.get('PORT') || 8000;
let FRONTEND_URL = "http://localhost:3000";
if (config.has('FRONTEND_URL')) {
    FRONTEND_URL = config.get('FRONTEND_URL');
} else {
    console.warn('[Server Config] WARNING: FRONTEND_URL is not defined in config files.');
}
const JWT_SECRET = config.get('secret');
if (!JWT_SECRET) console.error("[Server Config] CRITICAL: JWT_SECRET is not defined in config!");

// --- Route Imports ---
const user = require('./router/user');
const product = require('./router/product');
const cart = require('./router/cart');
const notificationRouter = require('./router/notification');
const wallet = require('./router/wallet');
const ratingRoute = require('./router/rating');
const paymentMethodRoute = require('./router/paymentMethod');
const depositRoute = require('./router/deposit.router');
const uploadRoute = require('./router/upload.router');
const withdrawalRoute = require('./router/withdrawal.router');
const mediationRoute = require('./router/mediation.router');
const ticketRoute = require('./router/ticket.router');
const reportRoute = require('./router/report');
const faqRoute = require('./router/faq.router');
const newsRouter = require('./router/newsRouter');
const achievementRouter = require('./router/achievement.router');
const leaderboardRouter = require('./router/leaderboard.router');
const referralRouter = require('./router/referral.router');
const questRouter = require('./router/quest.router');
const globalChatRouter = require('./router/globalChat.router');
const tournamentRouter = require('./router/tournament.router');
const matchRouter = require('./router/match.router');
const leaguesRouter = require('./router/leagues.router');

// --- Model Imports ---
const Notification = require('./models/Notification');
const MediationRequest = require('./models/MediationRequest');
const User = require('./models/User');
const SystemSetting = require('./models/SystemSetting');

const connectDB = require('./config/connectDB');

// [!!!] START: تعريف app و server هنا [!!!]
const app = express();
const server = http.createServer(app);
// [!!!] END: نهاية التعريف

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST", "PUT"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

let onlineUsers = {}; // { userId: socketId }
let matchRoomUsers = {}; // { matchId: [userId1, userId2, ...] } - Track users per match room

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log(`⚡: Socket ${socket.id} user connected`);

    socket.on('addUser', async (userId) => {
        console.log(`[Socket Event - addUser] Received for userId: ${userId} from socket: ${socket.id}`);
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const userIdStr = userId.toString();
            onlineUsers[userIdStr] = socket.id;
            socket.join(userIdStr); // [⚡ FIX] Join the specific user room
            socket.userIdForChat = userIdStr;
            try {
                const userDoc = await User.findById(userIdStr).select('fullName avatarUrl').lean();
                if (userDoc) {
                    socket.userFullNameForChat = userDoc.fullName;
                    socket.userAvatarUrlForChat = userDoc.avatarUrl;
                } else {
                    socket.userFullNameForChat = 'User (Unknown DB)';
                    socket.userAvatarUrlForChat = null;
                }
            } catch (error) {
                console.error(`[Socket Event - addUser] Error fetching user details for ${userIdStr}:`, error);
                socket.userFullNameForChat = 'User (Fetch Error)';
                socket.userAvatarUrlForChat = null;
            }
            io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
        } else {
            console.warn(`[Socket Event - addUser] Invalid or missing userId for socket ${socket.id}: ${userId}`);
        }
    });

    socket.on('joinMediationChat', async ({ mediationRequestId, userId, userRole }) => {
        const userIdToJoin = socket.userIdForChat || userId;
        console.log(`[Socket Event - joinMediationChat] Attempting join. SocketID: ${socket.id}, MediationID: ${mediationRequestId}, UserID: ${userIdToJoin}, UserRole: ${userRole}`);

        if (!userIdToJoin || !mediationRequestId || !mongoose.Types.ObjectId.isValid(userIdToJoin) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            console.warn(`[joinMediationChat] Invalid IDs. UserID: ${userIdToJoin}, MediationID: ${mediationRequestId}`);
            return socket.emit('mediationChatError', { message: "Missing or invalid user/mediation ID for chat join." });
        }
        if (!socket.userFullNameForChat || socket.userIdForChat !== userIdToJoin.toString()) {
            try {
                const userDoc = await User.findById(userIdToJoin).select('fullName avatarUrl').lean();
                if (userDoc) {
                    socket.userIdForChat = userIdToJoin.toString();
                    socket.userFullNameForChat = userDoc.fullName;
                    socket.userAvatarUrlForChat = userDoc.avatarUrl;
                    console.log(`[joinMediationChat] Refreshed user details on socket: '${socket.userFullNameForChat}'`);
                } else {
                    console.warn(`[joinMediationChat] User document not found for ID: ${userIdToJoin} during socket user detail refresh.`);
                    socket.userFullNameForChat = userRole === 'Admin' ? 'Admin' : 'User (Unknown DB)';
                    socket.userAvatarUrlForChat = null;
                }
            } catch (e) {
                console.error(`[joinMediationChat] Error refreshing user details for socket:`, e);
                socket.userFullNameForChat = userRole === 'Admin' ? 'Admin' : 'User (Error)';
                socket.userAvatarUrlForChat = null;
            }
        }
        try {
            const request = await MediationRequest.findById(mediationRequestId)
                .select('seller buyer mediator status disputeOverseers adminJoinMessageSent product')
                .populate('product', 'title').lean();

            if (!request) {
                console.warn(`[joinMediationChat] Mediation request ${mediationRequestId} not found.`);
                return socket.emit('mediationChatError', { message: "Mediation request not found." });
            }

            const isSeller = request.seller?.toString() === userIdToJoin;
            const isBuyer = request.buyer?.toString() === userIdToJoin;
            const isMediator = request.mediator?.toString() === userIdToJoin;
            const isAdmin = userRole === 'Admin';
            const isDesignatedOverseer = Array.isArray(request.disputeOverseers) && request.disputeOverseers.some(id => id.toString() === userIdToJoin);
            let canAccess = isSeller || isBuyer || isMediator || isDesignatedOverseer;
            if (isAdmin && request.status === 'Disputed') canAccess = true;

            if (!canAccess) {
                console.warn(`[joinMediationChat] User ${userIdToJoin} (Role: ${userRole}) is UNAUTHORIZED for mediation ${mediationRequestId}. Status: ${request.status}`);
                return socket.emit('mediationChatError', { message: "Unauthorized to join this mediation chat." });
            }

            socket.join(mediationRequestId.toString());
            console.log(`[joinMediationChat] Socket ${socket.id} (User: ${userIdToJoin}) successfully joined room ${mediationRequestId}.`);
            socket.emit('joinedMediationChatSuccess', { mediationRequestId, message: `Successfully joined chat for: ${request.product?.title || mediationRequestId}.` });

            if (isAdmin && request.status === 'Disputed') {
                if (!isDesignatedOverseer) {
                    await MediationRequest.updateOne(
                        { _id: mediationRequestId },
                        { $addToSet: { disputeOverseers: userIdToJoin } }
                    );
                    console.log(`[joinMediationChat] Admin ${userIdToJoin} added to disputeOverseers.`);

                    const finalUpdatedRequest = await MediationRequest.findById(mediationRequestId)
                        .populate('product', 'title status')
                        .populate('seller', '_id fullName avatarUrl userRole')
                        .populate('buyer', '_id fullName avatarUrl userRole')
                        .populate('mediator', '_id fullName avatarUrl userRole')
                        .populate('disputeOverseers', '_id fullName avatarUrl userRole')
                        .lean();

                    if (finalUpdatedRequest) {
                        io.to(mediationRequestId.toString()).emit('mediation_request_updated', {
                            mediationRequestId: mediationRequestId.toString(),
                            updatedMediationRequestData: finalUpdatedRequest
                        });
                        console.log(`[joinMediationChat] Emitted 'mediation_request_updated' to all parties after admin joined.`);
                    }
                }

                const updatedRequestWithMessageFlag = await MediationRequest.findOneAndUpdate(
                    { _id: mediationRequestId, adminJoinMessageSent: false },
                    { $set: { adminJoinMessageSent: true } }
                );

                if (updatedRequestWithMessageFlag) {
                    const adminName = socket.userFullNameForChat || 'Admin';
                    console.log(`[joinMediationChat] Creating admin join message for: ${adminName}`);

                    const systemMessage = {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'system',
                        timestamp: new Date(),
                        messageKey: 'mediationChatPage.adminJoined',
                        messageParams: { adminName: adminName }
                    };

                    console.log(`[joinMediationChat] System message object:`, systemMessage);

                    // استخدم findOneAndUpdate للحصول على المستند المحدث مع الرسالة الجديدة
                    const requestAfterMessage = await MediationRequest.findOneAndUpdate(
                        { _id: mediationRequestId },
                        { $push: { chatMessages: systemMessage } },
                        { new: true }
                    ).populate('chatMessages.sender', 'fullName avatarUrl _id');

                    if (requestAfterMessage && requestAfterMessage.chatMessages) {
                        const adminJoinMessage = requestAfterMessage.chatMessages[requestAfterMessage.chatMessages.length - 1];
                        console.log(`[joinMediationChat] Saved message in database:`, {
                            messageKey: adminJoinMessage.messageKey,
                            messageParams: adminJoinMessage.messageParams,
                            type: adminJoinMessage.type
                        });
                    }


                    // أرسل رسالة انضمام المسؤول مباشرة للجميع
                    if (requestAfterMessage && requestAfterMessage.chatMessages) {
                        const adminJoinMessage = requestAfterMessage.chatMessages[requestAfterMessage.chatMessages.length - 1];
                        console.log(`[joinMediationChat] Saved message in database:`, {
                            messageKey: adminJoinMessage.messageKey,
                            messageParams: adminJoinMessage.messageParams,
                            type: adminJoinMessage.type
                        });

                        // إنشاء رسالة منظمة للإرسال المباشر
                        const populatedSystemMessage = {
                            _id: adminJoinMessage._id,
                            type: 'system',
                            message: '', // رسالة فارغة لأن المحتوى يأتي من الترجمة
                            messageKey: adminJoinMessage.messageKey,
                            messageParams: adminJoinMessage.messageParams,
                            timestamp: adminJoinMessage.timestamp,
                            sender: { _id: userIdToJoin, fullName: adminName, avatarUrl: socket.userAvatarUrlForChat },
                            readBy: [{ readerId: userIdToJoin, readAt: new Date() }]
                        };

                        // إرسال الرسالة مباشرة لجميع المشاركين
                        io.to(mediationRequestId.toString()).emit('newMediationMessage', populatedSystemMessage);
                        console.log(`[joinMediationChat] Admin join system message sent directly to room`);
                    }
                    // أرسل حدثًا منفصلاً لتحديث قائمة الرسائل بأكملها لضمان التزامن
                    if (requestAfterMessage) {
                        io.to(mediationRequestId.toString()).emit('mediation_chat_history_updated', {
                            mediationRequestId: mediationRequestId.toString(),
                            messages: requestAfterMessage.chatMessages
                        });
                        console.log(`[joinMediationChat] Emitted mediation_chat_history_updated with ${requestAfterMessage.chatMessages.length} messages`);
                    }
                    console.log(`[joinMediationChat] Admin join system message sent and triggered history update.`);
                } else {
                    console.log(`[joinMediationChat] Admin join message was already sent. Skipping.`);
                }
            }
        } catch (error) {
            console.error(`[joinMediationChat] General error for mediation ${mediationRequestId}:`, error.message, error.stack);
            socket.emit('mediationChatError', { message: "An unexpected error occurred while joining the chat." });
        }
    });

    socket.on('sendMediationMessage', async ({ mediationRequestId, messageText, imageUrl }) => {
        const senderId = socket.userIdForChat;
        if (!senderId || !mediationRequestId) return;
        try {
            const newMessageData = {
                _id: new mongoose.Types.ObjectId(),
                sender: new mongoose.Types.ObjectId(senderId),
                message: messageText,
                imageUrl,
                type: imageUrl ? 'image' : 'text',
                timestamp: new Date(),
                readBy: [{ readerId: new mongoose.Types.ObjectId(senderId), readAt: new Date() }]
            };
            await MediationRequest.updateOne({ _id: mediationRequestId }, { $push: { chatMessages: newMessageData } });

            const populatedMessageForEmit = {
                ...newMessageData,
                sender: { _id: senderId, fullName: socket.userFullNameForChat, avatarUrl: socket.userAvatarUrlForChat }
            };
            io.to(mediationRequestId.toString()).emit('newMediationMessage', populatedMessageForEmit);

            const request = await MediationRequest.findById(mediationRequestId)
                .select('seller buyer mediator disputeOverseers product')
                .populate('product', 'title')
                .lean();
            if (!request) return;

            const recipientIds = [
                request.seller, request.buyer, request.mediator, ...(request.disputeOverseers || [])
            ].map(id => id?.toString()).filter(id => id && id !== senderId);
            const uniqueRecipientIds = [...new Set(recipientIds)];

            // [!!!] START: تعديل إشعار الرسالة الجديدة [!!!]
            const notificationParams = {
                productName: request.product?.title || 'the mediation',
                senderName: socket.userFullNameForChat || 'A user'
            };

            const notificationsToCreate = uniqueRecipientIds.map(userId => ({
                user: userId,
                type: 'NEW_CHAT_MESSAGE',
                title: 'notification_titles.NEW_CHAT_MESSAGE',
                message: 'notification_messages.NEW_CHAT_MESSAGE',
                messageParams: notificationParams,
                relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
            }));
            // [!!!] END: نهاية تعديل الإشعار [!!!]

            if (notificationsToCreate.length > 0) {
                const createdNotifications = await Notification.insertMany(notificationsToCreate);
                createdNotifications.forEach(notif => {
                    const recipientSocketId = onlineUsers[notif.user.toString()];
                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('new_notification', notif);
                    }
                });
            }
        } catch (error) {
            console.error(`[sendMediationMessage] Error:`, error);
        }
    });

    socket.on("start_typing", ({ mediationRequestId, userId, fullName, avatarUrl }) => {
        if (mediationRequestId && userId) {
            socket.to(mediationRequestId.toString()).emit("user_typing", { mediationRequestId, userId, fullName, avatarUrl });
        }
    });

    socket.on("stop_typing", ({ mediationRequestId, userId }) => {
        if (mediationRequestId && userId) {
            socket.to(mediationRequestId.toString()).emit("user_stopped_typing", { mediationRequestId, userId });
        }
    });

    socket.on('markMessagesAsRead', async ({ mediationRequestId, messageIds, readerUserId }) => {
        if (!mediationRequestId || !Array.isArray(messageIds) || messageIds.length === 0 || !readerUserId) return;
        try {
            const readerObjectId = new mongoose.Types.ObjectId(readerUserId);
            const readerDetails = await User.findById(readerObjectId).select('fullName avatarUrl').lean();
            if (!readerDetails) return;
            const updateResult = await MediationRequest.updateOne(
                { _id: new mongoose.Types.ObjectId(mediationRequestId) },
                {
                    $push: {
                        'chatMessages.$[elem].readBy': {
                            readerId: readerObjectId,
                            fullName: readerDetails.fullName,
                            avatarUrl: readerDetails.avatarUrl,
                            readAt: new Date()
                        }
                    }
                },
                {
                    arrayFilters: [
                        {
                            'elem._id': { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) },
                            'elem.readBy.readerId': { $ne: readerObjectId }
                        }
                    ]
                }
            );
            if (updateResult.modifiedCount > 0) {
                const updatePayload = {
                    mediationRequestId,
                    updatedMessages: messageIds.map(id => ({ _id: id, reader: { readerId: readerUserId, fullName: readerDetails.fullName, avatarUrl: readerDetails.avatarUrl, readAt: new Date() } }))
                };
                io.to(mediationRequestId.toString()).emit('messages_read_update', updatePayload);
            }
        } catch (error) { console.error(`[markAsRead] Error for main chat:`, error); }
    });

    socket.on('joinAdminSubChat', async ({ mediationRequestId, subChatId, userId, userRole }) => {
        if (!userId || !mediationRequestId || !subChatId) return;
        const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
        try {
            socket.join(subChatRoomName);
            console.log(`[Socket] User ${userId} joined room: ${subChatRoomName}`);
            socket.emit('joinedAdminSubChatSuccess', { subChatId, roomName: subChatRoomName });
        } catch (error) {
            console.error(`[joinAdminSubChat] Error:`, error);
            socket.emit('adminSubChatError', { subChatId, message: 'Failed to join sub-chat room.' });
        }
    });

    socket.on('sendAdminSubChatMessage', async ({ mediationRequestId, subChatId, messageText, imageUrl }) => {
        const senderId = socket.userIdForChat;
        if (!senderId || !mediationRequestId || !subChatId) return;
        try {
            const newMessageData = {
                _id: new mongoose.Types.ObjectId(),
                sender: new mongoose.Types.ObjectId(senderId),
                message: messageText,
                imageUrl,
                type: imageUrl ? 'image' : 'text',
                timestamp: new Date(),
                readBy: [{ readerId: new mongoose.Types.ObjectId(senderId), readAt: new Date() }]
            };
            await MediationRequest.updateOne(
                { _id: mediationRequestId, "adminSubChats.subChatId": subChatId },
                {
                    $push: { "adminSubChats.$.messages": newMessageData },
                    $set: { "adminSubChats.$.lastMessageAt": newMessageData.timestamp }
                }
            );
            const populatedMessageForEmit = {
                ...newMessageData,
                sender: { _id: senderId, fullName: socket.userFullNameForChat, avatarUrl: socket.userAvatarUrlForChat }
            };
            const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
            io.to(subChatRoomName).emit('new_admin_sub_chat_message', {
                mediationRequestId,
                subChatId,
                message: populatedMessageForEmit
            });
            console.log(`[Socket] Emitted 'new_admin_sub_chat_message' to room: ${subChatRoomName}`);
            const requestWithSubChat = await MediationRequest.findOne(
                { _id: mediationRequestId, 'adminSubChats.subChatId': subChatId },
                { 'adminSubChats.$': 1, product: 1 }
            ).populate('product', 'title').lean();
            if (!requestWithSubChat || !requestWithSubChat.adminSubChats || requestWithSubChat.adminSubChats.length === 0) return;
            const subChat = requestWithSubChat.adminSubChats[0];
            const recipientIds = subChat.participants
                .map(p => p.userId?.toString())
                .filter(id => id && id !== senderId);
            const uniqueRecipientIds = [...new Set(recipientIds)];
            const productTitle = requestWithSubChat.product?.title || 'the dispute';
            const subChatTitleForNotif = subChat.title || 'Private Chat';
            const senderName = socket.userFullNameForChat || 'A user';

            // لا نستخدم نصوص ثابتة، بل مفاتيح ترجمة
            const notificationsToCreate = uniqueRecipientIds.map(userId => ({
                user: userId,
                type: 'NEW_ADMIN_SUBCHAT_MESSAGE',
                title: 'notification_titles.NEW_ADMIN_SUBCHAT_MESSAGE',
                message: 'notification_messages.NEW_ADMIN_SUBCHAT_MESSAGE',
                messageParams: {
                    chatTitle: subChatTitleForNotif,
                    senderName: senderName,
                    productName: productTitle
                },
                relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' },
                metadata: { subChatId: subChatId.toString() }
            }));
            if (notificationsToCreate.length > 0) {
                const createdNotifications = await Notification.insertMany(notificationsToCreate);
                createdNotifications.forEach(notif => {
                    const recipientSocketId = onlineUsers[notif.user.toString()];
                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('new_notification', notif);
                        console.log(`[Notification] Sent 'new_notification' for sub-chat to user ${notif.user.toString()}`);
                    }
                });
            }
        } catch (error) {
            console.error(`[sendAdminSubChatMessage] Error:`, error);
        }
    });

    socket.on("adminSubChatStartTyping", async ({ mediationRequestId, subChatId, userId, fullName, avatarUrl }) => {
        const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
        if (mediationRequestId && subChatId && userId) {
            socket.to(subChatRoomName).emit("adminSubChatUserTyping", { subChatId, userId, fullName, avatarUrl });
        }
    });

    socket.on("adminSubChatStopTyping", ({ mediationRequestId, subChatId }) => {
        const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
        if (mediationRequestId && subChatId && socket.userIdForChat) {
            socket.to(subChatRoomName).emit("adminSubChatUserStoppedTyping", { subChatId, userId: socket.userIdForChat });
        }
    });

    socket.on('markAdminSubChatMessagesRead', async ({ mediationRequestId, subChatId, messageIds, readerUserId }) => {
        if (!readerUserId || !Array.isArray(messageIds) || messageIds.length === 0 || !subChatId || !mediationRequestId) {
            return console.warn(`[markAdminRead] Invalid parameters received from client.`, { mediationRequestId, subChatId, messageIds, readerUserId });
        }
        try {
            const readerObjectId = new mongoose.Types.ObjectId(readerUserId);
            const readerDetails = await User.findById(readerObjectId).select('fullName avatarUrl').lean();
            if (!readerDetails) return;
            const readReceipt = { readerId: readerObjectId, readAt: new Date() };
            const objectMessageIds = messageIds.map(id => new mongoose.Types.ObjectId(id));
            const updateResult = await MediationRequest.updateOne(
                { _id: new mongoose.Types.ObjectId(mediationRequestId), "adminSubChats.subChatId": new mongoose.Types.ObjectId(subChatId) },
                { $addToSet: { "adminSubChats.$[outer].messages.$[inner].readBy": readReceipt } },
                {
                    arrayFilters: [
                        { "outer.subChatId": new mongoose.Types.ObjectId(subChatId) },
                        {
                            "inner._id": { $in: objectMessageIds },
                            "inner.readBy.readerId": { $ne: readerObjectId }
                        }
                    ]
                }
            );
            if (updateResult.modifiedCount > 0) {
                const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
                const updatePayload = {
                    mediationRequestId,
                    subChatId,
                    readerInfo: {
                        readerId: readerObjectId,
                        fullName: readerDetails.fullName,
                        avatarUrl: readerDetails.avatarUrl,
                        readAt: readReceipt.readAt
                    },
                    messageIds: messageIds,
                };
                io.to(subChatRoomName).emit('admin_sub_chat_messages_status_updated', updatePayload);
                console.log(`[Socket] Emitted 'admin_sub_chat_messages_status_updated' to room: ${subChatRoomName}`);
            }
        } catch (error) { console.error(`[markAdminRead] Error for sub-chat:`, error); }
    });

    socket.on('leaveMediationChat', ({ mediationRequestId }) => {
        if (socket.userIdForChat && mediationRequestId) {
            socket.leave(mediationRequestId.toString());
        }
    });
    socket.on('leaveAdminSubChat', ({ mediationRequestId, subChatId }) => {
        if (socket.userIdForChat && mediationRequestId && subChatId) {
            const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
            socket.leave(subChatRoomName);
        }
    });

    socket.on('join_ticket_room', (ticketId) => {
        if (ticketId) {
            socket.join(ticketId.toString());
            console.log(`[Socket Event - join_ticket_room] Socket ${socket.id} joined room for ticket: ${ticketId}`);
        }
    });

    socket.on('leave_ticket_room', (ticketId) => {
        if (ticketId) {
            socket.leave(ticketId.toString());
            console.log(`[Socket Event - leave_ticket_room] Socket ${socket.id} left room for ticket: ${ticketId}`);
        }
    });

    // 1. الانضمام للشات (اختياري، لكن مفيد لمعرفة عدد المتواجدين)
    socket.on('join_global_chat', () => {
        socket.join('global_chat_room');
    });

    // 2. إرسال رسالة جديدة
    socket.on('send_global_message', async ({ content, replyToId }) => {
        const userId = socket.userIdForChat;
        if (!userId) return socket.emit('global_chat_error', 'Unauthorized');

        try {
            // أ) التحقق (هنا يتم رمي الخطأ المترجم)
            const { validateMessage } = require('./controllers/globalChat.controller');
            await validateMessage(userId, content);

            // ب) حفظ الرسالة
            const GlobalMessage = require('./models/GlobalMessage');
            const newMessage = new GlobalMessage({
                sender: userId,
                content: content,
                replyTo: replyToId || null
            });
            await newMessage.save();

            // ج) تعبئة البيانات وإرسالها
            const populatedMessage = await GlobalMessage.findById(newMessage._id)
                .populate('sender', 'fullName avatarUrl userRole level reputationLevel')
                .populate('replyTo', 'content sender')
                .lean();

            io.emit('new_global_message', populatedMessage);

        } catch (error) {
            if (error.translationKey) {
                socket.emit('global_chat_error', {
                    key: error.translationKey,
                    params: error.translationParams
                });
            } else {
                // في حالة وجود خطأ عادي غير مترجم
                socket.emit('global_chat_error', error.message);
            }
        }
    });

    // 3. الكتابة (Typing...) - ميزة جمالية
    socket.on('global_typing', () => {
        socket.broadcast.emit('user_typing_global', {
            userId: socket.userIdForChat,
            name: socket.userFullNameForChat
        });
    });

    // --- Match Chat ---
    socket.on('join_match_room', (data) => {
        // Support both old format (string matchId) and new format ({ matchId, userId })
        const matchId = typeof data === 'object' ? data.matchId : data;
        const userId = typeof data === 'object' ? data.userId : null;

        if (matchId) {
            const roomName = `match_${matchId}`;
            socket.join(roomName);
            socket.matchRoomId = matchId; // Store for cleanup on disconnect
            socket.matchUserId = userId;

            // Track user in match room
            if (userId) {
                if (!matchRoomUsers[matchId]) {
                    matchRoomUsers[matchId] = [];
                }
                if (!matchRoomUsers[matchId].includes(userId)) {
                    matchRoomUsers[matchId].push(userId);
                }

                // Emit updated room users list to all in room
                io.to(roomName).emit('room_users', matchRoomUsers[matchId]);
                console.log(`[Socket] User ${userId} joined match room: ${roomName}. Room users:`, matchRoomUsers[matchId]);
            } else {
                console.log(`[Socket] Socket ${socket.id} joined match room: ${roomName} (no userId)`);
            }
        }
    });

    socket.on('leave_match_room', (data) => {
        const matchId = typeof data === 'object' ? data.matchId : data;
        const userId = typeof data === 'object' ? data.userId : null;

        if (matchId) {
            const roomName = `match_${matchId}`;
            socket.leave(roomName);

            // Remove user from tracking
            if (userId && matchRoomUsers[matchId]) {
                matchRoomUsers[matchId] = matchRoomUsers[matchId].filter(id => id !== userId);

                // Emit updated room users list to all in room
                io.to(roomName).emit('room_users', matchRoomUsers[matchId]);
                console.log(`[Socket] User ${userId} left match room: ${roomName}. Room users:`, matchRoomUsers[matchId]);

                // Cleanup empty rooms
                if (matchRoomUsers[matchId].length === 0) {
                    delete matchRoomUsers[matchId];
                }
            }
        }
    });

    socket.on('send_match_message', async (data) => {
        // يجب أن يكون هناك نص أو صورة
        if (!data.matchId || !data.senderId || (!data.text && !data.imageUrl)) {
            console.error('[Socket] Invalid match message data:', data);
            return;
        }

        try {
            const Match = require('./models/Match');

            // إنشاء كائن الرسالة مع ObjectId
            const messageToSave = {
                _id: new mongoose.Types.ObjectId(),
                senderId: new mongoose.Types.ObjectId(data.senderId),
                senderName: data.senderName || socket.userFullNameForChat || 'Unknown',
                text: data.text || '',
                imageUrl: data.imageUrl || null,
                timestamp: data.timestamp || new Date()
            };

            // حفظ في القاعدة
            await Match.findByIdAndUpdate(data.matchId, {
                $push: { chatMessages: messageToSave }
            });

            // ⏱️ تحديث آخر نشاط للاعب
            await updatePlayerActivity(data.matchId, data.senderId);

            console.log(`[Socket] Saved match message for match_${data.matchId}`, data.imageUrl ? '(with image)' : '');

            // إرسال فوري لجميع المشاركين في الغرفة
            io.to(`match_${data.matchId}`).emit('new_match_message', {
                _id: messageToSave._id,
                senderId: data.senderId,
                senderName: messageToSave.senderName,
                text: messageToSave.text,
                imageUrl: messageToSave.imageUrl,
                timestamp: messageToSave.timestamp
            });

        } catch (error) {
            console.error('[Socket] Match chat save error:', error);
        }
    });

    // 🎮 اللاعب يضغط "جاهز للعب"
    socket.on('player_ready', async ({ matchId, userId }) => {
        if (!matchId || !userId) return;

        try {
            const result = await setPlayerReady(matchId, userId, io);

            if (result.success) {
                socket.emit('player_ready_confirmed', {
                    matchId,
                    isPlayer1: result.isPlayer1,
                    bothReady: result.bothReady
                });

                console.log(`[Socket] Player ${userId} is now ready for match ${matchId}`);
            } else {
                socket.emit('player_ready_error', { matchId, message: result.message });
            }
        } catch (error) {
            console.error('[Socket] player_ready error:', error);
            socket.emit('player_ready_error', { matchId, message: error.message });
        }
    });

    // ⏰ طلب حالة الـ timeout
    socket.on('get_match_timeout_status', async ({ matchId }) => {
        if (!matchId) return;

        try {
            const status = await getMatchTimeoutStatus(matchId);
            socket.emit('match_timeout_status', { matchId, ...status });
        } catch (error) {
            console.error('[Socket] get_match_timeout_status error:', error);
        }
    });

    socket.on('disconnect', (reason) => {
        if (socket.userIdForChat) {
            const userIdStr = socket.userIdForChat.toString();
            if (onlineUsers[userIdStr] === socket.id) {
                delete onlineUsers[userIdStr];
                io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
            }
        }

        // 🔄 إزالة المستخدم من غرفة المباراة عند قطع الاتصال
        if (socket.matchRoomId && socket.matchUserId) {
            const matchId = socket.matchRoomId;
            const userId = socket.matchUserId;

            if (matchRoomUsers[matchId]) {
                matchRoomUsers[matchId] = matchRoomUsers[matchId].filter(id => id !== userId);
                io.to(`match_${matchId}`).emit('room_users', matchRoomUsers[matchId]);

                if (matchRoomUsers[matchId].length === 0) {
                    delete matchRoomUsers[matchId];
                }
            }
        }
    });
});
// --- End of Socket.IO Logic ---


cron.schedule('*/5 * * * *', async () => {
    console.log(`[CRON MASTER] Triggering 'releaseDuePendingFunds' job at ${new Date().toISOString()}`);
    try {
        const result = await releaseDuePendingFunds(io, onlineUsers);
        console.log(`[CRON MASTER] Job "releaseDuePendingFunds" completed. Released: ${result.fundsReleasedCount}, Errors: ${result.errorsCount}.`);
    } catch (error) {
        console.error('[CRON MASTER] Critical error during scheduled "releaseDuePendingFunds" job:', error);
    }
});

// [!!!] START: المهمة المجدولة الجديدة لإلغاء طلبات الوساطة
cron.schedule('* * * * *', async () => {
    console.log(`[CRON MASTER] Triggering 'handleExpiredMediationAssignments' job at ${new Date().toISOString()}`);
    try {
        // We pass io and onlineUsers so the job can send real-time updates
        const result = await handleExpiredMediationAssignments(io, onlineUsers);
        console.log(`[CRON MASTER] Job "handleExpiredMediationAssignments" completed. Processed: ${result.processed}, Errors: ${result.errors}.`);
    } catch (error) {
        console.error('[CRON MASTER] Critical error during scheduled "handleExpiredMediationAssignments" job:', error);
    }
});
// [!!!] END: نهاية المهمة المجدولة الجديدة

// [!!!] START: مهمة تحديث الترتيب كل 6 ساعات [!!!]
// التوقيت: الدقيقة 0، الساعة 0, 6, 12, 18
cron.schedule('0 0,6,12,18 * * *', async () => {
    await updateLeaderboardSnapshots(io); // <-- مرر io هنا
});
// [!!!] END: نهاية الإضافة [!!!]

// [!!!] START: مهمة أتمتة البطولات (كل دقيقة) [!!!]
cron.schedule('* * * * *', async () => {
    // نمرر io لكي نرسل تحديثات لحظية للمباريات التي انتهت تلقائياً
    const confirmedCount = await runAutoConfirmJob(io);
    if (confirmedCount > 0) {
        console.log(`[CRON TOURNAMENT] Auto-confirmed ${confirmedCount} matches.`);
    }
});
// [!!!] END: نهاية مهمة البطولات [!!!]

cron.schedule('* * * * *', async () => {
    try {
        console.log('[CRON] Checking for tournaments to start/cancel...');
        await tournamentController.checkAndStartScheduledTournaments(io);
    } catch (error) {
        console.error('[CRON TOURNAMENT START] Error:', error);
    }
});

// [!!!] START: مهمة فحص انتهاء وقت المباريات (كل دقيقة) [!!!]
cron.schedule('* * * * *', async () => {
    try {
        const result = await checkMatchTimeouts(io);
        if (result.processed > 0) {
            console.log(`[CRON MATCH TIMEOUT] Processed ${result.processed} timed-out matches.`);
        }
    } catch (error) {
        console.error('[CRON MATCH TIMEOUT] Error:', error);
    }
});
// [!!!] END: نهاية مهمة انتهاء الوقت [!!!]

// --- [!!!] START: الترتيب الصحيح والنهائي للـ MIDDLEWARE [!!!]
// 1. تطبيق ترويسات الأمان الأساسية
app.use(helmet());

// 2. [!!!] إضافة ترويسة CORP هنا في المكان الصحيح [!!!]
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

// 3. تفعيل سياسة CORS
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// 4. تفعيل قراءة الجسم بصيغة JSON
app.use(express.json());

// 5. خدمة الملفات الثابتة (مثل الصور)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// خدمة المجلدات الفرعية بشكل صريح
app.use('/uploads/ticket_attachments', express.static(path.join(__dirname, 'uploads/ticket_attachments')));
app.use('/uploads/chat_images', express.static(path.join(__dirname, 'uploads/chat_images')));
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));
app.use('/uploads/news_media', express.static(path.join(__dirname, 'uploads/news_media')));

// 6. تطبيق Rate Limiter العام
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // حد معقول للاستخدام العادي
    handler: (req, res, next, options) => {
        const retryAfter = Math.ceil(options.windowMs / 1000);
        res.status(options.statusCode).json({
            errorMessage: {
                key: "apiErrors.tooManyRequests",
                fallback: "Too many requests, please try again after 15 minutes.",
                params: { retryAfter: retryAfter }
            },
            rateLimit: {
                limit: options.max,
                remaining: 0,
                resetTime: new Date(Date.now() + options.windowMs)
            }
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(apiLimiter);
// --- [!!!] END: الترتيب الصحيح [!!!]

// التأكد من وجود مجلدات الرفع
const chatImageUploadPath = path.join(__dirname, 'uploads/chat_images/');
if (!fs.existsSync(chatImageUploadPath)) {
    fs.mkdirSync(chatImageUploadPath, { recursive: true });
}

// إضافة إعدادات نظام الإحالات
const initSystemSettings = async () => {
    try {
        const referralConfig = await SystemSetting.findOne({ key: 'referral_config' });
        if (!referralConfig) {
            await SystemSetting.create({
                key: 'referral_config',
                value: {
                    commissionRate: 1, // 1%
                    minTransferAmount: 30, // 30 دينار
                    transferFee: 2 // 2%
                },
                description: 'إعدادات نظام الإحالات: النسبة، الحد الأدنى، ورسوم التحويل'
            });
            console.log('Initialized default referral settings.');
        }
    } catch (error) {
        console.error('Error initializing settings:', error);
    }
};

// إضافة io و onlineUsers إلى كل طلب API
app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

// الاتصال بقاعدة البيانات
connectDB().then(() => {
    console.log("Checking/Initializing System Settings...");
    initSystemSettings();
});

// --- Routers ---
app.use("/user", user);
app.use('/product', product);
app.use('/cart', cart);
app.use('/notifications', notificationRouter);
app.use('/wallet', wallet);
app.use('/ratings', ratingRoute);
app.use('/payment-methods', paymentMethodRoute);
app.use('/deposits', depositRoute);
app.use('/uploads', uploadRoute);
app.use('/withdrawals', withdrawalRoute);
app.use('/mediation', mediationRoute);
app.use('/reports', reportRoute);
app.use('/support', ticketRoute);
app.use('/faq', faqRoute);
app.use('/news', newsRouter);
app.use('/achievements', achievementRouter);
app.use('/leaderboards', leaderboardRouter);
app.use('/referral', referralRouter);
app.use('/quests', questRouter);
app.use('/chat', globalChatRouter);
app.use('/tournaments', tournamentRouter);
app.use('/matches', matchRouter);
app.use('/leagues', leaguesRouter);

app.get('/', (req, res) => res.json({ message: 'Welcome to Yalla bi3!' }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("!!! UNHANDLED EXPRESS ERROR !!!:", err.stack || err);
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' && !err.isOperational ? 'An unexpected error occurred.' : err.message;
    if (!res.headersSent) {
        res.status(statusCode).json({ status: 'error', message: message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) });
    }
});

// [!!!] للاختبار اليدوي فقط: قم بإلغاء التعليق عن هذا السطر [!!!]
// updateLeaderboardSnapshots(io);

server.listen(PORT, () => console.log(`🚀 Server with Socket.IO listening on port ${PORT}`));

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => { console.log('HTTP server closed') });
});