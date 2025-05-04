// src/components/admin/DepositRequestDetailsModal.jsx
// *** النسخة النهائية الكاملة والمفصلة بدون أي اختصارات ***

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
import { format } from "date-fns"; // لتنسيق التواريخ
import Lightbox from "yet-another-react-lightbox"; // لعرض الصورة بحجم كامل
import "yet-another-react-lightbox/styles.css";
import {
  FaCopy,
  FaCheck,
  FaExternalLinkAlt, // أيقونات للنسخ والرابط الخارجي
  FaInfoCircle,
  FaHourglassHalf,
  FaCheckCircle,
  FaExclamationTriangle, // أيقونات للحالة
} from "react-icons/fa";
import { toast } from "react-toastify"; // لإظهار رسائل النسخ

// --- دالة تنسيق العملة المحسنة ---
const formatCurrency = (amount, currencyCode = "USD") => {
  const num = Number(amount);
  // التحقق من صلاحية المبلغ والعملة
  if (
    isNaN(num) ||
    !currencyCode ||
    typeof currencyCode !== "string" ||
    currencyCode.trim() === ""
  ) {
    // console.warn(`Invalid input for formatCurrency: amount=${amount}, currencyCode=${currencyCode}`);
    return <span className="text-muted fst-italic">N/A</span>;
  }
  try {
    // استخدام التنسيق المحلي للمتصفح
    return num.toLocaleString(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    // التعامل مع رموز العملات غير الصالحة
    console.error(
      `Currency formatting error for code '${currencyCode}':`,
      error
    );
    return `${num.toFixed(2)} ${currencyCode}`; // عرض احتياطي
  }
};
// --------------------------------

// --- تعريف المكون ---
// المودال يستقبل props: show, onHide, request, loading, requestType
const DepositRequestDetailsModal = ({
  show,
  onHide,
  request,
  loading,
  requestType,
}) => {
  // --- State للمكون ---
  const [isLightboxOpen, setIsLightboxOpen] = useState(false); // حالة فتح/إغلاق عارض الصور
  const [copiedValue, setCopiedValue] = useState(null); // لتتبع القيمة المنسوخة مؤقتًا

  // --- Effect لإعادة التعيين ---
  useEffect(() => {
    // عند إغلاق المودال أو تغيير الطلب، أغلق اللايت بوكس وأعد تعيين حالة النسخ
    if (!show) {
      setIsLightboxOpen(false);
    }
    setCopiedValue(null);
  }, [request, show]); // يعتمد على حالة العرض والطلب الحالي

  // --- دالة النسخ للحافظة ---
  const copyToClipboard = useCallback(
    (text, identifier) => {
      // لا تفعل شيئًا إذا لم يكن هناك نص أو تم نسخه للتو
      if (!text || copiedValue === identifier) return;
      const textToCopy = String(text); // تأكد من أنه نص
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          // إظهار رسالة نجاح وتحديث الحالة
          toast.success(`${identifier} Copied!`, { autoClose: 1500 });
          setCopiedValue(identifier);
          // إعادة تعيين الحالة بعد ثانيتين
          setTimeout(() => setCopiedValue(null), 2000);
        })
        .catch((err) => {
          // التعامل مع خطأ النسخ
          console.error("Clipboard copy failed:", err);
          toast.error("Copy failed. Please try again.");
        });
    },
    [copiedValue]
  ); // يعتمد فقط على حالة النسخ الحالية

  // --- دالة لعرض شارة الحالة مع أيقونة ---
  const renderStatusBadge = (status) => {
    let variant = "secondary"; // اللون الافتراضي
    let icon = <FaInfoCircle />; // الأيقونة الافتراضية
    const lowerStatus = status?.toLowerCase(); // تحويل لأحرف صغيرة للمقارنة

    // تحديد اللون والأيقونة بناءً على الحالة
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
    // قد تحتاج لإضافة حالة 'processing' هنا

    // تنسيق نص الحالة (الحرف الأول كبير)
    const displayStatus = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Unknown";

    // إرجاع مكون الشارة
    return (
      <Badge
        pill
        bg={variant}
        className="d-inline-flex align-items-center status-badge fs-sm"
      >
        {" "}
        {/* تصغير الخط قليلاً */}
        {React.cloneElement(icon, { className: "me-1" })} {displayStatus}
      </Badge>
    );
  };

  // --- دالة عرض صف تفاصيل مع خيار النسخ والرابط ---
  const renderDetailRow = (
    label,
    value,
    canCopy = false,
    copyIdentifier = label,
    isLink = false
  ) => {
    // تحديد القيمة للعرض، أو عرض "N/A" إذا كانت غير موجودة
    const displayValue =
      value !== undefined && value !== null && value !== "" ? (
        value
      ) : (
        <span className="text-muted fst-italic">N/A</span>
      );

    // عدم عرض الصف إذا كانت القيمة N/A (باستثناء حقول معينة)
    const alwaysShow = [
      "Status",
      "User Current Balance",
      "Processed At",
      "Admin Notes",
      "Rejection Reason",
    ].includes(label);
    // تعديل الشرط ليعرض الصف دائماً إذا كان يجب عرضه دائماً، أو إذا كانت القيمة ليست N/A
    if (displayValue?.props?.children === "N/A" && !alwaysShow) {
      return null;
    }

    // عرض الصف
    return (
      <tr>
        {/* عنوان الحقل */}
        <td
          style={{ width: "35%", fontWeight: "bold", verticalAlign: "middle" }}
          className="py-2 px-3"
        >
          {label}
        </td>
        {/* قيمة الحقل */}
        <td
          style={{ verticalAlign: "middle", wordBreak: "break-word" }}
          className="py-2 px-3"
        >
          {/* عرض كرابط */}
          {isLink && typeof value === "string" && value.startsWith("http") ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open link for ${label}`}
            >
              {value.length > 50 ? `${value.substring(0, 47)}...` : value}{" "}
              {/* اختصار الرابط الطويل */}
              <FaExternalLinkAlt size="0.8em" className="ms-1 text-primary" />
            </a>
          ) : // عرض الحالة كشارة، وإلا عرض القيمة النصية
          label === "Status" && typeof value === "string" ? ( // التأكد أن القيمة نصية قبل تمريرها لـ renderStatusBadge
            renderStatusBadge(value)
          ) : (
            displayValue
          )}
          {/* زر النسخ */}
          {canCopy &&
            value &&
            displayValue?.props?.children !== "N/A" && ( // عرض فقط إذا كان قابلاً للنسخ وهناك قيمة
              <OverlayTrigger
                placement="top"
                overlay={<Tooltip>Copy {copyIdentifier}</Tooltip>}
              >
                {/* استخدام span ضروري لعمل Tooltip على زر معطل */}
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

  // --- دالة عرض الصورة المصغرة مع معالج خطأ محسّن ---
  const renderImageThumbnailRow = (label, imageUrl) => {
    if (!imageUrl || typeof imageUrl !== "string")
      return renderDetailRow(label, null); // تحقق إضافي

    return (
      <tr>
        <td
          style={{ width: "35%", fontWeight: "bold", verticalAlign: "middle" }}
          className="py-2 px-3"
        >
          {label}
        </td>
        <td className="py-2 px-3">
          {/* عنصر الصورة المصغرة */}
          <Image
            src={imageUrl} // <-- المسار النسبي سيعمل بسبب express.static
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
              // عند فشل تحميل الصورة
              e.target.onerror = null; // منع حلقة لانهائية
              e.target.style.display = "none"; // إخفاء عنصر الصورة المكسور
              // إظهار رسالة الخطأ البديلة
              const errorPlaceholder = e.target.parentNode?.querySelector(
                ".img-error-placeholder"
              );
              if (errorPlaceholder) errorPlaceholder.style.display = "inline";
            }}
          />
          {/* رسالة الخطأ البديلة (مخفية افتراضياً) */}
          <span
            className="img-error-placeholder text-danger small"
            style={{ display: "none" }}
          >
            Failed to load image.
            {/* الرابط الخارجي لا يزال مفيدًا للتحقق */}
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-1"
            >
              (Open Link <FaExternalLinkAlt size="0.8em" />)
            </a>
          </span>
        </td>
      </tr>
    );
  };

  // تحديد نوع الطلب (لتسهيل القراءة)
  const isDepositRequest = requestType === "deposit";
  const isWithdrawalRequest = requestType === "withdrawal";

  // --- JSX الرئيسي للمودال ---
  return (
    <>
      {/* المودال الأساسي */}
      <Modal
        show={show}
        onHide={onHide}
        size="lg"
        centered
        dialogClassName="details-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {/* العنوان يعتمد على نوع الطلب */}
            {isDepositRequest ? "Deposit" : "Withdrawal"} Request Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* عرض مؤشر التحميل أو رسالة عدم وجود بيانات */}
          {loading ? (
            <div className="text-center p-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading...</p>
            </div>
          ) : !request ? (
            <Alert variant="warning" className="text-center">
              No request data available.
            </Alert>
          ) : (
            // عرض التفاصيل الكاملة
            <>
              {/* قسم معلومات المستخدم */}
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
                  {/* عرض رصيد المستخدم الحالي بالدينار التونسي */}
                  {renderDetailRow(
                    "User Current Balance",
                    request.user?.balance != null
                      ? formatCurrency(request.user.balance, "TND")
                      : null
                  )}
                </tbody>
              </Table>

              {/* قسم تفاصيل الطلب */}
              <h5 className="details-section-title">Request Details</h5>
              <Table
                bordered
                hover
                responsive="sm"
                size="sm"
                className="details-table align-middle mb-4"
              >
                <tbody>
                  {/* الحقول المشتركة */}
                  {renderDetailRow("Request ID", request._id)}
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

                  {/* عرض الحقول الخاصة بالإيداع */}
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

                  {/* --- تأكد من وجود هذا الجزء لعرض رصيد المستخدم --- */}
                  {renderDetailRow(
                    "User Current Balance",
                    request.user?.balance != null
                      ? formatCurrency(request.user.balance, "TND")
                      : null // <-- استخدام 'TND'
                  )}

                  {/* عرض الحقول الخاصة بالسحب */}
                  {isWithdrawalRequest && (
                    <>
                      <tr style={{ height: "5px" }}>
                        <td colSpan={2} className="p-0 border-0"></td>
                      </tr>{" "}
                      {/* فاصل بصري */}
                      {renderDetailRow(
                        "Withdrawal Amount",
                        formatCurrency(request.amount, request.currency)
                      )}
                      {/* تأكد من مطابقة هذه الأسماء مع الموديل لديك */}
                      {renderDetailRow(
                        "Fee Applied",
                        formatCurrency(request.feeAmount, request.currency)
                      )}
                      {renderDetailRow(
                        "Net Amount To Receive",
                        formatCurrency(
                          request.netAmountToReceive,
                          request.currency
                        )
                      )}
                      <tr style={{ height: "5px" }}>
                        <td colSpan={2} className="p-0 border-0"></td>
                      </tr>{" "}
                      {/* فاصل بصري */}
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

              {/* قسم معلومات المعالجة (إذا تمت) */}
              {/* التحقق من الحالة للتأكد من أنها ليست معلقة */}
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
                      {/* عرض سبب الرفض فقط إذا كانت الحالة مرفوضة */}
                      {request.status?.toLowerCase() === "rejected" &&
                        renderDetailRow(
                          "Rejection Reason",
                          request.rejectionReason || request.adminNotes
                        )}
                      {/* عرض ملاحظات الأدمن إذا لم تكن الحالة مرفوضة (لتجنب التكرار) */}
                      {request.status?.toLowerCase() !== "rejected" &&
                        renderDetailRow("Admin Notes", request.adminNotes)}
                      {/* عرض مرجع الدفع (للسحب) */}
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

      {/* Lightbox لعرض الصورة بحجم كامل */}
      <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={request?.screenshotUrl ? [{ src: request.screenshotUrl }] : []}
        styles={{ container: { zIndex: 1060 } }} // التأكد من ظهوره فوق المودال
      />
    </>
  );
};

export default DepositRequestDetailsModal;
