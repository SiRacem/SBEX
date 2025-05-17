// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'; // استخدم BrowserRouter هنا
import { useSelector, useDispatch } from 'react-redux';
import io from 'socket.io-client';
import { getProfile, logoutUser } from './redux/actions/userAction';
import { Alert, Spinner } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';

// --- استيراد الصفحات والمكونات ---
import NotFound from './pages/NotFound';
import UserListAd from './components/admin/UserListAd';
import ProductListAdmin from './components/admin/ProductListAdmin';
import NotificationsPage from './pages/NotificationsPage';
import Support from './pages/Support';
import Profile from './components/commun/Profile';
import Comptes from './pages/Comptes'; // صفحة إضافة منتج/حسابات البائع
import Wallet from './pages/Wallet';
import MainDashboard from './pages/MainDashboard';
import OfflineProd from './components/commun/OfflineProd'; // الصفحة الرئيسية العامة
import Register from './components/commun/Register';
import Login from './components/commun/Login';
import UserProfilePage from './pages/UserProfilePage'; // لعرض بروفايل مستخدم آخر
import Sidebar from './components/layout/Sidebar';
import AdminPaymentMethods from './components/admin/AdminPaymentMethods';
import AdminTransactionRequests from './components/admin/AdminTransactionRequests'; // للودائع/السحوبات
import CommandsListVendor from './components/vendor/CommandsListVendor'; // صفحة البائع (My Accounts & Bids)
// import AssignMediatorRequests from './components/admin/AssignMediatorRequests'; // يبدو أن هذا لم يعد مستخدماً بشكل مباشر كصفحة
import ReviewMediatorApplications from './components/admin/ReviewMediatorApplications'; // للأدمن لمراجعة طلبات الوسطاء
import MediatorDashboardPage from './pages/MediatorDashboardPage'; // لوحة تحكم الوسيط
import MyMediationRequestsPage from './pages/MyMediationRequestsPage'; // طلبات الوساطة للمشتري
import MediationChatPage from './pages/MediationChatPage'; // --- صفحة المحادثة الجديدة ---

// --- استيراد ملفات CSS ---
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './components/layout/Sidebar.css';
import './pages/MainDashboard.css';
// يمكنك إضافة CSS خاص بـ MediationChatPage.css إذا أنشأته

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8000";

// --- مكون مساعد: مسار محمي يتطلب تسجيل الدخول ---
const ProtectedRoute = ({ children, requiredRole, isMediatorRoute = false }) => {
  const location = useLocation();
  const { isAuth, user } = useSelector(state => state.userReducer);
  const allowedBlockedPaths = ['/dashboard/profile', '/dashboard/support'];

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.blocked) {
    if (allowedBlockedPaths.includes(location.pathname)) {
      return children;
    }
    return <Navigate to="/dashboard/profile" replace />;
  }

  // التحقق من الدور المطلوب (إذا تم تحديده)
  if (requiredRole && user?.userRole !== requiredRole) {
    toast.error("You do not have permission to access this page.");
    return <Navigate to="/dashboard" replace />;
  }

  // التحقق من تأهيل الوسيط (إذا كان المسار يتطلب ذلك)
  if (isMediatorRoute && !user?.isMediatorQualified) {
    toast.error("You are not qualified as a mediator to access this page.");
    return <Navigate to="/dashboard/profile" replace />; // أو لصفحة "أنت لست وسيط"
  }

  return children;
};


// --- مكون مساعد: عرض تحذير للمستخدم المحظور ---
const BlockedWarning = ({ isAuth, user }) => {
  // ... (نفس الكود الذي قدمته، لا حاجة لتغييره)
  const dispatch = useDispatch();
  const handleLogoutClick = (e) => { /* ... */ };
  if (!isAuth || !user?.blocked) return null;
  return (<Alert variant="danger" className="blocked-warning-banner m-3"> {/* ... */} </Alert>);
};

