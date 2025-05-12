// src/components/vendor/SelectMediatorModal.jsx
import React from "react";
import {
  Modal,
  Button,
  Card,
  Row,
  Col,
  Image,
  Badge,
  Spinner,
  Alert,
} from "react-bootstrap";
import {
  FaUserCircle,
  FaStar,
  FaCheckCircle,
  FaExclamationTriangle,
  FaRedo,
} from "react-icons/fa"; // FaRedo for refresh

const noMediatorImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24px" fill="%23aaaaaa">?</text></svg>';

const MediatorCard = ({ mediator, onSelect, isSelected, loadingSelection }) => {
      console.log("MediatorCard - received mediator:", mediator);
  if (!mediator) return null;
  const calculatedRating = mediator.calculatedRating;
  return (
    <Card
      className={`mb-3 mediator-card shadow-sm ${
        isSelected ? "border-primary" : ""
      }`}
    >
      <Card.Body>
        <Row className="align-items-center">
          <Col xs="auto">
            <Image
              src={mediator.image || noMediatorImageUrl}
              roundedCircle
              style={{ width: "50px", height: "50px", objectFit: "cover" }}
              alt={mediator.name}
              onError={(e) => {
                e.target.src = noMediatorImageUrl;
              }}
            />
          </Col>
          <Col>
            <h6 className="mb-0">{mediator.fullName || "N/A"}</h6>
            <small className="text-muted">
              Level: {mediator.level || "N/A"} | Rep: {mediator.reputation || 0}{" "}
              pts
            </small>
            <div>
<FaStar className="text-warning me-1" /> {calculatedRating != null ? calculatedRating.toFixed(1) : "0.0"}

              <FaCheckCircle className="text-success ms-2 me-1" />{" "}
              {mediator.successfulMediations || 0} successful
            </div>
          </Col>
<Col xs="auto">
    <Button
        variant="outline-primary"
        size="sm"
        onClick={() => {
            console.log("Select button clicked for mediator:", mediator); // للتأكد من أن الوسيط صحيح
            if (mediator && mediator._id) {
                onSelect(mediator._id); // تأكد من أن onSelect هي onSelectMediator
            } else {
                console.error("Mediator ID is missing for selection.");
            }
        }}
        disabled={loadingSelection || mediator.mediatorStatus !== 'Available'}
    >
              {loadingSelection && isSelected ? (
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />
              ) : (
                "Select"
              )}
              {mediator.mediatorStatus !== "Available" && (
                <small className="d-block text-danger">
                  ({mediator.mediatorStatus})
                </small>
              )}
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

const SelectMediatorModal = ({
  show,
  onHide,
  product,
  availableMediators = [],
  loading,
  onSelectMediator,
  onRequestNewSuggestions,
  suggestionsUsedOnce,
}) => {
  if (!product) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Select a Mediator for "{product.title}"</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading &&
          (!availableMediators || availableMediators.length === 0) && (
            <div className="text-center my-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Loading available mediators...</p>
            </div>
          )}

        {!loading && availableMediators && availableMediators.length === 0 && (
          <Alert variant="warning" className="text-center">
            <FaExclamationTriangle className="me-2" />
            No available mediators found matching the criteria. You might try
            requesting new suggestions or check back later.
          </Alert>
        )}

        {availableMediators && availableMediators.length > 0 && (
          <>
            <p>
              Please choose one of the following mediators for your transaction.
              You can request new suggestions once.
            </p>
            {availableMediators.map((mediator) => (
              <MediatorCard
                key={mediator._id}
                mediator={mediator}
                onSelect={onSelectMediator}
                isSelected={false} // Add logic if you want to highlight selection before confirm
                loadingSelection={loading && false} // Add logic for individual selection loading
              />
            ))}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <Button
          variant="outline-secondary"
          onClick={onRequestNewSuggestions}
          disabled={
            loading ||
            suggestionsUsedOnce ||
            (availableMediators && availableMediators.length === 0)
          }
        >
          <FaRedo className="me-1" /> Request New Suggestions{" "}
          {suggestionsUsedOnce && "(Used)"}
        </Button>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SelectMediatorModal;
