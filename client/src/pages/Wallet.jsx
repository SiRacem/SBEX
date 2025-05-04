// src/pages/Wallet.jsx
// *** نسخة كاملة نهائية مع إعادة دمج وعرض جميع أنواع الأنشطة ***

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Modal,
  Form,
  InputGroup,
  Spinner,
  Alert,
  ListGroup,
  FloatingLabel,
  Tooltip,
  OverlayTrigger,
  Image,
  Badge,
  ButtonGroup,
} from "react-bootstrap";
import {
  FaArrowDown,
  FaArrowUp,
  FaPaperPlane,
  FaReceipt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight,
  FaArrowLeft,
  FaSearch,
  FaWallet,
  FaUserCircle,
  FaBalanceScale,
  FaHourglassHalf,
  FaCopy,
  FaCheck,
  FaInfoCircle,
  FaTimesCircle,
  FaSpinner,
} from "react-icons/fa";
import axios from "axios";
import { format } from "date-fns";
// import { Link, useNavigate } from "react-router-dom"; // useNavigate غير مستخدم حالياً
import { getProfile } from "../redux/actions/userAction";
import { getTransactions } from "../redux/actions/transactionAction";
import { getUserDepositRequests } from "../redux/actions/depositAction";
import { getUserWithdrawalRequests } from "../redux/actions/withdrawalRequestAction";
import { toast } from "react-toastify";
import ActivityDetailsModal from "../components/commun/ActivityDetailsModal";
import DepositModal from "../components/commun/DepositModal";
import WithdrawalModal from "../components/commun/WithdrawalModal";
import CurrencySwitcher from "../components/commun/CurrencySwitcher";
import useCurrencyDisplay from "../hooks/useCurrencyDisplay";
// import "../components/commun/TransactionDetailsModal.css"; // افترض اسم الملف الصحيح إذا كان موجوداً
import "./Wallet.css";

const MIN_SEND_AMOUNT_TND = 6.0;
const TND_TO_USD_RATE = 3.0; // تأكد من تطابقه مع الـ Backend

