console.log('<<<<< SERVER.JS IS STARTING - VERSION NEWEST >>>>>');
// server.js
// *** نسخة كاملة ومعدلة مع أحداث Socket.IO للمحادثة ***

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const config = require('config');

// --- [!] قراءة الإعدادات أولاً ---
const PORT = config.get('PORT') || 8000;
let FRONTEND_URL;
if (config.has('FRONTEND_URL')) {
    FRONTEND_URL = config.get('FRONTEND_URL');
    console.log(`Using FRONTEND_URL from config: ${FRONTEND_URL}`);
} else {
    console.warn('WARNING: FRONTEND_URL is not defined in config files. Using default "http://localhost:3000".');
    FRONTEND_URL = "http://localhost:3000";
}
// --- [!] نهاية قراءة الإعدادات ---

// --- استيراد المسارات (Routers) ---
const user = require('./router/user');
const product = require('./router/product');
const cart = require('./router/cart');
const notification = require('./router/notification');
const wallet = require('./router/wallet');
const ratingRoute = require('./router/rating');
const paymentMethodRoute = require('./router/paymentMethod');
const depositRoute = require('./router/deposit.router');
const uploadRoute = require('./router/upload.router');
const withdrawalRoute = require('./router/withdrawal.router');
const mediationRoute = require('./router/mediation.router');

console.log('<<<<< mediationRoute imported into server.js >>>>>');

// --- [!!!] استيراد الموديلات اللازمة لـ Socket.IO [!!!] ---
const MediationRequest = require('./models/MediationRequest');
const User = require('./models/User'); // لجلب معلومات مرسل الرسالة
// ----------------------------------------------------

const connectDB = require('./config/connectDB');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true
    },
});

let onlineUsers = {}; // { userId: socketId }

