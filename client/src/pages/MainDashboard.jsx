// src/pages/MainDashboard.jsx
import React, { useEffect, useCallback, useState, useContext } from "react";
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
  const { t } = useTranslation();
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
    if (window.confirm(t("confirmLogout"))) {
      // استخدام الترجمة للتأكيد
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
    else toast.info(t("forSellersOnly"));
  };

  const handleShowTransactionDetails = useCallback((transaction) => {
    setSelectedTransactionForDetails(transaction);
    setShowTransactionDetailsModal(true);
  }, []);

  const renderTransactionItem = (tx) => {
    // ... (منطق renderTransactionItem كما هو)
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

  if (userLoading && !user)
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
        <span className="ms-3 fs-5">Loading Dashboard...</span>
      </Container>
    );
  if (!isAuth && !userLoading)
    return (
      <Container fluid className="py-4 text-center">
        <Alert variant="warning">Please login to view the dashboard.</Alert>
        <Button as={Link} to="/login" variant="primary">
          Login
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
        {/* Balance and Comms Cards */}
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
                  <div className="d-flex align-items-center">
                    <FaHourglassHalf size={20} className="me-2" />
                    {user.sellerPendingBalance > 0 && (
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
                <span className="link-text">
                  {t("dashboard.notifications.title")}
                </span>
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
                <span className="link-text">
                  {t("dashboard.mediations.title")}
                </span>
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
                {t("dashboard.quickOptions.settings")}
              </ListGroup.Item>
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/latest-news"
                className="d-flex align-items-center option-item"
              >
                <FaNewspaper size={20} className="me-3 text-primary icon" />
                {t("dashboard.quickOptions.news")}
              </ListGroup.Item>
              <ListGroup.Item
                action
                as={Link}
                to="/dashboard/tickets"
                className="d-flex align-items-center option-item"
              >
                <FaHeadset size={20} className="me-3 text-success icon" />
                {t("dashboard.quickOptions.support")}
              </ListGroup.Item>
              <ListGroup.Item
                action
                onClick={handleLogout}
                className="d-flex align-items-center text-danger option-item logout-button-dashboard"
                style={{ cursor: "pointer" }}
              >
                <FaSignOutAlt size={20} className="me-3 icon" />
                {t("dashboard.quickOptions.logout")}
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

      <Offcanvas
        show={showSettingsOffcanvas}
        onHide={() => setShowSettingsOffcanvas(false)}
        placement="end"
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
    </div>
  );
};

export default MainDashboard;
