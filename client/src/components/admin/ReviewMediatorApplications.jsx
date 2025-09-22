// src/components/admin/ReviewMediatorApplications.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Container,
  Table,
  Button,
  Spinner,
  Alert,
  Modal,
  Form,
  Badge,
  Pagination,
} from "react-bootstrap";
import {
  FaCheck,
  FaTimes,
  FaEye,
  FaStar,
  FaMoneyBillWave,
} from "react-icons/fa";
import { format as formatDateFns } from "date-fns";
import { toast } from "react-toastify";
import {
  adminGetPendingMediatorApplications,
  adminProcessMediatorApplication,
  adminResetProcessMediatorAppStatus,
} from "../../redux/actions/userAction";
import { Link } from "react-router-dom";

const PAGE_LIMIT = 15;

const ReviewMediatorApplications = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const formatCurrencyForTable = useCallback(
    (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (amount == null || isNaN(num)) {
        return "N/A";
      }
      try {
        return new Intl.NumberFormat(i18n.language, {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      } catch (e) {
        console.error("Error formatting currency:", e);
        return `${num.toFixed(2)} ${currencyCode}`;
      }
    },
    [i18n.language]
  );

  const {
    pendingMediatorApplications: pendingMediatorApps,
    loadingPendingMediatorApps: loadingPendingApps,
    errorPendingMediatorApps: errorPendingApps,
    processingApp,
    errorProcessApp,
    successProcessApp,
  } = useSelector((state) => state.userReducer);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [userToReject, setUserToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchApplications = useCallback(
    (page = 1) => {
      dispatch(
        adminGetPendingMediatorApplications({ page, limit: PAGE_LIMIT })
      );
      setCurrentPage(page);
    },
    [dispatch]
  );

  useEffect(() => {
    fetchApplications(1);
  }, [fetchApplications]); // تم التعديل لإضافة fetchApplications كاعتمادية

  const handleApprove = (userId) => {
    if (processingApp[userId]) return;
    if (
      window.confirm(
        t("admin.mediatorApps.actions.confirmApprove", { userId: userId })
      )
    ) {
      dispatch(adminProcessMediatorApplication(userId, "approve"));
    }
  };

  const handleOpenRejectModal = (user) => {
    setUserToReject(user);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleConfirmReject = () => {
    if (!userToReject || !userToReject._id) {
      toast.error(t("admin.mediatorApps.rejectModal.errorUser"));
      return;
    }
    if (!rejectReason.trim()) {
      toast.warn(t("admin.mediatorApps.rejectModal.reasonRequired"));
      return;
    }
    if (processingApp[userToReject._id]) return;

    dispatch(
      adminProcessMediatorApplication(
        userToReject._id,
        "reject",
        rejectReason.trim()
      )
    );
    setShowRejectModal(false);
  };

  useEffect(() => {
    if (successProcessApp || errorProcessApp) {
      const timer = setTimeout(() => {
        dispatch(adminResetProcessMediatorAppStatus());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successProcessApp, errorProcessApp, dispatch]);

  const paginationItems = [];
  if (pendingMediatorApps && pendingMediatorApps.totalPages > 1) {
    for (let number = 1; number <= pendingMediatorApps.totalPages; number++) {
      paginationItems.push(
        <Pagination.Item
          key={number}
          active={number === currentPage}
          onClick={() => fetchApplications(number)}
          disabled={loadingPendingApps}
        >
          {number}
        </Pagination.Item>
      );
    }
  }

  return (
    <Container fluid className="py-4">
      <h2 className="page-title mb-4">{t("admin.mediatorApps.page.title")}</h2>

      {errorProcessApp && (
        <Alert
          variant="danger"
          onClose={() => dispatch(adminResetProcessMediatorAppStatus())}
          dismissible
        >
          {t("admin.mediatorApps.page.errorProcessing")}:{" "}
          {t(errorProcessApp.key, {
            ...errorProcessApp.params,
            defaultValue: errorProcessApp.fallback,
          })}
        </Alert>
      )}

      {loadingPendingApps &&
      (!pendingMediatorApps?.applications ||
        pendingMediatorApps.applications.length === 0) ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">{t("admin.mediatorApps.page.loading")}</p>
        </div>
      ) : errorPendingApps ? (
        <Alert variant="danger" className="text-center py-4">
          {t("admin.mediatorApps.page.errorLoading")}:{" "}
          {t(errorPendingApps.key, {
            ...errorPendingApps.params,
            defaultValue: errorPendingApps.fallback,
          })}
        </Alert>
      ) : !pendingMediatorApps?.applications ||
        pendingMediatorApps.applications.length === 0 ? (
        <Alert variant="info" className="text-center py-4">
          {t("admin.mediatorApps.page.noApps")}
        </Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table
              striped
              bordered
              hover
              size="sm"
              className="text-center align-middle"
            >
              <thead className="table-light">
                <tr>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.applicant")}
                  </th>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.email")}
                  </th>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.level")}
                  </th>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.guarantee")}
                  </th>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.basis")}
                  </th>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.appliedOn")}
                  </th>
                  <th className="text-center">
                    {t("admin.mediatorApps.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingMediatorApps.applications.map((app) => {
                  const isProcessingThisApp = processingApp[app._id];
                  return (
                    <tr key={app._id}>
                      <td>{app.fullName || "N/A"}</td>
                      <td>{app.email}</td>
                      <td>{app.level != null ? app.level : "N/A"}</td>
                      <td>
                        {app.mediatorApplicationBasis === "Guarantee" &&
                        app.mediatorEscrowGuarantee != null
                          ? formatCurrencyForTable(
                              app.mediatorEscrowGuarantee,
                              "TND"
                            )
                          : "N/A"}
                      </td>
                      <td>
                        {app.mediatorApplicationBasis === "Reputation" && (
                          <Badge bg="info" text="dark" pill>
                            <FaStar className="me-1" />{" "}
                            {t("admin.mediatorApps.basis.reputation")}
                          </Badge>
                        )}
                        {app.mediatorApplicationBasis === "Guarantee" && (
                          <Badge bg="success" pill>
                            <FaMoneyBillWave className="me-1" />{" "}
                            {t("admin.mediatorApps.basis.guarantee")}
                          </Badge>
                        )}
                        {(!app.mediatorApplicationBasis ||
                          app.mediatorApplicationBasis === "Unknown") && (
                          <Badge bg="secondary" pill>
                            {t("admin.mediatorApps.basis.unknown")}
                          </Badge>
                        )}
                      </td>
                      <td className="small text-muted">
                        {app.mediatorApplicationSubmittedAt ||
                        app.createdAt ||
                        app.updatedAt
                          ? formatDateFns(
                              new Date(
                                app.mediatorApplicationSubmittedAt ||
                                  app.createdAt ||
                                  app.updatedAt
                              ),
                              "dd/MM/yyyy, hh:mm a"
                            )
                          : "N/A"}
                      </td>
                      <td className="text-center">
                        <Button
                          as={Link}
                          to={`/profile/${app._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="outline-info"
                          size="sm"
                          className="me-1 action-button"
                          title={t("admin.mediatorApps.actions.viewProfile")}
                          disabled={isProcessingThisApp}
                        >
                          <FaEye />
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          className="me-1 action-button"
                          onClick={() => handleApprove(app._id)}
                          disabled={isProcessingThisApp}
                          title={t("admin.mediatorApps.actions.approve")}
                        >
                          {isProcessingThisApp ? (
                            <Spinner size="sm" animation="border" />
                          ) : (
                            <FaCheck />
                          )}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="action-button"
                          onClick={() => handleOpenRejectModal(app)}
                          disabled={isProcessingThisApp}
                          title={t("admin.mediatorApps.actions.reject")}
                        >
                          {isProcessingThisApp ? (
                            <Spinner size="sm" animation="border" />
                          ) : (
                            <FaTimes />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {pendingMediatorApps.totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination size="sm">
                <Pagination.Prev
                  onClick={() => fetchApplications(currentPage - 1)}
                  disabled={currentPage === 1 || loadingPendingApps}
                />
                {paginationItems}
                <Pagination.Next
                  onClick={() => fetchApplications(currentPage + 1)}
                  disabled={
                    currentPage === pendingMediatorApps.totalPages ||
                    loadingPendingApps
                  }
                />
              </Pagination>
            </div>
          )}
        </>
      )}

      <Modal
        show={showRejectModal}
        onHide={() => setShowRejectModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{t("admin.mediatorApps.rejectModal.title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {t("admin.mediatorApps.rejectModal.body", {
              name: userToReject?.fullName,
              id: userToReject?._id,
            })}
          </p>
          <Form.Group controlId="rejectReasonTextarea">
            <Form.Label>
              {t("admin.mediatorApps.rejectModal.reasonLabel")}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t(
                "admin.mediatorApps.rejectModal.reasonPlaceholder"
              )}
              required
              isInvalid={!rejectReason.trim() && rejectReason !== ""}
            />
            <Form.Control.Feedback type="invalid">
              {t("admin.mediatorApps.rejectModal.reasonRequired")}
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmReject}
            disabled={!rejectReason.trim() || processingApp[userToReject?._id]}
          >
            {processingApp[userToReject?._id] ? (
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />
            ) : (
              t("admin.mediatorApps.rejectModal.confirmButton")
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ReviewMediatorApplications;