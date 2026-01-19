// src/App.js
import React, { useState, useEffect, useRef, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { getProfile, setOnlineUsers, logoutUser, clearUserErrors } from './redux/actions/userAction';
import { Alert, Spinner, Button } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import i18n from './i18n';

import RateLimitExceededPage from './pages/RateLimitExceededPage';
import NotFound from './pages/NotFound';
import UserListAd from './components/admin/UserListAd';
import ProductListAdmin from './components/admin/ProductListAdmin';
import NotificationsPage from './pages/NotificationsPage';
import Profile from './components/commun/Profile';
import Comptes from './pages/Comptes';
import Wallet from './pages/Wallet';
import MainDashboard from './pages/MainDashboard';
import NewsPage from './pages/NewsPage';
import AdminNewsManagement from './components/admin/AdminNewsManagement';
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
import { getTransactionsForDashboard, getTransactions } from './redux/actions/transactionAction';
import CreateTicketPage from './pages/CreateTicketPage';
import TicketDetailsPage from './pages/TicketDetailsPage';
import UserTicketsListPage from './pages/UserTicketsListPage';
import AdminTicketsDashboardPage from './components/admin/AdminTicketsDashboardPage';
import { getUserWithdrawalRequests } from './redux/actions/withdrawalRequestAction';
import { getUserDepositRequests } from './redux/actions/depositAction';
import { getBuyerMediationRequestsAction, updateUnreadCountFromSocket, handleNewAdminSubChatMessageSocket, adminGetDisputedMediationsAction, updateMediationDetailsFromSocket } from './redux/actions/mediationAction';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './components/layout/Sidebar.css';
import './pages/MainDashboard.css';
import FAQPage from './pages/FAQPage';
import AdminFAQManagement from './components/admin/AdminFAQManagement';
import axios from 'axios';
import { getActiveFAQs } from './redux/actions/faqAction';
import { getNews } from './redux/actions/newsAction';
import AdminAchievementsManagement from './components/admin/AdminAchievementsManagement';
import UserAchievementsPage from './pages/UserAchievementsPage';
import { adminGetAllAchievements, getAvailableAchievements } from './redux/actions/achievementAction';
import { addNotificationFromSocket } from './redux/actions/notificationAction';
import LeaderboardPage from './pages/LeaderboardPage';
import { getLeaderboards } from './redux/actions/leaderboardAction';
import ReferralsPage from './pages/ReferralsPage';
import AdminReferralSettings from './components/admin/AdminReferralSettings';
import { addNewReferralFromSocket } from './redux/actions/referralAction';
import { getReferralStats } from './redux/actions/referralAction';
import WishlistPage from './pages/WishlistPage';
import LuckyWheelPage from './pages/LuckyWheelPage';
import QuestsPage from './pages/QuestsPage';
import AdminQuestManagement from './components/admin/AdminQuestManagement';
import { getUserQuests, adminGetAllQuests } from './redux/actions/questAction';
import AdminCheckInSettings from './components/admin/AdminCheckInSettings';
import AdminWheelSettings from './components/admin/AdminWheelSettings';
import ErrorBoundary from './components/commun/ErrorBoundary';
import GlobalChatPage from './pages/GlobalChatPage';
import TournamentsListPage from './pages/TournamentsListPage'; // سننشئه لاحقاً
import TournamentDetailsPage from './pages/TournamentDetailsPage'; // سننشئه لاحقاً
import CreateTournamentPage from './pages/CreateTournamentPage'; // سننشئه لاحقاً
import MatchRoomPage from './pages/MatchRoomPage'; // سننشئه لاحقاً
import AdminLeaguesPage from './components/admin/AdminLeaguesPage';

export const SocketContext = createContext(null);
const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8000";

const AppWrapper = () => (
  <ErrorBoundary>
    <Router>
      <App />
    </Router>
  </ErrorBoundary>
);

const RedirectWithToast = ({ to, messageKey }) => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    // استخدم toastId لمنع تكرار نفس الرسالة إذا حدث إعادة تصيير سريع
    toast.warn(t(messageKey), { toastId: 'account-blocked-toast' });
  }, [t, messageKey]); // سيعمل هذا مرة واحدة فقط عند عرض المكون

  return <Navigate to={to} state={{ from: location }} replace />;
};

