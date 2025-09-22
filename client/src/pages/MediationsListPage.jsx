// client/src/pages/MediationsListPage.jsx
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  ListGroup,
  Button,
  Spinner,
  Alert,
  Badge,
} from "react-bootstrap";
import { FaComments, FaUserFriends, FaBoxOpen } from "react-icons/fa";
import {
  getMyMediationSummaries,
  markMediationAsReadInList,
} from "../redux/actions/mediationAction";
import { useTranslation } from "react-i18next";

const MediationsListPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { requests, loading, error, totalUnreadMessagesCount } = useSelector(
    (state) => state.mediationReducer.myMediationSummaries
  );

  useEffect(() => {
    dispatch(getMyMediationSummaries());
  }, [dispatch]);

  const handleOpenChat = (mediationId) => {
    dispatch(markMediationAsReadInList(mediationId));
    navigate(`/dashboard/mediation-chat/${mediationId}`);
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">{t("mediationsListPage.loading")}</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          {t("mediationsListPage.error")}{" "}
          {typeof error === "object"
            ? error.message || JSON.stringify(error)
            : error}
        </Alert>
        <Button
          onClick={() => dispatch(getMyMediationSummaries())}
          variant="outline-primary"
        >
          {t("mediationsListPage.tryAgain")}
        </Button>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 px-md-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="h4">{t("mediationsListPage.title")}</h2>
        </Col>
        {totalUnreadMessagesCount > 0 && (
          <Col xs="auto">
            <Badge bg="primary" pill className="fs-6">
              {t("mediationsListPage.totalUnread", {
                count: totalUnreadMessagesCount,
              })}
            </Badge>
          </Col>
        )}
      </Row>
      {requests && requests.length > 0 ? (
        <ListGroup variant="flush">
          {requests.map((mediation) => (
            <ListGroup.Item
              key={mediation._id}
              action
              onClick={() => handleOpenChat(mediation._id)}
              className="mb-2 shadow-sm rounded mediation-list-item p-3"
              style={{ cursor: "pointer" }}
            >
              <Row className="align-items-center g-2">
                <Col md="auto" xs={2} className="text-center d-none d-md-block">
                  <div
                    className={`status-indicator-dot me-2 ${
                      mediation.unreadMessagesCount > 0 ? "unread" : "read"
                    }`}
                  ></div>
                  <FaBoxOpen
                    size={28}
                    className={
                      mediation.unreadMessagesCount > 0
                        ? "text-primary"
                        : "text-muted"
                    }
                  />
                </Col>
                <Col>
                  <div className="d-flex justify-content-between align-items-start">
                    <h5
                      className="mb-1 fs-6 fw-bold text-truncate"
                      style={{ maxWidth: "80%" }}
                    >
                      {mediation.product?.title ||
                        t("mediationsListPage.mediationSession")}
                    </h5>
                    {mediation.unreadMessagesCount > 0 && (
                      <Badge pill bg="danger" className="ms-2 flex-shrink-0">
                        {mediation.unreadMessagesCount}
                      </Badge>
                    )}
                  </div>
                  <p className="mb-1 text-muted small">
                    <FaUserFriends className="me-1" />
                    {t("mediationsListPage.with")}{" "}
                    {mediation.otherParty?.fullName || "N/A"}
                    <span className="d-none d-sm-inline">
                      {" "}
                      (
                      {mediation.otherParty?.roleLabel ||
                        t("mediationsListPage.participant")}
                      )
                    </span>
                  </p>
                  <div className="d-flex justify-content-between align-items-center">
                    <Badge
                      bg={
                        mediation.status === "InProgress"
                          ? "success"
                          : mediation.status === "Completed" ||
                            mediation.status === "Cancelled"
                          ? "secondary"
                          : "info"
                      }
                      className="me-2"
                    >
                      {mediation.status}
                    </Badge>
                    <span className="text-muted small">
                      {mediation.lastMessageTimestamp
                        ? `${t("mediationsListPage.last")} ${new Date(
                            mediation.lastMessageTimestamp
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} ${new Date(
                            mediation.lastMessageTimestamp
                          ).toLocaleDateString([], {
                            day: "2-digit",
                            month: "short",
                          })}`
                        : `${t("mediationsListPage.updated")} ${new Date(
                            mediation.updatedAt
                          ).toLocaleDateString()}`}
                    </span>
                  </div>
                </Col>
              </Row>
            </ListGroup.Item>
          ))}
        </ListGroup>
      ) : (
        <Card className="text-center p-4 p-md-5 shadow-sm mt-4">
          <Card.Body>
            <FaComments size={48} className="text-muted opacity-50 mb-3" />
            <h4 className="h5">{t("mediationsListPage.noChats")}</h4>
            <p className="text-muted">
              {t("mediationsListPage.noChatsDetails")}
            </p>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default MediationsListPage;