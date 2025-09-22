// src/components/admin/AdminDisputesPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Alert,
  Pagination,
  Badge,
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { adminGetDisputedMediationsAction } from "../../redux/actions/mediationAction";
import { FaCommentDots, FaExclamationTriangle } from "react-icons/fa";

const AdminDisputesPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      if (amount === undefined || amount === null) return "N/A";
      const options = {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      return new Intl.NumberFormat(i18n.language, options).format(amount);
    },
    [i18n.language]
  );

  const { adminDisputedMediations, loadingAdminDisputed, errorAdminDisputed } =
    useSelector((state) => state.mediationReducer);

  const disputedList = adminDisputedMediations?.list || [];
  const totalPages = adminDisputedMediations?.totalPages || 1;
  const totalCount = adminDisputedMediations?.totalCount || 0;

  const [currentPageLocal, setCurrentPageLocal] = useState(1);

  useEffect(() => {
    dispatch(adminGetDisputedMediationsAction(currentPageLocal));
  }, [dispatch, currentPageLocal]);

  const handlePageChange = (pageNumber) => {
    setCurrentPageLocal(pageNumber);
  };

  const renderDisputeCard = (request) => {
    if (!request) return null;
    return (
      <Card key={request._id} className="mb-3 shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>
            {t("admin.disputes.card.product")}:{" "}
            {request.product?.title || "N/A"}{" "}
            <Badge bg="danger">{t("admin.disputes.card.disputedBadge")}</Badge>
          </span>
        </Card.Header>
        <Card.Body>
          <p>
            <small className="text-muted">
              {t("admin.disputes.card.mediationId")}:
            </small>{" "}
            {request._id}
          </p>
          <p>
            <small className="text-muted">
              {t("admin.disputes.card.seller")}:
            </small>{" "}
            {request.seller?.fullName || "N/A"}
          </p>
          <p>
            <small className="text-muted">
              {t("admin.disputes.card.buyer")}:
            </small>{" "}
            {request.buyer?.fullName || "N/A"}
          </p>
          <p>
            <small className="text-muted">
              {t("admin.disputes.card.mediator")}:
            </small>{" "}
            {request.mediator?.fullName || "N/A"}
          </p>
          <p>
            <small className="text-muted">
              {t("admin.disputes.card.agreedPrice")}:
            </small>{" "}
            {formatCurrency(request.bidAmount, request.bidCurrency)}
          </p>
          <p>
            <small className="text-muted">
              {t("admin.disputes.card.lastUpdate")}:
            </small>{" "}
            {new Date(request.updatedAt).toLocaleString()}
          </p>
          <div className="text-end">
            <Button
              variant="warning"
              size="sm"
              onClick={() =>
                navigate(`/dashboard/mediation-chat/${request._id}`)
              }
            >
              <FaCommentDots className="me-1" />{" "}
              {t("admin.disputes.card.joinChatButton")}
            </Button>
          </div>
        </Card.Body>
      </Card>
    );
  };

  if (loadingAdminDisputed && disputedList.length === 0) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>{t("admin.disputes.page.loading")}</p>
      </Container>
    );
  }
  if (errorAdminDisputed && disputedList.length === 0) {
    let errorMessage = errorAdminDisputed;
    if (typeof errorAdminDisputed === "object" && errorAdminDisputed.key) {
      errorMessage = t(errorAdminDisputed.key, {
        ...errorAdminDisputed.params,
        defaultValue: errorAdminDisputed.fallback,
      });
    }
    return (
      <Container className="py-5">
        <Alert variant="danger">
          {t("admin.disputes.page.error")}: {errorMessage}
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 px-md-4">
      <Row className="mb-3">
        <Col>
          <h2 className="d-flex align-items-center">
            <FaExclamationTriangle className="me-2 text-danger" />{" "}
            {t("admin.disputes.page.title")}
            <Badge pill bg="danger" className="ms-2 fs-6">
              {totalCount}
            </Badge>
          </h2>
          <p className="text-muted">{t("admin.disputes.page.subtitle")}</p>
        </Col>
      </Row>

      {loadingAdminDisputed && (
        <div className="text-center mb-2">
          <Spinner size="sm" />
        </div>
      )}

      {disputedList.length > 0
        ? disputedList.map(renderDisputeCard)
        : !loadingAdminDisputed && (
            <Alert variant="info">{t("admin.disputes.page.noDisputes")}</Alert>
          )}

      {totalPages > 1 && (
        <Pagination className="justify-content-center mt-4">
          {[...Array(totalPages).keys()].map((num) => (
            <Pagination.Item
              key={num + 1}
              active={num + 1 === currentPageLocal}
              onClick={() => handlePageChange(num + 1)}
              disabled={loadingAdminDisputed}
            >
              {num + 1}
            </Pagination.Item>
          ))}
        </Pagination>
      )}
    </Container>
  );
};

export default AdminDisputesPage;