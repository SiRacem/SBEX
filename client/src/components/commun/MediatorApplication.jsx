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
import { useTranslation, Trans } from "react-i18next";
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
import FeeExplanationModal from "./FeeExplanationModal";
import { FaInfoCircle } from "react-icons/fa";

const MEDIATOR_REQUIRED_LEVEL = 5;
const MEDIATOR_ESCROW_AMOUNT_TND = 150.0;

const MediatorApplication = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const {
    user,
    loadingApplyMediator,
    errorApplyMediator,
    successApplyMediator,
    loadingUpdateMediatorStatus,
    errorUpdateMediatorStatus,
  } = useSelector((state) => state.userReducer);

  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      const options = {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const locale = currencyCode === "USD" ? "en-US" : i18n.language;
      if (currencyCode === "USD") options.currencyDisplay = "symbol";
      return new Intl.NumberFormat(locale, options).format(amount);
    },
    [i18n.language]
  );

  const handleApply = useCallback(
    (type) => {
      if (loadingApplyMediator) return;
      dispatch(applyForMediator(type));
    },
    [dispatch, loadingApplyMediator]
  );

  const handleCloseApplyAlert = useCallback(() => {
    dispatch(resetApplyMediatorStatus());
  }, [dispatch]);

  const handleStatusChange = useCallback(
    (newStatus) => {
      if (loadingUpdateMediatorStatus || user?.mediatorStatus === newStatus)
        return;
      dispatch(updateMediatorStatus(newStatus));
    },
    [dispatch, loadingUpdateMediatorStatus, user?.mediatorStatus]
  );

  const [selectedStatus, setSelectedStatus] = useState(
    user?.mediatorStatus || "Unavailable"
  );

  const [showFeeModal, setShowFeeModal] = useState(false);

  useEffect(() => {
    if (user?.mediatorStatus) {
      setSelectedStatus(user.mediatorStatus);
    }
  }, [user?.mediatorStatus]);

  if (!user) return null;

  const canApplyByReputation = (user.level || 1) >= MEDIATOR_REQUIRED_LEVEL;
  const canApplyByGuarantee = (user.balance || 0) >= MEDIATOR_ESCROW_AMOUNT_TND;
  const currentAppStatus = user.mediatorApplicationStatus || "None";
  const isQualified = user.isMediatorQualified || false;
  const currentMediatorStatus = user.mediatorStatus || "Unavailable";

  return (
    <Card className="shadow-sm mb-4">
      {isQualified ? (
        <>
          <Card.Header className="bg-light d-flex justify-content-between align-items-center p-3 border-0">
            <h5 className="mb-0">
              <FaUserCheck className="me-2 text-success" />
              {t("mediatorApplication.qualified.title")}
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
              {t(`mediatorApplication.statuses.${currentMediatorStatus}`, {
                defaultValue: currentMediatorStatus,
              })}
            </Badge>
          </Card.Header>
          <Card.Body className="p-4">
            <p className="text-muted small mb-3">
              {t("mediatorApplication.qualified.infoText")}
            </p>
            {errorUpdateMediatorStatus && (
              <Alert variant="danger">
                {t("mediatorApplication.qualified.updateError", {
                  error: errorUpdateMediatorStatus,
                })}
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
                {t("mediatorApplication.qualified.statusAvailable")}
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
                {t("mediatorApplication.qualified.statusUnavailable")}
              </Button>
            </ButtonGroup>
            {currentMediatorStatus === "Busy" && (
              <Alert variant="warning" className="mt-3 small text-center p-2">
                <FaUserClock className="me-1" />
                {t("mediatorApplication.qualified.busyAlert")}
              </Alert>
            )}
            <div className="mt-4 border-top pt-3 mediator-stats">
              <div className="text-center mb-2">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowFeeModal(true)}
                >
                  {t("feeModal.viewStructure", "View Fee Structure")}
                </Button>
              </div>
              <p className="small text-muted mb-1 d-flex justify-content-between">
                <span>
                  {t("mediatorApplication.qualified.successfulMediations")}
                </span>
                <span className="fw-bold">
                  {user.successfulMediationsCount || 0}
                </span>
              </p>
              <p className="small text-muted mb-0 d-flex justify-content-between">
                <span>{t("mediatorApplication.qualified.guaranteeHeld")}</span>
                <span className="fw-bold">
                  {formatCurrency(user.mediatorEscrowGuarantee || 0, "TND")}
                </span>
              </p>
              {user.canWithdrawGuarantee &&
                user.mediatorEscrowGuarantee > 0 && (
                  <div className="text-center mt-3">
                    <Button size="sm" variant="outline-primary">
                      {t("mediatorApplication.qualified.withdrawButton")}
                    </Button>
                  </div>
                )}
            </div>
          </Card.Body>
        </>
      ) : (
        <>
          <Card.Header className="bg-light p-3 border-0">
            <h5 className="mb-0 section-title-modern">
              {t("mediatorApplication.application.title")}
            </h5>
          </Card.Header>
          <Card.Body className="p-4">
            {currentAppStatus === "Pending" && (
              <Alert variant="info" className="d-flex align-items-center">
                <FaHourglassHalf className="me-2 flex-shrink-0" />
                {t("mediatorApplication.application.pendingAlert")}
              </Alert>
            )}
            {currentAppStatus === "Rejected" && (
              <Alert variant="danger" className="d-flex align-items-start">
                <FaTimesCircle className="me-2 mt-1 flex-shrink-0" />
                <div>
                  {t("mediatorApplication.application.rejectedAlertTitle")}
                  {user.mediatorApplicationNotes && (
                    <small className="d-block mt-1">
                      <strong>
                        {t("mediatorApplication.application.rejectionReason")}
                      </strong>{" "}
                      {user.mediatorApplicationNotes}
                    </small>
                  )}
                </div>
              </Alert>
            )}
            {(currentAppStatus === "None" ||
              currentAppStatus === "Rejected") && (
              <>
                <p className="text-muted mb-3">
                  {t("mediatorApplication.application.requirementsTitle")}
                </p>
                <ListGroup variant="flush" className="mb-3 requirement-list">
                  <ListGroup.Item className="d-flex align-items-center ps-0 border-0">
                    <FaStar className="me-2 text-info requirement-icon" />
                    <Trans
                      i18nKey="mediatorApplication.application.reputationRequirement"
                      values={{
                        requiredLevel: MEDIATOR_REQUIRED_LEVEL,
                        currentLevel: user.level || 1,
                      }}
                      components={{ strong: <strong /> }}
                    />
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center ps-0 border-0">
                    <FaMoneyBillWave className="me-2 text-success requirement-icon" />
                    <Trans
                      i18nKey="mediatorApplication.application.guaranteeRequirement"
                      values={{
                        amount: formatCurrency(
                          MEDIATOR_ESCROW_AMOUNT_TND,
                          "TND"
                        ),
                        balance: formatCurrency(user.balance || 0, "TND"),
                      }}
                      components={{ strong: <strong /> }}
                    />
                  </ListGroup.Item>
                </ListGroup>
                {successApplyMediator && (
                  <Alert
                    variant="success"
                    onClose={handleCloseApplyAlert}
                    dismissible
                  >
                    {t("mediatorApplication.application.applySuccess")}
                  </Alert>
                )}
                {errorApplyMediator && (
                  <Alert
                    variant="danger"
                    onClose={handleCloseApplyAlert}
                    dismissible
                  >
                    {t("mediatorApplication.application.applyError", {
                      error: errorApplyMediator,
                    })}
                  </Alert>
                )}
                <div className="d-grid gap-2 d-sm-flex justify-content-start apply-buttons">
                  <Button
                    variant="primary"
                    onClick={() => handleApply("reputation")}
                    disabled={loadingApplyMediator || !canApplyByReputation}
                    title={
                      !canApplyByReputation
                        ? t(
                            "mediatorApplication.application.levelTooltipDisabled",
                            { level: MEDIATOR_REQUIRED_LEVEL }
                          )
                        : t("mediatorApplication.application.levelTooltip")
                    }
                  >
                    {loadingApplyMediator ? (
                      <Spinner size="sm" />
                    ) : (
                      t("mediatorApplication.application.applyByLevelButton")
                    )}
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => handleApply("guarantee")}
                    disabled={loadingApplyMediator || !canApplyByGuarantee}
                    title={
                      !canApplyByGuarantee
                        ? t(
                            "mediatorApplication.application.guaranteeTooltipDisabled",
                            {
                              amount: formatCurrency(
                                MEDIATOR_ESCROW_AMOUNT_TND,
                                "TND"
                              ),
                            }
                          )
                        : t("mediatorApplication.application.guaranteeTooltip")
                    }
                  >
                    {loadingApplyMediator ? (
                      <Spinner size="sm" />
                    ) : (
                      t(
                        "mediatorApplication.application.applyByGuaranteeButton"
                      )
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card.Body>
        </>
      )}
      <FeeExplanationModal
        show={showFeeModal}
        onHide={() => setShowFeeModal(false)}
        userRole="Mediator"
      />
    </Card>
  );
};

export default MediatorApplication;