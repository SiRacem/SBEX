// src/pages/NotificationsPage.jsx

import React, { useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Container, ListGroup, Spinner, Alert, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { FaCheckDouble, FaInfoCircle } from "react-icons/fa";
import {
  getNotifications,
  markNotificationsRead,
} from "../redux/actions/notificationAction";
import { useNavigate } from "react-router-dom";
import { getNotificationIcon } from "../utils/notificationUtils";
import "./NotificationsPage.css";

const NotificationsPage = () => {
  const { t, i18n } = useTranslation();
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

  // --- [!] دالة جديدة لمعالجة المعايير متعددة اللغات ---
  const processMessageParams = (params) => {
    if (!params) return {};
    const newParams = { ...params };

    // معالجة خاصة لاسم الإنجاز إذا كان كائناً
    if (
      newParams.achievementName &&
      typeof newParams.achievementName === "object"
    ) {
      // نحاول أخذ اللغة الحالية، ثم العربية، ثم الإنجليزية، أو نعيد نصاً فارغاً
      newParams.achievementName =
        newParams.achievementName[i18n.language] ||
        newParams.achievementName["ar"] ||
        newParams.achievementName["en"] ||
        "";
    }
    return newParams;
  };
  // -------------------------------------------------------

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

      // ... (نفس كود التوجيه السابق بدون تغيير) ...
      switch (modelName) {
        case "Product":
          if (currentUserRole === "Admin") path = "/dashboard/admin/products";
          else if (currentUserRole === "Vendor")
            path = "/dashboard/comptes_bids";
          else path = "/";
          break;
        case "MediationRequest":
          if (currentUserRole === "Admin") path = `/dashboard/admin/disputes`;
          else if (user?.isMediatorQualified)
            path = "/dashboard/mediator/assignments";
          else {
            const isSellerNotif = [
              "MEDIATION_REJECTED_BY_MEDIATOR_SELECT_NEW",
              "BUYER_CONFIRMED_AWAITING_YOUR_ACTION",
            ].includes(notificationType);
            path = isSellerNotif
              ? "/dashboard/comptes_bids"
              : "/my-mediation-requests";
          }
          if (notificationType.includes("CHAT"))
            path = `/dashboard/mediation-chat/${entityId}`;
          break;
        case "User":
          if (
            notificationType === "NEW_MEDIATOR_APPLICATION" &&
            currentUserRole === "Admin"
          )
            path = "/dashboard/admin/mediator-review";
          else path = "/dashboard/profile"; // للإنجازات نذهب للملف الشخصي
          break;
        case "DepositRequest":
          path =
            currentUserRole === "Admin"
              ? "/dashboard/admin/deposits"
              : "/dashboard/wallet";
          break;
        case "WithdrawalRequest":
          path =
            currentUserRole === "Admin"
              ? "/dashboard/admin/withdrawals"
              : "/dashboard/wallet";
          break;
        case "Ticket":
          // ... منطق التذاكر ...
          if (entityId) {
            path =
              currentUserRole === "Admin" || currentUserRole === "Support"
                ? `/dashboard/admin/ticket-view/${entityId}`
                : `/dashboard/support/tickets/${entityId}`;
          } else {
            path =
              currentUserRole === "Admin" || currentUserRole === "Support"
                ? "/dashboard/admin/tickets"
                : "/dashboard/tickets";
          }
          break;
        case "Report":
          if (currentUserRole === "Admin") path = "/dashboard/admin/reports";
          break;
        default:
          // للإنجازات نذهب للملف الشخصي
          if (notificationType === "ACHIEVEMENT_UNLOCKED") {
            path = "/dashboard/achievements";
          } else if (
            notificationType.startsWith("FUNDS_") ||
            notificationType.startsWith("ADMIN_BALANCE_")
          ) {
            path = "/dashboard/wallet";
          } else {
            path = "/dashboard";
          }
          break;
      }

      if (path) navigate(path);
    },
    [dispatch, loadingMarkRead, navigate, user]
  );

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);
    if (unreadIds.length > 0 && !loadingMarkRead) {
      dispatch(markNotificationsRead(unreadIds));
    }
  }, [dispatch, notifications, loadingMarkRead]);

  return (
    <Container fluid className="notifications-page py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h2 className="page-title mb-0">{t("notificationsPage.title")}</h2>
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
            {t("notificationsPage.markAllRead", { count: unreadCount })}
          </Button>
        )}
      </div>

      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">{t("notificationsPage.loading")}</p>
        </div>
      )}
      {!loading && error && (
        <Alert variant="danger" className="text-center">
          {t("notificationsPage.error", { error: error })}
        </Alert>
      )}

      {!loading && !error && (
        <ListGroup className="shadow-sm notification-list">
          {notifications.length > 0 ? (
            notifications.map((notif) => {
              // [!] هنا نستخدم الدالة الجديدة لمعالجة البارامترات
              const safeParams = processMessageParams(notif.messageParams);

              return (
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
                      {t(notif.title, {
                        ...safeParams, // استخدام البارامترات المعالجة
                        defaultValue:
                          notif.title || t("notificationsPage.defaultTitle"),
                      })}
                    </p>
                    <p
                      className={`mb-1 notification-message small ${
                        !notif.isRead ? "" : "text-muted"
                      }`}
                    >
                      {t(notif.message, {
                        ...safeParams, // استخدام البارامترات المعالجة
                        defaultValue: notif.message,
                      })}
                    </p>
                    <small className="text-muted notification-date">
                      {new Date(notif.createdAt).toLocaleString(i18n.language, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                </ListGroup.Item>
              );
            })
          ) : (
            <ListGroup.Item className="text-center text-muted py-5">
              <FaInfoCircle size={30} className="mb-3 d-block mx-auto" />
              {t("notificationsPage.noNotifications")}
            </ListGroup.Item>
          )}
        </ListGroup>
      )}
    </Container>
  );
};

export default NotificationsPage;