function App() {
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const { isAuth, authChecked, user, loading } = useSelector(state => state.userReducer);
  const token = localStorage.getItem('token');
  const socketRef = useRef(null); // استخدم useRef لتخزين مرجع الـ socket

  useEffect(() => {
    if (token && !authChecked && !loading) {
      console.log("App Effect (Mount/Auth Check): Calling getProfile...");
      dispatch(getProfile());
    } else if (!token && !authChecked) {
      dispatch({ type: 'AUTH_CHECK_COMPLETE' });
    }
  }, [dispatch, token, authChecked, loading]);

  useEffect(() => {
    if (isAuth && user?._id) {
      if (!socketRef.current || !socketRef.current.connected) {
        console.log("App Effect (Socket): Setting up Socket.IO connection...");
        socketRef.current = io(SOCKET_SERVER_URL, {
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          // query: { token: localStorage.getItem('token') } // يمكنك تفعيل هذا إذا كان الـ backend يتوقعه
        });

        socketRef.current.on('connect', () => {
          console.log('Socket connected:', socketRef.current.id);
          socketRef.current.emit('addUser', user._id); // استخدم 'addUser' كما في server.js
        });

        socketRef.current.on('new_notification', (notification) => {
          console.log('Socket event received: new_notification', notification);
          toast.info(`🔔 ${notification.title || 'New Notification!'}`, { /* ...toast options... */ });
          dispatch({ type: 'ADD_NOTIFICATION_REALTIME', payload: notification }); // افترض أن لديك هذا النوع في notificationReducer
        });

        // --- مستمع لرسائل المحادثة الجديدة (إذا أردت تحديثاً فورياً خارج صفحة المحادثة) ---
        // socketRef.current.on('newMediationMessage', (message) => {
        //   console.log('Global: New mediation message received via socket:', message);
        //   // يمكنك عرض تنبيه toast أو تحديث شارة الرسائل غير المقروءة
        //   if (message.sender?._id !== user?._id) { // لا تعرض toast لرسائلك الخاصة
        //      toast.success(`New chat message in mediation: ${message.mediationRequestId}`, { autoClose: 3000});
        //   }
        //   // يمكنك عمل dispatch لـ action يضيف الرسالة إلى مخزن عام للرسائل غير المقروءة
        // });
        // --------------------------------------------------------------------------------

        socketRef.current.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
        socketRef.current.on('connect_error', (err) => console.error('Socket connection error:', err.message));
      }
    } else {
      if (socketRef.current && socketRef.current.connected) {
        console.log("App Effect (Socket): User logged out. Disconnecting Socket.IO...");
        socketRef.current.disconnect();
      }
    }
    return () => {
      if (socketRef.current) {
        console.log("App Cleanup: Disconnecting Socket.IO and removing listeners...");
        socketRef.current.off('connect');
        socketRef.current.off('new_notification');
        // socketRef.current.off('newMediationMessage'); // إذا أضفته
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.disconnect();
      }
    };
  }, [isAuth, user?._id, dispatch]);

  if (!authChecked && token) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
        <Spinner animation="border" variant="primary" role="status"><span className="visually-hidden">Loading...</span></Spinner>
        <span className="ms-3 text-muted">Loading session...</span>
      </div>
    );
  }

  const handleSearchChange = (newSearchTerm) => setSearch(newSearchTerm);

  return (
    // تم إزالة <Router> من هنا لأنها يجب أن تكون في index.js أو أعلى مستوى
    <div className={`app-container ${isAuth ? 'layout-authenticated' : 'layout-public'}`}>
      <ToastContainer position="top-center" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      {isAuth && <Sidebar onSearchChange={handleSearchChange} />}
      <main className={`main-content-area flex-grow-1 ${isAuth ? 'content-authenticated' : 'content-public'}`}>
        <BlockedWarning isAuth={isAuth} user={user} />
        <Routes>
          <Route path="/login" element={!isAuth ? <Login /> : <Navigate to="/dashboard" replace />} />
          <Route path="/register" element={!isAuth ? <Register /> : <Navigate to="/dashboard" replace />} />
          <Route path="/" element={<OfflineProd />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/dashboard/comptes" element={<ProtectedRoute requiredRole="Vendor"><Comptes /></ProtectedRoute>} /> {/* صفحة البائع لإضافة منتجاته */}
          <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/my-mediation-requests" element={<ProtectedRoute><MyMediationRequestsPage /></ProtectedRoute>} /> {/* للمشتري */}
          {/* <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />  // إذا كانت MyOrdersPage مختلفة */}


          {/* Vendor Specific Routes */}
          <Route path="/dashboard/comptes_bids" element={<ProtectedRoute requiredRole="Vendor"><CommandsListVendor search={search} /></ProtectedRoute>} />

          {/* Admin Specific Routes */}
          <Route path="/dashboard/admin/products" element={<ProtectedRoute requiredRole="Admin"><ProductListAdmin search={search} /></ProtectedRoute>} />
          <Route path="/dashboard/admin/users" element={<ProtectedRoute requiredRole="Admin"><UserListAd search={search} /></ProtectedRoute>} />
          <Route path="/dashboard/admin/deposits" element={<ProtectedRoute requiredRole="Admin"><AdminTransactionRequests type="deposits" search={search} /></ProtectedRoute>} />
          <Route path="/dashboard/admin/withdrawals" element={<ProtectedRoute requiredRole="Admin"><AdminTransactionRequests type="withdrawals" search={search} /></ProtectedRoute>} />
          <Route path="/dashboard/admin/mediator-review" element={<ProtectedRoute requiredRole="Admin"><ReviewMediatorApplications search={search} /></ProtectedRoute>} />
          <Route path="/dashboard/admin/payment-methods" element={<ProtectedRoute requiredRole="Admin"><AdminPaymentMethods search={search} /></ProtectedRoute>} />

          {/* Mediator Specific Routes */}
          <Route path="/dashboard/mediator/assignments" element={
            <ProtectedRoute isMediatorRoute={true}> {/* Check if user is qualified mediator */}
              <MediatorDashboardPage />
            </ProtectedRoute>
          } />
          {/* --- NEW ROUTE FOR MEDIATION CHAT --- */}
          <Route
            path="/dashboard/mediation-chat/:mediationRequestId"
            element={<ProtectedRoute><MediationChatPage /></ProtectedRoute>}
          // يمكن إضافة isMediatorRoute={true} هنا أيضاً إذا أردت أن يصل إليها الوسطاء فقط
          // أو يمكنك جعلها متاحة للبائع والمشتري والوسيط (التحقق من الصلاحية داخل المكون)
          />
          {/* ------------------------------------ */}

          <Route path="/profile/:userId" element={<UserProfilePage />} /> {/* Public profile */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;