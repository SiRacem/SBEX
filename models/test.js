// src/components/commun/DepositModal.jsx
// *** نسخة كاملة نهائية ومصححة ومنظفة - بدون اختصارات ***

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Modal, Button, Form, Row, Col, Card, Spinner, Alert,
  FloatingLabel, Image, InputGroup, Badge, ButtonGroup,
  OverlayTrigger, Tooltip,
} from "react-bootstrap";
import {
  FaArrowRight, FaArrowLeft, FaInfoCircle, FaCheckCircle,
  FaRegCreditCard, FaCopy, FaCheck, FaExclamationTriangle, // إزالة FaHourglassHalf
} from "react-icons/fa";
import { toast } from "react-toastify";
import axios from "axios";
import { getActivePaymentMethods } from "../../redux/actions/paymentMethodAction";
import {
  createDepositRequest,
  resetCreateDeposit,
} from "../../redux/actions/depositRequestAction";
import "./DepositModal.css";

// --- الدوال والمتغيرات المساعدة ---
const TND_TO_USD_RATE = 3.0;
const noImageUrl = 'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const formatCurrency = (amount, currencyCode = "TND") => { /* ... تبقى كما هي ... */
    const num = Number(amount);
    if (isNaN(num)) return "N/A";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, minimumFractionDigits: 2 }).format(num);
};

// --- [معدل] دالة حساب عمولة الإيداع المحلية ---
const calculateDepositCommissionLocal = (method, amount, currency = "TND") => {
    if (!method || isNaN(amount) || amount <= 0) return { error: "Invalid input." };

    // الحد الأدنى للإيداع
    const minDeposit = currency === "USD" ? (method.minDepositUSD ?? 0) : (method.minDepositTND ?? 0);
    if (amount < minDeposit) {
        return { error: `Minimum deposit is ${formatCurrency(minDeposit, currency)}.` };
    }

    // نسبة عمولة الإيداع
    const depositPercent = method.depositCommissionPercent ?? 0;

    // حساب العمولة فقط بالنسبة المئوية
    let fee = (amount * depositPercent) / 100;
    fee = Math.max(0, fee); // لا يمكن أن تكون سالبة

    const netAmount = amount - fee;

    // تأكد أن العمولة لا تتجاوز المبلغ (نادر الحدوث مع النسبة فقط لكن جيد التحقق)
    if (netAmount < 0 && amount > 0) {
        return { error: `Calculated fee (${formatCurrency(fee, currency)}) exceeds deposit amount.` };
    }

    return {
        fee: Number(fee.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2)),
        totalAmount: Number(amount.toFixed(2)), // المبلغ الإجمالي = المبلغ المدخل
        error: null
    };
};
// -------------------------------------------------------------

const PRESET_AMOUNTS_TND = [5, 10, 20, 30, 40];
const PRESET_AMOUNTS_USD = [2, 5, 10, 15, 20];

