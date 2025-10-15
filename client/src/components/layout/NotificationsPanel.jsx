// src/components/layout/NotificationsPanel.jsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dropdown, Badge, ListGroup, Spinner } from "react-bootstrap";
import { FaBell, FaInfoCircle } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getNotifications,
  markNotificationsRead,
} from "../../redux/actions/notificationAction";
import { getNotificationIcon } from "../../utils/notificationUtils";
import "./NotificationsPanel.css";

const NotificationsPanel = () => {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();

  const { notifications, unreadCount, loading, loadingMarkRead } = useSelector(
    (state) => {
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
        loadingMarkRead: notifState.loadingMarkRead ?? false,
      };
    }
  );

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    dispatch(getNotifications());
  }, [dispatch]);

  const handleToggle = (nextOpenState) => {
    setIsOpen(nextOpenState);
    if (nextOpenState && unreadCount > 0 && !loadingMarkRead) {
      const unreadIds = notifications
        .filter((n) => !n.isRead)
        .map((n) => n._id);
      if (unreadIds.length > 0) {
        dispatch(markNotificationsRead(unreadIds));
      }
    }
  };

  const handleItemClick = () => {
    setIsOpen(false);
  };

  const getNotificationLink = (notification) => {
    return "/dashboard/notifications";
  };

  return (
    <Dropdown
      show={isOpen}
      onToggle={handleToggle}
      align="end"
      className="notifications-dropdown me-2"
    >
      <Dropdown.Toggle
        variant="link"
        id="dropdown-notifications"
        className="p-0 border-0 position-relative bell-icon"
      >
        <FaBell size={20} />
        {unreadCount > 0 && (
          <Badge
            pill
            bg="danger"
            className="position-absolute top-0 start-100 translate-middle notification-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
            <span className="visually-hidden">unread notifications</span>
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="notifications-menu shadow-lg"
        style={{ minWidth: "320px", maxHeight: "400px", overflowY: "auto" }}
      >
        <Dropdown.Header className="d-flex justify-content-between align-items-center">
          <span>{t("notificationsPage.title")}</span>
          {loadingMarkRead && (
            <Spinner animation="border" size="sm" variant="primary" />
          )}
        </Dropdown.Header>

        <ListGroup variant="flush">
          {loading ? (
            <ListGroup.Item className="text-center py-3">
              <Spinner animation="border" size="sm" />
              <span className="ms-2 small">
                {t("notificationsPage.loading")}
              </span>
            </ListGroup.Item>
          ) : notifications.length > 0 ? (
            notifications.slice(0, 5).map((notif) => (
              <ListGroup.Item
                key={notif._id}
                as={Link}
                to={getNotificationLink(notif)}
                className={`notification-item ${!notif.isRead ? "unread" : ""}`}
                onClick={handleItemClick}
              >
                <div className="d-flex align-items-center">
                  <div className="notification-icon-panel me-3">
                    {getNotificationIcon(notif.type, notif.isRead)}
                  </div>
                  <div className="notification-content-panel flex-grow-1">
                    {/* [!!!] هذا هو الجزء المهم للتأكد منه [!!!] */}
                    <div className="fw-bold small text-truncate">
                      {t(notif.title, {
                        ...notif.messageParams,
                        defaultValue: notif.title,
                      })}
                    </div>
                    <div className="text-muted small mb-1 text-truncate">
                      {t(notif.message, {
                        ...notif.messageParams,
                        defaultValue: notif.message,
                      })}
                    </div>
                    {/* [!!!] نهاية الجزء المهم [!!!] */}
                    <div className="text-muted extra-small">
                      {notif.createdAt
                        ? new Date(notif.createdAt).toLocaleString(
                            i18n.language,
                            { hour: "2-digit", minute: "2-digit" }
                          )
                        : "-"}
                    </div>
                  </div>
                </div>
              </ListGroup.Item>
            ))
          ) : (
            <ListGroup.Item className="text-center text-muted small py-4">
              <FaInfoCircle className="d-block mx-auto mb-2" size={24} />
              {t("notificationsPage.noNotifications")}
            </ListGroup.Item>
          )}
        </ListGroup>

        <Dropdown.Divider />
        <Dropdown.Item
          as={Link}
          to="/dashboard/notifications"
          className="text-center small view-all-link"
          onClick={handleItemClick}
        >
          {t("notificationsPage.viewAll")}
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationsPanel;