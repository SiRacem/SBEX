// src/pages/MainDashboard.jsx

import React, { useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  FaWallet,
  FaUserCircle,
  FaBell,
  FaComments,
  FaNewspaper,
  FaHeadset,
  FaSignOutAlt,
  FaBalanceScale,
  FaHourglassHalf,
  FaReceipt,
  FaArrowUp,
  FaArrowDown } from "react-icons/fa"; // استيراد الأيقونات المستخدمة
import { logoutUser } from "../redux/actions/userAction"; // استيراد دالة تسجيل الخروج
import { getNotifications } from "../redux/actions/notificationAction"; // استيراد دالة جلب الإشعارات
import {
  Badge,
  Spinner,
  Card,
  Container,
  Row,
  Col,
  Alert,
  ListGroup,
} from "react-bootstrap"; // استيراد مكونات الواجهة من React Bootstrap
import useCurrencyDisplay from "../hooks/useCurrencyDisplay"; // <-- استيراد الهوك المخصص للعملات
import { getMyMediationSummaries } from "../redux/actions/mediationAction"; // تأكد من المسار الصحيح

const MainDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // --- استخدام Selectors لجلب البيانات من حالة Redux ---
  const user = useSelector((state) => state.userReducer?.user); // بيانات المستخدم المسجل
  const isAuth = useSelector((state) => state.userReducer?.isAuth ?? false); // حالة المصادقة
  const unreadCount = useSelector(
    (state) => state.notificationReducer?.unreadCount ?? 0
  ); // عدد الإشعارات غير المقروءة
  const notificationsLoading = useSelector(
    (state) => state.notificationReducer?.loading ?? false
  ); // حالة تحميل الإشعارات
  const notificationError = useSelector(
    (state) => state.notificationReducer?.error ?? null
  ); // خطأ تحميل الإشعارات
  const transactions = useSelector(
    (state) => state.transactionReducer?.transactions ?? []
  );
  const transactionsLoading = useSelector(
    (state) => state.transactionReducer?.loading ?? false
  );
  const transactionsError = useSelector(
    (state) => state.transactionReducer?.error ?? null
  );
