// client/src/pages/ViewMediationDetailsModal.jsx (أو المسار الذي تستخدمه)
import React from "react";
import {
  Modal,
  Button,
  Badge,
  Row,
  Col,
  ListGroup,
  Image,
  Card,
  Accordion,
} from "react-bootstrap";
import {
  FaUserCircle,
  FaShoppingBag,
  FaBalanceScale,
  FaFileInvoiceDollar,
  FaShieldAlt,
  FaCalendarAlt,
  FaHistory,
  FaInfoCircle,
  FaUsers,
  FaRegClock,
  FaUserCog,
  FaMoneyBillWave,
  FaCommentDots,
  FaCheckCircle,
  FaTimesCircle,
  FaPiggyBank,
  FaUserShield,
  FaFileAlt,
} from "react-icons/fa";
import { BsArrowRepeat } from "react-icons/bs";
import './ViewMediationDetailsModal.css';

// دالة تنسيق العملة مع toFixed(2)
const formatCurrencyForHistory = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null)
    return <span className="text-muted">N/A</span>; // عرض N/A كـ span إذا أردت

  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND"; // عملة افتراضية
  }

  try {
    return num.toLocaleString("fr-TN", {
      // يمكنك تغيير 'fr-TN' إلى 'en-US' أو ما تفضله
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2, // ضمان رقمين عشريين فقط
    });
  } catch (error) {
    // في حالة خطأ في رمز العملة، اعرض القيمة مع رمز العملة الافتراضي أو المُمرر
    console.warn(
      `Currency formatting error for code '${safeCurrencyCode}'. Using fallback. Error:`,
      error
    );
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";

const ViewMediationDetailsModal = ({
  show,
  onHide,
  request,
  currentUserId,
}) => {
  // افترض أن currentUserId يتم تمريره
  if (!request) {
    return null;
  }

  const getStatusBadgeBg = (status) => {
    const lowerStatus = status?.toLowerCase();
    if (lowerStatus?.includes("progress")) return "success";
    if (lowerStatus?.includes("completed")) return "dark";
    if (lowerStatus?.includes("cancelled") || lowerStatus?.includes("rejected"))
      return "danger";
    if (lowerStatus?.includes("pending") || lowerStatus?.includes("assigned"))
      return "info";
    if (
      lowerStatus?.includes("accepted") ||
      lowerStatus?.includes("funded") ||
      lowerStatus?.includes("confirmed")
    )
      return "primary";
    return "secondary";
  };

  const renderParticipant = (participant, roleLabel) => {
    if (!participant)
      return (
        <ListGroup.Item className="d-flex align-items-center border-0 px-0 py-2 participant-item">
          <Image
            src={noUserAvatar}
            roundedCircle
            width={40}
            height={40}
            className="me-3 participant-avatar shadow-sm"
          />
          <div>
            <span className="fw-bold text-muted">N/A</span>
            <small className="d-block text-muted">{roleLabel}</small>
          </div>
        </ListGroup.Item>
      );

    const avatar = participant.avatarUrl
      ? participant.avatarUrl.startsWith("http")
        ? participant.avatarUrl
        : `${BACKEND_URL}/${participant.avatarUrl}`
      : noUserAvatar;

    const isCurrentUserParticipant =
      currentUserId === participant._id?.toString();

    return (
      <ListGroup.Item
        className={`d-flex align-items-center border-0 px-0 py-2 participant-item ${
          isCurrentUserParticipant ? "current-user-participant" : ""
        }`}
      >
        <Image
          src={avatar}
          roundedCircle
          width={40}
          height={40}
          className="me-3 participant-avatar shadow-sm"
          onError={(e) => (e.target.src = noUserAvatar)}
        />
        <div>
          <span
            className={`fw-bold ${
              isCurrentUserParticipant ? "text-primary" : ""
            }`}
          >
            {participant.fullName || "User"}
            {isCurrentUserParticipant && "(You)"}
          </span>
          <small className="d-block text-muted">{roleLabel}</small>
        </div>
      </ListGroup.Item>
    );
  };

  const getHistoryEventIcon = (eventText = "") => {
    const text = eventText.toLowerCase();
    if (
      text.includes("receipt") ||
      text.includes("funds processed") ||
      text.includes("escrowed") ||
      text.includes("paid")
    )
      return <FaMoneyBillWave className="text-success me-2" />;
    if (
      text.includes("confirmed readiness") ||
      (text.includes("confirmed") && !text.includes("chat"))
    )
      return <FaCheckCircle className="text-primary me-2" />;
    if (text.includes("chat initiated") || text.includes("message"))
      return <FaCommentDots className="text-info me-2" />;
    if (text.includes("selected mediator") || text.includes("assigned"))
      return <FaUserCog className="text-dark me-2" />; // Darker for assignment
    if (
      text.includes("status changed") ||
      text.includes("updated") ||
      text.includes("status set")
    )
      return <BsArrowRepeat className="text-warning me-2" />;
    if (text.includes("rejected") || text.includes("cancelled"))
      return <FaTimesCircle className="text-danger me-2" />;
    return <FaFileAlt className="text-secondary me-2" />;
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="mediation-details-modal-custom"
    >
      <Modal.Header closeButton className="bg-light border-bottom-0">
        <Modal.Title className="text-primary fw-bold d-flex align-items-center">
          <FaInfoCircle size={24} className="me-2" />
          <span>
            Mediation Details:
            <span className="text-dark fw-normal">
              {request.product?.title || "N/A"}
            </span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <Row className="g-4">
          <Col md={7} className="mb-3 mb-md-0">
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-secondary text-white rounded-top">
                <FaShoppingBag className="me-2" /> Transaction Overview
              </Card.Header>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <FaFileInvoiceDollar className="me-2 text-muted" />
                  <strong>Transaction ID:</strong> <br />
                  <small className="text-monospace user-select-all text-break">
                    {request._id || "N/A"}
                  </small>
                </ListGroup.Item>
                <ListGroup.Item>
                  <FaShieldAlt className="me-2 text-muted" />
                  <strong>Status:</strong>
                  <Badge
                    bg={getStatusBadgeBg(request.status)}
                    className="ms-1"
                    text={
                      getStatusBadgeBg(request.status) === "warning" ||
                      getStatusBadgeBg(request.status) === "info" ||
                      getStatusBadgeBg(request.status) === "secondary"
                        ? "dark"
                        : "light"
                    }
                  >
                    {request.status
                      ? request.status.replace(/([A-Z])/g, " $1").trim()
                      : "Unknown"}
                  </Badge>
                </ListGroup.Item>
                <ListGroup.Item>
                  <FaBalanceScale className="me-2 text-muted" />
                  <strong>Agreed Price:</strong>
                  <span className="fw-bold">
                    {formatCurrencyForHistory(
                      request.bidAmount,
                      request.bidCurrency
                    )}
                  </span>
                </ListGroup.Item>
                {request.escrowedAmount > 0 && (
                  <ListGroup.Item>
                    <FaPiggyBank className="me-2 text-muted" />
                    <strong>Amount in Escrow:</strong>
                    <span className="fw-bold">
                      {formatCurrencyForHistory(
                        request.escrowedAmount,
                        request.escrowedCurrency
                      )}
                    </span>
                  </ListGroup.Item>
                )}
                {request.calculatedMediatorFee > 0 && (
                  <ListGroup.Item>
                    <FaUserShield className="me-2 text-muted" />
                    <strong>Calculated Mediator Fee:</strong>
                    <span className="fw-bold">
                      {formatCurrencyForHistory(
                        request.calculatedMediatorFee,
                        request.mediationFeeCurrency
                      )}
                    </span>
                  </ListGroup.Item>
                )}
                {request.calculatedBuyerFeeShare > 0 && (
                  <ListGroup.Item>
                    <small className="text-muted">
                      (Your Fee Share if Buyer):
                    </small>
                    <span className="fw-bold">
                      {formatCurrencyForHistory(
                        request.calculatedBuyerFeeShare,
                        request.mediationFeeCurrency
                      )}
                    </span>
                  </ListGroup.Item>
                )}
                <ListGroup.Item>
                  <FaCalendarAlt className="me-2 text-muted" />
                  <strong>Last Updated:</strong>
                  {new Date(
                    request.updatedAt || request.createdAt
                  ).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </ListGroup.Item>
              </ListGroup>
            </Card>
          </Col>

          <Col md={5}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-info text-white rounded-top">
                <FaUsers className="me-2" /> Participants
              </Card.Header>
              <ListGroup variant="flush" className="p-3">
                {renderParticipant(request.seller, "Seller")}
                {renderParticipant(request.buyer, "Buyer")}
                {renderParticipant(request.mediator, "Mediator")}
              </ListGroup>
            </Card>
          </Col>
        </Row>

        {request.history && request.history.length > 0 && (
          <Accordion
            defaultActiveKey="0"
            className="mt-4 shadow-sm border-0 mediation-history-accordion"
          >
            <Accordion.Item eventKey="0" className="border-0">
              <Accordion.Header>
                <FaHistory className="me-2 text-primary" /> Transaction History
                ({request.history.length} Entries)
              </Accordion.Header>
              <Accordion.Body className="p-0">
                <ListGroup
                  variant="flush"
                  style={{
                    maxHeight: "280px",
                    overflowY: "auto",
                    fontSize: "0.875rem",
                  }}
                  className="history-list-group"
                >
                  {request.history
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <ListGroup.Item
                        key={index}
                        className="py-2 px-3 history-entry-item"
                      >
                        <div className="d-flex align-items-start mb-1">
                          <span className="history-event-icon me-2 align-self-center pt-1">
                            {getHistoryEventIcon(entry.event)}
                          </span>
                          <div className="flex-grow-1">
                            <strong className="history-event-name d-block">
                              {entry.event}
                            </strong>
                            <small className="text-muted history-event-timestamp">
                              <FaRegClock className="me-1" />
                              {new Date(entry.timestamp).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                              {" at "}
                              {new Date(entry.timestamp).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                }
                              )}
                            </small>
                          </div>
                        </div>
                        {entry.details &&
                          typeof entry.details === "object" &&
                          Object.keys(entry.details).length > 0 && (
                            <Card className="mt-1 mb-1 ms-4 bg-light border-dashed shadow-sm history-details-card">
                              <Card.Body className="p-2">
                                {Object.entries(entry.details).map(
                                  ([key, value]) => {
                                    let formattedValue = String(value);
                                    const keyLower = key.toLowerCase();

                                    if (
                                      keyLower.includes("amount") ||
                                      keyLower.includes("fee") ||
                                      keyLower.includes("price") ||
                                      keyLower.includes("balance")
                                    ) {
                                      const currencyDetailKey = Object.keys(
                                        entry.details
                                      ).find(
                                        (k) =>
                                          k
                                            .toLowerCase()
                                            .includes("currency") &&
                                          (keyLower.startsWith(
                                            k
                                              .toLowerCase()
                                              .replace("currency", "")
                                              .trim()
                                          ) ||
                                            k
                                              .toLowerCase()
                                              .startsWith(
                                                keyLower
                                                  .replace("amount", "")
                                                  .replace("fee", "")
                                                  .replace("price", "")
                                                  .trim()
                                              ))
                                      );
                                      const currency = currencyDetailKey
                                        ? entry.details[currencyDetailKey]
                                        : request.bidCurrency || "USD";
                                      if (
                                        typeof value === "number" ||
                                        !isNaN(Number(value))
                                      ) {
                                        formattedValue =
                                          formatCurrencyForHistory(
                                            Number(value),
                                            currency
                                          );
                                      }
                                    } else if (
                                      keyLower.includes("status") &&
                                      typeof value === "string"
                                    ) {
                                      formattedValue = (
                                        <Badge
                                          bg={getStatusBadgeBg(value)}
                                          text={
                                            getStatusBadgeBg(value) ===
                                              "warning" ||
                                            getStatusBadgeBg(value) ===
                                              "info" ||
                                            getStatusBadgeBg(value) ===
                                              "secondary"
                                              ? "dark"
                                              : "light"
                                          }
                                        >
                                          {value
                                            .replace(/([A-Z])/g, " $1")
                                            .trim()}
                                        </Badge>
                                      );
                                    } else if (typeof value === "boolean") {
                                      formattedValue = value ? (
                                        <FaCheckCircle className="text-success" />
                                      ) : (
                                        <FaTimesCircle className="text-danger" />
                                      );
                                    }

                                    return (
                                      <div
                                        key={key}
                                        className="detail-item d-flex justify-content-between"
                                      >
                                        <span className="text-muted detail-key">
                                          <em>
                                            {key
                                              .replace(/([A-Z])/g, " $1")
                                              .trim()}
                                            :
                                          </em>
                                        </span>
                                        <span className="ms-1 detail-value text-end">
                                          {formattedValue}
                                        </span>
                                      </div>
                                    );
                                  }
                                )}
                              </Card.Body>
                            </Card>
                          )}
                      </ListGroup.Item>
                    ))}
                </ListGroup>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        )}
      </Modal.Body>
      <Modal.Footer className="border-top-0 bg-light pt-2 pb-2">
        <Button variant="outline-secondary" onClick={onHide} size="sm">
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ViewMediationDetailsModal;
