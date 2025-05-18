// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const config = require('config');
const mongoose = require('mongoose');

const PORT = config.get('PORT') || 8000;
let FRONTEND_URL = config.get('FRONTEND_URL') || "http://localhost:3000";
if (config.has('FRONTEND_URL')) console.log(`Using FRONTEND_URL from config: ${FRONTEND_URL}`);
else console.warn('WARNING: FRONTEND_URL not defined. Using default "http://localhost:3000".');

const user = require('./router/user');
const product = require('./router/product');
const cart = require('./router/cart');
const notification = require('./router/notification'); // router للإشعارات (إذا كان لديك API endpoints لها)
const wallet = require('./router/wallet');
const ratingRoute = require('./router/rating');
const paymentMethodRoute = require('./router/paymentMethod');
const depositRoute = require('./router/deposit.router');
const uploadRoute = require('./router/upload.router');
const withdrawalRoute = require('./router/withdrawal.router');
const mediationRoute = require('./router/mediation.router');

const MediationRequest = require('./models/MediationRequest');
const User = require('./models/User');
const Notification = require('./models/Notification'); // موديل الإشعارات

const connectDB = require('./config/connectDB');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST", "PUT"], // أضفت PUT
        credentials: true
    },
});

let onlineUsers = {}; // { userId: socketId } // لتتبع المستخدمين المتصلين عموماً
// let usersInRooms = {}; // { roomId: { socketId: userId, ... }, ... } // لتتبع المستخدمين في كل غرفة (اختياري)

