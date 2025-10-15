// src/components/vendor/MediationDetailsModal.jsx
import React from "react";
import {
  Modal,
  Button,
  Row,
  Col,
  Image,
  ListGroup,
  Badge,
} from "react-bootstrap";
import { FaCheck } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const formatCurrencyLocal = (amount, currencyCode = "TND", i18nInstance) => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  try {
    return num.toLocaleString(i18nInstance.language, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${currencyCode}`;
  }
};

const noProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">No Image</text></svg>';

// [!!!] START: إضافة دالة ترجمة الحالات [!!!]
const getStatusBadge = (status, t) => {
  let text = status;
  let bg = "secondary";
  const key = `mediationStatuses.${status}`;
  const translatedText = t(key);

  // إذا كانت الترجمة موجودة، استخدمها
  if (translatedText !== key) {
    text = translatedText;
  } else {
    // قيمة احتياطية إذا لم تكن الترجمة موجودة
    text = status.replace(/([A-Z])/g, " $1").trim();
  }

  switch (status) {
    case "PendingMediatorSelection":
      bg = "info text-dark";
      break;
    case "MediatorAssigned":
      bg = "primary";
      break;
    case "MediationOfferAccepted":
      bg = "warning text-dark";
      break;
    case "EscrowFunded":
      bg = "info";
      break;
    case "PartiesConfirmed":
      bg = "info";
      break;
    case "InProgress":
      bg = "success";
      break;
    case "Completed":
      bg = "dark";
      break;
    case "Disputed":
      bg = "danger";
      break;
    case "Cancelled":
      bg = "secondary";
      break;
    default:
      bg = "secondary";
  }
  return { text, bg };
};
// [!!!] END: نهاية إضافة الدالة [!!!]

const MediationDetailsModal = ({ show, onHide, product, calculateFee }) => {
  const { t, i18n } = useTranslation();

  if (!product) return null;

  const mediationRequest = product.currentMediationRequest;
  const mediatorInfo = mediationRequest?.mediator;

  let agreedPrice = product.agreedPrice;
  if (
    agreedPrice == null &&
    mediationRequest &&
    mediationRequest.bidAmount != null
  ) {
    agreedPrice = mediationRequest.bidAmount;
  } else if (agreedPrice == null && product.bids && product.bids.length > 0) {
    const sortedBids = [...product.bids].sort((a, b) => b.amount - a.amount);
    agreedPrice = sortedBids[0].amount;
  }

  const feeDetails =
    agreedPrice != null && calculateFee
      ? calculateFee(
          agreedPrice,
          product.currency || mediationRequest?.bidCurrency || "TND"
        )
      : {
          fee: 0,
          sellerShare: 0,
          buyerShare: 0,
          totalForBuyer: agreedPrice || 0,
          netForSeller: agreedPrice || 0,
          error: t(
            "mediationDetailsModal.feeError",
            "Price or fee function missing"
          ),
        };

  let buyerInfo = null;
  if (
    product.buyer &&
    typeof product.buyer === "object" &&
    product.buyer.fullName
  ) {
    buyerInfo = product.buyer;
  } else if (
    mediationRequest &&
    mediationRequest.buyer &&
    typeof mediationRequest.buyer === "object" &&
    mediationRequest.buyer.fullName
  ) {
    buyerInfo = mediationRequest.buyer;
  } else if (product.buyer) {
    buyerInfo = {
      _id: product.buyer,
      fullName: t("mediationDetailsModal.buyerIdOnly", "Buyer (ID only)"),
    };
  } else if (mediationRequest && mediationRequest.buyer) {
    buyerInfo = {
      _id: mediationRequest.buyer,
      fullName: t("mediationDetailsModal.buyerIdOnly", "Buyer (ID only)"),
    };
  }

  // [!!!] START: استخدام دالة ترجمة الحالة [!!!]
  const displayStatus = mediationRequest?.status || product.status;
  const { text: statusText, bg: statusBg } = getStatusBadge(displayStatus, t);
  // [!!!] END: نهاية استخدام الدالة [!!!]

  return (
    <Modal show={show} onHide={onHide} size="lg" centered dir={i18n.dir()}>
      <Modal.Header closeButton>
        <Modal.Title>
          {t("mediationDetailsModal.title", "Mediation Details:")}{" "}
          {product.title || "N/A"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={4} className="text-center mb-3 mb-md-0">
            <Image
              src={product.imageUrls?.[0] || noProductImageUrl}
              fluid
              rounded
              style={{ maxHeight: "200px", objectFit: "contain" }}
              onError={(e) => {
                e.target.src = noProductImageUrl;
              }}
              alt={
                product.title ||
                t("mediationDetailsModal.productImage", "Product Image")
              }
            />
          </Col>
          <Col md={8}>
            <h4>{product.title || "N/A"}</h4>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong className="mx-1">
                  {t("mediationDetailsModal.overallStatus", "Overall Status:")}
                </strong>
                {/* [!!!] START: عرض الحالة المترجمة [!!!] */}
                <Badge bg={statusBg}>{statusText}</Badge>
                {/* [!!!] END: نهاية عرض الحالة المترجمة [!!!] */}
              </ListGroup.Item>

              {buyerInfo && buyerInfo._id && (
                <ListGroup.Item>
                  <strong className="mx-1">
                    {t("mediationDetailsModal.buyer", "Buyer:")}
                  </strong>
                  <Link
                    to={`/profile/${buyerInfo._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {buyerInfo.fullName ||
                      t("mediationDetailsModal.viewProfile", "View Profile")}
                  </Link>
                </ListGroup.Item>
              )}

              {mediatorInfo && mediatorInfo._id && (
                <ListGroup.Item>
                  <strong className="mx-1">
                    {t("mediationDetailsModal.mediator", "Mediator:")}
                  </strong>
                  <Link
                    to={`/profile/${mediatorInfo._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {mediatorInfo.fullName || "N/A"}
                  </Link>
                  {mediationRequest?.status === "MediatorAssigned" && (
                    <Badge bg="info text-dark" className="ms-2">
                      {t(
                        "mediationDetailsModal.awaitingResponse",
                        "Awaiting Mediator's Response"
                      )}
                    </Badge>
                  )}
                  {mediationRequest?.status === "MediationOfferAccepted" && (
                    <Badge bg="success" className="ms-2">
                      {t(
                        "mediationDetailsModal.acceptedAssignment",
                        "Accepted Assignment"
                      )}
                    </Badge>
                  )}
                </ListGroup.Item>
              )}
              {product.price != null && (
                <ListGroup.Item>
                  <strong className="mx-1">
                    {t(
                      "mediationDetailsModal.originalPrice",
                      "Original Listing Price:"
                    )}
                  </strong>
                  {formatCurrencyLocal(product.price, product.currency, i18n)}
                </ListGroup.Item>
              )}
              {agreedPrice != null && (
                <ListGroup.Item>
                  <strong className="mx-1">
                    {t(
                      "mediationDetailsModal.agreedPrice",
                      "Agreed Bid Price:"
                    )}
                  </strong>
                  <span className="fw-bold text-success">
                    {formatCurrencyLocal(
                      agreedPrice,
                      product.currency ||
                        mediationRequest?.bidCurrency ||
                        "TND",
                      i18n
                    )}
                  </span>
                </ListGroup.Item>
              )}
              {feeDetails && !feeDetails.error && feeDetails.fee > 0 && (
                <>
                  <ListGroup.Item>
                    <strong className="mx-1">
                      {t(
                        "mediationDetailsModal.mediatorFee",
                        "Calculated Mediator Fee:"
                      )}
                    </strong>
                    {formatCurrencyLocal(
                      feeDetails.fee,
                      feeDetails.currencyUsed,
                      i18n
                    )}
                    {feeDetails.currencyUsed !== "TND" &&
                      feeDetails.feeInTND > 0 && (
                        <small className="text-muted ms-2">
                          (~
                          {formatCurrencyLocal(
                            feeDetails.feeInTND,
                            "TND",
                            i18n
                          )}
                          )
                        </small>
                      )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong className="mx-1">
                      {t(
                        "mediationDetailsModal.sellerFee",
                        "Seller's Share of Fee:"
                      )}
                    </strong>
                    {formatCurrencyLocal(
                      feeDetails.sellerShare,
                      feeDetails.currencyUsed,
                      i18n
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong className="mx-1">
                      {t(
                        "mediationDetailsModal.buyerFee",
                        "Buyer's Share of Fee:"
                      )}
                    </strong>
                    {formatCurrencyLocal(
                      feeDetails.buyerShare,
                      feeDetails.currencyUsed,
                      i18n
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item className="bg-light">
                    <strong className="mx-1">
                      {t(
                        "mediationDetailsModal.netForSeller",
                        "Net Amount for Seller:"
                      )}
                    </strong>
                    <span className="fw-bold text-primary p-1">
                      {formatCurrencyLocal(
                        feeDetails.netForSellerAfterFee ||
                          feeDetails.netForSeller,
                        feeDetails.currencyUsed,
                        i18n
                      )}
                    </span>
                    <div>
                      <small className="fw-bold text-primary">
                        {t(
                          "mediationDetailsModal.netForSellerFormula",
                          "(Agreed Price - Seller's Fee Share)"
                        )}
                      </small>
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item className="bg-light">
                    <strong className="mx-1">
                      {t(
                        "mediationDetailsModal.totalForBuyer",
                        "Total Price for Buyer:"
                      )}
                    </strong>
                    <span className="fw-bold text-danger p-1">
                      {formatCurrencyLocal(
                        feeDetails.totalForBuyerAfterFee ||
                          feeDetails.totalForBuyer,
                        feeDetails.currencyUsed,
                        i18n
                      )}
                    </span>
                    <div>
                      <small className="fw-bold text-danger">
                        {t(
                          "mediationDetailsModal.totalForBuyerFormula",
                          "(Agreed Price + Buyer's Fee Share)"
                        )}
                      </small>
                    </div>
                  </ListGroup.Item>
                </>
              )}
              {mediationRequest && (
                <ListGroup.Item>
                  <small className="text-muted">
                    {t(
                      "mediationDetailsModal.requestId",
                      "Mediation Request ID:"
                    )}{" "}
                    {mediationRequest._id}
                  </small>
                  <br />
                  {mediationRequest.sellerConfirmedStart && (
                    <small className="text-success d-block">
                      <FaCheck />{" "}
                      {t(
                        "mediationDetailsModal.sellerConfirmed",
                        "Seller Confirmed Readiness"
                      )}
                    </small>
                  )}
                  {mediationRequest.buyerConfirmedStart && (
                    <small className="text-success d-block">
                      <FaCheck />{" "}
                      {t(
                        "mediationDetailsModal.buyerConfirmed",
                        "Buyer Confirmed Readiness"
                      )}
                    </small>
                  )}
                  {mediationRequest.status === "EscrowFunded" && (
                    <small className="text-primary d-block">
                      <FaCheck />{" "}
                      {t(
                        "mediationDetailsModal.fundsInEscrow",
                        "Funds are in Escrow"
                      )}
                    </small>
                  )}
                </ListGroup.Item>
              )}
            </ListGroup>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {t("common.close", "Close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MediationDetailsModal;