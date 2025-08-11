// src/components/commun/DepositModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Modal,
  Button,
  Form,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  FloatingLabel,
  Image,
  InputGroup,
  Badge,
  OverlayTrigger,
  Tooltip,
  ButtonGroup,
} from "react-bootstrap";
import {
  FaArrowRight,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaCopy,
  FaCheck,
} from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import axios from "axios";
import { getActivePaymentMethods } from "../../redux/actions/paymentMethodAction";
import "./DepositModal.css";
import {
  createDepositRequest,
  resetCreateDeposit,
} from "../../redux/actions/depositAction";

const TND_TO_USD_RATE = 3.0;
const noImageUrlPlaceholder =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const getUploadTokenConfig = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Auth token missing.");
    return null;
  }
  return { headers: { Authorization: `Bearer ${token}` } };
};

const DepositModal = ({ show, onHide }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const { loadingCreate, errorCreate, successCreate } = useSelector(
    (state) => state.depositRequestReducer || {}
  );
  const {
    activeMethods: depositMethodsRaw = [],
    loadingActive: loadingMethods,
    error: errorMethods,
  } = useSelector((state) => state.paymentMethodReducer || {});

  const depositMethods = useMemo(
    () =>
      depositMethodsRaw.filter(
        (m) => m.type === "deposit" || m.type === "both"
      ),
    [depositMethodsRaw]
  );

  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [amountError, setAmountError] = useState(null);
  const [commissionInfo, setCommissionInfo] = useState({
    fee: 0,
    netAmount: 0,
  });
  const [transactionId, setTransactionId] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [senderInfo, setSenderInfo] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [inputCurrency, setInputCurrency] = useState("TND");
  const [isCopied, setIsCopied] = useState(false);

  const formatCurrencyLocal = useCallback(
    (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (isNaN(num)) return "N/A";
      const locale = i18n.language === "tn" ? "ar-TN" : i18n.language;
      try {
        return num.toLocaleString(locale, {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch (e) {
        return `${num.toFixed(2)} ${currencyCode}`;
      }
    },
    [i18n.language]
  );

  const calculateCommissionLocal = useCallback(
    (method, amount, currency) => {
      if (!method || isNaN(amount) || amount <= 0)
        return { error: t("walletPage.depositModal.errors.invalidInput") };
      const percent = method.depositCommissionPercent ?? 0;
      const minDeposit =
        currency === "USD"
          ? method.minDepositUSD ?? 0
          : method.minDepositTND ?? 0;
      if (amount < minDeposit)
        return {
          error: t("walletPage.depositModal.errors.minDeposit", {
            amount: formatCurrencyLocal(minDeposit, currency),
          }),
        };
      const fee = (amount * percent) / 100;
      const netAmount = amount - fee;
      if (netAmount <= 0 && amount > 0)
        return {
          error: t("walletPage.depositModal.errors.feeExceedsAmount", {
            fee: formatCurrencyLocal(fee, currency),
          }),
        };
      return {
        fee: Number(fee.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2)),
        error: null,
      };
    },
    [t, formatCurrencyLocal]
  );

  useEffect(() => {
    if (show) {
      dispatch(getActivePaymentMethods("deposit"));
      dispatch(resetCreateDeposit());
      setStep(1);
      setSelectedMethod(null);
      setDepositAmount("");
      setAmountError(null);
      setCommissionInfo({ fee: 0, netAmount: 0 });
      setTransactionId("");
      setScreenshotFile(null);
      setSenderInfo("");
      setIsUploading(false);
      setInputCurrency("TND");
      setIsCopied(false);
    }
  }, [show, dispatch]);

  useEffect(() => {
    if (successCreate) {
      onHide();
    }
  }, [successCreate, onHide]);

  useEffect(() => {
    if (selectedMethod) {
      const minUSD = selectedMethod.minDepositUSD;
      const minTND = selectedMethod.minDepositTND;
      const nextCurrency =
        minUSD != null && minUSD > 0 && (minTND == null || minTND <= 0)
          ? "USD"
          : "TND";
      if (nextCurrency !== inputCurrency) {
        setInputCurrency(nextCurrency);
        setDepositAmount("");
        setAmountError(null);
        setCommissionInfo({ fee: 0, netAmount: 0 });
      }
    }
  }, [selectedMethod, inputCurrency]);

  useEffect(() => {
    if (selectedMethod && depositAmount) {
      const amountNum = parseFloat(depositAmount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const calc = calculateCommissionLocal(
          selectedMethod,
          amountNum,
          inputCurrency
        );
        setAmountError(calc.error);
        if (!calc.error)
          setCommissionInfo({ fee: calc.fee, netAmount: calc.netAmount });
        else setCommissionInfo({ fee: 0, netAmount: 0 });
      } else {
        setAmountError(null);
        setCommissionInfo({ fee: 0, netAmount: 0 });
      }
    } else {
      setAmountError(null);
      setCommissionInfo({ fee: 0, netAmount: 0 });
    }
  }, [depositAmount, selectedMethod, inputCurrency, calculateCommissionLocal]);

  const handleSelectMethod = (method) => setSelectedMethod(method);
  const handleAmountInputChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") setDepositAmount(value);
  };
  const handlePresetAmountClick = (amount) =>
    setDepositAmount(amount.toString());
  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshotFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.warn(t("walletPage.depositModal.errors.invalidFileType"));
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warn(t("walletPage.depositModal.errors.fileTooLarge"));
      e.target.value = "";
      return;
    }
    setScreenshotFile(file);
  };

  const goToStep = (nextStep) => {
    if (nextStep === 2 && !selectedMethod) {
      toast.warn(t("walletPage.depositModal.errors.selectMethod"));
      return;
    }
    if (nextStep === 3) {
      const amountNum = parseFloat(depositAmount);
      const calc = calculateCommissionLocal(
        selectedMethod,
        amountNum,
        inputCurrency
      );
      if (!depositAmount || isNaN(amountNum) || amountNum <= 0 || calc.error) {
        const errorMsg =
          calc.error || t("walletPage.depositModal.errors.validAmount");
        setAmountError(errorMsg);
        toast.warn(errorMsg);
        return;
      }
    }
    setStep(nextStep);
  };

  const copyToClipboard = useCallback(
    (textToCopy) => {
      if (!textToCopy || isCopied) return;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          toast.success(t("walletPage.receiveModal.copiedTooltip"));
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
        })
        .catch(() => toast.error(t("walletPage.receiveModal.copyFail")));
    },
    [isCopied, t]
  );

  const handleSubmitDeposit = useCallback(
    async (e) => {
      e.preventDefault();
      const amountNum = parseFloat(depositAmount);
      const calc = calculateCommissionLocal(
        selectedMethod,
        amountNum,
        inputCurrency
      );
      if (
        !selectedMethod ||
        !depositAmount ||
        amountError ||
        loadingCreate ||
        isUploading ||
        calc.error
      ) {
        toast.error(t("walletPage.depositModal.errors.correctErrors"));
        return;
      }
      const methodNameLower = selectedMethod.name?.toLowerCase();
      if (methodNameLower === "cartes ooredoo" && !senderInfo.trim()) {
        toast.warn(t("walletPage.depositModal.errors.ooredooCodeRequired"));
        return;
      }
      if (methodNameLower === "binance pay" && !transactionId.trim()) {
        toast.warn(t("walletPage.depositModal.errors.txnIdRequired"));
        return;
      }

      let uploadedScreenshotUrl = null;
      if (screenshotFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("proofImage", screenshotFile);
        const uploadConfig = getUploadTokenConfig();
        try {
          const uploadRes = await axios.post(
            "/uploads/proof",
            formData,
            uploadConfig
          );
          uploadedScreenshotUrl = uploadRes.data.filePath;
        } catch (uploadError) {
          toast.error(
            `${t("walletPage.depositModal.errors.uploadFailedShort")}: ${
              uploadError.response?.data?.msg || uploadError.message
            }`
          );
        } finally {
          setIsUploading(false);
        }
      }

      const depositData = {
        amount: amountNum,
        currency: inputCurrency,
        methodName: selectedMethod.name,
        transactionId: transactionId.trim() || undefined,
        senderInfo: senderInfo.trim() || undefined,
        screenshotUrl: uploadedScreenshotUrl,
      };
      dispatch(createDepositRequest(depositData));
    },
    [
      dispatch,
      selectedMethod,
      depositAmount,
      amountError,
      loadingCreate,
      isUploading,
      inputCurrency,
      t,
      screenshotFile,
      transactionId,
      senderInfo,
      calculateCommissionLocal,
    ]
  );

  const PRESET_AMOUNTS_TND = [5, 10, 20, 30, 40];
  const PRESET_AMOUNTS_USD = [2, 5, 10, 15, 20];

  const renderFeeDetails = (method) => {
    if (!method) return null;
    let feeStrings = [];
    if (method.depositCommissionPercent > 0)
      feeStrings.push(`${method.depositCommissionPercent}%`);
    const feeText =
      feeStrings.length > 0 ? (
        `${t("walletPage.depositModal.feeLabel")}: ${feeStrings.join(" + ")}`
      ) : (
        <span className="text-success">
          {t("walletPage.depositModal.noFeeLabel")}
        </span>
      );
    let limitStrings = [];
    if (method.minDepositTND > 0)
      limitStrings.push(
        `${t("walletPage.depositModal.minLabel")}: ${formatCurrencyLocal(
          method.minDepositTND,
          "TND"
        )}`
      );
    if (method.minDepositUSD > 0)
      limitStrings.push(
        `${t("walletPage.depositModal.minLabel")}: ${formatCurrencyLocal(
          method.minDepositUSD,
          "USD"
        )}`
      );
    const limitString =
      limitStrings.length > 0 ? limitStrings.join(" / ") : null;
    return (
      <>
        <Badge pill bg="light" text="dark" className="detail-badge">
          {feeText}
        </Badge>
        {limitString && (
          <Badge pill bg="light" text="dark" className="detail-badge ms-1">
            {limitString}
          </Badge>
        )}
      </>
    );
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      backdrop="static"
      centered
      className="deposit-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title as="h5">{t("walletPage.depositModal.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <div className="mb-4 text-center step-indicator">
          <span className={`step ${step >= 1 ? "active" : ""}`}>
            <span className="step-number">1</span>{" "}
            {t("walletPage.depositModal.step1")}
          </span>
          <span className="connector"></span>
          <span className={`step ${step >= 2 ? "active" : ""}`}>
            <span className="step-number">2</span>{" "}
            {t("walletPage.depositModal.step2")}
          </span>
          <span className="connector"></span>
          <span className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span>{" "}
            {t("walletPage.depositModal.step3")}
          </span>
        </div>
        {errorCreate && (
          <Alert
            variant="danger"
            onClose={() => dispatch(resetCreateDeposit())}
            dismissible
          >
            {t(errorCreate.key || "apiErrors.unknownError", {
              ...errorCreate.params,
              defaultValue: errorCreate.fallback || "An unknown error occurred",
            })}
          </Alert>
        )}

        {step === 1 && (
          <div className="step-content">
            <p className="mb-3 text-center text-muted small">
              {t("walletPage.depositModal.selectMethod")}
            </p>
            {loadingMethods && (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            )}
            {errorMethods && (
              <Alert variant="warning" className="text-center">
                {t("walletPage.depositModal.loadMethodsError")}: {errorMethods}
              </Alert>
            )}
            {!loadingMethods && !errorMethods && (
              <Row xs={1} sm={2} md={3} className="g-3 method-selection">
                {depositMethods.length > 0 ? (
                  depositMethods.map((method) => (
                    <Col key={method._id}>
                      <Card
                        className={`method-card h-100 ${
                          selectedMethod?._id === method._id ? "selected" : ""
                        }`}
                        onClick={() => handleSelectMethod(method)}
                      >
                        <Card.Body className="text-center d-flex flex-column align-items-center p-3">
                          <Image
                            src={method.logoUrl}
                            className="method-logo-v2 mb-2"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = noImageUrlPlaceholder;
                            }}
                          />
                          <Card.Title className="method-name-v2 mt-auto mb-1">
                            {method.displayName || method.name}
                          </Card.Title>
                          <div className="method-details-badges mt-1">
                            {renderFeeDetails(method)}
                          </div>
                        </Card.Body>
                        {selectedMethod?._id === method._id && (
                          <div className="selected-checkmark">
                            <FaCheckCircle />
                          </div>
                        )}
                      </Card>
                    </Col>
                  ))
                ) : (
                  <Col>
                    <Alert variant="light" className="text-center">
                      {t("walletPage.depositModal.noMethods")}
                    </Alert>
                  </Col>
                )}
              </Row>
            )}
            <div className="d-grid mt-4">
              <Button
                variant="primary"
                onClick={() => goToStep(2)}
                disabled={!selectedMethod}
              >
                {t("walletPage.sendModal.nextButton")}{" "}
                <FaArrowRight className="ms-1" />
              </Button>
            </div>
          </div>
        )}
        {step === 2 && selectedMethod && (
          <div className="step-content">
            <Button
              variant="link"
              size="sm"
              onClick={() => setStep(1)}
              className="mb-3 p-0 btn-back-v2"
            >
              <FaArrowLeft className="me-1" />{" "}
              {t("walletPage.depositModal.changeMethod")}
            </Button>
            <h4 className="mb-1 text-center fw-light">
              {t("walletPage.depositModal.enterAmount")}
            </h4>
            <p className="text-center text-muted mb-4 small">
              {t("walletPage.depositModal.using", {
                methodName: selectedMethod.displayName,
              })}
            </p>
            <Form.Group className="mb-3 text-center quick-amount-group">
              <Form.Label className="d-block mb-2 small text-muted">
                {t("walletPage.depositModal.selectAmount", {
                  currency: inputCurrency,
                })}
                :
              </Form.Label>
              <ButtonGroup
                size="sm"
                className="flex-wrap justify-content-center"
              >
                {(inputCurrency === "TND"
                  ? PRESET_AMOUNTS_TND
                  : PRESET_AMOUNTS_USD
                ).map((amount) => (
                  <Button
                    key={amount}
                    variant={
                      depositAmount === amount.toString()
                        ? "primary"
                        : "outline-secondary"
                    }
                    onClick={() => handlePresetAmountClick(amount)}
                    className="m-1 preset-btn"
                    disabled={
                      (inputCurrency === "USD"
                        ? selectedMethod.minDepositUSD ?? 0
                        : selectedMethod.minDepositTND ?? 0) > amount
                    }
                  >
                    {amount} <small>{inputCurrency}</small>
                  </Button>
                ))}
              </ButtonGroup>
            </Form.Group>
            <Form>
              <FloatingLabel
                controlId="depositAmountCustom"
                label={t("walletPage.depositModal.customAmountLabel", {
                  currency: inputCurrency,
                })}
                className="mb-3 custom-amount-label"
              >
                <InputGroup>
                  <Form.Control
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={handleAmountInputChange}
                    required
                    min={
                      inputCurrency === "USD"
                        ? selectedMethod.minDepositUSD ?? 0.01
                        : selectedMethod.minDepositTND ?? 0.01
                    }
                    step="0.01"
                    isInvalid={!!amountError}
                    size="lg"
                  />
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
                {amountError && (
                  <small className="text-danger mt-1 d-block">
                    {amountError}
                  </small>
                )}
              </FloatingLabel>
              {parseFloat(depositAmount) > 0 && !amountError && (
                <Card
                  body
                  className="commission-details-v2 text-muted small mb-3 bg-light border-0"
                >
                  <Row>
                    <Col>{t("walletPage.depositModal.estimatedFee")}:</Col>
                    <Col xs="auto" className="text-end text-danger fw-medium">
                      {formatCurrencyLocal(commissionInfo.fee, inputCurrency)}
                    </Col>
                  </Row>
                  <Row className="mt-1">
                    <Col>{t("walletPage.depositModal.netAmount")}:</Col>
                    <Col xs="auto" className="text-end text-success fw-bold">
                      {formatCurrencyLocal(
                        commissionInfo.netAmount,
                        inputCurrency
                      )}
                    </Col>
                  </Row>
                  {inputCurrency === "USD" && commissionInfo.netAmount > 0 && (
                    <Row className="mt-1 border-top pt-1">
                      <Col>{t("walletPage.depositModal.approxTND")}:</Col>
                      <Col xs="auto" className="text-end">
                        {formatCurrencyLocal(
                          commissionInfo.netAmount * TND_TO_USD_RATE,
                          "TND"
                        )}
                      </Col>
                    </Row>
                  )}
                  {inputCurrency === "TND" && commissionInfo.netAmount > 0 && (
                    <Row className="mt-1 border-top pt-1">
                      <Col>{t("walletPage.depositModal.approxUSD")}:</Col>
                      <Col xs="auto" className="text-end">
                        {formatCurrencyLocal(
                          commissionInfo.netAmount / TND_TO_USD_RATE,
                          "USD"
                        )}
                      </Col>
                    </Row>
                  )}
                </Card>
              )}
              <div className="d-grid mt-4">
                <Button
                  variant="primary"
                  onClick={() => goToStep(3)}
                  disabled={
                    !depositAmount ||
                    parseFloat(depositAmount) <= 0 ||
                    !!amountError
                  }
                >
                  {t("walletPage.sendModal.nextButton")}{" "}
                  <FaArrowRight className="ms-1" />
                </Button>
              </div>
            </Form>
          </div>
        )}
        {step === 3 && selectedMethod && (
          <div className="step-content">
            <Button
              variant="link"
              size="sm"
              onClick={() => goToStep(2)}
              className="mb-2 p-0 btn-back-v2"
            >
              <FaArrowLeft className="me-1" />{" "}
              {t("walletPage.depositModal.changeAmount")}
            </Button>
            <h4 className="mb-3 text-center fw-light">
              {t("walletPage.depositModal.confirmTitle")}
            </h4>
            <Alert variant="light" className="p-3 mb-3 shadow-sm alert-summary">
              <Row>
                <Col>{t("walletPage.depositModal.summary.method")}:</Col>
                <Col xs="auto" className="fw-bold">
                  {selectedMethod.displayName}
                </Col>
              </Row>
              <Row>
                <Col>{t("walletPage.depositModal.summary.amount")}:</Col>
                <Col xs="auto" className="fw-bold">
                  {formatCurrencyLocal(depositAmount, inputCurrency)}
                </Col>
              </Row>
              <Row>
                <Col>{t("walletPage.depositModal.summary.fee")}:</Col>
                <Col xs="auto" className="fw-bold text-danger">
                  - {formatCurrencyLocal(commissionInfo.fee, inputCurrency)}
                </Col>
              </Row>
              <hr className="my-2" />
              <Row className="fs-6">
                <Col>{t("walletPage.depositModal.summary.net")}:</Col>
                <Col xs="auto" className="fw-bold text-success">
                  {formatCurrencyLocal(commissionInfo.netAmount, inputCurrency)}
                </Col>
              </Row>
            </Alert>
            <Card className="mb-3 bg-light border payment-instructions">
              <Card.Body>
                <Card.Title className="fs-6 mb-2 d-flex align-items-center">
                  <FaInfoCircle className="me-2 text-primary" />{" "}
                  {t("walletPage.depositModal.instructionsTitle")}
                </Card.Title>
                <p className="text-muted small mb-2">
                  {t("walletPage.depositModal.instructionsBody", {
                    amount: formatCurrencyLocal(depositAmount, inputCurrency),
                  })}
                </p>
                <div className="instruction-details small">
                  {selectedMethod.name?.toLowerCase() === "cartes ooredoo" ? (
                    <p>{t("walletPage.depositModal.instructionsOoredoo")}</p>
                  ) : selectedMethod.depositTargetInfo ? (
                    <>
                      <p>
                        {t("walletPage.depositModal.instructionsSendTo", {
                          methodName: selectedMethod.displayName,
                        })}
                        :
                      </p>
                      <InputGroup size="sm" className="mb-2 copy-target-group">
                        <Form.Control
                          value={selectedMethod.depositTargetInfo}
                          readOnly
                        />
                        <OverlayTrigger
                          overlay={
                            <Tooltip>
                              {isCopied
                                ? t("walletPage.receiveModal.copiedTooltip")
                                : t("walletPage.receiveModal.copyTooltip")}
                            </Tooltip>
                          }
                        >
                          <Button
                            variant={isCopied ? "success" : "secondary"}
                            onClick={() =>
                              copyToClipboard(selectedMethod.depositTargetInfo)
                            }
                            disabled={isCopied}
                          >
                            {isCopied ? <FaCheck /> : <FaCopy />}
                          </Button>
                        </OverlayTrigger>
                      </InputGroup>
                      <p>
                        {t(
                          selectedMethod.name?.toLowerCase() === "binance pay"
                            ? "walletPage.depositModal.instructionsTxnRequired"
                            : "walletPage.depositModal.instructionsTxnOptional"
                        )}
                      </p>
                    </>
                  ) : (
                    <p>
                      {selectedMethod.description ||
                        t("walletPage.depositModal.instructionsDefault")}
                    </p>
                  )}
                </div>
              </Card.Body>
            </Card>
            <Form onSubmit={handleSubmitDeposit}>
              {selectedMethod.name?.toLowerCase() === "cartes ooredoo" ? (
                <FloatingLabel
                  controlId="ooredooCode"
                  label={t("walletPage.depositModal.ooredooLabel")}
                  className="mb-3"
                >
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={senderInfo}
                    onChange={(e) => setSenderInfo(e.target.value)}
                    required
                  />
                </FloatingLabel>
              ) : (
                <FloatingLabel
                  controlId="transactionId"
                  label={t(
                    selectedMethod.name?.toLowerCase() === "binance pay"
                      ? "walletPage.depositModal.txnLabelRequired"
                      : "walletPage.depositModal.txnLabelOptional"
                  )}
                  className="mb-3"
                >
                  <Form.Control
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    required={
                      selectedMethod.name?.toLowerCase() === "binance pay"
                    }
                  />
                </FloatingLabel>
              )}
              <Form.Group controlId="screenshotFile" className="mb-3">
                <Form.Label>
                  {t("walletPage.depositModal.screenshotLabel")}
                </Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  size="sm"
                  disabled={isUploading || loadingCreate}
                />
                {screenshotFile && !isUploading && (
                  <small className="text-success d-block mt-1">
                    <FaCheckCircle /> {screenshotFile.name}
                  </small>
                )}
                {isUploading && (
                  <small className="text-muted d-block mt-1">
                    <Spinner size="sm" />{" "}
                    {t("walletPage.depositModal.uploading")}
                  </small>
                )}
              </Form.Group>
              <div className="d-grid mt-4">
                <Button
                  variant="success"
                  type="submit"
                  disabled={
                    loadingCreate ||
                    isUploading ||
                    (selectedMethod.name?.toLowerCase() === "cartes ooredoo" &&
                      !senderInfo.trim()) ||
                    (selectedMethod.name?.toLowerCase() === "binance pay" &&
                      !transactionId.trim())
                  }
                >
                  {loadingCreate || isUploading ? (
                    <>
                      <Spinner size="sm" />{" "}
                      {t(
                        isUploading
                          ? "walletPage.depositModal.uploading"
                          : "walletPage.depositModal.submitting"
                      )}
                    </>
                  ) : (
                    t("walletPage.depositModal.submitButton")
                  )}
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default DepositModal;
