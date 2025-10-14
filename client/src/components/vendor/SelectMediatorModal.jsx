// src/components/vendor/SelectMediatorModal.jsx
import {
  Modal,
  Button,
  Card,
  Row,
  Col,
  Image,
  Spinner,
  Alert,
} from "react-bootstrap";
import React, { useMemo } from "react";
import {
  FaStar,
  FaCheckCircle,
  FaExclamationTriangle,
  FaRedo,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const noMediatorImageUrl = "https://bootdey.com/img/Content/avatar/avatar7.png";

// --- أضف BACKEND_URL هنا ---
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const MediatorCard = ({ mediator, onSelect, isSelected, loadingSelection }) => {
  const { t } = useTranslation();
  console.log("MediatorCard - received mediator:", mediator);
  const calculatedRating = mediator.calculatedRating;

  // --- بناء رابط الصورة بشكل صحيح ---
  const mediatorAvatarSrc = useMemo(() => {
    if (mediator?.avatarUrl) {
      if (mediator.avatarUrl.startsWith("http")) {
        // إذا كان الرابط كاملاً بالفعل
        return mediator.avatarUrl;
      }
      return `${BACKEND_URL}/${mediator.avatarUrl}`; // افترض أنه مسار نسبي
    }
    return noMediatorImageUrl; // صورة افتراضية إذا لم يكن هناك avatarUrl
  }, [mediator?.avatarUrl]);

  if (!mediator) return null;

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
              src={mediatorAvatarSrc || noMediatorImageUrl}
              roundedCircle
              style={{ width: "50px", height: "50px", objectFit: "cover" }}
              alt={mediator.name}
              onError={(e) => {
                e.target.src = noMediatorImageUrl;
              }}
            />
          </Col>
          <Col>
            <Link
              to={`/profile/${mediator._id}`}
              target="_blank" // يفتح في تبويب جديد (اختياري)
              rel="noopener noreferrer" // للأمان عند استخدام target="_blank"
              style={{ textDecoration: "none", color: "inherit" }} // لإزالة التسطير الافتراضي للرابط
            >
              <h6 className="mb-0 mediator-name-link">
                {mediator.fullName || "N/A"}
              </h6>
            </Link>
            <small className="text-muted">
              {t("selectMediatorModal.level", "Level")}:{" "}
              {mediator.level || "N/A"} |{" "}
              {t("selectMediatorModal.reputation", "Rep")}:
              {mediator.reputationPoints || 0} {/* استخدام reputationPoints */}
              {t("selectMediatorModal.points", "pts")}
            </small>
            <div>
              <FaStar className="text-warning me-1" />
              {/* --- التعديل هنا --- */}
              {typeof calculatedRating === "number"
                ? calculatedRating.toFixed(1)
                : "0.0"}
              {/* إذا كان الرقم موجوداً، قم بتنسيقه، وإلا اعرض 0.0 */}
              {/* -------------------- */}
              <FaCheckCircle className="text-success ms-2 me-1" />
              {mediator.successfulMediationsCount || 0}{" "}
              {t("selectMediatorModal.successful", "successful")}
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
              disabled={
                loadingSelection || mediator.mediatorStatus !== "Available"
              }
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
                t("selectMediatorModal.select", "Select")
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
  const { t } = useTranslation();
  if (!product) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          {t(
            "selectMediatorModal.title",
            'Select a Mediator for "{{productTitle}}"',
            { productTitle: product.title }
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading &&
          (!availableMediators || availableMediators.length === 0) && (
            <div className="text-center my-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">
                {t(
                  "selectMediatorModal.loading",
                  "Loading available mediators..."
                )}
              </p>
            </div>
          )}

        {!loading && availableMediators && availableMediators.length === 0 && (
          <Alert variant="warning" className="text-center">
            <FaExclamationTriangle className="me-2" />
            {t(
              "selectMediatorModal.noMediators",
              "No available mediators found matching the criteria. You might try requesting new suggestions or check back later."
            )}
          </Alert>
        )}

        {availableMediators && availableMediators.length > 0 && (
          <>
            <p>
              {t(
                "selectMediatorModal.description",
                "Please choose one of the following mediators for your transaction. You can request new suggestions once."
              )}
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
          <FaRedo className="me-1" />{" "}
          {t("selectMediatorModal.newSuggestions", "Request New Suggestions")}
          {suggestionsUsedOnce && `(${t("selectMediatorModal.used", "Used")})`}
        </Button>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          {t("common.cancel", "Cancel")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SelectMediatorModal;