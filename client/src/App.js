// src/App.js
import React, { useState, useEffect, useRef, createContext } from 'react'; // useContext لم يعد مستخدماً هنا مباشرة
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import io from 'socket.io-client';
import { getProfile, setOnlineUsers, updateUserBalances, logoutUser } from './redux/actions/userAction'; // logoutUser مضاف
import { Alert, Spinner, Button } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import NotFound from './pages/NotFound';
import UserListAd from './components/admin/UserListAd';
import ProductListAdmin from './components/admin/ProductListAdmin';
import NotificationsPage from './pages/NotificationsPage';
import Support from './pages/Support';
import Profile from './components/commun/Profile';
import Comptes from './pages/Comptes';
import Wallet from './pages/Wallet';
import MainDashboard from './pages/MainDashboard';
import OfflineProd from './components/commun/OfflineProd';
import Register from './components/commun/Register';
import Login from './components/commun/Login';
import UserProfilePage from './pages/UserProfilePage';
import Sidebar from './components/layout/Sidebar';
import AdminPaymentMethods from './components/admin/AdminPaymentMethods';
import AdminTransactionRequests from './components/admin/AdminTransactionRequests';
import CommandsListVendor from './components/vendor/CommandsListVendor';
import ReviewMediatorApplications from './components/admin/ReviewMediatorApplications';
import MediatorDashboardPage from './pages/MediatorDashboardPage';
import MyMediationRequestsPage from './pages/MyMediationRequestsPage';
import MediationChatPage from './pages/MediationChatPage';
import MediationsListPage from './pages/MediationsListPage';
import AdminDisputesPage from './components/admin/AdminDisputesPage';
import AdminReportsPage from './components/admin/AdminReportsPage';
import { updateUnreadCountFromSocket } from './redux/actions/mediationAction';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './components/layout/Sidebar.css';
import './pages/MainDashboard.css';
import { FaComments } from 'react-icons/fa';
import { getTransactionsForDashboard } from './redux/actions/transactionAction';
import { clearNotifications } from './redux/actions/notificationAction'; // افترض وجود هذا الـ action
import { clearTransactions as clearWalletTransactions } from './redux/actions/transactionAction'; // افترض وجود هذا الـ action

export const SocketContext = createContext(null);
const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8000";

const ProtectedRoute = ({ children, requiredRole, isMediatorRoute = false }) => {
  const location = useLocation();
  const { isAuth, user, loading: userLoading, authChecked } = useSelector(state => state.userReducer);

  // إذا لم يتم فحص المصادقة بعد، أو إذا كان التحميل جاريًا، اعرض شاشة تحميل
  if (!authChecked || userLoading) {
    console.log("[ProtectedRoute] Auth not checked or user loading. Displaying spinner.");
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Loading session...</span>
        </Spinner>
      </div>
    );
  }

  if (!isAuth) {
    console.log("[ProtectedRoute] Not authenticated. Navigating to login.");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // إذا isAuth صحيحة ولكن user لا يزال null (قد يحدث هذا إذا فشل getProfile بعد تسجيل الدخول)
  // أو إذا كان user موجودًا ولكنه محظور.
  if (!user) {
    console.warn("[ProtectedRoute] Authenticated but no user object. This might indicate an issue or a race condition. Navigating to login as a fallback.");
    // يمكن إضافة dispatch لـ logout هنا إذا كان هذا السيناريو يشير إلى جلسة تالفة
    // dispatch(logoutUser()); // فكر في هذا بعناية
    return <Navigate to="/login" state={{ from: location }} replace />;
  }


  if (user.blocked) {
    const allowedBlockedPaths = ['/dashboard/profile', '/dashboard/support'];
    if (allowedBlockedPaths.includes(location.pathname)) {
      console.log("[ProtectedRoute] User blocked but accessing allowed path:", location.pathname);
      return children;
    }
    console.log("[ProtectedRoute] User blocked. Navigating to profile.");
    toast.warn("Your account is blocked. Access is restricted.", { autoClose: 5000 });
    return <Navigate to="/dashboard/profile" replace />;
  }

  if (requiredRole && user.userRole !== requiredRole) {
    toast.error("You do not have permission to access this page.");
    console.log("[ProtectedRoute] Role mismatch. Navigating to dashboard.");
    return <Navigate to="/dashboard" replace />;
  }

  if (isMediatorRoute && !user.isMediatorQualified) {
    toast.error("You are not qualified as a mediator to access this page.");
    console.log("[ProtectedRoute] Not mediator qualified. Navigating to profile.");
    return <Navigate to="/dashboard/profile" replace />;
  }
  console.log("[ProtectedRoute] Access granted for path:", location.pathname);
  return children;
};

