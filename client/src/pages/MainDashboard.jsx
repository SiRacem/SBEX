// src/pages/MainDashboard.jsx
import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useContext,
} from "react";
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
  FaArrowDown,
  FaInfoCircle,
  FaGift,
  FaCheckCircle,
  FaQuestionCircle,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { BsClockHistory, BsXCircle, BsGearFill } from "react-icons/bs";
import {
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiSend,
  FiInbox,
} from "react-icons/fi";
import { logoutUser, getProfile } from "../redux/actions/userAction"; // getProfile لا يزال مستورداً ولكنه غير مستخدم مباشرة هنا
import { getNotifications } from "../redux/actions/notificationAction";
import {
  Badge,
  Spinner,
  Card,
  Container,
  Row,
  Col,
  Alert,
  ListGroup,
  Button,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import useCurrencyDisplay from "../hooks/useCurrencyDisplay";
import { getMyMediationSummaries } from "../redux/actions/mediationAction";
import PendingFundsDetailsModal from "../components/commun/PendingFundsDetailsModal";
import TransactionDetailsProduct from "../components/commun/TransactionDetailsProduct";
import { getTransactionsForDashboard } from "../redux/actions/transactionAction";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { SocketContext } from "../App"; // SocketContext سيتم توفيره من App.js

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "")
    safeCurrencyCode = "TND";
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const MainDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socket = useContext(SocketContext); // احصل على الـ socket من الـ Context

  const currentUserState = useSelector((state) => state.userReducer);
  const user = currentUserState?.user;
  const isAuth = currentUserState?.isAuth ?? false;
  const userLoading = currentUserState?.loading ?? false;

  const unreadCount = useSelector(
    (state) => state.notificationReducer?.unreadCount ?? 0
  );
  const notificationsLoading = useSelector(
    (state) => state.notificationReducer?.loading ?? false
  );
  const notificationError = useSelector(
    (state) => state.notificationReducer?.error ?? null
  );

  const {
    dashboardTransactions = [],
    loading: transactionsLoading = false,
    error: transactionsError = null,
  } = useSelector(
    (state) =>
      state.transactionReducer?.dashboardSection || {
        dashboardTransactions: [],
        loading: false,
        error: null,
      }
  );

  const totalUnreadMediationMessages = useSelector(
    (state) =>
      state.mediationReducer?.myMediationSummaries?.totalUnreadMessagesCount ??
      0
  );
  const mediationSummariesLoading = useSelector(
    (state) => state.mediationReducer?.myMediationSummaries?.loading ?? false
  );

  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

  const [showPendingFundsModal, setShowPendingFundsModal] = useState(false);
  const [showTransactionDetailsModal, setShowTransactionDetailsModal] =
    useState(false);
  const [selectedTransactionForDetails, setSelectedTransactionForDetails] =
    useState(null);

  const handleLogout = useCallback(() => {
    if (window.confirm("Are you sure you want to logout?")) {
      dispatch(logoutUser());
      navigate("/login");
    }
  }, [dispatch, navigate]);

  useEffect(() => {
    if (isAuth && user?._id) {
      dispatch(getNotifications());
      dispatch(getMyMediationSummaries());
      dispatch(getTransactionsForDashboard());
    }
  }, [dispatch, isAuth, user?._id]);

  // تم نقل منطق الاستماع لـ 'dashboard_transactions_updated' و 'user_balances_updated'
  // إلى App.js ليكون مركزيًا ويتجنب إعادة ربط المستمعين بشكل غير ضروري هنا
  // أو استدعاء getProfile بشكل متكرر من هنا.
  // سيعمل App.js على تحديث البيانات ذات الصلة في Redux store،
  // و MainDashboard سيُعاد عرضه تلقائيًا بسبب التغييرات في useSelector.

  // مثال: إذا تم تحديث الأرصدة عبر socket في App.js وتحديث user في Redux،
  // فإن useCurrencyDisplay سيُعاد حسابه تلقائيًا.
  // إذا تم تحديث dashboardTransactions عبر socket في App.js،
  // فإن useSelector لـ dashboardTransactions سيُحدِّث الواجهة هنا.

  const handleShowPendingFundsDetails = () => {
    if (user?.userRole === "Vendor" || user?.userRole === "Admin")
      setShowPendingFundsModal(true);
    else toast.info("For sellers.");
  };

  const handleShowTransactionDetails = useCallback((transaction) => {
    console.log("handleShowTransactionDetails called with:", transaction);
    setSelectedTransactionForDetails(transaction);
    setShowTransactionDetailsModal(true);
  }, []);

  const renderTransactionItem = (tx) => {
    if (!tx || !tx._id) return null;
    let IconComponent = FaReceipt;
    let iconColorClass = "text-secondary";
    let title = tx.description || tx.type?.replace(/_/g, " ") || "Transaction";
    let amountPrefix = "";
    let displayAmount = tx.amount;
    let displayCurrency = tx.currency;
    const statusLower = tx.status?.toLowerCase();
    switch (tx.type) {
      case "PRODUCT_SALE_FUNDS_PENDING":
        IconComponent = FaHourglassHalf;
        title = `Sale: ${
          tx.relatedProduct?.title || tx.metadata?.productTitle || "Product"
        } (On Hold)`;
        iconColorClass = "text-warning";
        amountPrefix = "+ ";
        break;
      case "PRODUCT_SALE_FUNDS_RELEASED":
        IconComponent = FaCheckCircle;
        title = `Funds Released: ${
          tx.relatedProduct?.title || tx.metadata?.productTitle || "Product"
        }`;
        iconColorClass = "text-success";
        amountPrefix = "+ ";
        break;
      case "PRODUCT_PURCHASE_COMPLETED":
        IconComponent = FaReceipt;
        title = `Purchase: ${
          tx.relatedProduct?.title || tx.metadata?.productTitle || "Product"
        }`;
        iconColorClass = "text-info";
        amountPrefix = "- ";
        break;
      case "MEDIATION_FEE_RECEIVED":
        IconComponent = FaBalanceScale;
        title = `Mediation Fee: ${
          tx.metadata?.productTitle ||
          tx.relatedMediationRequest?.product?.title ||
          "Mediation"
        }`;
        iconColorClass = "text-success";
        amountPrefix = "+ ";
        break;
      case "LEVEL_UP_REWARD_RECEIVED":
        IconComponent = FaGift;
        title = `Level Up Reward: Level ${tx.metadata?.levelAchieved || ""}`;
        iconColorClass = "text-info";
        amountPrefix = "+ ";
        break;
      case "DEPOSIT_COMPLETED":
        IconComponent = FiArrowDownCircle;
        title = `Deposit: ${
          tx.metadata?.method || tx.description || "Bank Deposit"
        }`;
        iconColorClass = "text-success";
        amountPrefix = "+ ";
        break;
      case "WITHDRAWAL_COMPLETED":
        IconComponent = FiArrowUpCircle;
        title = `Withdrawal: ${
          tx.metadata?.method || tx.description || "Bank Withdrawal"
        }`;
        iconColorClass = "text-danger";
        amountPrefix = "- ";
        break;
      case "TRANSFER_SENT":
        IconComponent = FiSend;
        title = `Sent to: ${
          tx.recipient?.fullName || tx.metadata?.recipientName || "User"
        }`;
        iconColorClass = "text-danger";
        amountPrefix = "- ";
        break;
      case "TRANSFER_RECEIVED":
        IconComponent = FiInbox;
        title = `Received from: ${
          tx.sender?.fullName || tx.metadata?.senderName || "User"
        }`;
        iconColorClass = "text-success";
        amountPrefix = "+ ";
        break;
      default:
        title = tx.description || tx.type?.replace(/_/g, " ") || "Transaction";
        if (
          tx.amount > 0 &&
          (tx.type?.includes("RECEIVED") ||
            tx.type?.includes("DEPOSIT") ||
            tx.type?.includes("CREDIT") ||
            tx.type?.includes("RELEASED"))
        ) {
          iconColorClass = "text-success";
          amountPrefix = "+ ";
        } else if (
          tx.amount < 0 ||
          tx.type?.includes("SENT") ||
          tx.type?.includes("WITHDRAWAL") ||
          tx.type?.includes("DEBIT") ||
          tx.type?.includes("PURCHASE")
        ) {
          iconColorClass = "text-danger";
        } else {
          iconColorClass = "text-secondary";
        }
        break;
    }
    let StatusIcon = FaQuestionCircle;
    let statusBadgeVariant = "secondary";
    switch (statusLower) {
      case "pending":
        StatusIcon = BsClockHistory;
        statusBadgeVariant = "warning";
        break;
      case "processing":
        StatusIcon = BsGearFill;
        statusBadgeVariant = "info";
        break;
      case "failed":
      case "rejected":
      case "cancelled":
        StatusIcon = BsXCircle;
        statusBadgeVariant = "danger";
        break;
      case "on_hold":
        StatusIcon = FaHourglassHalf;
        statusBadgeVariant = "warning";
        break;
      case "completed":
        StatusIcon = FaCheckCircle;
        statusBadgeVariant = "success";
        break;
    }
    const amountString = formatCurrency(
      Math.abs(displayAmount),
      displayCurrency
    );

    return (
      <ListGroup.Item
        key={tx._id}
        action
        onClick={() => handleShowTransactionDetails(tx)}
        className="px-3 py-3 d-flex justify-content-between align-items-center transaction-list-item-dash"
        style={{ cursor: "pointer" }}
      >
        <div className="d-flex align-items-center">
          <div
            className={`transaction-icon-dash me-3 ${iconColorClass.replace(
              "text-",
              "bg-"
            )}-soft p-2 rounded-circle`}
          >
            <IconComponent size={20} />
          </div>
          <div>
            <h6 className="mb-0 fw-medium transaction-title-dash">
              {title}
              {tx.relatedMediationRequest?._id && (
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id={`tooltip-tx-${tx._id}`}>
                      View Mediation Details
                    </Tooltip>
                  }
                >
                  <Link
                    to={`/dashboard/mediation-chat/${tx.relatedMediationRequest._id}`}
                    className="ms-2 small text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FaExternalLinkAlt size="0.7em" />
                  </Link>
                </OverlayTrigger>
              )}
            </h6>
            <small className="text-muted transaction-date-dash">
              {tx.createdAt ? format(new Date(tx.createdAt), "PPp") : "N/A"}
            </small>
          </div>
        </div>
        <div className="text-end">
          <span
            className={`fw-bold d-block transaction-amount-dash ${iconColorClass}`}
          >
            {amountPrefix}
            {amountString}
          </span>
          <Badge
            pill
            bg={statusBadgeVariant}
            className={`status-badge-dash ${
              statusBadgeVariant === "warning" || statusBadgeVariant === "info"
                ? "text-dark"
                : ""
            }`}
          >
            {StatusIcon && <StatusIcon className="me-1" />}
            {tx.status || "N/A"}
          </Badge>
        </div>
      </ListGroup.Item>
    );
  };

  // --- بداية قسم التحقق من حالة التحميل والمستخدم ---
  // مهم جداً لتقديم تجربة مستخدم جيدة أثناء التحميل ومنع الاختفاء المفاجئ
  if (userLoading && !user && !currentUserState.error) {
    // إذا كان التحميل جاري ولم يتم جلب المستخدم بعد ولم يكن هناك خطأ بعد
    console.log(
      "[MainDashboard] Rendering global loading state (user loading, no user yet)"
    );
    return (
      <Container
        fluid
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh" }}
      >
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <span className="ms-3 fs-5">Loading Dashboard Data...</span>
      </Container>
    );
  }

  if (!isAuth && !userLoading) {
    // إذا لم يكن مصادقًا عليه وانتهى التحميل
    console.log("[MainDashboard] Not authenticated, navigating to login.");
    // لا تعرض شيئاً هنا، ProtectedRoute في App.js سيعيد التوجيه
    // أو يمكنك عرض رسالة "الرجاء تسجيل الدخول" إذا كان هذا المكون يُعرض بطريقة ما بدون ProtectedRoute
    return (
      <Container fluid className="py-4 text-center">
        <Alert variant="warning">Please login to view the dashboard.</Alert>
        <Button as={Link} to="/login" variant="primary">
          Login
        </Button>
      </Container>
    );
  }

  if (isAuth && !user && !userLoading && currentUserState.error) {
    // مصادق عليه ولكن فشل جلب بيانات المستخدم
    console.log(
      "[MainDashboard] Error fetching user profile:",
      currentUserState.error
    );
    return (
      <Container fluid className="py-4 text-center">
        <Alert variant="danger">
          Error loading your profile: {currentUserState.error}. Please try
          <Button
            variant="link"
            onClick={() => dispatch(getProfile())}
            className="p-0 ms-1 me-1"
          >
            retrying
          </Button>
          or logging out and in again.
        </Alert>
        <Button onClick={handleLogout} variant="outline-secondary">
          Logout
        </Button>
      </Container>
    );
  }

  if (isAuth && !user && !userLoading && !currentUserState.error) {
    // مصادق عليه ولكن لا يوجد بيانات مستخدم لسبب غير معروف (نادر جداً)
    console.log(
      "[MainDashboard] Authenticated, but no user data and no error. This is unusual."
    );
    return (
      <Container fluid className="py-4 text-center">
        <Alert variant="info">
          Loading user data... If this persists, please try refreshing or
          logging out and in again.
        </Alert>
        <Button
          onClick={handleLogout}
          variant="outline-secondary"
          className="me-2"
        >
          Logout
        </Button>
        <Button
          onClick={() => window.location.reload()}
          variant="outline-primary"
        >
          Refresh Page
        </Button>
      </Container>
    );
  }

  if (!user) {
    // حالة افتراضية إذا لم يتمكن أي من الشروط السابقة من التعامل مع الوضع
    console.log("[MainDashboard] No user data available to render dashboard.");
    return null; // أو عرض مكون تحميل/خطأ عام أكثر
  }
  // --- نهاية قسم التحقق من حالة التحميل والمستخدم ---

  return (
    <div className="dashboard-container container-fluid py-4">
      {notificationError && (
        <Alert variant="warning" dismissible>
          Notifications Error: {notificationError}
        </Alert>
      )}
      <Row className="g-4 mb-4">
        <Col lg={4} md={6}>
          <Card className="info-box balance-box text-white p-3 rounded shadow-sm h-100">
            <Card.Body className="d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Principal Balance</h5>
                <FaWallet size={24} />
              </div>
              <h3 className="display-6 fw-bold mb-1">
                {principalBalanceDisplay.displayValue}
              </h3>
              <p className="approx-value-maindash mb-3">
                {principalBalanceDisplay.approxValue}
              </p>
              <div className="d-flex align-items-center mt-auto">
                <FaUserCircle size={20} className="me-2" />
                <span className="fw-bold username">{user.fullName}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
        {(user.userRole === "Vendor" || user.userRole === "Admin") && (
          <Col lg={4} md={6}>
            <Card className="info-box seller-box text-white p-3 rounded shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="mb-0">Seller Available</h5>
                  <FaBalanceScale size={24} />
                </div>
                <h4 className="fw-bold mb-1">
                  {sellerAvailableBalanceDisplay.displayValue}
                </h4>
                <p className="approx-value-maindash mb-2">
                  {sellerAvailableBalanceDisplay.approxValue}
                </p>
                <hr className="border-light opacity-50 my-2" />
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="mb-0">On Hold Balance</h5>
                  <div className="d-flex align-items-center">
                    <FaHourglassHalf size={20} className="me-2" />
                    {user.sellerPendingBalance &&
                      parseFloat(
                        String(user.sellerPendingBalance).replace(
                          /[^\d.-]/g,
                          ""
                        )
                      ) > 0 && (
                        <Button
                          variant="link"
                          className="p-0 text-white-75 icon-button-hover"
                          onClick={handleShowPendingFundsDetails}
                          title="View On Hold Details"
                        >
                          <FaInfoCircle size={18} />
                        </Button>
                      )}
                  </div>
                </div>
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
        <Col
          lg={4}
          md={user.userRole === "Vendor" || user.userRole === "Admin" ? 12 : 6}
        >
          <Card className="info-box comms-box p-3 rounded shadow-sm h-100">
            <Card.Body>
              <Link
                to="/dashboard/notifications"
                className="comms-link d-flex align-items-center text-decoration-none mb-3 position-relative"
              >
                <FaBell size={22} className="me-3 text-primary icon" />
                <span className="link-text">Notifications</span>
                {!notificationsLoading && unreadCount > 0 && (
                  <Badge pill bg="danger" className="notification-link-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
                {notificationsLoading && (
                  <Spinner
                    animation="border"
                    size="sm"
                    variant="secondary"
                    className="ms-2"
                  />
                )}
              </Link>
              <hr className="my-2" />
              <Link
                to="/dashboard/mediations"
                className="comms-link d-flex align-items-center text-decoration-none mt-3 position-relative"
              >
                <FaComments size={22} className="me-3 text-success icon" />
                <span className="link-text">Mediations / Messages</span>
                {!mediationSummariesLoading &&
                  totalUnreadMediationMessages > 0 && (
                    <Badge
                      pill
                      bg="success"
                      className="notification-link-badge"
                    >
                      {totalUnreadMediationMessages > 99
                        ? "99+"
                        : totalUnreadMediationMessages}
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
      <Row className="g-4">
        <Col lg={8}>
          <Card className="shadow-sm mb-4 h-100 recent-transactions-card">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0 text-secondary">Recent Activities</h5>
              {!transactionsLoading && !transactionsError && (
                <span className="text-muted small">
                  Displaying last {dashboardTransactions.length} activities
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0 d-flex flex-column">
              {transactionsLoading ? (
                <div className="text-center p-5 flex-grow-1 d-flex justify-content-center align-items-center">
                  <Spinner
                    animation="border"
                    variant="primary"
                    style={{ width: "2rem", height: "2rem" }}
                  />
                  <span className="ms-2">Loading Activities...</span>
                </div>
              ) : transactionsError ? (
                <div className="p-3">
                  <Alert variant="danger" className="mb-0">
                    Error: {transactionsError}
                  </Alert>
                </div>
              ) : dashboardTransactions.length > 0 ? (
                <ListGroup variant="flush" className="flex-grow-1">
                  {dashboardTransactions.map(renderTransactionItem)}
                </ListGroup>
              ) : (
                <div
                  className="text-center p-5 d-flex flex-column justify-content-center align-items-center flex-grow-1"
                  style={{ minHeight: "200px" }}
                >
                  <FaReceipt size={40} className="text-muted opacity-50 mb-3" />
                  <h6 className="text-muted fw-normal">No Recent Activities</h6>
                  <p className="text-muted small mb-0">
                    Your platform activities will appear here.
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="shadow-sm options-card">
            <Card.Header className="bg-white text-center">
              <h5 className="mb-0 text-secondary">Quick Options</h5>
            </Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/latest-news"
                className="d-flex align-items-center option-item"
              >
                <FaNewspaper size={20} className="me-3 text-primary icon" />
                Latest News & Updates
              </ListGroup.Item>
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/support"
                className="d-flex align-items-center option-item"
              >
                <FaHeadset size={20} className="me-3 text-success icon" />
                Technical Support
              </ListGroup.Item>
              <ListGroup.Item
                action
                onClick={handleLogout}
                className="d-flex align-items-center text-danger option-item logout-button-dashboard"
                style={{ cursor: "pointer" }}
              >
                <FaSignOutAlt size={20} className="me-3 icon" />
                Logout
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>
      </Row>
      {user && (user.userRole === "Vendor" || user.userRole === "Admin") && (
        <PendingFundsDetailsModal
          show={showPendingFundsModal}
          onHide={() => setShowPendingFundsModal(false)}
        />
      )}
      {selectedTransactionForDetails && (
        <TransactionDetailsProduct
          show={showTransactionDetailsModal}
          onHide={() => {
            setShowTransactionDetailsModal(false);
            setSelectedTransactionForDetails(null);
          }}
          transaction={selectedTransactionForDetails}
        />
      )}
    </div>
  );
};

export default MainDashboard;