// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const config = require('config');
const mongoose = require('mongoose');
const fs = require('fs');

// --- Configuration Reading ---
const PORT = config.get('PORT') || 8000;
let FRONTEND_URL = "http://localhost:3000"; // Default
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

// --- Model Imports ---
const MediationRequest = require('./models/MediationRequest');
const User = require('./models/User');
const Notification = require('./models/Notification');

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

io.on('connection', (socket) => {
    console.log(`⚡: Socket ${socket.id} user connected`);

    socket.on('addUser', async (userId) => {
        console.log(`[Socket Event - addUser] Received for userId: ${userId} from socket: ${socket.id}`);
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const userIdStr = userId.toString();
            onlineUsers[userIdStr] = socket.id;
            socket.userIdForChat = userIdStr; // Store it on the socket instance
            try {
                const userDoc = await User.findById(userIdStr).select('fullName avatarUrl').lean();
                if (userDoc) {
                    socket.userFullNameForChat = userDoc.fullName;
                    socket.userAvatarUrlForChat = userDoc.avatarUrl;
                    console.log(`[Socket Event - addUser] User ${userIdStr} (${socket.userFullNameForChat}) mapped. Avatar: ${socket.userAvatarUrlForChat}`);
                } else {
                    console.warn(`[Socket Event - addUser] User document not found for ID: ${userIdStr}`);
                    socket.userFullNameForChat = 'User (Unknown)'; // Default value
                    socket.userAvatarUrlForChat = null;
                }
            } catch (error) {
                console.error(`[Socket Event - addUser] Error fetching user details for ${userIdStr}:`, error);
                socket.userFullNameForChat = 'User (Error)';
                socket.userAvatarUrlForChat = null;
            }
            io.emit("getOnlineUsers", Object.keys(onlineUsers));
            console.log("[Socket Event - addUser] Current onlineUsers:", onlineUsers);
        } else {
            console.warn(`[Socket Event - addUser] Invalid or missing userId for socket ${socket.id}: ${userId}`);
        }
    });

    socket.on('joinMediationChat', async ({ mediationRequestId, userId, userRole }) => {
        // ... (كود joinMediationChat كما هو، تأكد أنه يعمل بشكل صحيح)
        // (يفترض أنه لا يحتاج لتعديلات بناءً على المشكلة الحالية)
        const userIdToJoin = socket.userIdForChat || userId;
        console.log(`[Socket Event - joinMediationChat] Received. SocketID: ${socket.id}, MediationID: ${mediationRequestId}, UserID: ${userIdToJoin}, Role: ${userRole}`);
        if (!userIdToJoin || !mediationRequestId || !mongoose.Types.ObjectId.isValid(userIdToJoin) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            console.warn(`[Socket Event - joinMediationChat] VALIDATION FAILED: Missing or invalid IDs. UserID: ${userIdToJoin}, MediationID: ${mediationRequestId}`);
            return socket.emit('mediationChatError', { message: "Required user or mediation ID missing/invalid to join chat." });
        }
        if (!socket.userIdForChat) socket.userIdForChat = userIdToJoin.toString();
        if (!socket.userFullNameForChat && userIdToJoin) { // Ensure userIdToJoin is valid before fetching
            try {
                const userDoc = await User.findById(userIdToJoin).select('fullName avatarUrl').lean();
                if (userDoc) {
                    socket.userFullNameForChat = userDoc.fullName;
                    socket.userAvatarUrlForChat = userDoc.avatarUrl;
                } else { socket.userFullNameForChat = 'User'; socket.userAvatarUrlForChat = null; }
            } catch (e) { console.error("Error fetching user details for joinMediationChat:", e); socket.userFullNameForChat = 'User'; socket.userAvatarUrlForChat = null; }
        }
        try {
            const request = await MediationRequest.findById(mediationRequestId).select('seller buyer mediator status');
            if (!request) return socket.emit('mediationChatError', { message: "Mediation request not found for chat." });
            const isSeller = request.seller.equals(userIdToJoin);
            const isBuyer = request.buyer.equals(userIdToJoin);
            const isMediator = request.mediator && request.mediator.equals(userIdToJoin);
            const userDocForRole = await User.findById(userIdToJoin).select('userRole').lean();
            const isAdmin = userDocForRole?.userRole === 'Admin';
            if (!(isSeller || isBuyer || isMediator || isAdmin)) {
                console.warn(`[Socket Event - joinMediationChat] User ${userIdToJoin} not authorized for mediation ${mediationRequestId}.`);
                return socket.emit('mediationChatError', { message: "You are not authorized to join this chat." });
            }
            if (!['InProgress', 'PartiesConfirmed', 'MediationOfferAccepted', 'EscrowFunded'].includes(request.status)) {
                console.warn(`[Socket Event - joinMediationChat] Chat not active for mediation ${mediationRequestId}. Status: ${request.status}`);
                return socket.emit('mediationChatError', { message: `Chat is not active for this mediation (Status: ${request.status}).` });
            }
            socket.join(mediationRequestId.toString());
            console.log(`[Socket Event - joinMediationChat] User ${userIdToJoin} (${socket.userFullNameForChat || 'N/A'}) joined room: ${mediationRequestId}`);
            socket.emit('joinedMediationChatSuccess', { mediationRequestId, message: `Successfully joined chat for mediation: ${mediationRequestId}` });
        } catch (error) {
            console.error(`[Socket Event - joinMediationChat] Error for mediation ${mediationRequestId}, user ${userIdToJoin}:`, error);
            socket.emit('mediationChatError', { message: "Server error while trying to join the chat." });
        }
    });

    socket.on('sendMediationMessage', async ({ mediationRequestId, messageText }) => {
        const senderId = socket.userIdForChat; // من المفترض أن هذا مُعيّن عند addUser
        const senderFullName = socket.userFullNameForChat || 'A User'; // من المفترض أن هذا مُعيّن عند addUser

        if (!senderId || !mediationRequestId || !messageText || messageText.trim() === "") {
            console.warn("[Socket Event - sendMediationMessage] Missing data:", { senderId, mediationRequestId, messageTextIsEmpty: !messageText || messageText.trim() === "" });
            return socket.emit('mediationChatError', { message: "Cannot send message: missing data or empty message." });
        }

        console.log(`[Socket Event - sendMediationMessage] From ${senderFullName} (${senderId}) for room ${mediationRequestId}: "${messageText}"`);

        let session; // تعريف session خارج الـ try للسماح بالوصول إليها في finally
        try {
            session = await mongoose.startSession();
            session.startTransaction();

            const mediationRequest = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title _id')
                .populate('seller', '_id fullName avatarUrl') // Populating avatarUrl for otherPartyForRecipient
                .populate('buyer', '_id fullName avatarUrl')
                .populate('mediator', '_id fullName avatarUrl')
                .session(session);

            if (!mediationRequest) {
                throw new Error("Mediation request not found for sending message.");
            }
            // (يمكنك إضافة التحقق من الحالة isParty هنا كما كان)

            const newMessageDoc = {
                sender: senderId,
                message: messageText.trim(),
                type: 'text',
                timestamp: new Date(),
                readBy: []
            };
            mediationRequest.chatMessages.push(newMessageDoc);
            await mediationRequest.save({ session });
            await session.commitTransaction(); // Commit transaction for saving the message

            // --- جلب تفاصيل المرسل للبث ---
            // لا نحتاج لـ session هنا لأن الـ transaction السابق انتهى
            const senderDetailsForBroadcast = await User.findById(senderId).select('fullName avatarUrl _id').lean();
            if (!senderDetailsForBroadcast) {
                console.warn(`[sendMediationMessage] Could not find sender details for ID: ${senderId} after saving message.`);
                // يمكنك التعامل مع هذا، ربما بإرسال اسم افتراضي
            }

            const savedMessageFromDb = mediationRequest.chatMessages[mediationRequest.chatMessages.length - 1].toObject();
            const messageToBroadcast = { ...savedMessageFromDb, sender: senderDetailsForBroadcast || { fullName: senderFullName, _id: senderId } };

            io.to(mediationRequestId.toString()).emit('newMediationMessage', messageToBroadcast);
            console.log(`   [sendMediationMessage] Text message broadcasted to room ${mediationRequestId}`);

            // --- إرسال تحديث للرسائل غير المقروءة وإشعارات ---
            const senderIdString = senderId.toString();
            const recipientsForSummaryAndUpdate = [];
            if (mediationRequest.seller?._id && mediationRequest.seller._id.toString() !== senderIdString) {
                recipientsForSummaryAndUpdate.push(mediationRequest.seller._id.toString());
            }
            if (mediationRequest.buyer?._id && mediationRequest.buyer._id.toString() !== senderIdString) {
                recipientsForSummaryAndUpdate.push(mediationRequest.buyer._id.toString());
            }
            if (mediationRequest.mediator?._id && mediationRequest.mediator._id.toString() !== senderIdString) {
                recipientsForSummaryAndUpdate.push(mediationRequest.mediator._id.toString());
            }
            const uniqueRecipients = [...new Set(recipientsForSummaryAndUpdate)];

            console.log("   [sendMediationMessage] Online users for unread summary:", onlineUsers);
            console.log("   [sendMediationMessage] Unique recipients for unread/notification:", uniqueRecipients);

            // لا حاجة لـ session جديد هنا، العمليات التالية هي قراءة وإرسال socket events أو إنشاء إشعارات (التي لا تحتاج transaction هنا)
            const freshMediationRequestForCounts = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title _id') // نحتاج product.title للـ payload
                .lean(); // جلب بدون session للقراءة فقط

            if (freshMediationRequestForCounts) {
                uniqueRecipients.forEach(async (recipientId) => {
                    let unreadCountForRecipient = 0;
                    freshMediationRequestForCounts.chatMessages.forEach(msg => {
                        if (msg.sender && !msg.sender.equals(recipientId) &&
                            (!msg.readBy || !msg.readBy.some(rb => rb.readerId && rb.readerId.equals(recipientId)))) {
                            unreadCountForRecipient++;
                        }
                    });

                    const recipientSocketId = onlineUsers[recipientId];
                    if (recipientSocketId) {
                        const payloadForUnreadSummary = {
                            mediationId: mediationRequestId.toString(),
                            newUnreadCount: unreadCountForRecipient,
                            lastMessageTimestamp: messageToBroadcast.timestamp,
                            productTitle: freshMediationRequestForCounts.product?.title || 'Mediation Chat',
                            otherPartyForRecipient: senderDetailsForBroadcast ? { // معلومات مرسل الرسالة
                                _id: senderDetailsForBroadcast._id.toString(),
                                fullName: senderDetailsForBroadcast.fullName,
                                avatarUrl: senderDetailsForBroadcast.avatarUrl
                            } : { fullName: senderFullName, _id: senderIdString }, // Fallback
                        };
                        console.log(`   [sendMediationMessage] Emitting 'update_unread_summary' to user ${recipientId} (socket ${recipientSocketId}) with payload:`, payloadForUnreadSummary);
                        io.to(recipientSocketId).emit('update_unread_summary', payloadForUnreadSummary);
                    } else {
                        console.log(`   [sendMediationMessage] User ${recipientId} is not online for 'update_unread_summary'.`);
                    }

                    // إرسال إشعار NEW_CHAT_MESSAGE
                    try {
                        const newNotification = await Notification.create({ // لا يحتاج session هنا
                            user: recipientId,
                            type: 'NEW_CHAT_MESSAGE', // تأكد من أن هذا النوع موجود في موديل Notification
                            title: `New message in: ${freshMediationRequestForCounts.product?.title || 'Mediation Chat'}`,
                            message: `${senderFullName}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
                            relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
                        });
                        if (recipientSocketId) { // أرسل إشعارًا إذا كان المستخدم متصلاً
                            console.log(`   [sendMediationMessage] Emitting 'new_notification' to user ${recipientId}`);
                            io.to(recipientSocketId).emit('new_notification', newNotification.toObject());
                        }
                    } catch (notifError) {
                        console.error(`   [sendMediationMessage] Error creating NEW_CHAT_MESSAGE notification for ${recipientId}:`, notifError);
                    }
                });
            } else {
                console.warn(`   [sendMediationMessage] Could not fetch freshMediationRequestForCounts for ID: ${mediationRequestId}`);
            }

        } catch (error) {
            if (session && session.inTransaction()) { // تحقق أن session معرف قبل استدعاء inTransaction
                await session.abortTransaction();
            }
            console.error(`[Socket Event - sendMediationMessage] Error for request ${mediationRequestId}:`, error.message, error.stack);
            socket.emit('mediationChatError', { message: error.message || "Server error sending message." });
        } finally {
            if (session && typeof session.endSession === 'function') {
                await session.endSession();
                console.log(`   [sendMediationMessage] Session ended for request ${mediationRequestId}`);
            }
        }
    });

    socket.on('mark_messages_read', async ({ mediationRequestId, messageIds, readerUserId }) => {
        // ... (كود mark_messages_read كما هو، يفترض أنه يعمل بشكل صحيح ولا يسبب MongoExpiredSessionError هنا)
        // (تأكد من أن أي عمليات await داخل الـ transaction الخاص به لا تستغرق وقتًا طويلاً)
        const currentReaderUserId = socket.userIdForChat || readerUserId;
        // ... (باقي الكود كما قدمته سابقًا، مع التأكد من أن أي await داخل الـ try/catch يستخدم الـ session بشكل صحيح إذا كان ضمن transaction)
        // إذا كان mark_messages_read يستخدم transaction خاص به، تأكد من إغلاقه بـ endSession() في finally
        let markSession;
        try {
            markSession = await mongoose.startSession();
            markSession.startTransaction();

            const mediationRequest = await MediationRequest.findById(mediationRequestId).session(markSession);
            if (!mediationRequest) throw new Error(`Mediation request ${mediationRequestId} not found.`);
            // ... (بقية منطق mark_messages_read مع استخدام markSession) ...
            const isParty = (mediationRequest.seller.equals(currentReaderUserId) || mediationRequest.buyer.equals(currentReaderUserId) || (mediationRequest.mediator && mediationRequest.mediator.equals(currentReaderUserId)));
            if (!isParty) throw new Error(`User ${currentReaderUserId} not party to mediation ${mediationRequestId}.`);
            let updatedMessagesForBroadcast = [];
            let actuallyUpdatedCount = 0;
            const idsToUpdate = Array.isArray(messageIds) ? messageIds : [messageIds];

            for (const messageId of idsToUpdate) {
                const message = mediationRequest.chatMessages.id(messageId);
                if (message) {
                    if (message.sender && message.sender.equals(currentReaderUserId)) continue;
                    const alreadyRead = message.readBy.some(entry => entry.readerId.equals(currentReaderUserId));
                    if (!alreadyRead) {
                        message.readBy.push({ readerId: new mongoose.Types.ObjectId(currentReaderUserId), readAt: new Date() });
                        actuallyUpdatedCount++;
                        const populatedReadBy = [];
                        for (const entry of message.readBy) {
                            const userDoc = await User.findById(entry.readerId).select('fullName avatarUrl _id').lean(); // No session needed for this read
                            if (userDoc) populatedReadBy.push({ readerId: userDoc._id.toString(), readAt: entry.readAt, avatarUrl: userDoc.avatarUrl, fullName: userDoc.fullName });
                        }
                        updatedMessagesForBroadcast.push({ _id: message._id.toString(), readBy: populatedReadBy });
                    } else if (!updatedMessagesForBroadcast.some(um => um._id === message._id.toString())) { // Ensure we send the full readBy if others might have read it
                        const populatedReadBy = [];
                        for (const entry of message.readBy) {
                            const userDoc = await User.findById(entry.readerId).select('fullName avatarUrl _id').lean();
                            if (userDoc) populatedReadBy.push({ readerId: userDoc._id.toString(), readAt: entry.readAt, avatarUrl: userDoc.avatarUrl, fullName: userDoc.fullName });
                        }
                        updatedMessagesForBroadcast.push({ _id: message._id.toString(), readBy: populatedReadBy });
                    }
                }
            }
            if (actuallyUpdatedCount > 0) await mediationRequest.save({ session: markSession });
            await markSession.commitTransaction();
            if (updatedMessagesForBroadcast.length > 0) {
                io.to(mediationRequestId.toString()).emit('messages_status_updated', { mediationRequestId, updatedMessages: updatedMessagesForBroadcast });
                console.log(`   [mark_messages_read] Event 'messages_status_updated' broadcasted for ${mediationRequestId}`);
            }
        } catch (error) {
            if (markSession && markSession.inTransaction()) await markSession.abortTransaction();
            console.error(`[Socket Event - mark_messages_read] Error for ${mediationRequestId}:`, error.message);
            socket.emit('mediationChatError', { message: error.message || "Server error marking messages read." });
        } finally {
            if (markSession && typeof markSession.endSession === 'function') await markSession.endSession();
        }
    });

    socket.on('start_typing', ({ mediationRequestId }) => {
        // ... (كما هو)
        if (socket.userIdForChat && socket.userFullNameForChat && mediationRequestId) {
            socket.to(mediationRequestId.toString()).emit('user_typing', { userId: socket.userIdForChat, fullName: socket.userFullNameForChat, avatarUrl: socket.userAvatarUrlForChat });
        }
    });
    socket.on('stop_typing', ({ mediationRequestId }) => {
        // ... (كما هو)
        if (socket.userIdForChat && mediationRequestId) {
            socket.to(mediationRequestId.toString()).emit('user_stopped_typing', { userId: socket.userIdForChat });
        }
    });

    socket.on('leaveMediationChat', ({ mediationRequestId }) => {
        // ... (كما هو)
        if (socket.userIdForChat && mediationRequestId) {
            socket.leave(mediationRequestId.toString());
            console.log(`Socket: User ${socket.userIdForChat} left room ${mediationRequestId}`);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔥: Socket ${socket.id} (User: ${socket.userIdForChat || 'Unknown'}) disconnected. Reason: ${reason}`);
        if (socket.userIdForChat) {
            const userIdStr = socket.userIdForChat.toString();
            if (onlineUsers[userIdStr] === socket.id) { // Only delete if this was the stored socket
                delete onlineUsers[userIdStr];
                console.log(`User ${userIdStr} removed from online list.`);
            }
            io.emit("getOnlineUsers", Object.keys(onlineUsers)); // Notify all clients about the updated online users
            console.log("[Socket Event - disconnect] Current onlineUsers:", onlineUsers);
        }
    });
});

// --- Express Middlewares & Setup ---
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`[Express Setup] Serving static files from: ${path.join(__dirname, 'uploads')} at /uploads`);
const chatImageUploadPath = path.join(__dirname, 'uploads/chat_images/');
if (!fs.existsSync(chatImageUploadPath)) {
    fs.mkdirSync(chatImageUploadPath, { recursive: true });
    console.log(`[Express Setup] Created directory: ${chatImageUploadPath}`);
}

// Middleware to pass io and onlineUsers to route handlers
app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

connectDB();

// --- API Routes ---
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

app.get('/', (req, res) => res.json({ message: 'Welcome to SBEX API!' }));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("!!! UNHANDLED EXPRESS ERROR !!!:", err.stack || err);
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message;
    if (!res.headersSent) {
        res.status(statusCode).json({ status: 'error', message: message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) });
    }
});

server.listen(PORT, () => console.log(`🚀 Server with Socket.IO listening on port ${PORT}`));

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => { console.log('HTTP server closed') });
});