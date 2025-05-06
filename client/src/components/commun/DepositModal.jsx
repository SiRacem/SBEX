// src/components/commun/DepositModal.jsx
// *** النسخة النهائية الكاملة والمفصلة بدون أي اختصارات ***

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
  ButtonGroup,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import {
  FaArrowRight,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaRegCreditCard,
  FaCopy,
  FaCheck,
} from "react-icons/fa";
import { toast } from "react-toastify";
import axios from "axios"; // ضروري للرفع
import { getActivePaymentMethods } from "../../redux/actions/paymentMethodAction";
import "./DepositModal.css";
import {
  createDepositRequest,
  resetCreateDeposit,
} from "../../redux/actions/depositAction"; // استيراد reset

// --- الدوال والمتغيرات المساعدة ---
const TND_TO_USD_RATE = 3.0; // تأكد من تحديث هذا إذا لزم الأمر
const noImageUrlPlaceholder =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

// دالة تنسيق العملة
const formatCurrencyLocal = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || !currencyCode) return "N/A";
  try {
    return num.toLocaleString(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (e) {
    return `${num.toFixed(2)} ${currencyCode}`;
  }
};

// دالة إعدادات axios لطلبات JSON العادية
const getTokenJsonConfig = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Auth token missing.");
    return null;
  }
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
};

// دالة إعدادات axios لرفع الملفات (بدون Content-Type)
const getUploadTokenConfig = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Auth token missing.");
    return null;
  }
  return { headers: { Authorization: `Bearer ${token}` } };
};

// دالة حساب العمولة محلياً (للعرض فقط)
const calculateCommissionLocal = (method, amount, currency = "TND") => {
  if (!method || isNaN(amount) || amount <= 0)
    return { error: "Invalid input." };
  const percent = method.depositCommissionPercent ?? 0;
  const fixedTND = method.commissionFixedTND ?? 0;
  const fixedUSD = method.commissionFixedUSD ?? 0;
  const minFeeTND = method.minFeeTND ?? 0;
  const minFeeUSD = method.minFeeUSD ?? 0;
  const maxFeeTND = method.maxFeeTND ?? Infinity;
  const maxFeeUSD = method.maxFeeUSD ?? Infinity;
  const minDeposit =
    currency === "USD" ? method.minDepositUSD ?? 0 : method.minDepositTND ?? 0;

  if (amount < minDeposit) {
    return {
      error: `Minimum deposit is ${formatCurrencyLocal(minDeposit, currency)}.`,
    };
  }

  let fee = (amount * percent) / 100;
  if (currency === "TND") {
    fee += fixedTND;
    if (fixedUSD > 0) fee += fixedUSD * TND_TO_USD_RATE;
    fee = Math.max(fee, minFeeTND);
    if (minFeeUSD > 0) fee = Math.max(fee, minFeeUSD * TND_TO_USD_RATE);
    if (maxFeeTND < Infinity) fee = Math.min(fee, maxFeeTND);
    if (maxFeeUSD < Infinity) fee = Math.min(fee, maxFeeUSD * TND_TO_USD_RATE);
  } else {
    // USD
    fee += fixedUSD;
    if (fixedTND > 0) fee += fixedTND / TND_TO_USD_RATE;
    fee = Math.max(fee, minFeeUSD);
    if (minFeeTND > 0) fee = Math.max(fee, minFeeTND / TND_TO_USD_RATE);
    if (maxFeeUSD < Infinity) fee = Math.min(fee, maxFeeUSD);
    if (maxFeeTND < Infinity) fee = Math.min(fee, maxFeeTND / TND_TO_USD_RATE);
  }
  fee = Math.max(0, fee);
  const netAmount = amount - fee;
  if (netAmount < 0 && amount > 0) {
    return {
      error: `Fee (${formatCurrencyLocal(
        fee,
        currency
      )}) exceeds deposit amount.`,
    };
  }
  return {
    fee: Number(fee.toFixed(2)),
    netAmount: Number(netAmount.toFixed(2)),
    totalAmount: Number(amount.toFixed(2)),
    error: null,
  };
};
// -------------------------------------------------------------

const PRESET_AMOUNTS_TND = [5, 10, 20, 30, 40];
const PRESET_AMOUNTS_USD = [2, 5, 10, 15, 20];

