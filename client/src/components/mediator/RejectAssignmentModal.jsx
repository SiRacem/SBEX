// client/src/components/mediator/RejectAssignmentModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const RejectAssignmentModal = ({
  show,
  onHide,
  assignment,
  onConfirmReject,
  loading,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) {
      setReason("");
      setError("");
    }
  }, [show]);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError(t("rejectAssignmentModal.reasonRequired"));
      return;
    }
    setError("");
    onConfirmReject(assignment._id, reason);
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
        <Modal.Title>{t("rejectAssignmentModal.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {assignment && (
          <p>
            {t("rejectAssignmentModal.aboutToReject")}{" "}
            <strong>{assignment.product?.title || t("common.na")}</strong>
          </p>
        )}
        <Form.Group controlId="rejectionReason">
          <Form.Label>
            {t("rejectAssignmentModal.reasonLabel")}{" "}
            <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError("");
            }}
            placeholder={t("rejectAssignmentModal.placeholder")}
            isInvalid={!!error}
            disabled={loading}
            autoFocus
          />
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          {t("common.cancel")}
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
              {t("rejectAssignmentModal.rejecting")}
            </>
          ) : (
            t("rejectAssignmentModal.confirmRejection")
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RejectAssignmentModal;