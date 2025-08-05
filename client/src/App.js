// src/App.js

import React, { useState, useEffect, useRef, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { getProfile, setOnlineUsers, logoutUser } from './redux/actions/userAction';
import { Alert, Spinner, Button } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import i18n from './i18n';

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

const ProtectedRoute = ({ children, requiredRole, isMediatorRoute = false }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuth, user, loading: userLoading, authChecked } = useSelector(state => state.userReducer);

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
    const allowedBlockedPaths = ['/dashboard/profile', '/dashboard/support'];
    if (allowedBlockedPaths.includes(location.pathname)) {
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
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();

  const {
    errors,
    successMessage,
    registrationStatus,
    successMessageParams,
    errorFromAPI
  } = useSelector(state => ({
    errors: state.userReducer.errors,
    successMessage: state.userReducer.successMessage,
    registrationStatus: state.userReducer.registrationStatus,
    successMessageParams: state.userReducer.successMessageParams,
    errorFromAPI: state.userReducer.errorMessage,
  }));

  const { isAuth, user, authChecked, userLoading, userError } = useSelector(state => state.userReducer);
  const currentUserId = user?._id;
  const socketRef = useRef(null);

  useEffect(() => {
    if (successMessage) {
      toast.success(t(successMessage, successMessageParams));
      dispatch({ type: 'CLEAR_USER_MESSAGES' });
    } else if (errorFromAPI) {
      let finalErrorMessage;
      if (typeof errorFromAPI.key === 'string' && i18n.exists(errorFromAPI.key)) {
        finalErrorMessage = t(errorFromAPI.key, errorFromAPI.params);
      } else if (typeof errorFromAPI.fallback === 'string') {
        finalErrorMessage = errorFromAPI.fallback;
      } else if (typeof errorFromAPI === 'string') {
        finalErrorMessage = errorFromAPI;
      }
      else {
        finalErrorMessage = t("apiErrors.unknownError", "An unknown error occurred.");
      }
      toast.error(finalErrorMessage);
      dispatch({ type: 'CLEAR_USER_MESSAGES' });
    } else if (errors) {
      const errorMessageText = t(`apiErrors.${errors}`, { defaultValue: errors });
      toast.error(errorMessageText);
      dispatch({ type: 'CLEAR_USER_ERRORS' });
    }
  }, [successMessage, errorFromAPI, errors, registrationStatus, dispatch, t, i18n, successMessageParams]);

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
          console.log(`%c[Socket] CONNECTED! Socket ID: ${newSocket.id}`, "color: green; font-weight: bold;");
          newSocket.emit("addUser", currentUserId);
        });

        newSocket.on('onlineUsersListUpdated', (onlineUserIdsFromServer) => {
          dispatch(setOnlineUsers(onlineUserIdsFromServer || []));
        });

        newSocket.on('user_balances_updated', (updatedBalanceData) => {
          if (updatedBalanceData && updatedBalanceData._id === currentUserId) {
            dispatch({ type: 'UPDATE_USER_BALANCES_SOCKET', payload: updatedBalanceData });
            toast.info(t('app.balanceUpdated'), { autoClose: 2500 });
          }
        });

        newSocket.on('dashboard_transactions_updated', (data) => {
          dispatch(getTransactionsForDashboard());
          dispatch(getTransactions());
          dispatch(getUserWithdrawalRequests());
          dispatch(getUserDepositRequests());
        });

        newSocket.on('user_profile_updated', (updatedUserData) => {
          if (updatedUserData && updatedUserData._id === currentUserId) {
            dispatch(getProfile());
            toast.info(t('app.profileUpdated'), { autoClose: 2500 });
          }
        });

        newSocket.on('new_pending_mediator_application', (newApplicationData) => {
          if (user && user.userRole === 'Admin' && newApplicationData?._id) {
            dispatch({ type: 'ADMIN_ADD_PENDING_MEDIATOR_APPLICATION', payload: newApplicationData });
            toast.info(t('app.newMediatorApp', { name: newApplicationData.fullName || 'a user' }));
          }
        });

        newSocket.on('refresh_mediator_applications_list', () => {
          if (user && user.userRole === 'Admin') {
            dispatch({ type: 'ADMIN_REFRESH_MEDIATOR_APPLICATIONS' });
            toast.info(t('app.mediatorListUpdated'));
          }
        });

        newSocket.on('product_deleted', (data) => {
          if (data && data.productId) {
            dispatch({ type: 'DELETE_PRODUCT_SUCCESS', payload: { productId: data.productId } });
          }
        });

        newSocket.on('new_mediation_request_for_buyer', (data) => {
          if (isAuth && user && user.userRole !== 'Admin') {
            dispatch(getBuyerMediationRequestsAction(1, 10));
            toast.info(data.message || t('app.newMediationRequest'));
          }
        });

        newSocket.on('mediation_request_updated', (data) => {
          if (data && data.updatedMediationRequestData?._id) {
            dispatch(updateMediationDetailsFromSocket(data.updatedMediationRequestData));
            toast.info(t('app.mediationUpdated', { title: data.updatedMediationRequestData.product?.title || 'N/A' }));
          }
        });

        newSocket.on('product_updated', (updatedProductData) => {
          if (updatedProductData && updatedProductData._id) {
            dispatch({ type: 'UPDATE_SINGLE_PRODUCT_IN_STORE', payload: updatedProductData });
          }
        });

        newSocket.on('new_assignment_for_mediator', (data) => {
          if (data && data.newAssignmentData) {
            dispatch({ type: 'ADD_PENDING_ASSIGNMENT_FROM_SOCKET', payload: data.newAssignmentData });
          }
        });

        newSocket.on('new_notification', (notification) => {
          toast.info(`🔔 ${t(notification.title, { ...notification.messageParams, defaultValue: notification.title })}`, { position: "top-right", autoClose: 3000 });
          dispatch({ type: 'ADD_NOTIFICATION_REALTIME', payload: notification });
        });

        newSocket.on('dispute_opened_for_admin', () => {
          if (user && user.userRole === 'Admin') {
            dispatch(adminGetDisputedMediationsAction(1, 1));
          }
        });

        newSocket.on('update_unread_summary', (data) => {
          if (window.location.pathname !== `/dashboard/mediation-chat/${data.mediationId}`) {
            toast.info(
              <div>
                <FaComments className="me-2" />
                {t('app.newChatMessage', { title: data.productTitle || data.mediationId })}
                {data.otherPartyForRecipient?.fullName && (
                  <div className="small text-muted">{t('app.from')}: {data.otherPartyForRecipient.fullName}</div>
                )}
              </div>,
              { position: "bottom-right", autoClose: 4000 }
            );
            dispatch(updateUnreadCountFromSocket(data.mediationId, data.newUnreadCount));
          }
        });

        newSocket.on('new_admin_sub_chat_message', (data) => {
          if (data && data.message) {
            dispatch(handleNewAdminSubChatMessageSocket(data, currentUserId));
          }
        });

        newSocket.on('new_ticket_created_for_admin', (newTicket) => {
          if (user && (user.userRole === 'Admin' || user.userRole === 'Support')) {
            toast.info(
              <div>
                <FaTicketAlt className="me-2" />
                {t('app.newTicketCreated')}
                <div className="small text-muted">{t('app.ticketTitle')}: {newTicket.title}</div>
              </div>,
              { position: "top-right", autoClose: 5000 }
            );
            dispatch({ type: 'ADMIN_ADD_NEW_TICKET_REALTIME', payload: newTicket });
          }
        });

        newSocket.on('ticket_updated', (data) => {
          toast.info(t('app.ticketUpdated', { ticketId: data.updatedTicket.ticketId }), { autoClose: 3500 });
          dispatch({ type: 'UPDATE_TICKET_DETAILS_REALTIME', payload: data.updatedTicket });
        });

        newSocket.on('disconnect', (reason) => {
          console.warn('[Socket] Disconnected:', reason);
        });

        newSocket.on('connect_error', (err) => {
          if (err.message.includes('unauthorized') || err.message === 'Invalid token') {
            dispatch(logoutUser());
          }
        });

        newSocket.on('server_error', (data) => {
          toast.error(data.message || t('apiErrors.unknownError'));
        });

        socketRef.current = newSocket;
      }
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
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

export default App;