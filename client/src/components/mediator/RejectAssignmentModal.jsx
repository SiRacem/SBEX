// client/src/components/mediator/RejectAssignmentModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap"; // Alert ليست مستخدمة حاليًا

const RejectAssignmentModal = ({
  show,
  onHide,
  assignment,
  onConfirmReject,
  loading,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(""); // خطأ محلي للمودال

  useEffect(() => {
    if (!show) {
      setReason("");
      setError("");
    }
  }, [show]);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setError("");
    onConfirmReject(assignment._id, reason); // تمرير ID المهمة والسبب
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop={loading ? "static" : true}
      keyboard={!loading}
    >
      <Modal.Header closeButton={!loading}>
        <Modal.Title>Reject Mediation Assignment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {assignment && (
          <p>
            You are about to reject the assignment for product: <br />
            <strong>{assignment.product?.title || "N/A"}</strong>
          </p>
        )}
        <Form.Group controlId="rejectionReason">
          <Form.Label>
            Reason for Rejection <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError("");
            }}
            placeholder="Please provide a clear reason for rejecting this assignment."
            isInvalid={!!error}
            disabled={loading}
            autoFocus
          />
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleSubmit}
          disabled={loading || !reason.trim()}
        >
          {loading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />
              Rejecting...
            </>
          ) : (
            "Confirm Rejection"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RejectAssignmentModal;