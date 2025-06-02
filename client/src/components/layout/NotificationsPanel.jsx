// src/components/layout/NotificationsPanel.jsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dropdown, Badge, ListGroup, Spinner } from "react-bootstrap";
import { FaBell } from "react-icons/fa";
import { Link } from "react-router-dom";
import {
  getNotifications,
  markNotificationsRead,
} from "../../redux/actions/notificationAction"; // تأكد من المسار
import "./NotificationsPanel.css"; // تأكد من المسار

const NotificationsPanel = () => {
  const dispatch = useDispatch();

  // --- Selectors ---
  // الوصول الآمن للحالة مع تضمين loadingMarkRead
  const { notifications, unreadCount, loading, loadingMarkRead } = useSelector(
    (state) => {
      const notifState = state.notificationReducer || {
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        loadingMarkRead: false, // حالة تحميل تمييز القراءة
      };
      return {
        notifications: Array.isArray(notifState.notifications)
          ? notifState.notifications
          : [],
        unreadCount: notifState.unreadCount ?? 0,
        loading: notifState.loading ?? false,
        error: notifState.error ?? null, // يمكنك استخدامه لعرض خطأ إذا لزم الأمر
        loadingMarkRead: notifState.loadingMarkRead ?? false,
      };
    }
  );

  // --- State ---
  const [isOpen, setIsOpen] = useState(false);

  // --- Effects ---
  // جلب الإشعارات عند تحميل المكون
  useEffect(() => {
    dispatch(getNotifications());
  }, [dispatch]);

  // --- Handlers ---
  // دالة لتبديل فتح/إغلاق القائمة المنسدلة
  const toggleDropdown = (nextOpenState, event, metadata) => {
    // منع الإغلاق عند النقر داخل القائمة نفسها
    if (metadata.source === "select" || metadata.source === "click") {
      // تحقق مما إذا كان النقر داخل القائمة المفتوحة
      if (isOpen && event?.target?.closest(".dropdown-menu")) {
        setIsOpen(true); // أبقِ القائمة مفتوحة
        return;
      }
      // تمييز الإشعارات كمقروءة عند *فتح* القائمة (فقط غير المقروءة)
      if (
        nextOpenState && // فقط عند الفتح (وليس الإغلاق)
        unreadCount > 0 && // فقط إذا كان هناك إشعارات غير مقروءة
        !loadingMarkRead // فقط إذا لم تكن عملية التمييز قيد التنفيذ بالفعل
      ) {
        const unreadIds = notifications
          .filter((n) => !n.isRead)
          .map((n) => n._id);
        if (unreadIds.length > 0) {
          dispatch(markNotificationsRead(unreadIds));
        }
      }
    }
    // تحديث حالة الفتح/الإغلاق
    setIsOpen(nextOpenState);
  };

  // --- [مُحدّث] دالة مساعدة لتحديد الرابط المناسب للإشعار ---
  const getNotificationLink = (notif) => {
    // --- [!] التأكد من توجيه إشعار الأدمن للمسار الصحيح ---
    if (notif.type === 'DEPOSIT_REQUEST' && notif.relatedEntity?.id) {
      // *** استخدم نفس المسار الموجود في App.js ***
      return "/dashboard/admin/deposit-requests";
    }

    // 2. توجيه إشعارات موافقة/رفض الإيداع للمستخدم إلى المحفظة (أو صفحة تفاصيل الطلب إن وجدت)
    if (
      (notif.type === "DEPOSIT_APPROVED" ||
        notif.type === "DEPOSIT_REJECTED" ||
        notif.type === "DEPOSIT_PENDING") && // <-- إضافة Pending هنا أيضاً
      notif.relatedEntity?.id
    ) {
      // يمكنك التوجيه للمحفظة أو لصفحة تفاصيل إذا أنشأتها لاحقاً
      return "/dashboard/wallet";
      // أو لصفحة تفاصيل الطلب: `/dashboard/deposit-details/${notif.relatedEntity.id}` (تحتاج مسار جديد)
    }

    // 3. منطق عام للكيانات الأخرى (مثل المنتجات) - قد تحتاج لتعديله حسب مساراتك
    if (notif.relatedEntity?.id && notif.relatedEntity?.modelName) {
      // تحويل اسم الموديل إلى مسار (مثال بسيط، قد يحتاج تحسين)
      const modelPath = notif.relatedEntity.modelName
        .toLowerCase()
        .replace("request", "-requests"); // مثال: 'Product' -> 'product', 'DepositRequest' -> 'deposit-requests'
      // *** تأكد من أن هذه المسارات موجودة فعلاً في App.js ***
      return `/dashboard/${modelPath}/${notif.relatedEntity.id}`;
    }

    // 4. الحالة الافتراضية: توجيه إلى صفحة الإشعارات العامة
    return "/dashboard/notifications";
  };
  // -------------------------------------------------------------

  // --- Render ---
  return (
    <Dropdown
      show={isOpen} // التحكم بفتح/إغلاق القائمة من خلال الحالة
      onToggle={toggleDropdown} // استخدام المعالج المخصص للتحكم بالفتح/الإغلاق وتمييز القراءة
      align="end" // محاذاة القائمة لليمين
      className="notifications-dropdown me-2" // كلاسات مخصصة للتنسيق
    >
      {/* زر الجرس */}
      <Dropdown.Toggle
        variant="link" // بدون خلفية أو حدود إضافية
        id="dropdown-notifications"
        className="p-0 border-0 position-relative bell-icon" // تنسيقات الأيقونة
      >
        <FaBell size={20} /> {/* أيقونة الجرس */}
        {/* شارة عدد الإشعارات غير المقروءة */}
        {unreadCount > 0 && (
          <Badge
            pill
            bg="danger"
            className="position-absolute top-0 start-100 translate-middle notification-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
            {/* عرض العدد أو +9 إذا تجاوز */}
            <span className="visually-hidden">unread notifications</span>
            {/* للنص المخفي لقارئات الشاشة */}
          </Badge>
        )}
      </Dropdown.Toggle>

      {/* قائمة الإشعارات المنسدلة */}
      <Dropdown.Menu
        className="notifications-menu shadow-lg" // تنسيقات القائمة
        style={{ minWidth: "300px", maxHeight: "400px", overflowY: "auto" }} // تحديد الحجم والسماح بالتمرير
      >
        {/* رأس القائمة */}
        <Dropdown.Header className="d-flex justify-content-between align-items-center">
          <span>Notifications</span>
          {/* مؤشر تحميل عند تمييز الإشعارات كمقروءة */}
          {loadingMarkRead && (
            <Spinner animation="border" size="sm" variant="primary" />
          )}
        </Dropdown.Header>
        {/* جسم القائمة (قائمة الإشعارات) */}
        <ListGroup variant="flush">
          {/* حالة التحميل */}
          {loading ? (
            <ListGroup.Item className="text-center py-3">
              <Spinner animation="border" size="sm" />
              <span className="ms-2 small">Loading...</span>
            </ListGroup.Item>
          ) : // حالة وجود إشعارات
          notifications.length > 0 ? (
            // عرض أحدث 5 إشعارات كمثال
            notifications.slice(0, 5).map((notif) => (
              <ListGroup.Item
                key={notif._id} // مفتاح فريد لكل عنصر
                as={Link} // استخدام Link من react-router-dom للانتقال
                to={getNotificationLink(notif)} // *** استخدام الدالة المساعدة لتحديد الرابط ***
                className={`notification-item ${!notif.isRead ? "unread" : ""}`} // تمييز غير المقروء
                onClick={() => setIsOpen(false)} // إغلاق القائمة عند النقر على إشعار
              >
                {/* عنوان الإشعار */}
                <div className="fw-bold small text-truncate">
                  {notif.title || "Notification"}
                </div>
                {/* رسالة الإشعار */}
                <div className="text-muted small mb-1 text-truncate">
                  {notif.message}
                </div>
                {/* وقت الإشعار */}
                <div className="text-muted extra-small">
                  {notif.createdAt
                    ? new Date(notif.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </div>
              </ListGroup.Item>
            ))
          ) : (
            // حالة عدم وجود إشعارات
            <ListGroup.Item className="text-center text-muted small py-4">
              No new notifications.
            </ListGroup.Item>
          )}
        </ListGroup>
        {/* فاصل ورابط لعرض كل الإشعارات */}
        <Dropdown.Divider />
        <Dropdown.Item
          as={Link}
          to="/dashboard/notifications" // رابط لصفحة الإشعارات الكاملة
          className="text-center small view-all-link"
          onClick={() => setIsOpen(false)} // أغلق القائمة عند النقر
        >
          View All Notifications
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationsPanel;
