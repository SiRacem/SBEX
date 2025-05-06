// src/components/commun/WithdrawModal.jsx
// *** نسخة كاملة: المستخدم يدخل الإجمالي، ترسل الأصلي، تتوافق مع Backend المحدث ***

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
  ButtonGroup, // ButtonGroup غير مستخدم هنا فعلياً لكن قد تحتاجه لاحقاً
} from "react-bootstrap";
import {
  FaArrowRight,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaRegCreditCard,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { getActivePaymentMethods } from "../../redux/actions/paymentMethodAction";
import {
  createWithdrawalRequest,
  resetCreateWithdrawal,
} from "../../redux/actions/withdrawalRequestAction"; // تأكد من اسم الأكشن تايب الصحيح في الإضافة
// import './WithdrawModal.css'; // تأكد من وجوده إذا احتجت تنسيقات خاصة

// --- الدوال المساعدة ---
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) {
    // console.warn(`formatCurrency received invalid amount: ${amount}`);
    return "N/A";
  }
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    console.warn(
      `formatCurrency received invalid currency code: ${currencyCode}. Falling back to TND.`
    );
    currencyCode = "TND";
  }
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.warn(`Could not format currency for code: ${currencyCode}`, error);
    return `${num.toFixed(2)} ${currencyCode}`;
  }
};
const TND_TO_USD_RATE = 3.0; // يجب أن يكون مطابقاً للـ Backend
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

// --- دالة حساب الرسوم والصافي من الإجمالي (بالعملة المحددة) ---
const calculateWithdrawalFeeFromTotalLocal = (
  method,
  totalAmountToDeduct,
  currency
) => {
  if (!method || isNaN(totalAmountToDeduct) || totalAmountToDeduct <= 0) {
    return { fee: 0, netAmountToReceive: 0, error: "Invalid amount." };
  }

  // الحد الأدنى للسحب (الإجمالي يجب أن يكون أكبر منه)
  const minWithdrawal =
    currency === "USD"
      ? method.minWithdrawalUSD ?? 0
      : method.minWithdrawalTND ?? 0;
  if (totalAmountToDeduct < minWithdrawal) {
    return {
      fee: 0,
      netAmountToReceive: 0,
      error: `Minimum amount to withdraw is ${formatCurrency(
        minWithdrawal,
        currency
      )}.`,
    };
  }

  // نسبة عمولة السحب
  const withdrawalPercent = method.withdrawalCommissionPercent ?? 0;

  // حساب العمولة بناءً على المبلغ الإجمالي
  let fee = (totalAmountToDeduct * withdrawalPercent) / 100;
  fee = Math.max(0, fee); // لا تكون سالبة

  // المبلغ الصافي = الإجمالي - العمولة
  const netAmountToReceive = totalAmountToDeduct - fee;

  if (netAmountToReceive < 0) {
    // نادر لكن للتحقق
    return {
      fee: Number(fee.toFixed(2)),
      netAmountToReceive: Number(netAmountToReceive.toFixed(2)),
      error: `Calculated fee (${formatCurrency(
        fee,
        currency
      )}) matches or exceeds withdrawal amount.`,
    };
  }

  return {
    fee: Number(fee.toFixed(2)),
    netAmountToReceive: Number(netAmountToReceive.toFixed(2)),
    totalAmountToDeduct: Number(totalAmountToDeduct.toFixed(2)), // نفس المدخل بعد التأكد من الحد الأدنى
    error: null,
  };
};
// -------------------------------------------------------------

// مبالغ مقترحة (قد لا تكون مفيدة في هذا المنطق)
// const PRESET_AMOUNTS_TND = [10, 20, 50, 100];
// const PRESET_AMOUNTS_USD = [5, 10, 20, 50];

