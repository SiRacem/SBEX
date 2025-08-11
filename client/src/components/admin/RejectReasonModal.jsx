// src/components/admin/RejectReasonModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, FloatingLabel } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const RejectReasonModal = ({ show, onHide, onSubmit, requestInfo }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [validated, setValidated] = useState(false);

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
      onSubmit(reason.trim());
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>{t("rejectModal.title")}</Modal.Title>
      </Modal.Header>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Modal.Body>
          {requestInfo && (
            <p className="text-muted small mb-3">{requestInfo}</p>
          )}
          <FloatingLabel
            controlId="rejectionReasonInput"
            label={t("rejectModal.reasonLabel")}
          >
            <Form.Control
              as="textarea"
              rows={3}
              placeholder={t("rejectModal.reasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5}
            />
            <Form.Control.Feedback type="invalid">
              {t("rejectModal.validationError")}
            </Form.Control.Feedback>
          </FloatingLabel>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" type="submit">
            {t("rejectModal.confirmButton")}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RejectReasonModal;
