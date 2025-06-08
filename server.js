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
        if (!senderId || !mediationRequestId) return;
        try {
            const newMessageData = { _id: new mongoose.Types.ObjectId(), sender: new mongoose.Types.ObjectId(senderId), message: messageText, imageUrl, type: imageUrl ? 'image' : 'text', timestamp: new Date(), readBy: [] };
            await MediationRequest.updateOne({ _id: mediationRequestId }, { $push: { chatMessages: newMessageData } });
            const populatedMessageForEmit = { ...newMessageData, sender: { _id: senderId, fullName: socket.userFullNameForChat, avatarUrl: socket.userAvatarUrlForChat } };
            io.to(mediationRequestId.toString()).emit('newMediationMessage', populatedMessageForEmit);
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
                    // Use $push because the arrayFilter now guarantees the user hasn't read it yet.
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
                            // This condition prevents adding a duplicate reader.
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
            // Your authorization logic here...
            socket.join(subChatRoomName);
            socket.emit('joinedAdminSubChatSuccess', { subChatId, roomName: subChatRoomName });
        } catch (error) {
            console.error(`[joinAdminSubChat] Error:`, error);
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
                readBy: [{ readerId: senderId, readAt: new Date() }]
            };

            // --- START OF THE FIX ---
            // 1. Find the mediation request and the specific sub-chat to get participants
            const mediationRequest = await MediationRequest.findOne(
                { _id: mediationRequestId, "adminSubChats.subChatId": subChatId },
                { 'adminSubChats.$': 1 } // Project only the matching sub-chat
            ).lean();

            if (!mediationRequest || !mediationRequest.adminSubChats || mediationRequest.adminSubChats.length === 0) {
                console.error(`[sendAdminSubChatMessage] Could not find sub-chat ${subChatId} to send message.`);
                return;
            }

            // 2. Save the message to the database
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

            // 3. Get all participant IDs from the sub-chat
            const participantIds = mediationRequest.adminSubChats[0].participants.map(p => p.userId.toString());

            // 4. Emit the message directly to each participant's socket ID
            console.log(`\n--- [DIRECT SOCKET EMIT] ---`);
            console.log(`Event: 'new_admin_sub_chat_message' for subChatId: ${subChatId}`);

            participantIds.forEach(participantId => {
                const targetSocketId = onlineUsers[participantId]; // Get socket ID from our onlineUsers map
                if (targetSocketId) {
                    console.log(` -> Emitting to UserID: ${participantId} on SocketID: ${targetSocketId}`);
                    io.to(targetSocketId).emit('new_admin_sub_chat_message', {
                        mediationRequestId,
                        subChatId,
                        message: populatedMessageForEmit
                    });
                } else {
                    console.log(` -> UserID: ${participantId} is offline. No emit.`);
                }
            });
            console.log(`--- [END OF EMIT] ---\n`);
            // --- END OF THE FIX ---

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
        if (!readerUserId || !Array.isArray(messageIds) || messageIds.length === 0) {
            return console.warn(`[markAdminRead] Invalid parameters received.`);
        }
        try {
            const readerObjectId = new mongoose.Types.ObjectId(readerUserId);
            const readerDetails = await User.findById(readerObjectId).select('fullName avatarUrl').lean();
            if (!readerDetails) return;

            // --- START OF THE FIX ---
            const readReceipt = {
                readerId: readerObjectId,
                fullName: readerDetails.fullName,
                avatarUrl: readerDetails.avatarUrl,
                readAt: new Date()
            };

            const updateResult = await MediationRequest.updateOne(
                { _id: mediationRequestId, "adminSubChats.subChatId": subChatId },
                {
                    $push: { "adminSubChats.$[outer].messages.$[inner].readBy": readReceipt }
                },
                {
                    arrayFilters: [
                        { "outer.subChatId": new mongoose.Types.ObjectId(subChatId) },
                        {
                            "inner._id": { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) },
                            "inner.readBy.readerId": { $ne: readerObjectId }
                        }
                    ]
                }
            );

            if (updateResult.modifiedCount > 0) {
                const subChatRoomName = `admin_subchat_${mediationRequestId}_${subChatId}`;
                const updatePayload = {
                    subChatId,
                    readerInfo: readReceipt, // Send the reader's info
                    messageIds: messageIds,   // Send the IDs of the messages that were read
                };
                // Emit to the room so everyone gets the update
                io.to(subChatRoomName).emit('admin_sub_chat_messages_status_updated', updatePayload);
                console.log(`[markAdminRead] Emitted 'status_updated' to room ${subChatRoomName}`);
            }
            // --- END OF THE FIX ---

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

cron.schedule('*/5 * * * *', async () => {
    console.log(`[CRON MASTER] Triggering 'releaseDuePendingFunds' job at ${new Date().toISOString()}`);
    try {
        const result = await releaseDuePendingFunds(io, onlineUsers);
        console.log(`[CRON MASTER] Job "releaseDuePendingFunds" completed. Released: ${result.fundsReleasedCount}, Errors: ${result.errorsEncountered}.`);
    } catch (error) {
        console.error('[CRON MASTER] Critical error during scheduled "releaseDuePendingFunds" job:', error);
    }
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const chatImageUploadPath = path.join(__dirname, 'uploads/chat_images/');
if (!fs.existsSync(chatImageUploadPath)) {
    fs.mkdirSync(chatImageUploadPath, { recursive: true });
}

app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

connectDB();

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

app.get('/', (req, res) => res.json({ message: 'Welcome to SBEX API!' }));

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