io.on('connection', (socket) => {
    console.log(`⚡: Socket ${socket.id} user connected`);
    let currentSocketUserId = null; // لتخزين ID المستخدم لهذا الاتصال

    socket.on('addUser', (userId) => {
        if (userId) { // التحقق من أن userId ليس null أو undefined
            onlineUsers[userId] = socket.id;
            currentSocketUserId = userId; // حفظ ID المستخدم للعمليات اللاحقة لهذا الـ socket
            socket.userIdForChat = userId; // طريقة أخرى لربط userId بالـ socket instance إذا احتجت
            console.log(`User ${userId} mapped to socket ${socket.id}. Online users: ${Object.keys(onlineUsers).length}`);
            io.emit("getUsers", Object.keys(onlineUsers));
        } else {
            console.warn(`Socket ${socket.id} tried to addUser without a userId.`);
        }
    });

    // --- [!!!] أحداث المحادثة الخاصة بالوساطة [!!!] ---
    socket.on('joinMediationChat', async ({ mediationRequestId, userRole }) => {
        const userIdJoining = socket.userIdForChat || currentSocketUserId; // استخدام المعرف المخزن
        if (!userIdJoining || !mediationRequestId) {
            console.warn(`Socket: joinMediationChat - Missing userId (${userIdJoining}) or mediationRequestId (${mediationRequestId}) for socket ${socket.id}`);
            socket.emit('mediationChatError', { message: "Required information missing to join chat." });
            return;
        }
        try {
            const request = await MediationRequest.findById(mediationRequestId).select('seller buyer mediator status');
            if (!request) {
                socket.emit('mediationChatError', { message: "Mediation request not found." });
                return;
            }

            const isSeller = request.seller.equals(userIdJoining);
            const isBuyer = request.buyer.equals(userIdJoining);
            const isMediator = request.mediator && request.mediator.equals(userIdJoining);

            // السماح بالانضمام إذا كان طرفًا وكانت الحالة 'InProgress' أو حالة أخرى تسمح بالدردشة
            if (!(isSeller || isBuyer || isMediator) || request.status !== 'InProgress') {
                // يمكنك تعديل هذا الشرط لاحقًا إذا أردت السماح بالدردشة في حالات أخرى
                console.warn(`Socket: User ${userIdJoining} not authorized or chat not active for mediation ${mediationRequestId}. Status: ${request.status}`);
                socket.emit('mediationChatError', { message: "You are not authorized to join this chat or the chat is not active." });
                return;
            }

            socket.join(mediationRequestId);
            console.log(`Socket: User ${userIdJoining} (Role: ${userRole || 'Unknown'}) joined chat room for mediation ${mediationRequestId}`);

            // (اختياري) إعلام العميل بنجاح الانضمام
            socket.emit('joinedMediationChatSuccess', { mediationRequestId, message: `Successfully joined chat for mediation: ${mediationRequestId}` });

            // (اختياري) إعلام الآخرين في الغرفة بانضمام مستخدم جديد
            // socket.to(mediationRequestId).emit('userJoinedChat', { userId: userIdJoining, fullName: req.user.fullName }); // ستحتاج لجلب fullName إذا أردت

        } catch (error) {
            console.error(`Socket: Error in joinMediationChat for mediation ${mediationRequestId}, user ${userIdJoining}:`, error);
            socket.emit('mediationChatError', { message: "Server error occurred while trying to join the chat." });
        }
    });

    socket.on('sendMediationMessage', async ({ mediationRequestId, messageText }) => {
        const senderId = socket.userIdForChat || currentSocketUserId;
        if (!senderId || !mediationRequestId || !messageText || messageText.trim() === "") {
            console.warn("Socket: sendMediationMessage - Missing data or empty message.");
            socket.emit('mediationChatError', { message: "Cannot send an empty message or missing required data." });
            return;
        }
        try {
            // لا نحتاج لجلب الطلب بالكامل هنا إذا كنا نثق أن المستخدم موجود في الغرفة الصحيحة
            // ولكن للتحقق من صلاحية الإرسال وحفظ الرسالة، نحتاجه
            const request = await MediationRequest.findById(mediationRequestId); // لا حاجة لـ .session() هنا إلا إذا كانت ضمن معاملة أوسع
            if (!request) {
                socket.emit('mediationChatError', { message: "Mediation request not found for sending message." });
                return;
            }
            // تحقق بسيط من أن المرسل لا يزال طرفًا (قد يكون تم إزالته أو تغيرت حالته)
            const isParty = request.seller.equals(senderId) ||
                request.buyer.equals(senderId) ||
                (request.mediator && request.mediator.equals(senderId));
            if (!isParty || request.status !== 'InProgress') { // اسمح بالرسائل فقط إذا كانت الوساطة جارية
                socket.emit('mediationChatError', { message: "Cannot send message to this chat or the chat is not currently active." });
                return;
            }

            const newMessageDocument = {
                sender: senderId,
                message: messageText.trim(),
                timestamp: new Date()
            };

            request.chatMessages.push(newMessageDocument);
            await request.save();
            console.log(`Socket: Message saved for mediation ${mediationRequestId} by ${senderId}`);

            // جلب معلومات المرسل لإرسالها مع الرسالة المبثوثة
            const senderUserDetails = await User.findById(senderId).select('fullName avatarUrl').lean();

            // آخر رسالة تم إضافتها (للحصول على _id الخاص بها إذا أنشأه Mongoose)
            const savedMessageObject = request.chatMessages[request.chatMessages.length - 1].toObject(); // تحويل لـ POJO

            const messageToBroadcast = {
                ...savedMessageObject, // يتضمن _id, message, timestamp
                sender: { // كائن مرسل populated
                    _id: senderUserDetails._id,
                    fullName: senderUserDetails.fullName,
                    avatarUrl: senderUserDetails.avatarUrl
                }
            };

            io.to(mediationRequestId).emit('newMediationMessage', messageToBroadcast);
            console.log(`Socket: Message broadcasted to room ${mediationRequestId}`);

        } catch (error) {
            console.error(`Socket: Error in sendMediationMessage for mediation ${mediationRequestId}, sender ${senderId}:`, error);
            socket.emit('mediationChatError', { message: "Server error occurred while sending the message." });
        }
    });

    socket.on('leaveMediationChat', ({ mediationRequestId }) => {
        const userIdLeaving = socket.userIdForChat || currentSocketUserId;
        if (mediationRequestId && userIdLeaving) {
            socket.leave(mediationRequestId);
            console.log(`Socket: User ${userIdLeaving} left chat room for mediation ${mediationRequestId}`);
            // يمكنك إعلام الآخرين في الغرفة (اختياري)
            // socket.to(mediationRequestId).emit('userLeftChat', { userId: userIdLeaving });
        }
    });
    // --- نهاية أحداث المحادثة ---

    socket.on('disconnect', () => {
        console.log(`🔥: Socket ${socket.id} (User: ${currentSocketUserId || 'Unknown'}) disconnected`);
        if (currentSocketUserId) { // استخدام المعرف المخزن للـ socket
            delete onlineUsers[currentSocketUserId];
            console.log(`User ${currentSocketUserId} removed from online list. Online users: ${Object.keys(onlineUsers).length}`);
            io.emit("getUsers", Object.keys(onlineUsers));
            currentSocketUserId = null; // مسح المعرف عند قطع الاتصال
        }
    });
});
// --- نهاية منطق اتصال Socket.IO ---

// --- Middlewares لتطبيق Express ---
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`Serving static files from: ${path.join(__dirname, 'uploads')} at /uploads`);

app.use((req, res, next) => {
    req.io = io;
    req.onlineUsers = onlineUsers;
    next();
});

connectDB();

// --- [!!!] تعديل مسار الوساطة إذا كنت قد حذفت /api منه في الواجهة الأمامية [!!!] ---
app.use("/user", user);
app.use('/product', product);
app.use('/cart', cart);
app.use('/notifications', notification);
app.use('/wallet', wallet);
app.use('/ratings', ratingRoute);
app.use('/payment-methods', paymentMethodRoute);
app.use('/deposits', depositRoute);
app.use('/uploads', uploadRoute);
app.use('/withdrawals', withdrawalRoute);
app.use('/mediation', mediationRoute); // <--- تأكد أن هذا يتطابق مع استدعاءات API من الواجهة الأمامية

console.log('<<<<< /mediation route setup in server.js >>>>>');

app.get('/', (req, res) => res.json({ message: 'Welcome to SBEX API!' }));

app.use((err, req, res, next) => {
    console.error("!!! UNHANDLED ERROR !!!:", err.stack || err);
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message;
    if (!res.headersSent) { // تحقق مما إذا كانت الرؤوس قد أُرسلت بالفعل
        res.status(statusCode).json({ status: 'error', message: message });
    }
});

server.listen(PORT, () => console.log(`🚀 Server with Socket.IO listening on port ${PORT}`));

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    server.close(() => { console.log('HTTP server closed') });
});