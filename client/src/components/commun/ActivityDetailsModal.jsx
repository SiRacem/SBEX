// src/components/commun/ActivityDetailsModal.jsx
import React from "react";
import { Modal, Button, Badge, Row, Col, Alert } from "react-bootstrap";
import { format } from "date-fns";
import {
  FaQuestionCircle, // للنوع
  FaDollarSign, // للمبلغ
  FaCalendarAlt, // للتاريخ
  FaInfoCircle, // للتفاصيل/السبب
  FaCheckCircle, // للمكتمل
  FaTimesCircle, // للمرفوض
  FaHourglassHalf, // للمعلق/المعالج
  FaSpinner, // للمعالج (بديل)
  FaUser, // للمستخدم
  FaReceipt, // للمرجع/المعلومات
  FaCreditCard, // لطريقة الدفع
} from "react-icons/fa";

// ثابت سعر الصرف (يفضل جلبه من مكان مركزي إذا كان ديناميكياً)
const TND_TO_USD_RATE = 3.0;

// دالة تنسيق العملة
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A"; // التعامل مع null/undefined
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2, // ضمان وجود فاصلتين عشريتين
    }).format(num);
  } catch (error) {
    console.warn(`Could not format currency for code: ${currencyCode}`, error);
    // في حالة خطأ في كود العملة، اعرض الرقم مع كود العملة
    return `${num.toFixed(2)} ${currencyCode}`;
  }
};

