// client/src/pages/RejectMediationByBuyerModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const RejectMediationByBuyerModal = ({
  show,
  onHide,
  request,
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
      setError(t("rejectMediationByBuyerModal.reasonRequired"));
      return;
    }
    setError("");
    onConfirmReject(request._id, reason);
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
        <Modal.Title>{t("rejectMediationByBuyerModal.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {request && (
          <p>
            {t("rejectMediationByBuyerModal.aboutToCancel")}{" "}
            <strong>{request.product?.title || t("common.na")}</strong>
          </p>
        )}
        <Form.Group controlId="buyerRejectionReason">
          <Form.Label>
            {t("rejectMediationByBuyerModal.reasonLabel")}{" "}
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
            placeholder={t("rejectMediationByBuyerModal.placeholder")}
            isInvalid={!!error}
            disabled={loading}
            autoFocus
          />
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          {t("rejectMediationByBuyerModal.back")}
        </Button>
        <Button
          variant="danger"
          onClick={handleSubmit}
          disabled={loading || !reason.trim()}
        >
          {loading ? (
            <>
              <Spinner size="sm" />{" "}
              {t("rejectMediationByBuyerModal.cancelling")}
            </>
          ) : (
            t("rejectMediationByBuyerModal.confirm")
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
export default RejectMediationByBuyerModal;