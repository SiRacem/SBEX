// src/pages/MainDashboard.jsx
import React, {
  useEffect,
  useCallback,
  useState,
  useContext,
  useMemo, // استيراد useMemo إذا لم يكن موجودًا
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  FaGift,
  FaCheckCircle,
  FaQuestionCircle,
  FaExternalLinkAlt,
  FaInfoCircle,
} from "react-icons/fa";
import { BsClockHistory, BsXCircle, BsGearFill } from "react-icons/bs";
import {
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiSend,
  FiInbox,
} from "react-icons/fi";
import { logoutUser } from "../redux/actions/userAction";
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
  Offcanvas,
} from "react-bootstrap";
import useCurrencyDisplay from "../hooks/useCurrencyDisplay";
import { getMyMediationSummaries } from "../redux/actions/mediationAction";
import { getTransactionsForDashboard } from "../redux/actions/transactionAction";
import PendingFundsDetailsModal from "../components/commun/PendingFundsDetailsModal";
import TransactionDetailsProduct from "../components/commun/TransactionDetailsProduct";
import LanguageSwitcher from "../components/commun/LanguageSwitcher";
import { SocketContext } from "../App";
import { format } from "date-fns";
import { toast } from "react-toastify";

// --- [!] مكون منفصل لعرض عنصر المعاملة ---
const TransactionItem = ({ transaction, onShowDetails }) => {
  const { t } = useTranslation();

  // استدعاء الهوك هنا الآن صحيح وقانوني
  const amountDisplay = useCurrencyDisplay(Math.abs(transaction.amount));

  if (!transaction || !transaction._id) {
    return null;
  }

  let IconComponent = FaReceipt;
  let iconColorClass = "text-secondary";
  let amountPrefix = transaction.amount >= 0 ? "+ " : "- ";

  // ترجمة عنوان النشاط
  let title = t(`transactionTypes.${transaction.type}`, {
    productName:
      transaction.relatedProduct?.title ||
      transaction.metadata?.productTitle ||
      "Product",
    recipientName:
      transaction.recipient?.fullName ||
      transaction.metadata?.recipientName ||
      "User",
    senderName:
      transaction.sender?.fullName ||
      transaction.metadata?.senderName ||
      "User",
    level: transaction.metadata?.levelAchieved,
    defaultValue:
      transaction.description || transaction.type.replace(/_/g, " "),
  });

  switch (transaction.type) {
    case "PRODUCT_SALE_FUNDS_PENDING":
      IconComponent = FaHourglassHalf;
      iconColorClass = "text-warning";
      break;
    case "PRODUCT_SALE_FUNDS_RELEASED":
      IconComponent = FaCheckCircle;
      iconColorClass = "text-success";
      break;
    case "PRODUCT_PURCHASE_COMPLETED":
      IconComponent = FaReceipt;
      iconColorClass = "text-info";
      break;
    case "MEDIATION_FEE_RECEIVED":
      IconComponent = FaBalanceScale;
      iconColorClass = "text-success";
      break;
    case "LEVEL_UP_REWARD_RECEIVED":
      IconComponent = FaGift;
      iconColorClass = "text-info";
      break;
    case "DEPOSIT_COMPLETED":
      IconComponent = FiArrowDownCircle;
      iconColorClass = "text-success";
      break;
    case "WITHDRAWAL_COMPLETED":
      IconComponent = FiArrowUpCircle;
      iconColorClass = "text-danger";
      break;
    case "TRANSFER_SENT":
      IconComponent = FiSend;
      iconColorClass = "text-danger";
      break;
    case "TRANSFER_RECEIVED":
      IconComponent = FiInbox;
      iconColorClass = "text-success";
      break;
    default:
      if (transaction.amount > 0) iconColorClass = "text-success";
      else if (transaction.amount < 0) iconColorClass = "text-danger";
      break;
  }

  let StatusIcon = FaQuestionCircle;
  let statusBadgeVariant = "secondary";
  const statusLower = transaction.status?.toLowerCase();
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

  const statusText = t(
    `transactionStatuses.${transaction.status}`,
    transaction.status || "N/A"
  );

  return (
    <ListGroup.Item
      action
      onClick={() => onShowDetails(transaction)}
      className="px-3 py-3 d-flex justify-content-between align-items-center transaction-list-item-dash"
    >
      <div className="d-flex align-items-center" style={{ minWidth: 0 }}>
        {" "}
        {/* Prevent overflow */}
        <div
          className={`transaction-icon-dash me-3 ${iconColorClass.replace(
            "text-",
            "bg-"
          )}-soft p-2 rounded-circle`}
        >
          <IconComponent size={20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h6 className="mb-0 fw-medium transaction-title-dash text-truncate">
            {title}
            {transaction.relatedMediationRequest?._id && (
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip>
                    {t("transactionModal.viewMediation", "View Mediation")}
                  </Tooltip>
                }
              >
                <Link
                  to={`/dashboard/mediation-chat/${transaction.relatedMediationRequest._id}`}
                  className="ms-2 small text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaExternalLinkAlt size="0.7em" />
                </Link>
              </OverlayTrigger>
            )}
          </h6>
          <small className="text-muted transaction-date-dash">
            {transaction.createdAt
              ? format(new Date(transaction.createdAt), "PPp")
              : "N/A"}
          </small>
        </div>
      </div>
      <div className="text-end" style={{ whiteSpace: "nowrap" }}>
        {" "}
        {/* Prevent wrapping */}
        <span
          className={`fw-bold d-block transaction-amount-dash ${iconColorClass}`}
        >
          {amountPrefix}
          {amountDisplay.displayValue}
        </span>
        <Badge
          pill
          bg={statusBadgeVariant}
          className={`status-badge-dash d-flex align-items-center ${
            statusBadgeVariant === "warning" || statusBadgeVariant === "info"
              ? "text-dark"
              : ""
          }`}
        >
          {StatusIcon && <StatusIcon className="me-1" />}
          <span>{statusText}</span>
        </Badge>
      </div>
    </ListGroup.Item>
  );
};
// --- [!!!] نهاية المكون الجديد ---

