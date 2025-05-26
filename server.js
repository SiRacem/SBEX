// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const config = require('config');
const mongoose = require('mongoose');
const fs = require('fs');
const cron = require('node-cron'); // <<< استيراد node-cron
const { releaseDuePendingFunds } = require('./services/pendingFundsReleaseService'); // <<< استيراد دالة الخدمة

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

            io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
            console.log("[Socket Event - addUser] Emitted onlineUsersListUpdated. Current online users count:", Object.keys(onlineUsers).length);
        } else {
            console.warn(`[Socket Event - addUser] Invalid or missing userId for socket ${socket.id}: ${userId}`);
        }
    });

    socket.on('joinMediationChat', async ({ mediationRequestId, userId, userRole }) => {
        const userIdToJoin = socket.userIdForChat || userId; // استخدم userId من الـ socket إذا كان متاحًا

        console.log(`[Socket Event - joinMediationChat] Attempting join. SocketID: ${socket.id}, MediationID: ${mediationRequestId}, UserID: ${userIdToJoin}, UserRole: ${userRole}`);

        if (!userIdToJoin || !mediationRequestId || !mongoose.Types.ObjectId.isValid(userIdToJoin) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            console.warn(`[joinMediationChat] Invalid IDs. UserID: ${userIdToJoin}, MediationID: ${mediationRequestId}`);
            return socket.emit('mediationChatError', {
                message: "Missing or invalid user/mediation ID for chat join."
            });
        }

        // تأكيد أو جلب بيانات المستخدم (الاسم والصورة الرمزية) إذا لم تكن موجودة على الـ socket
        if (!socket.userFullNameForChat || !socket.userAvatarUrlForChat || socket.userIdForChat !== userIdToJoin.toString()) {
            try {
                const userDoc = await User.findById(userIdToJoin).select('fullName avatarUrl').lean();
                if (userDoc) {
                    socket.userIdForChat = userIdToJoin.toString(); // تأكد من تحديثه هنا أيضًا
                    socket.userFullNameForChat = userDoc.fullName;
                    socket.userAvatarUrlForChat = userDoc.avatarUrl;
                    console.log(`[joinMediationChat] Fetched/Updated user details on socket: ${socket.userFullNameForChat}`);
                } else {
                    console.warn(`[joinMediationChat] User document not found for ID: ${userIdToJoin} during socket user detail fetch.`);
                    socket.userFullNameForChat = userRole === 'Admin' ? 'Admin' : 'User (Unknown)';
                    socket.userAvatarUrlForChat = null;
                }
            } catch (e) {
                console.error(`[joinMediationChat] Error fetching user details for socket:`, e);
                socket.userFullNameForChat = userRole === 'Admin' ? 'Admin' : 'User (Error)';
                socket.userAvatarUrlForChat = null;
            }
        }

        try {
            const request = await MediationRequest.findById(mediationRequestId)
                .select('seller buyer mediator status disputeOverseers adminJoinMessageSent product') // جلب product أيضًا لاسم المنتج في رسالة النظام
                .populate('product', 'title') // لجلب عنوان المنتج فقط
                .lean();

            if (!request) {
                console.warn(`[joinMediationChat] Mediation request ${mediationRequestId} not found.`);
                return socket.emit('mediationChatError', { message: "Mediation request not found." });
            }

            const isSeller = request.seller?.toString() === userIdToJoin;
            const isBuyer = request.buyer?.toString() === userIdToJoin;
            const isMediator = request.mediator?.toString() === userIdToJoin;
            const isAdmin = userRole === 'Admin';
            const isDesignatedOverseer = Array.isArray(request.disputeOverseers) &&
                request.disputeOverseers.some(id => id.toString() === userIdToJoin);

            let canAccess = isSeller || isBuyer || isMediator || isDesignatedOverseer;
            if (isAdmin && request.status === 'Disputed') {
                canAccess = true;
            }

            if (!canAccess) {
                console.warn(`[joinMediationChat] User ${userIdToJoin} (Role: ${userRole}) is UNAUTHORIZED for mediation ${mediationRequestId}. Status: ${request.status}`);
                return socket.emit('mediationChatError', { message: "Unauthorized to join this mediation chat." });
            }

            // إضافة الأدمن إلى disputeOverseers إذا لم يكن موجودًا وكان النزاع قائمًا (محاولة آمنة)
            if (isAdmin && request.status === 'Disputed' && !isDesignatedOverseer) {
                try {
                    // لا ننتظر هذه العملية حتى لا تعيق الانضمام
                    MediationRequest.updateOne(
                        { _id: mediationRequestId },
                        { $addToSet: { disputeOverseers: userIdToJoin } }
                    ).exec(); // exec() يجعلها تعمل في الخلفية
                    console.log(`[joinMediationChat] Admin ${userIdToJoin} added to disputeOverseers for ${mediationRequestId} (async).`);
                } catch (updateError) {
                    // هذا الخطأ لا يجب أن يمنع الانضمام
                    console.warn(`[joinMediationChat] Non-critical error adding admin to overseers: ${updateError.message}`);
                }
            }

            const allowedStatusesToJoin = ['InProgress', 'PartiesConfirmed', 'MediationOfferAccepted', 'EscrowFunded', 'Disputed'];
            if (!allowedStatusesToJoin.includes(request.status)) {
                console.warn(`[joinMediationChat] Chat unavailable for mediation ${mediationRequestId} due to status: ${request.status}`);
                return socket.emit('mediationChatError', {
                    message: `Chat unavailable for this mediation status (${request.status}).`
                });
            }

            // الانضمام للغرفة
            socket.join(mediationRequestId.toString());
            socket.emit('joinedMediationChatSuccess', {
                mediationRequestId,
                message: `Successfully joined mediation chat: ${request.product?.title || mediationRequestId}.`
            });
            console.log(`[joinMediationChat] Socket ${socket.id} (User: ${userIdToJoin}, Role: ${userRole}) successfully joined room ${mediationRequestId}`);

            // إرسال رسالة نظام عند انضمام الأدمن (مرة واحدة فقط لكل نزاع)
            if (isAdmin && request.status === 'Disputed' && !request.adminJoinMessageSent) {
                const adminName = socket.userFullNameForChat || 'Admin'; // استخدم الاسم من الـ socket
                const productTitle = request.product?.title || 'this dispute';
                const systemMessageContent = `🛡️ **${adminName} has joined the chat to review ${productTitle}.** Please provide all necessary information.`;

                const systemMessageForBroadcast = {
                    _id: new mongoose.Types.ObjectId(), // ID فريد للرسالة
                    sender: null, // أو ID مستخدم "النظام" إذا كان لديك واحد
                    message: systemMessageContent,
                    type: 'system',
                    timestamp: new Date(),
                    readBy: []
                };

                // إرسال الرسالة لجميع من في الغرفة
                io.to(mediationRequestId.toString()).emit('newMediationMessage', systemMessageForBroadcast);

                // تحديث قاعدة البيانات لتعليم أن الرسالة قد أُرسلت وحفظها
                try {
                    await MediationRequest.findByIdAndUpdate(mediationRequestId, {
                        $set: { adminJoinMessageSent: true },
                        $push: {
                            chatMessages: {
                                sender: null, // تأكد أن السكيما تسمح بأن يكون sender فارغًا لرسائل النظام
                                message: systemMessageContent,
                                type: 'system',
                                timestamp: systemMessageForBroadcast.timestamp,
                                readBy: []
                                // _id: systemMessageForBroadcast._id // يمكنك حفظ الـ ID إذا أردت
                            }
                        }
                    }, { new: true }); // new: true لضمان أن التحديث قد تم (اختياري هنا)
                    console.log(`[joinMediationChat] Admin join system message sent and flag 'adminJoinMessageSent' set to true for ${mediationRequestId}.`);
                } catch (dbError) {
                    console.error(`[joinMediationChat] CRITICAL: Error setting adminJoinMessageSent flag or saving system message for ${mediationRequestId}:`, dbError);
                    // في حالة فشل هذا التحديث، قد يتم إرسال الرسالة مرة أخرى في محاولة الانضمام التالية.
                    // هذا قد يتطلب معالجة أكثر تعقيدًا إذا كان الفشل متكررًا.
                }
            } else if (isAdmin && request.status === 'Disputed' && request.adminJoinMessageSent) {
                console.log(`[joinMediationChat] Admin join system message was already sent for ${mediationRequestId}. Skipping.`);
            }

        } catch (error) {
            console.error(`[joinMediationChat] General error for mediation ${mediationRequestId}:`, error.message, error.stack);
            socket.emit('mediationChatError', {
                message: "An unexpected error occurred while trying to join the chat."
            });
        }
    });

    socket.on('sendMediationMessage', async ({ mediationRequestId, messageText, imageUrl }) => {
        const senderId = socket.userIdForChat;
        const senderFullName = socket.userFullNameForChat || 'User';

        if (!senderId || !mediationRequestId || (!messageText && !imageUrl)) {
            return socket.emit('mediationChatError', {
                message: "Cannot send empty message."
            });
        }

        try {
            const newMessageDoc = {
                sender: new mongoose.Types.ObjectId(senderId),
                message: (imageUrl && !messageText) ? null : messageText?.trim(),
                imageUrl: imageUrl || null,
                type: imageUrl ? 'image' : 'text',
                timestamp: new Date(),
                readBy: []
            };

            if (newMessageDoc.type === 'text' && (!newMessageDoc.message || newMessageDoc.message.trim() === "")) {
                console.error("Attempted to send an empty text message.");
                return;
            }

            const updated = await MediationRequest.findByIdAndUpdate(
                mediationRequestId,
                { $push: { chatMessages: newMessageDoc } },
                { new: true }
            )
                .populate('chatMessages.sender', 'fullName avatarUrl')
                .lean();

            const lastMessage = updated.chatMessages[updated.chatMessages.length - 1];

            io.to(mediationRequestId.toString()).emit('newMediationMessage', lastMessage);
        } catch (error) {
            console.error("❌ sendMediationMessage error:", error);
            socket.emit('mediationChatError', {
                message: "Error sending message."
            });
        }
    });

    socket.on("mark_messages_read", async ({ mediationRequestId, messageIds, readerUserId }) => {
        if (!mediationRequestId || !messageIds || !Array.isArray(messageIds) || !readerUserId) {
            return;
        }

        try {
            const objectIds = messageIds.map(id => new mongoose.Types.ObjectId(id));

            // استعلام لتحديث جميع الرسائل matching IDs في الـ array
            const updateResult = await MediationRequest.updateMany(
                {
                    _id: mediationRequestId,
                    'chatMessages._id': { $in: objectIds }
                },
                {
                    $addToSet: {
                        'chatMessages.$[elem].readBy': {
                            readerId: readerUserId,
                            timestamp: new Date()
                        }
                    }
                },
                {
                    arrayFilters: [{ 'elem._id': { $in: objectIds } }],
                    maxTimeMS: 500 // يمنع الاحتكاك
                }
            );

            console.log(`[mark_messages_read] Updated readBy for ${updateResult.modifiedCount} messages`);

            // اختيارياً: إرسال إشعار بأن الرسائل تمت قراءتها
            socket.to(mediationRequestId.toString()).emit("messages_status_updated", {
                mediationRequestId,
                updatedMessages: messageIds.map((id) => ({
                    _id: id,
                    readBy: [{ readerId: readerUserId, timestamp: new Date() }]
                }))
            });
        } catch (err) {
            console.warn("[mark_messages_read] ⚠️ Write conflict avoided:", err.message);
        }
    });

    socket.on("start_typing", ({ mediationRequestId }) => {
        if (mediationRequestId && socket.userIdForChat) {
            io.to(mediationRequestId.toString()).emit("user_typing", {
                userId: socket.userIdForChat,
                fullName: socket.userFullNameForChat,
                avatarUrl: socket.userAvatarUrlForChat
            });
        }
    });

    socket.on("stop_typing", ({ mediationRequestId }) => {
        if (mediationRequestId && socket.userIdForChat) {
            io.to(mediationRequestId.toString()).emit("user_stopped_typing", {
                userId: socket.userIdForChat
            });
        }
    });

    socket.on('leaveMediationChat', ({ mediationRequestId }) => {
        console.log(`[Socket - leaveMediationChat] User ${socket.userIdForChat} leaving mediation ${mediationRequestId}`);
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

            io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
            console.log("[Socket Event - disconnect] Emitted onlineUsersListUpdated. Current online users count:", Object.keys(onlineUsers).length);

        }
    });
});

// --- Scheduled Jobs ---
// مهمة لفك تجميد الأرصدة المعلقة، تعمل كل 10 دقائق كمثال
cron.schedule('*/10 * * * *', async () => {
    console.log(`[CRON MASTER] Triggering 'releaseDuePendingFunds' job at ${new Date().toISOString()}`);
    try {
        // <<<--- تمرير io و onlineUsers هنا ---<<<
        await releaseDuePendingFunds(io, onlineUsers);
        console.log('[CRON MASTER] Job "releaseDuePendingFunds" completed its run.');
    } catch (error) {
        console.error('[CRON MASTER] Critical error during scheduled "releaseDuePendingFunds" job:', error);
    }
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
    req.onlineUsers = onlineUsers; // <--- أنت تمرر onlineUsers هنا
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