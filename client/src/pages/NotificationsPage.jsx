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
} from "react-icons/fa"; // إضافة أيقونة
import {
  getNotifications,
  markNotificationsRead,
} from "../redux/actions/notificationAction"; // تأكد من المسار الصحيح
import { useNavigate } from "react-router-dom"; // استيراد useNavigate
import "./NotificationsPage.css"; // أنشئ هذا الملف أو أضف الأنماط لـ App.css

const NotificationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate(); // للانتقال عند النقر
  const { user } = useSelector((state) => state.userReducer);

  // --- الحصول على الحالة من Redux بأمان ---
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

  // جلب الإشعارات عند تحميل الصفحة
  useEffect(() => {
    dispatch(getNotifications());
  }, [dispatch]);

  // --- دالة لتمييز إشعار واحد كمقروء والانتقال (إذا أمكن) ---
  // --- *** تعديل دالة النقر على الإشعار *** ---
  const handleNotificationClick = useCallback(
    (notification) => {
      // تمييز كمقروء
      if (!notification.isRead && !loadingMarkRead) {
        console.log("Marking notification as read:", notification._id);
        dispatch(markNotificationsRead([notification._id]));
      }

      // تحديد المسار بناءً على نوع الإشعار والكيان المرتبط ودور المستخدم
      let path = "/dashboard"; // المسار الافتراضي

      const entityId = notification.relatedEntity?.id;
      const modelName = notification.relatedEntity?.modelName;
      const notificationType = notification.type;

      console.log("Notification Clicked:", {
        notificationType,
        modelName,
        entityId,
      });

      if (entityId && modelName === "Product") {
        // --- منطق الإشعارات المتعلقة بالمنتجات ---
        switch (notificationType) {
          // إشعارات تخص البائع عن منتجاته
          case "PRODUCT_APPROVED":
          case "PRODUCT_REJECTED":
          case "PRODUCT_DELETED": // إشعار بأن منتجه حذف (يذهب لحساباته)
            path = "/dashboard/comptes"; // توجيه لصفحة حسابات المستخدم
            break;

          // إشعارات تخص البائع عن مزادات منتجاته
          case "NEW_BID":
          case "BID_UPDATED":
          case "BID_ACCEPTED_SELLER":
          case "BID_REJECTED_BY_YOU": // إشعارات يراها البائع في صفحة الطلبات/المزايدات
            path = "/dashboard/comptes_bids"; // <-- المسار الصحيح لصفحة البائع للمزايدات/الطلبات
            break;

          // إشعارات تخص المشتري (المزايد)
          case "BID_ACCEPTED_BUYER": // مزايدته قبلت (يمكن توجيهه لطلباته أو المنتج)
          case "BID_REJECTED": // مزايدته رفضت (يمكن توجيهه لطلباته أو المنتج)
            // قد تحتاج لصفحة طلبات/مزايدات خاصة بالمشتري، أو توجيهه للمنتج
            // أو لصفحة الإشعارات كبديل مؤقت إذا لم تكن الصفحة جاهزة
            // path = `/dashboard/my-bids`; // مثال
            path = `/`; // مثال: توجيه لصفحة المنتج نفسه
            break;

          // إشعارات تخص الأدمن
          case "NEW_PRODUCT_PENDING":
          case "PRODUCT_UPDATE_PENDING":
            if (user?.userRole === "Admin") {
              path = `/dashboard/admin/products`; // صفحة منتجات الأدمن المعلقة
              // يمكنك إضافة #productId للانتقال للمنتج المحدد إذا كان الجدول يدعم ذلك
              // path = `/dashboard/admin/products#${entityId}`;
            } else {
              // إذا وصل إشعار أدمن لمستخدم ليس أدمن (غير محتمل)، يذهب للوحة التحكم
              path = "/dashboard";
            }
            break;

          default:
            // إذا كان النوع غير معروف ولكن مرتبط بمنتج، يمكن توجيهه لصفحة المنتج أو الحسابات
            console.log(
              `Unhandled Product notification type: ${notificationType}. Defaulting path.`
            );
            if (user?.userRole === "Admin") path = "/dashboard/admin/products";
            else path = "/dashboard/comptes"; // أو صفحة المنتج العام؟
            break;
        }
      } else if (entityId && modelName === "Order") {
        // منطق الإشعارات المتعلقة بالطلبات (إذا تم تطبيقها لاحقاً)
        path = `/dashboard/orders/${entityId}`; // مثال
      } else if (
        notificationType === "FUNDS_RECEIVED" ||
        notificationType === "FUNDS_SENT" ||
        notificationType === "USER_BALANCE_ADJUSTED" ||
        notificationType === "ADMIN_BALANCE_ADJUSTMENT"
      ) {
        // إشعارات المحفظة
        path = "/dashboard/wallet";
      }
      // يمكنك إضافة حالات أخرى لـ modelName أو types أخرى هنا

      console.log("Navigating to resolved path:", path);
      if (path) {
        navigate(path);
      }
    },
    [dispatch, loadingMarkRead, navigate, user?.userRole] // <-- إضافة userRole للاعتمادية
  );
  // --- *** نهاية تعديل دالة النقر *** ---

  // --- دالة لتمييز الكل كمقروء ---
  const handleMarkAllRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);
    if (unreadIds.length > 0 && !loadingMarkRead) {
      dispatch(markNotificationsRead(unreadIds));
    }
  }, [dispatch, notifications, loadingMarkRead]);

  return (
    <Container fluid className="notifications-page py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h2 className="page-title mb-0">Notifications</h2>
        {/* زر تمييز الكل كمقروء */}
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
          {" "}
          Failed to load notifications: {error}{" "}
        </Alert>
      )}

      {!loading && !error && (
        <ListGroup className="shadow-sm notification-list">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <ListGroup.Item
                key={notif._id}
                action // يجعل العنصر قابلاً للنقر
                onClick={() => handleNotificationClick(notif)} // استدعاء الدالة الجديدة
                className={`d-flex align-items-start notification-list-item ${
                  !notif.isRead ? "unread-item" : ""
                }`}
                // لا تقم بتعطيل العنصر بالكامل، فقط منع dispatch إذا كان loadingMarkRead
              >
                <div
                  className={`icon-area me-3 text-${
                    !notif.isRead ? "primary" : "secondary"
                  }`}
                >
                  {" "}
                  {/* تغيير لون الأيقونة المقروءة */}
                  {/* يمكنك إضافة أيقونات مختلفة حسب notif.type */}
                  {
                    notif.type === "PRODUCT_APPROVED" ? (
                      <FaCheckCircle size={20} className="text-success" />
                    ) : notif.type === "PRODUCT_REJECTED" ||
                      notif.type === "PRODUCT_DELETED" ? (
                      <FaTimesCircle size={20} className="text-danger" />
                    ) : notif.type === "NEW_PRODUCT_PENDING" ? (
                      <FaHourglassHalf size={20} className="text-warning" />
                    ) : !notif.isRead ? (
                      <FaRegEnvelope size={20} />
                    ) : (
                      <FaRegEnvelopeOpen size={20} />
                    )
                    /* أضف أيقونات أخرى */
                  }
                </div>
                <div className="content-area flex-grow-1">
                  <p
                    className={`mb-1 notification-title ${
                      !notif.isRead ? "fw-bold" : ""
                    }`}
                  >
                    {" "}
                    {notif.title || "Notification"}{" "}
                  </p>
                  <p
                    className={`mb-1 notification-message small ${
                      !notif.isRead ? "" : "text-muted"
                    }`}
                  >
                    {" "}
                    {notif.message}{" "}
                  </p>
                  <small className="text-muted notification-date">
                    {" "}
                    {new Date(notif.createdAt).toLocaleString()}{" "}
                  </small>
                </div>
                {/* يمكنك إضافة علامة "مقروء" صغيرة جدًا إذا أردت */}
                {/* {notif.isRead && <Badge pill bg="light" text="dark" className="ms-auto align-self-center">Read</Badge>} */}
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