const BlockedWarning = ({ isAuth, user }) => {
  const dispatch = useDispatch();
  const handleLogoutClick = (e) => {
    e.preventDefault();
    dispatch(logoutUser()); // استخدم action creator
    // navigate('/login'); // إعادة التوجيه ستتم تلقائيًا بسبب تغيير حالة isAuth
  };

  if (!isAuth || !user || !user.blocked) return null;

  return (
    <Alert variant="danger" className="blocked-warning-banner m-3">
      <Alert.Heading>Account Suspended</Alert.Heading>
      Your account is currently blocked. Some features may be unavailable.
      If you believe this is an error, please{' '}
      <Alert.Link as={Link} to="/dashboard/support">contact support</Alert.Link>
      {' OR '}
      <Alert.Link href="#" onClick={handleLogoutClick} style={{ cursor: 'pointer', fontWeight: 'bold' }}>Logout</Alert.Link>
    </Alert>
  );
};

function App() {
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const {
    isAuth,
    authChecked,
    user,
    loading: userLoading,
    error: userError
  } = useSelector(state => state.userReducer);

  const currentUserId = user?._id; // استخدم هذا للاعتماديات لتجنب إعادة التشغيل غير الضرورية
  const socketRef = useRef(null);

  // Effect للتحقق من المصادقة الأولية عند تحميل التطبيق
  useEffect(() => {
    const localToken = localStorage.getItem('token');
    console.log('[App Auth Effect] Initial check - Token:', !!localToken, 'User:', !!user, 'Loading:', userLoading, 'AuthChecked:', authChecked, 'UserError:', userError);

    if (!authChecked) { // فقط إذا لم يتم فحص المصادقة بعد
      if (localToken && !user && !userLoading) { // إذا كان هناك توكن، ولم يتم تحميل المستخدم، والتحميل ليس جاريًا
        console.log('[App Auth Effect] Token exists, user not loaded, not loading. Calling getProfile.');
        dispatch(getProfile());
      } else if (!localToken) { // إذا لم يكن هناك توكن
        console.log('[App Auth Effect] No token. Marking auth as checked, user is not auth.');
        dispatch({ type: 'AUTH_CHECK_COMPLETE' }); // يجب أن يضبط isAuth=false إذا لم يكن هناك توكن
        dispatch({ type: 'LOGOUT_NO_TOKEN_ON_LOAD' }); // نوع جديد في reducer لضمان isAuth=false, user=null
      } else if (user || userLoading) { // إذا كان المستخدم موجودًا بالفعل أو التحميل جاري
        console.log('[App Auth Effect] User already loaded or loading in progress. Marking auth as checked.');
        // لا تفعل شيئًا هنا بشأن getProfile، فهو إما تم أو قيد التنفيذ.
        // لكن يجب أن نتأكد أن authChecked تصبح true
        if (!authChecked) dispatch({ type: 'AUTH_CHECK_COMPLETE' });
      }
    }
  }, [dispatch, authChecked, user, userLoading]); // userError أزيل من هنا لأنه قد يسبب حلقات إذا كان الخطأ مؤقتًا

  // Effect لإدارة اتصال Socket.IO
  useEffect(() => {
    if (isAuth && currentUserId) { // استخدم currentUserId هنا
      if (!socketRef.current || !socketRef.current.connected) {
        console.log("[App.js Socket Effect] Setting up NEW Socket.IO connection for user:", currentUserId);
        socketRef.current = io(SOCKET_SERVER_URL, {
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          auth: { token: localStorage.getItem("token") } // أرسل التوكن للمصادقة على الـ socket إذا لزم الأمر
        });

        socketRef.current.on("connect", () => {
          console.log("[App.js Socket] Connected to socket server with ID:", socketRef.current.id);
          socketRef.current.emit("addUser", currentUserId); // currentUserId بدلاً من user._id
        });

        socketRef.current.on('onlineUsersListUpdated', (onlineUserIdsFromServer) => {
          console.log('[App.js Socket] Received "onlineUsersListUpdated":', onlineUserIdsFromServer);
          if (Array.isArray(onlineUserIdsFromServer)) {
            dispatch(setOnlineUsers(onlineUserIdsFromServer));
          } else {
            console.warn('[App.js Socket] "onlineUsersListUpdated" did not receive an array:', onlineUserIdsFromServer);
          }
        });

        socketRef.current.on('user_balances_updated', (newBalances) => {
          console.log('[App.js Socket] Received "user_balances_updated":', newBalances);
          if (newBalances && currentUserId && newBalances._id === currentUserId) {
            dispatch(updateUserBalances({
              balance: newBalances.balance,
              sellerAvailableBalance: newBalances.sellerAvailableBalance,
              sellerPendingBalance: newBalances.sellerPendingBalance,
            }));
            // اختياري: يمكنك أيضًا إعادة جلب getProfile إذا كانت الأرصدة جزءًا هامًا منه ويجب أن تكون متزامنة تمامًا
            // dispatch(getProfile()); // كن حذرًا من الحلقات إذا كان getProfile يطلق هذا الحدث!
          }
        });

        socketRef.current.on('dashboard_transactions_updated', (data) => { // قد يحتوي data على تفاصيل
          console.log("[App.js Socket] Received 'dashboard_transactions_updated'. Refetching dashboard transactions.", data);
          dispatch(getTransactionsForDashboard());
          // لا تستدعي getProfile هنا إلا إذا كان ضروريًا للغاية وتأكدت أنه لا يسبب حلقة
        });

        socketRef.current.on('new_notification', (notification) => {
          console.log('[App.js Socket] Received "new_notification":', notification);
          toast.info(`🔔 ${notification.title || 'New Notification!'}`, { position: "top-right", autoClose: 3000 });
          dispatch({ type: 'ADD_NOTIFICATION_REALTIME', payload: notification });
          // يمكنك أيضًا استدعاء getNotifications() لتحديث القائمة الكاملة إذا لزم الأمر
          // dispatch(getNotifications());
        });

        socketRef.current.on('update_unread_summary', (data) => {
          console.log('[App.js Socket] Received "update_unread_summary":', data);
          const currentPath = window.location.pathname;
          if (currentPath === `/dashboard/mediation-chat/${data.mediationId}`) {
            console.log(`[App.js Socket] User is currently in chat for mediation ${data.mediationId}. Skipping global unread update.`);
            return;
          }
          toast.info(
            <div>
              <FaComments className="me-2" />
              New message in chat: <strong>{data.productTitle || data.mediationId}</strong>
              {data.otherPartyForRecipient?.fullName && (
                <div className="small text-muted">From: {data.otherPartyForRecipient.fullName}</div>
              )}
            </div>,
            { position: "bottom-right", autoClose: 4000 }
          );
          dispatch(updateUnreadCountFromSocket(data.mediationId, data.newUnreadCount));
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('[App.js Socket] Disconnected:', reason);
          // يمكنك محاولة إعادة الاتصال هنا إذا كان السبب "io server disconnect" وكنت لا تزال مصادقًا
          // if (reason === 'io server disconnect' && store.getState().userReducer.isAuth) {
          //   socketRef.current.connect();
          // }
        });
        socketRef.current.on('connect_error', (err) => {
          console.error('[App.js Socket] Connection Error:', err.message);
          if (err.message === 'Invalid token' || err.message.includes('unauthorized')) { // افترض أن الخادم يرسل هذا
            dispatch(logoutUser()); // إذا فشل اتصال الـ socket بسبب التوكن
          }
        });
      }
    } else { // إذا لم يكن المستخدم مصادقًا عليه أو لا يوجد currentUserId
      if (socketRef.current && socketRef.current.connected) {
        console.log("[App.js Socket Effect] User logged out or ID missing. Disconnecting Socket.IO.");
        socketRef.current.off('onlineUsersListUpdated'); // أزل المستمعين قبل قطع الاتصال
        socketRef.current.off('user_balances_updated');
        socketRef.current.off('dashboard_transactions_updated');
        socketRef.current.off('new_notification');
        socketRef.current.off('update_unread_summary');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }

    // دالة التنظيف: تُشغَّل فقط عند تغيير isAuth أو currentUserId أو عند إلغاء تحميل App.js
    return () => {
      if (socketRef.current) {
        console.log("[App.js Cleanup for Socket Effect] User state changed. Cleaning up socket listeners and potentially disconnecting for ID:", currentUserId);
        socketRef.current.off('onlineUsersListUpdated');
        socketRef.current.off('user_balances_updated');
        socketRef.current.off('dashboard_transactions_updated');
        socketRef.current.off('new_notification');
        socketRef.current.off('update_unread_summary');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        // لا تفصل الاتصال هنا إذا كنت تريد الحفاظ عليه طالما بقيت isAuth و currentUserId كما هي
        // ولكن بما أن هذا الـ cleanup يُشغَّل عند تغيير isAuth أو currentUserId،
        // فمن المنطقي قطع الاتصال وإعادة إنشائه بالكامل.
        if (socketRef.current.connected) {
          socketRef.current.disconnect();
        }
        socketRef.current = null;
      }
    };
  }, [isAuth, currentUserId, dispatch]); // الاعتماديات الرئيسية لجلسة الـ socket

  // --- شاشة التحميل الأولية ---
  // إذا لم يتم فحص المصادقة بعد، والتوكن موجود، والتحميل لم يبدأ بعد (لتجنب عرضها إذا كان getProfile قد بدأ بالفعل)
  const localTokenExistsForLoadingCheck = !!localStorage.getItem('token');
  if (!authChecked && (userLoading || (localTokenExistsForLoadingCheck && !user && !userError))) {
    console.log('[App Render] Showing initial loading screen. AuthChecked:', authChecked, 'UserLoading:', userLoading, 'TokenExists:', localTokenExistsForLoadingCheck, 'User:', !!user);
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <span className="ms-3 text-muted">Loading session...</span>
      </div>
    );
  }

  // --- التعامل مع خطأ المصادقة بسبب توكن غير صالح ---
  if (authChecked && !isAuth && userError && localTokenExistsForLoadingCheck) {
    console.warn('[App Render] Auth checked, NOT authenticated, userError present, and localToken exists. Likely invalid token. Clearing token and offering login.');
    // لا تقم بإزالة التوكن هنا، دع getProfile أو Login يفعل ذلك إذا لزم الأمر
    // localStorage.removeItem('token'); // هذا قد يكون مبكرًا جدًا
    // dispatch({ type: 'LOGOUT' }); // دع getProfile_fail يقوم بذلك
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light flex-column p-3">
        <Alert variant="danger" className="text-center">
          {userError === "Session expired or invalid. Please login again."
            ? userError
            : "Your session may have expired or there was an issue. Please log in again."}
        </Alert>
        <Button as={Link} to="/login" variant="primary" onClick={() => {
          // التأكد من تنظيف الحالة عند الانتقال إلى تسجيل الدخول في هذه الحالة
          dispatch(logoutUser());
        }}>
          Go to Login
        </Button>
      </div>
    );
  }
  // --- نهاية التعامل مع خطأ المصادقة ---

  const handleSearchChange = (newSearchTerm) => setSearch(newSearchTerm);

  return (
    <SocketContext.Provider value={socketRef.current}>
      <div className={`app-container ${isAuth && user ? 'layout-authenticated' : 'layout-public'}`}>
        <ToastContainer position="top-center" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
        {isAuth && user && <Sidebar onSearchChange={handleSearchChange} />} {/* تأكد من وجود user */}
        <main className={`main-content-area flex-grow-1 ${isAuth && user ? 'content-authenticated' : 'content-public'}`}>
          {isAuth && user && <BlockedWarning isAuth={isAuth} user={user} />} {/* تأكد من وجود user */}
          <Routes>
            <Route path="/login" element={!isAuth || !user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/register" element={!isAuth || !user ? <Register /> : <Navigate to="/dashboard" replace />} />
            <Route path="/" element={<OfflineProd />} />

            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/dashboard/comptes" element={<ProtectedRoute requiredRole="Vendor"><Comptes /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/dashboard/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/my-mediation-requests" element={<ProtectedRoute><MyMediationRequestsPage /></ProtectedRoute>} />
            <Route path="/dashboard/mediations" element={<ProtectedRoute><MediationsListPage /></ProtectedRoute>} />
            <Route path="/dashboard/comptes_bids" element={<ProtectedRoute requiredRole="Vendor"><CommandsListVendor search={search} /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/dashboard/admin/products" element={<ProtectedRoute requiredRole="Admin"><ProductListAdmin search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/users" element={<ProtectedRoute requiredRole="Admin"><UserListAd search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/deposits" element={<ProtectedRoute requiredRole="Admin"><AdminTransactionRequests type="deposits" search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/withdrawals" element={<ProtectedRoute requiredRole="Admin"><AdminTransactionRequests type="withdrawals" search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/mediator-review" element={<ProtectedRoute requiredRole="Admin"><ReviewMediatorApplications search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/payment-methods" element={<ProtectedRoute requiredRole="Admin"><AdminPaymentMethods search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/disputes" element={<ProtectedRoute requiredRole="Admin"><AdminDisputesPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/reports" element={<ProtectedRoute requiredRole="Admin"><AdminReportsPage /></ProtectedRoute>} />

            {/* Mediator Routes */}
            <Route path="/dashboard/mediator/assignments" element={<ProtectedRoute isMediatorRoute={true}><MediatorDashboardPage /></ProtectedRoute>} />

            {/* Shared Protected Routes */}
            <Route path="/dashboard/mediation-chat/:mediationRequestId" element={<ProtectedRoute><MediationChatPage /></ProtectedRoute>} />

            {/* Public Profile (if needed, or make it protected) */}
            <Route path="/profile/:userId" element={<UserProfilePage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </SocketContext.Provider>
  );
}

export default App;