const ProtectedRoute = ({ children, requiredRole, isMediatorRoute = false }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isAuth = useSelector(state => state.userReducer.isAuth);
  const user = useSelector(state => state.userReducer.user);
  const userLoading = useSelector(state => state.userReducer.loading);
  const authChecked = useSelector(state => state.userReducer.authChecked);

  if (!authChecked || userLoading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">{t('app.loadingSession', 'Loading session...')}</span>
        </Spinner>
      </div>
    );
  }

  if (!isAuth || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.blocked) {
    const allowedBlockedPaths = ['/dashboard/profile', '/dashboard/support', '/dashboard/tickets', '/dashboard/support/tickets/:ticketId'];
    const isAllowed = allowedBlockedPaths.some(p => location.pathname.startsWith(p.replace(/:ticketId/, '')));

    if (isAllowed) {
      return children;
    }

    // استخدم المكون الجديد بدلاً من استدعاء toast و Navigate مباشرة
    return <RedirectWithToast to="/dashboard/profile" messageKey="auth.toast.accountBlocked" />;
  }

  if (requiredRole && user.userRole !== requiredRole) {
    toast.error(t('app.noPermission'));
    return <Navigate to="/dashboard" replace />;
  }

  if (isMediatorRoute && !user.isMediatorQualified) {
    toast.error(t('app.notQualifiedMediator'));
    return <Navigate to="/dashboard/profile" replace />;
  }
  return children;
};

const BlockedWarning = ({ isAuth, user }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const handleLogoutClick = (e) => {
    e.preventDefault();
    dispatch(logoutUser());
  };

  if (!isAuth || !user || !user.blocked) return null;

  return (
    <Alert variant="danger" className="blocked-warning-banner m-3">
      <Alert.Heading>{t('app.blockedWarning.title')}</Alert.Heading>
      {t('app.blockedWarning.body')}
      <Alert.Link as={Link} to="/dashboard/tickets">{t('app.blockedWarning.contactSupport')}</Alert.Link>
      {t('app.blockedWarning.orSeparator')}
      <Alert.Link href="#" onClick={handleLogoutClick} style={{ cursor: 'pointer', fontWeight: 'bold' }}>{t('app.blockedWarning.logout')}</Alert.Link>
    </Alert>
  );
};

const CustomToastContainer = () => {
  const { i18n } = useTranslation();
  return <ToastContainer position="top-center" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick rtl={i18n.dir() === 'rtl'} pauseOnFocusLoss draggable pauseOnHover theme="colored" />;
};

