import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert,
  InputGroup,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { getProfile } from "../../redux/actions/userAction";
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay";

const MIN_TRANSFER_AMOUNT_TND = 6.0;
const TRANSFER_FEE_PERCENT = 2;

const TransferBalanceModal = ({ show, onHide }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.userReducer.user);

  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // استخدم الـ hook مباشرة هنا لعرض الرصيد المتاح
  const sellerBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance || 0,
    "TND"
  );

  const sellerBalance = user?.sellerAvailableBalance || 0;
  const fee = (parseFloat(amount) * TRANSFER_FEE_PERCENT) / 100;
  const totalDeducted = parseFloat(amount) + fee;
  const netToReceive = parseFloat(amount);

  // دالة تنسيق بسيطة لا تستخدم hooks، يمكن تعريفها في أي مكان
  const formatSimpleCurrency = (value, currency = "TND") => {
    return `${Number(value).toFixed(2)} ${currency}`;
  };

  useEffect(() => {
    if (amount) {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        setValidationError(t("transferBalanceModal.errors.positive"));
      } else if (numericAmount < MIN_TRANSFER_AMOUNT_TND) {
        setValidationError(
          t("transferBalanceModal.errors.minAmount", {
            amount: formatSimpleCurrency(MIN_TRANSFER_AMOUNT_TND),
          })
        );
      } else if (totalDeducted > sellerBalance) {
        setValidationError(t("transferBalanceModal.errors.insufficient"));
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [amount, sellerBalance, totalDeducted, t]);

  const handleTransfer = async () => {
    if (validationError || !amount) return;

    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.post(
        "/wallet/transfer-seller-balance",
        { amount: parseFloat(amount) },
        config
      );

      // استخدم مفتاح الترجمة من الخادم
      const successMsg = response.data.successMessage;
      toast.success(t(successMsg.key, { fallback: response.data.msg }));

      dispatch(getProfile());
      onHide();
    } catch (err) {
      const errorMsg = err.response?.data?.errorMessage;
      const fallbackMsg =
        err.response?.data?.msg || t("transferBalanceModal.errors.unknown");
      const finalErrorMsg = errorMsg
        ? t(errorMsg.key, { fallback: errorMsg.fallback || fallbackMsg })
        : fallbackMsg;
      setError(finalErrorMsg);
      toast.error(finalErrorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setError(null);
    setValidationError(null);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{t("transferBalanceModal.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form.Group className="mb-3">
          <Form.Label>
            {t("transferBalanceModal.available", {
              balance: sellerBalanceDisplay.displayValue,
            })}
          </Form.Label>
          <InputGroup>
            <Form.Control
              type="number"
              placeholder={t("transferBalanceModal.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              isInvalid={!!validationError}
              autoFocus
            />
            <Button
              variant="outline-secondary"
              onClick={() =>
                setAmount(
                  Math.max(
                    0,
                    Math.floor(
                      (sellerBalance / (1 + TRANSFER_FEE_PERCENT / 100)) * 100
                    ) / 100
                  ).toFixed(2)
                )
              }
            >
              {t("walletPage.sendModal.maxButton")}
            </Button>
          </InputGroup>
          {validationError && (
            <Form.Text className="text-danger">{validationError}</Form.Text>
          )}
        </Form.Group>

        {amount > 0 && !validationError && (
          <div className="mt-3 p-3 bg-light rounded border">
            <h6 className="mb-2">{t("transferBalanceModal.summaryTitle")}</h6>
            <div className="d-flex justify-content-between">
              <span>{t("transferBalanceModal.amountToTransfer")}</span>{" "}
              <span>{formatSimpleCurrency(netToReceive)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                {t("transferBalanceModal.fee", {
                  percent: TRANSFER_FEE_PERCENT,
                })}
              </span>{" "}
              <span className="text-muted">-{formatSimpleCurrency(fee)}</span>
            </div>
            <hr />
            <div className="d-flex justify-content-between fw-bold">
              <span>{t("transferBalanceModal.totalDeducted")}</span>{" "}
              <span>{formatSimpleCurrency(totalDeducted)}</span>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={handleTransfer}
          disabled={isLoading || !!validationError || !amount}
        >
          {isLoading ? (
            <Spinner as="span" size="sm" />
          ) : (
            t("transferBalanceModal.confirmButton")
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TransferBalanceModal;