// src/components/admin/DepositRequestDetailsModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Button,
  Table,
  Image,
  Spinner,
  Alert,
  Badge,
  Tooltip,
  OverlayTrigger,
} from "react-bootstrap";
import { format } from "date-fns";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  FaCopy,
  FaCheck,
  FaInfoCircle,
  FaHourglassHalf,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-toastify";

const TND_TO_USD_RATE = 3.0;

const DepositRequestDetailsModal = ({
  show,
  onHide,
  request,
  loading,
  requestType,
}) => {
  const { t, i18n } = useTranslation();
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copiedValue, setCopiedValue] = useState(null);

  const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    const locale =
      currencyCode === "USD"
        ? "en-US"
        : i18n.language === "tn"
        ? "ar-TN"
        : i18n.language;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(num);
    } catch (error) {
      return `${num.toFixed(2)} ${currencyCode}`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return format(
      new Date(dateString),
      i18n.language === "en" ? "Pp" : "dd/MM/yyyy, HH:mm"
    );
  };

  useEffect(() => {
    if (!show) setIsLightboxOpen(false);
    setCopiedValue(null);
  }, [show]);

  const copyToClipboard = useCallback(
    (text, identifier) => {
      if (!text || copiedValue === identifier) return;
      navigator.clipboard
        .writeText(String(text))
        .then(() => {
          toast.success(t("clipboard.copied", { item: identifier }), {
            autoClose: 1500,
          });
          setCopiedValue(identifier);
          setTimeout(() => setCopiedValue(null), 2000);
        })
        .catch(() => toast.error(t("clipboard.copyFailed")));
    },
    [copiedValue, t]
  );

  const renderStatusBadge = (status) => {
    let variant = "secondary",
      icon = <FaInfoCircle />;
    const lowerStatus = status?.toLowerCase();
    if (["completed", "approved"].includes(lowerStatus)) {
      variant = "success";
      icon = <FaCheckCircle />;
    } else if (lowerStatus === "pending") {
      variant = "warning";
      icon = <FaHourglassHalf />;
    } else if (["rejected", "failed", "cancelled"].includes(lowerStatus)) {
      variant = "danger";
      icon = <FaExclamationTriangle />;
    }
    const displayStatus = t(`walletPage.statuses.${lowerStatus}`, {
      defaultValue: status || "Unknown",
    });
    return (
      <Badge bg={variant} className="d-inline-flex align-items-center">
        {React.cloneElement(icon, { className: "me-1" })} {displayStatus}
      </Badge>
    );
  };

  const DetailRow = ({
    label,
    value,
    canCopy = false,
    copyIdentifier = label,
  }) => (
    <tr>
      <td className="fw-bold" style={{ width: "40%" }}>
        {label}
      </td>
      <td>
        {value}
        {canCopy && value && value !== "N/A" && (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>{t("clipboard.copy", { item: copyIdentifier })}</Tooltip>
            }
          >
            <Button
              variant="link"
              size="sm"
              className="p-0 ms-2"
              onClick={() => copyToClipboard(value, copyIdentifier)}
              disabled={copiedValue === copyIdentifier}
            >
              {copiedValue === copyIdentifier ? (
                <FaCheck className="text-success" />
              ) : (
                <FaCopy className="text-secondary" />
              )}
            </Button>
          </OverlayTrigger>
        )}
      </td>
    </tr>
  );

  const renderContent = () => {
    if (loading)
      return (
        <div className="text-center p-4">
          <Spinner animation="border" />
          <p className="mt-2">{t("admin.detailsModal.loadingDetails")}</p>
        </div>
      );
    if (!request)
      return <Alert variant="warning">{t("admin.detailsModal.noData")}</Alert>;

    const isDeposit = requestType === "deposit";

    let withdrawalDisplay = {};
    if (!isDeposit && request.originalCurrency) {
      const { originalAmount, originalCurrency, feeAmount } = request;
      let feeInOriginalCurrency = feeAmount;
      if (originalCurrency !== "TND") {
        feeInOriginalCurrency = feeAmount / TND_TO_USD_RATE;
      }
      const netInOriginalCurrency = originalAmount - feeInOriginalCurrency;

      withdrawalDisplay = {
        amountLabel: t("admin.detailsModal.withdrawalAmountOriginal", {
          currency: originalCurrency,
        }),
        amountValue: formatCurrency(originalAmount, originalCurrency),
        feeLabel: t("admin.detailsModal.feeOriginal", {
          currency: originalCurrency,
        }),
        feeValue: formatCurrency(feeInOriginalCurrency, originalCurrency),
        netLabel: t("admin.detailsModal.netReceiveOriginal", {
          currency: originalCurrency,
        }),
        netValue: formatCurrency(netInOriginalCurrency, originalCurrency),
        totalDeductedLabel: t("admin.detailsModal.totalDeductedTND"),
        totalDeductedValue: formatCurrency(request.amount, "TND"),
      };
    }

    return (
      <>
        <h5 className="mb-3">{t("admin.detailsModal.userTitle")}</h5>
        <Table bordered responsive size="sm" className="mb-4">
          <tbody>
            <DetailRow
              label={t("admin.detailsModal.userName")}
              value={request.user?.fullName}
            />
            <DetailRow
              label={t("admin.detailsModal.userEmail")}
              value={request.user?.email}
              canCopy={true}
              copyIdentifier={t("admin.detailsModal.userEmail")}
            />
            <DetailRow
              label={t("admin.detailsModal.userPhone")}
              value={request.user?.phone || "N/A"}
              canCopy={true}
              copyIdentifier={t("admin.detailsModal.userPhone")}
            />
            <DetailRow
              label={t("admin.detailsModal.userBalance")}
              value={formatCurrency(request.user?.balance, "TND")}
            />
          </tbody>
        </Table>

        <h5 className="mb-3">{t("admin.detailsModal.requestTitle")}</h5>
        <Table bordered responsive size="sm">
          <tbody>
            <DetailRow
              label={t("admin.detailsModal.requestId")}
              value={request._id}
              canCopy={true}
              copyIdentifier="ID"
            />
            <DetailRow
              label={t("admin.detailsModal.status")}
              value={renderStatusBadge(request.status)}
            />
            <DetailRow
              label={t("admin.detailsModal.requestDate")}
              value={formatDate(request.createdAt)}
            />
            <DetailRow
              label={t("admin.detailsModal.method")}
              value={
                isDeposit
                  ? request.paymentMethod?.displayName || "N/A"
                  : request.withdrawalMethod?.displayName || "N/A"
              }
            />

            {isDeposit ? (
              <>
                <DetailRow
                  label={t("admin.detailsModal.depositAmount")}
                  value={formatCurrency(request.amount, request.currency)}
                />
                <DetailRow
                  label={t("admin.detailsModal.fee")}
                  value={formatCurrency(request.feeAmount, request.currency)}
                />
                <DetailRow
                  label={t("admin.detailsModal.netCredit")}
                  value={formatCurrency(
                    request.netAmountCredited,
                    request.currency
                  )}
                />
                <DetailRow
                  label={t("admin.detailsModal.txnId")}
                  value={request.transactionId || request.senderInfo || "N/A"}
                  canCopy={true}
                  copyIdentifier="ID"
                />
              </>
            ) : (
              <>
                <DetailRow
                  label={withdrawalDisplay.amountLabel}
                  value={withdrawalDisplay.amountValue}
                />
                <DetailRow
                  label={withdrawalDisplay.feeLabel}
                  value={withdrawalDisplay.feeValue}
                />
                <DetailRow
                  label={withdrawalDisplay.netLabel}
                  value={withdrawalDisplay.netValue}
                />
                <DetailRow
                  label={withdrawalDisplay.totalDeductedLabel}
                  value={withdrawalDisplay.totalDeductedValue}
                />
                <DetailRow
                  label={t("admin.detailsModal.withdrawalInfo")}
                  value={request.withdrawalInfo || "N/A"}
                  canCopy={true}
                  copyIdentifier="Info"
                />
              </>
            )}

            {request.screenshotUrl ? (
              <tr>
                <td className="fw-bold">
                  {t("admin.detailsModal.screenshot")}
                </td>
                <td>
                  <Button
                    variant="link"
                    className="p-0"
                    onClick={() => setIsLightboxOpen(true)}
                  >
                    <Image
                      src={request.screenshotUrl}
                      thumbnail
                      style={{ maxWidth: "150px", cursor: "pointer" }}
                    />
                  </Button>
                </td>
              </tr>
            ) : (
              <tr>
                <td className="fw-bold">
                  {t("admin.detailsModal.screenshot")}
                </td>
                <td>{t("admin.detailsModal.noScreenshot")}</td>
              </tr>
            )}
            {request.rejectionReason && (
              <DetailRow
                label={t("admin.detailsModal.rejectionReason")}
                value={
                  <span className="text-danger">{request.rejectionReason}</span>
                }
              />
            )}
          </tbody>
        </Table>
      </>
    );
  };

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {t("admin.detailsModal.title", {
              type: t(`admin.detailsModal.types.${requestType}`),
            })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{renderContent()}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {request?.screenshotUrl && (
        <Lightbox
          open={isLightboxOpen}
          close={() => setIsLightboxOpen(false)}
          slides={[{ src: request.screenshotUrl }]}
        />
      )}
    </>
  );
};

export default DepositRequestDetailsModal;