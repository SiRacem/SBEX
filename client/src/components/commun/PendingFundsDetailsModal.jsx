// src/components/commun/PendingFundsDetailsModal.jsx
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Modal,
  Button,
  Spinner,
  Alert,
  Table,
  Badge,
  OverlayTrigger,
  Tooltip,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import axios from "axios";
import {
  format,
  formatDistanceToNowStrict,
  differenceInMilliseconds,
} from "date-fns";
import {
  FaHourglassHalf,
  FaCheckCircle,
  FaTimesCircle,
  FaQuestionCircle,
  FaInfoCircle,
  FaUndoAlt,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { Link } from "react-router-dom"; // إذا أردت روابط للمنتجات/الوساطات
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay"; // لعرض الأرصدة الإجمالية
import { toast } from "react-toastify";

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.warn(
      `Currency formatting error for code '${safeCurrencyCode}':`,
      error
    );
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

// دالة مساعدة لتنسيق الوقت المتبقي
const formatTimeRemaining = (releaseDate) => {
  if (!releaseDate) return "N/A";
  const now = new Date();
  const release = new Date(releaseDate);
  const diff = differenceInMilliseconds(release, now);

  if (diff <= 0) {
    return (
      <Badge bg="success-soft" text="success" pill>
        <FaCheckCircle className="me-1" />
        Ready for Release
      </Badge>
    );
  }

  return formatDistanceToNowStrict(release, { addSuffix: true });
};

const PendingFundsDetailsModal = ({ show, onHide }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);

  const platformBaseCurrencyGlobal = useSelector(
    (state) => state.ui?.platformBaseCurrency || "TND"
  ); // افترض أن عملة المنصة الأساسية في Redux

  // استخدام الهوك لعرض الأرصدة الإجمالية من المودال
  const totalPendingDisplay = useCurrencyDisplay(
    details?.totalPendingBalance,
    details?.platformBaseCurrency || platformBaseCurrencyGlobal
  );
  const totalAvailableDisplay = useCurrencyDisplay(
    details?.totalAvailableBalance,
    details?.platformBaseCurrency || platformBaseCurrencyGlobal
  );

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication token not found.");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // --- [!!!] تأكد من أن هذا المسار صحيح ويتطابق مع ما أنشأته في الـ Backend [!!!] ---
      const { data } = await axios.get(
        "/wallet/seller-pending-details",
        config
      );
      setDetails(data);
    } catch (err) {
      setError(
        err.response?.data?.msg ||
          err.message ||
          "Failed to fetch pending funds details."
      );
      toast.error(err.response?.data?.msg || "Could not load details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchDetails();
    } else {
      // إعادة تعيين الحالة عند إغلاق المودال
      setDetails(null);
      setError(null);
    }
  }, [show]);

  const handleRefresh = () => {
    fetchDetails();
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaHourglassHalf className="me-2 text-warning" /> On Hold & Available
          Funds Details
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {loading && (
          <div className="text-center py-5">
            <Spinner
              animation="border"
              variant="primary"
              style={{ width: "3rem", height: "3rem" }}
            />
            <p className="mt-2">Loading details...</p>
          </div>
        )}
        {error && <Alert variant="danger">{error}</Alert>}

        {!loading && !error && details && (
          <>
            <Row className="mb-4 text-center">
              <Col md={6} className="mb-3 mb-md-0">
                <Card bg="warning" text="white" className="h-100 shadow">
                  <Card.Body>
                    <Card.Subtitle className="mb-2 text-white-75">
                      Total On Hold Balance
                    </Card.Subtitle>
                    <Card.Title className="display-6">
                      {totalPendingDisplay.displayValue}
                    </Card.Title>
                    <small>{totalPendingDisplay.approxValue}</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card bg="success" text="white" className="h-100 shadow">
                  <Card.Body>
                    <Card.Subtitle className="mb-2 text-white-75">
                      Total Available (from Sales)
                    </Card.Subtitle>
                    <Card.Title className="display-6">
                      {totalAvailableDisplay.displayValue}
                    </Card.Title>
                    <small>{totalAvailableDisplay.approxValue}</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <h5 className="mt-4 mb-3">
              <FaHourglassHalf className="me-2" />
              Currently On Hold ({details.pendingItems?.length || 0})
            </h5>
            {details.pendingItems && details.pendingItems.length > 0 ? (
              <Table
                striped
                bordered
                hover
                responsive
                size="sm"
                className="shadow-sm"
              >
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Sale Amount</th>
                    <th>On Hold Since</th>
                    <th>Releases In / At</th>
                    <th>Mediation Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {details.pendingItems.map((item, index) => (
                    <tr key={item._id}>
                      <td>{index + 1}</td>
                      <td>
                        {item.productTitle || "N/A"}
                        {item.mediationRequest?._id && (
                          <Link
                            to={`/dashboard/mediation-chat/${item.mediationRequest._id}`}
                            className="ms-2 small"
                            title="View Mediation"
                          >
                            <FaExternalLinkAlt size="0.8em" />
                          </Link>
                        )}
                      </td>
                      <td>{formatCurrency(item.amount, item.currency)}</td>
                      <td>{format(new Date(item.createdAt), "PP p")}</td>
                      <td>
                        {formatTimeRemaining(item.releaseAt)}
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip>
                              Scheduled Release:
                              {format(new Date(item.releaseAt), "PPpp")}
                            </Tooltip>
                          }
                        >
                          <FaInfoCircle
                            className="ms-1 text-muted"
                            style={{ cursor: "help" }}
                          />
                        </OverlayTrigger>
                      </td>
                      <td>
                        {item.mediationRequest?._id?.toString().slice(-6) ||
                          "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Alert variant="info" className="text-center">
                No funds are currently on hold from sales.
              </Alert>
            )}

            {details.recentlyReleasedItems &&
              details.recentlyReleasedItems.length > 0 && (
                <>
                  <h5 className="mt-5 mb-3">
                    <FaCheckCircle className="me-2 text-success" />
                    Recently Released ({details.recentlyReleasedItems.length})
                  </h5>
                  <Table
                    striped
                    bordered
                    hover
                    responsive
                    size="sm"
                    className="shadow-sm"
                  >
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>Amount Released</th>
                        <th>Released On</th>
                        <th>Mediation Ref.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.recentlyReleasedItems.map((item) => (
                        <tr key={item._id}>
                          <td>
                            {item.productTitle || "N/A"}
                            {item.mediationRequest?._id && (
                              <Link
                                to={`/dashboard/mediation-chat/${item.mediationRequest._id}`}
                                className="ms-2 small"
                                title="View Mediation"
                              >
                                <FaExternalLinkAlt size="0.8em" />
                              </Link>
                            )}
                          </td>
                          <td>{formatCurrency(item.amount, item.currency)}</td>
                          <td>
                            {format(
                              new Date(item.releasedToAvailableAt),
                              "PP p"
                            )}
                          </td>
                          <td>
                            {item.mediationRequest?._id?.toString().slice(-6) ||
                              "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
          </>
        )}
        {!loading && !error && !details && (
          <Alert variant="light" className="text-center">
            No data available.
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <Button
          variant="outline-secondary"
          onClick={handleRefresh}
          disabled={loading}
        >
          <FaUndoAlt className="me-1" /> Refresh
        </Button>
        <Button variant="primary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PendingFundsDetailsModal;
