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
import { FaComments, FaTicketAlt } from 'react-icons/fa';
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

export const SocketContext = createContext(null);
const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8000";

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

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
    if (allowedBlockedPaths.some(p => location.pathname.startsWith(p.replace(/:ticketId/, '')))) {
      return children;
    }
    toast.warn(t('auth.toast.accountBlocked'));
    return <Navigate to="/dashboard/profile" replace />;
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
      <Alert.Link as={Link} to="/dashboard/support">{t('app.blockedWarning.contactSupport')}</Alert.Link>
      {' OR '}
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
    // This effect now handles ALL toasts and dispatches to clear them
    if (successMessage) {
      toast.success(t(successMessage, successMessageParams));
      dispatch({ type: 'CLEAR_USER_MESSAGES' });
    } else if (errorFromAPI) {
      // The rate-limit navigation is handled in Login.jsx, so we just prevent a duplicate toast here
      if (errorFromAPI.key !== 'apiErrors.tooManyRequests') {
        const fallback = errorFromAPI.fallback || t("apiErrors.unknownError");
        toast.error(t(errorFromAPI.key, { ...errorFromAPI.params, defaultValue: fallback }));
      }
      dispatch(clearUserErrors());
    } else if (errors) {
      const errorMessageText = t(`apiErrors.${errors}`, { defaultValue: errors });
      toast.error(errorMessageText);
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
    if (isAuth && currentUserId) {
      if (!socketRef.current) {
        const newSocket = io(SOCKET_SERVER_URL, {
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          auth: { token: localStorage.getItem("token") }
        });

        newSocket.on("connect", () => {
          newSocket.emit("addUser", currentUserId);
        });

        newSocket.on('onlineUsersListUpdated', (onlineUserIdsFromServer) => dispatch(setOnlineUsers(onlineUserIdsFromServer || [])));
        newSocket.on('user_balances_updated', (data) => { if (data?._id === currentUserId) dispatch({ type: 'UPDATE_USER_BALANCES_SOCKET', payload: data }); });
        newSocket.on('dashboard_transactions_updated', () => {
          dispatch(getTransactionsForDashboard());
          dispatch(getTransactions());
          dispatch(getUserWithdrawalRequests());
          dispatch(getUserDepositRequests());
        });
        newSocket.on('user_profile_updated', (data) => { if (data?._id === currentUserId) dispatch(getProfile()); });
        newSocket.on('new_pending_mediator_application', (data) => { if (user?.userRole === 'Admin') dispatch({ type: 'ADMIN_ADD_PENDING_MEDIATOR_APPLICATION', payload: data }); });
        newSocket.on('refresh_mediator_applications_list', () => { if (user?.userRole === 'Admin') dispatch({ type: 'ADMIN_REFRESH_MEDIATOR_APPLICATIONS' }); });
        newSocket.on('product_deleted', (data) => { if (data?.productId) dispatch({ type: 'DELETE_PRODUCT_SUCCESS', payload: { productId: data.productId } }); });
        newSocket.on('new_mediation_request_for_buyer', (data) => { if (user?.userRole !== 'Admin') dispatch(getBuyerMediationRequestsAction(1, 10)); });
        newSocket.on('mediation_request_updated', (data) => { if (data?.updatedMediationRequestData?._id) dispatch(updateMediationDetailsFromSocket(data.updatedMediationRequestData)); });
        newSocket.on('product_updated', (data) => { if (data?._id) dispatch({ type: 'UPDATE_SINGLE_PRODUCT_IN_STORE', payload: data }); });
        newSocket.on('new_assignment_for_mediator', (data) => { if (data?.newAssignmentData) dispatch({ type: 'ADD_PENDING_ASSIGNMENT_FROM_SOCKET', payload: data.newAssignmentData }); });
        newSocket.on('new_notification', (notification) => {
          toast.info(`🔔 ${t(notification.title, { ...notification.messageParams, defaultValue: notification.title })}`, { position: "top-right" });
          dispatch({ type: 'ADD_NOTIFICATION_REALTIME', payload: notification });
        });
        newSocket.on('dispute_opened_for_admin', () => { if (user?.userRole === 'Admin') dispatch(adminGetDisputedMediationsAction(1, 1)); });
        newSocket.on('update_unread_summary', (data) => {
          if (window.location.pathname !== `/dashboard/mediation-chat/${data.mediationId}`) {
            dispatch(updateUnreadCountFromSocket(data.mediationId, data.newUnreadCount));
          }
        });
        newSocket.on('new_admin_sub_chat_message', (data) => { if (data?.message) dispatch(handleNewAdminSubChatMessageSocket(data, currentUserId)); });
        newSocket.on('new_ticket_created_for_admin', (ticket) => { if (user?.userRole === 'Admin' || user?.userRole === 'Support') dispatch({ type: 'ADMIN_ADD_NEW_TICKET_REALTIME', payload: ticket }); });
        newSocket.on('ticket_updated', (data) => dispatch({ type: 'UPDATE_TICKET_DETAILS_REALTIME', payload: data.updatedTicket }));
        newSocket.on('connect_error', (err) => { if (err.message.includes('unauthorized')) dispatch(logoutUser()); });
        socketRef.current = newSocket;
      }
    } else {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    }
    return () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } };
  }, [isAuth, currentUserId, dispatch, user, t]);

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
            <Route path="/dashboard/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/dashboard/comptes" element={<ProtectedRoute requiredRole="Vendor"><Comptes /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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