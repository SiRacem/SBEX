// src/pages/admin/AssignMediatorRequests.jsx
// *** نسخة كاملة ونهائية بدون اختصارات - مع تصحيح loadingCreate ***

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
  Pagination,
  Card,
  ListGroup,
} from "react-bootstrap";
import { FaUserCheck, FaTimes, FaInfoCircle } from "react-icons/fa"; // Keep using Fa for consistency if preferred elsewhere
import { format } from "date-fns";
import { toast } from "react-toastify"; // Assuming you might use toast later
import {
  adminGetPendingAssignments,
  adminAssignMediator,
  adminResetAssignMediatorStatus,
  adminGetAvailableMediators,
} from "../../redux/actions/mediationAction";
import { Link } from "react-router-dom"; // <-- إضافة هذا الاستيراد

const PAGE_LIMIT = 15; // Or your preferred limit

// Formatting function (can be imported if shared)
const TND_TO_USD_RATE = 3.0;
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.warn(
      `Currency formatting error for code '${safeCurrencyCode}':`,
      error
    );
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const AssignMediatorRequests = () => {
  const dispatch = useDispatch();

  // --- Selectors ---
  const { pendingAssignments, loadingPending, errorPending } = useSelector(
    (state) => state.mediationReducer
  );
  const { availableMediators, loadingMediators, errorMediators } = useSelector(
    (state) => state.userReducer
  );
  const { assigningMediator, errorAssign, successAssign } = useSelector(
    (state) => state.mediationReducer
  );

  // --- State ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRequestToAssign, setSelectedRequestToAssign] = useState(null);
  const [selectedMediator, setSelectedMediator] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // --- Fetch Data ---
  const fetchPendingRequests = useCallback(
    (page = 1) => {
      dispatch(adminGetPendingAssignments({ page, limit: PAGE_LIMIT }));
      setCurrentPage(page);
    },
    [dispatch]
  );

  useEffect(() => {
    fetchPendingRequests(1);
    dispatch(adminGetAvailableMediators());
  }, [dispatch, fetchPendingRequests]); // Include fetchPendingRequests dependency

  // --- Handlers ---
  const handleOpenAssignModal = (request) => {
    setSelectedRequestToAssign(request);
    setSelectedMediator("");
    setShowAssignModal(true);
    dispatch(adminResetAssignMediatorStatus());
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSelectedRequestToAssign(null);
    setSelectedMediator("");
  };

  const handleAssignConfirm = () => {
    if (!selectedRequestToAssign || !selectedMediator) {
      toast.warn("Please select a mediator."); // Added user feedback
      return;
    }
    dispatch(
      adminAssignMediator(selectedRequestToAssign._id, selectedMediator)
    );
  };

  // Close modal on successful assignment
  useEffect(() => {
    if (successAssign) {
      handleCloseAssignModal();
      // Optional: Refetch current page if desired, though reducer removes the item
      // fetchPendingRequests(currentPage);
    }
  }, [successAssign, handleCloseAssignModal]); // Added handleCloseAssignModal dependency

  // --- Render ---
  const renderMediatorOptions = () => {
    if (loadingMediators) return <option disabled>Loading mediators...</option>;
    if (errorMediators)
      return <option disabled>Error loading mediators</option>;
    if (!availableMediators || availableMediators.length === 0)
      return <option disabled>No available mediators found</option>;

    return availableMediators.map((med) => (
      <option key={med._id} value={med._id}>
        {med.fullName} ({med.email}) - Level: {med.level || "N/A"}
      </option>
    ));
  };

  return (
    <Container fluid className="py-4">
      <h2 className="page-title mb-4">Assign Mediators to Requests</h2>

      {/* Display assignment errors */}
      {errorAssign && (
        <Alert
          variant="danger"
          onClose={() => dispatch(adminResetAssignMediatorStatus())}
          dismissible
        >
          Error assigning mediator: {errorAssign}
        </Alert>
      )}

      {/* Main content area */}
      {loadingPending ? (
        <div className="text-center p-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Loading Requests...</p>
        </div>
      ) : errorPending ? (
        <Alert variant="danger">Error loading requests: {errorPending}</Alert>
      ) : !pendingAssignments?.requests || pendingAssignments.length === 0 ? (
        <Alert variant="info">
          No pending mediation requests require assignment.
        </Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table
              striped
              bordered
              hover
              size="sm"
              className="admin-requests-table"
            >
              <thead className="table-light">
                <tr className="text-center">
                  <th>Req. Date</th>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th>Bid Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {pendingAssignments.map((req) => (
                  <tr key={req._id}>
                    <td className="small text-muted align-middle">
                      {req.createdAt
                        ? format(new Date(req.createdAt), "Pp")
                        : "N/A"}
                    </td>
                    <td className="align-middle">
                      {req.product?.title || "N/A"}
                    </td>
                    <td className="align-middle">
                      {req.seller?.fullName || "N/A"}
                    </td>
                    <td className="align-middle">
                      {req.buyer?.fullName || "N/A"}
                    </td>
                    <td className="align-middle fw-medium">
                      {formatCurrency(req.bidAmount, req.bidCurrency)}
                    </td>
                    <td className="text-center align-middle">
                      {/* --- [!!!] إضافة زر تفاصيل (اختياري مبدئيًا، سنعدل المودال) --- */}
                      {/* <Button variant="outline-info" size="sm" onClick={() => handleShowRequestDetails(req)} className="me-1" title="View Details"><FaEye /></Button> */}
                      {/* --------------------------------------------------------------- */}
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleOpenAssignModal(req)}
                        disabled={assigningMediator[req._id]}
                        title="Assign Mediator"
                      >
                        {assigningMediator[req._id] ? (
                          <Spinner as="span" size="sm" animation="border" />
                        ) : (
                          <FaUserCheck />
                        )}
                        <span className="visually-hidden">Assign Mediator</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {pendingAssignments.totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination size="sm">
                <Pagination.Prev
                  onClick={() => fetchPendingRequests(currentPage - 1)}
                  disabled={currentPage === 1}
                />
                {[...Array(pendingAssignments.totalPages)].map((_, i) => (
                  <Pagination.Item
                    key={i + 1}
                    active={i + 1 === currentPage}
                    onClick={() => fetchPendingRequests(i + 1)}
                  >
                    {i + 1}
                  </Pagination.Item>
                ))}
                <Pagination.Next
                  onClick={() => fetchPendingRequests(currentPage + 1)}
                  disabled={currentPage === pendingAssignments.totalPages}
                />
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Assign Mediator Modal */}
      <Modal show={showAssignModal} onHide={handleCloseAssignModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Mediator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* --- [!!!] إضافة عرض تفاصيل الطلب هنا [!!!] --- */}
          {selectedRequestToAssign && (
            <Card className="mb-3 border-secondary">
              <Card.Header className="bg-light small py-1 px-2">
                Request Details
              </Card.Header>
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between small py-1 px-2">
                  <span>Product:</span>
                  <strong>
                    {selectedRequestToAssign.product?.title || "N/A"}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between small py-1 px-2">
                  <span>Seller:</span>
                  <strong>
                    {selectedRequestToAssign.seller?._id ? (
                      <Link
                        to={`/profile/${selectedRequestToAssign.seller._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View Seller Profile"
                      >
                        {selectedRequestToAssign.seller.fullName || "N/A"}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between small py-1 px-2">
                  <span>Buyer:</span>
                  <strong>
                    {selectedRequestToAssign.buyer?._id ? (
                      <Link
                        to={`/profile/${selectedRequestToAssign.buyer._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View Buyer Profile"
                      >
                        {selectedRequestToAssign.buyer.fullName || "N/A"}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between small py-1 px-2">
                  <span>Bid Amount:</span>
                  <strong>
                    {formatCurrency(
                      selectedRequestToAssign.bidAmount,
                      selectedRequestToAssign.bidCurrency
                    )}
                  </strong>
                </ListGroup.Item>
              </ListGroup>
            </Card>
          )}
          {/* ------------------------------------------- */}

          <Form.Group controlId="mediatorSelect">
            <Form.Label>Select Available Mediator</Form.Label>
            <Form.Select
              aria-label="Select Mediator"
              value={selectedMediator}
              onChange={(e) => setSelectedMediator(e.target.value)}
              disabled={
                loadingMediators ||
                assigningMediator[selectedRequestToAssign?._id]
              }
            >
              <option value="">-- Select a Mediator --</option>
              {renderMediatorOptions()}
            </Form.Select>
            {errorMediators && (
              <small className="text-danger d-block mt-1">
                {errorMediators}
              </small>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseAssignModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAssignConfirm}
            disabled={
              !selectedMediator ||
              assigningMediator[selectedRequestToAssign?._id]
            }
          >
            {assigningMediator[selectedRequestToAssign?._id] ? (
              <>
                <Spinner
                  as="span"
                  size="sm"
                  animation="border"
                  role="status"
                  aria-hidden="true"
                />
                Assigning...
              </>
            ) : (
              "Assign Mediator"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AssignMediatorRequests;