// --- المكون الرئيسي ---
const WithdrawModal = ({ show, onHide }) => {
  const dispatch = useDispatch();

  // --- Redux State ---
  const userBalanceTND = useSelector((state) => state.userReducer?.user?.balance ?? 0);
  const userBalanceUSD = useMemo(() => userBalanceTND / TND_TO_USD_RATE, [userBalanceTND]);
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
  // تأكد من أن reducer مسجل باسم withdrawalRequestReducer في rootReducer
  const { loadingCreate, errorCreate, successCreate } = useSelector(
    (state) => state.withdrawalRequestReducer || {}
  ); // إضافة || {} كاحتياط

  // --- Local State ---
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  // withdrawalAmount يمثل الآن "المبلغ الإجمالي للخصم" بالعملة المختارة
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [inputCurrency, setInputCurrency] = useState("TND"); // عملة الإدخال
  const [amountError, setAmountError] = useState(null);
  // feeInfo يحتوي على الرسوم والصافي المحسوب بناءً على الإجمالي المدخل
  const [feeInfo, setFeeInfo] = useState({ fee: 0, netAmountToReceive: 0 });
  const [withdrawalInfo, setWithdrawalInfo] = useState(""); // معلومات السحب (رقم، عنوان..)
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);

  // --- useEffects ---
  // إعادة تعيين الحالة عند فتح/إغلاق المودال
  useEffect(() => {
    if (show) {
      dispatch(getActivePaymentMethods("withdrawal"));
      dispatch(resetCreateWithdrawal());
      setStep(1);
      setSelectedMethod(null);
      setWithdrawalAmount("");
      setInputCurrency("TND"); // ابدأ دائمًا بالدينار أو حسب منطقك
      setAmountError(null);
      setFeeInfo({ fee: 0, netAmountToReceive: 0 });
      setWithdrawalInfo("");
      setIsSubmittingLocally(false);
    }
    // لا تحتاج else هنا لأن isSubmittingLocally يتم التحكم به عند الإرسال
  }, [show, dispatch]);

  // إغلاق المودال عند نجاح الإنشاء
  useEffect(() => {
    if (successCreate) {
      // تأكد أن successCreate يتم إعادة تعيينها في resetCreateWithdrawal
      dispatch(resetCreateWithdrawal());
      onHide(); // أغلق المودال
    }
  }, [successCreate, dispatch, onHide]);

  // تحديد العملة الافتراضية عند تغيير الطريقة
  useEffect(() => {
    let nextCurrency = "TND"; // افتراضي
    if (selectedMethod) {
      // منطق لتحديد العملة الأنسب (مثال: إذا كان الحد الأدنى للدولار فقط متاحًا)
      const minUSD = selectedMethod.minWithdrawalUSD;
      const minTND = selectedMethod.minWithdrawalTND;
      if (minUSD != null && minUSD > 0 && (minTND == null || minTND <= 0)) {
        nextCurrency = "USD";
      }
    }
    // تغيير العملة فقط إذا كانت مختلفة لتجنب إعادة تعيين غير ضرورية
    if (nextCurrency !== inputCurrency) {
      setInputCurrency(nextCurrency);
      setWithdrawalAmount(""); // أعد تعيين المبلغ عند تغيير العملة
      setAmountError(null);
      setFeeInfo({ fee: 0, netAmountToReceive: 0 });
    }
  }, [selectedMethod, inputCurrency]); // الاعتماد على inputCurrency يمنع الحلقة اللانهائية

  // إعادة حساب الرسوم والصافي والتحقق من الرصيد عند تغيير المبلغ أو الطريقة أو العملة
  useEffect(() => {
    setAmountError(null); // أعد تعيين الخطأ
    setFeeInfo({ fee: 0, netAmountToReceive: 0 }); // أعد تعيين المعلومات

    if (selectedMethod && withdrawalAmount) {
      const totalAmountNum = parseFloat(withdrawalAmount); // هذا هو الإجمالي بالعملة المدخلة
      if (!isNaN(totalAmountNum) && totalAmountNum > 0) {
        // استخدام دالة الحساب الجديدة (من الإجمالي)
        const calc = calculateWithdrawalFeeFromTotalLocal(
          selectedMethod,
          totalAmountNum,
          inputCurrency
        );

        if (calc.error) {
          setAmountError(calc.error); // عرض خطأ الحد الأدنى أو غيره
        } else {
          // التحقق من الرصيد المتاح بالدينار
          const totalDeductInTND =
            inputCurrency === "USD"
              ? totalAmountNum * TND_TO_USD_RATE
              : totalAmountNum;
          // تقريب بسيط للتحقق لتجنب مشاكل الفاصلة العائمة الدقيقة
          if (
            Math.round(totalDeductInTND * 100) > Math.round(userBalance * 100)
          ) {
            setAmountError(
              `Insufficient balance. You need ≈ ${formatCurrency(
                totalDeductInTND,
                "TND"
              )}.`
            );
          } else {
            setAmountError(null); // مسح الخطأ إذا كان الرصيد كافياً
          }
          // تخزين الرسوم والصافي المحسوب (بنفس عملة الإدخال)
          setFeeInfo({
            fee: calc.fee,
            netAmountToReceive: calc.netAmountToReceive,
            // لا نحتاج totalAmountToDeduct هنا لأنه نفس withdrawalAmount
          });
        }
      }
    }
  }, [withdrawalAmount, selectedMethod, userBalance, inputCurrency]); // أعد الحساب عند تغيير أي من هذه

  // --- Handlers ---
  const handleSelectMethod = (method) => setSelectedMethod(method);

  // معالج تغيير حقل إدخال المبلغ الإجمالي
  const handleAmountChange = (e) => {
    const value = e.target.value;
    // السماح بالأرقام والنقطة العشرية (حتى فاصلتين)
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setWithdrawalAmount(value);
    }
  };

    // --- [!!!] دالة جديدة لزر MAX [!!!] ---
    const handleSetMaxWithdrawalAmount = useCallback(() => {
      let maxAmount = 0;
      // المبلغ الذي سيتم إدخاله هو رصيد المستخدم بالعملة المختارة
      if (inputCurrency === "USD") {
        maxAmount = userBalanceUSD;
      } else { // TND
        maxAmount = userBalanceTND;
      }
      // تقريب لأقرب سنتين لضمان عدم تجاوز الرصيد بسبب مشاكل الفاصلة العائمة
      setWithdrawalAmount( (Math.floor(maxAmount * 100) / 100).toFixed(2) );
      setAmountError(null); // مسح أي خطأ سابق
    }, [inputCurrency, userBalanceTND, userBalanceUSD]);

  // الانتقال للخطوة التالية مع التحقق
  const goToStep = (nextStep) => {
    if (nextStep === 2 && !selectedMethod) {
      toast.warn("Please select a withdrawal method first.");
      return;
    }
    if (nextStep === 3) {
      const totalAmountNum = parseFloat(withdrawalAmount); // الإجمالي المدخل
      if (!withdrawalAmount || isNaN(totalAmountNum) || totalAmountNum <= 0) {
        setAmountError("Please enter a valid amount to withdraw.");
        toast.warn("Please enter a valid amount to withdraw.");
        return;
      }
      // إعادة التحقق قبل الانتقال (هام)
      const calc = calculateWithdrawalFeeFromTotalLocal(
        selectedMethod,
        totalAmountNum,
        inputCurrency
      );
      if (calc.error) {
        // التحقق من الحد الأدنى
        setAmountError(calc.error);
        toast.warn(calc.error);
        return;
      }
      const totalDeductInTND =
        inputCurrency === "USD"
          ? totalAmountNum * TND_TO_USD_RATE
          : totalAmountNum;
      if (Math.round(totalDeductInTND * 100) > Math.round(userBalance * 100)) {
        // التحقق من الرصيد
        setAmountError(
          `Insufficient balance. You need ≈ ${formatCurrency(
            totalDeductInTND,
            "TND"
          )}.`
        );
        toast.warn(`Insufficient balance.`);
        return;
      }
      if (!withdrawalInfo.trim()) {
        // التحقق من إدخال تفاصيل السحب
        toast.warn(
          `Please enter your ${
            selectedMethod.requiredWithdrawalInfo || "withdrawal details"
          }.`
        );
        // لا تنتقل للخطوة التالية، ابق في الخطوة 2
        setStep(2); // تأكد من البقاء في الخطوة 2
        // يمكنك إضافة focus للحقل إذا أردت
        const infoInput = document.getElementById(
          "withdrawalInfoInput-control"
        ); // افترض أن FloatingLabel يضع هذا الـ id
        if (infoInput) infoInput.focus();
        return;
      }
      setAmountError(null); // مسح أي خطأ سابق قبل الانتقال
    }
    setStep(nextStep); // الانتقال للخطوة التالية
  };

  // --- معالج الإرسال النهائي ---
  const handleSubmitWithdrawal = async (e) => {
    if (e) e.preventDefault();
    if (isSubmittingLocally || loadingCreate) return; // منع الإرسال المتعدد

    const originalAmountNum = parseFloat(withdrawalAmount); // الإجمالي بالعملة المدخلة
    const originalCurrency = inputCurrency;

    // --- [!] إعادة التحقق النهائي قبل الإرسال ---
    if (
      !selectedMethod ||
      !withdrawalAmount ||
      isNaN(originalAmountNum) ||
      originalAmountNum <= 0
    ) {
      toast.error("Invalid withdrawal amount or method.");
      return;
    }
    const calc = calculateWithdrawalFeeFromTotalLocal(
      selectedMethod,
      originalAmountNum,
      originalCurrency
    );
    if (calc.error) {
      toast.error(`Calculation Error: ${calc.error}`);
      return;
    }
    const totalAmountToDeductInTND =
      originalCurrency === "USD"
        ? originalAmountNum * TND_TO_USD_RATE
        : originalAmountNum;
    const finalAmountToDeductTND =
      Math.round(totalAmountToDeductInTND * 100) / 100; // تقريب نهائي
    if (finalAmountToDeductTND > userBalance) {
      toast.error("Insufficient balance after final calculation.");
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
    // -------------------------------------------

    setIsSubmittingLocally(true); // بدأ الإرسال

    // --- بناء البيانات للإرسال للـ Backend ---
    const withdrawalData = {
      amount: finalAmountToDeductTND, // الإجمالي للخصم بالدينار (للـ Backend)
      methodId: selectedMethod._id,
      withdrawalInfo: withdrawalInfo.trim(),
      // --- القيم الأصلية المطلوبة ---
      originalAmount: originalAmountNum, // المبلغ الإجمالي الأصلي
      originalCurrency: originalCurrency, // العملة الأصلية
    };
    // --------------------------------------

    console.log(
      "Dispatching createWithdrawalRequest with data:",
      withdrawalData
    );
    try {
      // استدعاء الأكشن لإنشاء الطلب
      await dispatch(createWithdrawalRequest(withdrawalData));
      // لا تفعل شيئًا هنا، useEffect الخاص بـ successCreate سيتولى الإغلاق
      // onHide(); // لا تغلق هنا مباشرة
    } catch (err) {
      // الأكشن يعرض الخطأ غالبًا، لكن يمكن إضافة معالجة هنا إذا لزم الأمر
      console.error("Error dispatching createWithdrawalRequest:", err);
    } finally {
      setIsSubmittingLocally(false); // انتهى الإرسال (سواء نجح أو فشل في الأكشن)
    }
  };

  // --- دالة عرض تفاصيل الطريقة (النسبة والحد الأدنى) ---
  const renderWithdrawalMethodDetails = (method) => {
    if (!method) return null;
    const withdrawalPercent = method.withdrawalCommissionPercent ?? 0;
    let feeStrings = [];
    if (withdrawalPercent > 0) {
      feeStrings.push(`${withdrawalPercent}% Fee`);
    } else {
      feeStrings.push(<span className="text-success">No Fee</span>);
    }
    const feeText = feeStrings[0];

    let limitStrings = [];
    const minWithdrawalTND = method.minWithdrawalTND;
    const minWithdrawalUSD = method.minWithdrawalUSD;
    if (minWithdrawalTND != null && minWithdrawalTND > 0)
      limitStrings.push(`Min: ${formatCurrency(minWithdrawalTND, "TND")}`);
    if (minWithdrawalUSD != null && minWithdrawalUSD > 0)
      limitStrings.push(`Min: ${formatCurrency(minWithdrawalUSD, "USD")}`);
    const limitString =
      limitStrings.length > 0 ? limitStrings.join(" / ") : null;

    return (
      <div className="method-details-badges mt-1">
        <Badge pill bg="light" text="dark" className="detail-badge">
          {feeText}
        </Badge>
        {limitString && (
          <Badge pill bg="light" text="dark" className="detail-badge ms-1">
            {limitString}
          </Badge>
        )}
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
        <Modal.Title>Request Withdrawal</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {/* مؤشر الخطوات */}
        <div className="mb-4 text-center step-indicator">
          <span className={`step ${step >= 1 ? "active" : ""}`}>
            <span className="step-number">1</span> Method
          </span>{" "}
          <span className="connector"></span>
          <span className={`step ${step >= 2 ? "active" : ""}`}>
            <span className="step-number">2</span> Amount & Details
          </span>{" "}
          <span className="connector"></span>
          <span className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span> Confirm
          </span>
        </div>
        {/* عرض خطأ الإنشاء العام */}
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
                          {renderWithdrawalMethodDetails(method)}
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
              {/* عرض الرصيد المتاح */}
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

              {/* حقل إدخال المبلغ (الإجمالي للخصم) */}
              <FloatingLabel
                controlId="withdrawalAmountInput"
                label="Amount To Withdraw (Total to Deduct)"
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
                                    {/* --- [!!!] زر MAX المضاف --- */}
                                    <Button variant="outline-secondary" onClick={handleSetMaxWithdrawalAmount}> MAX </Button>
                  {/* ------------------------- */}
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
                {/* عرض خطأ المبلغ */}
                {amountError && (
                  <small className="text-danger mt-1 d-block">
                    {amountError}
                  </small>
                )}
                {/* عرض القيمة المعادلة للعملة الأخرى */}
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

              {/* عرض تفاصيل الرسوم والصافي المحسوب */}
              {withdrawalAmount &&
                !amountError &&
                parseFloat(withdrawalAmount) > 0 && (
                  <Card
                    body
                    className="commission-details-v2 text-muted small mb-3 bg-light border-0"
                  >
                    <Row>
                      <Col>Amount To Withdraw:</Col>
                      <Col xs="auto" className="text-end fw-medium">
                        {formatCurrency(
                          parseFloat(withdrawalAmount),
                          inputCurrency
                        )}
                      </Col>
                    </Row>
                    {feeInfo.fee > 0 && (
                      <Row>
                        <Col>
                          Est. Fee ({selectedMethod.withdrawalCommissionPercent}
                          %):
                        </Col>
                        <Col
                          xs="auto"
                          className="text-end text-danger fw-medium"
                        >
                          - {formatCurrency(feeInfo.fee, inputCurrency)}
                        </Col>
                      </Row>
                    )}
                    <Row
                      className={`mt-1 ${
                        feeInfo.fee > 0 ? "border-top pt-1" : ""
                      }`}
                    >
                      <Col>Net Amount You Receive:</Col>
                      <Col xs="auto" className="text-end text-success fw-bold">
                        {formatCurrency(
                          feeInfo.netAmountToReceive,
                          inputCurrency
                        )}
                      </Col>
                    </Row>
                  </Card>
                )}

              {/* حقل تفاصيل السحب */}
              <FloatingLabel
                controlId="withdrawalInfoInput-control"
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
                </Form.Control.Feedback>{" "}
                {/* لن تظهر لأننا نستخدم required */}
              </FloatingLabel>

              {/* زر الانتقال للخطوة التالية */}
              <div className="d-grid mt-4">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={
                    !withdrawalAmount ||
                    !!amountError ||
                    parseFloat(withdrawalAmount) <= 0 ||
                    !withdrawalInfo.trim()
                  }
                >
                  Next Step <FaArrowRight className="ms-1" />
                </Button>
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
            {/* ملخص السحب */}
            <Alert variant="light" className="p-3 mb-3 shadow-sm alert-summary">
              <Row>
                <Col>Method:</Col>
                <Col xs="auto" className="fw-bold">
                  {selectedMethod.displayName}
                </Col>
              </Row>
              {/* المبلغ الإجمالي المدخل بعملة الإدخال */}
              <Row>
                <Col>Amount To Withdraw (Total):</Col>
                <Col xs="auto" className="fw-bold">
                  {formatCurrency(parseFloat(withdrawalAmount), inputCurrency)}
                </Col>
              </Row>
              {/* الرسوم المقدرة بعملة الإدخال */}
              {feeInfo.fee > 0 && (
                <Row>
                  <Col>
                    Est. Fee ({selectedMethod.withdrawalCommissionPercent}%):
                  </Col>
                  <Col xs="auto" className="fw-bold text-danger">
                    - {formatCurrency(feeInfo.fee, inputCurrency)}
                  </Col>
                </Row>
              )}
              <hr className="my-2" />
              {/* المبلغ الصافي المستلم بعملة الإدخال */}
              <Row className="fs-6">
                <Col>Net Amount You Receive:</Col>
                <Col xs="auto" className="fw-bold text-success">
                  {formatCurrency(feeInfo.netAmountToReceive, inputCurrency)}
                </Col>
              </Row>
              {/* المبلغ الإجمالي المخصوم بالدينار */}
              
              <hr className="my-2" />
              {/* تفاصيل السحب المدخلة */}
              <Row>
                <Col>
                  {selectedMethod.requiredWithdrawalInfo || "Details Provided"}:
                </Col>
                <Col xs="auto" className="fw-bold text-break">
                  {withdrawalInfo}
                </Col>
              </Row>
            </Alert>
            {/* تنبيه التحقق */}
            <Alert
              variant="warning"
              className="d-flex align-items-center small"
            >
              {" "}
              <FaExclamationTriangle className="me-2" /> Please double-check
              details. Balance will be deducted in TND.{" "}
            </Alert>
            {/* زر التأكيد والإرسال */}
            <div className="d-grid mt-4">
              <Button
                variant="success"
                onClick={handleSubmitWithdrawal}
                disabled={loadingCreate || isSubmittingLocally}
              >
                {loadingCreate || isSubmittingLocally ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" />{" "}
                    Submitting...
                  </>
                ) : (
                  "Confirm & Submit Request"
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default WithdrawModal;
