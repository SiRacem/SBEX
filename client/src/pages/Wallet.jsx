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
import { useTranslation } from "react-i18next";
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

const MIN_SEND_AMOUNT_TND = 6.0;
const TND_TO_USD_RATE = 3.0;
const MIN_SEND_AMOUNT_USD = MIN_SEND_AMOUNT_TND / TND_TO_USD_RATE;
const TRANSFER_FEE_PERCENT = 2;

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

const Wallet = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (isNaN(num) || amount == null) return "N/A";
      let options = {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      };
      let locale = i18n.language === "tn" ? "ar-TN" : i18n.language;
      if (currencyCode === "USD") {
        locale = "en-US";
        options.currencyDisplay = "symbol";
      }
      return new Intl.NumberFormat(locale, options).format(num);
    },
    [i18n.language]
  );

  const user = useSelector((state) => state.userReducer?.user);
  const userId = user?._id;
  const userBalanceTND = user?.balance ?? 0;
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
  const {
    transactions = [],
    loading: transactionsLoading = false,
    error: transactionsError = null,
  } = useSelector((state) => state.transactionReducer || {});

  const principalBalanceDisplay = useCurrencyDisplay(userBalanceTND);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [modalStep, setModalStep] = useState(1);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientUser, setRecipientUser] = useState(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailCheckError, setEmailCheckError] = useState(null);
  const [sendCurrency, setSendCurrency] = useState("TND");
  const [sendAmount, setSendAmount] = useState("");
  const [amountError, setAmountError] = useState(null);
  const [sendFromSource, setSendFromSource] = useState("principal");
  const [transferFee, setTransferFee] = useState(0);
  const [totalDeductedTND, setTotalDeductedTND] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

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
      setSendFromSource("principal");
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
      setEmailCheckError(t("walletPage.sendModal.validEmailError"));
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
          setEmailCheckError(t("walletPage.sendModal.sendToSelfError"));
        else setRecipientUser(data);
      } else setEmailCheckError(t("walletPage.sendModal.userNotFoundError"));
    } catch (error) {
      const status = error.response?.status;
      if (status === 404)
        setEmailCheckError(t("walletPage.sendModal.userNotFoundError"));
      else if (status === 401)
        setEmailCheckError(t("walletPage.sendModal.authError"));
      else setEmailCheckError(t("walletPage.sendModal.checkEmailError"));
      setRecipientUser(null);
    } finally {
      setIsCheckingEmail(false);
    }
  }, [recipientEmail, userId, t]);

  const handleAmountChange = useCallback((value) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") setSendAmount(value);
  }, []);

  useEffect(() => {
    const amountNum = parseFloat(sendAmount);
    let errorMsg = null,
      fee = 0,
      totalDeducted = 0;
    let minSend =
      sendCurrency === "USD" ? MIN_SEND_AMOUNT_USD : MIN_SEND_AMOUNT_TND;
    const selectedBalanceTND =
      sendFromSource === "seller"
        ? user?.sellerAvailableBalance || 0
        : userBalanceTND;

    if (sendAmount === "" || isNaN(amountNum)) {
      setAmountError(null);
      setTransferFee(0);
      setTotalDeductedTND(0);
      return;
    }
    if (amountNum <= 0)
      errorMsg = t("walletPage.sendModal.amountPositiveError");
    else if (amountNum < minSend)
      errorMsg = t("walletPage.sendModal.minAmountError", {
        amount: formatCurrency(minSend, sendCurrency),
      });
    else {
      fee = (amountNum * TRANSFER_FEE_PERCENT) / 100;
      totalDeducted =
        sendCurrency === "USD"
          ? (amountNum + fee) * TND_TO_USD_RATE
          : amountNum + fee;
      if (totalDeducted > selectedBalanceTND)
        errorMsg = t("walletPage.sendModal.insufficientBalanceError");
    }
    setAmountError(errorMsg);
    setTransferFee(Number(fee.toFixed(2)));
    setTotalDeductedTND(Number(totalDeducted.toFixed(2)));
  }, [
    sendAmount,
    sendCurrency,
    userBalanceTND,
    user?.sellerAvailableBalance,
    sendFromSource,
    t,
    formatCurrency,
  ]);

  const handleSetMaxAmount = useCallback(() => {
    const balanceTND =
      sendFromSource === "seller"
        ? user?.sellerAvailableBalance || 0
        : userBalanceTND;
    let effectiveBalance =
      sendCurrency === "USD" ? balanceTND / TND_TO_USD_RATE : balanceTND;
    let maxPossibleToSend = effectiveBalance / (1 + TRANSFER_FEE_PERCENT / 100);
    setSendAmount(
      Math.max(0, Math.floor(maxPossibleToSend * 100) / 100).toFixed(2)
    );
    setAmountError(null);
  }, [
    sendCurrency,
    userBalanceTND,
    user?.sellerAvailableBalance,
    sendFromSource,
  ]);

  const handleSendConfirm = useCallback(async () => {
    const amountToSendNum = parseFloat(sendAmount);
    if (
      isSending ||
      !recipientUser ||
      !sendAmount ||
      amountError ||
      amountToSendNum <= 0 ||
      isNaN(amountToSendNum)
    ) {
      toast.error(t("walletPage.sendModal.sendFailedError"));
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
          source: sendFromSource,
        },
        config
      );
      setSendSuccess(data.msg || t("walletPage.sendModal.sendSuccess"));
      toast.success(t("walletPage.sendModal.sendSuccess"));
      dispatch(getProfile());
      dispatch(getTransactions());
      setTimeout(handleCloseSendModal, 2500);
    } catch (error) {
      const message =
        error.response?.data?.msg ||
        error?.message ||
        t("walletPage.sendModal.sendGenericError");
      setSendError(message);
      toast.error(`${t("walletPage.sendModal.sendGenericError")}: ${message}`);
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
    sendFromSource,
    t,
  ]);

  const goToNextStep = useCallback(() => {
    const minSend =
      sendCurrency === "USD" ? MIN_SEND_AMOUNT_USD : MIN_SEND_AMOUNT_TND;
    if (modalStep === 1 && recipientUser)
      setModalStep(user?.sellerAvailableBalance > 0 ? 2 : 3);
    else if (modalStep === 2) setModalStep(3);
    else if (
      modalStep === 3 &&
      !amountError &&
      parseFloat(sendAmount) >= minSend
    )
      setModalStep(4);
  }, [
    modalStep,
    recipientUser,
    amountError,
    sendAmount,
    sendCurrency,
    user?.sellerAvailableBalance,
  ]);

  const goToPrevStep = useCallback(() => {
    if (modalStep === 4) setModalStep(3);
    else if (modalStep === 3)
      setModalStep(user?.sellerAvailableBalance > 0 ? 2 : 1);
    else if (modalStep === 2) setModalStep(1);
  }, [modalStep, user?.sellerAvailableBalance]);

  const handleShowReceiveModal = useCallback(() => {
    setIsCopied(false);
    setShowReceiveModal(true);
  }, []);
  const handleCloseReceiveModal = useCallback(
    () => setShowReceiveModal(false),
    []
  );
  const copyToClipboard = useCallback(
    (textToCopy = user?.email) => {
      if (!textToCopy || isCopied) return;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          toast.success(t("walletPage.receiveModal.copiedTooltip"));
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 1500);
        })
        .catch(() => toast.error(t("walletPage.receiveModal.copyFail")));
    },
    [isCopied, user?.email, t]
  );

  const handleShowActivityDetails = useCallback((activityItem) => {
    setSelectedActivity(activityItem);
    setShowActivityModal(true);
  }, []);
  const handleCloseActivityDetails = useCallback(() => {
    setShowActivityModal(false);
    setSelectedActivity(null);
  }, []);

  useEffect(() => {
    if (userId) {
      dispatch(getTransactions());
      dispatch(getUserDepositRequests());
      dispatch(getUserWithdrawalRequests());
    }
  }, [dispatch, userId]);

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

  const isLoadingHistory =
    userLoading || transactionsLoading || depositsLoading || withdrawalsLoading;
  const historyError = transactionsError || depositsError || withdrawalsError;

  const renderHistoryItem = useCallback(
    (item) => {
      if (!item || !item._id) return null;
      let IconComponent = IoWalletOutline,
        iconColorClass = "text-secondary",
        title =
          item.type?.replace(/_/g, " ") ||
          t("walletPage.activityTypes.UNKNOWN_ACTIVITY"),
        prefix = "",
        displayAmount = item.amount,
        displayCurrency = item.currency || "TND";
      const statusLower = item.status?.toLowerCase() || "unknown";
      switch (item.type) {
        case "DEPOSIT_REQUEST":
          title = t("walletPage.activityTypes.DEPOSIT_REQUEST", {
            methodName: item.methodName,
          });
          prefix = "+";
          displayAmount = item.netAmount;
          displayCurrency = item.currency;
          IconComponent = FiArrowDownCircle;
          break;
        case "WITHDRAWAL_REQUEST":
          title = t("walletPage.activityTypes.WITHDRAWAL_REQUEST", {
            methodName: item.methodName,
          });
          prefix = "-";
          displayAmount = item.originalAmount ?? item.amount;
          displayCurrency = item.originalCurrency ?? "TND";
          IconComponent = FiArrowUpCircle;
          break;
        case "TRANSFER":
          const isSender = item.isSender;
          const peer = item.peerUser;
          title = t(
            isSender
              ? "walletPage.activityTypes.TRANSFER_SENT"
              : "walletPage.activityTypes.TRANSFER_RECEIVED",
            { peerName: peer?.fullName || peer?.email || "User" }
          );
          prefix = isSender ? "-" : "+";
          displayAmount = item.amount;
          displayCurrency = item.currency;
          IconComponent = isSender ? FiSend : FiInbox;
          iconColorClass = isSender ? "text-danger" : "text-success";
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
          break;
      }
      if (
        item.type === "DEPOSIT_REQUEST" &&
        (statusLower === "approved" || statusLower === "completed")
      )
        iconColorClass = "text-success";
      if (
        item.type === "WITHDRAWAL_REQUEST" &&
        (statusLower === "approved" || statusLower === "completed")
      )
        iconColorClass = "text-success";
      const FinalIconComponent = StatusIconComponent || IconComponent;
      const statusBadge = (
        <Badge
          pill
          bg={iconColorClass.replace("text-", "")}
          className={`ms-2 status-badge ${
            iconColorClass === "text-warning" || iconColorClass === "text-info"
              ? "text-dark"
              : ""
          }`}
        >
          {t(`walletPage.statuses.${statusLower}`, {
            defaultValue: item.status,
          })}
        </Badge>
      );
      const amountStr = formatCurrency(displayAmount, displayCurrency);
      return (
        <ListGroup.Item
          key={item._id}
          action
          onClick={() => handleShowActivityDetails(item)}
          className={`transaction-item d-flex justify-content-between align-items-center px-3 py-3 status-${statusLower}`}
        >
          <div className="d-flex align-items-center">
            <div className={`transaction-icon me-3 ${iconColorClass}`}>
              <FinalIconComponent size={24} />
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
    [handleShowActivityDetails, t, formatCurrency]
  );

  if (userLoading && !user)
    return (
      <Container
        fluid
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh" }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="ms-2">{t("walletPage.loading")}</span>
      </Container>
    );
  if (!user && !userLoading)
    return (
      <Container fluid className="py-4">
        <Alert variant="danger" className="text-center">
          {t("walletPage.error")}
        </Alert>
      </Container>
    );

  const sendModalStepTitle = () => {
    const hasSellerBalance = user?.sellerAvailableBalance > 0;
    if (modalStep === 1) return t("walletPage.sendModal.step1Title");
    if (modalStep === 2 && hasSellerBalance)
      return t("walletPage.sendModal.step2Title_source");
    if (modalStep === 3)
      return t("walletPage.sendModal.step3Title_amount", {
        step: hasSellerBalance ? 3 : 2,
      });
    if (modalStep === 4)
      return t("walletPage.sendModal.step4Title_confirm", {
        step: hasSellerBalance ? 4 : 3,
      });
    return t("walletPage.send");
  };

  return (
    <div className="wallet-page container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">{t("walletPage.title")}</h2>
        <CurrencySwitcher size="sm" />
      </div>
      <Row className="g-4">
        <Col lg={8}>
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}>
              <Button
                variant="success"
                className="action-button w-100 shadow-sm"
                onClick={() => setShowDepositModal(true)}
              >
                <FiArrowDownCircle className="me-1" /> {t("walletPage.deposit")}
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="danger"
                className="action-button w-100 shadow-sm"
                onClick={() => setShowWithdrawalModal(true)}
              >
                <FiArrowUpCircle className="me-1" /> {t("walletPage.withdraw")}
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="primary"
                className="action-button w-100 shadow-sm"
                onClick={handleShowSendModal}
              >
                <FiSend className="me-1" /> {t("walletPage.send")}
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="info"
                className="action-button w-100 shadow-sm"
                onClick={handleShowReceiveModal}
              >
                <FaReceipt className="me-1" /> {t("walletPage.receive")}
              </Button>
            </Col>
          </Row>
          <Card className="shadow-sm mb-4 transaction-card">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0 text-secondary">
                {t("walletPage.recentActivity")}
              </h5>
              {!isLoadingHistory && !historyError && (
                <span className="text-muted small">
                  {t("walletPage.showingItems", {
                    count: combinedHistory.length,
                  })}
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {isLoadingHistory ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">{t("walletPage.loadingActivity")}</p>
                </div>
              ) : historyError ? (
                <Alert variant="danger" className="text-center m-3">
                  {t("walletPage.errorActivity", { error: historyError })}
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
                  <h6 className="text-muted">
                    {t("walletPage.noActivityTitle")}
                  </h6>
                  <p className="text-muted small mb-0">
                    {t("walletPage.noActivitySubtitle")}
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Row className="g-4">
            <Col xs={12}>
              <Card className="shadow-sm balance-card balance-card-principal text-white h-100">
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <Card.Subtitle className="mb-1 text-white-75">
                        {t("walletPage.principalBalance")}
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
                            {t("walletPage.sellerAvailableBalance")}
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
                            {t("walletPage.onHoldBalance")}
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

      {/* Send Modal */}
      <Modal
        show={showSendModal}
        onHide={handleCloseSendModal}
        centered
        backdrop="static"
        className="send-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{sendModalStepTitle()}</Modal.Title>
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
                  label={t("walletPage.sendModal.recipientEmailLabel")}
                >
                  <Form.Control
                    type="email"
                    placeholder={t("walletPage.sendModal.emailPlaceholder")}
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
                      {t("walletPage.sendModal.userFound", {
                        name: recipientUser.fullName,
                      })}
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
                  t("walletPage.sendModal.checking")
                ) : (
                  <>
                    <FaSearch className="me-1" />
                    {t("walletPage.sendModal.checkEmailButton")}
                  </>
                )}
              </Button>
            </Form>
          )}
          {modalStep === 2 &&
            user?.sellerAvailableBalance > 0 &&
            recipientUser && (
              <div>
                <Alert
                  variant="light"
                  className="text-center mb-3 recipient-info"
                >
                  {t("walletPage.sendModal.sendingTo", {
                    name: recipientUser.fullName,
                    email: recipientUser.email,
                  })}
                </Alert>
                <Form.Group className="mb-3">
                  <Form.Label>
                    {t("walletPage.sendModal.selectSource")}
                  </Form.Label>
                  <ButtonGroup className="d-flex">
                    <Button
                      variant={
                        sendFromSource === "principal"
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => setSendFromSource("principal")}
                    >
                      {t("walletPage.sendModal.principalSource", {
                        balance: principalBalanceDisplay.displayValue,
                      })}
                    </Button>
                    <Button
                      variant={
                        sendFromSource === "seller"
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => setSendFromSource("seller")}
                      disabled={!(user?.sellerAvailableBalance > 0)}
                    >
                      {t("walletPage.sendModal.sellerSource", {
                        balance: sellerAvailableBalanceDisplay.displayValue,
                      })}
                    </Button>
                  </ButtonGroup>
                </Form.Group>
              </div>
            )}
          {modalStep === 3 && recipientUser && (
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
                {t("walletPage.sendModal.sendingTo", {
                  name: recipientUser.fullName,
                  email: recipientUser.email,
                })}
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>
                  {t("walletPage.sendModal.sendCurrencyLabel")}
                </Form.Label>
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
                <Form.Label>
                  {t("walletPage.sendModal.availableFrom", {
                    source: t(
                      sendFromSource === "seller"
                        ? "walletPage.sendModal.sellerBalanceLabel"
                        : "walletPage.sendModal.principalBalanceLabel"
                    ),
                    currency: sendCurrency,
                  })}
                </Form.Label>
                <Form.Control
                  type="text"
                  value={formatCurrency(
                    sendCurrency === "USD"
                      ? sendFromSource === "seller"
                        ? (user?.sellerAvailableBalance || 0) / TND_TO_USD_RATE
                        : userBalanceUSD
                      : sendFromSource === "seller"
                      ? user?.sellerAvailableBalance || 0
                      : userBalanceTND,
                    sendCurrency
                  )}
                  readOnly
                  disabled
                />
              </Form.Group>
              <Form.Group controlId="sendAmountInput">
                <FloatingLabel
                  label={t("walletPage.sendModal.amountToSendLabel", {
                    currency: sendCurrency,
                  })}
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
                      {t("walletPage.sendModal.maxButton")}
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
                      {t("walletPage.sendModal.approximateValue", {
                        value: formatCurrency(
                          parseFloat(sendAmount) * TND_TO_USD_RATE,
                          "TND"
                        ),
                      })}
                    </Form.Text>
                  )}
              </Form.Group>
            </Form>
          )}
          {modalStep === 4 && recipientUser && (
            <div className="confirmation-details">
              <h5 className="text-center mb-3">
                {t("walletPage.sendModal.confirmTitle")}
              </h5>
              {sendError && <Alert variant="danger">{sendError}</Alert>}
              {sendSuccess && <Alert variant="success">{sendSuccess}</Alert>}
              <ListGroup variant="flush" className="mb-3">
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>{t("walletPage.sendModal.toLabel")}</span>
                  <strong>
                    {recipientUser.fullName} ({recipientUser.email})
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>{t("walletPage.sendModal.fromLabel")}</span>
                  <strong>
                    {t(
                      sendFromSource === "seller"
                        ? "walletPage.sendModal.sellerBalanceLabel"
                        : "walletPage.sendModal.principalBalanceLabel"
                    )}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>{t("walletPage.sendModal.amountLabel")}</span>
                  <strong>
                    {formatCurrency(parseFloat(sendAmount), sendCurrency)}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>
                    {t("walletPage.sendModal.feeLabel", {
                      fee: TRANSFER_FEE_PERCENT,
                    })}
                  </span>
                  <strong className="text-warning">
                    - {formatCurrency(transferFee, sendCurrency)}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between total-amount pt-3 mt-2 border-top">
                  <span>{t("walletPage.sendModal.totalDeductedLabel")}</span>
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
              <FaArrowLeft className="me-1" />
              {t("walletPage.sendModal.backButton")}
            </Button>
          )}
          {(modalStep === 1 || (modalStep === 4 && !sendSuccess)) && (
            <Button
              variant="secondary"
              onClick={handleCloseSendModal}
              disabled={isSending}
            >
              {t("walletPage.sendModal.closeButton")}
            </Button>
          )}
          {modalStep === 1 && (
            <Button
              variant="primary"
              onClick={goToNextStep}
              disabled={!recipientUser || isCheckingEmail}
            >
              {t("walletPage.sendModal.nextButton")}
              <FaArrowRight className="ms-1" />
            </Button>
          )}
          {modalStep === 2 && user?.sellerAvailableBalance > 0 && (
            <Button variant="primary" onClick={goToNextStep}>
              {t("walletPage.sendModal.nextButton")}
              <FaArrowRight className="ms-1" />
            </Button>
          )}
          {modalStep === 3 && (
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
              {t("walletPage.sendModal.nextButton")}
              <FaArrowRight className="ms-1" />
            </Button>
          )}
          {modalStep === 4 && (
            <Button
              variant="success"
              onClick={handleSendConfirm}
              disabled={isSending || !!sendSuccess || !!amountError}
            >
              {isSending ? (
                <>
                  <Spinner size="sm" animation="border" />
                  {t("walletPage.sendModal.sendingButton")}
                </>
              ) : (
                t("walletPage.sendModal.confirmSendButton")
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Receive Modal */}
      <Modal show={showReceiveModal} onHide={handleCloseReceiveModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaReceipt className="me-2" /> {t("walletPage.receiveModal.title")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <p className="mb-3">{t("walletPage.receiveModal.shareEmail")}</p>
          <InputGroup className="mb-3 receive-email-group">
            <Form.Control
              type="email"
              value={user?.email || "Loading..."}
              readOnly
              className="receive-email-input"
              aria-label={t("walletPage.receiveModal.yourEmailLabel")}
            />
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>
                  {isCopied
                    ? t("walletPage.receiveModal.copiedTooltip")
                    : t("walletPage.receiveModal.copyTooltip")}
                </Tooltip>
              }
            >
              <span className="d-inline-block">
                <Button
                  variant={isCopied ? "success" : "outline-secondary"}
                  onClick={() => copyToClipboard(user?.email)}
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
            {t("walletPage.receiveModal.infoText")}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseReceiveModal}>
            {t("walletPage.receiveModal.closeButton")}
          </Button>
        </Modal.Footer>
      </Modal>

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
    </div>
  );
};

export default Wallet;
