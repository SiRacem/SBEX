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
// تأكد من أن هذا المسار صحيح لملف الخدمة المعدل
const { releaseDuePendingFunds } = require('./services/pendingFundsReleaseService');

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
const reportRoute = require('./router/report');

// --- Model Imports ---
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
// (الكود الخاص بـ io.on('connection', ...) يبقى كما هو من الرد السابق للدردشة)
// ... (لصق كود io.on('connection', socket => { ... }) هنا بالكامل) ...
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
                    console.log(`[Socket Event - addUser] User ${userIdStr} ('${socket.userFullNameForChat}') mapped. Avatar: ${socket.userAvatarUrlForChat || 'Not set'}`);
                } else {
                    console.warn(`[Socket Event - addUser] User document not found for ID: ${userIdStr}`);
                    socket.userFullNameForChat = 'User (Unknown DB)';
                    socket.userAvatarUrlForChat = null;
                }
            } catch (error) {
                console.error(`[Socket Event - addUser] Error fetching user details for ${userIdStr}:`, error);
                socket.userFullNameForChat = 'User (Fetch Error)';
                socket.userAvatarUrlForChat = null;
            }
            io.emit("getOnlineUsers", Object.keys(onlineUsers));
            console.log("[Socket Event - addUser] Current onlineUsers:", Object.keys(onlineUsers).length);
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
            if (isAdmin && request.status === 'Disputed' && !isDesignatedOverseer) {
                MediationRequest.updateOne({ _id: mediationRequestId }, { $addToSet: { disputeOverseers: userIdToJoin } })
                    .exec().then(() => console.log(`[joinMediationChat] Admin ${userIdToJoin} added to disputeOverseers for ${mediationRequestId} (async).`))
                    .catch(updateError => console.warn(`[joinMediationChat] Non-critical error adding admin to overseers: ${updateError.message}`));
            }
            const allowedStatusesToJoin = ['InProgress', 'PartiesConfirmed', 'MediationOfferAccepted', 'EscrowFunded', 'Disputed'];
            if (!allowedStatusesToJoin.includes(request.status)) {
                console.warn(`[joinMediationChat] Chat unavailable for mediation ${mediationRequestId} due to status: ${request.status}`);
                return socket.emit('mediationChatError', { message: `Chat unavailable for this mediation status (${request.status}).` });
            }
            socket.join(mediationRequestId.toString());
            const roomSocketsCount = io.sockets.adapter.rooms.get(mediationRequestId.toString())?.size || 0;
            console.log(`[joinMediationChat] Socket ${socket.id} (User: ${userIdToJoin}, Role: ${userRole}) successfully joined room ${mediationRequestId}. Sockets in room now: ${roomSocketsCount}`);
            socket.emit('joinedMediationChatSuccess', { mediationRequestId, message: `Successfully joined mediation chat for: ${request.product?.title || mediationRequestId}.` });
            if (isAdmin && request.status === 'Disputed' && !request.adminJoinMessageSent) {
                const adminName = socket.userFullNameForChat || 'Admin';
                const productTitle = request.product?.title || 'this dispute';
                const systemMessageContent = `🛡️ **${adminName} has joined the chat to review ${productTitle}.** Please provide all necessary information.`;
                const systemMessageForBroadcast = { _id: new mongoose.Types.ObjectId(), sender: null, message: systemMessageContent, type: 'system', timestamp: new Date(), readBy: [] };
                io.to(mediationRequestId.toString()).emit('newMediationMessage', systemMessageForBroadcast);
                console.log(`[joinMediationChat] Admin join system message emitted to room ${mediationRequestId}.`);
                try {
                    await MediationRequest.findByIdAndUpdate(mediationRequestId, { $set: { adminJoinMessageSent: true }, $push: { chatMessages: systemMessageForBroadcast } });
                    console.log(`[joinMediationChat] Admin join system message saved and flag 'adminJoinMessageSent' set for ${mediationRequestId}.`);
                } catch (dbError) {
                    console.error(`[joinMediationChat] CRITICAL: Error setting adminJoinMessageSent flag or saving system message for ${mediationRequestId}:`, dbError);
                }
            } else if (isAdmin && request.status === 'Disputed' && request.adminJoinMessageSent) {
                console.log(`[joinMediationChat] Admin join system message was already sent for ${mediationRequestId}. Skipping.`);
            }
        } catch (error) {
            console.error(`[joinMediationChat] General error for mediation ${mediationRequestId}:`, error.message, error.stack);
            socket.emit('mediationChatError', { message: "An unexpected error occurred while trying to join the chat." });
        }
    });

    socket.on('sendMediationMessage', async ({ mediationRequestId, messageText, imageUrl }) => {
        const senderId = socket.userIdForChat;
        const senderFullName = socket.userFullNameForChat || 'User (Socket)';
        const senderAvatarUrl = socket.userAvatarUrlForChat;
        console.log(`[Socket Event - sendMediationMessage] Received. Room: ${mediationRequestId}, SenderID: ${senderId}, Text: ${messageText ? 'Yes' : 'No'}, Image: ${imageUrl ? 'Yes' : 'No'}`);
        if (!senderId || !mongoose.Types.ObjectId.isValid(senderId)) {
            console.error(`[sendMediationMessage] Invalid or missing senderId: ${senderId}`);
            return socket.emit('mediationChatError', { message: "Invalid sender information." });
        }
        if (!mediationRequestId || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            console.error(`[sendMediationMessage] Invalid or missing mediationRequestId: ${mediationRequestId}`);
            return socket.emit('mediationChatError', { message: "Invalid mediation request ID." });
        }
        if ((!messageText || messageText.trim() === "") && !imageUrl) {
            console.warn(`[sendMediationMessage] Attempt to send empty message by ${senderId} to ${mediationRequestId}`);
            return socket.emit('mediationChatError', { message: "Cannot send an empty message." });
        }
        try {
            const newMessageData = { _id: new mongoose.Types.ObjectId(), sender: new mongoose.Types.ObjectId(senderId), message: (imageUrl && !messageText) ? null : messageText?.trim(), imageUrl: imageUrl || null, type: imageUrl ? 'image' : 'text', timestamp: new Date(), readBy: [] };
            if (newMessageData.type === 'text' && (!newMessageData.message || newMessageData.message.trim() === "")) {
                console.error(`[sendMediationMessage] Critical: Attempted to save an empty text message. Sender: ${senderId}, Room: ${mediationRequestId}`);
                return socket.emit('mediationChatError', { message: "Cannot send empty text content." });
            }
            const updateResult = await MediationRequest.updateOne({ _id: mediationRequestId }, { $push: { chatMessages: newMessageData } });
            if (updateResult.matchedCount === 0) {
                console.error(`[sendMediationMessage] Mediation request ${mediationRequestId} not found for saving message.`);
                return socket.emit('mediationChatError', { message: "Mediation request not found to save message." });
            }
            if (updateResult.modifiedCount === 0) console.warn(`[sendMediationMessage] Message might not have been pushed to ${mediationRequestId}, though matched. UpdateResult:`, updateResult);
            const populatedMessageForEmit = { ...newMessageData, sender: { _id: senderId, fullName: senderFullName, avatarUrl: senderAvatarUrl } };
            if (!populatedMessageForEmit.sender.fullName) {
                console.warn(`[sendMediationMessage] Broadcasting message for ${senderId} without full sender name. Attempting quick fetch.`);
                try {
                    const userDoc = await User.findById(senderId).select('fullName avatarUrl').lean();
                    if (userDoc) {
                        populatedMessageForEmit.sender.fullName = userDoc.fullName;
                        populatedMessageForEmit.sender.avatarUrl = userDoc.avatarUrl;
                    } else populatedMessageForEmit.sender.fullName = "User (Unknown DB)";
                } catch (fetchErr) {
                    console.error(`[sendMediationMessage] Error fetching sender details for broadcast: ${fetchErr.message}`);
                    populatedMessageForEmit.sender.fullName = "User (Fetch Error)";
                }
            }
            const roomSockets = io.sockets.adapter.rooms.get(mediationRequestId.toString());
            console.log(`[sendMediationMessage] Broadcasting message ID ${populatedMessageForEmit._id} to room ${mediationRequestId.toString()}. Sockets in room: ${roomSockets ? roomSockets.size : 0}`);
            io.to(mediationRequestId.toString()).emit('newMediationMessage', populatedMessageForEmit);
        } catch (error) {
            console.error(`❌ [sendMediationMessage] Error during message processing for room ${mediationRequestId}:`, error);
            socket.emit('mediationChatError', { message: "Error sending message. Please try again." });
        }
    });

    socket.on("mark_messages_read", async ({ mediationRequestId, messageIds, readerUserId }) => {
        console.log(`[Socket Event - mark_messages_read] Received for Room: ${mediationRequestId}, User: ${readerUserId}, Msgs: ${messageIds?.length}`);
        if (!mediationRequestId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0 || !readerUserId) {
            console.warn("[mark_messages_read] Invalid parameters received.");
            return;
        }
        try {
            const objectMessageIds = messageIds.map(id => new mongoose.Types.ObjectId(id));
            const readerObjectId = new mongoose.Types.ObjectId(readerUserId);
            const readerUserDetails = await User.findById(readerObjectId).select('fullName avatarUrl').lean();
            if (!readerUserDetails) console.warn(`[mark_messages_read] Reader user details not found for ID: ${readerUserId}`);
            const updateResult = await MediationRequest.updateMany(
                { _id: mediationRequestId, 'chatMessages._id': { $in: objectMessageIds } },
                { $addToSet: { 'chatMessages.$[elem].readBy': { readerId: readerObjectId, timestamp: new Date(), fullName: readerUserDetails?.fullName || 'User', avatarUrl: readerUserDetails?.avatarUrl } } },
                { arrayFilters: [{ 'elem._id': { $in: objectMessageIds }, 'elem.readBy.readerId': { $ne: readerObjectId } }], maxTimeMS: 1000 }
            );
            console.log(`[mark_messages_read] Update result for room ${mediationRequestId}: Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`);
            if (updateResult.modifiedCount > 0) {
                const updatedMessageInfos = messageIds.map((id) => ({ _id: id, readBy: [{ readerId: readerUserId, timestamp: new Date(), fullName: readerUserDetails?.fullName || 'User', avatarUrl: readerUserDetails?.avatarUrl }] }));
                console.log(`[mark_messages_read] Emitting 'messages_status_updated' to room ${mediationRequestId} for ${updatedMessageInfos.length} messages.`);
                io.to(mediationRequestId.toString()).emit("messages_status_updated", { mediationRequestId, updatedMessages: updatedMessageInfos });
            } else console.log(`[mark_messages_read] No messages were actually updated for read status in room ${mediationRequestId} (possibly already marked or no match).`);
        } catch (err) {
            if (err.code === 112 || err.message.includes('WriteConflict')) console.warn(`[mark_messages_read] Write conflict encountered for room ${mediationRequestId}. Error: ${err.message}.`);
            else console.error(`[mark_messages_read] Error updating read status for room ${mediationRequestId}:`, err);
        }
    });

    socket.on("start_typing", ({ mediationRequestId }) => {
        if (mediationRequestId && socket.userIdForChat) {
            socket.to(mediationRequestId.toString()).emit("user_typing", { userId: socket.userIdForChat, fullName: socket.userFullNameForChat, avatarUrl: socket.userAvatarUrlForChat });
        }
    });

    socket.on("stop_typing", ({ mediationRequestId }) => {
        if (mediationRequestId && socket.userIdForChat) {
            socket.to(mediationRequestId.toString()).emit("user_stopped_typing", { userId: socket.userIdForChat });
        }
    });

    socket.on('leaveMediationChat', ({ mediationRequestId }) => {
        if (socket.userIdForChat && mediationRequestId) {
            socket.leave(mediationRequestId.toString());
            const roomSocketsCount = io.sockets.adapter.rooms.get(mediationRequestId.toString())?.size || 0;
            console.log(`[Socket Event - leaveMediationChat] User ${socket.userIdForChat} (Socket: ${socket.id}) left room ${mediationRequestId}. Sockets remaining: ${roomSocketsCount}`);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔥: Socket ${socket.id} (User: ${socket.userIdForChat || 'Unknown'}) disconnected. Reason: ${reason}. Was in rooms: ${Array.from(socket.rooms)}`);
        if (socket.userIdForChat) {
            const userIdStr = socket.userIdForChat.toString();
            if (onlineUsers[userIdStr] === socket.id) {
                delete onlineUsers[userIdStr];
                console.log(`User ${userIdStr} removed from online list because their primary socket ${socket.id} disconnected.`);
                io.emit("getOnlineUsers", Object.keys(onlineUsers));
                io.emit('onlineUsersListUpdated', Object.keys(onlineUsers));
                console.log("[Socket Event - disconnect] Emitted onlineUsersListUpdated. Current online users count:", Object.keys(onlineUsers).length);
            } else console.log(`User ${userIdStr} (socket ${socket.id}) disconnected, but was not their primary online socket. Primary might be ${onlineUsers[userIdStr]}.`);
            socket.rooms.forEach(room => {
                if (room !== socket.id) io.to(room).emit("user_stopped_typing", { userId: userIdStr });
            });
        }
    });
});
// -----------------------------------

// --- Scheduled Jobs ---
cron.schedule('*/5 * * * *', async () => { // كل 5 دقيقة للاختبار
    console.log(`[CRON MASTER] Triggering 'releaseDuePendingFunds' job at ${new Date().toISOString()}`);
    try {
        const result = await releaseDuePendingFunds(io, onlineUsers);
        console.log(`[CRON MASTER] Job "releaseDuePendingFunds" completed. Released: ${result.fundsReleasedCount}, Errors: ${result.errorsEncountered}.`);
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
app.use('/reports', reportRoute);

app.get('/', (req, res) => res.json({ message: 'Welcome to SBEX API!' }));

// --- Global Error Handler ---
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