function App() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();

  // --- THIS IS THE FIX: Use individual selectors to prevent re-render loops ---
  const errors = useSelector(state => state.userReducer.errors);
  const successMessage = useSelector(state => state.userReducer.successMessage);
  const successMessageParams = useSelector(state => state.userReducer.successMessageParams);
  const errorFromAPI = useSelector(state => state.userReducer.errorMessage);
  const isAuth = useSelector(state => state.userReducer.isAuth);
  const user = useSelector(state => state.userReducer.user);
  const authChecked = useSelector(state => state.userReducer.authChecked);
  const userLoading = useSelector(state => state.userReducer.loading);
  const userError = useSelector(state => state.userReducer.userError);
  // --- END OF FIX ---

  const currentUserId = user?._id;
  const socketRef = useRef(null);

  useEffect(() => {
    // عرض رسائل النجاح
    if (successMessage) {
      toast.success(t(successMessage, successMessageParams));
      dispatch({ type: 'CLEAR_USER_MESSAGES' });
    }

    // عرض رسائل الخطأ
    if (errorFromAPI) {
      let messageText = "An unknown error occurred";

      // التحقق مما إذا كان الخطأ كائناً يحتوي على مفتاح ترجمة
      if (typeof errorFromAPI === 'object' && errorFromAPI !== null) {
        if (errorFromAPI.key) {
          const fallback = errorFromAPI.fallback || t("apiErrors.unknownError");
          messageText = t(errorFromAPI.key, { ...errorFromAPI.params, defaultValue: fallback });
        } else if (errorFromAPI.errorMessage) {
          // حالة خاصة: إذا كان الكائن متداخلاً { errorMessage: "..." }
          messageText = typeof errorFromAPI.errorMessage === 'string'
            ? errorFromAPI.errorMessage
            : JSON.stringify(errorFromAPI.errorMessage);
        } else {
          // حماية أخيرة: تحويل الكائن لنص لتجنب الكراش
          messageText = JSON.stringify(errorFromAPI);
        }
      } else if (typeof errorFromAPI === 'string') {
        messageText = errorFromAPI;
      }

      toast.error(messageText, { toastId: 'api-error' });
      dispatch(clearUserErrors());
    }

    if (errors) {
      // حماية إضافية هنا أيضاً
      const errorMessageText = typeof errors === 'string'
        ? t(`apiErrors.${errors}`, { defaultValue: errors })
        : t("apiErrors.unknownError");

      toast.error(errorMessageText, { toastId: 'legacy-error' });
      dispatch(clearUserErrors());
    }
  }, [successMessage, errorFromAPI, errors, dispatch, t, successMessageParams]);

  useEffect(() => {
    const localToken = localStorage.getItem('token');
    if (!authChecked) {
      if (localToken && !user && !userLoading) {
        dispatch(getProfile());
      } else if (!localToken) {
        dispatch({ type: 'AUTH_CHECK_COMPLETE' });
        dispatch({ type: 'LOGOUT_NO_TOKEN_ON_LOAD' });
      } else if (user || userLoading) {
        if (!authChecked) dispatch({ type: 'AUTH_CHECK_COMPLETE' });
      }
    }
  }, [dispatch, authChecked, user, userLoading]);

  useEffect(() => {
    // إنشاء الاتصال دائمًا عند تحميل المكون لأول مرة
    const newSocket = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: (cb) => {
        const token = localStorage.getItem("token");
        cb({ token: token });
      }
    });
    socketRef.current = newSocket;

    // التعامل مع أحداث الاتصال والفصل
    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      // فقط إذا كان المستخدم مسجلاً، أرسل بياناته للخادم
      if (isAuth && currentUserId) {
        newSocket.emit("addUser", currentUserId);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error("Socket connection error:", err.message);
      // إذا كان الخطأ بسبب عدم صلاحية التوكن، قم بتسجيل الخروج
      if (err.message.includes('unauthorized')) {
        dispatch(logoutUser());
      }
    });

    // --- تسجيل المستمعين للأحداث العامة (للجميع، مسجلين وزوار) ---
    newSocket.on('product_updated', (updatedProduct) => {
      console.log('[Socket] Received product_updated:', updatedProduct?._id);
      if (updatedProduct?._id) {
        dispatch({ type: 'UPDATE_SINGLE_PRODUCT_IN_STORE', payload: updatedProduct });
      }
    });

    newSocket.on('user_avatar_changed', (data) => {
      console.log("--- [1] App.js: 'user_avatar_changed' event received ---", data); // [!] أضف هذا
      if (data.userId && data.newAvatarUrl) {
        dispatch({ type: 'UPDATE_BIDDER_AVATAR_IN_PRODUCTS', payload: data });
      }
    });

    newSocket.on('product_deleted', (data) => {
      console.log('[Socket] Received product_deleted:', data?.productId);
      if (data?.productId) {
        dispatch({ type: 'DELETE_PRODUCT_SUCCESS', payload: { productId: data.productId } });
      }
    });

    newSocket.on('onlineUsersListUpdated', (onlineUserIdsFromServer) => {
      dispatch(setOnlineUsers(onlineUserIdsFromServer || []));
    });

    // --- تسجيل المستمعين الخاصة بالمستخدم المسجل فقط ---
    if (isAuth && currentUserId) {
      newSocket.on('user_balances_updated', (data) => {
        if (data?._id === currentUserId) {
          dispatch({ type: 'UPDATE_USER_BALANCES_SOCKET', payload: data });
        }
      });

      newSocket.on('tournament_updated', (data) => {
        console.log('[Socket] Tournament Updated:', data);
        dispatch({ type: 'UPDATE_TOURNAMENT_SOCKET', payload: data });
      });

      // 🔔 Admin notification for disputes
      newSocket.on('admin_notification', (data) => {
        console.log('[Socket] Admin Notification:', data);
        if (user?.userRole === 'Admin' && data.type === 'new_dispute') {
          // استخدم النص مباشرة بدلاً من الترجمة لتجنب المشاكل
          const message = `⚠️ نزاع جديد: ${data.player1 || 'لاعب 1'} vs ${data.player2 || 'لاعب 2'} في بطولة "${data.tournamentTitle || 'غير معروف'}"`;
          toast.warning(message, { autoClose: 10000 });
        }
      });

      newSocket.on('dashboard_transactions_updated', () => {
        dispatch(getTransactionsForDashboard());
        dispatch(getTransactions());
        dispatch(getUserWithdrawalRequests());
        dispatch(getUserDepositRequests());
        dispatch(getProfile());
      });

      newSocket.on('user_profile_updated', (data) => {
        if (data?._id === currentUserId) {
          dispatch(getProfile());
        }
      });

      newSocket.on('new_pending_mediator_application', (data) => {
        if (user?.userRole === 'Admin') {
          dispatch({ type: 'ADMIN_ADD_PENDING_MEDIATOR_APPLICATION', payload: data });
        }
      });

      newSocket.on('refresh_mediator_applications_list', () => {
        if (user?.userRole === 'Admin') {
          dispatch({ type: 'ADMIN_REFRESH_MEDIATOR_APPLICATIONS' });
        }
      });

      newSocket.on('new_mediation_request_for_buyer', (data) => {
        if (user?.userRole !== 'Admin') {
          dispatch(getBuyerMediationRequestsAction(1, 10));
        }
      });

      newSocket.on('mediation_request_updated', (data) => {
        if (data?.updatedMediationRequestData?._id) {
          dispatch(updateMediationDetailsFromSocket(data.updatedMediationRequestData));
        }
      });

      newSocket.on('new_assignment_for_mediator', (data) => {
        if (data?.newAssignmentData) {
          dispatch({ type: 'ADD_PENDING_ASSIGNMENT_FROM_SOCKET', payload: data.newAssignmentData });
        }
      });

      newSocket.on('new_notification', (notification) => {
        // تحقق من وجود عنوان صالح قبل عرض الـ toast
        const translatedTitle = t(notification.title, { ...notification.messageParams, defaultValue: '' });
        const displayTitle = translatedTitle || notification.title || notification.message || '';

        if (displayTitle && displayTitle.trim()) {
          toast.info(`🔔 ${displayTitle}`, { position: "top-right" });
        }
        dispatch(addNotificationFromSocket(notification));
      });

      newSocket.on('dispute_opened_for_admin', () => {
        if (user?.userRole === 'Admin') {
          dispatch(adminGetDisputedMediationsAction(1, 1));
        }
      });

      newSocket.on('update_unread_summary', (data) => {
        if (window.location.pathname !== `/dashboard/mediation-chat/${data.mediationId}`) {
          dispatch(updateUnreadCountFromSocket(data.mediationId, data.newUnreadCount));
        }
      });

      newSocket.on('new_admin_sub_chat_message', (data) => {
        if (data?.message) {
          dispatch(handleNewAdminSubChatMessageSocket(data, currentUserId));
        }
      });

      newSocket.on('new_ticket_created_for_admin', (ticket) => {
        if (user?.userRole === 'Admin' || user?.userRole === 'Support') {
          dispatch({ type: 'ADMIN_ADD_NEW_TICKET_REALTIME', payload: ticket });
        }
      });

      newSocket.on('ticket_updated', (data) => {
        dispatch({ type: 'UPDATE_TICKET_DETAILS_REALTIME', payload: data.updatedTicket });
      });

      newSocket.on('faqs_updated', () => {
        dispatch(getActiveFAQs());
      });

      newSocket.on('news_updated', () => {
        dispatch(getNews()); // استورد getNews من newsAction.js
      });

      newSocket.on('achievement_unlocked', (data) => {
        console.log('[Socket] Received achievement_unlocked:', data.achievement);
        if (data.achievement) {
          // Show a toast notification for the new achievement
          toast.success(`🏆 ${t('achievements.unlockedToast', { name: data.achievement.title[i18n.language] || data.achievement.title.ar })}`);

          // Dispatch an action to update the user's profile in the store
          dispatch({
            type: 'UPDATE_USER_ACHIEVEMENTS_IN_STORE',
            payload: data.achievement
          });
        }
      });

      newSocket.on('achievements_list_updated', () => {
        console.log('[Socket] Received achievements_list_updated, refetching lists.');

        // 1. قم دائمًا بتحديث قائمة الإنجازات المتاحة لجميع المستخدمين
        dispatch(getAvailableAchievements());

        // 2. إذا كان المستخدم الحالي مسؤولاً، قم أيضًا بتحديث قائمة الإدارة الخاصة به
        if (user?.userRole === 'Admin') {
          dispatch(adminGetAllAchievements());
        }
      });

      newSocket.on('leaderboard_updated', () => {
        console.log('[App.js] Received leaderboard_updated signal. Refreshing leaderboard data...');
        // نقوم بتحديث البيانات في الـ Store مباشرة
        dispatch(getLeaderboards());
      });

      newSocket.on('new_referral_joined', (data) => {
        console.log('[Socket] New referral joined:', data);
        // 1. إظهار إشعار Toast (تأكد من إضافة الترجمة)
        toast.success(t('referrals.newReferralJoinedToast', { name: data.fullName, defaultValue: `New referral joined: ${data.fullName}` }));

        // 2. تحديث الـ Redux Store
        dispatch(addNewReferralFromSocket(data));
      });

      newSocket.on('user_balances_updated', (data) => {
        if (data?._id === currentUserId) {
          dispatch({ type: 'UPDATE_USER_BALANCES_SOCKET', payload: data });

          if (data.referralBalance !== undefined) {
            dispatch(getReferralStats());
          }
        }
      });

      newSocket.on('quests_updated', () => {
        // تحديث للمستخدمين (صفحة المهام)
        dispatch(getUserQuests());

        // تحديث للأدمن (صفحة الإدارة)
        if (user?.userRole === 'Admin') {
          dispatch(adminGetAllQuests());
        }
      });

      newSocket.on('quest_completed_toast', (data) => {
        // نختار اللغة المناسبة، أو العربية كخيار بديل
        const currentLang = i18n.language;
        const title = data.questTitle[currentLang] || data.questTitle['ar'] || data.questTitle['en'] || "Quest";

        // عرض الإشعار
        toast.success(`🏆 ${t('quests.completedToast', { title })}`, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        // تحديث القائمة
        dispatch(getUserQuests());
      });

      // مستمع لتحديث إعدادات الجوائز
      newSocket.on('check_in_config_updated', (newRewards) => {
        console.log('[Socket] Check-in config updated:', newRewards);
        // تحديث الريدكس فوراً
        dispatch({ type: 'SET_CHECK_IN_CONFIG', payload: newRewards });
      });

      // [!!!] مستمع لتحديث إعدادات العجلة [!!!]
      newSocket.on('wheel_config_updated', (newSegments) => {
        console.log('[Socket] Wheel config updated:', newSegments);
        // نحتاج لطريقة لتحديث LuckyWheelPage.
        // الخيار الأفضل هو تخزين الإعدادات في Redux (مثل checkIn)
        // لكن للسرعة، سنرسل حدثاً (Event) للمتصفح أو نستخدم Redux.

        // الخيار الأسهل: Redux
        dispatch({ type: 'SET_WHEEL_CONFIG', payload: newSegments });
      });

      newSocket.on('wheel_config_updated', (newSegments) => {
        console.log('[Socket] Wheel config updated:', newSegments);
        // [!!!] تحديث Redux فوراً [!!!]
        dispatch({ type: 'SET_WHEEL_CONFIG', payload: newSegments });
      });

      newSocket.on('quests_updated', () => {
        console.log('[App.js] Received quests_updated signal. Refreshing user quests...');

        // تحديث للمستخدمين (صفحة المهام)
        dispatch(getUserQuests());

        // تحديث للأدمن (صفحة الإدارة) إذا كان المستخدم أدمناً
        if (user?.userRole === 'Admin') {
          dispatch(adminGetAllQuests()); // تأكد من استيراد هذا الأكشن إذا لزم الأمر
        }
      });

      // مستمع خاص بإشعارات التقدم (Progress Update) إذا أردت دقة أكبر
      newSocket.on('quest_progress_updated', (data) => {
        console.log('[App.js] Quest progress updated:', data);
        dispatch(getUserQuests());
      });

      newSocket.on('tournament_participant_joined', (data) => {
        console.log('[Socket] Tournament participant joined:', data);
        dispatch({ type: 'UPDATE_TOURNAMENT_PARTICIPANTS_SOCKET', payload: data });
      });

      newSocket.on('tournament_created', (data) => {
        dispatch({ type: 'ADD_TOURNAMENT_SOCKET', payload: data });
      });

      // [جديد] تحديث الجدول عند انتهاء أي مباراة
      newSocket.on('match_updated', (updatedMatch) => {
        console.log('[Socket App.js] Match Updated:', updatedMatch);
        // dispatch action to update redux matches list directly
        dispatch({ type: 'UPDATE_MATCH_SOCKET', payload: updatedMatch });
      });
    }

    // --- دالة التنظيف ---
    return () => {
      console.log("Disconnecting socket:", newSocket.id);
      if (newSocket) {
        newSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuth, currentUserId, dispatch, t, user?.userRole]);

  useEffect(() => {
    // 1. Interceptor للتعامل مع أخطاء 401
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response ? error.response.status : null;
        const isLoginRoute = window.location.pathname === '/login' || window.location.pathname === '/register';

        if (status === 401) {
          // إذا لم نكن في صفحة التسجيل، قم بتسجيل الخروج التلقائي
          if (!isLoginRoute && isAuth) {
            toast.error(t('apiErrors.sessionExpired', 'Session expired. Please log in again.'), {
              toastId: 'session-expired'
            });
            dispatch(logoutUser());
          }
        }
        return Promise.reject(error);
      }
    );

    // تنظيف Interceptor عند إلغاء تحميل المكون
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [dispatch, isAuth, t]);

  const localTokenExistsForLoadingCheck = !!localStorage.getItem('token');
  if (!authChecked && (userLoading || (localTokenExistsForLoadingCheck && !user && !userError))) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
        <Spinner animation="border" variant="primary" role="status" />
        <span className="ms-3 text-muted">{t('app.loadingSession', 'Loading session...')}</span>
      </div>
    );
  }

  if (authChecked && !isAuth && userError && localTokenExistsForLoadingCheck) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light flex-column p-3">
        <Alert variant="danger" className="text-center">{t('app.sessionError')}</Alert>
        <Button as={Link} to="/login" variant="primary" onClick={() => dispatch(logoutUser())}>{t('app.goToLogin')}</Button>
      </div>
    );
  }

  const handleSearchChange = (newSearchTerm) => setSearch(newSearchTerm);

  return (
    <SocketContext.Provider value={socketRef.current}>
      <div className={`app-container ${isAuth && user ? 'layout-authenticated' : 'layout-public'}`}>
        <CustomToastContainer />
        {isAuth && user && <Sidebar onSearchChange={handleSearchChange} />}
        <main className={`main-content-area flex-grow-1 ${isAuth && user ? 'content-authenticated' : 'content-public'}`}>
          {isAuth && user && <BlockedWarning isAuth={isAuth} user={user} />}
          <Routes>
            <Route path="/rate-limit-exceeded" element={<RateLimitExceededPage />} />
            <Route path="/login" element={!isAuth || !user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/register" element={!isAuth || !user ? <Register /> : <Navigate to="/dashboard" replace />} />
            <Route path="/" element={<OfflineProd />} />
            <Route path="/dashboard" element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/global-chat" element={<ProtectedRoute><GlobalChatPage /></ProtectedRoute>} />
            <Route path="/dashboard/news" element={<ProtectedRoute><NewsPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/news" element={<ProtectedRoute requiredRole="Admin"><AdminNewsManagement /></ProtectedRoute>} />
            <Route path="/dashboard/admin/achievements" element={<ProtectedRoute requiredRole="Admin"><AdminAchievementsManagement /></ProtectedRoute>} />
            <Route path="/dashboard/achievements" element={<ProtectedRoute><UserAchievementsPage /></ProtectedRoute>} />
            <Route path="/dashboard/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/referrals" element={<ProtectedRoute requiredRole="Admin"><AdminReferralSettings /></ProtectedRoute>} />
            <Route path="/dashboard/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/dashboard/comptes" element={<ProtectedRoute requiredRole="Vendor"><Comptes /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/dashboard/tournaments" element={<ProtectedRoute><TournamentsListPage /></ProtectedRoute>} />
            <Route path="/dashboard/tournaments/:id" element={<ProtectedRoute><TournamentDetailsPage /></ProtectedRoute>} />
            <Route path="/dashboard/match/:id" element={<ProtectedRoute><MatchRoomPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/create-tournament" element={<ProtectedRoute requiredRole="Admin"><CreateTournamentPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/leagues" element={<ProtectedRoute requiredRole="Admin"><AdminLeaguesPage /></ProtectedRoute>} />
            <Route path="/dashboard/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
            <Route path="/dashboard/lucky-wheel" element={<ProtectedRoute><LuckyWheelPage /></ProtectedRoute>} />
            <Route path="/dashboard/quests" element={<ProtectedRoute><QuestsPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/quests" element={<ProtectedRoute requiredRole="Admin"><AdminQuestManagement /></ProtectedRoute>} />
            <Route path="/dashboard/admin/check-in-settings" element={<ProtectedRoute requiredRole="Admin"><AdminCheckInSettings /></ProtectedRoute>} />
            <Route path="/dashboard/admin/wheel-settings" element={<ProtectedRoute requiredRole="Admin"><AdminWheelSettings /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/my-mediation-requests" element={<ProtectedRoute><MyMediationRequestsPage /></ProtectedRoute>} />
            <Route path="/dashboard/mediations" element={<ProtectedRoute><MediationsListPage /></ProtectedRoute>} />
            <Route path="/dashboard/comptes_bids" element={<ProtectedRoute requiredRole="Vendor"><CommandsListVendor search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/tickets" element={<ProtectedRoute><UserTicketsListPage /></ProtectedRoute>} />
            <Route path="/dashboard/support/tickets/:ticketId" element={<ProtectedRoute><TicketDetailsPage /></ProtectedRoute>} />
            <Route path="/dashboard/support/create-ticket" element={<ProtectedRoute><CreateTicketPage /></ProtectedRoute>} />
            <Route path="/dashboard/faq" element={<ProtectedRoute><FAQPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/products" element={<ProtectedRoute requiredRole="Admin"><ProductListAdmin search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/users" element={<ProtectedRoute requiredRole="Admin"><UserListAd search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/deposits" element={<ProtectedRoute requiredRole="Admin"><AdminTransactionRequests type="deposits" search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/withdrawals" element={<ProtectedRoute requiredRole="Admin"><AdminTransactionRequests type="withdrawals" search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/mediator-review" element={<ProtectedRoute requiredRole="Admin"><ReviewMediatorApplications search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/payment-methods" element={<ProtectedRoute requiredRole="Admin"><AdminPaymentMethods search={search} /></ProtectedRoute>} />
            <Route path="/dashboard/admin/disputes" element={<ProtectedRoute requiredRole="Admin"><AdminDisputesPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/reports" element={<ProtectedRoute requiredRole="Admin"><AdminReportsPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/tickets" element={<ProtectedRoute requiredRole="Admin"><AdminTicketsDashboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/ticket-view/:ticketId" element={<ProtectedRoute requiredRole="Admin"><TicketDetailsPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin/faq" element={<ProtectedRoute requiredRole="Admin"><AdminFAQManagement /></ProtectedRoute>} />
            <Route path="/dashboard/mediator/assignments" element={<ProtectedRoute isMediatorRoute={true}><MediatorDashboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/mediation-chat/:mediationRequestId" element={<ProtectedRoute><MediationChatPage /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<UserProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </SocketContext.Provider>
  );
}

export default AppWrapper;