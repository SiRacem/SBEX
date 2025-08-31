// server.js
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

// --- Configuration Reading ---
const PORT = config.get('PORT') || 8000;
let FRONTEND_URL = "http://localhost:3000";
if (config.has('FRONTEND_URL')) {
    FRONTEND_URL = config.get('FRONTEND_URL');
    console.log(`[Server Config] Using FRONTEND_URL from config: ${FRONTEND_URL}`);
} else {
    console.warn('[Server Config] WARNING: FRONTEND_URL is not defined in config files. Using default "http://localhost:3000".');
}
const JWT_SECRET = config.get('secret');
if (JWT_SECRET) console.log("[Server Config] JWT Secret loaded successfully.");
else console.error("[Server Config] CRITICAL: JWT_SECRET is not defined in config!");

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

// --- Model Imports ---
const Notification = require('./models/Notification');
const MediationRequest = require('./models/MediationRequest');
const User = require('./models/User');

const connectDB = require('./config/connectDB');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST", "PUT"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

let onlineUsers = {}; // { userId: socketId }

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log(`⚡: Socket ${socket.id} user connected`);

    socket.on('addUser', async (userId) => {
        console.log(`[Socket Event - addUser] Received for userId: ${userId} from socket: ${socket.id}`);
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const userIdStr = userId.toString();
            onlineUsers[userIdStr] = socket.id;
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
                    const productTitle = request.product?.title || 'this dispute';
                    const systemMessageContent = `🛡️ **${adminName} has joined the chat to review test one.** Please provide all necessary information.`;
                    const systemMessage = {
                        _id: new mongoose.Types.ObjectId(),
                        message: systemMessageContent,
                        type: 'system',
                        timestamp: new Date()
                    };

                    await MediationRequest.updateOne({ _id: mediationRequestId }, { $push: { chatMessages: systemMessage } });
                    io.to(mediationRequestId.toString()).emit('newMediationMessage', systemMessage);
                    console.log(`[joinMediationChat] Admin join system message sent and saved successfully.`);
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
                request.seller,
                request.buyer,
                request.mediator,
                ...(request.disputeOverseers || [])
            ]
                .map(id => id?.toString())
                .filter(id => id && id !== senderId);
            const uniqueRecipientIds = [...new Set(recipientIds)];
            const productTitle = request.product?.title || 'the mediation';
            const senderName = socket.userFullNameForChat || 'A user';
            const notificationTitle = `New Message: ${productTitle}`;
            const notificationMessage = `You have a new message from ${senderName}.`;
            const notificationsToCreate = uniqueRecipientIds.map(userId => ({
                user: userId,
                type: 'NEW_CHAT_MESSAGE',
                title: notificationTitle,
                message: notificationMessage,
                relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
            }));
            if (notificationsToCreate.length > 0) {
                const createdNotifications = await Notification.insertMany(notificationsToCreate);
                createdNotifications.forEach(notif => {
                    const recipientSocketId = onlineUsers[notif.user.toString()];
                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('new_notification', notif);
                        console.log(`[Notification] Sent 'new_notification' for main chat to user ${notif.user.toString()}`);
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
            const notificationTitle = `New Message in: ${subChatTitleForNotif}`;
            const notificationMessage = `From ${senderName} regarding the dispute for "${productTitle}".`;
            const notificationsToCreate = uniqueRecipientIds.map(userId => ({
                user: userId,
                type: 'NEW_ADMIN_SUBCHAT_MESSAGE',
                title: notificationTitle,
                message: notificationMessage,
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

    socket.on('disconnect', (reason) => {
        if (socket.userIdForChat) {
            const userIdStr = socket.userIdForChat.toString();
            if (onlineUsers[userIdStr] === socket.id) {
                delete onlineUsers[userIdStr];
                io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
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

// [!!!] START: الترتيب الصحيح والنهائي للـ MIDDLEWARE [!!!]

// 1. تطبيق ترويسات الأمان الأساسية
app.use(helmet());

// 2. تفعيل سياسة CORS للسماح للواجهة الأمامية بالوصول
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// 3. تفعيل قراءة الجسم بصيغة JSON للطلبات القادمة
app.use(express.json());

// 4. خدمة الملفات الثابتة (مثل الصور). الطلبات إلى /uploads سيتم معالجتها هنا ولن تصل إلى Rate Limiter
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. الآن، قم بتطبيق Rate Limiter على كل ما تبقى (وهي مسارات الـ API فقط)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // حد معقول للاستخدام العادي
    handler: (req, res, next, options) => {
        const retryAfter = Math.ceil(options.windowMs / 1000);
        res.status(options.statusCode).json({
            // أرسل كائن خطأ متكامل لكي تتعرف عليه الواجهة الأمامية
            errorMessage: {
                key: "apiErrors.tooManyRequests",
                fallback: "Too many requests, please try again after 15 minutes.",
                params: {
                    retryAfter: retryAfter
                }
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

// --- [!!!] END: الترتيب الصحيح والنهائي للـ MIDDLEWARE [!!!]

// التأكد من وجود مجلدات الرفع
const chatImageUploadPath = path.join(__dirname, 'uploads/chat_images/');
if (!fs.existsSync(chatImageUploadPath)) {
    fs.mkdirSync(chatImageUploadPath, { recursive: true });
}

// إضافة io و onlineUsers إلى كل طلب API
app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

// الاتصال بقاعدة البيانات
connectDB();

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

server.listen(PORT, () => console.log(`🚀 Server with Socket.IO listening on port ${PORT}`));

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => { console.log('HTTP server closed') });
});