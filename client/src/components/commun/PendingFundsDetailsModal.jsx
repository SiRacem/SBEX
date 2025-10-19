// client/src/components/commun/PendingFundsDetailsModal.jsx

import React, { useState, useEffect, useCallback } from "react";
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
  FaInfoCircle,
  FaUndoAlt,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

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

const PendingFundsDetailsModal = ({ show, onHide }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);

  const platformBaseCurrencyGlobal = useSelector(
    (state) => state.ui?.platformBaseCurrency || "TND"
  );
  const totalPendingDisplay = useCurrencyDisplay(
    details?.totalPendingBalance,
    details?.platformBaseCurrency || platformBaseCurrencyGlobal
  );
  const totalAvailableDisplay = useCurrencyDisplay(
    details?.totalAvailableBalance,
    details?.platformBaseCurrency || platformBaseCurrencyGlobal
  );

  const formatTimeRemaining = useCallback(
    (releaseDate) => {
      if (!releaseDate) return "N/A";
      const now = new Date();
      const release = new Date(releaseDate);
      const diff = differenceInMilliseconds(release, now);

      if (diff <= 0) {
        return (
          <Badge bg="success-soft" text="success" pill>
            <FaCheckCircle className="me-1" />
            {t("pendingFunds.readyForRelease")}
          </Badge>
        );
      }

      return formatDistanceToNowStrict(release, { addSuffix: true });
    },
    [t]
  );

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token)
        throw new Error(
          t("pendingFunds.errors.noAuth", "Authentication token not found.")
        );
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const { data } = await axios.get(
        "/wallet/seller-pending-details",
        config
      );
      setDetails(data);
    } catch (err) {
      const errorMessage =
        err.response?.data?.msg ||
        err.message ||
        t(
          "pendingFunds.errors.fetchFailed",
          "Failed to fetch pending funds details."
        );
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (show) {
      fetchDetails();
    } else {
      setDetails(null);
      setError(null);
    }
  }, [show, fetchDetails]);

  const handleRefresh = () => {
    fetchDetails();
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaHourglassHalf className="me-2 text-warning" />{" "}
          {t("pendingFunds.title")}
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
            <p className="mt-2">{t("pendingFunds.loading")}</p>
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
                      {t("pendingFunds.totalOnHold")}
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
                      {t("pendingFunds.totalAvailable")}
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
              {t("pendingFunds.currentlyOnHold")} (
              {details.pendingItems?.length || 0})
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
                    <th>{t("pendingFunds.table.product")}</th>
                    <th>{t("pendingFunds.table.saleAmount")}</th>
                    <th>{t("pendingFunds.table.onHoldSince")}</th>
                    <th>{t("pendingFunds.table.releasesIn")}</th>
                    <th>{t("pendingFunds.table.mediationRef")}</th>
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
                            title={t("pendingFunds.viewMediation")}
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
                              {t("pendingFunds.scheduledRelease")}
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
                {t("pendingFunds.noFundsOnHold")}
              </Alert>
            )}

            {details.recentlyReleasedItems &&
              details.recentlyReleasedItems.length > 0 && (
                <>
                  <h5 className="mt-5 mb-3">
                    <FaCheckCircle className="me-2 text-success" />
                    {t("pendingFunds.recentlyReleased")} (
                    {details.recentlyReleasedItems.length})
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
                        <th>{t("pendingFunds.table.product")}</th>
                        <th>{t("pendingFunds.table.amountReleased")}</th>
                        <th>{t("pendingFunds.table.releasedOn")}</th>
                        <th>{t("pendingFunds.table.mediationRef")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.recentlyReleasedItems.map((item) => (
                        <tr key={item._id}>
                          <td>{item.productTitle || "N/A"}</td>
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
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <Button
          variant="outline-secondary"
          onClick={handleRefresh}
          disabled={loading}
        >
          <FaUndoAlt className="me-1" /> {t("common.refresh", "Refresh")}
        </Button>
        <Button variant="primary" onClick={onHide}>
          {t("common.close", "Close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PendingFundsDetailsModal;