// src/components/commun/ActivityDetailsModal.jsx
import React from "react";
import { Modal, Button, Badge, Row, Col, Card, Alert } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { enUS, ar, fr } from "date-fns/locale";
import {
  FaDollarSign,
  FaCalendarAlt,
  FaInfoCircle,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaUser,
  FaReceipt,
  FaCreditCard,
  FaArrowAltCircleDown,
  FaArrowAltCircleUp,
  FaPaperPlane,
  FaInbox,
  FaRegFileAlt,
  FaHourglassStart,
} from "react-icons/fa";

const TND_TO_USD_RATE = 3.0; // تأكد من تطابقه مع الخادم
const dateFnsLocales = { en: enUS, ar: ar, fr: fr, tn: ar };

const ActivityDetailsModal = ({ show, onHide, item, currentUserId }) => {
  const { t, i18n } = useTranslation();

  if (!item) return null;

  const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
      safeCurrencyCode = "TND";
    }
    const locale = i18n.language === "tn" ? "ar-TN" : i18n.language;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: safeCurrencyCode,
        minimumFractionDigits: 2,
      }).format(num);
    } catch (error) {
      return `${num.toFixed(2)} ${safeCurrencyCode}`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const formatString =
        i18n.language === "en" ? "Pp" : "dd/MM/yyyy, HH:mm:ss";
      return format(new Date(dateString), formatString, {
        locale: dateFnsLocales[i18n.language] || enUS,
      });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = () => {
    let variant = "secondary",
      Icon = FaInfoCircle;
    const statusLower = item.status?.toLowerCase();
    if (
      item.type === "TRANSFER" &&
      !["rejected", "failed"].includes(statusLower)
    ) {
      variant = "success";
      Icon = FaCheckCircle;
    } else if (statusLower) {
      switch (statusLower) {
        case "pending":
          variant = "warning";
          Icon = FaHourglassStart;
          break;
        case "processing":
          variant = "info";
          Icon = FaSpinner;
          break;
        case "completed":
        case "approved":
          variant = "success";
          Icon = FaCheckCircle;
          break;
        case "rejected":
        case "failed":
          variant = "danger";
          Icon = FaTimesCircle;
          break;
        default:
          variant = "secondary";
          Icon = FaInfoCircle;
      }
    }
    return (
      <Badge
        bg={variant}
        className="d-inline-flex align-items-center p-2 fs-6 shadow-sm"
      >
        <Icon className="me-2" size={18} />{" "}
        {t(`walletPage.statuses.${statusLower}`, { defaultValue: item.status })}
      </Badge>
    );
  };

  const getTypeIcon = () => {
    switch (item.type) {
      case "DEPOSIT_REQUEST":
      case "DEPOSIT_COMPLETED":
        return FaArrowAltCircleDown;
      case "WITHDRAWAL_REQUEST":
      case "WITHDRAWAL_COMPLETED":
        return FaArrowAltCircleUp;
      case "TRANSFER":
        return item.isSender ? FaPaperPlane : FaInbox;
      default:
        return FaReceipt;
    }
  };
  const MainIcon = getTypeIcon();

  const renderDetails = () => {
    switch (item.dataType) {
      case "DepositRequest":
        return (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light py-2">
              <FaCreditCard className="me-2 text-muted" />{" "}
              {t("activityModal.paymentDetails")}
            </Card.Header>
            <Card.Body className="py-2 px-3">
              <DetailRow
                Icon={FaCreditCard}
                label={t("activityModal.method")}
                value={item.methodName || "N/A"}
              />
              <DetailRow
                Icon={FaDollarSign}
                label={t("activityModal.amountSent", {
                  currency: item.currency,
                })}
                value={formatCurrency(item.amount, item.currency)}
              />
              {item.feeAmount > 0 && (
                <DetailRow
                  Icon={FaInfoCircle}
                  label={t("activityModal.fee", { currency: item.currency })}
                  value={formatCurrency(item.feeAmount, item.currency)}
                  variant="warning"
                />
              )}
              <DetailRow
                Icon={FaCheckCircle}
                label={t("activityModal.netAmount", {
                  currency: item.currency,
                })}
                value={formatCurrency(item.netAmount, item.currency)}
                variant="success"
              />
              {item.transactionId && (
                <DetailRow
                  Icon={FaReceipt}
                  label={t("activityModal.transactionId")}
                  value={item.transactionId}
                />
              )}
              {item.senderInfo && (
                <DetailRow
                  Icon={FaUser}
                  label={t("activityModal.senderInfo")}
                  value={item.senderInfo}
                />
              )}
            </Card.Body>
          </Card>
        );

      // [!!!] START OF THE FIX [!!!]
      case "WithdrawalRequest":
        const {
          originalAmount,
          originalCurrency,
          feeAmount,
          netAmountToReceive,
        } = item;
        let feeInOriginalCurrency = feeAmount; // الرسوم بالدينار
        let netInOriginalCurrency = netAmountToReceive; // الصافي بالدينار

        // إذا كانت العملة الأصلية ليست TND، قم بالتحويل للعرض فقط
        if (originalCurrency !== "TND" && originalCurrency) {
          feeInOriginalCurrency = feeAmount / TND_TO_USD_RATE;
          // أعد حساب الصافي بالعملة الأصلية ليكون دقيقًا
          netInOriginalCurrency = originalAmount - feeInOriginalCurrency;
        }

        return (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light py-2">
              <FaCreditCard className="me-2 text-muted" />{" "}
              {t("activityModal.paymentDetails")}
            </Card.Header>
            <Card.Body className="py-2 px-3">
              <DetailRow
                Icon={FaCreditCard}
                label={t("activityModal.method")}
                value={item.methodName || "N/A"}
              />
              <DetailRow
                Icon={FaDollarSign}
                label={t("activityModal.amountWithdrawn", {
                  currency: originalCurrency,
                })}
                value={formatCurrency(originalAmount, originalCurrency)}
              />
              <DetailRow
                Icon={FaInfoCircle}
                label={t("activityModal.fee", { currency: originalCurrency })}
                value={formatCurrency(feeInOriginalCurrency, originalCurrency)}
                variant="warning"
              />
              <DetailRow
                Icon={FaCheckCircle}
                label={t("activityModal.netReceived", {
                  currency: originalCurrency,
                })}
                value={formatCurrency(netInOriginalCurrency, originalCurrency)}
                variant="success"
              />
              <DetailRow
                Icon={FaReceipt}
                label={t("activityModal.withdrawalInfo")}
                value={item.withdrawalInfo || "N/A"}
              />
              {item.transactionReference &&
                (item.status?.toLowerCase() === "completed" ||
                  item.status?.toLowerCase() === "approved") && (
                  <DetailRow
                    Icon={FaReceipt}
                    label={t("activityModal.paymentRef")}
                    value={item.transactionReference}
                  />
                )}
            </Card.Body>
          </Card>
        );
      // [!!!] END OF THE FIX [!!!]

      case "Transaction":
        const isSender = item.sender?._id === currentUserId || item.isSender;
        const peerUser = isSender ? item.recipient : item.sender;
        return (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light py-2">
              <FaInfoCircle className="me-2 text-muted" />{" "}
              {t("activityModal.transactionDetails")}
            </Card.Header>
            <Card.Body className="py-2 px-3">
              {peerUser && (
                <DetailRow
                  Icon={FaUser}
                  label={
                    isSender
                      ? t("activityModal.sentTo")
                      : t("activityModal.receivedFrom")
                  }
                  value={peerUser?.fullName || peerUser?.email || "Unknown"}
                />
              )}
              <DetailRow
                Icon={FaDollarSign}
                label={t("activityModal.amount")}
                value={formatCurrency(item.amount, item.currency)}
                variant={isSender ? "danger" : "success"}
              />
              {item.description && (
                <DetailRow
                  Icon={FaRegFileAlt}
                  label={t("activityModal.description")}
                  value={t(item.description, {
                    defaultValue: item.description,
                  })}
                />
              )}
            </Card.Body>
          </Card>
        );
      default:
        return (
          <Card className="mb-3 shadow-sm">
            <Card.Header className="bg-light py-2">
              <FaInfoCircle className="me-2 text-muted" />{" "}
              {t("activityModal.generalDetails")}
            </Card.Header>
            <Card.Body className="py-2 px-3">
              <Alert variant="secondary" className="mt-3 small">
                {t("activityModal.genericInfo")}
              </Alert>
            </Card.Body>
          </Card>
        );
    }
  };

  const renderRejectionReason = () => {
    if (
      item.rejectionReason &&
      (item.status?.toLowerCase() === "rejected" ||
        item.status?.toLowerCase() === "failed")
    ) {
      return (
        <Card className="mb-3 shadow-sm border-danger">
          <Card.Header className="bg-danger text-white py-2">
            <FaTimesCircle className="me-2" />{" "}
            {t("activityModal.rejectionReason")}
          </Card.Header>
          <Card.Body className="py-2 px-3 text-danger">
            {item.rejectionReason}
          </Card.Body>
        </Card>
      );
    }
    return null;
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <MainIcon size={22} className="me-3 text-primary" />
        <Modal.Title as="h5" className="fw-bold">
          {t("activityModal.title", {
            type: t(`walletPage.activityTypes.${item.type}`, {
              methodName: item.methodName,
              peerName: item.peerUser?.fullName || "User",
              defaultValue: item.type?.replace(/_/g, " "),
            }),
          })}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <div className="text-center mb-4">{getStatusBadge()}</div>
        <Card className="mb-3 shadow-sm">
          <Card.Header className="bg-light py-2">
            <FaCalendarAlt className="me-2 text-muted" />{" "}
            {t("activityModal.dateTime")}
          </Card.Header>
          <Card.Body className="py-2 px-3">
            <DetailRow
              label={t("activityModal.timestamp")}
              value={formatDate(item.createdAt)}
            />
          </Card.Body>
        </Card>
        {renderDetails()}
        {renderRejectionReason()}
      </Modal.Body>
      <Modal.Footer className="border-top pt-2 pb-3 px-4 bg-light">
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          {t("common.close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const DetailRow = ({
  Icon = FaInfoCircle,
  label,
  value,
  variant = "light",
}) => (
  <Row className="mb-2 align-items-center">
    <Col xs={5} sm={4} className="text-muted small d-flex align-items-center">
      {Icon && <Icon size={14} className="me-2 opacity-75 flex-shrink-0" />}
      <span>{label}</span>
    </Col>
    <Col
      xs={7}
      sm={8}
      className={`fw-medium text-${variant === "light" ? "dark" : variant}`}
    >
      {value}
    </Col>
  </Row>
);

export default ActivityDetailsModal;