// --- المكون الرئيسي ---
const DepositModal = ({ show, onHide }) => {
  const dispatch = useDispatch();

  // --- Selectors ---
  const depositState = useSelector(
    (state) => state.depositRequestReducer || {}
  );
  const { loadingCreate, errorCreate, successCreate } = useSelector(
    (state) => state.depositRequestReducer || {}
  );
  const paymentMethodState = useSelector(
    (state) => state.paymentMethodReducer || {}
  );
  const {
    activeMethods: depositMethodsRaw = [],
    loadingActive: loadingMethods = false,
    error: errorMethods = null,
  } = paymentMethodState;
  const depositMethods = useMemo(
    () =>
      depositMethodsRaw.filter(
        (m) => m.type === "deposit" || m.type === "both"
      ),
    [depositMethodsRaw]
  );

  // --- State ---
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [isCustomAmount, setIsCustomAmount] = useState(true);
  const [amountError, setAmountError] = useState(null);
  const [commissionInfo, setCommissionInfo] = useState({
    fee: 0,
    netAmount: 0,
  });
  const [transactionId, setTransactionId] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [senderInfo, setSenderInfo] = useState("");
  const [isUploading, setIsUploading] = useState(false); // حالة الرفع
  const [submitError, setSubmitError] = useState(null); // خطأ الإرسال العام
  const [inputCurrency, setInputCurrency] = useState("TND");
  const [isCopied, setIsCopied] = useState(false);

  // --- useEffect: إعادة التعيين عند فتح المودال ---
  useEffect(() => {
    if (show) {
      dispatch(getActivePaymentMethods("deposit"));
      dispatch(resetCreateDeposit()); // مسح حالة الإنشاء السابقة
      setStep(1);
      setSelectedMethod(null);
      setDepositAmount("");
      setIsCustomAmount(true);
      setAmountError(null);
      setCommissionInfo({ fee: 0, netAmount: 0 });
      setTransactionId("");
      setScreenshotFile(null);
      setSenderInfo("");
      setIsUploading(false);
      setSubmitError(null);
      setInputCurrency("TND");
      setIsCopied(false);
    }
  }, [show, dispatch]);

  // --- useEffect: تحديد العملة الافتراضية عند اختيار طريقة ---
  useEffect(() => {
    let nextCurrency = "TND";
    if (selectedMethod) {
      const minUSD = selectedMethod.minDepositUSD;
      const minTND = selectedMethod.minDepositTND;
      if (minUSD != null && minUSD > 0 && (minTND == null || minTND <= 0)) {
        nextCurrency = "USD";
      }
    }
    if (nextCurrency !== inputCurrency) {
      setInputCurrency(nextCurrency);
      setDepositAmount("");
      setAmountError(null);
      setCommissionInfo({ fee: 0, netAmount: 0 });
      setIsCustomAmount(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMethod]);

  // --- useEffect: حساب العمولة محلياً للعرض ---
  useEffect(() => {
    if (selectedMethod && depositAmount) {
      const amountNum = parseFloat(depositAmount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const calc = calculateCommissionLocal(
          selectedMethod,
          amountNum,
          inputCurrency
        );
        if (calc.error) {
          setAmountError(calc.error);
          setCommissionInfo({ fee: 0, netAmount: 0 });
        } else {
          setAmountError(null);
          setCommissionInfo({ fee: calc.fee, netAmount: calc.netAmount });
        }
      } else {
        setAmountError(null);
        setCommissionInfo({ fee: 0, netAmount: 0 });
      }
    } else {
      setAmountError(null);
      setCommissionInfo({ fee: 0, netAmount: 0 });
    }
  }, [depositAmount, selectedMethod, inputCurrency]);

  // --- useEffect: التعامل مع الإغلاق بعد نجاح الإنشاء ---
  useEffect(() => {
    let timer;
    if (successCreate) {
      toast.success("Deposit request submitted successfully!");
      timer = setTimeout(() => {
        onHide(); // أغلق المودال بعد فترة
        // --- [!] أعد تعيين الحالة بعد الإغلاق (أو قبله بقليل) ---
        // ننتظر قليلاً بعد الإغلاق لضمان عدم حدوث إعادة عرض غير متوقعة
        setTimeout(() => {
          dispatch(resetCreateDeposit());
        }, 100); // تأخير بسيط جداً
        // ----------------------------------------------------
      }, 1500); // مدة عرض رسالة النجاح قبل الإغلاق
    }
    // تنظيف المؤقت إذا تم إلغاء المكون أو تغيرت successCreate قبل انتهاء المؤقت
    return () => clearTimeout(timer);
  }, [successCreate, onHide, dispatch]);

  // --- Handlers ---
  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
  };
  const handleAmountInputChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setDepositAmount(value);
      setIsCustomAmount(true);
    }
  };
  const handlePresetAmountClick = (amount) => {
    setDepositAmount(amount.toString());
    setIsCustomAmount(false);
  };
  const handleScreenshotChange = (e) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast.warn("Max file size is 5MB.");
        setScreenshotFile(null);
        if (e.target) e.target.value = ""; // Reset file input
      } else {
        setScreenshotFile(file);
      }
    } else if (file) {
      toast.warn("Invalid file type. Please select an image.");
      setScreenshotFile(null);
      if (e.target) e.target.value = "";
    } else {
      setScreenshotFile(null);
    }
  };
  const goToStep = (nextStep) => {
    if (nextStep === 2 && !selectedMethod) {
      toast.warn("Select a method first.");
      return;
    }
    if (nextStep === 3) {
      const amountNum = parseFloat(depositAmount);
      if (
        !depositAmount ||
        isNaN(amountNum) ||
        amountNum <= 0 ||
        !!amountError
      ) {
        setAmountError(amountError || "Enter a valid amount.");
        toast.warn(amountError || "Enter a valid amount.");
        return;
      }
      const calc = calculateCommissionLocal(
        selectedMethod,
        amountNum,
        inputCurrency
      );
      if (calc.error || (calc.netAmount <= 0 && amountNum > 0)) {
        setAmountError(calc.error || "Fee exceeds amount.");
        toast.warn(calc.error || "Fee exceeds amount.");
        return;
      }
    }
    setStep(nextStep);
  };
  const copyToClipboard = useCallback(
    (textToCopy, successMessage = "Copied!") => {
      if (!textToCopy || isCopied) return;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          toast.success(successMessage);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
        })
        .catch((err) => {
          toast.error("Failed to copy.");
          console.error("Clipboard copy failed:", err);
        });
    },
    [isCopied]
  );

  // --- [!] معالج الإرسال النهائي مع رفع الملفات ---
  const handleSubmitDeposit = async (e) => {
    if (e) e.preventDefault();

    // ... (التحققات الأولية من المبلغ والطريقة والعمولة) ...
    if (
      !selectedMethod ||
      !depositAmount ||
      amountError ||
      loadingCreate ||
      isUploading
    ) {
      toast.error(
        "Please correct errors, wait for processes, or complete selections."
      );
      return;
    }
    const amountNum = parseFloat(depositAmount);
    const localCalc = calculateCommissionLocal(
      selectedMethod,
      amountNum,
      inputCurrency
    );
    if (localCalc.error || (localCalc.netAmount <= 0 && amountNum > 0)) {
      setAmountError(localCalc.error || "Fee exceeds amount.");
      toast.error(localCalc.error || "Fee exceeds amount.");
      return;
    }
    const methodNameLower = selectedMethod.name?.toLowerCase();
    if (methodNameLower === "cartes ooredoo" && !senderInfo.trim()) {
      toast.warn("Please enter Ooredoo code(s).");
      return;
    }
    const isTxnRequired = methodNameLower === "binance pay"; // Example
    if (isTxnRequired && !transactionId.trim()) {
      toast.warn("Please enter Transaction ID.");
      return;
    }

    // --- [!!! إضافة تعريف المتغير هنا !!!] ---
    let uploadedScreenshotUrl = null; // <-- عرف المتغير هنا بقيمة أولية null

    // --- رفع الملف ---
    if (screenshotFile) {
      setIsUploading(true);
      setSubmitError(null);
      const formData = new FormData();
      formData.append("proofImage", screenshotFile);
      const uploadConfig = getUploadTokenConfig(); // استخدم الإعدادات بدون Content-Type
      if (!uploadConfig) {
        toast.error("Authorization error.");
        setIsUploading(false);
        return;
      }
      try {
        toast.info("Uploading screenshot...");
        const uploadRes = await axios.post(
          "/uploads/proof",
          formData,
          uploadConfig
        );
        uploadedScreenshotUrl = uploadRes.data.filePath; // <-- الآن المتغير معرف ويمكن تعيين قيمة له
        toast.success("Screenshot uploaded.");
        console.log("Uploaded screenshot path:", uploadedScreenshotUrl);
      } catch (uploadError) {
        const errorMsg =
          uploadError.response?.data?.msg ||
          uploadError.message ||
          "File upload failed.";
        console.error("Upload failed:", uploadError.response || uploadError);
        toast.error(`Upload failed: ${errorMsg}. Submitting without proof.`);
        // لا نوقف الإرسال، uploadedScreenshotUrl ستبقى null
      } finally {
        setIsUploading(false);
      }
    }
    // --- نهاية الرفع ---

    // --- بناء بيانات الطلب ---
    const depositData = {
      amount: amountNum,
      currency: inputCurrency,
      methodName: selectedMethod.name,
      transactionId:
        methodNameLower !== "cartes ooredoo" && transactionId
          ? transactionId.trim()
          : undefined,
      senderInfo:
        methodNameLower === "cartes ooredoo" && senderInfo
          ? senderInfo.trim()
          : undefined,
      screenshotUrl: uploadedScreenshotUrl, // <-- الآن المتغير معرف ويحمل المسار أو null
    };
    // ---------------------

    console.log("Dispatching createDepositRequest:", depositData);
    setSubmitError(null);
    // --- إرسال للـ Action ---
    dispatch(createDepositRequest(depositData));
    // ----------------------
  };
  // -------------------------------------------------------

  // --- دالة عرض تفاصيل العمولة والحدود في الخطوة 1 ---
  const renderFeeDetails = (method) => {
    if (!method) return null;
    let feeStrings = [];
    let limitStrings = [];
    if (method.depositCommissionPercent > 0)
      feeStrings.push(`${method.depositCommissionPercent}%`);
    if (method.commissionFixedTND > 0)
      feeStrings.push(
        `${formatCurrencyLocal(method.commissionFixedTND, "TND")}`
      );
    if (method.commissionFixedUSD > 0)
      feeStrings.push(
        `${formatCurrencyLocal(method.commissionFixedUSD, "USD")}`
      );
    const feeText =
      feeStrings.length > 0 ? (
        `Fee: ${feeStrings.join(" + ")}`
      ) : (
        <span className="text-success">No Fee</span>
      );
    if (
      method.minDepositTND >= 0 &&
      (method.minDepositTND > 0 ||
        !method.minDepositUSD ||
        method.minDepositUSD <= 0)
    )
      limitStrings.push(
        `Min: ${formatCurrencyLocal(method.minDepositTND, "TND")}`
      );
    if (
      method.minDepositUSD >= 0 &&
      (method.minDepositUSD > 0 ||
        !method.minDepositTND ||
        method.minDepositTND <= 0)
    )
      limitStrings.push(
        `Min: ${formatCurrencyLocal(method.minDepositUSD, "USD")}`
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

  // --- العرض (JSX) ---
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      backdrop="static"
      centered
      className="deposit-modal professional"
    >
      <Modal.Header closeButton className="border-0 pb-0 pt-3 px-4">
        <Modal.Title as="h5">Deposit Funds</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {/* مؤشر الخطوات */}
        <div className="mb-4 text-center step-indicator">
          <span className={`step ${step >= 1 ? "active" : ""}`}>
            <span className="step-number">1</span> Method
          </span>
          <span className="connector"></span>
          <span className={`step ${step >= 2 ? "active" : ""}`}>
            <span className="step-number">2</span> Amount
          </span>
          <span className="connector"></span>
          <span className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span> Details
          </span>
        </div>
        {/* عرض الأخطاء */}
        {(errorCreate || submitError) && (
          <Alert
            variant="danger"
            className="mt-2 mb-3"
            onClose={() => {
              dispatch(resetCreateDeposit());
              setSubmitError(null);
            }}
            dismissible
          >
            {errorCreate || submitError || "An error occurred."}
          </Alert>
        )}

        {/* --- Step 1: Select Method --- */}
        {step === 1 && (
          <div className="step-content">
            <p className="mb-3 text-center text-muted small">
              Select your preferred deposit method.
            </p>
            {loadingMethods && (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            )}
            {errorMethods && (
              <Alert variant="warning" className="text-center">
                Could not load methods: {errorMethods}
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
                          {method.logoUrl ? (
                            <Image
                              src={method.logoUrl}
                              className="method-logo-v2 mb-2"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "block";
                              }}
                            />
                          ) : (
                            <FaRegCreditCard
                              size={30}
                              className="text-muted mb-2"
                            />
                          )}
                          <span
                            style={
                              method.logoUrl
                                ? { display: "none" }
                                : { display: "block" }
                            }
                          >
                            <FaRegCreditCard
                              size={30}
                              className="text-muted mb-2"
                            />
                          </span>
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
                      No deposit methods available.
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
                Next Step <FaArrowRight className="ms-1" />
              </Button>
            </div>
          </div>
        )}

        {/* --- Step 2: Enter Amount --- */}
        {step === 2 && selectedMethod && (
          <div className="step-content">
            <Button
              variant="link"
              size="sm"
              onClick={() => setStep(1)}
              className="mb-3 p-0 btn-back-v2"
            >
              <FaArrowLeft className="me-1" /> Change Method
            </Button>
            <h4 className="mb-1 text-center fw-light">Enter Amount</h4>
            <p className="text-center text-muted mb-4 small">
              Using{" "}
              <span className="fw-medium">{selectedMethod.displayName}</span>
            </p>
            {/* Preset Amounts */}
            <Form.Group className="mb-3 text-center quick-amount-group">
              <Form.Label className="d-block mb-2 small text-muted">
                Select Amount ({inputCurrency}):
              </Form.Label>
              <ButtonGroup
                size="sm"
                className="flex-wrap justify-content-center"
              >
                {(inputCurrency === "TND"
                  ? PRESET_AMOUNTS_TND
                  : PRESET_AMOUNTS_USD
                ).map((amount) => {
                  const minDeposit =
                    inputCurrency === "USD"
                      ? selectedMethod.minDepositUSD ?? 0
                      : selectedMethod.minDepositTND ?? 0;
                  const isDisabled = minDeposit != null && amount < minDeposit;
                  return (
                    <Button
                      key={amount}
                      variant={
                        depositAmount === amount.toString() && !isCustomAmount
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => handlePresetAmountClick(amount)}
                      className="m-1 preset-btn"
                      disabled={isDisabled}
                    >
                      {amount} <small>{inputCurrency}</small>
                    </Button>
                  );
                })}
              </ButtonGroup>
            </Form.Group>
            {/* Custom Amount Input */}
            <Form>
              <FloatingLabel
                controlId="depositAmountCustom"
                label={`Or Enter Custom Amount (${inputCurrency})`}
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
                    onClick={() => setIsCustomAmount(true)}
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
              {/* Commission Details */}
              {parseFloat(depositAmount) > 0 && !amountError && (
                <Card
                  body
                  className="commission-details-v2 text-muted small mb-3 bg-light border-0"
                >
                  <Row>
                    <Col>Estimated Fee:</Col>
                    <Col xs="auto" className="text-end text-danger fw-medium">
                      {formatCurrencyLocal(commissionInfo.fee, inputCurrency)}
                    </Col>
                  </Row>
                  <Row className="mt-1">
                    <Col>Net Amount Credited:</Col>
                    <Col xs="auto" className="text-end text-success fw-bold">
                      {formatCurrencyLocal(
                        commissionInfo.netAmount,
                        inputCurrency
                      )}
                    </Col>
                  </Row>
                  {/* Approx value in other currency */}
                  {inputCurrency === "USD" && commissionInfo.netAmount > 0 && (
                    <Row className="mt-1 border-top pt-1">
                      <Col>Approx. TND Credited:</Col>
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
                      <Col>Approx. USD Credited:</Col>
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
              {/* Next Button */}
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
                  Next Step <FaArrowRight className="ms-1" />
                </Button>
              </div>
            </Form>
          </div>
        )}

        {/* --- Step 3: Confirm & Details --- */}
        {step === 3 && selectedMethod && (
          <div className="step-content">
            <Button
              variant="link"
              size="sm"
              onClick={() => goToStep(2)}
              className="mb-2 p-0 btn-back-v2"
            >
              <FaArrowLeft className="me-1" /> Change Amount
            </Button>
            <h4 className="mb-3 text-center fw-light">
              Confirm & Payment Details
            </h4>
            {/* Deposit Summary */}
            <Alert variant="light" className="p-3 mb-3 shadow-sm alert-summary">
              <Row>
                <Col>Method:</Col>
                <Col xs="auto" className="fw-bold">
                  {selectedMethod.displayName}
                </Col>
              </Row>
              <Row>
                <Col>Deposit Amount:</Col>
                <Col xs="auto" className="fw-bold">
                  {formatCurrencyLocal(depositAmount, inputCurrency)}
                </Col>
              </Row>
              <Row>
                <Col>Est. Fee:</Col>
                <Col xs="auto" className="fw-bold text-danger">
                  - {formatCurrencyLocal(commissionInfo.fee, inputCurrency)}
                </Col>
              </Row>
              <hr className="my-2" />
              <Row className="fs-6">
                <Col>Est. Net Amount:</Col>
                <Col xs="auto" className="fw-bold text-success">
                  {formatCurrencyLocal(commissionInfo.netAmount, inputCurrency)}
                </Col>
              </Row>
            </Alert>
            {/* Payment Instructions */}
            <Card className="mb-3 bg-light border payment-instructions">
              <Card.Body>
                <Card.Title className="fs-6 mb-2 d-flex align-items-center">
                  <FaInfoCircle className="me-2 text-primary" /> Payment
                  Instructions
                </Card.Title>
                <p className="text-muted small mb-2">
                  Please transfer exactly{" "}
                  <strong className="text-primary">
                    {formatCurrencyLocal(depositAmount, inputCurrency)}
                  </strong>{" "}
                  using the details below and provide proof.
                </p>
                <div className="instruction-details small">
                  {/* Dynamic Payment Info */}
                  {selectedMethod.name?.toLowerCase() === "cartes ooredoo" ? (
                    <p>Enter code below.</p>
                  ) : selectedMethod.depositTargetInfo ? (
                    <>
                      <p>Send to ({selectedMethod.displayName}):</p>
                      <InputGroup size="sm" className="mb-2">
                        <Form.Control
                          value={selectedMethod.depositTargetInfo}
                          readOnly
                        />
                        <OverlayTrigger
                          overlay={
                            <Tooltip>{isCopied ? "Copied!" : "Copy"}</Tooltip>
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
                        Enter Txn ID below{" "}
                        {selectedMethod.name?.toLowerCase() === "binance pay"
                          ? "(Required)."
                          : "(Optional)."}
                      </p>
                    </>
                  ) : (
                    <p>
                      {selectedMethod.description ||
                        `Follow standard procedure.`}
                    </p>
                  )}
                </div>
              </Card.Body>
            </Card>
            {/* Form for Additional Info */}
            <Form onSubmit={handleSubmitDeposit}>
              {/* Ooredoo Input or Transaction ID Input */}
              {selectedMethod.name?.toLowerCase() === "cartes ooredoo" ? (
                <FloatingLabel
                  controlId="ooredooCode"
                  label="Ooredoo Code(s) (Required)"
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
                  label={`Transaction ID / Reference ${
                    selectedMethod.name?.toLowerCase() === "binance pay"
                      ? "(Required)"
                      : "(Optional)"
                  }`}
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
              {/* Screenshot Upload */}
              <Form.Group controlId="screenshotFile" className="mb-3">
                <Form.Label>Payment Screenshot (Optional)</Form.Label>
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
                    <Spinner size="sm" /> Uploading...
                  </small>
                )}
              </Form.Group>
              {/* Submit Button */}
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
                      {isUploading ? "Uploading..." : "Submitting..."}
                    </>
                  ) : (
                    "Submit Deposit Request"
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
