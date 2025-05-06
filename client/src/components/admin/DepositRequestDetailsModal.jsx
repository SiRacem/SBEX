// src/components/admin/DepositRequestDetailsModal.jsx
// *** نسخة معدلة لعرض المبالغ الأصلية لطلبات السحب ***

import React, { useState, useEffect, useCallback } from "react";
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
  FaExternalLinkAlt,
  FaInfoCircle,
  FaHourglassHalf,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-toastify";

// --- المكون الرئيسي ---
const DepositRequestDetailsModal = ({
  show,
  onHide,
  request,
  loading,
  requestType,
  // --- [!!!] استقبال الـ props الجديدة [!!!] ---
  formatCurrencyFn, // دالة تنسيق العملة الممررة
  tndToUsdRate, // سعر الصرف الممرر
  // -----------------------------------------
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copiedValue, setCopiedValue] = useState(null);

  // --- [!!!] استخدام formatCurrencyFn الممررة أو دالة افتراضية ---
  const formatCurrency =
    formatCurrencyFn ||
    ((amount, currencyCode = "USD") => {
      const num = Number(amount);
      if (
        isNaN(num) ||
        !currencyCode ||
        typeof currencyCode !== "string" ||
        currencyCode.trim() === ""
      ) {
        return <span className="text-muted fst-italic">N/A</span>;
      }
      try {
        return num.toLocaleString(undefined, {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } catch (error) {
        return `${num.toFixed(2)} ${currencyCode}`;
      }
    });
  // ------------------------------------------------------------

  useEffect(() => {
    if (!show) {
      setIsLightboxOpen(false);
    }
    setCopiedValue(null);
  }, [request, show]);

  const copyToClipboard = useCallback(
    (text, identifier) => {
      if (!text || copiedValue === identifier) return;
      const textToCopy = String(text);
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          toast.success(`${identifier} Copied!`, { autoClose: 1500 });
          setCopiedValue(identifier);
          setTimeout(() => setCopiedValue(null), 2000);
        })
        .catch((err) => {
          console.error("Clipboard copy failed:", err);
          toast.error("Copy failed. Please try again.");
        });
    },
    [copiedValue]
  );

  const renderStatusBadge = (status) => {
    let variant = "secondary";
    let icon = <FaInfoCircle />;
    const lowerStatus = status?.toLowerCase();
    if (lowerStatus === "completed" || lowerStatus === "approved") {
      variant = "success";
      icon = <FaCheckCircle />;
    } else if (lowerStatus === "pending") {
      variant = "warning";
      icon = <FaHourglassHalf />;
    } else if (
      lowerStatus === "rejected" ||
      lowerStatus === "failed" ||
      lowerStatus === "cancelled"
    ) {
      variant = "danger";
      icon = <FaExclamationTriangle />;
    }
    const displayStatus = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Unknown";
    return (
      <Badge
        pill
        bg={variant}
        className="d-inline-flex align-items-center status-badge fs-sm"
      >
        {" "}
        {React.cloneElement(icon, { className: "me-1" })} {displayStatus}{" "}
      </Badge>
    );
  };

  const renderDetailRow = (
    label,
    value,
    canCopy = false,
    copyIdentifier = label,
    isLink = false
  ) => {
    const displayValue =
      value !== undefined && value !== null && value !== "" ? (
        value
      ) : (
        <span className="text-muted fst-italic">N/A</span>
      );
    const alwaysShow = [
      "Status",
      "User Current Balance",
      "Processed At",
      "Admin Notes",
      "Rejection Reason",
    ].includes(label);
    if (displayValue?.props?.children === "N/A" && !alwaysShow) {
      return null;
    }
    return (
      <tr>
        <td
          style={{ width: "35%", fontWeight: "bold", verticalAlign: "middle" }}
          className="py-2 px-3"
        >
          {label}
        </td>
        <td
          style={{ verticalAlign: "middle", wordBreak: "break-word" }}
          className="py-2 px-3"
        >
          {isLink && typeof value === "string" && value.startsWith("http") ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open link for ${label}`}
            >
              {" "}
              {value.length > 50 ? `${value.substring(0, 47)}...` : value}{" "}
              <FaExternalLinkAlt size="0.8em" className="ms-1 text-primary" />{" "}
            </a>
          ) : label === "Status" && typeof value === "string" ? (
            renderStatusBadge(value)
          ) : (
            displayValue
          )}
          {canCopy && value && displayValue?.props?.children !== "N/A" && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>Copy {copyIdentifier}</Tooltip>}
            >
              <span className="d-inline-block">
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-2 copy-btn-details"
                  onClick={() => copyToClipboard(value, copyIdentifier)}
                  disabled={copiedValue === copyIdentifier}
                >
                  {copiedValue === copyIdentifier ? (
                    <FaCheck className="text-success" />
                  ) : (
                    <FaCopy className="text-secondary" />
                  )}
                </Button>
              </span>
            </OverlayTrigger>
          )}
        </td>
      </tr>
    );
  };

  const renderImageThumbnailRow = (label, imageUrl) => {
    if (!imageUrl || typeof imageUrl !== "string")
      return renderDetailRow(label, null);
    return (
      <tr>
        <td
          style={{ width: "35%", fontWeight: "bold", verticalAlign: "middle" }}
          className="py-2 px-3"
        >
          {label}
        </td>
        <td className="py-2 px-3">
          <Image
            src={imageUrl}
            thumbnail
            style={{
              maxHeight: "100px",
              maxWidth: "100%",
              cursor: "pointer",
              display: "block",
            }}
            alt={`${label} Thumbnail`}
            onClick={() => setIsLightboxOpen(true)}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = "none";
              const errorPlaceholder = e.target.parentNode?.querySelector(
                ".img-error-placeholder"
              );
              if (errorPlaceholder) errorPlaceholder.style.display = "inline";
            }}
          />
          <span
            className="img-error-placeholder text-danger small"
            style={{ display: "none" }}
          >
            {" "}
            Failed to load image.{" "}
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-1"
            >
              (Open Link <FaExternalLinkAlt size="0.8em" />)
            </a>{" "}
          </span>
        </td>
      </tr>
    );
  };

  const isDepositRequest = requestType === "deposit";
  const isWithdrawalRequest = requestType === "withdrawal";

  // --- [!!!] حساب القيم لطلبات السحب [!!!] ---
  let withdrawalOriginalAmountDisplay = null;
  let withdrawalFeeEstOriginalDisplay = null;
  let withdrawalNetEstOriginalDisplay = null;
  let withdrawalDeductedTNDDisplay = null;

  if (isWithdrawalRequest && request) {
    const originalAmount = request.originalAmount || 0;
    const originalCurrency = request.originalCurrency || "USD"; // Default to USD if not present
    const feeTND = request.feeAmount || 0; // This is stored in TND
    const totalDeductedTND = request.amount || 0; // Total deducted from user in TND

    withdrawalOriginalAmountDisplay = formatCurrency(
      originalAmount,
      originalCurrency
    );
    withdrawalDeductedTNDDisplay = formatCurrency(totalDeductedTND, "TND");

    if (feeTND > 0 && tndToUsdRate) {
      const feeOriginalEst =
        originalCurrency === "USD" ? feeTND / tndToUsdRate : feeTND;
      withdrawalFeeEstOriginalDisplay = `≈ ${formatCurrency(
        feeOriginalEst,
        originalCurrency
      )}`;
      const netOriginalEst = originalAmount - feeOriginalEst;
      withdrawalNetEstOriginalDisplay = `≈ ${formatCurrency(
        netOriginalEst,
        originalCurrency
      )}`;
    } else if (feeTND === 0) {
      // No fee case
      withdrawalFeeEstOriginalDisplay = formatCurrency(0, originalCurrency);
      withdrawalNetEstOriginalDisplay = formatCurrency(
        originalAmount,
        originalCurrency
      );
    }
  }
  // -----------------------------------------

  return (
    <>
      <Modal
        show={show}
        onHide={onHide}
        size="lg"
        centered
        dialogClassName="details-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {isDepositRequest ? "Deposit" : "Withdrawal"} Request Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <div className="text-center p-5">
              {" "}
              <Spinner animation="border" variant="primary" />{" "}
              <p className="mt-2 text-muted">Loading...</p>{" "}
            </div>
          ) : !request ? (
            <Alert variant="warning" className="text-center">
              No request data available.
            </Alert>
          ) : (
            <>
              <h5 className="details-section-title">User Information</h5>
              <Table
                bordered
                hover
                responsive="sm"
                size="sm"
                className="details-table align-middle mb-4"
              >
                <tbody>
                  {renderDetailRow("User Name", request.user?.fullName)}
                  {renderDetailRow(
                    "User Email",
                    request.user?.email,
                    true,
                    "Email"
                  )}
                  {renderDetailRow(
                    "User Phone",
                    request.user?.phone,
                    true,
                    "Phone"
                  )}
                  {renderDetailRow(
                    "User Current Balance",
                    request.user?.balance != null
                      ? formatCurrency(request.user.balance, "TND")
                      : null
                  )}
                </tbody>
              </Table>

              <h5 className="details-section-title">Request Details</h5>
              <Table
                bordered
                hover
                responsive="sm"
                size="sm"
                className="details-table align-middle mb-4"
              >
                <tbody>
                  {renderDetailRow(
                    "Request ID",
                    request._id,
                    true,
                    "Request ID"
                  )}
                  {renderDetailRow("Status", request.status)}
                  {renderDetailRow(
                    "Request Date",
                    request.createdAt
                      ? format(new Date(request.createdAt), "Pp O")
                      : null
                  )}
                  {renderDetailRow(
                    "Payment Method",
                    request.paymentMethod?.displayName ||
                      request.paymentMethod?.name ||
                      request.method
                  )}

                  {isDepositRequest && (
                    <>
                      <tr style={{ height: "5px" }}>
                        <td colSpan={2} className="p-0 border-0"></td>
                      </tr>
                      {renderDetailRow(
                        "Deposit Amount",
                        formatCurrency(request.amount, request.currency)
                      )}
                      {renderDetailRow(
                        "Fee Applied",
                        formatCurrency(request.feeAmount, request.currency)
                      )}
                      {renderDetailRow(
                        "Net Amount To Credit",
                        formatCurrency(
                          request.netAmountCredited,
                          request.currency
                        )
                      )}
                      <tr style={{ height: "5px" }}>
                        <td colSpan={2} className="p-0 border-0"></td>
                      </tr>
                      {renderDetailRow(
                        "Transaction ID (User)",
                        request.transactionId,
                        true,
                        "User Txn ID"
                      )}
                      {renderDetailRow(
                        "Sender Info (User)",
                        request.senderInfo
                      )}
                      {renderImageThumbnailRow(
                        "Proof Screenshot",
                        request.screenshotUrl
                      )}
                    </>
                  )}

                  {isWithdrawalRequest && (
                    <>
                      <tr style={{ height: "5px" }}>
                        <td colSpan={2} className="p-0 border-0"></td>
                      </tr>
                      {renderDetailRow(
                        `Withdrawal Amount (${
                          request.originalCurrency || "USD"
                        })`,
                        withdrawalOriginalAmountDisplay
                      )}
                      {renderDetailRow(
                        `Fee Applied (Est. ${
                          request.originalCurrency || "USD"
                        })`,
                        withdrawalFeeEstOriginalDisplay
                      )}
                      {renderDetailRow(
                        `Net To Receive (Est. ${
                          request.originalCurrency || "USD"
                        })`,
                        withdrawalNetEstOriginalDisplay
                      )}
                      {renderDetailRow(
                        "Total Deducted (TND)",
                        withdrawalDeductedTNDDisplay
                      )}
                      <tr style={{ height: "5px" }}>
                        <td colSpan={2} className="p-0 border-0"></td>
                      </tr>
                      {renderDetailRow(
                        "Withdrawal Info Provided",
                        typeof request.withdrawalInfo === "object"
                          ? JSON.stringify(request.withdrawalInfo)
                          : request.withdrawalInfo,
                        true,
                        "Withdrawal Info"
                      )}
                    </>
                  )}
                </tbody>
              </Table>

              {request.status?.toLowerCase() !== "pending" && (
                <>
                  <h5 className="details-section-title">
                    Processing Information
                  </h5>
                  <Table
                    bordered
                    hover
                    responsive="sm"
                    size="sm"
                    className="details-table align-middle"
                  >
                    <tbody>
                      {renderDetailRow(
                        "Processed By",
                        request.processedBy?.fullName ||
                          request.processedBy?.email
                      )}
                      {renderDetailRow(
                        "Processed At",
                        request.processedAt
                          ? format(new Date(request.processedAt), "Pp O")
                          : null
                      )}
                      {request.status?.toLowerCase() === "rejected" &&
                        renderDetailRow(
                          "Rejection Reason",
                          request.rejectionReason || request.adminNotes
                        )}
                      {request.status?.toLowerCase() !== "rejected" &&
                        renderDetailRow("Admin Notes", request.adminNotes)}
                      {isWithdrawalRequest &&
                        renderDetailRow(
                          "Payment Reference (Admin)",
                          request.transactionReference,
                          true,
                          "Admin Payment Ref"
                        )}
                    </tbody>
                  </Table>
                </>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={request?.screenshotUrl ? [{ src: request.screenshotUrl }] : []}
        styles={{ container: { zIndex: 1060 } }}
      />
    </>
  );
};

export default DepositRequestDetailsModal;
