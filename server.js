// server.js
// *** نسخة كاملة ومصححة مع نقل الإعدادات للأعلى ***

const express = require('express');
const http = require('http'); // مكتبة HTTP المدمجة
const { Server } = require("socket.io"); // Server class من socket.io
const cors = require('cors'); // لتمكين Cross-Origin Resource Sharing
const path = require('path'); // لإدارة مسارات الملفات
const config = require('config'); // لقراءة ملفات الإعدادات

// --- [!] قراءة الإعدادات أولاً ---
const PORT = config.get('PORT') || 8000; // قراءة المنفذ، مع قيمة افتراضية 8000
let FRONTEND_URL; // تعريف المتغير

// التحقق من وجود FRONTEND_URL في الإعدادات
if (config.has('FRONTEND_URL')) {
    FRONTEND_URL = config.get('FRONTEND_URL');
    console.log(`Using FRONTEND_URL from config: ${FRONTEND_URL}`);
} else {
    // إذا لم يكن موجودًا، يمكنك تعيين قيمة افتراضية أو إيقاف التطبيق
    console.warn('WARNING: FRONTEND_URL is not defined in config files. Using default "http://localhost:3000".');
    // أو يمكنك إيقاف التطبيق إذا كان إلزاميًا:
    // console.error('FATAL ERROR: FRONTEND_URL is not defined in config files.');
    // process.exit(1);
    FRONTEND_URL = "http://localhost:3000"; // تعيين قيمة افتراضية
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
const depositRoute = require('./router/deposit.router'); // تأكد من اسم الملف .router
const uploadRoute = require('./router/upload.router');   // تأكد من اسم الملف .router
const withdrawalRoute = require('./router/withdrawal.router'); // تأكد من اسم الملف .router
// --- [!!!] إضافة استيراد Router الوساطة [!!!] ---
const mediationRoute = require('./router/mediation.router');

// --- استيراد اتصال قاعدة البيانات ---
const connectDB = require('./config/connectDB');

// --- تهيئة Express وتطبيق HTTP ---
const app = express(); // إنشاء تطبيق Express
const server = http.createServer(app); // إنشاء خادم HTTP يغلف تطبيق Express

// --- تهيئة Socket.IO ---
// إنشاء مثيل لخادم Socket.IO وربطه بخادم HTTP
const io = new Server(server, {
    cors: { // إعدادات CORS لـ Socket.IO
        origin: FRONTEND_URL, // السماح للطلبات من الواجهة الأمامية المحددة
        methods: ["GET", "POST"], // السماح بهذه الطرق
        credentials: true // السماح بإرسال بيانات الاعتماد (مثل الكوكيز)
    },
    // يمكن إضافة إعدادات أخرى هنا مثل pingTimeout, transports, etc.
});

// --- إدارة المستخدمين المتصلين (تخزين بسيط في الذاكرة) ---
let onlineUsers = {}; // قاموس لتخزين { userId: socketId }

// --- منطق اتصال Socket.IO ---
io.on('connection', (socket) => {
    // عند اتصال مستخدم جديد
    console.log(`⚡: Socket ${socket.id} user connected`);

    // مستمع لحدث 'addUser' من العميل
    socket.on('addUser', (userId) => {
        if (userId && !Object.values(onlineUsers).includes(socket.id)) {
            onlineUsers[userId] = socket.id; // ربط ID المستخدم بـ ID المقبس
            console.log(`User ${userId} mapped to socket ${socket.id}. Online users: ${Object.keys(onlineUsers).length}`);
            io.emit("getUsers", Object.keys(onlineUsers)); // إرسال قائمة IDs المستخدمين المتصلين للجميع
        } else if (userId) {
            console.log(`User ${userId} already mapped or attempting re-map with socket ${socket.id}`);
        }
    });

    // مستمع لحدث قطع الاتصال
    socket.on('disconnect', () => {
        console.log(`🔥: Socket ${socket.id} disconnected`);
        let disconnectedUserId = null;
        // البحث عن المستخدم الذي قطع الاتصال وإزالته
        for (const userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                disconnectedUserId = userId;
                delete onlineUsers[userId];
                console.log(`User ${userId} removed from online list. Online users: ${Object.keys(onlineUsers).length}`);
                break;
            }
        }
        // إرسال القائمة المحدثة إذا تم العثور على مستخدم وإزالته
        if (disconnectedUserId) {
            io.emit("getUsers", Object.keys(onlineUsers));
        }
    });

    // يمكنك إضافة مستمعين لأحداث أخرى هنا (مثل الدردشة، تحديثات مباشرة أخرى)
    // socket.on('sendMessage', (data) => { /* ... */ });
});

// --- Middlewares لتطبيق Express ---
// تطبيق CORS لطلبات HTTP العادية
app.use(cors({
    origin: FRONTEND_URL, // السماح للطلبات من الواجهة الأمامية
    credentials: true,
}));
// Middleware لتحليل JSON في جسم الطلبات
app.use(express.json());

// Middleware لخدمة الملفات الثابتة من مجلد uploads
// (تأكد من إنشاء مجلد uploads في جذر المشروع إذا لم يكن موجودًا)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`Serving static files from: ${path.join(__dirname, 'uploads')} at /uploads`);

// Middleware مخصص لجعل io و onlineUsers متاحة في الـ request object
// حتى تتمكن الـ Controllers من الوصول إليها
app.use((req, res, next) => {
    req.io = io; // إضافة مثيل io
    req.onlineUsers = onlineUsers; // إضافة قائمة المستخدمين المتصلين
    next(); // الانتقال للـ middleware أو الـ route التالي
});

// --- اتصال قاعدة البيانات ---
connectDB(); // استدعاء دالة الاتصال

// ربط كل router بالمسار الأساسي الخاص به
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
// --- [!!!] ربط Router الوساطة [!!!] ---
app.use('/mediation', mediationRoute); // استخدام المسار /mediation

// --- مسار أساسي للتحقق من أن الـ API يعمل ---
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to SBEX API!' }); // إرجاع JSON
});

// --- [!] معالج أخطاء عام (اختياري لكن موصى به) ---
// يجب أن يكون آخر middleware يتم استدعاؤه
app.use((err, req, res, next) => {
    console.error("!!! UNHANDLED ERROR !!!:", err.stack || err);
    // لا ترسل تفاصيل الخطأ في بيئة الإنتاج
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message;
    res.status(statusCode).json({
        status: 'error',
        message: message,
        // ...(يمكن إضافة تفاصيل أخرى في وضع التطوير)
    });
});

// --- تشغيل الخادم المدمج (HTTP + Socket.IO) ---
server.listen(PORT, () =>
    console.log(`🚀 Server with Socket.IO listening on port ${PORT}`) // رسالة تأكيد التشغيل
);

// --- معالجة إيقاف الخادم بأمان (اختياري) ---
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    server.close(() => {
        console.log('HTTP server closed')
        // يمكنك إضافة منطق إغلاق اتصال قاعدة البيانات هنا إذا لزم الأمر
        // mongoose.connection.close(false, () => { ... });
    })
});