// دالة تنسيق العملة
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  if (typeof currencyCode !== "string" || currencyCode.trim() === "")
    currencyCode = "TND";
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${currencyCode}`;
  }
};

// Helpers للحصول على التوكن
const getTokenConfig = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Token not found.");
    return null;
  }
  return { headers: { Authorization: `Bearer ${token}` } };
};
const getTokenJsonConfig = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Token not found.");
    return null;
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

// --- المكون الرئيسي ---
const Wallet = () => {
  const dispatch = useDispatch();
  // const navigate = useNavigate();

  // --- Selectors ---
  const userId = useSelector((state) => state.userReducer?.user?._id);
  const user = useSelector((state) => state.userReducer?.user);
  const userLoading = useSelector(
    (state) => state.userReducer?.loading ?? false
  );
  const transactions = useSelector(
    (state) => state.transactionReducer?.transactions ?? []
  );
  const transactionsLoading = useSelector(
    (state) => state.transactionReducer?.loading ?? false
  );
  const transactionsError = useSelector(
    (state) => state.transactionReducer?.error ?? null
  );
  const {
    userRequests: depositRequests = [],
    loadingUserRequests: depositsLoading = false,
    errorUserRequests: depositsError = null,
  } = useSelector((state) => state.depositRequestReducer || {});
  const {
    userRequests: withdrawalRequests = [],
    loadingUserRequests: withdrawalsLoading = false,
    errorUserRequests: withdrawalsError = null,
  } = useSelector((state) => state.withdrawalRequestReducer || {});
  const displayCurrencyGlobal = useSelector(
    (state) => state.ui?.displayCurrency || "TND"
  ); // العملة المختارة للعرض

  // --- Hooks ---
  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

  // --- State ---
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  // State لمودال الإرسال
  const [modalStep, setModalStep] = useState(1);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientUser, setRecipientUser] = useState(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailCheckError, setEmailCheckError] = useState(null);
  const [sendAmountTND, setSendAmountTND] = useState("");
  const [amountError, setAmountError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(null);
  // State لمودال الاستلام
  const [isCopied, setIsCopied] = useState(false);

  // --- Handlers ---
  // إغلاق مودال الإرسال وإعادة التعيين
  const handleCloseSendModal = useCallback(() => {
    setShowSendModal(false);
    setTimeout(() => {
      setModalStep(1);
      setRecipientEmail("");
      setRecipientUser(null);
      setEmailCheckError(null);
      setSendAmountTND("");
      setAmountError(null);
      setSendError(null);
      setSendSuccess(null);
      setIsCheckingEmail(false);
      setIsSending(false);
    }, 300); // تأخير بسيط للسماح بالانيميشن
  }, []);
  // فتح مودال الإرسال
  const handleShowSendModal = useCallback(() => {
    setEmailCheckError(null);
    setAmountError(null);
    setSendError(null);
    setSendSuccess(null);
    setRecipientEmail("");
    setRecipientUser(null);
    setSendAmountTND("");
    setModalStep(1);
    setShowSendModal(true);
  }, []);
  // التحقق من إيميل المستلم
  const handleCheckEmail = useCallback(async () => {
    if (!recipientEmail || !/\S+@\S+\.\S+/.test(recipientEmail)) {
      setEmailCheckError("Please enter a valid email.");
      return;
    }
    setEmailCheckError(null);
    setIsCheckingEmail(true);
    setRecipientUser(null);
    try {
      const config = getTokenJsonConfig();
      if (!config) throw new Error("Token not found.");
      const { data } = await axios.post(
        "/user/check-email",
        { email: recipientEmail },
        config
      );
      if (data && data._id) {
        if (data._id === userId) {
          setEmailCheckError("Cannot send funds to yourself.");
        } else {
          setRecipientUser(data);
        }
      } else {
        setEmailCheckError("User not found.");
      }
    } catch (error) {
      const status = error.response?.status;
      if (status === 404) setEmailCheckError("User with this email not found.");
      else if (status === 401) setEmailCheckError("Authorization error.");
      else setEmailCheckError("Error checking email. Please try again.");
      setRecipientUser(null);
    } finally {
      setIsCheckingEmail(false);
    }
  }, [recipientEmail, userId]);
  // معالجة تغيير مبلغ الإرسال
  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setSendAmountTND(value);
      setAmountError(null);
      if (value !== "") {
        const amountNum = parseFloat(value);
        if (isNaN(amountNum)) return;
        const minSend = MIN_SEND_AMOUNT_TND || 0.01;
        if (amountNum < minSend) {
          setAmountError(
            `Minimum send amount is ${formatCurrency(minSend, "TND")}`
          );
        } else if (user && amountNum > user.balance) {
          setAmountError("Insufficient principal balance");
        }
      } else {
        setAmountError("Amount is required");
      }
    }
  };
  // حساب القيمة المعادلة بالدولار
  const calculatedUSD = useMemo(() => {
    const amountNum = parseFloat(sendAmountTND);
    if (!isNaN(amountNum) && amountNum >= MIN_SEND_AMOUNT_TND) {
      return (amountNum / TND_TO_USD_RATE).toFixed(2);
    }
    return "0.00";
  }, [sendAmountTND]);
  // تأكيد وإرسال المبلغ
  const handleSendConfirm = useCallback(async () => {
    const amountToSend = parseFloat(sendAmountTND);
    const minSend = MIN_SEND_AMOUNT_TND || 0.01;
    if (
      isSending ||
      !recipientUser ||
      !sendAmountTND ||
      amountError ||
      amountToSend < minSend
    ) {
      return;
    }
    setIsSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const config = getTokenJsonConfig();
      if (!config) throw new Error("Authorization token not found.");
      const { data } = await axios.post(
        "/wallet/send",
        {
          recipientId: recipientUser._id,
          amount: amountToSend,
          currency: "TND",
        },
        config
      );
      setSendSuccess(data.msg || `Successfully sent funds!`);
      toast.success("Funds sent successfully!");
      dispatch(getProfile());
      dispatch(getTransactions());
      setTimeout(handleCloseSendModal, 2500);
    } catch (error) {
      const message =
        error.response?.data?.msg || error?.message || "Failed to send funds.";
      setSendError(message);
      toast.error(`Send failed: ${message}`);
    } finally {
      setIsSending(false);
    }
  }, [
    dispatch,
    recipientUser,
    sendAmountTND,
    amountError,
    isSending,
    handleCloseSendModal,
  ]);
  // الانتقال للخطوة التالية في مودال الإرسال
  const goToNextStep = useCallback(() => {
    const minSend = MIN_SEND_AMOUNT_TND || 0.01;
    if (modalStep === 1 && recipientUser) setModalStep(2);
    if (modalStep === 2 && !amountError && parseFloat(sendAmountTND) >= minSend)
      setModalStep(3);
  }, [modalStep, recipientUser, amountError, sendAmountTND]);
  // العودة للخطوة السابقة في مودال الإرسال
  const goToPrevStep = useCallback(() => {
    if (modalStep === 3) setModalStep(2);
    if (modalStep === 2) setModalStep(1);
  }, [modalStep]);
  // فتح مودال الاستلام
  const handleShowReceiveModal = useCallback(() => {
    setIsCopied(false);
    setShowReceiveModal(true);
  }, []);
  // إغلاق مودال الاستلام
  const handleCloseReceiveModal = useCallback(
    () => setShowReceiveModal(false),
    []
  );
  // نسخ الإيميل للحافظة
  const copyToClipboard = useCallback(
    (textToCopy = user?.email, successMessage = "Email Copied!") => {
      if (!textToCopy || isCopied) return;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          toast.success(successMessage);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 1500);
        })
        .catch((err) => {
          toast.error("Failed to copy.");
          console.error("Clipboard copy failed: ", err);
        });
    },
    [isCopied, user?.email]
  );
  // فتح مودال تفاصيل النشاط
  const handleShowActivityDetails = useCallback((activityItem) => {
    setSelectedActivity(activityItem);
    setShowActivityModal(true);
  }, []);
  // إغلاق مودال تفاصيل النشاط
  const handleCloseActivityDetails = useCallback(() => {
    setShowActivityModal(false);
    setSelectedActivity(null);
  }, []);

  // --- useEffect لجلب البيانات عند تحميل المكون ---
  useEffect(() => {
    if (userId) {
      console.log(
        "[Wallet Effect - Mount/User Change] Fetching all activity for user:",
        userId
      );
      dispatch(getProfile()); // جلب البروفايل للتأكد من حداثة الرصيد
      dispatch(getTransactions());
      dispatch(getUserDepositRequests());
      dispatch(getUserWithdrawalRequests());
    }
  }, [dispatch, userId]);

  // --- دمج البيانات للعرض في combinedHistory ---
  const combinedHistory = useMemo(() => {
    const depositsFormatted = (depositRequests || []).map((req) => ({
      _id: `dep-${req._id}`,
      type: "DEPOSIT_REQUEST",
      amount: req.amount,
      netAmount: req.netAmountCredited,
      currency: req.currency,
      status: req.status,
      rejectionReason: req.rejectionReason,
      methodName:
        req.paymentMethod?.displayName || req.paymentMethod?.name || "N/A",
      createdAt: new Date(req.createdAt),
      transactionId: req.transactionId,
      senderInfo: req.senderInfo,
      feeAmount: req.feeAmount, // إضافة الرسوم للتفاصيل
    }));
    const withdrawalsFormatted = (withdrawalRequests || []).map((req) => ({
      _id: `wd-${req._id}`,
      type: "WITHDRAWAL_REQUEST",
      amount: req.amount,
      netAmountToReceive: req.netAmountToReceive,
      currency: "TND",
      originalAmount: req.originalAmount,
      originalCurrency: req.originalCurrency,
      status: req.status,
      rejectionReason: req.rejectionReason,
      methodName:
        req.paymentMethod?.displayName || req.paymentMethod?.name || "N/A",
      createdAt: new Date(req.createdAt),
      feeAmount: req.feeAmount,
      withdrawalInfo: req.withdrawalInfo,
      transactionReference: req.transactionReference,
    }));
    const transfersFormatted = (transactions || []).map((tx) => ({
      _id: `tx-${tx._id}`,
      type: tx.type || "TRANSFER",
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status || "Completed",
      isSender: tx.sender?._id === userId,
      peerUser: tx.sender?._id === userId ? tx.recipient : tx.sender,
      createdAt: new Date(tx.createdAt),
      sender: tx.sender,
      recipient: tx.recipient,
    }));
    return [
      ...depositsFormatted,
      ...withdrawalsFormatted,
      ...transfersFormatted,
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [depositRequests, withdrawalRequests, transactions, userId]);

  // --- مؤشرات التحميل والخطأ المدمجة ---
  const isLoadingHistory =
    userLoading || transactionsLoading || depositsLoading || withdrawalsLoading;
  const historyError = transactionsError || depositsError || withdrawalsError;

  // --- دالة عرض عنصر السجل ---
  const renderHistoryItem = useCallback(
    (item) => {
      if (!item || !item._id) {
        console.warn(
          "Skipping rendering history item due to missing data:",
          item
        );
        return null;
      }
      let icon = <FaReceipt />;
      let title = item.type?.replace(/_/g, " ") || "Activity";
      let amountStr = "N/A";
      let amountClass = "text-secondary";
      let statusBadge = null;
      let prefix = "";
      let suffixInfo = "";
      switch (item.type) {
        case "DEPOSIT_REQUEST":
          icon = <FaArrowDown />;
          title = `Deposit via ${item.methodName}`;
          amountClass = "text-success";
          prefix = "+";
          amountStr = formatCurrency(item.netAmount, "TND"); // عرض الصافي بالدينار
          if (item.status === "Pending")
            statusBadge = (
              <Badge
                bg="warning"
                text="dark"
                className="ms-2 small status-badge"
              >
                Pending
              </Badge>
            );
          else if (item.status === "Rejected") {
            statusBadge = (
              <Badge bg="danger" className="ms-2 small status-badge">
                Rejected
              </Badge>
            );
            icon = <FaTimesCircle className="text-danger" />;
            amountClass = "text-danger text-decoration-line-through";
            amountStr = formatCurrency(item.amount, item.currency);
          } else if (item.status === "Completed") {
            statusBadge = (
              <Badge bg="success" className="ms-2 small status-badge">
                Completed
              </Badge>
            );
          }
          break;
        case "WITHDRAWAL_REQUEST":
          icon = <FaArrowUp />;
          title = `Withdrawal via ${item.methodName}`;
          amountClass = "text-danger";
          prefix = "-";
          if (item.originalAmount != null && item.originalCurrency) {
            amountStr = formatCurrency(
              item.originalAmount,
              item.originalCurrency
            );
          } else {
            amountStr = formatCurrency(item.amount, "TND");
          } // احتياطي
          if (item.status === "Pending") {
            statusBadge = (
              <Badge
                bg="warning"
                text="dark"
                className="ms-2 small status-badge"
              >
                Pending
              </Badge>
            );
            amountClass = "text-warning";
          } else if (item.status === "Processing") {
            statusBadge = (
              <Badge bg="info" text="dark" className="ms-2 small status-badge">
                Processing
              </Badge>
            );
            icon = <FaSpinner className="text-info" />;
            amountClass = "text-info";
          } else if (item.status === "Rejected") {
            statusBadge = (
              <Badge bg="danger" className="ms-2 small status-badge">
                Rejected
              </Badge>
            );
            icon = <FaTimesCircle className="text-danger" />;
            amountStr = formatCurrency(item.amount, "TND");
            prefix = "";
            amountClass = "text-success";
            suffixInfo = " (Refunded)";
          } else if (item.status === "Failed") {
            statusBadge = (
              <Badge bg="danger" className="ms-2 small status-badge">
                Failed
              </Badge>
            );
            icon = <FaExclamationTriangle className="text-danger" />;
          } else if (item.status === "Completed") {
            statusBadge = (
              <Badge bg="success" className="ms-2 small status-badge">
                Completed
              </Badge>
            );
          }
          break;
        case "TRANSFER":
          const isSender = item.isSender;
          const peer = item.peerUser;
          icon = isSender ? <FaArrowUp /> : <FaArrowDown />;
          title = `${isSender ? "Sent to" : "Received from"} ${
            peer?.fullName || peer?.email || "User"
          }`;
          amountClass = isSender ? "text-danger" : "text-success";
          prefix = isSender ? "-" : "+";
          amountStr = formatCurrency(item.amount, item.currency);
          statusBadge = (
            <Badge bg="success" className="ms-2 small status-badge">
              Completed
            </Badge>
          );
          break;
        default:
          amountStr = formatCurrency(item.amount, item.currency);
          break;
      }
      return (
        <ListGroup.Item
          key={item._id}
          action
          onClick={() => handleShowActivityDetails(item)}
          className={`transaction-item d-flex justify-content-between align-items-center px-3 py-3 status-${
            item.status?.toLowerCase() || "unknown"
          }`}
        >
          {" "}
          <div className="d-flex align-items-center">
            {" "}
            <div
              className={`transaction-icon me-3 ${
                amountClass === "text-danger" ? "sent" : "received"
              }`}
            >
              {icon}
            </div>{" "}
            <div>
              {" "}
              <div className="transaction-type-peer fw-bold">{title}</div>{" "}
              <div className="transaction-date text-muted small mt-1">
                {item.createdAt
                  ? format(new Date(item.createdAt), "Pp")
                  : "N/A"}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          <div className={`transaction-amount fw-bold fs-6 ${amountClass}`}>
            {prefix} {amountStr} {statusBadge}{" "}
            {suffixInfo && (
              <span className="text-muted small">{suffixInfo}</span>
            )}
          </div>{" "}
        </ListGroup.Item>
      );
    },
    [handleShowActivityDetails, userId]
  ); // إضافة userId للاعتماديات لأنه يُستخدم في تحديد isSender

  // --- Loading/Error checks ---
  if (userLoading && !user) {
    return (
      <Container
        fluid
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh" }}
      >
        {" "}
        <Spinner animation="border" variant="primary" />{" "}
        <span className="ms-2">Loading Wallet...</span>{" "}
      </Container>
    );
  }
  if (!user && !userLoading) {
    return (
      <Container fluid className="py-4">
        {" "}
        <Alert variant="danger" className="text-center">
          {" "}
          User data not available. Please login.{" "}
        </Alert>{" "}
      </Container>
    );
  }

  // --- Render ---
  return (
    <div className="wallet-page container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">My Wallet</h2>
        <CurrencySwitcher size="sm" />
      </div>

      <Row className="g-4">
        {/* Left Column */}
        <Col lg={8}>
          {/* Action Buttons */}
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}>
              <Button
                variant="success"
                className="action-button w-100 shadow-sm"
                onClick={() => setShowDepositModal(true)}
              >
                <FaArrowDown className="me-1" /> Deposit
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="danger"
                className="action-button w-100 shadow-sm"
                onClick={() => setShowWithdrawalModal(true)}
              >
                <FaArrowUp className="me-1" /> Withdraw
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="primary"
                className="action-button w-100 shadow-sm"
                onClick={handleShowSendModal}
              >
                <FaPaperPlane className="me-1" /> Send
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="info"
                className="action-button w-100 shadow-sm"
                onClick={handleShowReceiveModal}
              >
                <FaReceipt className="me-1" /> Receive
              </Button>
            </Col>
          </Row>
          {/* Recent Activity List */}
          <Card className="shadow-sm mb-4 transaction-card">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0 text-secondary">Recent Activity</h5>
              {!isLoadingHistory && !historyError && (
                <span className="text-muted small">
                  {" "}
                  Showing {combinedHistory.length} items{" "}
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {isLoadingHistory ? (
                <div className="text-center py-5">
                  {" "}
                  <Spinner animation="border" variant="primary" />{" "}
                  <p className="mt-2">Loading activity...</p>{" "}
                </div>
              ) : historyError ? (
                <Alert variant="danger" className="text-center m-3">
                  {" "}
                  Error fetching activity: {historyError}{" "}
                </Alert>
              ) : combinedHistory && combinedHistory.length > 0 ? (
                <ListGroup variant="flush" className="transaction-list">
                  {combinedHistory.map((item) => renderHistoryItem(item))}
                </ListGroup>
              ) : (
                <div
                  className="no-transactions-placeholder d-flex justify-content-center align-items-center flex-column text-center py-5"
                  style={{ minHeight: "200px" }}
                >
                  {" "}
                  <FaReceipt
                    size={40}
                    className="text-light-emphasis mb-3"
                  />{" "}
                  <h6 className="text-muted">No Activity Yet</h6>{" "}
                  <p className="text-muted small mb-0">
                    {" "}
                    Your wallet activity will appear here.{" "}
                  </p>{" "}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Right Column (Balances) */}
        <Col lg={4}>
          <Row className="g-4">
            <Col xs={12}>
              <Card className="shadow-sm balance-card balance-card-principal text-white h-100">
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <Card.Subtitle className="mb-1 text-white-75">
                        Principal Balance
                      </Card.Subtitle>
                      <Card.Title className="balance-amount display-5">
                        {principalBalanceDisplay.displayValue}
                      </Card.Title>
                      <small className="approx-value-wallet">
                        {principalBalanceDisplay.approxValue}
                      </small>
                    </div>
                    <FaWallet size={30} className="card-icon-bg" />
                  </div>
                  <div className="d-flex align-items-center user-info-wallet mt-auto">
                    <FaUserCircle size={18} className="me-2" />
                    <span className="fw-light small">{user.fullName}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            {(user.userRole === "Vendor" || user.userRole === "Admin") && (
              <>
                {" "}
                <Col xs={12} sm={6} lg={12}>
                  <Card className="shadow-sm balance-card balance-card-seller text-white h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <Card.Subtitle className="mb-1 text-white-75">
                            Seller Available
                          </Card.Subtitle>
                          <Card.Title className="balance-amount fs-3">
                            {sellerAvailableBalanceDisplay.displayValue}
                          </Card.Title>
                          <small className="approx-value-wallet">
                            {sellerAvailableBalanceDisplay.approxValue}
                          </small>
                        </div>
                        <FaBalanceScale size={26} className="card-icon-bg" />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>{" "}
                <Col xs={12} sm={6} lg={12}>
                  <Card className="shadow-sm balance-card balance-card-hold text-white h-100">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <Card.Subtitle className="mb-1 text-white-75">
                            On Hold
                          </Card.Subtitle>
                          <Card.Title className="balance-amount fs-3">
                            {sellerPendingBalanceDisplay.displayValue}
                          </Card.Title>
                          <small className="approx-value-wallet">
                            {sellerPendingBalanceDisplay.approxValue}
                          </small>
                        </div>
                        <FaHourglassHalf size={24} className="card-icon-bg" />
                      </div>
                    </Card.Body>
                  </Card>
                </Col>{" "}
              </>
            )}
          </Row>
        </Col>
      </Row>

      {/* ----- Modals ----- */}
      {/* Send Modal */}
      <Modal
        show={showSendModal}
        onHide={handleCloseSendModal}
        centered
        backdrop="static"
        className="send-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {modalStep === 1
              ? "Send Funds - Step 1: Recipient"
              : modalStep === 2
              ? "Send Funds - Step 2: Amount"
              : "Send Funds - Step 3: Confirm"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalStep === 1 && (
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckEmail();
              }}
            >
              {" "}
              <Form.Group controlId="recipientEmailInput" className="mb-3">
                {" "}
                <FloatingLabel
                  controlId="recipientEmailFloat"
                  label="Recipient's Email Address"
                >
                  {" "}
                  <Form.Control
                    type="email"
                    placeholder="name@example.com"
                    value={recipientEmail}
                    onChange={(e) => {
                      setRecipientEmail(e.target.value);
                      setRecipientUser(null);
                      setEmailCheckError(null);
                    }}
                    required
                    isInvalid={!!emailCheckError}
                    isValid={!!recipientUser && !emailCheckError}
                    autoFocus
                  />{" "}
                </FloatingLabel>{" "}
                <Form.Text
                  className={`d-block mt-1 ms-1 ${
                    emailCheckError ? "text-danger" : "text-success"
                  }`}
                >
                  {" "}
                  {isCheckingEmail ? (
                    <Spinner animation="border" size="sm" as="span" />
                  ) : emailCheckError ? (
                    <>
                      <FaExclamationTriangle className="me-1" />{" "}
                      {emailCheckError}
                    </>
                  ) : recipientUser ? (
                    <>
                      <FaCheckCircle className="me-1" />{" "}
                      {recipientUser.fullName}
                    </>
                  ) : (
                    <>​</>
                  )}{" "}
                </Form.Text>{" "}
              </Form.Group>{" "}
              <Button
                variant="secondary"
                onClick={handleCheckEmail}
                disabled={isCheckingEmail || !recipientEmail}
                className="w-100 check-email-btn"
              >
                {isCheckingEmail ? (
                  "Checking..."
                ) : (
                  <>
                    <FaSearch className="me-1" /> Check Email
                  </>
                )}
              </Button>{" "}
            </Form>
          )}
          {modalStep === 2 && recipientUser && (
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                goToNextStep();
              }}
            >
              {" "}
              <Alert
                variant="light"
                className="text-center mb-3 recipient-info"
              >
                Sending to: <strong>{recipientUser.fullName}</strong> (
                {recipientUser.email})
              </Alert>{" "}
              <Form.Group className="mb-3">
                <Form.Label>Available Balance</Form.Label>
                <Form.Control
                  type="text"
                  value={principalBalanceDisplay.displayValue}
                  readOnly
                  disabled
                />
                <Form.Text className="text-muted d-block">
                  {principalBalanceDisplay.approxValue}
                </Form.Text>
              </Form.Group>{" "}
              <Form.Group controlId="sendAmountInput">
                <FloatingLabel
                  label={`Amount (Min ${formatCurrency(
                    MIN_SEND_AMOUNT_TND,
                    "TND"
                  )})`}
                  className="mb-1"
                >
                  <InputGroup>
                    <Form.Control
                      type="number"
                      placeholder="0.00"
                      value={sendAmountTND}
                      onChange={handleAmountChange}
                      required
                      min={MIN_SEND_AMOUNT_TND}
                      step="0.01"
                      isInvalid={!!amountError}
                      autoFocus
                    />
                    <InputGroup.Text>TND</InputGroup.Text>
                  </InputGroup>
                  <Form.Control.Feedback type="invalid">
                    {amountError}
                  </Form.Control.Feedback>
                </FloatingLabel>
                <Form.Text className="text-muted d-block text-end">
                  ~ {formatCurrency(calculatedUSD, "USD")}
                </Form.Text>
              </Form.Group>{" "}
            </Form>
          )}
          {modalStep === 3 && recipientUser && (
            <div className="confirmation-details">
              <h5 className="text-center mb-3">Confirm Transaction:</h5>{" "}
              {sendError && <Alert variant="danger">{sendError}</Alert>}{" "}
              {sendSuccess && <Alert variant="success">{sendSuccess}</Alert>}{" "}
              <ListGroup variant="flush" className="mb-3">
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>To:</span>
                  <strong>
                    {recipientUser.fullName} ({recipientUser.email})
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Amount ({displayCurrencyGlobal}):</span>
                  <strong>
                    {formatCurrency(
                      displayCurrencyGlobal === "USD"
                        ? parseFloat(sendAmountTND) / TND_TO_USD_RATE
                        : parseFloat(sendAmountTND),
                      displayCurrencyGlobal
                    )}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>
                    Approx. {displayCurrencyGlobal === "USD" ? "TND" : "USD"}:
                  </span>
                  <strong>
                    ~{" "}
                    {formatCurrency(
                      displayCurrencyGlobal === "USD"
                        ? parseFloat(sendAmountTND)
                        : parseFloat(sendAmountTND) / TND_TO_USD_RATE,
                      displayCurrencyGlobal === "USD" ? "TND" : "USD"
                    )}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between total-amount pt-3 mt-2 border-top">
                  <span>Total Deducted (TND):</span>
                  <strong className="fs-5 text-danger">
                    {formatCurrency(parseFloat(sendAmountTND), "TND")}
                  </strong>
                </ListGroup.Item>
              </ListGroup>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          {" "}
          {modalStep > 1 && (
            <Button
              variant="outline-secondary"
              onClick={goToPrevStep}
              disabled={isSending}
            >
              <FaArrowLeft className="me-1" /> Back
            </Button>
          )}{" "}
          {(modalStep === 1 || (modalStep === 3 && !sendSuccess)) && (
            <Button
              variant="secondary"
              onClick={handleCloseSendModal}
              disabled={isSending}
            >
              Close
            </Button>
          )}{" "}
          {modalStep === 1 && (
            <Button
              variant="primary"
              onClick={goToNextStep}
              disabled={!recipientUser || isCheckingEmail}
            >
              Next <FaArrowRight className="ms-1" />
            </Button>
          )}{" "}
          {modalStep === 2 && (
            <Button
              variant="primary"
              onClick={goToNextStep}
              disabled={
                !!amountError ||
                !sendAmountTND ||
                parseFloat(sendAmountTND) < MIN_SEND_AMOUNT_TND
              }
            >
              Next <FaArrowRight className="ms-1" />
            </Button>
          )}{" "}
          {modalStep === 3 && (
            <Button
              variant="success"
              onClick={handleSendConfirm}
              disabled={isSending || !!sendSuccess}
            >
              {isSending ? (
                <>
                  <Spinner size="sm" animation="border" /> Sending...
                </>
              ) : (
                "Confirm & Send"
              )}
            </Button>
          )}{" "}
        </Modal.Footer>
      </Modal>
      {/* Receive Modal */}
      <Modal show={showReceiveModal} onHide={handleCloseReceiveModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaReceipt className="me-2" /> Receive Funds
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p className="mb-3">Share your email address with the sender:</p>
          <InputGroup className="mb-3 receive-email-group">
            <Form.Control
              type="email"
              value={user?.email || "Loading..."}
              readOnly
              className="receive-email-input"
              aria-label="Your email address"
            />
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{isCopied ? "Copied!" : "Copy Email"}</Tooltip>}
            >
              <span className="d-inline-block">
                <Button
                  variant={isCopied ? "success" : "outline-secondary"}
                  onClick={() => copyToClipboard(user?.email, "Email Copied!")}
                  className="copy-button"
                  disabled={isCopied || !user?.email}
                  style={isCopied ? { pointerEvents: "none" } : {}}
                >
                  {isCopied ? <FaCheck /> : <FaCopy />}
                </Button>
              </span>
            </OverlayTrigger>
          </InputGroup>
          <p className="text-muted small">
            Registered users can send funds to this email.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseReceiveModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Activity Details Modal */}
      <ActivityDetailsModal
        show={showActivityModal}
        onHide={handleCloseActivityDetails}
        item={selectedActivity}
        currentUserId={userId}
      />
      {/* Deposit Modal */}
      <DepositModal
        show={showDepositModal}
        onHide={() => setShowDepositModal(false)}
      />
      {/* Withdrawal Modal */}
      <WithdrawalModal
        show={showWithdrawalModal}
        onHide={() => setShowWithdrawalModal(false)}
      />
    </div> // نهاية Wallet Page
  );
};

export default Wallet;
