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
  FaPaperPlane,
  FaInbox,
  FaExternalLinkAlt,
  FaGift,
} from "react-icons/fa";
import { Link } from "react-router-dom"; // إذا أردت روابط

// دالة تنسيق العملة (يمكن استيرادها إذا كانت في ملف utils مشترك)
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "")
    safeCurrencyCode = "TND";
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const TransactionDetailsProduct = ({ show, onHide, transaction }) => {
  if (!transaction) {
    return null;
  }

  const renderDetailRow = (label, value, icon = <FaInfoCircle />) => (
    <tr>
      <td style={{ width: "35%" }} className="fw-bold">
        {React.cloneElement(icon, { className: "me-2 text-primary" })} {label}
      </td>
      <td>{value || "N/A"}</td>
    </tr>
  );

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaReceipt className="me-2" /> Transaction Details
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <Table
          striped
          bordered
          hover
          responsive="sm"
          className="transaction-details-table"
        >
          <tbody>
            {renderDetailRow("Transaction ID", transaction._id)}
            {renderDetailRow(
              "Type",
              <Badge bg="info" pill>
                {transaction.type?.replace(/_/g, " ") || "N/A"}
              </Badge>,
              <FaTag />
            )}
            {renderDetailRow(
              "Status",
              <Badge
                bg={
                  transaction.status === "COMPLETED" ||
                  transaction.status === "ON_HOLD"
                    ? "success"
                    : "warning"
                }
                pill
              >
                {transaction.status || "N/A"}
              </Badge>,
              <FaInfoCircle />
            )}
            {renderDetailRow(
              "Date",
              transaction.createdAt
                ? format(new Date(transaction.createdAt), "PPpp")
                : "N/A",
              <FaCalendarAlt />
            )}

            {transaction.type === "PRODUCT_SALE_FUNDS_PENDING" && (
              <>
                {renderDetailRow(
                  "Product",
                  transaction.relatedProduct?.title ||
                    transaction.metadata?.productTitle,
                  <FaProductHunt />
                )}
                {renderDetailRow(
                  "Buyer",
                  transaction.metadata?.buyerName || "N/A",
                  <FaUser />
                )}
                {renderDetailRow(
                  "Amount (On Hold)",
                  formatCurrency(transaction.amount, transaction.currency),
                  <FaDollarSign />
                )}
              </>
            )}
            {transaction.type === "PRODUCT_SALE_FUNDS_RELEASED" && (
              <>
                {renderDetailRow(
                  "Product",
                  transaction.relatedProduct?.title ||
                    transaction.metadata?.productTitle,
                  <FaProductHunt />
                )}
                {renderDetailRow(
                  "Amount Released",
                  formatCurrency(transaction.amount, transaction.currency),
                  <FaDollarSign />
                )}
              </>
            )}
            {transaction.type === "PRODUCT_PURCHASE_COMPLETED" && (
              <>
                {renderDetailRow(
                  "Product",
                  transaction.relatedProduct?.title ||
                    transaction.metadata?.productTitle,
                  <FaProductHunt />
                )}
                {transaction.recipient &&
                  renderDetailRow(
                    "Seller",
                    transaction.recipient.fullName || "N/A",
                    <FaUser />
                  )}
                {renderDetailRow(
                  "Amount Paid",
                  formatCurrency(transaction.amount, transaction.currency),
                  <FaDollarSign />
                )}
              </>
            )}
            {transaction.type === "MEDIATION_FEE_RECEIVED" && (
              <>
                {renderDetailRow(
                  "Related Mediation",
                  transaction.relatedMediationRequest?._id
                    ?.toString()
                    .slice(-8) || "N/A",
                  <FaLink />
                )}
                {renderDetailRow(
                  "Fee Amount",
                  formatCurrency(transaction.amount, transaction.currency),
                  <FaDollarSign />
                )}
              </>
            )}
            {transaction.type === "LEVEL_UP_REWARD_RECEIVED" && (
              <>
                {renderDetailRow(
                  "Reward For",
                  `Reaching Level ${transaction.metadata?.levelAchieved || ""}`,
                  <FaGift />
                )}
                {renderDetailRow(
                  "Reward Amount",
                  formatCurrency(transaction.amount, transaction.currency),
                  <FaDollarSign />
                )}
              </>
            )}
            {transaction.type === "TRANSFER_SENT" &&
              transaction.recipient &&
              renderDetailRow(
                "Sent To",
                transaction.recipient.fullName ||
                  transaction.recipient.email ||
                  "N/A",
                <FaPaperPlane />
              )}
            {transaction.type === "TRANSFER_RECEIVED" &&
              transaction.sender &&
              renderDetailRow(
                "Received From",
                transaction.sender.fullName ||
                  transaction.sender.email ||
                  "N/A",
                <FaInbox />
              )}
            {/* يمكنك إضافة المزيد من الحالات لأنواع معاملات أخرى */}

            {transaction.description &&
              renderDetailRow("Description", transaction.description)}
            {transaction.relatedMediationRequest?._id &&
              renderDetailRow(
                "Mediation Link",
                <Link
                  to={`/dashboard/mediation-chat/${transaction.relatedMediationRequest._id}`}
                >
                  View Mediation <FaExternalLinkAlt size="0.8em" />
                </Link>,
                <FaExchangeAlt />
              )}
          </tbody>
        </Table>
        {transaction.notes && (
          <>
            <h6>Additional Notes:</h6>
            <p>{transaction.notes}</p>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TransactionDetailsProduct;
