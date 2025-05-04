// src/components/admin/RejectReasonModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, FloatingLabel } from "react-bootstrap";

const RejectReasonModal = ({ show, onHide, onSubmit, requestInfo }) => {
  const [reason, setReason] = useState("");
  const [validated, setValidated] = useState(false);

  // مسح السبب عند فتح المودال
  useEffect(() => {
    if (show) {
      setReason("");
      setValidated(false);
    }
  }, [show]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.checkValidity() === false || reason.trim() === "") {
      event.stopPropagation();
      setValidated(true);
    } else {
      onSubmit(reason.trim()); // استدعاء الدالة من المكون الأب
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>Reject Deposit Request</Modal.Title>
      </Modal.Header>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Modal.Body>
          {requestInfo && (
            <p className="text-muted small mb-3">{requestInfo}</p>
          )}
          <FloatingLabel
            controlId="rejectionReasonInput"
            label="Reason for Rejection (Required)"
          >
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Enter reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5} // مثال لحد أدنى للطول
            />
            <Form.Control.Feedback type="invalid">
              Please provide a clear reason for rejection (min. 5 characters).
            </Form.Control.Feedback>
          </FloatingLabel>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="danger" type="submit">
            Confirm Rejection
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RejectReasonModal;
