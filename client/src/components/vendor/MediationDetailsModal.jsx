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

// دالة تنسيق العملة
const formatCurrencyLocal = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  try {
    return num.toLocaleString("fr-TN", {
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

const MediationDetailsModal = ({ show, onHide, product, calculateFee }) => {
  if (!product) return null;

  // استخراج بيانات طلب الوساطة
  const mediationRequest = product.currentMediationRequest; // افترض أن هذا الكائن موجود ومُمرر
  const mediatorInfo = mediationRequest?.mediator; // الوسيط من طلب الوساطة

  // استخراج السعر المتفق عليه
  let agreedPrice = product.agreedPrice; // من المنتج (يتم تعيينه عند قبول المزايدة)
  if (
    agreedPrice == null &&
    mediationRequest &&
    mediationRequest.bidAmount != null
  ) {
    // كحل احتياطي، خذ السعر من طلب الوساطة إذا لم يكن موجودًا في المنتج مباشرة
    agreedPrice = mediationRequest.bidAmount;
  } else if (agreedPrice == null && product.bids && product.bids.length > 0) {
    // أو أعلى مزايدة كحل احتياطي أخير جدًا (يفضل أن يكون agreedPrice محددًا)
    const sortedBids = [...product.bids].sort((a, b) => b.amount - a.amount);
    agreedPrice = sortedBids[0].amount;
  }

  // الحسابات (تأكد من أن calculateFee تتعامل مع agreedPrice = null أو undefined)
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
          error: "Price or fee function missing",
        };

  // استخراج اسم الشاري
  let buyerInfo = null;
  if (
    product.buyer &&
    typeof product.buyer === "object" &&
    product.buyer.fullName
  ) {
    // إذا كان المشتري populated في المنتج
    buyerInfo = product.buyer;
  } else if (
    mediationRequest &&
    mediationRequest.buyer &&
    typeof mediationRequest.buyer === "object" &&
    mediationRequest.buyer.fullName
  ) {
    // إذا كان المشتري populated في طلب الوساطة
    buyerInfo = mediationRequest.buyer;
  } else if (product.buyer) {
    // إذا كان معرف المشتري فقط موجودًا في المنتج
    buyerInfo = { _id: product.buyer, fullName: "Buyer (ID only)" };
  } else if (mediationRequest && mediationRequest.buyer) {
    // إذا كان معرف المشتري فقط موجودًا في طلب الوساطة
    buyerInfo = { _id: mediationRequest.buyer, fullName: "Buyer (ID only)" };
  }

  // تحديد حالة الوساطة الفعلية للعرض
  let displayStatus = product.status;
  let displayStatusBg = "secondary";

  if (mediationRequest && mediationRequest.status) {
    displayStatus = mediationRequest.status; // الأولوية لحالة طلب الوساطة
    if (displayStatus === "PendingMediatorSelection") {
      displayStatusBg = "info text-dark";
    } else if (displayStatus === "MediatorAssigned") {
      displayStatusBg = "primary";
    } else if (displayStatus === "MediationOfferAccepted") {
      displayStatusBg = "warning text-dark";
    } else if (displayStatus === "EscrowFunded") {
      displayStatusBg = "info";
    } else if (displayStatus === "InProgress") {
      displayStatusBg = "success";
    } else if (displayStatus === "Completed") {
      displayStatusBg = "dark";
    }
  } else if (product.status === "PendingMediatorSelection") {
    displayStatusBg = "info text-dark";
  } else if (product.status === "MediatorAssigned") {
    displayStatusBg = "primary";
  }
  // يمكنك إضافة المزيد من الحالات هنا

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Mediation Details: {product.title || "N/A"}</Modal.Title>
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
              alt={product.title || "Product Image"}
            />
          </Col>
          <Col md={8}>
            <h4>{product.title || "N/A"}</h4>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong className="mx-1">Overall Status:</strong>
                <Badge bg={displayStatusBg}>
                  {displayStatus.replace(/([A-Z])/g, " $1").trim()}
                </Badge>
              </ListGroup.Item>

              {buyerInfo && buyerInfo._id && (
                <ListGroup.Item>
                  <strong className="mx-1">Buyer:</strong>
                  <Link
                    to={`/profile/${buyerInfo._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {buyerInfo.fullName || "View Profile"}
                  </Link>
                </ListGroup.Item>
              )}

              {/* --- [!!!] إضافة معلومات الوسيط [!!!] --- */}
              {mediatorInfo && mediatorInfo._id && (
                <ListGroup.Item>
                  <strong className="mx-1">Mediator:</strong>
                  <Link
                    to={`/profile/${mediatorInfo._id}`} // افترض أن هذا المسار صحيح
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {mediatorInfo.fullName || "N/A"}
                  </Link>
                  {mediationRequest?.status === "MediatorAssigned" && (
                    <Badge bg="info text-dark" className="ms-2">
                      Awaiting Mediator's Response
                    </Badge>
                  )}
                  {mediationRequest?.status === "MediationOfferAccepted" && (
                    <Badge bg="success" className="ms-2">
                      Accepted Assignment
                    </Badge>
                  )}
                </ListGroup.Item>
              )}
              {/* ------------------------------------ */}

              {product.price != null && (
                <ListGroup.Item>
                  <strong className="mx-1">Original Listing Price:</strong>
                  {formatCurrencyLocal(product.price, product.currency)}
                </ListGroup.Item>
              )}

              {agreedPrice != null && (
                <ListGroup.Item>
                  <strong className="mx-1">Agreed Bid Price:</strong>
                  <span className="fw-bold text-success">
                    {formatCurrencyLocal(
                      agreedPrice,
                      product.currency || mediationRequest?.bidCurrency || "TND"
                    )}
                  </span>
                </ListGroup.Item>
              )}

              {/* عرض تفاصيل العمولة إذا كانت محسوبة */}
              {feeDetails && !feeDetails.error && feeDetails.fee > 0 && (
                <>
                  <ListGroup.Item>
                    <strong className="mx-1">Calculated Mediator Fee:</strong>
                    {formatCurrencyLocal(
                      feeDetails.fee,
                      feeDetails.currencyUsed
                    )}
                    {feeDetails.currencyUsed !== "TND" &&
                      feeDetails.feeInTND > 0 && (
                        <small className="text-muted ms-2">
                          (~{formatCurrencyLocal(feeDetails.feeInTND, "TND")})
                        </small>
                      )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong className="mx-1">Seller's Share of Fee:</strong>
                    {formatCurrencyLocal(
                      feeDetails.sellerShare,
                      feeDetails.currencyUsed
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong className="mx-1">Buyer's Share of Fee:</strong>
                    {formatCurrencyLocal(
                      feeDetails.buyerShare,
                      feeDetails.currencyUsed
                    )}
                  </ListGroup.Item>
                  <ListGroup.Item className="bg-light">
                    <strong className="mx-1">Net Amount for Seller:</strong>
                    <span className="fw-bold text-primary p-1">
                      {formatCurrencyLocal(
                        feeDetails.netForSellerAfterFee ||
                          feeDetails.netForSeller,
                        feeDetails.currencyUsed
                      )}
                    </span>
                    <div>
                      <small className="fw-bold text-primary">
                        (Agreed Price - Seller's Fee Share)
                      </small>
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item className="bg-light">
                    <strong className="mx-1">Total Price for Buyer:</strong>
                    <span className="fw-bold text-danger p-1">
                      {formatCurrencyLocal(
                        feeDetails.totalForBuyerAfterFee ||
                          feeDetails.totalForBuyer,
                        feeDetails.currencyUsed
                      )}
                    </span>
                    <div>
                      <small className="fw-bold text-danger">
                        (Agreed Price + Buyer's Fee Share)
                      </small>
                    </div>
                  </ListGroup.Item>
                </>
              )}
              {mediationRequest && (
                <ListGroup.Item>
                  <small className="text-muted">
                    Mediation Request ID: {mediationRequest._id}
                  </small>
                  <br />
                  {mediationRequest.sellerConfirmedStart && (
                    <small className="text-success d-block">
                      <FaCheck /> Seller Confirmed Readiness
                    </small>
                  )}
                  {mediationRequest.buyerConfirmedStart && (
                    <small className="text-success d-block">
                      <FaCheck /> Buyer Confirmed Readiness
                    </small>
                  )}
                  {mediationRequest.status === "EscrowFunded" && (
                    <small className="text-primary d-block">
                      <FaCheck /> Funds are in Escrow
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
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MediationDetailsModal;