const MainDashboard = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socket = useContext(SocketContext);

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
  const [showSettingsOffcanvas, setShowSettingsOffcanvas] = useState(false);

  const handleLogout = useCallback(() => {
    if (
      window.confirm(t("confirmLogout", "Are you sure you want to logout?"))
    ) {
      dispatch(logoutUser());
      navigate("/login");
    }
  }, [dispatch, navigate, t]);

  useEffect(() => {
    if (isAuth && user?._id) {
      dispatch(getNotifications());
      dispatch(getMyMediationSummaries());
      dispatch(getTransactionsForDashboard());
    }
  }, [dispatch, isAuth, user?._id]);

  const handleShowPendingFundsDetails = () => {
    if (user?.userRole === "Vendor" || user?.userRole === "Admin")
      setShowPendingFundsModal(true);
    else toast.info(t("forSellersOnly", "For sellers only."));
  };

  const handleShowTransactionDetails = useCallback((transaction) => {
    setSelectedTransactionForDetails(transaction);
    setShowTransactionDetailsModal(true);
  }, []);

  if (userLoading && !user)
    return (
      <Container
        fluid
        className="d-flex justify-content-center align-items-center vh-100"
      >
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  if (!isAuth && !userLoading)
    return (
      <Container fluid className="py-4 text-center">
        <Alert variant="warning">
          {t("pleaseLogin", "Please login to continue.")}
        </Alert>
        <Button as={Link} to="/login" variant="primary">
          {t("loginButton", "Login")}
        </Button>
      </Container>
    );
  if (!user) return null;

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
                <h5 className="mb-0">{t("dashboard.balances.principal")}</h5>
                <FaWallet size={24} />
              </div>
              <h3 className="display-6 fw-bold mb-1">
                {principalBalanceDisplay.displayValue}
              </h3>
              <p className="approx-value-maindash mb-3">
                {principalBalanceDisplay.approxValue}
              </p>
              <div className="d-flex justify-content-between align-items-center mt-auto">
                <span className="fw-bold username">{user.fullName}</span>
                <FaUserCircle size={20} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        {(user.userRole === "Vendor" || user.userRole === "Admin") && (
          <Col lg={4} md={6}>
            <Card className="info-box seller-box text-white p-3 rounded shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <h5 className="mb-0">
                    {t("dashboard.balances.sellerAvailable")}
                  </h5>
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
                  <h5 className="mb-0">{t("dashboard.balances.onHold")}</h5>
                  <FaHourglassHalf size={20} />
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
                className="comms-link d-flex align-items-center text-decoration-none mb-3"
              >
                <FaBell size={22} className="me-3 text-primary icon" />
                <span className="link-text flex-grow-1">
                  {t("dashboard.notifications.title")}
                </span>
                {/* Badge and Spinner */}
                <div className="d-flex align-items-center">
                  {!notificationsLoading && unreadCount > 0 && (
                    <Badge pill bg="danger" className="ms-2">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                  {notificationsLoading && (
                    <Spinner animation="border" size="sm" className="ms-2" />
                  )}
                </div>
              </Link>
              <hr className="my-2" />
              <Link
                to="/my-mediation-requests"
                className="comms-link d-flex align-items-center text-decoration-none mt-3"
              >
                <FaComments size={22} className="me-3 text-success icon" />
                <span className="link-text flex-grow-1">
                  {t("dashboard.mediations.title")}
                </span>
                {/* Badge and Spinner */}
                <div className="d-flex align-items-center">
                  {!mediationSummariesLoading &&
                    totalUnreadMediationMessages > 0 && (
                      <Badge pill bg="success" className="ms-2">
                        {totalUnreadMediationMessages > 99
                          ? "99+"
                          : totalUnreadMediationMessages}
                      </Badge>
                    )}
                  {mediationSummariesLoading && (
                    <Spinner animation="border" size="sm" className="ms-2" />
                  )}
                </div>
              </Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row className="g-4">
        <Col lg={8}>
          <Card className="shadow-sm mb-4 h-100 recent-transactions-card">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0 text-secondary">
                {t("dashboard.activities.title")}
              </h5>
              {!transactionsLoading && !transactionsError && (
                <span className="text-muted small">
                  {t("dashboard.activities.displaying", {
                    count: dashboardTransactions.length,
                  })}
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0 d-flex flex-column">
              {transactionsLoading ? (
                <div className="text-center p-5 flex-grow-1 d-flex justify-content-center align-items-center">
                  <Spinner animation="border" variant="primary" />
                  <span className="ms-2">
                    {t("walletPage.loadingActivity")}
                  </span>
                </div>
              ) : transactionsError ? (
                <div className="p-3">
                  <Alert variant="danger">{transactionsError}</Alert>
                </div>
              ) : dashboardTransactions.length > 0 ? (
                <ListGroup variant="flush" className="flex-grow-1">
                  {dashboardTransactions.map((tx) => (
                    <TransactionItem
                      key={tx._id}
                      transaction={tx}
                      onShowDetails={handleShowTransactionDetails}
                    />
                  ))}
                </ListGroup>
              ) : (
                <div
                  className="text-center p-5 d-flex flex-column justify-content-center align-items-center flex-grow-1"
                  style={{ minHeight: "200px" }}
                >
                  <FaReceipt size={40} className="text-muted opacity-50 mb-3" />
                  <h6 className="text-muted fw-normal">
                    {t("dashboard.activities.noActivities")}
                  </h6>
                  <p className="text-muted small mb-0">
                    {t("dashboard.activities.description")}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="shadow-sm options-card">
            <Card.Header className="bg-white text-center">
              <h5 className="mb-0 text-secondary">
                {t("dashboard.quickOptions.title")}
              </h5>
            </Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item
                action
                onClick={() => setShowSettingsOffcanvas(true)}
                className="d-flex align-items-center option-item"
                style={{ cursor: "pointer" }}
              >
                <BsGearFill size={20} className="me-3 text-secondary icon" />
                <span>{t("dashboard.quickOptions.settings")}</span>
              </ListGroup.Item>
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/latest-news"
                className="d-flex align-items-center option-item"
              >
                <FaNewspaper size={20} className="me-3 text-primary icon" />
                <span>{t("dashboard.quickOptions.news")}</span>
              </ListGroup.Item>
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/tickets"
                className="d-flex align-items-center option-item"
              >
                <FaHeadset size={20} className="me-3 text-success icon" />
                <span>{t("dashboard.quickOptions.support")}</span>
              </ListGroup.Item>
              <ListGroup.Item
                action
                onClick={handleLogout}
                className="d-flex align-items-center text-danger option-item logout-button-dashboard"
                style={{ cursor: "pointer" }}
              >
                <FaSignOutAlt size={20} className="me-3 icon" />
                <span>{t("dashboard.quickOptions.logout")}</span>
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>
      </Row>
      <Offcanvas
        show={showSettingsOffcanvas}
        onHide={() => setShowSettingsOffcanvas(false)}
        placement={i18n.dir() === "rtl" ? "start" : "end"}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{t("dashboard.settings.title")}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <h6 className="text-muted mb-3">
            {t("dashboard.settings.languageTitle")}
          </h6>
          <LanguageSwitcher as="list" />
          <hr className="my-4" />
        </Offcanvas.Body>
      </Offcanvas>
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