// src/pages/admin/ReviewMediatorApplications.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
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
import { FaCheck, FaTimes, FaInfoCircle } from "react-icons/fa";
import { format } from "date-fns";
import { toast } from "react-toastify";
import {
  adminGetPendingMediatorApplications,
  adminProcessMediatorApplication,
  adminResetProcessMediatorAppStatus,
} from "../../redux/actions/userAction";

const PAGE_LIMIT = 15;
const formatCurrency = (amount, currencyCode = "TND") => {
  /* ... */
}; // Use shared helper

const ReviewMediatorApplications = () => {
  const dispatch = useDispatch();

  const { pendingMediatorApps, loadingPendingApps, errorPendingApps } =
    useSelector((state) => state.userReducer);
  const { processingApp, errorProcessApp, successProcessApp } = useSelector(
    (state) => state.userReducer
  );

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
  }, [fetchApplications]);

  const handleApprove = (userId) => {
    if (processingApp[userId]) return;
    if (
      window.confirm(
        `Are you sure you want to approve this user as a mediator? Ensure guarantee deposit if required.`
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
    if (!userToReject || !rejectReason.trim()) {
      toast.warn("Please provide a reason for rejection.");
      return;
    }
    if (processingApp[userToReject._id]) return;
    dispatch(
      adminProcessMediatorApplication(userToReject._id, "reject", rejectReason)
    );
    setShowRejectModal(false);
  };

  // Reset status on success to remove loading/error messages
  useEffect(() => {
    if (successProcessApp) {
      dispatch(adminResetProcessMediatorAppStatus());
    }
  }, [successProcessApp, dispatch]);

  return (
    <Container fluid className="py-4">
      <h2 className="page-title mb-4">Review Mediator Applications</h2>

      {errorProcessApp && (
        <Alert
          variant="danger"
          onClose={() => dispatch(adminResetProcessMediatorAppStatus())}
          dismissible
        >
          Error processing application: {errorProcessApp}
        </Alert>
      )}

      {loadingPendingApps ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : errorPendingApps ? (
        <Alert variant="danger">
          Error loading applications: {errorPendingApps}
        </Alert>
      ) : !pendingMediatorApps?.applications ||
        pendingMediatorApps.applications.length === 0 ? (
        <Alert variant="info">
          No pending mediator applications to review.
        </Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead className="table-light">
                <tr>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Level</th>
                  <th>Balance (TND)</th>
                  <th>Applied On</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingMediatorApps.applications.map((app) => (
                  <tr key={app._id}>
                    <td>{app.fullName || "N/A"}</td>
                    <td>{app.email}</td>
                    <td>{app.level || 1}</td>
                    <td>{formatCurrency(app.balance, "TND")}</td>
                    <td className="small text-muted">
                      {app.updatedAt
                        ? format(new Date(app.updatedAt), "Pp")
                        : "N/A"}
                    </td>
                    <td className="text-center">
                      <Button
                        variant="outline-success"
                        size="sm"
                        className="me-1"
                        onClick={() => handleApprove(app._id)}
                        disabled={processingApp[app._id]}
                        title="Approve"
                      >
                        {processingApp[app._id] ? (
                          <Spinner size="sm" animation="border" />
                        ) : (
                          <FaCheck />
                        )}
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleOpenRejectModal(app)}
                        disabled={processingApp[app._id]}
                        title="Reject"
                      >
                        {processingApp[app._id] ? (
                          <Spinner size="sm" animation="border" />
                        ) : (
                          <FaTimes />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {/* Pagination */}
          {pendingMediatorApps.totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination size="sm">
                <Pagination.Prev
                  onClick={() => fetchApplications(currentPage - 1)}
                  disabled={currentPage === 1}
                />
                {[...Array(pendingMediatorApps.totalPages)].map((_, i) => (
                  <Pagination.Item
                    key={i + 1}
                    active={i + 1 === currentPage}
                    onClick={() => fetchApplications(i + 1)}
                  >
                    {i + 1}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  onClick={() => fetchApplications(currentPage + 1)}
                  disabled={currentPage === pendingMediatorApps.totalPages}
                />
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Reject Reason Modal */}
      <Modal
        show={showRejectModal}
        onHide={() => setShowRejectModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Reject Mediator Application</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Provide reason for rejecting application from{" "}
            <strong>{userToReject?.fullName || "user"}</strong>:
          </p>
          <Form.Control
            as="textarea"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (required)..."
            required
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmReject}
            disabled={!rejectReason.trim() || processingApp[userToReject?._id]}
          >
            {processingApp[userToReject?._id] ? (
              <Spinner size="sm" />
            ) : (
              "Confirm Rejection"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ReviewMediatorApplications;
