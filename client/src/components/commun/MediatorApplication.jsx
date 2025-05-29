// src/components/commun/MediatorApplication.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Card,
  Button,
  Alert,
  Spinner,
  ButtonGroup,
  ListGroup,
  Badge,
} from "react-bootstrap";
import {
  applyForMediator,
  resetApplyMediatorStatus,
  updateMediatorStatus,
} from "../../redux/actions/userAction";
import {
  FaTimesCircle,
  FaHourglassHalf,
  FaUserCheck,
  FaUserClock,
  FaUserTimes,
  FaStar,
  FaMoneyBillWave,

} from "react-icons/fa";

const MEDIATOR_REQUIRED_LEVEL = 5; // المستوى المطلوب للوسيط
const MEDIATOR_ESCROW_AMOUNT_TND = 150.0;
const TND_TO_USD_RATE = 3.0;
const formatCurrency = (amount, currencyCode = "TND") => {
  const options = {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  return new Intl.NumberFormat("en-US", options).format(amount);
};

const MediatorApplication = () => {
  const dispatch = useDispatch();
  const {
    user,
    loadingApplyMediator,
    errorApplyMediator,
    successApplyMediator,
    loadingUpdateMediatorStatus,
    errorUpdateMediatorStatus,
  } = useSelector((state) => state.userReducer);

  // --- [!!!] نقل تعريفات useCallback إلى هنا (أعلى المكون) [!!!] ---
  const handleApply = useCallback(
    (type) => {
      // الوصول لـ loadingApplyMediator من الـ closure
      if (loadingApplyMediator) return;
      dispatch(applyForMediator(type));
    },
    [dispatch, loadingApplyMediator]
  ); // تعتمد على dispatch و loadingApplyMediator

  const handleCloseApplyAlert = useCallback(() => {
    dispatch(resetApplyMediatorStatus());
  }, [dispatch]);

  const handleStatusChange = useCallback(
    (newStatus) => {
      // الوصول لـ loadingUpdateMediatorStatus و user?.mediatorStatus من الـ closure
      if (loadingUpdateMediatorStatus || user?.mediatorStatus === newStatus)
        return;
      dispatch(updateMediatorStatus(newStatus));
    },
    [dispatch, loadingUpdateMediatorStatus, user?.mediatorStatus]
  ); // إضافة user?.mediatorStatus كاعتمادية
  // ----------------------------------------------------------------

  // --- State المحلي (يمكن أن يبقى هنا) ---
  const [selectedStatus, setSelectedStatus] = useState(
    user?.mediatorStatus || "Unavailable"
  );
  // ------------------------------------

  // تحديث الحالة المحلية عند تغير حالة المستخدم في Redux
  useEffect(() => {
    if (user?.mediatorStatus) {
      setSelectedStatus(user.mediatorStatus);
    }
  }, [user?.mediatorStatus]);

  // --- [!!!] التحقق من المستخدم يتم الآن بعد تعريف الـ Hooks [!!!] ---
  if (!user) return null;
  // -------------------------------------------------------------

  // --- حساب الشروط والمتغيرات (يبقى كما هو) ---
  const canApplyByReputation = (user.level || 1) >= MEDIATOR_REQUIRED_LEVEL;
  const canApplyByGuarantee = (user.balance || 0) >= MEDIATOR_ESCROW_AMOUNT_TND;
  const currentAppStatus = user.mediatorApplicationStatus || "None";
  const isQualified = user.isMediatorQualified || false;
  const currentMediatorStatus = user.mediatorStatus || "Unavailable";
  // ------------------------------------------

  return (
    <Card className="shadow-sm mb-4">
      {isQualified ? (
        // --- واجهة إدارة حالة الوسيط ---
        <>
          <Card.Header className="bg-light d-flex justify-content-between align-items-center p-3 border-0">
            <h5 className="mb-0">
              <FaUserCheck className="me-2 text-success" /> Mediator Status
            </h5>
            <Badge
              pill
              bg={
                currentMediatorStatus === "Available"
                  ? "success"
                  : currentMediatorStatus === "Busy"
                  ? "warning text-dark"
                  : "secondary"
              }
              className="status-badge-lg"
            >
              {currentMediatorStatus}
            </Badge>
          </Card.Header>
          <Card.Body className="p-4">
            <p className="text-muted small mb-3">
              Set your availability to receive new mediation tasks.
            </p>
            {errorUpdateMediatorStatus && (
              <Alert variant="danger">
                Error updating status: {errorUpdateMediatorStatus}
              </Alert>
            )}
            <ButtonGroup className="d-flex mediator-status-buttons">
              <Button
                variant={
                  selectedStatus === "Available" ? "success" : "outline-success"
                }
                onClick={() => handleStatusChange("Available")}
                disabled={
                  loadingUpdateMediatorStatus ||
                  currentMediatorStatus === "Busy"
                }
                className="flex-grow-1 py-2"
              >
                {loadingUpdateMediatorStatus &&
                selectedStatus === "Available" ? (
                  <Spinner size="sm" />
                ) : (
                  <FaUserCheck className="me-1" />
                )}
                Available
              </Button>
              <Button
                variant={
                  selectedStatus === "Unavailable"
                    ? "secondary"
                    : "outline-secondary"
                }
                onClick={() => handleStatusChange("Unavailable")}
                disabled={
                  loadingUpdateMediatorStatus ||
                  currentMediatorStatus === "Busy"
                }
                className="flex-grow-1 py-2"
              >
                {loadingUpdateMediatorStatus &&
                selectedStatus === "Unavailable" ? (
                  <Spinner size="sm" />
                ) : (
                  <FaUserTimes className="me-1" />
                )}
                Unavailable
              </Button>
            </ButtonGroup>
            {currentMediatorStatus === "Busy" && (
              <Alert variant="warning" className="mt-3 small text-center p-2">
                <FaUserClock className="me-1" /> You are currently busy with a
                mediation task.
              </Alert>
            )}
            <div className="mt-4 border-top pt-3 mediator-stats">
              <p className="small text-muted mb-1 d-flex justify-content-between">
                <span>Successful Mediations:</span>
                <span className="fw-bold">
                  {user.successfulMediationsCount || 0}
                </span>
              </p>
              <p className="small text-muted mb-0 d-flex justify-content-between">
                <span>Guarantee Held:</span>
                <span className="fw-bold">
                  {formatCurrency(user.mediatorEscrowGuarantee || 0, "TND")}
                </span>
              </p>
              {user.canWithdrawGuarantee &&
                user.mediatorEscrowGuarantee > 0 && (
                  <div className="text-center mt-3">
                    <Button size="sm" variant="outline-primary">
                      Request Guarantee Withdrawal
                    </Button>
                  </div>
                )}
            </div>
          </Card.Body>
        </>
      ) : (
        // --- واجهة طلب الانضمام ---
        <>
          <Card.Header className="bg-light p-3 border-0">
            <h5 className="mb-0 section-title-modern">
              Become a Mediator
            </h5>
          </Card.Header>
          <Card.Body className="p-4">
            {currentAppStatus === "Pending" && (
              <Alert variant="info" className="d-flex align-items-center">
                <FaHourglassHalf className="me-2 flex-shrink-0" /> Your
                application is pending review.
              </Alert>
            )}
            {currentAppStatus === "Rejected" && (
              <Alert variant="danger" className="d-flex align-items-start">
                <FaTimesCircle className="me-2 mt-1 flex-shrink-0" />
                <div>
                  Your previous application was rejected.
                  {user.mediatorApplicationNotes && (
                    <small className="d-block mt-1">
                      <strong>Reason:</strong> {user.mediatorApplicationNotes}
                    </small>
                  )}
                </div>
              </Alert>
            )}
            {(currentAppStatus === "None" ||
              currentAppStatus === "Rejected") && (
              <>
                <p className="text-muted mb-3">You can become a mediator if :</p>
                <ListGroup variant="flush" className="mb-3 requirement-list">
                  <ListGroup.Item className="d-flex align-items-center ps-0 border-0">
                    <FaStar className="me-2 text-info requirement-icon" />
                    <span>
                      Reach Reputation Level <strong>{MEDIATOR_REQUIRED_LEVEL}</strong> (Your current
                      level: {user.level || 1})
                    </span>
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center ps-0 border-0">
                    <FaMoneyBillWave className="me-2 text-success requirement-icon" />
                    <span>
                      Deposit a guarantee of <strong>
                        {formatCurrency(MEDIATOR_ESCROW_AMOUNT_TND, "TND")}
                      </strong> (Your current balance:{formatCurrency(user.balance || 0, "TND")})
                    </span>
                  </ListGroup.Item>
                </ListGroup>
                {successApplyMediator && (
                  <Alert
                    variant="success"
                    onClose={handleCloseApplyAlert}
                    dismissible
                  >
                    Application submitted successfully!
                  </Alert>
                )}
                {errorApplyMediator && (
                  <Alert
                    variant="danger"
                    onClose={handleCloseApplyAlert}
                    dismissible
                  >
                    Error: {errorApplyMediator}
                  </Alert>
                )}
                <div className="d-grid gap-2 d-sm-flex justify-content-start apply-buttons">
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
        </>
      )}
    </Card>
  );
};

export default MediatorApplication;