io.on('connection', (socket) => {
    console.log(`⚡: Socket ${socket.id} user connected`);
    // لا نعتمد على currentSocketUserId هنا بشكل كبير، بل على خصائص الـ socket

socket.on('addUser', async (userId) => {
    console.log(`[Socket Event - addUser] Received for userId: ${userId} from socket: ${socket.id}`);
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        onlineUsers[userId.toString()] = socket.id;
        socket.userIdForChat = userId.toString(); 
        try {
            const userDoc = await User.findById(userId.toString()).select('fullName avatarUrl').lean();
            if (userDoc) {
                socket.userFullNameForChat = userDoc.fullName; 
                socket.userAvatarUrlForChat = userDoc.avatarUrl; // <--- تأكد من تخزين هذا
                console.log(`[Socket Event - addUser] User ${userId} (${socket.userFullNameForChat}) mapped. Avatar: ${socket.userAvatarUrlForChat}`);
            } else {
                socket.userFullNameForChat = 'User';
                socket.userAvatarUrlForChat = null;
            }
        } catch (error) {
            console.error(`[Socket Event - addUser] Error fetching user for fullName/avatar:`, error);
            socket.userFullNameForChat = 'User';
            socket.userAvatarUrlForChat = null;
        }
        io.emit("getOnlineUsers", Object.keys(onlineUsers));
    } else {
            console.warn(`[Socket Event - addUser] Invalid or missing userId for socket ${socket.id}`);
        }
    });

socket.on('joinMediationChat', async ({ mediationRequestId, userId, userRole }) => {
    const userIdToJoin = socket.userIdForChat || userId; // استخدم userId المرسل إذا لم يكن socket.userIdForChat متاحاً
        
        console.log(`[Socket Event - joinMediationChat] Received. SocketID: ${socket.id}, MediationID: ${mediationRequestId}, UserID: ${userIdToJoin}, Role: ${userRole}`);

        if (!userIdToJoin || !mediationRequestId || !mongoose.Types.ObjectId.isValid(userIdToJoin) || !mongoose.Types.ObjectId.isValid(mediationRequestId)) {
            console.warn(`[Socket Event - joinMediationChat] VALIDATION FAILED: Missing or invalid IDs. UserID: ${userIdToJoin}, MediationID: ${mediationRequestId}`);
            return socket.emit('mediationChatError', { message: "Required user or mediation ID missing/invalid to join chat." });
        }
        
        // التأكد من أن socket.userIdForChat و socket.userFullNameForChat معينان
        if (!socket.userIdForChat) socket.userIdForChat = userIdToJoin;
    if (!socket.userFullNameForChat || (userIdToJoin && !socket.userAvatarUrlForChat)) { // جلب البيانات إذا لم تكن موجودة
        try {
            const userDoc = await User.findById(userIdToJoin).select('fullName avatarUrl').lean();
            if (userDoc) {
                socket.userFullNameForChat = userDoc.fullName;
                socket.userAvatarUrlForChat = userDoc.avatarUrl;
            }
        } catch (e) { console.error("Error fetching user details for joinMediationChat:", e); }
    }

        try {
            const request = await MediationRequest.findById(mediationRequestId).select('seller buyer mediator status');
            if (!request) {
                return socket.emit('mediationChatError', { message: "Mediation request not found for chat." });
            }

            const isSeller = request.seller.equals(userIdToJoin);
            const isBuyer = request.buyer.equals(userIdToJoin);
            const isMediator = request.mediator && request.mediator.equals(userIdToJoin);
            const isAdmin = (await User.findById(userIdToJoin).select('userRole').lean())?.userRole === 'Admin';


            if (!(isSeller || isBuyer || isMediator || isAdmin)) {
                console.warn(`[Socket Event - joinMediationChat] User ${userIdToJoin} not authorized for mediation ${mediationRequestId}.`);
                return socket.emit('mediationChatError', { message: "You are not authorized to join this chat." });
            }
            // اسمح بالانضمام إذا كانت الوساطة InProgress أو PartiesConfirmed
             if (request.status !== 'InProgress' && request.status !== 'PartiesConfirmed' && request.status !== 'MediationOfferAccepted' && request.status !== 'EscrowFunded') {
                console.warn(`[Socket Event - joinMediationChat] Chat not active for mediation ${mediationRequestId}. Status: ${request.status}`);
                return socket.emit('mediationChatError', { message: `Chat is not active for this mediation (Status: ${request.status}).` });
            }


            socket.join(mediationRequestId.toString()); // الانضمام للغرفة باستخدام ID الوساطة
            console.log(`[Socket Event - joinMediationChat] User ${userIdToJoin} (${socket.userFullNameForChat}) joined room: ${mediationRequestId}`);
            socket.emit('joinedMediationChatSuccess', { mediationRequestId, message: `Successfully joined chat for mediation: ${mediationRequestId}` });
            // يمكنك إعلام الآخرين في الغرفة بانضمام مستخدم جديد إذا أردت
            // socket.to(mediationRequestId.toString()).emit('user_joined_room', { userId: userIdToJoin, fullName: socket.userFullNameForChat });
        } catch (error) {
            console.error(`[Socket Event - joinMediationChat] Error for mediation ${mediationRequestId}, user ${userIdToJoin}:`, error);
            socket.emit('mediationChatError', { message: "Server error while trying to join the chat." });
        }
    });

    socket.on('sendMediationMessage', async ({ mediationRequestId, messageText }) => {
        const senderId = socket.userIdForChat; 
        const senderFullName = socket.userFullNameForChat || 'A User';

        if (!senderId || !mediationRequestId || !messageText || messageText.trim() === "") {
            console.warn("[Socket Event - sendMediationMessage] Missing data or empty message.", { senderId, mediationRequestId, messageText });
            return socket.emit('mediationChatError', { message: "Cannot send message: missing data." });
        }
        
        console.log(`[Socket Event - sendMediationMessage] From ${senderFullName} (${senderId}) for room ${mediationRequestId}: "${messageText}"`);
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const mediationRequest = await MediationRequest.findById(mediationRequestId)
                .populate('product', 'title _id')
                .populate('seller', '_id')
                .populate('buyer', '_id')
                .populate('mediator', '_id')
                .session(session);

            if (!mediationRequest) throw new Error("Mediation request not found for sending message.");
            if (mediationRequest.status !== 'InProgress' && mediationRequest.status !== 'PartiesConfirmed') { // اسمح بإرسال الرسائل أيضاً في PartiesConfirmed
                 throw new Error("Chat is not active for this mediation.");
            }
            
            const isParty = mediationRequest.seller._id.equals(senderId) || mediationRequest.buyer._id.equals(senderId) || (mediationRequest.mediator && mediationRequest.mediator._id.equals(senderId));
            if (!isParty) throw new Error("Sender is not a party to this mediation.");


            const newMessageDoc = {
                sender: senderId,
                message: messageText.trim(),
                type: 'text',
                timestamp: new Date()
            };
            mediationRequest.chatMessages.push(newMessageDoc);
            await mediationRequest.save({ session });
            
            await session.commitTransaction(); 

            const senderDetails = await User.findById(senderId).select('fullName avatarUrl').lean();
            const savedMessageFromDb = mediationRequest.chatMessages[mediationRequest.chatMessages.length - 1].toObject();
            const messageToBroadcast = { ...savedMessageFromDb, sender: senderDetails };

            io.to(mediationRequestId.toString()).emit('newMediationMessage', messageToBroadcast);
            console.log(`   Text message broadcasted to room ${mediationRequestId}`);

            // --- إنشاء وإرسال إشعار "NEW_CHAT_MESSAGE" للمستلمين الآخرين ---
            const participantsToNotify = [];
            if (mediationRequest.seller._id.toString() !== senderId) participantsToNotify.push(mediationRequest.seller._id);
            if (mediationRequest.buyer._id.toString() !== senderId) participantsToNotify.push(mediationRequest.buyer._id);
            if (mediationRequest.mediator && mediationRequest.mediator._id.toString() !== senderId) participantsToNotify.push(mediationRequest.mediator._id);

            if (participantsToNotify.length > 0) {
                const notificationPromises = participantsToNotify.map(recipientId => {
                    return Notification.create({ // لا تحتاج session هنا لأن المعاملة السابقة انتهت
                        user: recipientId,
                        type: 'NEW_CHAT_MESSAGE',
                        title: `New message in: ${mediationRequest.product?.title || 'Mediation Chat'}`,
                        message: `${senderFullName}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
                        relatedEntity: { id: mediationRequestId, modelName: 'MediationRequest' }
                    }).then(newNotif => {
                        const recipientSocketId = onlineUsers[recipientId.toString()];
                        if (recipientSocketId) {
                            io.to(recipientSocketId).emit('new_notification', newNotif.toObject());
                            console.log(`   NEW_CHAT_MESSAGE notification sent to ${recipientId} via socket.`);
                        }
                    });
                });
                Promise.all(notificationPromises).catch(err => console.error("Error creating/sending NEW_CHAT_MESSAGE notifications:", err));
            }
            // ---------------------------------------------

        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
            console.error(`[Socket Event - sendMediationMessage] Error:`, error.message, error.stack);
            socket.emit('mediationChatError', { message: error.message || "Server error sending message." });
        } finally {
            if (session.endSession) await session.endSession();
        }
    });

    // --- أحداث مؤشرات الكتابة ---
    socket.on('start_typing', ({ mediationRequestId }) => {
if (socket.userIdForChat && socket.userFullNameForChat && mediationRequestId) {
        console.log(`[Socket Event - start_typing] User ${socket.userIdForChat} (${socket.userFullNameForChat}) in room ${mediationRequestId}`);
        socket.to(mediationRequestId.toString()).emit('user_typing', { 
            userId: socket.userIdForChat,
            fullName: socket.userFullNameForChat,
            avatarUrl: socket.userAvatarUrlForChat // <--- إرسال avatarUrl هنا
        });
    } else {
        console.warn(`[Socket Event - start_typing] Missing data for typing indicator:`, {
            userId: socket.userIdForChat, 
            fullName: socket.userFullNameForChat, 
            avatarUrl: socket.userAvatarUrlForChat, // أضفت هذا للـ log
            mediationRequestId
        });
    }
});

socket.on('stop_typing', ({ mediationRequestId }) => {
    if (socket.userIdForChat && mediationRequestId) {
        console.log(`[Socket Event - stop_typing] User ${socket.userIdForChat} in room ${mediationRequestId}`);
        socket.to(mediationRequestId.toString()).emit('user_stopped_typing', { 
            userId: socket.userIdForChat 
            // لا نحتاج لإرسال الاسم أو الصورة عند التوقف
        });
    }
});
    // -------------------------

    socket.on('leaveMediationChat', ({ mediationRequestId }) => {
        if (socket.userIdForChat && mediationRequestId) {
            socket.leave(mediationRequestId.toString());
            console.log(`Socket: User ${socket.userIdForChat} left chat room ${mediationRequestId}`);
            // يمكنك إعلام الآخرين هنا إذا أردت
            // socket.to(mediationRequestId.toString()).emit('user_left_room', { userId: socket.userIdForChat, fullName: socket.userFullNameForChat });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔥: Socket ${socket.id} (User: ${socket.userIdForChat || 'Unknown'}) disconnected. Reason: ${reason}`);
        if (socket.userIdForChat) {
            // إزالة المستخدم من onlineUsers
            // يجب التعامل مع حالة إذا كان المستخدم لديه عدة اتصالات (tabs)
            // الطريقة البسيطة هي حذف المدخل:
            let stillOnline = false;
            for (const uid in onlineUsers) {
                if (onlineUsers[uid] === socket.id && uid === socket.userIdForChat) {
                    delete onlineUsers[uid];
                    console.log(`User ${socket.userIdForChat} removed from online list due to disconnect.`);
                    break; // افترض أن كل socket له مدخل واحد
                } else if (onlineUsers[uid] !== socket.id && uid === socket.userIdForChat) {
                    stillOnline = true; // المستخدم لا يزال متصلاً من socket آخر
                    console.log(`User ${socket.userIdForChat} still online via another socket.`);
                }
            }
            
            // إعلام المستخدمين الآخرين بتحديث قائمة المتصلين
            io.emit("getOnlineUsers", Object.keys(onlineUsers));

            // إعلام غرف المحادثة التي كان فيها بأن المستخدم توقف عن الكتابة (إذا كان يكتب)
            // هذا يتطلب معرفة الغرف التي كان فيها المستخدم
            // For simplicity, this part is often handled by client-side timeouts for typing indicators
        }
    });
});

// --- Middlewares لتطبيق Express ---
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`Serving static files from: ${path.join(__dirname, 'uploads')} at /uploads`);

app.use((req, res, next) => {
    req.io = io; // جعل io متاحاً في الـ request handlers (مفيد لـ controllers)
    req.onlineUsers = onlineUsers;
    next();
});

connectDB();

// --- Routes ---
app.use("/user", user);
app.use('/product', product);
app.use('/cart', cart);
app.use('/notifications', notification); // router الإشعارات إذا كان لديك API endpoints لها
app.use('/wallet', wallet);
app.use('/ratings', ratingRoute);
app.use('/payment-methods', paymentMethodRoute);
app.use('/deposits', depositRoute);
app.use('/uploads', uploadRoute);
app.use('/withdrawals', withdrawalRoute);
app.use('/mediation', mediationRoute);

app.get('/', (req, res) => res.json({ message: 'Welcome to SBEX API!' }));

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error("!!! UNHANDLED EXPRESS ERROR !!!:", err.stack || err);
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message;
    if (!res.headersSent) {
        res.status(statusCode).json({ status: 'error', message: message });
    }
});

server.listen(PORT, () => console.log(`🚀 Server with Socket.IO listening on port ${PORT}`));

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    server.close(() => { console.log('HTTP server closed') });
});