const totalUnreadMediationMessages = useSelector(
  (state) => state.mediationReducer?.myMediationSummaries?.totalUnreadMessagesCount ?? 0 // <--- تصحيح المسار
);
const mediationSummariesLoading = useSelector(
  (state) => state.mediationReducer?.myMediationSummaries?.loading ?? false // <--- تصحيح المسار
);
  const recentTransactions = []; // placeholder - لا توجد معاملات حاليًا

  // --- استخدام الهوك المخصص لعرض الأرصدة بالعملة المختارة ---
  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );
  // ----------------------------------------------------------

  // --- دالة تسجيل الخروج ---
  const handleLogout = useCallback(() => {
    if (window.confirm("Are you sure you want to logout?")) {
      dispatch(logoutUser());
      navigate('/login'); // توجيه المستخدم لصفحة تسجيل الدخول بعد الخروج
    }
  }, [dispatch, navigate]);

  // --- useEffect لجلب الإشعارات عند تحميل المكون أو تغير حالة المصادقة ---
  useEffect(() => {
  if (isAuth && user?._id) { // إضافة user?._id كشرط للتأكد من أن المستخدم قد تم تحميله
    console.log("[MainDashboard Effect] Fetching initial data...");
    dispatch(getNotifications());
    dispatch(getMyMediationSummaries()); // <--- إلغاء التعليق
  }
}, [dispatch, isAuth, user?._id]); // إضافة user?._id إلى الاعتماديات

  // --- التحقق من تحميل بيانات المستخدم ---
  // إذا لم يتم تحميل المستخدم بعد (قد يحدث للحظات قليلة بعد المصادقة)
  if (!user) {
    // عرض مؤشر تحميل
    return (
      <Container
        fluid // جعل الحاوية تملأ العرض
        className="d-flex justify-content-center align-items-center" // توسيط المحتوى
        style={{ minHeight: "80vh" }} // تحديد ارتفاع أدنى لضمان التوسيط الرأسي
      >
        <Spinner animation="border" variant="primary" />
        {/* مؤشر التحميل الدوار */}
        <span className="ms-2">Loading user data...</span> {/* نص توضيحي */}
      </Container>
    );
  }
  // --- نهاية التحقق ---

  // --- عرض واجهة المستخدم ---
  return (
    // حاوية رئيسية للصفحة مع بعض التباعد الداخلي
    <div className="dashboard-container container-fluid py-4">
      {/* عرض رسالة خطأ إذا فشل تحميل الإشعارات */}
      {notificationError && (
        <Alert variant="warning" dismissible>
          
          {/* رسالة تحذير قابلة للإغلاق */}
          Failed to load notifications: {notificationError}
        </Alert>
      )}

      {/* الصف العلوي: صناديق المعلومات الرئيسية */}
      <Row className="g-4 mb-4">
        
        {/* g-4 لإضافة مسافة بين الأعمدة, mb-4 لإضافة مسافة سفلية */}
        {/* العمود الأول: صندوق الرصيد الرئيسي */}
        <Col lg={4} md={6}>
          
          {/* حجم العمود للشاشات المختلفة */}
          <Card className="info-box balance-box text-white p-3 rounded shadow-sm h-100">
            
            {/* تصميم الصندوق */}
            <Card.Body className="d-flex flex-column">
              
              {/* استخدام flex لعناصر الجسم */}
              {/* رأس الصندوق */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Principal Balance</h5> {/* عنوان الرصيد */}
                <FaWallet size={24} /> {/* أيقونة المحفظة */}
              </div>
              {/* عرض الرصيد والقيمة التقريبية باستخدام الهوك */}
              <h3 className="display-6 fw-bold mb-1">
                {principalBalanceDisplay.displayValue}
              </h3>
              <p className="approx-value-maindash mb-3">
                {principalBalanceDisplay.approxValue}
              </p>
              {/* معلومات المستخدم */}
              <div className="d-flex align-items-center mt-auto">
                
                {/* mt-auto لدفع العنصر للأسفل */}
                <FaUserCircle size={20} className="me-2" />
                {/* أيقونة المستخدم */}
                <span className="fw-bold username">{user.fullName}</span>
                {/* اسم المستخدم */}
              </div>
            </Card.Body>
          </Card>
        </Col>
        {/* العمود الثاني: صندوق أرصدة البائع (يظهر فقط إذا كان بائعًا أو أدمن) */}
        {(user.userRole === "Vendor" || user.userRole === "Admin") && (
          <Col lg={4} md={6}>
            <Card className="info-box seller-box text-white p-3 rounded shadow-sm h-100">
              <Card.Body>
                {/* الرصيد المتاح للبائع */}
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="mb-0">Seller Available</h5>
                  <FaBalanceScale size={24} /> {/* أيقونة الميزان */}
                </div>
                {/* عرض الرصيد والقيمة التقريبية باستخدام الهوك */}
                <h4 className="fw-bold mb-1">
                  {sellerAvailableBalanceDisplay.displayValue}
                </h4>
                <p className="approx-value-maindash mb-2">
                  {sellerAvailableBalanceDisplay.approxValue}
                </p>
                {/* فاصل */}
                <hr className="border-light opacity-50 my-2" />
                {/* الرصيد المعلق للبائع */}
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="mb-0">On Hold Balance</h5>
                  <FaHourglassHalf size={20} /> {/* أيقونة الساعة الرملية */}
                </div>
                {/* عرض الرصيد والقيمة التقريبية باستخدام الهوك */}
                <h4 className="fw-bold mb-1">
                  {sellerPendingBalanceDisplay.displayValue}
                </h4>
                <p className="approx-value-maindash mb-0">
                  {sellerPendingBalanceDisplay.approxValue}
                </p>
              </Card.Body>
            </Card>
          </Col>
        )}
        {/* العمود الثالث: صندوق الإشعارات والرسائل */}
        {/* يأخذ حجمًا مختلفًا حسب وجود صندوق البائع */}
        <Col
          lg={4}
          md={user.userRole === "Vendor" || user.userRole === "Admin" ? 12 : 6}
        >
          <Card className="info-box comms-box p-3 rounded shadow-sm h-100">
            <Card.Body>
              {/* رابط الإشعارات */}
              <Link
                to="/dashboard/notifications" // المسار لصفحة الإشعارات
                className="comms-link d-flex align-items-center text-decoration-none mb-3 position-relative"
              >
                <FaBell size={22} className="me-3 text-primary icon" />
                {/* أيقونة الجرس */}
                <span className="link-text">Notifications</span>
                {/* نص الرابط */}
                {/* عرض عدد الإشعارات غير المقروءة إذا كان أكبر من صفر */}
                {!notificationsLoading && unreadCount > 0 && (
                  <Badge pill bg="danger" className="notification-link-badge">
                    
                    {/* شارة العدد */}
                    {unreadCount > 9 ? "9+" : unreadCount}
                    {/* عرض +9 إذا كان العدد كبيراً */}
                  </Badge>
                )}
                {/* عرض مؤشر تحميل إذا كانت الإشعارات قيد التحميل */}
                {notificationsLoading && (
                  <Spinner
                    animation="border"
                    size="sm"
                    variant="secondary"
                    className="ms-2"
                  />
                )}
              </Link>
              {/* فاصل */}
              <hr className="my-2" />
              {/* رابط الرسائل (المسار يحتاج للتأكيد) */}
              <Link
                to="/dashboard/mediations" // المسار الجديد لصفحة قائمة الوساطات
                className="comms-link d-flex align-items-center text-decoration-none mt-3 position-relative"
              >
                <FaComments size={22} className="me-3 text-success icon" />
                <span className="link-text">Messages</span>
                {/* عرض عدد الرسائل غير المقروءة في الوساطات */}
                {!mediationSummariesLoading && totalUnreadMediationMessages > 0 && (
                  <Badge pill bg="success" className="notification-link-badge">
                    {totalUnreadMediationMessages > 99 ? "99+" : totalUnreadMediationMessages}
                  </Badge>
                )}
                {mediationSummariesLoading && (
                    <Spinner
                        animation="border"
                        size="sm"
                        variant="secondary"
                        className="ms-2"
                    />
                )}
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* الصف الثاني: المعاملات الأخيرة والخيارات */}
      <Row className="g-4">
        {/* العمود الأول: المعاملات الأخيرة */}
        {/* --- المعاملات الأخيرة (تصميم محدث) --- */}
        <Col lg={8}>
          <Card className="shadow-sm mb-4 h-100"> {/* h-100 لجعل ارتفاعها متناسقًا */}
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                          <h5 className="mb-0 text-secondary">Recent Transactions</h5>
                          {!transactionsLoading && !transactionsError && (
                            <span className="text-muted small">
                              Showing {transactions.length}
                            </span>
                          )}
                        </Card.Header>
            <Card.Body className="p-0 d-flex flex-column"> {/* p-0 لإزالة الحشو واضافة flex */}
                {/* عرض قائمة المعاملات */}
                {recentTransactions.length > 0 ? (
                    <ListGroup variant="flush" className="flex-grow-1">
                        {/* مثال لعنصر قائمة المعاملات (ستحتاج لتكراره وعرض بيانات حقيقية) */}
                        <ListGroup.Item className="px-4 py-3 d-flex justify-content-between align-items-center transaction-list-item-dash">
                           <div className="d-flex align-items-center">
                              {/* أيقونة نوع المعاملة */}
                              <div className="transaction-icon-dash bg-success-soft text-success me-3"> <FaArrowDown /> </div> {/* مثال: إيداع */}
                              <div>
                                 <h6 className="mb-0 fw-medium">Deposit Received</h6>
                                 <small className="text-muted">From Admin</small>
                              </div>
                           </div>
                           <div className="text-end">
                              <span className="fw-bold text-success d-block">+ TND 50.00</span>
                              <small className="text-muted">April 28, 2025</small>
                           </div>
                        </ListGroup.Item>
                         <ListGroup.Item className="px-4 py-3 d-flex justify-content-between align-items-center transaction-list-item-dash">
                           <div className="d-flex align-items-center">
                               <div className="transaction-icon-dash bg-danger-soft text-danger me-3"> <FaArrowUp /> </div> {/* مثال: إرسال */}
                              <div>
                                 <h6 className="mb-0 fw-medium">Sent Funds</h6>
                                 <small className="text-muted">To John Doe</small>
                              </div>
                           </div>
                           <div className="text-end">
                              <span className="fw-bold text-danger d-block">- TND 15.50</span>
                              <small className="text-muted">April 27, 2025</small>
                           </div>
                        </ListGroup.Item>
                       {/* ... كرر لعرض معاملات أخرى ... */}
                    </ListGroup>
                ) : (
                  // --- تصميم محسّن لحالة "لا توجد معاملات" ---
                  <div className="text-center p-5 d-flex flex-column justify-content-center align-items-center flex-grow-1">
                    <FaReceipt size={40} className="text-muted opacity-50 mb-3" />
                    <h6 className="text-muted fw-normal">No Recent Transactions</h6>
                    <p className="text-muted small mb-0">Your latest financial activities will show up here.</p>
                  </div>
                  // ------------------------------------------
                )}
            </Card.Body>
          </Card>
        </Col>

        {/* العمود الثاني: الخيارات */}
        <Col lg={4}>
          <Card className="shadow-sm">
            <Card.Header className="bg-white text-center">
              <h5 className="mb-0">Options</h5> {/* عنوان قسم الخيارات */}
            </Card.Header>
            {/* قائمة بالخيارات كرابط */}
            <ListGroup variant="flush">
              <ListGroup.Item
                action // يجعل العنصر قابلاً للنقر
                as={Link} // يستخدم مكون Link للتنقل
                to="/dashboard/latest-news" // المسار (تأكد من وجوده)
                className="d-flex align-items-center"
              >
                <FaNewspaper size={20} className="me-3 text-primary icon" />
                {/* أيقونة الأخبار */}
                Latest News
              </ListGroup.Item>
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/support" // المسار لصفحة الدعم
                className="d-flex align-items-center"
              >
                <FaHeadset size={20} className="me-3 text-success icon" />
                {/* أيقونة الدعم */}
                Technical Support
              </ListGroup.Item>
              {/* زر تسجيل الخروج كعنصر قائمة */}
              <ListGroup.Item
                action // قابل للنقر
                onClick={handleLogout} // استدعاء دالة الخروج عند النقر
                className="d-flex align-items-center text-danger logout-button-dashboard" // تنسيق خاص للخروج
                style={{ cursor: "pointer" }} // تغيير شكل المؤشر
              >
                <FaSignOutAlt size={20} className="me-3 icon" />
                {/* أيقونة الخروج */}
                Logout
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>
      </Row>
    </div> // نهاية الحاوية الرئيسية
  );
};

// تصدير المكون
export default MainDashboard;