// --- المكون الرئيسي ---
const ActivityDetailsModal = ({ show, onHide, item, currentUserId }) => {
  // لا تعرض شيئًا إذا لم يكن هناك عنصر محدد
  if (!item) return null;

  // --- دالة مساعدة لعرض شارة الحالة ---
  const getStatusBadge = () => {
    let variant = "secondary";
    let text = item.status || item.type; // نص افتراضي
    let Icon = FaInfoCircle; // أيقونة افتراضية

    if (item.type === "TRANSFER") {
      variant = "success";
      text = "Completed";
      Icon = FaCheckCircle;
    } else if (item.status) {
      text = item.status;
      switch (item.status.toLowerCase()) {
        case "pending":
          variant = "warning";
          Icon = FaHourglassHalf;
          break;
        case "processing":
          variant = "info";
          Icon = FaSpinner;
          break; // أو FaHourglassHalf
        case "completed":
          variant = "success";
          Icon = FaCheckCircle;
          break;
        case "rejected":
          variant = "danger";
          Icon = FaTimesCircle;
          break;
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
      <Badge bg={variant} className="d-inline-flex align-items-center">
        <Icon className="me-1" /> {text}
      </Badge>
    );
  };

  // --- دالة مساعدة لعرض تفاصيل النشاط حسب النوع ---
  const renderDetails = () => {
    switch (item.type) {
      case "DEPOSIT_REQUEST":
        return (
          <>
            <DetailRow
              Icon={FaCreditCard}
              label="Method:"
              value={item.methodName || "N/A"}
            />
            {/* المبلغ الإجمالي المرسل بالعملة الأصلية للطلب */}
            <DetailRow
              Icon={FaDollarSign}
              label="Amount Sent:"
              value={formatCurrency(item.amount, item.currency)}
            />
            {/* الرسوم المقدرة (بالدينار) */}
            {item.feeAmount > 0 && (
              <DetailRow
                Icon={FaInfoCircle}
                label="Fee (Est. TND):"
                value={formatCurrency(item.feeAmount, "TND")}
                variant="warning"
              />
            )}
            {/* المبلغ الصافي المضاف للرصيد (بالدينار) */}
            <DetailRow
              Icon={FaCheckCircle}
              label="Net Credited (TND):"
              value={formatCurrency(item.netAmount, "TND")}
              variant="success"
            />
            {item.transactionId && (
              <DetailRow
                Icon={FaReceipt}
                label="Transaction ID:"
                value={item.transactionId}
              />
            )}
            {item.senderInfo && (
              <DetailRow
                Icon={FaUser}
                label="Sender Info:"
                value={item.senderInfo}
              />
            )}
            {item.rejectionReason && item.status === "Rejected" && (
              <DetailRow
                Icon={FaInfoCircle}
                label="Rejection Reason:"
                value={item.rejectionReason}
                variant="danger"
              />
            )}
          </>
        );

      case "WITHDRAWAL_REQUEST":
        // تحديد العملة والمبلغ الأصليين للعرض إن وجدا
        const displayCurrency = item.originalCurrency || "TND";
        const displayAmount =
          item.originalAmount != null ? item.originalAmount : item.amount; // المبلغ الإجمالي الأصلي أو الإجمالي بالدينار كاحتياطي

        // حساب الصافي الأصلي (تقديري بناءً على النسبة والرسوم بالدينار)
        let netOriginal = item.netAmountToReceive; // الصافي بالدينار كقيمة افتراضية
        let isEstimate = false;
        if (
          displayCurrency !== "TND" &&
          item.originalAmount != null &&
          item.feeAmount != null
        ) {
          // نقدر الصافي الأصلي بطرح الرسوم المقدرة بالعملة الأصلية
          // نحتاج لمعرفة نسبة العمولة لحساب دقيق، لكن كتقدير:
          const feeOriginalApproximation = item.feeAmount / TND_TO_USD_RATE;
          netOriginal = item.originalAmount - feeOriginalApproximation;
          isEstimate = true; // نشير إلى أن هذا تقدير
        } else if (displayCurrency === "TND") {
          netOriginal = item.netAmountToReceive; // الصافي المحفوظ بالدينار
        }

        return (
          <>
            <DetailRow
              Icon={FaCreditCard}
              label="Method:"
              value={item.methodName || "N/A"}
            />
            {/* المبلغ الإجمالي الأصلي */}
            <DetailRow
              Icon={FaDollarSign}
              label="Amount Withdrawn (Total):"
              value={formatCurrency(displayAmount, displayCurrency)}
            />
            {/* الرسوم المقدرة (بالدينار) */}
            {item.feeAmount > 0 && (
              <DetailRow
                Icon={FaInfoCircle}
                label="Fee (Est. TND):"
                value={formatCurrency(item.feeAmount, "TND")}
                variant="warning"
              />
            )}
            {/* المبلغ الصافي المستلم (بالعملة الأصلية - تقديري) */}
            <DetailRow
              Icon={FaCheckCircle}
              label="Net Amount Received:"
              value={formatCurrency(netOriginal, displayCurrency)}
              variant="success"
              isEstimate={isEstimate}
            />
            {/* المبلغ الإجمالي المخصوم (بالدينار) */}
            <DetailRow
              Icon={FaDollarSign}
              label="Total Deducted (TND):"
              value={formatCurrency(item.amount, "TND")}
              variant="primary"
            />
            <DetailRow
              Icon={FaReceipt}
              label="Withdrawal Details:"
              value={item.withdrawalInfo || "N/A"}
            />
            {item.transactionReference && item.status === "Completed" && (
              <DetailRow
                Icon={FaReceipt}
                label="Payment Ref:"
                value={item.transactionReference}
              />
            )}
            {item.rejectionReason && item.status === "Rejected" && (
              <DetailRow
                Icon={FaInfoCircle}
                label="Rejection Reason:"
                value={item.rejectionReason}
                variant="danger"
              />
            )}
          </>
        );

      case "TRANSFER":
        const isSender = item.sender?._id === currentUserId || item.isSender; // التحقق من المرسل
        const peerUser = isSender ? item.recipient : item.sender;
        return (
          <>
            <DetailRow
              Icon={FaUser}
              label={isSender ? "Sent To:" : "Received From:"}
              value={peerUser?.fullName || peerUser?.email || "Unknown User"}
            />
            <DetailRow
              Icon={FaDollarSign}
              label="Amount:"
              value={formatCurrency(item.amount, item.currency)}
              variant={isSender ? "danger" : "success"}
            />
            {/* يمكن إضافة ملاحظات المعاملة إن وجدت */}
            {/* {item.notes && <DetailRow Icon={FaInfoCircle} label="Notes:" value={item.notes} />} */}
          </>
        );

      default:
        // عرض المبلغ العام إذا لم يتم التعرف على النوع
        const amount =
          item.amount || item.netAmount || item.netAmountToReceive || 0;
        const currency = item.currency || item.originalCurrency || "TND";
        return (
          <>
            <DetailRow
              Icon={FaDollarSign}
              label="Amount:"
              value={formatCurrency(amount, currency)}
            />
            <Alert variant="info" className="mt-3 small">
              More details for this activity type are not fully configured yet.
            </Alert>
          </>
        );
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      {" "}
      {/* تغيير الحجم إلى md */}
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title as="h6">Activity Details</Modal.Title>
      </Modal.Header>
      <Modal.Body className="px-4 pt-2 pb-4">
        {" "}
        {/* تعديل الحشو */}
        <div className="text-center mb-3">{getStatusBadge()}</div>
        {/* استخدام مكون DetailRow لعرض التفاصيل */}
        <DetailRow
          Icon={FaQuestionCircle}
          label="Type:"
          value={item.type?.replace(/_/g, " ") || "N/A"}
        />
        <DetailRow
          Icon={FaCalendarAlt}
          label="Date:"
          value={
            item.createdAt ? format(new Date(item.createdAt), "Pp O") : "N/A"
          }
        />
        {/* فاصل بصري */}
        <hr className="my-3" />
        {renderDetails()} {/* استدعاء الدالة لعرض التفاصيل حسب النوع */}
      </Modal.Body>
      {/* لا حاجة للـ Footer إذا كان زر الإغلاق في الـ Header كافياً */}
      {/*
            <Modal.Footer className="border-0 pt-0">
                <Button variant="outline-secondary" size="sm" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>
            */}
    </Modal>
  );
};

// --- مكون مساعد لعرض صف تفاصيل ---
// يقبل أيقونة كـ prop
const DetailRow = ({
  Icon = FaInfoCircle,
  label,
  value,
  variant = "light",
  isEstimate = false,
}) => (
  <Row className={`mb-2 detail-row align-items-center`}>
    <Col xs={5} sm={4} className="text-muted small d-flex align-items-center">
      <Icon size={12} className="me-2 opacity-75" /> {/* عرض الأيقونة */}
      {label}
    </Col>
    <Col
      xs={7}
      sm={8}
      className={`fw-medium ${
        variant === "danger"
          ? "text-danger"
          : variant === "success"
          ? "text-success"
          : variant === "primary"
          ? "text-primary"
          : variant === "warning"
          ? "text-warning"
          : ""
      }`}
    >
      {/* إضافة علامة التقدير إذا لزم الأمر */}
      {isEstimate && (
        <span
          title="Estimated value based on current rate"
          className="opacity-75 me-1"
        >
          ≈
        </span>
      )}
      {value}
    </Col>
  </Row>
);

export default ActivityDetailsModal;
