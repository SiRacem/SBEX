// src/components/commun/TransactionDetailsProduct.jsx
import React from "react";
import { Modal, Button, Table, Badge } from "react-bootstrap";
import { format } from "date-fns";
import {
  FaCalendarAlt,
  FaTag,
  FaUser,
  FaDollarSign,
  FaInfoCircle,
  FaReceipt,
  FaProductHunt,
  FaLink,
  FaExchangeAlt,
  FaExternalLinkAlt,
  FaCommentDots,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay";

const TransactionDetailsProduct = ({ show, onHide, transaction }) => {
  const { t, i18n } = useTranslation();
  const amountDisplay = useCurrencyDisplay(transaction?.amount);

  if (!transaction) {
    return null;
  }

  const translateKey = (prefix, key) => {
    if (!key) return "N/A";
    const defaultValue = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    return t(`${prefix}.${key}`, defaultValue);
  };

  const renderDetailRow = (translationKey, value, icon = <FaInfoCircle />) => (
    <tr>
      <td style={{ width: "35%" }} className="fw-bold align-middle">
        <div className="d-flex align-items-center">
          {/* [!] هذا هو المهم. نستخدم me-2 كالمعتاد */}
          {React.cloneElement(icon, { className: "me-2 text-primary" })}
          <span>{t(translationKey)}</span>
        </div>
      </td>
      <td className="align-middle">{value || "N/A"}</td>
    </tr>
  );

  return (
    <Modal show={show} onHide={onHide} size="lg" centered dir={i18n.dir()}>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <FaReceipt className="me-2" />
          {t("transactionModal.title")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <Table
          striped
          hover
          responsive="sm"
          className="transaction-details-table"
        >
          <tbody>
            {renderDetailRow(
              "transactionModal.transactionId",
              <span className="user-select-all">{transaction._id}</span>,
              <FaInfoCircle />
            )}

            {renderDetailRow(
              "transactionModal.type",
              <Badge bg="info" pill>
                {translateKey("transactionTypes", transaction.type)}
              </Badge>,
              <FaTag />
            )}

            {renderDetailRow(
              "transactionModal.status",
              <Badge
                bg={transaction.status === "COMPLETED" ? "success" : "warning"}
                pill
              >
                {translateKey("transactionStatuses", transaction.status)}
              </Badge>,
              <FaInfoCircle />
            )}

            {renderDetailRow(
              "transactionModal.date",
              transaction.createdAt
                ? format(new Date(transaction.createdAt), "PPpp")
                : "N/A",
              <FaCalendarAlt />
            )}

            {transaction.relatedProduct &&
              renderDetailRow(
                "transactionModal.product",
                transaction.relatedProduct.title ||
                  transaction.metadata?.productTitle,
                <FaProductHunt />
              )}

            {renderDetailRow(
              `transactionTypes.${transaction.type}`,
              <strong
                className={
                  transaction.amount >= 0 ? "text-success" : "text-danger"
                }
              >
                {transaction.amount >= 0 ? "+" : "-"}{" "}
                {amountDisplay.displayValue}
              </strong>,
              <FaDollarSign />
            )}

            {transaction.description &&
              renderDetailRow(
                "transactionModal.description",
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {transaction.description}
                </span>,
                <FaCommentDots />
              )}

            {transaction.relatedMediationRequest?._id &&
              renderDetailRow(
                "transactionModal.mediationLink",
                <Button
                  as={Link}
                  to={`/dashboard/mediation-chat/${transaction.relatedMediationRequest._id}`}
                  variant="outline-primary"
                  size="sm"
                  className="d-inline-flex align-items-center"
                >
                  <span className="me-1">
                    {t("transactionModal.viewMediation")}
                  </span>
                  <FaExternalLinkAlt size="0.8em" />
                </Button>,
                <FaExchangeAlt />
              )}
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {t("transactionModal.close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TransactionDetailsProduct;
