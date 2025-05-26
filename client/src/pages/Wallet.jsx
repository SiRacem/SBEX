// src/pages/Wallet.jsx

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
  Badge,
  ButtonGroup,
} from "react-bootstrap";
// --- استيراد الأيقونات ---
import {
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
} from "react-icons/fa";
import { BsClockHistory, BsXCircle, BsGearFill } from "react-icons/bs";
import {
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiSend,
  FiInbox,
} from "react-icons/fi";
import { IoWalletOutline } from "react-icons/io5";
// -------------------------
import axios from "axios";
import { format } from "date-fns";
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
import "./Wallet.css";

// --- الدوال والمتغيرات المساعدة ---
const MIN_SEND_AMOUNT_TND = 6.0;
const TND_TO_USD_RATE = 3.0;
const MIN_SEND_AMOUNT_USD = MIN_SEND_AMOUNT_TND / TND_TO_USD_RATE;
const TRANSFER_FEE_PERCENT = 2;

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.warn(
      `Currency formatting error for code '${safeCurrencyCode}':`,
      error
    );
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

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
// --------------------------------

// --- المكون الرئيسي ---
const Wallet = () => {
  const dispatch = useDispatch();

  // --- Selectors ---
  const userId = useSelector((state) => state.userReducer?.user?._id);
  const user = useSelector((state) => state.userReducer?.user);
  const userBalanceTND = useSelector(
    (state) => state.userReducer?.user?.balance ?? 0
  );
  const userBalanceUSD = useMemo(
    () => userBalanceTND / TND_TO_USD_RATE,
    [userBalanceTND]
  );
  const userLoading = useSelector(
    (state) => state.userReducer?.loading ?? false
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
  );
  const {
    transactions = [], // البيانات من الجزء الرئيسي للحالة
    loading: transactionsLoading = false,
    error: transactionsError = null,
  } = useSelector(
    (state) =>
      state.transactionReducer || {
        transactions: [],
        loading: false,
        error: null,
      }
  );

  // --- Hooks ---
  const principalBalanceDisplay = useCurrencyDisplay(userBalanceTND);
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
  // Send Modal State
  const [modalStep, setModalStep] = useState(1);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientUser, setRecipientUser] = useState(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailCheckError, setEmailCheckError] = useState(null);
  const [sendCurrency, setSendCurrency] = useState("TND");
  const [sendAmount, setSendAmount] = useState("");
  const [amountError, setAmountError] = useState(null);
  const [transferFee, setTransferFee] = useState(0);
  const [totalDeductedTND, setTotalDeductedTND] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(null);
  // Receive Modal State
  const [isCopied, setIsCopied] = useState(false);

  // --- Handlers ---
  const handleCloseSendModal = useCallback(() => {
    setShowSendModal(false);
    setTimeout(() => {
      setModalStep(1);
      setRecipientEmail("");
      setRecipientUser(null);
      setEmailCheckError(null);
      setSendCurrency("TND");
      setSendAmount("");
      setAmountError(null);
      setTransferFee(0);
      setTotalDeductedTND(0);
      setSendError(null);
      setSendSuccess(null);
      setIsCheckingEmail(false);
      setIsSending(false);
    }, 300);
  }, []);
  const handleShowSendModal = useCallback(() => {
    setEmailCheckError(null);
    setAmountError(null);
    setSendError(null);
    setSendSuccess(null);
    setRecipientEmail("");
    setRecipientUser(null);
    setSendAmount("");
    setSendCurrency("TND");
    setTransferFee(0);
    setTotalDeductedTND(0);
    setModalStep(1);
    setShowSendModal(true);
  }, []);
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
      if (data?._id) {
        if (data._id === userId)
          setEmailCheckError("Cannot send funds to yourself.");
        else setRecipientUser(data);
      } else setEmailCheckError("User not found.");
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
  const handleAmountChange = useCallback((value) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setSendAmount(value);
    }
  }, []);
  useEffect(() => {
    const amountNum = parseFloat(sendAmount);
    let errorMsg = null;
    let fee = 0;
    let totalDeducted = 0;
    let minSend =
      sendCurrency === "USD" ? MIN_SEND_AMOUNT_USD : MIN_SEND_AMOUNT_TND;
    if (sendAmount === "" || isNaN(amountNum)) {
      setAmountError(null);
      setTransferFee(0);
      setTotalDeductedTND(0);
      return;
    }
    if (amountNum <= 0) {
      errorMsg = "Amount must be positive.";
    } else if (amountNum < minSend) {
      errorMsg = `Minimum send amount is ${formatCurrency(
        minSend,
        sendCurrency
      )}`;
    } else {
      fee = (amountNum * TRANSFER_FEE_PERCENT) / 100;
      if (sendCurrency === "USD") {
        totalDeducted = (amountNum + fee) * TND_TO_USD_RATE;
      } else {
        totalDeducted = amountNum + fee;
      }
      if (totalDeducted > userBalanceTND) {
        errorMsg = "Insufficient balance to cover amount and fee.";
      }
    }
    setAmountError(errorMsg);
    setTransferFee(Number(fee.toFixed(2)));
    setTotalDeductedTND(Number(totalDeducted.toFixed(2)));
  }, [sendAmount, sendCurrency, userBalanceTND, userBalanceUSD]);
  const handleSetMaxAmount = useCallback(() => {
    let maxPossibleToSend = 0;
    let balance = sendCurrency === "USD" ? userBalanceUSD : userBalanceTND;
    maxPossibleToSend = balance / (1 + TRANSFER_FEE_PERCENT / 100);
    maxPossibleToSend = Math.max(0, Math.floor(maxPossibleToSend * 100) / 100);
    setSendAmount(maxPossibleToSend.toFixed(2));
    setAmountError(null);
  }, [sendCurrency, userBalanceTND, userBalanceUSD]);
  const handleSendConfirm = useCallback(async () => {
    const amountToSendNum = parseFloat(sendAmount);
    const feeToSend = transferFee;
    if (
      isSending ||
      !recipientUser ||
      !sendAmount ||
      amountError ||
      amountToSendNum <= 0 ||
      isNaN(amountToSendNum)
    ) {
      toast.error("Please correct errors before sending.");
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
          amount: amountToSendNum,
          currency: sendCurrency,
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
    sendAmount,
    sendCurrency,
    amountError,
    isSending,
    handleCloseSendModal,
    transferFee,
  ]);
  const goToNextStep = useCallback(() => {
    const minSend =
      sendCurrency === "USD" ? MIN_SEND_AMOUNT_USD : MIN_SEND_AMOUNT_TND;
    if (modalStep === 1 && recipientUser) setModalStep(2);
    if (modalStep === 2 && !amountError && parseFloat(sendAmount) >= minSend)
      setModalStep(3);
  }, [modalStep, recipientUser, amountError, sendAmount, sendCurrency]);
  const goToPrevStep = useCallback(() => {
    if (modalStep === 3) setModalStep(2);
    if (modalStep === 2) setModalStep(1);
  }, [modalStep]);
  const handleShowReceiveModal = useCallback(() => {
    setIsCopied(false);
    setShowReceiveModal(true);
  }, []);
  const handleCloseReceiveModal = useCallback(
    () => setShowReceiveModal(false),
    []
  );
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
  const handleShowActivityDetails = useCallback((activityItem) => {
    setSelectedActivity(activityItem);
    setShowActivityModal(true);
  }, []);
  const handleCloseActivityDetails = useCallback(() => {
    setShowActivityModal(false);
    setSelectedActivity(null);
  }, []);
  // -------------------------------

  // --- useEffect لجلب البيانات ---
  useEffect(() => {
    if (userId) {
      console.log("[Wallet Effect] Fetching all activity for user:", userId);
      dispatch(getTransactions());
      dispatch(getUserDepositRequests());
      dispatch(getUserWithdrawalRequests());
    }
  }, [dispatch, userId]);
  // ---------------------------

  // --- دمج البيانات للعرض في combinedHistory ---
  const combinedHistory = useMemo(() => {
    const depositsFormatted = (depositRequests || [])
      .filter((req) =>
        ["pending", "rejected", "approved"].includes(req.status?.toLowerCase())
      )
      .map((req) => ({
        _id: `dep-${req._id}`,
        dataType: "DepositRequest",
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
        feeAmount: req.feeAmount,
      }));
    const withdrawalsFormatted = (withdrawalRequests || [])
      .filter((req) => req && req.status)
      .map((req) => ({
        _id: `wd-${req._id}`,
        dataType: "WithdrawalRequest",
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
    const transfersFormatted = (transactions || [])
      .filter((tx) => tx.type !== "DEPOSIT" && tx.type !== "WITHDRAWAL")
      .map((tx) => ({
        _id: `tx-${tx._id}`,
        dataType: "Transaction",
        type: tx.type || "UNKNOWN",
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status || "Completed",
        isSender: tx.sender?._id === userId,
        peerUser: tx.sender?._id === userId ? tx.recipient : tx.sender,
        createdAt: new Date(tx.createdAt),
        sender: tx.sender,
        recipient: tx.recipient,
        description: tx.description,
      }));
    return [
      ...depositsFormatted,
      ...withdrawalsFormatted,
      ...transfersFormatted,
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [depositRequests, withdrawalRequests, transactions, userId]);
  // ---------------------------------------------

  const isLoadingHistory =
    userLoading || transactionsLoading || depositsLoading || withdrawalsLoading;
  const historyError = transactionsError || depositsError || withdrawalsError;

  // --- دالة عرض عنصر السجل ---
  const renderHistoryItem = useCallback(
    (item) => {
      if (!item || !item._id) {
        console.warn("Skipping empty history item");
        return null;
      }
      let IconComponent = IoWalletOutline;
      let iconColorClass = "text-secondary";
      let title = item.type?.replace(/_/g, " ") || "Activity";
      let prefix = "";
      let displayAmount = item.amount;
      let displayCurrency = item.currency || "TND";
      const statusLower = item.status?.toLowerCase() || "unknown";
      switch (item.type) {
        case "DEPOSIT_REQUEST":
          title = `Deposit via ${item.methodName}`;
          prefix = "+";
          displayAmount = item.netAmount;
          displayCurrency = item.currency;
          IconComponent = FiArrowDownCircle;
          iconColorClass =
            statusLower === "approved" || statusLower === "completed"
              ? "text-success"
              : statusLower === "pending"
              ? "text-warning"
              : statusLower === "rejected"
              ? "text-danger"
              : "text-secondary";
          break;
        case "WITHDRAWAL_REQUEST":
          title = `Withdrawal via ${item.methodName}`;
          prefix = "-";
          displayAmount = item.originalAmount ?? item.amount;
          displayCurrency = item.originalCurrency ?? "TND";
          IconComponent = FiArrowUpCircle;
          iconColorClass =
            statusLower === "approved" || statusLower === "completed"
              ? "text-success"
              : statusLower === "pending"
              ? "text-warning"
              : statusLower === "rejected"
              ? "text-danger"
              : statusLower === "processing"
              ? "text-info"
              : "text-secondary";
          break;
        case "TRANSFER":
          const isSender = item.isSender;
          const peer = item.peerUser;
          title = `${isSender ? "Sent to" : "Received from"} ${
            peer?.fullName || peer?.email || "User"
          }`;
          prefix = isSender ? "-" : "+";
          displayAmount = item.amount;
          displayCurrency = item.currency;
          IconComponent = isSender ? FiSend : FiInbox;
          iconColorClass = isSender ? "text-danger" : "text-success";
          if (statusLower === "rejected" || statusLower === "failed") {
            IconComponent = BsXCircle;
            iconColorClass = "text-danger";
          }
          break;
        default:
          prefix = item.amount >= 0 ? "+" : "-";
          iconColorClass = item.amount >= 0 ? "text-success" : "text-danger";
          IconComponent =
            item.amount >= 0 ? FiArrowDownCircle : FiArrowUpCircle;
          break;
      }
      let StatusIconComponent = null;
      switch (statusLower) {
        case "pending":
          StatusIconComponent = BsClockHistory;
          iconColorClass = "text-warning";
          break;
        case "processing":
          StatusIconComponent = BsGearFill;
          iconColorClass = "text-info";
          break;
        case "rejected":
        case "failed":
          StatusIconComponent = BsXCircle;
          iconColorClass = "text-danger";
          break;
        default:
          StatusIconComponent = null;
      }
      const FinalIconComponent = StatusIconComponent || IconComponent;
      let statusBadge = null;
      statusBadge = (
        <Badge
          pill
          bg={iconColorClass.replace("text-", "")}
          className={`ms-2 status-badge ${
            iconColorClass === "text-warning" || iconColorClass === "text-info"
              ? "text-dark"
              : ""
          }`}
        >
          {item.status}
        </Badge>
      );
      const amountStr = formatCurrency(displayAmount, displayCurrency);
      const iconSize = 24;
      return (
        <ListGroup.Item
          key={item._id}
          action
          onClick={() => handleShowActivityDetails(item)}
          className={`transaction-item d-flex justify-content-between align-items-center px-3 py-3 status-${statusLower}`}
        >
          <div className="d-flex align-items-center">
            <div className={`transaction-icon me-3 ${iconColorClass}`}>
              <FinalIconComponent size={iconSize} />
            </div>
            <div>
              <div className="transaction-type-peer fw-bold">{title}</div>
              <div className="transaction-date text-muted small mt-1">
                {item.createdAt
                  ? format(new Date(item.createdAt), "Pp")
                  : "N/A"}
              </div>
            </div>
          </div>
          <div className={`transaction-amount fw-bold fs-6 ${iconColorClass}`}>
            {prefix} {amountStr} {statusBadge}
          </div>
        </ListGroup.Item>
      );
    },
    [handleShowActivityDetails, userId]
  );
  // ------------------------------------

  // --- Loading/Error checks ---
  if (userLoading && !user) {
    return (
      <Container
        fluid
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh" }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="ms-2">Loading Wallet...</span>
      </Container>
    );
  }
  if (!user && !userLoading) {
    return (
      <Container fluid className="py-4">
        <Alert variant="danger" className="text-center">
          User data not available. Please login.
        </Alert>
      </Container>
    );
  }
  // ---------------------------

  // --- Main Render ---
  return (
    <div className="wallet-page container-fluid py-4">
      {/* Header */}
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
                <FiArrowDownCircle className="me-1" /> Deposit
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="danger"
                className="action-button w-100 shadow-sm"
                onClick={() => setShowWithdrawalModal(true)}
              >
                <FiArrowUpCircle className="me-1" /> Withdraw
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="primary"
                className="action-button w-100 shadow-sm"
                onClick={handleShowSendModal}
              >
                <FiSend className="me-1" /> Send
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
                  Showing {combinedHistory.length} items
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {isLoadingHistory ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading activity...</p>
                </div>
              ) : historyError ? (
                <Alert variant="danger" className="text-center m-3">
                  Error fetching activity: {historyError}
                </Alert>
              ) : combinedHistory?.length > 0 ? (
                <ListGroup variant="flush" className="transaction-list">
                  {combinedHistory.map((item) => renderHistoryItem(item))}
                </ListGroup>
              ) : (
                <div
                  className="no-transactions-placeholder d-flex justify-content-center align-items-center flex-column text-center py-5"
                  style={{ minHeight: "200px" }}
                >
                  <FaReceipt size={40} className="text-light-emphasis mb-3" />
                  <h6 className="text-muted">No Activity Yet</h6>
                  <p className="text-muted small mb-0">
                    Your wallet activity will appear here.
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        {/* Right Column */}
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
                    <span className="fw-light small">
                      {user?.fullName || "User"}
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            {(user?.userRole === "Vendor" || user?.userRole === "Admin") && (
              <>
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
                </Col>
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
                </Col>
              </>
            )}
          </Row>
        </Col>
      </Row>

      {/* ----- Modals ----- */}
      {/* Send Modal (Full Content) */}
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
              <Form.Group controlId="recipientEmailInput" className="mb-3">
                <FloatingLabel
                  controlId="recipientEmailFloat"
                  label="Recipient's Email Address"
                >
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
                  />
                </FloatingLabel>
                <Form.Text
                  className={`d-block mt-1 ms-1 ${
                    emailCheckError ? "text-danger" : "text-success"
                  }`}
                >
                  {isCheckingEmail ? (
                    <Spinner animation="border" size="sm" as="span" />
                  ) : emailCheckError ? (
                    <>
                      <FaExclamationTriangle className="me-1" />
                      {emailCheckError}
                    </>
                  ) : recipientUser ? (
                    <>
                      <FaCheckCircle className="me-1" />
                      {recipientUser.fullName}
                    </>
                  ) : (
                    <>​</>
                  )}
                </Form.Text>
              </Form.Group>
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
              </Button>
            </Form>
          )}
          {modalStep === 2 && recipientUser && (
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                goToNextStep();
              }}
            >
              <Alert
                variant="light"
                className="text-center mb-3 recipient-info"
              >
                Sending to: <strong>{recipientUser.fullName}</strong> (
                {recipientUser.email})
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>Send Currency:</Form.Label>
                <ButtonGroup className="d-flex">
                  <Button
                    variant={
                      sendCurrency === "TND" ? "primary" : "outline-secondary"
                    }
                    onClick={() => {
                      setSendCurrency("TND");
                      setSendAmount("");
                      setAmountError(null);
                    }}
                  >
                    TND
                  </Button>
                  <Button
                    variant={
                      sendCurrency === "USD" ? "primary" : "outline-secondary"
                    }
                    onClick={() => {
                      setSendCurrency("USD");
                      setSendAmount("");
                      setAmountError(null);
                    }}
                  >
                    USD
                  </Button>
                </ButtonGroup>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Available Balance ({sendCurrency})</Form.Label>
                <Form.Control
                  type="text"
                  value={formatCurrency(
                    sendCurrency === "USD" ? userBalanceUSD : userBalanceTND,
                    sendCurrency
                  )}
                  readOnly
                  disabled
                />
              </Form.Group>
              <Form.Group controlId="sendAmountInput">
                <FloatingLabel
                  label={`Amount to Send (${sendCurrency})`}
                  className="mb-1"
                >
                  <InputGroup>
                    <Form.Control
                      type="number"
                      placeholder="0.00"
                      value={sendAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      required
                      min={
                        sendCurrency === "USD"
                          ? MIN_SEND_AMOUNT_USD
                          : MIN_SEND_AMOUNT_TND
                      }
                      step="0.01"
                      isInvalid={!!amountError}
                      autoFocus
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={handleSetMaxAmount}
                    >
                      MAX
                    </Button>
                    <InputGroup.Text>{sendCurrency}</InputGroup.Text>
                  </InputGroup>
                  <Form.Control.Feedback type="invalid">
                    {amountError}
                  </Form.Control.Feedback>
                </FloatingLabel>
                {sendCurrency === "USD" &&
                  parseFloat(sendAmount) > 0 &&
                  !amountError && (
                    <Form.Text className="text-muted d-block text-end">
                      ~
                      {formatCurrency(
                        parseFloat(sendAmount) * TND_TO_USD_RATE,
                        "TND"
                      )}
                    </Form.Text>
                  )}
              </Form.Group>
            </Form>
          )}
          {modalStep === 3 && recipientUser && (
            <div className="confirmation-details">
              <h5 className="text-center mb-3">Confirm Transaction:</h5>
              {sendError && <Alert variant="danger">{sendError}</Alert>}
              {sendSuccess && <Alert variant="success">{sendSuccess}</Alert>}
              <ListGroup variant="flush" className="mb-3">
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>To:</span>
                  <strong>
                    {recipientUser.fullName} ({recipientUser.email})
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Amount to Send:</span>
                  <strong>
                    {formatCurrency(parseFloat(sendAmount), sendCurrency)}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Transfer Fee ({TRANSFER_FEE_PERCENT}%):</span>
                  <strong className="text-warning">
                    - {formatCurrency(transferFee, sendCurrency)}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between total-amount pt-3 mt-2 border-top">
                  <span>Total Deducted (TND):</span>
                  <strong className="fs-5 text-danger">
                    {formatCurrency(totalDeductedTND, "TND")}
                  </strong>
                </ListGroup.Item>
              </ListGroup>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          {modalStep > 1 && (
            <Button
              variant="outline-secondary"
              onClick={goToPrevStep}
              disabled={isSending}
            >
              <FaArrowLeft className="me-1" /> Back
            </Button>
          )}
          {(modalStep === 1 || (modalStep === 3 && !sendSuccess)) && (
            <Button
              variant="secondary"
              onClick={handleCloseSendModal}
              disabled={isSending}
            >
              Close
            </Button>
          )}
          {modalStep === 1 && (
            <Button
              variant="primary"
              onClick={goToNextStep}
              disabled={!recipientUser || isCheckingEmail}
            >
              Next <FaArrowRight className="ms-1" />
            </Button>
          )}
          {modalStep === 2 && (
            <Button
              variant="primary"
              onClick={goToNextStep}
              disabled={
                !!amountError ||
                !sendAmount ||
                parseFloat(sendAmount) <= 0 ||
                isNaN(parseFloat(sendAmount))
              }
            >
              Next <FaArrowRight className="ms-1" />
            </Button>
          )}
          {modalStep === 3 && (
            <Button
              variant="success"
              onClick={handleSendConfirm}
              disabled={isSending || !!sendSuccess || !!amountError}
            >
              {isSending ? (
                <>
                  <Spinner size="sm" animation="border" /> Sending...
                </>
              ) : (
                "Confirm & Send"
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Receive Modal (Full Content) */}
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

      {/* Other Modals */}
      <ActivityDetailsModal
        show={showActivityModal}
        onHide={handleCloseActivityDetails}
        item={selectedActivity}
        currentUserId={userId}
      />
      <DepositModal
        show={showDepositModal}
        onHide={() => setShowDepositModal(false)}
      />
      <WithdrawalModal
        show={showWithdrawalModal}
        onHide={() => setShowWithdrawalModal(false)}
      />
    </div> // End of Wallet Page
  );
};

export default Wallet;
