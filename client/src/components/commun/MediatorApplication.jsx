// src/components/profile/MediatorApplication.jsx
import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Card, Button, Alert, Spinner } from "react-bootstrap";
import {
  applyForMediator,
  resetApplyMediatorStatus,
} from "../../redux/actions/userAction";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaInfoCircle,
} from "react-icons/fa";

// --- [!] جلب الشروط من ملف الإعدادات أو تعريفها هنا [!] ---
const MEDIATOR_REQUIRED_LEVEL = 3;
const MEDIATOR_ESCROW_AMOUNT_TND = 150.0;
const TND_TO_USD_RATE = 3.0; // تأكد من تطابقه
// -------------------------------------------------------

// دالة تنسيق العملة (يمكن استيرادها)
const formatCurrency = (amount, currencyCode = "TND") => {
    if (currencyCode === "TND") {
        return `${amount.toFixed(2)} TND`;
    } else if (currencyCode === "USD") {
        return `${(amount / TND_TO_USD_RATE).toFixed(2)} USD`;
    }
    return `${amount} ${currencyCode}`;
};

const MediatorApplication = () => {
  const dispatch = useDispatch();
  const {
    user,
    loadingApplyMediator,
    errorApplyMediator,
    successApplyMediator,
  } = useSelector((state) => state.userReducer);

  // التحقق من وجود المستخدم وبياناته
  if (!user) return null; // لا تعرض شيئًا إذا لم يتم تحميل المستخدم

  const canApplyByReputation = user.level >= MEDIATOR_REQUIRED_LEVEL;
  const canApplyByGuarantee = user.balance >= MEDIATOR_ESCROW_AMOUNT_TND;
  const currentStatus = user.mediatorApplicationStatus || "None";
  const isQualified = user.isMediatorQualified;

  const handleApply = (type) => {
    if (loadingApplyMediator) return;
    dispatch(applyForMediator(type));
  };

  // إعادة تعيين الحالة عند إغلاق الرسالة
  const handleCloseAlert = () => {
    dispatch(resetApplyMediatorStatus());
  };

  // --- العرض ---
  return (
    <Card className="shadow-sm my-4">
      <Card.Header className="bg-light">
        <h5 className="mb-0">Become a Mediator</h5>
      </Card.Header>
      <Card.Body>
        {/* عرض الحالة الحالية */}
        {isQualified && (
          <Alert variant="success" className="d-flex align-items-center">
            <FaCheckCircle className="me-2" /> You are a qualified mediator! You
            can manage your availability status soon.
          </Alert>
        )}

        {!isQualified &&
          currentStatus === "Approved" && ( // حالة نادرة لكن للاحتياط
            <Alert variant="success" className="d-flex align-items-center">
              <FaCheckCircle className="me-2" /> Your mediator application was
              approved.
            </Alert>
          )}

        {!isQualified && currentStatus === "Pending" && (
          <Alert variant="info" className="d-flex align-items-center">
            <FaHourglassHalf className="me-2" /> Your application is pending
            review by administration.
          </Alert>
        )}

        {!isQualified && currentStatus === "Rejected" && (
          <Alert variant="danger" className="d-flex align-items-center">
            <FaTimesCircle className="me-2" /> Your previous application was
            rejected.
            {user.mediatorApplicationNotes && (
              <small className="d-block mt-1">
                Reason: {user.mediatorApplicationNotes}
              </small>
            )}
            {/* يمكنك إضافة زر لإعادة التقديم بعد فترة */}
          </Alert>
        )}

        {/* عرض شروط التقديم إذا لم يكن مؤهلاً أو طلبه مرفوضًا */}
        {!isQualified &&
          (currentStatus === "None" || currentStatus === "Rejected") && (
            <>
              <p>
                You can become a mediator and help ensure safe transactions on
                our platform. You need to meet one of the following
                requirements:
              </p>
              <ul>
                <li>
                  Reach Reputation Level{" "}
                  <strong>{MEDIATOR_REQUIRED_LEVEL}</strong> (Your current
                  level: {user.level || 1})
                </li>
                <li>
                  Deposit a guarantee of{" "}
                  <strong>
                    {formatCurrency(MEDIATOR_ESCROW_AMOUNT_TND, "TND")}
                  </strong>{" "}
                  (Your current balance: {formatCurrency(user.balance, "TND")})
                </li>
              </ul>

              {/* رسائل النجاح أو الخطأ */}
              {successApplyMediator && (
                <Alert variant="success" onClose={handleCloseAlert} dismissible>
                  Application submitted successfully!
                </Alert>
              )}
              {errorApplyMediator && (
                <Alert variant="danger" onClose={handleCloseAlert} dismissible>
                  Error: {errorApplyMediator}
                </Alert>
              )}

              {/* أزرار التقديم */}
              <div className="d-grid gap-2 d-sm-flex justify-content-start">
                <Button
                  variant="primary"
                  onClick={() => handleApply("reputation")}
                  disabled={loadingApplyMediator || !canApplyByReputation}
                  title={
                    !canApplyByReputation
                      ? `Requires Level ${MEDIATOR_REQUIRED_LEVEL}`
                      : "Apply based on your reputation"
                  }
                >
                  {loadingApplyMediator ? (
                    <Spinner size="sm" />
                  ) : (
                    "Apply (Level)"
                  )}
                </Button>
                <Button
                  variant="success"
                  onClick={() => handleApply("guarantee")}
                  disabled={loadingApplyMediator || !canApplyByGuarantee}
                  title={
                    !canApplyByGuarantee
                      ? `Requires ${formatCurrency(
                          MEDIATOR_ESCROW_AMOUNT_TND,
                          "TND"
                        )} balance`
                      : "Apply with guarantee deposit"
                  }
                >
                  {loadingApplyMediator ? (
                    <Spinner size="sm" />
                  ) : (
                    "Apply (Guarantee)"
                  )}
                </Button>
              </div>
            </>
          )}
      </Card.Body>
    </Card>
  );
};

export default MediatorApplication;