const DepositModal = ({ show, onHide }) => {
  const dispatch = useDispatch();
  const { activeMethods: depositMethods, loadingActive: loadingMethods, error: errorMethods } = useSelector(state => state.paymentMethodReducer);
  const { loadingCreate, errorCreate, successCreate } = useSelector(state => state.depositRequestReducer);

  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [isCustomAmount, setIsCustomAmount] = useState(true);
  const [amountError, setAmountError] = useState(null);
  // commissionInfo الآن تحتوي فقط على fee و netAmount
  const [commissionInfo, setCommissionInfo] = useState({ fee: 0, netAmount: 0 });
  const [transactionId, setTransactionId] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [senderInfo, setSenderInfo] = useState("");
  const [inputCurrency, setInputCurrency] = useState("TND");
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);

  // --- useEffects (تحديث لحساب العمولة) ---
  useEffect(() => { if (show) { dispatch(getActivePaymentMethods("deposit")); dispatch(resetCreateDeposit()); setStep(1); setSelectedMethod(null); setDepositAmount(""); setIsCustomAmount(true); setAmountError(null); setCommissionInfo({ fee: 0, netAmount: 0 }); setTransactionId(""); setScreenshotFile(null); setSenderInfo(""); setInputCurrency("TND"); setIsCopied(false); setIsSubmittingLocally(false); } }, [show, dispatch]);
  useEffect(() => { if (!show) { setIsSubmittingLocally(false); } }, [show]);
  useEffect(() => { if (successCreate) { dispatch(resetCreateDeposit()); onHide(); } }, [successCreate, dispatch, onHide]);
  useEffect(() => { let nextCurrency = "TND"; if (selectedMethod) { const minUSD = selectedMethod.minDepositUSD; const minTND = selectedMethod.minDepositTND; if (minUSD != null && minUSD > 0 && (minTND == null || minTND <= 0)) { nextCurrency = "USD"; } } if (nextCurrency !== inputCurrency) { setInputCurrency(nextCurrency); setDepositAmount(""); setAmountError(null); setCommissionInfo({ fee: 0, netAmount: 0 }); setIsCustomAmount(true); } }, [selectedMethod, inputCurrency]);
  // استخدام الدالة المعدلة
  useEffect(() => {
      setAmountError(null); // إعادة تعيين الخطأ عند تغيير المبلغ
      setCommissionInfo({ fee: 0, netAmount: 0 }); // إعادة تعيين العمولة
      if (selectedMethod && depositAmount) {
          const amountNum = parseFloat(depositAmount);
          if (!isNaN(amountNum) && amountNum > 0) {
              // استخدام دالة الحساب الجديدة
              const calc = calculateDepositCommissionLocal(selectedMethod, amountNum, inputCurrency);
              if (calc.error) {
                  setAmountError(calc.error);
              } else {
                  setCommissionInfo({ fee: calc.fee, netAmount: calc.netAmount });
              }
          }
      }
  }, [depositAmount, selectedMethod, inputCurrency]);

  // --- Handlers (تبقى كما هي في الغالب) ---
  const handleSelectMethod = (method) => setSelectedMethod(method);
  const handleAmountInputChange = (e) => { const value = e.target.value; if (/^\d*\.?\d{0,2}$/.test(value) || value === "") { setDepositAmount(value); setIsCustomAmount(true); } };
  const handlePresetAmountClick = (amount) => { setDepositAmount(amount.toString()); setIsCustomAmount(false); };
  const handleScreenshotChange = (e) => { /* ... تبقى كما هي ... */
      const file = e.target.files[0]; if (file && file.type.startsWith("image/")) { if (file.size > 5 * 1024 * 1024) { toast.warn("Max file size 5MB."); setScreenshotFile(null); e.target.value = null; } else { setScreenshotFile(file); } } else if (file) { setScreenshotFile(null); e.target.value = null; toast.warn("Invalid file type."); } else { setScreenshotFile(null); }
  };
  const goToStep = (nextStep) => {
      if (nextStep === 2 && !selectedMethod) { toast.warn("Select a method first."); return; }
      if (nextStep === 3) {
          const amountNum = parseFloat(depositAmount);
          if (!depositAmount || isNaN(amountNum) || amountNum <= 0) {
              setAmountError("Enter a valid deposit amount.");
              toast.warn("Enter a valid deposit amount.");
              return;
          }
          // إعادة التحقق من العمولة والحد الأدنى
          const calc = calculateDepositCommissionLocal(selectedMethod, amountNum, inputCurrency);
          if (calc.error) {
              setAmountError(calc.error);
              toast.warn(calc.error);
              return;
          }
          if (calc.netAmount <= 0 && amountNum > 0) {
              const feeErrorMsg = `Calculated fee (${formatCurrency(calc.fee, inputCurrency)}) exceeds deposit amount.`;
              setAmountError(feeErrorMsg);
              toast.warn(feeErrorMsg);
              return;
          }
           setAmountError(null); // مسح الخطأ إذا كان كل شيء صحيحًا
      }
      setStep(nextStep);
  };
  const copyToClipboard = useCallback((textToCopy, successMessage = "Copied!") => { /* ... تبقى كما هي ... */
      if (!textToCopy || isCopied) return; navigator.clipboard.writeText(textToCopy).then(() => { toast.success(successMessage); setIsCopied(true); setTimeout(() => setIsCopied(false), 2500); }).catch(err => { toast.error("Failed to copy."); console.error("Clipboard copy failed:", err); });
  }, [isCopied]);

  // --- معالج الإرسال النهائي (لا يتغير منطق الإرسال، فقط التحقق الأولي) ---
  const handleSubmitDeposit = async (e) => {
      if (e) e.preventDefault();
      if (isSubmittingLocally || loadingCreate) { console.warn("Submission attempt blocked: Already submitting."); return; }

      // إعادة التحقق قبل الإرسال مباشرة
      const amountNum = parseFloat(depositAmount);
      if (!selectedMethod || !depositAmount || isNaN(amountNum) || amountNum <= 0) {
          toast.error("Invalid deposit amount or method."); return;
      }
      const calc = calculateDepositCommissionLocal(selectedMethod, amountNum, inputCurrency);
      if (calc.error) {
          toast.error(`Calculation Error: ${calc.error}`); return;
      }
      if (calc.netAmount <= 0 && amountNum > 0) {
          toast.error(`Fee (${formatCurrency(calc.fee, inputCurrency)}) exceeds deposit amount.`); return;
      }

      // بقية التحققات (Ooredoo, Binance ID)
      const methodNameLower = selectedMethod.name?.toLowerCase();
      if (methodNameLower === "cartes ooredoo" && !senderInfo.trim()) { toast.warn("Please enter the Ooredoo recharge code(s)."); return; }
      const isTxnRequired = methodNameLower === "binance pay";
      if (isTxnRequired && !transactionId.trim()) { toast.warn("Please enter the Transaction ID."); return; }

      setIsSubmittingLocally(true);
      let uploadedScreenshotUrl = null;
      // ... (منطق رفع الصورة يبقى كما هو) ...
        if (screenshotFile) {
            const formData = new FormData();
            formData.append('proofImage', screenshotFile);
            const token = localStorage.getItem('token');
            if (!token) { toast.error("Authentication error. Please log in again."); setIsSubmittingLocally(false); return; }
            const uploadConfig = { headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` } };
            try {
                toast.info("Uploading screenshot...");
                const uploadRes = await axios.post('/uploads/proof', formData, uploadConfig);
                uploadedScreenshotUrl = uploadRes.data.filePath;
                toast.success("Screenshot uploaded."); console.log("Uploaded screenshot URL:", uploadedScreenshotUrl);
            } catch (uploadError) {
                console.error("Screenshot upload failed:", uploadError.response?.data || uploadError);
                toast.error(`Screenshot upload failed: ${uploadError.response?.data?.msg || uploadError.message}`);
                setIsSubmittingLocally(false); return;
            }
        }

      const depositData = {
          amount: amountNum, // المبلغ الإجمالي الذي أرسله المستخدم
          currency: inputCurrency,
          methodName: selectedMethod?.name, // تأكد من إرسال الاسم الفريد للـ Backend
          transactionId: methodNameLower !== "cartes ooredoo" ? transactionId || undefined : undefined,
          senderInfo: methodNameLower === "cartes ooredoo" ? senderInfo || undefined : undefined,
          screenshotUrl: uploadedScreenshotUrl
      };

      console.log("Dispatching createDepositRequest with data:", depositData);
      const success = await dispatch(createDepositRequest(depositData));
      if (!success) { setIsSubmittingLocally(false); } // السماح بإعادة المحاولة إذا فشل الـ dispatch
  };

  // --- [معدل] دالة عرض تفاصيل العمولة والحدود ---
  const renderDepositMethodDetails = (method) => {
      if (!method) return null;
      const depositPercent = method.depositCommissionPercent ?? 0;
      let feeStrings = [];

      // عرض النسبة فقط
      if (depositPercent > 0) {
          feeStrings.push(`${depositPercent}% Fee`);
      } else {
          feeStrings.push(<span className="text-success">No Fee</span>);
      }

      const feeText = feeStrings[0]; // الحصول على النص أو المكون

      // عرض الحدود الدنيا
      let limitStrings = [];
      const minDepositTND = method.minDepositTND;
      const minDepositUSD = method.minDepositUSD;
      if (minDepositTND != null && minDepositTND >= 0) limitStrings.push(`Min: ${formatCurrency(minDepositTND, "TND")}`);
      if (minDepositUSD != null && minDepositUSD >= 0) limitStrings.push(`Min: ${formatCurrency(minDepositUSD, "USD")}`);
      const limitString = limitStrings.length > 0 ? limitStrings.join(' / ') : null;

      return (
          <>
              <Badge pill bg="light" text="dark" className="detail-badge">{feeText}</Badge>
              {limitString && (<Badge pill bg="light" text="dark" className="detail-badge ms-1">{limitString}</Badge>)}
          </>
      );
  };

  // --- العرض JSX (يستخدم الدالة المعدلة renderDepositMethodDetails) ---
  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static" centered className="deposit-modal professional">
      {/* ... (Header ومؤشر الخطوات يبقى كما هو) ... */}
       <Modal.Header closeButton className="border-0 pb-0 pt-3 px-4">
        <Modal.Title as="h5">Deposit Funds</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {/* مؤشر الخطوات */}
        <div className="mb-4 text-center step-indicator">
          <span className={`step ${step >= 1 ? "active" : ""}`}><span className="step-number">1</span> Method</span> <span className="connector"></span>
          <span className={`step ${step >= 2 ? "active" : ""}`}><span className="step-number">2</span> Amount</span> <span className="connector"></span>
          <span className={`step ${step >= 3 ? "active" : ""}`}><span className="step-number">3</span> Details</span>
        </div>
        {errorCreate && (<Alert variant="danger" className="mt-2 mb-3">{errorCreate}</Alert>)}

        {/* Step 1 */}
        {step === 1 && (
          <div className="step-content">
            <p className="mb-3 text-center text-muted small">Select your preferred deposit method.</p>
            {loadingMethods && (<div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>)}
            {errorMethods && (<Alert variant="warning" className="text-center">Could not load deposit methods: {errorMethods}</Alert>)}
            {!loadingMethods && !errorMethods && (
              <Row xs={1} sm={2} md={3} className="g-3 method-selection">
                {depositMethods.length > 0 ? (
                  depositMethods.map((method) => (
                    <Col key={method._id}>
                      <Card className={`method-card h-100 ${selectedMethod?._id === method._id ? "selected" : ""}`} onClick={() => handleSelectMethod(method)}>
                        <Card.Body className="text-center d-flex flex-column align-items-center p-3">
                          {/* ... (عرض الشعار والاسم) ... */}
                            {method.logoUrl ? ( <Image src={method.logoUrl} className="method-logo-v2 mb-2" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}/> ) : ( <FaRegCreditCard size={30} className="text-muted mb-2" /> )}
                            <span style={method.logoUrl ? { display: 'none' } : { display: 'block' }}><FaRegCreditCard size={30} className="text-muted mb-2" /></span>
                            <Card.Title className="method-name-v2 mt-auto mb-1">{method.displayName || method.name}</Card.Title>
                          {/* استخدام الدالة المعدلة للعرض */}
                          <div className="method-details-badges mt-1">{renderDepositMethodDetails(method)}</div>
                        </Card.Body>
                        {selectedMethod?._id === method._id && (<div className="selected-checkmark"><FaCheckCircle /></div>)}
                      </Card>
                    </Col>
                  ))
                ) : ( <Col><Alert variant="light" className="text-center">No deposit methods available.</Alert></Col> )}
              </Row>
            )}
            <div className="d-grid mt-4"> <Button variant="primary" onClick={() => goToStep(2)} disabled={!selectedMethod}> Next Step <FaArrowRight className="ms-1" /> </Button> </div>
          </div>
        )}

        {/* Step 2 (عرض العمولة المعدل) */}
        {step === 2 && selectedMethod && (
           <div className="step-content">
            <Button variant="link" size="sm" onClick={() => setStep(1)} className="mb-3 p-0 btn-back-v2"><FaArrowLeft className="me-1" /> Change Method</Button>
            <h4 className="mb-1 text-center fw-light">Enter Amount</h4>
            <p className="text-center text-muted mb-4 small">Using <span className="fw-medium">{selectedMethod.displayName}</span></p>
            {/* ... (أزرار المبالغ المقترحة) ... */}
             <Form.Group className="mb-3 text-center quick-amount-group">
              <Form.Label className="d-block mb-2 small text-muted">Select Amount ({inputCurrency}):</Form.Label>
              <ButtonGroup size="sm" className="flex-wrap justify-content-center">
                {(inputCurrency === "TND" ? PRESET_AMOUNTS_TND : PRESET_AMOUNTS_USD).map((amount) => { const minDeposit = inputCurrency === "USD" ? (selectedMethod.minDepositUSD ?? 0) : (selectedMethod.minDepositTND ?? 0); const isDisabled = minDeposit != null && amount < minDeposit; return (<Button key={amount} variant={depositAmount === amount.toString() && !isCustomAmount ? "primary" : "outline-secondary"} onClick={() => handlePresetAmountClick(amount)} className="m-1 preset-btn" disabled={isDisabled}> {amount} <small>{inputCurrency}</small> </Button>); })}
              </ButtonGroup>
            </Form.Group>
            <Form>
              <FloatingLabel controlId="depositAmountCustom" className="mb-3 custom-amount-label">
                <InputGroup>
                  <Form.Control type="number" placeholder="0.00" value={depositAmount} onChange={handleAmountInputChange} required min={inputCurrency === "USD" ? (selectedMethod.minDepositUSD ?? 0.01) : (selectedMethod.minDepositTND ?? 0.01)} step="0.01" isInvalid={!!amountError} onClick={() => setIsCustomAmount(true)} size="lg"/>
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
                {amountError && (<small className="text-danger mt-1 d-block">{amountError}</small>)}
              </FloatingLabel>
              {/* تفاصيل العمولة (مبسطة) */}
              {(depositAmount || !amountError) && parseFloat(depositAmount) > 0 && (
                <Card body className="commission-details-v2 text-muted small mb-3 bg-light border-0">
                  <Row><Col>Deposit Amount:</Col><Col xs="auto" className="text-end fw-medium">{formatCurrency(depositAmount, inputCurrency)}</Col></Row>
                  {/* عرض العمولة فقط إذا كانت أكبر من صفر */}
                  {commissionInfo.fee > 0 && (
                    <Row><Col>Est. Fee ({selectedMethod.depositCommissionPercent}%):</Col><Col xs="auto" className="text-end text-danger fw-medium">- {formatCurrency(commissionInfo.fee, inputCurrency)}</Col></Row>
                  )}
                   {/* عرض الصافي دائماً */}
                  <Row className={`mt-1 ${commissionInfo.fee > 0 ? 'border-top pt-1' : ''}`}><Col>Net Amount Credited:</Col><Col xs="auto" className="text-end text-success fw-bold">{formatCurrency(commissionInfo.netAmount, inputCurrency)}</Col></Row>
                  {/* ... (عرض القيمة التقريبية للعملة الأخرى يبقى كما هو) ... */}
                    {inputCurrency === "USD" && commissionInfo.netAmount > 0 && (<Row className="mt-1 border-top pt-1"><Col>Approx. TND Credited:</Col><Col xs="auto" className="text-end">{formatCurrency(commissionInfo.netAmount * TND_TO_USD_RATE, "TND")}</Col></Row>)}
                    {inputCurrency === "TND" && commissionInfo.netAmount > 0 && (<Row className="mt-1 border-top pt-1"><Col>Approx. USD Credited:</Col><Col xs="auto" className="text-end">{formatCurrency(commissionInfo.netAmount / TND_TO_USD_RATE, "USD")}</Col></Row>)}
                </Card>
              )}
              <div className="d-grid mt-4"> <Button variant="primary" onClick={() => goToStep(3)} disabled={!depositAmount || parseFloat(depositAmount) <= 0 || !!amountError}> Next Step <FaArrowRight className="ms-1" /> </Button> </div>
            </Form>
          </div>
        )}

        {/* Step 3 (عرض العمولة المعدل في الملخص) */}
        {step === 3 && selectedMethod && (
          <div className="step-content">
             <Button variant="link" size="sm" onClick={() => goToStep(2)} className="mb-2 p-0 btn-back-v2"><FaArrowLeft className="me-1" /> Change Amount</Button>
            <h4 className="mb-3 text-center fw-light">Confirm & Payment Details</h4>
            {/* ملخص الإيداع (معدل) */}
            <Alert variant="light" className="p-3 mb-3 shadow-sm alert-summary">
              <Row><Col>Method:</Col><Col xs="auto" className="fw-bold">{selectedMethod.displayName}</Col></Row>
              <Row><Col>Deposit Amount:</Col><Col xs="auto" className="fw-bold">{formatCurrency(depositAmount, inputCurrency)}</Col></Row>
              {/* عرض العمولة فقط إذا كانت أكبر من صفر */}
              {commissionInfo.fee > 0 && (
                <Row><Col>Est. Fee ({selectedMethod.depositCommissionPercent}%):</Col><Col xs="auto" className="fw-bold text-danger">- {formatCurrency(commissionInfo.fee, inputCurrency)}</Col></Row>
              )}
              <hr className="my-2" />
              <Row className="fs-6"><Col>Est. Net Amount:</Col><Col xs="auto" className="fw-bold text-success">{formatCurrency(commissionInfo.netAmount, inputCurrency)}</Col></Row>
            </Alert>
            {/* ... (باقي تعليمات الدفع وحقول الإدخال وزر الإرسال تبقى كما هي) ... */}
            <Card className="mb-3 bg-light border payment-instructions">
              <Card.Body>
                <Card.Title className="fs-6 mb-2 d-flex align-items-center"><FaInfoCircle className="me-2 text-primary" /> Payment Instructions</Card.Title>
                <p className="text-muted small mb-2">Please transfer exactly <strong className="text-primary">{formatCurrency(depositAmount, inputCurrency)}</strong> using the details below and provide proof.</p>
                 <div className="instruction-details small">
                  {selectedMethod.name?.toLowerCase() === "cartes ooredoo" ? ( <p className="mt-2">Enter the 14-digit recharge code(s) you purchased in the 'Recharge Code(s)' field below.</p> ) :
                   selectedMethod.depositTargetInfo ? (
                      <>
                          <p className="mb-1">Send the amount to the following ({selectedMethod.displayName}):</p>
                          <InputGroup size="sm" className="mb-2 copy-target-group">
                              <Form.Control value={selectedMethod.depositTargetInfo} readOnly aria-label={`${selectedMethod.displayName} Info`}/>
                              <OverlayTrigger placement="top" overlay={<Tooltip>{isCopied ? "Copied!" : `Copy ${selectedMethod.displayName} Info`}</Tooltip>}>
                                  <span className="d-inline-block">
                                      <Button variant={isCopied ? "success" : "outline-secondary"} onClick={() => copyToClipboard(selectedMethod.depositTargetInfo, `${selectedMethod.displayName} Info Copied!`)} disabled={isCopied} size="sm">
                                          {isCopied ? <FaCheck /> : <FaCopy />}
                                      </Button>
                                  </span>
                              </OverlayTrigger>
                          </InputGroup>
                          <p className="mt-2">After sending, enter the Transaction ID / Reference below{selectedMethod.name?.toLowerCase() === "binance pay" ? " (Required)." : " (Optional)."}</p>
                      </>
                  ) : ( <p className="mt-2">{selectedMethod.description || `Follow the standard procedure for ${selectedMethod.displayName}. No specific target info provided.`}</p> )}
                </div>
              </Card.Body>
            </Card>
            <Form onSubmit={handleSubmitDeposit}>
              {selectedMethod.name?.toLowerCase() === "cartes ooredoo" ? (
                  <FloatingLabel controlId="ooredooCode" label="Ooredoo Recharge Code(s) (Required)" className="mb-3">
                      <Form.Control as="textarea" rows={3} placeholder="Enter 14-digit code(s)..." value={senderInfo} onChange={(e) => setSenderInfo(e.target.value)} id="cartesOoredooCode" required/>
                      <Form.Control.Feedback type="invalid">Recharge code is required.</Form.Control.Feedback>
                  </FloatingLabel>
              ) : (
                  <FloatingLabel controlId="transactionId" label={`Transaction ID / Reference ${ selectedMethod.name?.toLowerCase() === "binance pay" ? "(Required)" : "(Optional)" }`} className="mb-3">
                      <Form.Control type="text" placeholder="Enter transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required={selectedMethod.name?.toLowerCase() === "binance pay"}/>
                      {selectedMethod.name?.toLowerCase() === "binance pay" && ( <Form.Control.Feedback type="invalid">Transaction ID is required.</Form.Control.Feedback> )}
                  </FloatingLabel>
              )}
              <Form.Group controlId="screenshotFile" className="mb-3">
                <Form.Label>Payment Screenshot (Optional)</Form.Label>
                <Form.Control type="file" accept="image/*" onChange={handleScreenshotChange} size="sm"/>
                {screenshotFile && (<small className="text-success d-block mt-1"><FaCheckCircle className="me-1" /> {screenshotFile.name} selected.</small>)}
              </Form.Group>
              <div className="d-grid mt-4">
                <Button variant="success" type="submit" disabled={ loadingCreate || isSubmittingLocally || (selectedMethod.name?.toLowerCase() === 'cartes ooredoo' && !senderInfo.trim()) || (selectedMethod.name?.toLowerCase() === 'binance pay' && !transactionId.trim()) }>
                  {(loadingCreate || isSubmittingLocally) ? ( <><Spinner as="span" animation="border" size="sm" />{" "}Submitting...</> ) : ( "Submit Deposit Request" )}
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












---------------------------------------------------------------------------------------------------------
WithdrawModal.jsx :
// src/components/commun/WithdrawModal.jsx
// *** نسخة كاملة ونهائية: عرض وحساب بعملة الإدخال، معالجة داخلية بالدينار ***

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "react-bootstrap";
import {
  FaArrowRight,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaRegCreditCard,
  FaExclamationTriangle,
  FaHourglassHalf,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { getActivePaymentMethods } from "../../redux/actions/paymentMethodAction";
import {
  createWithdrawalRequest,
  resetCreateWithdrawal,
} from "../../redux/actions/withdrawalRequestAction";
// import './WithdrawModal.css'; // تأكد من وجوده إذا احتجت تنسيقات خاصة

// --- الدوال المساعدة ---
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(num);
};
const TND_TO_USD_RATE = 3.0;
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

// [معدلة] دالة حساب الرسوم بالعملة المدخلة
const calculateWithdrawalFeeLocal = (method, amount, currency) => {
  if (!method || isNaN(amount) || amount <= 0)
    return { error: "Invalid input." };
  const rate = TND_TO_USD_RATE;
  const percent = method.commissionPercent ?? 0;
  let fixedFee = 0;
  let minFee = 0;
  let minWithdrawal = 0;
  if (currency === "USD") {
    fixedFee = method.commissionFixedUSD ?? 0;
    minFee = method.minFeeUSD ?? 0;
    minWithdrawal = method.minWithdrawalUSD ?? 0;
    if (method.commissionFixedTND && method.commissionFixedTND > 0) {
      fixedFee += method.commissionFixedTND / rate;
    }
  } else {
    fixedFee = method.commissionFixedTND ?? 0;
    minFee = method.minFeeTND ?? 0;
    minWithdrawal = method.minWithdrawalTND ?? 0;
    if (method.commissionFixedUSD && method.commissionFixedUSD > 0) {
      fixedFee += method.commissionFixedUSD * rate;
    }
  }
  if (amount < minWithdrawal) {
    return {
      error: `Minimum withdrawal is ${formatCurrency(
        minWithdrawal,
        currency
      )}.`,
    };
  }
  let fee = (amount * percent) / 100 + fixedFee;
  fee = Math.max(fee, minFee);
  fee = Math.max(0, fee);
  const totalAmountToDeduct = amount + fee;
  const netAmountToReceive = amount;
  fee = Math.round(fee * 100) / 100;
  const totalDeductRounded = Math.round(totalAmountToDeduct * 100) / 100;
  return {
    fee: fee,
    netAmountToReceive: netAmountToReceive,
    totalAmountToDeduct: totalDeductRounded,
    error: null,
  };
};
// -------------------------------------------------------------

const PRESET_AMOUNTS_TND = [10, 20, 50, 100];
const PRESET_AMOUNTS_USD = [5, 10, 20, 50];

// --- المكون الرئيسي ---
const WithdrawModal = ({ show, onHide }) => {
  const dispatch = useDispatch();

  // --- Redux State ---
  const userBalance = useSelector(
    (state) => state.userReducer?.user?.balance ?? 0
  ); // الرصيد الأساسي بالدينار
  const withdrawalMethods = useSelector((state) =>
    (state.paymentMethodReducer?.activeMethods || []).filter(
      (m) => m.type === "withdrawal" || m.type === "both"
    )
  );
  const loadingMethods = useSelector(
    (state) => state.paymentMethodReducer?.loadingActive ?? false
  );
  const errorMethods = useSelector(
    (state) => state.paymentMethodReducer?.error ?? null
  );
  const { loadingCreate, errorCreate, successCreate } = useSelector(
    (state) => state.withdrawalRequestReducer
  );

  // --- Local State ---
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [inputCurrency, setInputCurrency] = useState("TND");
  const [amountError, setAmountError] = useState(null);
  const [feeInfo, setFeeInfo] = useState({
    fee: 0,
    netAmountToReceive: 0,
    totalAmountToDeduct: 0,
  }); // القيم المحسوبة بعملة الإدخال
  const [withdrawalInfo, setWithdrawalInfo] = useState("");
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);

  // --- useEffects ---
  useEffect(() => {
    if (show) {
      dispatch(getActivePaymentMethods("withdrawal"));
      dispatch(resetCreateWithdrawal());
      setStep(1);
      setSelectedMethod(null);
      setWithdrawalAmount("");
      setInputCurrency("TND");
      setAmountError(null);
      setFeeInfo({ fee: 0, netAmountToReceive: 0, totalAmountToDeduct: 0 });
      setWithdrawalInfo("");
      setIsSubmittingLocally(false);
    } else {
      setIsSubmittingLocally(false);
    }
  }, [show, dispatch]);
  useEffect(() => {
    if (successCreate) {
      dispatch(resetCreateWithdrawal());
      onHide();
    }
  }, [successCreate, dispatch, onHide]);
  useEffect(() => {
    let nextCurrency = "TND";
    if (selectedMethod) {
      const minUSD = selectedMethod.minWithdrawalUSD;
      const minTND = selectedMethod.minWithdrawalTND;
      if (minUSD != null && minUSD > 0 && (minTND == null || minTND <= 0)) {
        nextCurrency = "USD";
      }
    }
    if (nextCurrency !== inputCurrency) {
      setInputCurrency(nextCurrency);
      setWithdrawalAmount("");
      setAmountError(null);
      setFeeInfo({ fee: 0, netAmountToReceive: 0, totalAmountToDeduct: 0 });
    }
  }, [selectedMethod, inputCurrency]);
  useEffect(() => {
    setAmountError(null);
    setFeeInfo({ fee: 0, netAmountToReceive: 0, totalAmountToDeduct: 0 });
    if (selectedMethod && withdrawalAmount) {
      const amountNum = parseFloat(withdrawalAmount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const calc = calculateWithdrawalFeeLocal(
          selectedMethod,
          amountNum,
          inputCurrency
        );
        if (calc.error) {
          setAmountError(calc.error);
        } else {
          const availableBalanceInInputCurrency =
            inputCurrency === "USD"
              ? userBalance / TND_TO_USD_RATE
              : userBalance;
          if (calc.totalAmountToDeduct > availableBalanceInInputCurrency) {
            setAmountError(
              `Insufficient balance. Required: ${formatCurrency(
                calc.totalAmountToDeduct,
                inputCurrency
              )}`
            );
          } else {
            setAmountError(null);
          }
          setFeeInfo({
            fee: calc.fee,
            netAmountToReceive: calc.netAmountToReceive,
            totalAmountToDeduct: calc.totalAmountToDeduct,
          });
        }
      }
    }
  }, [withdrawalAmount, selectedMethod, userBalance, inputCurrency]);

  // --- Handlers ---
  const handleSelectMethod = (method) => setSelectedMethod(method);
  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setWithdrawalAmount(value);
    }
  };
  const goToStep = (nextStep) => {
    if (nextStep === 2 && !selectedMethod) {
      toast.warn("Select a withdrawal method first.");
      return;
    }
    if (nextStep === 3) {
      const amountNum = parseFloat(withdrawalAmount);
      let amountInTND = amountNum;
      if (inputCurrency === "USD") {
        amountInTND = amountNum * TND_TO_USD_RATE;
        amountInTND = Math.round(amountInTND * 100) / 100;
      }
      if (
        !withdrawalAmount ||
        isNaN(amountNum) ||
        amountNum <= 0 ||
        !!amountError ||
        amountInTND > userBalance
      ) {
        setAmountError(amountError || "Enter a valid amount or check balance.");
        toast.warn(amountError || "Enter a valid amount or check balance.");
        return;
      }
      const calc = calculateWithdrawalFeeLocal(
        selectedMethod,
        amountInTND,
        "TND"
      );
      if (calc.error) {
        setAmountError(calc.error);
        toast.warn(calc.error);
        return;
      }
    }
    setStep(nextStep);
  };
  const handleSubmitWithdrawal = async (e) => {
    if (e) e.preventDefault();
    if (isSubmittingLocally || loadingCreate) return;
    const amountNum = parseFloat(withdrawalAmount);
    let amountInTND = amountNum;
    if (inputCurrency === "USD") {
      amountInTND = amountNum * TND_TO_USD_RATE;
      amountInTND = Math.round(amountInTND * 100) / 100;
    }
    const calcFeeCheck = calculateWithdrawalFeeLocal(
      selectedMethod,
      amountInTND
    ); // إعادة حساب الرسوم بالدينار للتأكد
    if (
      !selectedMethod ||
      !withdrawalAmount ||
      isNaN(amountNum) ||
      amountNum <= 0 ||
      !!amountError ||
      amountInTND > userBalance ||
      calcFeeCheck.error
    ) {
      toast.error("Please correct errors or check balance before submitting.");
      return;
    }
    if (!withdrawalInfo.trim()) {
      toast.warn(
        `Please enter your ${
          selectedMethod.requiredWithdrawalInfo || "withdrawal details"
        }.`
      );
      return;
    }
    setIsSubmittingLocally(true);
    const totalAmountToDeductInTND = calcFeeCheck.totalAmountToDeduct; // المبلغ الإجمالي بالدينار الذي سيخصم
    const withdrawalData = {
      amount: totalAmountToDeductInTND,
      currency: "TND",
      methodId: selectedMethod._id,
      withdrawalInfo: withdrawalInfo.trim(),
    };
    const success = await dispatch(createWithdrawalRequest(withdrawalData));
    if (!success) {
      setIsSubmittingLocally(false);
    }
  };

  // دالة عرض تفاصيل الرسوم والحدود للطريقة
  const renderWithdrawalMethodDetails = (method) => {
    if (!method) return null;
    let feeStrings = [];
    const commissionPercent = method.commissionPercent ?? 0;
    const commissionFixedTND = method.commissionFixedTND ?? 0;
    const commissionFixedUSD = method.commissionFixedUSD ?? 0;
    if (commissionPercent > 0) feeStrings.push(`${commissionPercent}%`);
    if (commissionFixedTND > 0)
      feeStrings.push(`${formatCurrency(commissionFixedTND, "TND")}`);
    if (commissionFixedUSD > 0)
      feeStrings.push(`${formatCurrency(commissionFixedUSD, "USD")}`);
    const feeText =
      feeStrings.length > 0 ? (
        `Fee: ${feeStrings.join(" + ")}`
      ) : (
        <span className="text-success">No Fee</span>
      );
    let limitStrings = [];
    const minWithdrawalTND = method.minWithdrawalTND;
    const minWithdrawalUSD = method.minWithdrawalUSD;
    if (minWithdrawalTND != null && minWithdrawalTND > 0) {
      limitStrings.push(`Min: ${formatCurrency(minWithdrawalTND, "TND")}`);
    }
    if (minWithdrawalUSD != null && minWithdrawalUSD > 0) {
      limitStrings.push(`Min: ${formatCurrency(minWithdrawalUSD, "USD")}`);
    }
    const limitString =
      limitStrings.length > 0 ? limitStrings.join(" / ") : "Min: N/A";
    return (
      <div className="method-details-badges mt-1">
        {" "}
        <Badge pill bg="light" text="dark" className="detail-badge">
          {feeText}
        </Badge>{" "}
        <Badge pill bg="light" text="dark" className="detail-badge ms-1">
          {limitString}
        </Badge>{" "}
      </div>
    );
  };

  // --- العرض JSX ---
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      backdrop="static"
      centered
      className="withdraw-modal"
    >
      <Modal.Header closeButton>
        {" "}
        <Modal.Title>Request Withdrawal</Modal.Title>{" "}
      </Modal.Header>
      <Modal.Body className="p-4">
        <div className="mb-4 text-center step-indicator">
          {" "}
          <span className={`step ${step >= 1 ? "active" : ""}`}>
            <span className="step-number">1</span> Method
          </span>{" "}
          <span className="connector"></span>{" "}
          <span className={`step ${step >= 2 ? "active" : ""}`}>
            <span className="step-number">2</span> Amount & Details
          </span>{" "}
          <span className="connector"></span>{" "}
          <span className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span> Confirm
          </span>{" "}
        </div>
        {errorCreate && (
          <Alert variant="danger" className="mt-2 mb-3">
            {errorCreate}
          </Alert>
        )}

        {/* --- Step 1: Select Method --- */}
        {step === 1 && (
          <div className="step-content">
            <p className="mb-3 text-center text-muted small">
              Select your preferred withdrawal method.
            </p>
            {loadingMethods && (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            )}
            {errorMethods && (
              <Alert variant="warning" className="text-center">
                Could not load withdrawal methods: {errorMethods}
              </Alert>
            )}
            {!loadingMethods && !errorMethods && (
              <Row xs={1} sm={2} md={3} className="g-3 method-selection">
                {withdrawalMethods.length > 0 ? (
                  withdrawalMethods.map((method) => (
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
                            {renderWithdrawalMethodDetails(method)}
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
                      No withdrawal methods available.
                    </Alert>
                  </Col>
                )}
              </Row>
            )}
            <div className="d-grid mt-4">
              {" "}
              <Button
                variant="primary"
                onClick={() => goToStep(2)}
                disabled={!selectedMethod}
              >
                {" "}
                Next Step <FaArrowRight className="ms-1" />{" "}
              </Button>{" "}
            </div>
          </div>
        )}

        {/* --- Step 2: Enter Amount & Details --- */}
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
            <h4 className="mb-1 text-center fw-light">
              Withdrawal Amount & Details
            </h4>
            <p className="text-center text-muted mb-4 small">
              Using{" "}
              <span className="fw-medium">{selectedMethod.displayName}</span>
            </p>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                goToStep(3);
              }}
            >
              <Form.Group className="mb-3">
                <Form.Label>Available Balance</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={formatCurrency(
                      inputCurrency === "USD"
                        ? userBalance / TND_TO_USD_RATE
                        : userBalance,
                      inputCurrency
                    )}
                    readOnly
                    disabled
                  />
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
                <small className="text-muted d-block text-end">
                  {" "}
                  ≈{" "}
                  {formatCurrency(
                    inputCurrency === "USD"
                      ? userBalance
                      : userBalance / TND_TO_USD_RATE,
                    inputCurrency === "USD" ? "TND" : "USD"
                  )}{" "}
                </small>
              </Form.Group>
              <FloatingLabel
                controlId="withdrawalAmountInput"
                className="mb-3"
              >
                <InputGroup>
                  <Form.Control
                    type="number"
                    placeholder="0.00"
                    value={withdrawalAmount}
                    onChange={handleAmountChange}
                    required
                    min={
                      inputCurrency === "USD"
                        ? selectedMethod.minWithdrawalUSD ?? 0.01
                        : selectedMethod.minWithdrawalTND ?? 0.01
                    }
                    step="0.01"
                    isInvalid={!!amountError}
                    autoFocus
                  />
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
                {amountError && (
                  <small className="text-danger mt-1 d-block">
                    {amountError}
                  </small>
                )}
                {inputCurrency === "USD" &&
                  withdrawalAmount &&
                  !amountError &&
                  parseFloat(withdrawalAmount) > 0 && (
                    <small className="text-muted mt-1 d-block text-end">
                      {" "}
                      (Equivalent to approx.{" "}
                      {formatCurrency(
                        parseFloat(withdrawalAmount) * TND_TO_USD_RATE,
                        "TND"
                      )}
                      ){" "}
                    </small>
                  )}
              </FloatingLabel>
              {withdrawalAmount &&
                !amountError &&
                parseFloat(withdrawalAmount) > 0 &&
                feeInfo.totalAmountToDeduct > 0 && (
                  <Card
                    body
                    className="commission-details-v2 text-muted small mb-3 bg-light border-0"
                  >
                    <Row>
                      <Col>Withdrawal Amount:</Col>
                      <Col xs="auto" className="text-end">
                        {formatCurrency(
                          parseFloat(withdrawalAmount),
                          inputCurrency
                        )}
                      </Col>
                    </Row>
                    <Row>
                      <Col>Estimated Fee:</Col>
                      <Col xs="auto" className="text-end text-danger">
                        {formatCurrency(feeInfo.fee, inputCurrency)}
                      </Col>
                    </Row>
                    <Row className="mt-1 border-top pt-1 fw-bold">
                      <Col>Total To Deduct:</Col>
                      <Col xs="auto" className="text-end">
                        {formatCurrency(
                          feeInfo.totalAmountToDeduct,
                          inputCurrency
                        )}
                      </Col>
                    </Row>
                    <Row className="mt-1">
                      <Col>You Will Receive (Approx.):</Col>
                      <Col xs="auto" className="text-end text-success">
                        {formatCurrency(
                          feeInfo.netAmountToReceive,
                          inputCurrency
                        )}
                      </Col>
                    </Row>
                  </Card>
                )}
              <FloatingLabel
                controlId="withdrawalInfoInput"
                label={
                  selectedMethod.requiredWithdrawalInfo ||
                  "Your Withdrawal Details"
                }
                className="mb-3"
              >
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder={`Enter ${
                    selectedMethod.requiredWithdrawalInfo || "details"
                  }...`}
                  value={withdrawalInfo}
                  onChange={(e) => setWithdrawalInfo(e.target.value)}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  Withdrawal details are required.
                </Form.Control.Feedback>
              </FloatingLabel>
              <div className="d-grid mt-4">
                {" "}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={
                    !withdrawalAmount ||
                    !!amountError ||
                    parseFloat(withdrawalAmount) <= 0 ||
                    !withdrawalInfo.trim() ||
                    feeInfo.totalAmountToDeduct >
                      (inputCurrency === "USD"
                        ? userBalance / TND_TO_USD_RATE
                        : userBalance)
                  }
                >
                  {" "}
                  Next Step <FaArrowRight className="ms-1" />{" "}
                </Button>{" "}
              </div>
            </Form>
          </div>
        )}

        {/* --- Step 3: Confirm --- */}
        {step === 3 && selectedMethod && (
          <div className="step-content">
            <Button
              variant="link"
              size="sm"
              onClick={() => goToStep(2)}
              className="mb-2 p-0 btn-back-v2"
            >
              <FaArrowLeft className="me-1" /> Change Details
            </Button>
            <h4 className="mb-3 text-center fw-light">Confirm Withdrawal</h4>
            <Alert variant="light" className="p-3 mb-3 shadow-sm alert-summary">
              <Row>
                <Col>Method:</Col>
                <Col xs="auto" className="fw-bold">
                  {selectedMethod.displayName}
                </Col>
              </Row>
              <Row>
                <Col>Withdrawal Amount:</Col>
                <Col xs="auto" className="fw-bold">
                  {formatCurrency(withdrawalAmount, inputCurrency)}
                </Col>
              </Row>
              <Row>
                <Col>Estimated Fee:</Col>
                <Col xs="auto" className="fw-bold text-danger">
                  - {formatCurrency(feeInfo.fee, inputCurrency)}
                </Col>
              </Row>
              <hr className="my-2" />
              <Row className="fs-6">
                <Col>Total To Deduct:</Col>
                <Col xs="auto" className="fw-bold">
                  {formatCurrency(feeInfo.totalAmountToDeduct, inputCurrency)}
                </Col>
              </Row>
              <Row className="fs-6">
                <Col>Equivalent TND Deducted:</Col>
                <Col xs="auto" className="fw-bold text-muted">
                  ≈{" "}
                  {formatCurrency(
                    inputCurrency === "USD"
                      ? feeInfo.totalAmountToDeduct * TND_TO_USD_RATE
                      : feeInfo.totalAmountToDeduct,
                    "TND"
                  )}
                </Col>
              </Row>
              <hr className="my-2" />
              <Row>
                <Col>
                  {selectedMethod.requiredWithdrawalInfo || "Details Provided"}:
                </Col>
                <Col xs="auto" className="fw-bold text-break">
                  {withdrawalInfo}
                </Col>
              </Row>
            </Alert>
            <Alert
              variant="warning"
              className="d-flex align-items-center small"
            >
              {" "}
              <FaExclamationTriangle className="me-2" /> Please double-check
              details. Balance will be deducted in TND.{" "}
            </Alert>
            <div className="d-grid mt-4">
              {" "}
              <Button
                variant="success"
                onClick={handleSubmitWithdrawal}
                disabled={loadingCreate || isSubmittingLocally}
              >
                {" "}
                {loadingCreate || isSubmittingLocally ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" />{" "}
                    Submitting...
                  </>
                ) : (
                  "Confirm & Submit Request"
                )}{" "}
              </Button>{" "}
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default WithdrawModal;