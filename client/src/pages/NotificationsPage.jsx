// src/pages/NotificationsPage.jsx
import React, { useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Container, ListGroup, Spinner, Alert, Button } from "react-bootstrap";
import {
  FaCheckDouble,
  FaRegEnvelope,
  FaRegEnvelopeOpen,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaHandshake,
  FaBullhorn,
  FaUserShield,
  FaDollarSign,
  FaMoneyBillWave,
  FaUsersCog,
  FaMedal,
  FaGavel, // أيقونة للوساطة
  FaCommentDots, // أيقونة لرسائل الشات
} from "react-icons/fa";
import {
  // أيقونات إضافية قد تكون مفيدة
  FiTrendingUp, // للودائع
  FiTrendingDown, // للسحوبات
  FiAlertTriangle, // للمشاكل أو النزاعات
} from "react-icons/fi";

import {
  getNotifications,
  markNotificationsRead,
} from "../redux/actions/notificationAction";
import { useNavigate } from "react-router-dom";
import "./NotificationsPage.css";

const NotificationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.userReducer);

  const { notifications, unreadCount, loading, error, loadingMarkRead } =
    useSelector((state) => {
      const notifState = state.notificationReducer || {
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        loadingMarkRead: false,
      };
      return {
        notifications: Array.isArray(notifState.notifications)
          ? notifState.notifications
          : [],
        unreadCount: notifState.unreadCount ?? 0,
        loading: notifState.loading ?? false,
        error: notifState.error ?? null,
        loadingMarkRead: notifState.loadingMarkRead ?? false,
      };
    });

  useEffect(() => {
    dispatch(getNotifications());
  }, [dispatch]);

  const handleNotificationClick = useCallback(
    (notification) => {
      if (!notification.isRead && !loadingMarkRead) {
        dispatch(markNotificationsRead([notification._id]));
      }

      let path = null;
      const entityId = notification.relatedEntity?.id;
      const modelName = notification.relatedEntity?.modelName;
      const notificationType = notification.type;
      const currentUserRole = user?.userRole;
      const currentUserId = user?._id;
      const isMediatorQualified = user?.isMediatorQualified;

      console.log("Notification Clicked:", {
        notificationType,
        modelName,
        entityId,
        currentUserRole,
        currentUserId,
        isMediatorQualified,
      });

      // --- Product Related Notifications ---
      if (modelName === "Product" && entityId) {
        switch (notificationType) {
          case "NEW_BID":
          case "BID_UPDATED":
          case "BID_ACCEPTED_SELLER":
          case "BID_REJECTED_BY_YOU":
            if (currentUserRole === "Vendor" || currentUserRole === "Admin") {
              path = "/dashboard/comptes_bids";
            }
            break;
          case "BID_ACCEPTED_BUYER":
          case "BID_REJECTED":
            path = "/dashboard/my-orders";
            break;
          case "PRODUCT_APPROVED":
          case "PRODUCT_REJECTED":
          case "PRODUCT_DELETED":
            if (currentUserRole === "Vendor" || currentUserRole === "Admin") {
              path = "/dashboard/comptes";
            }
            break;
          case "NEW_PRODUCT_PENDING":
          case "PRODUCT_UPDATE_PENDING":
            if (currentUserRole === "Admin") {
              path = "/dashboard/admin/products";
            }
            break;
          default:
            console.warn(
              `Unhandled Product notification type: ${notificationType}. Navigating to product page or dashboard.`
            );
            path = "/dashboard/comptes_bids";
            break;
        }
      }
      // --- MediationRequest Related Notifications ---
      else if (modelName === "MediationRequest" && entityId) {
        // --- [!!!] بداية التعديل: التعامل مع إشعارات رسائل الشات [!!!] ---
        // توجيه مباشر إلى صفحة الشات عند وجود رسالة جديدة
        if (
          notificationType === "NEW_CHAT_MESSAGE" ||
          notificationType === "NEW_ADMIN_SUBCHAT_MESSAGE"
        ) {
          path = `/dashboard/mediation-chat/${entityId}`;
        }
        // --- [!!!] نهاية التعديل ---
        else {
          // التعامل مع بقية إشعارات الوساطة كما كان
          switch (notificationType) {
            case "MEDIATOR_SELECTED_BY_SELLER":
            case "MEDIATION_REJECTED_BY_MEDIATOR_SELECT_NEW":
            case "BUYER_CONFIRMED_AWAITING_YOUR_ACTION":
              if (currentUserRole === "Vendor") {
                path = "/dashboard/mediations";
              } else {
                path = `/dashboard/mediation-chat/${entityId}`;
              }
              break;

            case "BID_ACCEPTED_PENDING_MEDIATOR":
            case "SELLER_CONFIRMED_AWAITING_YOUR_ACTION":
              path = "/my-mediation-requests";
              break;

            case "MEDIATION_ASSIGNED":
            case "MEDIATION_TASK_ACCEPTED_SELF":
            case "MEDIATION_TASK_REJECTED_SELF":
              if (isMediatorQualified) {
                path = "/dashboard/mediator/assignments";
              }
              break;

            case "MEDIATION_ACCEPTED_BY_MEDIATOR":
            case "PARTY_CONFIRMED_READINESS":
            case "MEDIATION_STARTED":
            case "MEDIATION_COMPLETED":
            case "MEDIATION_CANCELLED":
            case "MEDIATION_DISPUTED":
            case "MEDIATION_CANCELLATION_CONFIRMED":
            case "MEDIATION_REJECTED_BY_BUYER":
              // For these general types, a direct link to the chat page is usually best for all parties.
              path = `/dashboard/mediation-chat/${entityId}`;
              break;

            default:
              console.warn(
                `Unhandled MediationRequest type: ${notificationType} for role ${currentUserRole}`
              );
              // توجيه افتراضي إلى صفحة الشات كحل آمن
              path = `/dashboard/mediation-chat/${entityId}`;
              break;
          }
        }
      }
      // --- User Related Notifications (Applications, Admin Actions) ---
      else if (modelName === "User" && entityId) {
        switch (notificationType) {
          case "NEW_MEDIATOR_APPLICATION":
            if (currentUserRole === "Admin") {
              path = "/dashboard/admin/mediator-review";
            }
            break;
          case "MEDIATOR_APP_APPROVED":
          case "MEDIATOR_APP_REJECTED":
          case "MEDIATOR_APP_PENDING":
            path = "/dashboard/profile";
            break;
          case "ADMIN_BALANCE_ADJUSTMENT":
            path = "/dashboard/wallet";
            break;
          case "USER_BALANCE_ADJUSTED":
            if (currentUserRole === "Admin") {
              path = `/dashboard/admin/users`;
            }
            break;
          default:
            path =
              entityId === currentUserId
                ? "/dashboard/profile"
                : `/profile/${entityId}`;
            break;
        }
      }
      // --- Deposit & Withdrawal Notifications ---
      else if (modelName === "DepositRequest" && entityId) {
        switch (notificationType) {
          case "NEW_DEPOSIT_REQUEST":
            if (currentUserRole === "Admin") path = "/dashboard/admin/deposits";
            break;
          case "DEPOSIT_APPROVED":
          case "DEPOSIT_REJECTED":
          case "DEPOSIT_PENDING":
            path = "/dashboard/wallet";
            break;
          default:
            path = "/dashboard/wallet";
            break;
        }
      } else if (modelName === "WithdrawalRequest" && entityId) {
        switch (notificationType) {
          case "NEW_WITHDRAWAL_REQUEST":
            if (currentUserRole === "Admin")
              path = "/dashboard/admin/withdrawals"; // Corrected path
            break;
          case "WITHDRAWAL_APPROVED":
          case "WITHDRAWAL_PROCESSING":
          case "WITHDRAWAL_COMPLETED":
          case "WITHDRAWAL_REJECTED":
            path = "/dashboard/wallet";
            break;
          default:
            path = "/dashboard/wallet";
            break;
        }
      }
      // --- General Wallet Notifications (without specific entityId/modelName) ---
      else if (
        notificationType === "FUNDS_RECEIVED" ||
        notificationType === "FUNDS_SENT"
      ) {
        path = "/dashboard/wallet";
      }
      // --- Welcome Notification ---
      else if (notificationType === "WELCOME") {
        path = "/dashboard/profile";
      } else {
        console.warn(
          `Notification type '${notificationType}' with modelName '${modelName}' not specifically handled for navigation.`
        );
      }

      if (path) {
        console.log("Navigating to resolved path:", path);
        navigate(path);
      } else {
        console.log(
          "No specific path determined for this notification, staying on page."
        );
      }
    },
    [
      dispatch,
      loadingMarkRead,
      navigate,
      user?.userRole,
      user?._id,
      user?.isMediatorQualified,
    ]
  );

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);
    if (unreadIds.length > 0 && !loadingMarkRead) {
      dispatch(markNotificationsRead(unreadIds));
    }
  }, [dispatch, notifications, loadingMarkRead]);

  const getNotificationIcon = (type, isRead) => {
    const iconColor = !isRead ? "primary" : "secondary";
    // Chat Messages
    if (type === "NEW_CHAT_MESSAGE" || type === "NEW_ADMIN_SUBCHAT_MESSAGE") {
      return <FaCommentDots size={20} className={`text-${iconColor}`} />;
    }
    // Product & Bidding
    if (
      type.startsWith("PRODUCT_") ||
      type.startsWith("NEW_PRODUCT_") ||
      type.startsWith("BID_")
    ) {
      if (type.includes("APPROVED") || type.includes("ACCEPTED"))
        return <FaCheckCircle size={20} className="text-success" />;
      if (type.includes("REJECTED") || type.includes("DELETED"))
        return <FaTimesCircle size={20} className="text-danger" />;
      if (type.includes("PENDING"))
        return <FaHourglassHalf size={20} className="text-warning" />;
      if (type.startsWith("NEW_BID") || type.startsWith("BID_UPDATED"))
        return <FaBullhorn size={20} className={`text-${iconColor}`} />;
    }
    // Mediation
    if (
      type.startsWith("MEDIATION_") ||
      type.startsWith("MEDIATOR_") ||
      type.startsWith("PARTY_") ||
      type.includes("_MEDIATOR") ||
      type.includes("CONFIRMED_")
    ) {
      if (type.includes("ASSIGNED") || type.includes("SELECTED"))
        return <FaUserShield size={20} className={`text-${iconColor}`} />;
      if (
        type.includes("ACCEPTED") ||
        type.includes("CONFIRMED_READINESS") ||
        type.includes("APPROVED") ||
        type === "MEDIATOR_APP_APPROVED" ||
        type === "MEDIATION_TASK_ACCEPTED_SELF"
      )
        return <FaCheckCircle size={20} className="text-success" />;
      if (
        type.includes("REJECTED") ||
        type.includes("CANCELLED") ||
        type === "MEDIATOR_APP_REJECTED" ||
        type === "MEDIATION_TASK_REJECTED_SELF"
      )
        return <FaTimesCircle size={20} className="text-danger" />;
      if (type === "MEDIATION_STARTED")
        return <FaGavel size={20} className="text-info" />;
      if (type === "MEDIATION_COMPLETED")
        return <FaMedal size={20} className="text-warning" />;
      if (type === "MEDIATION_DISPUTED")
        return <FiAlertTriangle size={20} className="text-danger" />;
      if (
        type === "NEW_MEDIATOR_APPLICATION" ||
        type === "MEDIATOR_APP_PENDING"
      )
        return <FaUsersCog size={20} className={`text-${iconColor}`} />;
      if (type === "PARTIES_CONFIRMED_AWAITING_CHAT")
        return <FaHandshake size={20} className={`text-${iconColor}`} />;
    }
    // Financial
    if (
      type.startsWith("FUNDS_") ||
      type.includes("BALANCE_") ||
      type.startsWith("DEPOSIT_") ||
      type.startsWith("WITHDRAWAL_")
    ) {
      if (
        type === "FUNDS_RECEIVED" ||
        type === "DEPOSIT_APPROVED" ||
        type === "WITHDRAWAL_COMPLETED" ||
        type === "ADMIN_BALANCE_ADJUSTMENT"
      )
        return <FaDollarSign size={20} className="text-success" />;
      if (type === "FUNDS_SENT" || type === "USER_BALANCE_ADJUSTED")
        return <FaMoneyBillWave size={20} className={`text-${iconColor}`} />;
      if (type === "NEW_DEPOSIT_REQUEST" || type === "DEPOSIT_PENDING")
        return <FiTrendingUp size={20} className="text-info" />;
      if (type === "DEPOSIT_REJECTED")
        return <FiTrendingUp size={20} className="text-danger" />;
      if (type === "NEW_WITHDRAWAL_REQUEST" || type === "WITHDRAWAL_PROCESSING")
        return <FiTrendingDown size={20} className="text-info" />;
      if (type === "WITHDRAWAL_REJECTED")
        return <FiTrendingDown size={20} className="text-danger" />;
    }
    // Welcome
    if (type === "WELCOME")
      return <FaHandshake size={20} className="text-primary" />;
    // Default
    return !isRead ? (
      <FaRegEnvelope size={20} className={`text-${iconColor}`} />
    ) : (
      <FaRegEnvelopeOpen size={20} className={`text-${iconColor}`} />
    );
  };

  return (
    <Container fluid className="notifications-page py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h2 className="page-title mb-0">Notifications</h2>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline-primary"
            onClick={handleMarkAllRead}
            disabled={loadingMarkRead}
          >
            {loadingMarkRead ? (
              <Spinner as="span" size="sm" animation="border" />
            ) : (
              <FaCheckDouble className="me-1" />
            )}
            Mark All Read ({unreadCount})
          </Button>
        )}
      </div>

      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading notifications...</p>
        </div>
      )}
      {!loading && error && (
        <Alert variant="danger" className="text-center">
          Failed to load notifications: {error}
        </Alert>
      )}

      {!loading && !error && (
        <ListGroup className="shadow-sm notification-list">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <ListGroup.Item
                key={notif._id}
                action
                onClick={() => handleNotificationClick(notif)}
                className={`d-flex align-items-start notification-list-item ${
                  !notif.isRead ? "unread-item" : ""
                }`}
              >
                <div className="icon-area me-3">
                  {getNotificationIcon(notif.type, notif.isRead)}
                </div>
                <div className="content-area flex-grow-1">
                  <p
                    className={`mb-1 notification-title ${
                      !notif.isRead ? "fw-bold" : ""
                    }`}
                  >
                    {notif.title || "Notification"}
                  </p>
                  <p
                    className={`mb-1 notification-message small ${
                      !notif.isRead ? "" : "text-muted"
                    }`}
                  >
                    {notif.message}
                  </p>
                  <small className="text-muted notification-date">
                    {new Date(notif.createdAt).toLocaleString()}
                  </small>
                </div>
              </ListGroup.Item>
            ))
          ) : (
            <ListGroup.Item className="text-center text-muted py-5">
              <FaInfoCircle size={30} className="mb-3 d-block mx-auto" />
              You have no notifications.
            </ListGroup.Item>
          )}
        </ListGroup>
      )}
    </Container>
  );
};

export default NotificationsPage;
