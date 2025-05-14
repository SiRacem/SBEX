// client/src/components/buyer/RejectMediationByBuyerModal.jsx (أو في مجلد components/mediation)
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';

const RejectMediationByBuyerModal = ({ show, onHide, request, onConfirmReject, loading }) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) { setReason(''); setError(''); }
    }, [show]);

    const handleSubmit = () => {
        if (!reason.trim()) { setError('Rejection reason is required.'); return; }
        setError('');
        onConfirmReject(request._id, reason);
    };

    return (
        <Modal show={show} onHide={onHide} centered backdrop={loading ? "static" : true} keyboard={!loading}>
            <Modal.Header closeButton={!loading}>
                <Modal.Title>Cancel Mediation</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {request && (
                    <p>
                        You are about to cancel the mediation for product: <br />
                        <strong>{request.product?.title || 'N/A'}</strong>
                    </p>
                )}
                <Form.Group controlId="buyerRejectionReason">
                    <Form.Label>Reason for Cancellation <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                        as="textarea" rows={3} value={reason}
                        onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) setError(''); }}
                        placeholder="Please provide a reason for cancelling this mediation."
                        isInvalid={!!error} disabled={loading} autoFocus
                    />
                    <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={loading}>Back</Button>
                <Button variant="danger" onClick={handleSubmit} disabled={loading || !reason.trim()}>
                    {loading ? <><Spinner size="sm"/> Cancelling...</> : "Confirm Cancellation"}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
export default RejectMediationByBuyerModal;