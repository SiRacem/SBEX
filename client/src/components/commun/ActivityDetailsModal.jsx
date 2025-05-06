// src/components/commun/ActivityDetailsModal.jsx
// *** نسخة كاملة ونهائية مع عرض رسوم السحب بشكل أوضح ***

import React from 'react';
import { Modal, Button, Badge, Row, Col, Alert, Card, Container } from 'react-bootstrap';
import { format } from 'date-fns';
import {
  FaQuestionCircle, FaDollarSign, FaCalendarAlt, FaInfoCircle,
  FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaSpinner, FaUser,
  FaReceipt, FaCreditCard, FaArrowAltCircleDown, FaArrowAltCircleUp,
  FaPaperPlane, FaInbox, FaRegFileAlt, FaHourglassStart // أيقونات إضافية للحالات
} from 'react-icons/fa';

// --- الدوال والمتغيرات المساعدة ---
const TND_TO_USD_RATE = 3.0; // تأكد من تطابقه مع الـ Backend

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== 'string' || currencyCode.trim() === '') {
    safeCurrencyCode = "TND";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    console.warn(`Currency formatting error for code '${safeCurrencyCode}':`, error);
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};
// -----------------------------------

// --- المكون الرئيسي ---
const ActivityDetailsModal = ({ show, onHide, item, currentUserId }) => {
  if (!item) return null;

  // --- دالة مساعدة لعرض شارة الحالة مع أيقونة أكبر ---
  const getStatusBadge = () => {
    let variant = "secondary";
    let text = item.status || item.type || 'Unknown';
    let Icon = FaInfoCircle;
    const statusLower = item.status?.toLowerCase();

    if (item.type === "TRANSFER" && statusLower !== 'rejected' && statusLower !== 'failed') { // Handle completed transfers separately if needed
        variant = "success"; text = "Completed"; Icon = FaCheckCircle;
    } else if (statusLower) {
        text = item.status; // Use the exact status text
        switch (statusLower) {
            case "pending": variant = "warning"; Icon = FaHourglassStart; break; // Use alternative icon
            case "processing": variant = "info"; Icon = FaSpinner; break;
            case "completed": case "approved": variant = "success"; Icon = FaCheckCircle; break;
            case "rejected": case "failed": variant = "danger"; Icon = FaTimesCircle; break;
            default: variant = "secondary"; Icon = FaInfoCircle; text = item.status; // Show the status text even if unknown
        }
    }
    return (
      <Badge bg={variant} className="d-inline-flex align-items-center p-2 fs-6 shadow-sm"> {/* Add shadow */}
        <Icon className="me-2" size={18} /> {text}
      </Badge>
    );
  };
  // --------------------------------------------------

  // --- دالة مساعدة لتحديد أيقونة النوع الرئيسية ---
  const getTypeIcon = () => {
    switch (item.type) {
      case "DEPOSIT_REQUEST": case "DEPOSIT": return FaArrowAltCircleDown;
      case "WITHDRAWAL_REQUEST": case "WITHDRAWAL": return FaArrowAltCircleUp;
      case "TRANSFER": return item.isSender ? FaPaperPlane : FaInbox;
      default: return FaReceipt;
    }
  };
  const MainIcon = getTypeIcon();
  // -------------------------------------------

  // --- دالة مساعدة لعرض تفاصيل النشاط حسب النوع ---
  const renderDetails = () => {
     switch (item.type) {
       case "DEPOSIT_REQUEST":
          return (
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-light py-2"><FaCreditCard className="me-2 text-muted" /> Payment & Amount Details</Card.Header>
              <Card.Body className="py-2 px-3">
                <DetailRow Icon={FaCreditCard} label="Method:" value={item.methodName || "N/A"} />
                <DetailRow Icon={FaDollarSign} label={`Amount Sent (${item.currency}):`} value={formatCurrency(item.amount, item.currency)} />
                {/* Display fee only if it's greater than 0 */}
                {item.feeAmount != null && item.feeAmount > 0 && (
                  <DetailRow Icon={FaInfoCircle} label={`Fee (${item.currency}):`} value={formatCurrency(item.feeAmount, item.currency)} variant="warning" />
                )}
                <DetailRow Icon={FaCheckCircle} label={`Net Amount (${item.currency}):`} value={formatCurrency(item.netAmount, item.currency)} variant="success" />
                {item.transactionId && ( <DetailRow Icon={FaReceipt} label="Transaction ID:" value={item.transactionId} /> )}
                {item.senderInfo && ( <DetailRow Icon={FaUser} label="Sender Info:" value={item.senderInfo} /> )}
              </Card.Body>
            </Card>
          );

       case "WITHDRAWAL_REQUEST":
         const originalCurrency = item.originalCurrency || "N/A";
         const originalAmount = item.originalAmount != null ? item.originalAmount : 0;
         const feeTND = item.feeAmount || 0; // Fee stored in TND

         // Estimate fee in original currency for display
         let estimatedFeeOriginal = 0;
         if (originalCurrency !== 'TND' && feeTND > 0) {
             estimatedFeeOriginal = feeTND / TND_TO_USD_RATE;
         } else if (originalCurrency === 'TND') {
             estimatedFeeOriginal = feeTND;
         }

         // Estimate net received in original currency
         const netReceivedOriginal = originalAmount - estimatedFeeOriginal;

         return (
           <Card className="mb-3 shadow-sm">
             <Card.Header className="bg-light py-2"><FaCreditCard className="me-2 text-muted" /> Payment & Amount Details</Card.Header>
             <Card.Body className="py-2 px-3">
               <DetailRow Icon={FaCreditCard} label="Method:" value={item.methodName || "N/A"} />
               <DetailRow Icon={FaDollarSign} label={`Amount Withdrawn (${originalCurrency}):`} value={formatCurrency(originalAmount, originalCurrency)} />
               {/* Display estimated fee in original currency */}
               {estimatedFeeOriginal > 0 && (
                 <DetailRow Icon={FaInfoCircle} label={`Fee (Est. ${originalCurrency}):`} value={`≈ ${formatCurrency(estimatedFeeOriginal, originalCurrency)}`} variant="warning" />
               )}
               {/* Display estimated net received in original currency */}
               <DetailRow Icon={FaCheckCircle} label={`Net Received (Est. ${originalCurrency}):`} value={`≈ ${formatCurrency(netReceivedOriginal, originalCurrency)}`} variant="success" />
               {/* Always show the actual amount deducted in TND */}
               <DetailRow Icon={FaReceipt} label="Withdrawal Details:" value={item.withdrawalInfo || "N/A"} />
               {item.transactionReference && item.status === "Completed" && ( <DetailRow Icon={FaReceipt} label="Payment Ref:" value={item.transactionReference} /> )}
             </Card.Body>
           </Card>
         );

        // --- Cases for TRANSFER, DEPOSIT, WITHDRAWAL (using Transaction data) ---
        case "TRANSFER":
            const isSenderTransfer = item.sender?._id === currentUserId || item.isSender;
            const peerUserTransfer = isSenderTransfer ? item.recipient : item.sender;
            return (
              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light py-2"><FaInfoCircle className="me-2 text-muted" /> Transaction Details</Card.Header>
                <Card.Body className="py-2 px-3">
                  {peerUserTransfer && ( <DetailRow Icon={FaUser} label={isSenderTransfer ? "Sent To:" : "Received From:"} value={peerUserTransfer?.fullName || peerUserTransfer?.email || "Unknown User"} /> )}
                  <DetailRow Icon={FaDollarSign} label="Amount:" value={formatCurrency(item.amount, item.currency)} variant={isSenderTransfer ? "danger" : "success"} />
                  {item.description && ( <DetailRow Icon={FaRegFileAlt} label="Description:" value={item.description} /> )}
                </Card.Body>
              </Card>
            );
        case "DEPOSIT": // Display for completed Deposit Transaction
             return (
              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light py-2"><FaInfoCircle className="me-2 text-muted" /> Transaction Details</Card.Header>
                <Card.Body className="py-2 px-3">
                   <DetailRow Icon={FaDollarSign} label="Amount:" value={formatCurrency(item.amount, item.currency)} variant="success" />
                  {item.description && ( <DetailRow Icon={FaRegFileAlt} label="Description:" value={item.description} /> )}
                </Card.Body>
              </Card>
            );
        case "WITHDRAWAL": // Display for completed Withdrawal Transaction
             return (
              <Card className="mb-3 shadow-sm">
                <Card.Header className="bg-light py-2"><FaInfoCircle className="me-2 text-muted" /> Transaction Details</Card.Header>
                <Card.Body className="py-2 px-3">
                   <DetailRow Icon={FaDollarSign} label="Amount:" value={formatCurrency(item.amount, item.currency)} variant="danger" />
                  {item.description && ( <DetailRow Icon={FaRegFileAlt} label="Description:" value={item.description} /> )}
                </Card.Body>
              </Card>
            );
       // --------------------------------------------------------------------

       default: // Fallback for unknown types
         const amountDefault = item.amount || item.netAmount || item.netAmountToReceive || 0;
         const currencyDefault = item.currency || item.originalCurrency || "TND";
         return (
            <Card className="mb-3 shadow-sm">
              <Card.Header className="bg-light py-2"><FaInfoCircle className="me-2 text-muted" /> General Details</Card.Header>
              <Card.Body className="py-2 px-3">
                <DetailRow Icon={FaDollarSign} label="Amount:" value={formatCurrency(amountDefault, currencyDefault)} />
                <Alert variant="secondary" className="mt-3 small">Details for this activity type are generic.</Alert>
              </Card.Body>
            </Card>
         );
     }
  };
  // ----------------------------------------------------

  // --- دالة عرض سبب الرفض ---
  const renderRejectionReason = () => {
    if (item.rejectionReason && (item.status?.toLowerCase() === "rejected" || item.status?.toLowerCase() === "failed")) {
      return (
        <Card className="mb-3 shadow-sm border-danger">
          <Card.Header className="bg-danger text-white py-2"><FaTimesCircle className="me-2" /> Rejection Reason</Card.Header>
          <Card.Body className="py-2 px-3 text-danger">{item.rejectionReason}</Card.Body>
        </Card>
      );
    }
    return null;
  };
  // ---------------------------

  // --- JSX الرئيسي للمودال ---
  return (
    <Modal show={show} onHide={onHide} centered size="md" className="activity-details-modal-enhanced">
      <Modal.Header closeButton className="bg-light border-bottom pb-2 pt-3 px-4 align-items-center"> {/* Adjusted style */}
         <MainIcon size={22} className="me-3 text-primary" /> {/* Slightly smaller main icon */}
        <Modal.Title as="h5" className="modal-title-enhanced fw-bold"> {/* Bolder title */}
          {item.type?.replace(/_/g, ' ') || 'Activity'} Details
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {/* Status Badge */}
        <div className="text-center mb-4">{getStatusBadge()}</div>

        {/* Date Card */}
         <Card className="mb-3 shadow-sm">
             <Card.Header className="bg-light py-2"><FaCalendarAlt className="me-2 text-muted" /> Date & Time</Card.Header>
             <Card.Body className="py-2 px-3">
                <DetailRow label="Timestamp:" value={item.createdAt ? format(new Date(item.createdAt), "Pp O") : "N/A"} />
             </Card.Body>
         </Card>

        {/* Type-Specific Details */}
        {renderDetails()}

        {/* Rejection Reason (Conditional) */}
        {renderRejectionReason()}

      </Modal.Body>
      <Modal.Footer className="border-top pt-2 pb-3 px-4 bg-light"> {/* Styled Footer */}
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
  // -------------------------
};

// --- مكون مساعد لعرض صف تفاصيل ---
const DetailRow = ({ Icon = FaInfoCircle, label, value, variant = "light", isEstimate = false }) => (
  <Row className="mb-2 detail-row-enhanced align-items-center">
    <Col xs={5} sm={4} className="text-muted small d-flex align-items-center detail-label">
      {Icon && <Icon size={14} className="me-2 opacity-75 flex-shrink-0" />} {/* Conditionally render Icon */}
      <span>{label}</span>
    </Col>
    <Col xs={7} sm={8} className={`fw-medium detail-value text-${variant === 'light' ? 'dark' : variant}`}>
      {isEstimate && ( <span title="Estimated value" className="opacity-75 me-1">≈</span> )}
      {value}
    </Col>
  </Row>
);
// ---------------------------------

export default ActivityDetailsModal;