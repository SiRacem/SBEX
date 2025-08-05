// src/components/commun/WithdrawalModal.jsx

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
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
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
} from "../../redux/actions/withdrawalRequestAction";

const TND_TO_USD_RATE = 3.0;
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const formatCurrency = (amount, currencyCode = "TND", locale = "en-US") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  try {
    return num.toLocaleString(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${currencyCode}`;
  }
};

const calculateWithdrawalFeeFromTotalLocal = (
  method,
  totalAmountToDeduct,
  currency,
  t
) => {
  if (!method || isNaN(totalAmountToDeduct) || totalAmountToDeduct <= 0)
    return {
      fee: 0,
      netAmountToReceive: 0,
      error: t("walletPage.withdrawalModal.errors.invalidAmount"),
    };
  const minWithdrawal =
    currency === "USD"
      ? method.minWithdrawalUSD ?? 0
      : method.minWithdrawalTND ?? 0;
  if (totalAmountToDeduct < minWithdrawal)
    return {
      fee: 0,
      netAmountToReceive: 0,
      error: t("walletPage.withdrawalModal.errors.minAmount", {
        amount: formatCurrency(minWithdrawal, currency),
      }),
    };
  const withdrawalPercent = method.withdrawalCommissionPercent ?? 0;
  let fee = (totalAmountToDeduct * withdrawalPercent) / 100;
  fee = Math.max(0, fee);
  const netAmountToReceive = totalAmountToDeduct - fee;
  if (netAmountToReceive < 0)
    return {
      fee: Number(fee.toFixed(2)),
      netAmountToReceive: Number(netAmountToReceive.toFixed(2)),
      error: t("walletPage.withdrawalModal.errors.feeExceedsAmount", {
        fee: formatCurrency(fee, currency),
      }),
    };
  return {
    fee: Number(fee.toFixed(2)),
    netAmountToReceive: Number(netAmountToReceive.toFixed(2)),
    error: null,
  };
};

const WithdrawModal = ({ show, onHide }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const userBalanceTND = useSelector(
    (state) => state.userReducer?.user?.balance ?? 0
  );
  const userBalanceUSD = useMemo(
    () => userBalanceTND / TND_TO_USD_RATE,
    [userBalanceTND]
  );
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
    (state) => state.withdrawalRequestReducer || {}
  );

  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [inputCurrency, setInputCurrency] = useState("TND");
  const [amountError, setAmountError] = useState(null);
  const [feeInfo, setFeeInfo] = useState({ fee: 0, netAmountToReceive: 0 });
  const [withdrawalInfo, setWithdrawalInfo] = useState("");
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);

  useEffect(() => {
    if (show) {
      dispatch(getActivePaymentMethods("withdrawal"));
      dispatch(resetCreateWithdrawal());
      setStep(1);
      setSelectedMethod(null);
      setWithdrawalAmount("");
      setInputCurrency("TND");
      setAmountError(null);
      setFeeInfo({ fee: 0, netAmountToReceive: 0 });
      setWithdrawalInfo("");
      setIsSubmittingLocally(false);
    }
  }, [show, dispatch]);

  useEffect(() => {
    if (successCreate) onHide();
  }, [successCreate, onHide]);

  useEffect(() => {
    if (selectedMethod) {
      const minUSD = selectedMethod.minWithdrawalUSD;
      const minTND = selectedMethod.minWithdrawalTND;
      const nextCurrency =
        minUSD != null && minUSD > 0 && (minTND == null || minTND <= 0)
          ? "USD"
          : "TND";
      if (nextCurrency !== inputCurrency) {
        setInputCurrency(nextCurrency);
        setWithdrawalAmount("");
        setAmountError(null);
        setFeeInfo({ fee: 0, netAmountToReceive: 0 });
      }
    }
  }, [selectedMethod, inputCurrency]);

  useEffect(() => {
    setAmountError(null);
    setFeeInfo({ fee: 0, netAmountToReceive: 0 });
    if (selectedMethod && withdrawalAmount) {
      const totalAmountNum = parseFloat(withdrawalAmount);
      if (!isNaN(totalAmountNum) && totalAmountNum > 0) {
        const calc = calculateWithdrawalFeeFromTotalLocal(
          selectedMethod,
          totalAmountNum,
          inputCurrency,
          t
        );
        if (calc.error) {
          setAmountError(calc.error);
        } else {
          const totalDeductInTND =
            inputCurrency === "USD"
              ? totalAmountNum * TND_TO_USD_RATE
              : totalAmountNum;
          if (
            Math.round(totalDeductInTND * 100) >
            Math.round(userBalanceTND * 100)
          ) {
            setAmountError(
              t("walletPage.withdrawalModal.errors.insufficientBalance", {
                amount: formatCurrency(totalDeductInTND, "TND"),
              })
            );
          } else {
            setAmountError(null);
          }
          setFeeInfo({
            fee: calc.fee,
            netAmountToReceive: calc.netAmountToReceive,
          });
        }
      }
    }
  }, [withdrawalAmount, selectedMethod, userBalanceTND, inputCurrency, t]);

  const handleSelectMethod = (method) => setSelectedMethod(method);
  const handleAmountChange = (e) => {
    if (/^\d*\.?\d{0,2}$/.test(e.target.value) || e.target.value === "")
      setWithdrawalAmount(e.target.value);
  };
  const handleSetMaxWithdrawalAmount = useCallback(() => {
    const maxAmount = inputCurrency === "USD" ? userBalanceUSD : userBalanceTND;
    setWithdrawalAmount((Math.floor(maxAmount * 100) / 100).toFixed(2));
    setAmountError(null);
  }, [inputCurrency, userBalanceTND, userBalanceUSD]);

  const goToStep = (nextStep) => {
    if (nextStep === 2 && !selectedMethod) {
      toast.warn(t("walletPage.withdrawalModal.errors.selectMethod"));
      return;
    }
    if (nextStep === 3) {
      const totalAmountNum = parseFloat(withdrawalAmount);
      const calc = calculateWithdrawalFeeFromTotalLocal(
        selectedMethod,
        totalAmountNum,
        inputCurrency,
        t
      );
      if (
        !withdrawalAmount ||
        isNaN(totalAmountNum) ||
        totalAmountNum <= 0 ||
        calc.error
      ) {
        setAmountError(
          calc.error || t("walletPage.withdrawalModal.errors.validAmount")
        );
        toast.warn(
          calc.error || t("walletPage.withdrawalModal.errors.validAmount")
        );
        return;
      }
      if (!withdrawalInfo.trim()) {
        toast.warn(
          t("walletPage.withdrawalModal.errors.detailsRequired", {
            details:
              selectedMethod.requiredWithdrawalInfo ||
              t("walletPage.withdrawalModal.defaultDetails"),
          })
        );
        setStep(2);
        return;
      }
      setAmountError(null);
    }
    setStep(nextStep);
  };

  const handleSubmitWithdrawal = useCallback(
    async (e) => {
      e.preventDefault();
      if (isSubmittingLocally || loadingCreate) return;
      const originalAmountNum = parseFloat(withdrawalAmount);
      const calc = calculateWithdrawalFeeFromTotalLocal(
        selectedMethod,
        originalAmountNum,
        inputCurrency,
        t
      );
      if (
        !selectedMethod ||
        !withdrawalAmount ||
        isNaN(originalAmountNum) ||
        originalAmountNum <= 0 ||
        calc.error ||
        !withdrawalInfo.trim()
      ) {
        toast.error(t("walletPage.withdrawalModal.errors.correctErrors"));
        return;
      }

      setIsSubmittingLocally(true);
      const totalAmountToDeductInTND =
        inputCurrency === "USD"
          ? originalAmountNum * TND_TO_USD_RATE
          : originalAmountNum;
      const withdrawalData = {
        amount: Math.round(totalAmountToDeductInTND * 100) / 100,
        methodId: selectedMethod._id,
        withdrawalInfo: withdrawalInfo.trim(),
        originalAmount: originalAmountNum,
        originalCurrency: inputCurrency,
      };
      dispatch(createWithdrawalRequest(withdrawalData)).finally(() =>
        setIsSubmittingLocally(false)
      );
    },
    [
      dispatch,
      isSubmittingLocally,
      loadingCreate,
      withdrawalAmount,
      selectedMethod,
      inputCurrency,
      t,
      withdrawalInfo,
      userBalanceTND,
    ]
  );

  const renderMethodDetails = (method) => {
    if (!method) return null;
    const feePercent = method.withdrawalCommissionPercent ?? 0;
    const feeText =
      feePercent > 0 ? (
        `${t("walletPage.depositModal.feeLabel")}: ${feePercent}%`
      ) : (
        <span className="text-success">
          {t("walletPage.depositModal.noFeeLabel")}
        </span>
      );
    let limitStrings = [];
    if (method.minWithdrawalTND > 0)
      limitStrings.push(
        `${t("walletPage.depositModal.minLabel")}: ${formatCurrency(
          method.minWithdrawalTND,
          "TND",
          i18n.language
        )}`
      );
    if (method.minWithdrawalUSD > 0)
      limitStrings.push(
        `${t("walletPage.depositModal.minLabel")}: ${formatCurrency(
          method.minWithdrawalUSD,
          "USD",
          i18n.language
        )}`
      );
    return (
      <>
        <Badge pill bg="light" text="dark" className="detail-badge">
          {feeText}
        </Badge>
        {limitStrings.length > 0 && (
          <Badge pill bg="light" text="dark" className="detail-badge ms-1">
            {limitStrings.join(" / ")}
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
      className="withdraw-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {t("walletPage.withdrawalModal.title")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <div className="mb-4 text-center step-indicator">
          <span className={`step ${step >= 1 ? "active" : ""}`}>
            <span className="step-number">1</span>{" "}
            {t("walletPage.withdrawalModal.step1")}
          </span>{" "}
          <span className="connector"></span>
          <span className={`step ${step >= 2 ? "active" : ""}`}>
            <span className="step-number">2</span>{" "}
            {t("walletPage.withdrawalModal.step2")}
          </span>{" "}
          <span className="connector"></span>
          <span className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span>{" "}
            {t("walletPage.withdrawalModal.step3")}
          </span>
        </div>
        {errorCreate && (
          <Alert variant="danger">
            {t(errorCreate.key, {
              ...errorCreate.params,
              defaultValue: errorCreate.fallback,
            })}
          </Alert>
        )}

        {step === 1 && (
          <div className="step-content">
            <p className="mb-3 text-center text-muted small">
              {t("walletPage.withdrawalModal.selectMethod")}
            </p>
            {loadingMethods && (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            )}
            {errorMethods && (
              <Alert variant="warning" className="text-center">
                {t("walletPage.withdrawalModal.loadMethodsError")}:{" "}
                {errorMethods}
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
                          <Image
                            src={method.logoUrl}
                            className="method-logo-v2 mb-2"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "data:image/svg+xml,...";
                            }}
                          />
                          <Card.Title className="method-name-v2 mt-auto mb-1">
                            {method.displayName || method.name}
                          </Card.Title>
                          {renderMethodDetails(method)}
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
                      {t("walletPage.withdrawalModal.noMethods")}
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
              {t("walletPage.withdrawalModal.changeMethod")}
            </Button>
            <h4 className="mb-1 text-center fw-light">
              {t("walletPage.withdrawalModal.enterAmount")}
            </h4>
            <p className="text-center text-muted mb-4 small">
              {t("walletPage.withdrawalModal.using", {
                methodName: selectedMethod.displayName,
              })}
            </p>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                goToStep(3);
              }}
            >
              <Form.Group className="mb-3">
                <Form.Label>
                  {t("walletPage.withdrawalModal.availableBalance")}
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    value={formatCurrency(
                      inputCurrency === "USD" ? userBalanceUSD : userBalanceTND,
                      inputCurrency,
                      i18n.language
                    )}
                    readOnly
                    disabled
                  />
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
              </Form.Group>
              <FloatingLabel
                controlId="withdrawalAmountInput"
                label={t("walletPage.withdrawalModal.amountToWithdrawLabel")}
                className="mb-3"
              >
                <InputGroup>
                  <Form.Control
                    type="number"
                    placeholder="0.00"
                    value={withdrawalAmount}
                    onChange={handleAmountChange}
                    required
                    min="0.01"
                    step="0.01"
                    isInvalid={!!amountError}
                    autoFocus
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={handleSetMaxWithdrawalAmount}
                  >
                    {t("walletPage.sendModal.maxButton")}
                  </Button>
                  <InputGroup.Text>{inputCurrency}</InputGroup.Text>
                </InputGroup>
                {amountError && (
                  <small className="text-danger mt-1 d-block">
                    {amountError}
                  </small>
                )}
              </FloatingLabel>
              {withdrawalAmount &&
                !amountError &&
                parseFloat(withdrawalAmount) > 0 && (
                  <Card
                    body
                    className="commission-details-v2 text-muted small mb-3 bg-light border-0"
                  >
                    <Row>
                      <Col>
                        {t("walletPage.withdrawalModal.amountToWithdrawLabel")}:
                      </Col>
                      <Col xs="auto" className="text-end fw-medium">
                        {formatCurrency(
                          parseFloat(withdrawalAmount),
                          inputCurrency,
                          i18n.language
                        )}
                      </Col>
                    </Row>
                    {feeInfo.fee > 0 && (
                      <Row>
                        <Col>
                          {t("walletPage.withdrawalModal.summary.fee", {
                            percent: selectedMethod.withdrawalCommissionPercent,
                          })}
                          :
                        </Col>
                        <Col
                          xs="auto"
                          className="text-end text-danger fw-medium"
                        >
                          -{" "}
                          {formatCurrency(
                            feeInfo.fee,
                            inputCurrency,
                            i18n.language
                          )}
                        </Col>
                      </Row>
                    )}
                    <Row
                      className={`mt-1 ${
                        feeInfo.fee > 0 ? "border-top pt-1" : ""
                      }`}
                    >
                      <Col>
                        {t("walletPage.withdrawalModal.netAmountToReceive")}:
                      </Col>
                      <Col xs="auto" className="text-end text-success fw-bold">
                        {formatCurrency(
                          feeInfo.netAmountToReceive,
                          inputCurrency,
                          i18n.language
                        )}
                      </Col>
                    </Row>
                  </Card>
                )}
              <FloatingLabel
                controlId="withdrawalInfoInput-control"
                label={
                  selectedMethod.requiredWithdrawalInfo ||
                  t("walletPage.withdrawalModal.withdrawalDetailsLabel")
                }
                className="mb-3"
              >
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder={t(
                    "walletPage.withdrawalModal.withdrawalDetailsPlaceholder",
                    { details: selectedMethod.requiredWithdrawalInfo }
                  )}
                  value={withdrawalInfo}
                  onChange={(e) => setWithdrawalInfo(e.target.value)}
                  required
                />
              </FloatingLabel>
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
              {t("walletPage.withdrawalModal.changeMethod")}
            </Button>
            <h4 className="mb-3 text-center fw-light">
              {t("walletPage.withdrawalModal.confirmTitle")}
            </h4>
            <Alert variant="light" className="p-3 mb-3 shadow-sm alert-summary">
              <Row>
                <Col>{t("walletPage.withdrawalModal.summary.method")}:</Col>
                <Col xs="auto" className="fw-bold">
                  {selectedMethod.displayName}
                </Col>
              </Row>
              <Row>
                <Col>{t("walletPage.withdrawalModal.summary.total")}:</Col>
                <Col xs="auto" className="fw-bold">
                  {formatCurrency(
                    parseFloat(withdrawalAmount),
                    inputCurrency,
                    i18n.language
                  )}
                </Col>
              </Row>
              {feeInfo.fee > 0 && (
                <Row>
                  <Col>
                    {t("walletPage.withdrawalModal.summary.fee", {
                      percent: selectedMethod.withdrawalCommissionPercent,
                    })}
                    :
                  </Col>
                  <Col xs="auto" className="fw-bold text-danger">
                    -{" "}
                    {formatCurrency(feeInfo.fee, inputCurrency, i18n.language)}
                  </Col>
                </Row>
              )}
              <hr className="my-2" />
              <Row className="fs-6">
                <Col>{t("walletPage.withdrawalModal.summary.net")}:</Col>
                <Col xs="auto" className="fw-bold text-success">
                  {formatCurrency(
                    feeInfo.netAmountToReceive,
                    inputCurrency,
                    i18n.language
                  )}
                </Col>
              </Row>
              <hr className="my-2" />
              <Row>
                <Col>
                  {selectedMethod.requiredWithdrawalInfo ||
                    t("walletPage.withdrawalModal.summary.details")}
                  :
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
              <FaExclamationTriangle className="me-2" />{" "}
              {t("walletPage.withdrawalModal.warning")}
            </Alert>
            <div className="d-grid mt-4">
              <Button
                variant="success"
                onClick={handleSubmitWithdrawal}
                disabled={loadingCreate || isSubmittingLocally}
              >
                {loadingCreate || isSubmittingLocally ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" />{" "}
                    {t("walletPage.depositModal.submitting")}
                  </>
                ) : (
                  t("walletPage.withdrawalModal.submitButton")
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
