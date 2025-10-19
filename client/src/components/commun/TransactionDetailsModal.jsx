// src/components/commun/TransactionDetailsModal.jsx

import React, { useCallback } from "react";
import { Modal, Button, Row, Col, Badge, ListGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  FaArrowUp,
  FaArrowDown,
  FaExchangeAlt,
  FaUserCircle,
  FaCalendarAlt,
  FaHashtag,
  FaDollarSign,
  FaInfoCircle,
} from "react-icons/fa";
import { Link } from "react-router-dom";

const TransactionDetailsModal = ({
  show,
  onHide,
  transaction,
  currentUserId,
}) => {
  const { t, i18n } = useTranslation();

  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (isNaN(num)) return "N/A";
      return new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(num);
    },
    [i18n.language]
  );

  if (!transaction) {
    return null;
  }

  const isSender = transaction.sender?._id === currentUserId;
  const isReceiver = transaction.recipient?._id === currentUserId;
  const transactionType = transaction.type || "UNKNOWN";
  let title = t("transactionModal.title");
  let icon = <FaExchangeAlt className="text-muted" />;
  let amountColor = "text-dark";
  let amountPrefix = "";
  let peerUser = null;
  let description = transaction.description || "";

  switch (transactionType) {
    case "TRANSFER":
      if (isSender) {
        title = t("transactionModal.fundsSent");
        icon = <FaArrowUp className="text-danger" />;
        amountColor = "text-danger";
        amountPrefix = "- ";
        peerUser = transaction.recipient;
        description =
          description ||
          t("transactionModal.sentToUser", {
            name: peerUser?.fullName || t("transactionModal.unknownUser"),
          });
      } else if (isReceiver) {
        title = t("transactionModal.fundsReceived");
        icon = <FaArrowDown className="text-success" />;
        amountColor = "text-success";
        amountPrefix = "+ ";
        peerUser = transaction.sender;
        description =
          description ||
          t("transactionModal.receivedFromUser", {
            name: peerUser?.fullName || t("transactionModal.unknownUser"),
          });
      } else {
        title = t("transactionModal.fundTransfer");
        icon = <FaExchangeAlt className="text-primary" />;
        description =
          description ||
          t("transactionModal.transferBetweenUsers", {
            sender: transaction.sender?.fullName || "?",
            recipient: transaction.recipient?.fullName || "?",
          });
      }
      break;
    case "DEPOSIT":
      title = t("transactionModal.deposit");
      icon = <FaArrowDown className="text-success" />;
      amountColor = "text-success";
      amountPrefix = "+ ";
      description = description || t("transactionModal.fundsDeposited");
      break;
    case "WITHDRAWAL":
      title = t("transactionModal.withdrawal");
      icon = <FaArrowUp className="text-danger" />;
      amountColor = "text-danger";
      amountPrefix = "- ";
      description = description || t("transactionModal.fundsWithdrawn");
      break;
    default:
      title = t("transactionModal.genericTitle", { type: transactionType });
      if (transaction.amount < 0) {
        icon = <FaArrowUp className="text-warning" />;
        amountColor = "text-warning";
      } else {
        icon = <FaArrowDown className="text-info" />;
        amountColor = "text-info";
      }
      break;
  }

  if (!description) {
    description = t("transactionModal.unspecifiedDetails");
  }

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <span className="modal-icon-wrapper me-2">{icon}</span>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={6} className="mb-3 mb-md-0">
            <h5 className="mb-3 text-muted fw-light">
              {t("transactionModal.summary")}
            </h5>
            <ListGroup variant="flush">
              <ListGroup.Item className="px-0 py-2">
                <Row>
                  <Col xs={4} sm={3} className="text-muted small">
                    {t("transactionModal.statusLabel")}
                  </Col>
                  <Col xs={8} sm={9}>
                    <Badge
                      pill
                      bg={
                        transaction.status === "COMPLETED"
                          ? "success"
                          : transaction.status === "PENDING"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {t(`transactionStatuses.${transaction.status}`, {
                        defaultValue:
                          transaction.status ||
                          t("transactionModal.statusUnknown"),
                      })}
                    </Badge>
                  </Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-2">
                <Row>
                  <Col xs={4} sm={3} className="text-muted small">
                    {t("transactionModal.amountLabel")}
                  </Col>
                  <Col xs={8} sm={9} className={`fw-bold fs-5 ${amountColor}`}>
                    {amountPrefix}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-2">
                <Row>
                  <Col xs={4} sm={3} className="text-muted small">
                    {t("transactionModal.dateLabel")}
                  </Col>
                  <Col xs={8} sm={9}>
                    {transaction.createdAt
                      ? new Date(transaction.createdAt).toLocaleString(
                          i18n.language
                        )
                      : "N/A"}
                  </Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item className="px-0 py-2">
                <Row>
                  <Col xs={4} sm={3} className="text-muted small">
                    {t("transactionModal.idLabel")}
                  </Col>
                  <Col xs={8} sm={9}>
                    <code className="small user-select-all">
                      {transaction._id || "N/A"}
                    </code>
                  </Col>
                </Row>
              </ListGroup.Item>
            </ListGroup>
          </Col>

          <Col md={6}>
            <h5 className="mb-3 text-muted fw-light">
              {t("transactionModal.details")}
            </h5>
            <ListGroup variant="flush">
              {transaction.sender && (
                <ListGroup.Item className="px-0 py-2 d-flex align-items-center">
                  <FaArrowUp className="me-2 text-danger opacity-75 flex-shrink-0" />
                  <div className="w-100">
                    <span className="text-muted small d-block">
                      {t("transactionModal.senderLabel")}
                    </span>
                    {isSender ? (
                      <strong>{t("transactionModal.you")}</strong>
                    ) : transaction.sender._id ? (
                      <Link
                        to={`/profile/${transaction.sender._id}`}
                        onClick={onHide}
                        className="fw-medium text-decoration-none profile-link"
                      >
                        {transaction.sender.fullName ||
                          t("transactionModal.unknownUser")}
                      </Link>
                    ) : (
                      <span>
                        {transaction.sender.fullName ||
                          t("transactionModal.unknownUser")}
                      </span>
                    )}
                    {transaction.sender.email && (
                      <small className="d-block text-muted">
                        {transaction.sender.email}
                      </small>
                    )}
                  </div>
                </ListGroup.Item>
              )}
              {transaction.recipient && (
                <ListGroup.Item className="px-0 py-2 d-flex align-items-center">
                  <FaArrowDown className="me-2 text-success opacity-75 flex-shrink-0" />
                  <div className="w-100">
                    <span className="text-muted small d-block">
                      {t("transactionModal.recipientLabel")}
                    </span>
                    {isReceiver ? (
                      <strong>{t("transactionModal.you")}</strong>
                    ) : transaction.recipient._id ? (
                      <Link
                        to={`/profile/${transaction.recipient._id}`}
                        onClick={onHide}
                        className="fw-medium text-decoration-none profile-link"
                      >
                        {transaction.recipient.fullName ||
                          t("transactionModal.unknownUser")}
                      </Link>
                    ) : (
                      <span>
                        {transaction.recipient.fullName ||
                          t("transactionModal.unknownUser")}
                      </span>
                    )}
                    {transaction.recipient.email && (
                      <small className="d-block text-muted">
                        {transaction.recipient.email}
                      </small>
                    )}
                  </div>
                </ListGroup.Item>
              )}
              <ListGroup.Item className="px-0 py-2 d-flex align-items-start">
                <FaInfoCircle className="me-2 text-info opacity-75 flex-shrink-0 mt-1" />
                <div>
                  <span className="text-muted small d-block">
                    {t("transactionModal.descriptionLabel")}
                  </span>
                  {/* [!!!] START: تعديل الترجمة [!!!] */}
                  {transaction.descriptionKey
                    ? t(
                        transaction.descriptionKey,
                        transaction.descriptionParams
                      )
                    : description}
                  {/* [!!!] END: نهاية التعديل [!!!] */}
                </div>
              </ListGroup.Item>
            </ListGroup>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          {t("transactionModal.closeButton")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TransactionDetailsModal;