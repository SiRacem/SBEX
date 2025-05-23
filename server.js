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

            io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
            console.log("[Socket Event - addUser] Emitted onlineUsersListUpdated. Current online users count:", Object.keys(onlineUsers).length);
        } else {
            console.warn(`[Socket Event - addUser] Invalid or missing userId for socket ${socket.id}: ${userId}`);
        }
    });

    socket.on('joinMediationChat', async ({ mediationRequestId, userId, userRole }) => {
        const userIdToJoin = socket.userIdForChat || userId;

        console.log(`[Socket Event - joinMediationChat] SocketID: ${socket.id}, MediationID: ${mediationRequestId}, UserID: ${userIdToJoin}`);

        if (!userIdToJoin || !mediationRequestId || !mongoose.Types.ObjectId.isValid(userIdToJoin) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            return socket.emit('mediationChatError', {
                message: "Missing or invalid user/mediation ID for chat join."
            });
        }

        // تأكيد هوية المستخدم في السوكت
        socket.userIdForChat = userIdToJoin.toString();

        if (!socket.userFullNameForChat) {
            try {
                const userDoc = await User.findById(userIdToJoin).select('fullName avatarUrl').lean();
                socket.userFullNameForChat = userDoc?.fullName || 'User';
                socket.userAvatarUrlForChat = userDoc?.avatarUrl || null;
            } catch (e) {
                socket.userFullNameForChat = 'User';
                socket.userAvatarUrlForChat = null;
            }
        }

        try {
            const request = await MediationRequest.findById(mediationRequestId)
                .select('seller buyer mediator status disputeOverseers')
                .lean();

            if (!request) {
                return socket.emit('mediationChatError', { message: "Mediation request not found." });
            }

            const isSeller = request.seller?.toString() === userIdToJoin;
            const isBuyer = request.buyer?.toString() === userIdToJoin;
            const isMediator = request.mediator?.toString() === userIdToJoin;
            const isAdmin = userRole === 'Admin'; // userRole يأتي من العميل
            const isOverseer = Array.isArray(request.disputeOverseers) &&
                request.disputeOverseers.some(id => id.toString() === userIdToJoin);

            if (!(isSeller || isBuyer || isMediator || isOverseer || (isAdmin && request.status === 'Disputed'))) {
                return socket.emit('mediationChatError', { message: "Unauthorized to join this mediation chat." });
            }

            // ✅ محاولة آمنة لإضافة الـ Admin إلى overseers في حالة Disputed
            if (isAdmin && request.status === 'Disputed' && !isOverseer) {
                try {
                    await MediationRequest.updateOne(
                        { _id: mediationRequestId },
                        { $addToSet: { disputeOverseers: userIdToJoin } },
                        { maxTimeMS: 500 }
                    );
                    console.log(`Admin ${userIdToJoin} added to disputeOverseers (non-blocking).`);
                } catch (conflictErr) {
                    console.warn(`[joinMediationChat] ⚠️ Write conflict ignored: ${conflictErr.message}`);
                }
            }

            const allowedStatusesToJoin = ['InProgress', 'PartiesConfirmed', 'MediationOfferAccepted', 'EscrowFunded', 'Disputed'];
            if (!allowedStatusesToJoin.includes(request.status)) {
                return socket.emit('mediationChatError', {
                    message: `Chat unavailable for this mediation status (${request.status}).`
                });
            }

            // ✅ انضمام الغرفة
            socket.join(mediationRequestId.toString());
            socket.emit('joinedMediationChatSuccess', {
                mediationRequestId,
                message: `Successfully joined mediation chat.`
            });

            console.log(`[joinMediationChat] Socket ${socket.id} joined room ${mediationRequestId}`);

        } catch (error) {
            console.error("[joinMediationChat] Error:", error.message);
            socket.emit('mediationChatError', {
                message: "An unexpected error occurred while joining chat."
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