// src/pages/Wallet.jsx
// *** النسخة النهائية الكاملة بعد إضافة مبدل العملات وتصحيح formatCurrency وتوسيع المودالات ***

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
} from "react-bootstrap";
import {
  FaArrowDown,
  FaArrowUp,
  FaPaperPlane,
  FaReceipt,
  FaCheckCircle,
  FaExclamationCircle,
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
import axios from "axios";
import { getProfile } from "../redux/actions/userAction";
import { getTransactions } from "../redux/actions/transactionAction";
import { toast } from "react-toastify";
import TransactionDetailsModal from "../components/commun/TransactionDetailsModal";
import CurrencySwitcher from "../components/commun/CurrencySwitcher"; // <-- [!] استيراد المكون
import useCurrencyDisplay from "../hooks/useCurrencyDisplay"; // <-- [!] استيراد الهوك
import "../components/commun/TransactionDetailsModal.css";
import "./Wallet.css";

// Constants
const MIN_SEND_AMOUNT_TND = 6.0;

const Wallet = () => {
  const dispatch = useDispatch();

  // --- Selectors ---
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
  const displayCurrencyGlobal = useSelector(
    (state) => state.ui?.displayCurrency || "TND"
  );

  // --- استخدام الهوك للأرصدة الرئيسية ---
  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

  // --- State ---
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
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
  const [isCopied, setIsCopied] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // --- دالة تنسيق بسيطة للعملات المختلفة ---
  const formatCurrencySimple = useCallback((amount, currencyCode) => {
    const num = Number(amount);
    if (isNaN(num)) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(num);
  }, []);

  // --- Handlers (بدون تغيير في المنطق) ---
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
    }, 300);
  }, []);
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
  const handleCheckEmail = useCallback(async () => {
    if (!recipientEmail || !/\S+@\S+\.\S+/.test(recipientEmail)) {
      setEmailCheckError("Please enter a valid email address.");
      return;
    }
    setEmailCheckError(null);
    setIsCheckingEmail(true);
    setRecipientUser(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found.");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.post(
        "/user/check-email",
        { email: recipientEmail },
        config
      );
      if (data && data._id) {
        if (data._id === user?._id) {
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
  }, [recipientEmail, user?._id]);
  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setSendAmountTND(value);
      setAmountError(null);
      if (value !== "") {
        const amountNum = parseFloat(value);
        if (isNaN(amountNum)) return;
        if (amountNum < MIN_SEND_AMOUNT_TND) {
          setAmountError(
            `Minimum amount is ${formatCurrencySimple(
              MIN_SEND_AMOUNT_TND,
              "TND"
            )}`
          );
        } else if (user && amountNum > user.balance) {
          setAmountError("Insufficient principal balance");
        }
      }
    }
  };
  const calculatedUSD = useMemo(() => {
    const amountNum = parseFloat(sendAmountTND);
    const rate = 3.0;
    if (!isNaN(amountNum) && amountNum >= MIN_SEND_AMOUNT_TND) {
      return (amountNum / rate).toFixed(2);
    }
    return "0.00";
  }, [sendAmountTND]);
  const handleSendConfirm = useCallback(async () => {
    if (
      isSending ||
      !recipientUser ||
      !sendAmountTND ||
      amountError ||
      parseFloat(sendAmountTND) < MIN_SEND_AMOUNT_TND
    ) {
      return;
    }
    setIsSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const amountToSend = parseFloat(sendAmountTND);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authorization token not found.");
      const config = { headers: { Authorization: `Bearer ${token}` } };
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
    formatCurrencySimple,
  ]);
  const goToNextStep = useCallback(() => {
    if (modalStep === 1 && recipientUser) setModalStep(2);
    if (
      modalStep === 2 &&
      !amountError &&
      parseFloat(sendAmountTND) >= MIN_SEND_AMOUNT_TND
    )
      setModalStep(3);
  }, [modalStep, recipientUser, amountError, sendAmountTND]);
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
  const copyToClipboard = useCallback(() => {
    if (user?.email) {
      navigator.clipboard
        .writeText(user.email)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 1500);
        })
        .catch((err) => console.error("Failed to copy email: ", err));
    }
  }, [user?.email]);
  const handleShowTransactionDetails = useCallback((transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  }, []);
  const handleCloseTransactionDetails = useCallback(() => {
    setShowTransactionModal(false);
    setSelectedTransaction(null);
  }, []);

  useEffect(() => {
    if (user?._id) {
      dispatch(getTransactions());
    }
  }, [dispatch, user?._id]);

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
  if (!user) {
    return (
      <Container fluid className="py-4">
        <Alert variant="danger" className="text-center">
          Error: Could not load user data.
        </Alert>
      </Container>
    );
  }

  return (
    <div className="wallet-page container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">My Wallet</h2>
        <CurrencySwitcher size="sm" />
      </div>

      <Row className="g-4">
        {/* Left Column */}
        <Col lg={8}>
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}>
              <Button
                variant="success"
                className="action-button w-100 shadow-sm"
                disabled
              >
                <FaArrowDown className="me-1" /> Deposit
              </Button>
            </Col>
            <Col xs={6} md={3}>
              <Button
                variant="danger"
                className="action-button w-100 shadow-sm"
                disabled
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
          <Card className="shadow-sm mb-4 transaction-card">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0 text-secondary">Recent Transactions</h5>
              {!transactionsLoading && !transactionsError && (
                <span className="text-muted small">
                  Showing {transactions.length}
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {transactionsLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading transactions...</p>
                </div>
              ) : transactionsError ? (
                <Alert variant="danger" className="text-center m-3">
                  Error fetching transactions: {transactionsError}
                </Alert>
              ) : transactions && transactions.length > 0 ? (
                <ListGroup variant="flush" className="transaction-list">
                  {transactions.map((tx) => {
                    const isSender = tx.sender?._id === user._id;
                    const peerUser = isSender ? tx.recipient : tx.sender;
                    const transactionAmountDisplay = formatCurrencySimple(
                      tx.amount,
                      tx.currency
                    );
                    return (
                      <ListGroup.Item
                        key={tx._id}
                        action
                        onClick={() => handleShowTransactionDetails(tx)}
                        className="transaction-item d-flex justify-content-between align-items-center px-3 py-3"
                      >
                        <div className="d-flex align-items-center">
                          <div
                            className={`transaction-icon me-3 ${
                              isSender ? "sent" : "received"
                            }`}
                          >
                            {isSender ? <FaArrowUp /> : <FaArrowDown />}
                          </div>
                          <div>
                            <div className="transaction-type-peer fw-bold">
                              {tx.type === "TRANSFER"
                                ? (isSender ? "Sent to" : "Received from") +
                                  ` ${peerUser?.fullName || "Unknown User"}`
                                : tx.type}
                            </div>
                            <div className="transaction-date text-muted small mt-1">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`transaction-amount fw-bold fs-6 ${
                            isSender ? "text-danger" : "text-success"
                          }`}
                        >
                          {isSender ? "-" : "+"} {transactionAmountDisplay}
                        </div>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              ) : (
                <div
                  className="no-transactions-placeholder d-flex justify-content-center align-items-center flex-column text-center py-5"
                  style={{ minHeight: "200px" }}
                >
                  <FaReceipt size={40} className="text-light-emphasis mb-3" />
                  <h6 className="text-muted">No Transactions Yet</h6>
                  <p className="text-muted small mb-0">
                    Your transaction history will appear here.
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
                    <span className="fw-light small">{user.fullName}</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            {(user.userRole === "Vendor" || user.userRole === "Admin") && (
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

      {/* ----- Send Balance Modal (بدون اختصارات) ----- */}
      <Modal
        show={showSendModal}
        onHide={handleCloseSendModal}
        centered
        backdrop="static"
        className="send-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {modalStep === 1 && "Send Funds - Step 1: Recipient"}
            {modalStep === 2 && "Send Funds - Step 2: Amount"}
            {modalStep === 3 && "Send Funds - Step 3: Confirm"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* الخطوة 1: إدخال الإيميل */}
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
                    <Spinner
                      animation="border"
                      size="sm"
                      as="span"
                      role="status"
                      aria-hidden="true"
                      className="me-1"
                    />
                  ) : emailCheckError ? (
                    <>
                      <FaExclamationCircle className="me-1" /> {emailCheckError}
                    </>
                  ) : recipientUser ? (
                    <>
                      <FaCheckCircle className="me-1" />{" "}
                      {recipientUser.fullName}
                    </>
                  ) : (
                    <>​</>
                  )}{" "}
                  {/* مسافة صفرية للعرض */}
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
          {/* الخطوة 2: إدخال المبلغ */}
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
              </Form.Group>
              <Form.Group controlId="sendAmountInput">
                <FloatingLabel
                  label={`Amount (Min ${formatCurrencySimple(
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
                  ~ {formatCurrencySimple(calculatedUSD, "USD")}
                </Form.Text>
              </Form.Group>
            </Form>
          )}
          {/* الخطوة 3: التأكيد */}
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
                  <span>Amount ({displayCurrencyGlobal}):</span>
                  <strong>
                    {formatCurrencySimple(
                      displayCurrencyGlobal === "USD"
                        ? parseFloat(sendAmountTND) / 3.0
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
                    {formatCurrencySimple(
                      displayCurrencyGlobal === "USD"
                        ? parseFloat(sendAmountTND)
                        : parseFloat(sendAmountTND) / 3.0,
                      displayCurrencyGlobal === "USD" ? "TND" : "USD"
                    )}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between total-amount pt-3 mt-2 border-top">
                  <span>Total Deducted (TND):</span>
                  <strong className="fs-5 text-danger">
                    {formatCurrencySimple(parseFloat(sendAmountTND), "TND")}
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
                !sendAmountTND ||
                parseFloat(sendAmountTND) < MIN_SEND_AMOUNT_TND
              }
            >
              Next <FaArrowRight className="ms-1" />
            </Button>
          )}
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
          )}
        </Modal.Footer>
      </Modal>

      {/* --- مودال استلام الأموال (بدون اختصارات) --- */}
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
              value={user.email}
              readOnly
              className="receive-email-input"
              aria-label="Your email address"
            />
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="copy-tooltip">
                  {isCopied ? "Copied!" : "Copy Email"}
                </Tooltip>
              }
            >
              <span className="d-inline-block">
                <Button
                  variant={isCopied ? "success" : "outline-secondary"}
                  onClick={copyToClipboard}
                  className="copy-button"
                  disabled={isCopied}
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

      {/* --- مودال تفاصيل المعاملة --- */}
      <TransactionDetailsModal
        show={showTransactionModal}
        onHide={handleCloseTransactionDetails}
        transaction={selectedTransaction}
        currentUserId={user?._id}
      />
    </div> // نهاية Wallet Page
  );
};

export default Wallet;
