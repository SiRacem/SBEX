import React from "react";
import { Modal, Button, ListGroup, Card } from "react-bootstrap";
import { useTranslation, Trans } from "react-i18next";
import {
  FaCheckCircle,
  FaGavel,
  FaHourglassHalf,
  FaStar,
  FaThumbsUp,
  FaThumbsDown,
} from "react-icons/fa";

const StatusExplanationModal = ({ mediationRequest, show, onHide }) => {
  const { t } = useTranslation();
  const status = mediationRequest?.status;

  const getContentAndStyle = () => {
    let headerClass = "bg-light text-dark"; // اللون الافتراضي

    // مكون مساعد لعرض النقاط
    const PointChange = ({ icon, color, text }) => (
      <div className={`d-flex align-items-center text-${color} mb-2`}>
        {icon}
        <span className="ms-2">{text}</span>
      </div>
    );

    switch (status) {
      case "InProgress":
      case "Disputed":
        headerClass = "bg-warning text-dark"; // لون التحذير
        return {
          title: t("statusModal.inProgress.title"),
          headerClass,
          content: (
            <>
              <h5 className="mb-3">{t("statusModal.inProgress.subtitle")}</h5>
              <ListGroup>
                <ListGroup.Item className="border-success border-2 mb-3">
                  <h6 className="text-success d-flex align-items-center">
                    <FaCheckCircle className="me-2" />{" "}
                    {t("statusModal.inProgress.happyPath.title")}
                  </h6>
                  <p>{t("statusModal.inProgress.happyPath.description")}</p>
                  <ul>
                    <li>{t("statusModal.inProgress.happyPath.p1")}</li>
                    <li>{t("statusModal.inProgress.happyPath.p2")}</li>
                    <li>{t("statusModal.inProgress.happyPath.p3")}</li>
                    <li>{t("statusModal.inProgress.happyPath.p4")}</li>
                  </ul>
                </ListGroup.Item>
                <ListGroup.Item className="border-danger border-2">
                  <h6 className="text-danger d-flex align-items-center">
                    <FaGavel className="me-2" />{" "}
                    {t("statusModal.inProgress.disputePath.title")}
                  </h6>
                  <p>{t("statusModal.inProgress.disputePath.description")}</p>
                  <ul>
                    <li>
                      <strong>
                        {t("statusModal.inProgress.disputePath.ifBuyerWins")}
                      </strong>{" "}
                      {t("statusModal.inProgress.disputePath.buyerWinsResult")}
                    </li>
                    <li>
                      <strong>
                        {t("statusModal.inProgress.disputePath.ifSellerWins")}
                      </strong>{" "}
                      {t("statusModal.inProgress.disputePath.sellerWinsResult")}
                    </li>
                    <li>
                      <strong>
                        {t("statusModal.inProgress.disputePath.ifCancelled")}
                      </strong>{" "}
                      {t("statusModal.inProgress.disputePath.cancelResult")}
                    </li>
                  </ul>
                </ListGroup.Item>
              </ListGroup>
            </>
          ),
        };

      case "AdminResolved":
        headerClass = "bg-info text-white"; // لون المعلومات
        const resolutionNotes =
          mediationRequest?.resolutionDetails ||
          t("statusModal.adminResolved.noNotes");
        const winner = resolutionNotes.includes("in favor of Buyer")
          ? t("common.roles.Buyer")
          : resolutionNotes.includes("in favor of Seller")
          ? t("common.roles.Seller")
          : null;
        return {
          title: t("statusModal.adminResolved.title"),
          headerClass,
          content: (
            <>
              <p>{t("statusModal.adminResolved.description")}</p>
              {winner && (
                <p>
                  <strong>{t("statusModal.adminResolved.decision")}</strong>{" "}
                  {t("statusModal.adminResolved.inFavorOf", { winner })}
                </p>
              )}
              <Card bg="light" className="mt-3">
                <Card.Header>
                  {t("statusModal.adminResolved.adminNotes")}
                </Card.Header>
                <Card.Body>
                  <blockquote className="blockquote mb-0">
                    <p>
                      <small>{resolutionNotes}</small>
                    </p>
                  </blockquote>
                </Card.Body>
              </Card>
            </>
          ),
        };

      case "Cancelled":
        headerClass = "bg-danger text-white"; // لون الخطر/الإلغاء
        const details =
          mediationRequest?.cancellationDetails ||
          mediationRequest?.resolutionDetails;
        let cancelledBy = t("statusModal.cancelled.unknown");
        if (details?.cancelledByType) {
          cancelledBy = t(
            `common.roles.${details.cancelledByType}`,
            details.cancelledByType
          );
        } else if (
          mediationRequest?.status === "Cancelled" &&
          mediationRequest?.resolutionDetails
        ) {
          cancelledBy = t("common.roles.Admin");
        }
        const reason =
          details?.reason ||
          mediationRequest?.resolutionDetails ||
          t("statusModal.cancelled.noReason");
        return {
          title: t("statusModal.cancelled.title"),
          headerClass,
          content: (
            <>
              <p>
                <Trans i18nKey="statusModal.cancelled.description">
                  This mediation was cancelled by:{" "}
                  <strong>{{ cancelledBy }}</strong>.
                </Trans>
              </p>
              <Card bg="light" className="mt-3">
                <Card.Header>
                  {t("statusModal.cancelled.reasonTitle")}
                </Card.Header>
                <Card.Body>
                  <blockquote className="blockquote mb-0">
                    <p className="mb-0">
                      <small>{reason}</small>
                    </p>
                  </blockquote>
                </Card.Body>
              </Card>
            </>
          ),
        };

      case "Completed":
      case "sold":
        headerClass = "bg-success text-white"; // لون النجاح
        return {
          title: t("statusModal.completed.title"),
          headerClass,
          content: (
            <>
              <h5 className="mb-3">{t("statusModal.completed.subtitle")}</h5>
              <ListGroup>
                <ListGroup.Item>
                  <PointChange
                    icon={<FaHourglassHalf />}
                    color="warning"
                    text={t("statusModal.completed.fundsOnHold")}
                  />
                </ListGroup.Item>
                <ListGroup.Item>
                  <PointChange
                    icon={<FaStar />}
                    color="info"
                    text={t("statusModal.completed.reputation")}
                  />
                </ListGroup.Item>
                <ListGroup.Item>
                  <h6 className="mt-2">
                    {t("statusModal.completed.ratingTitle")}
                  </h6>
                  <div className="d-flex justify-content-around mt-2">
                    <PointChange
                      icon={<FaThumbsUp />}
                      color="success"
                      text={t("statusModal.completed.like")}
                    />
                    <PointChange
                      icon={<FaThumbsDown />}
                      color="danger"
                      text={t("statusModal.completed.dislike")}
                    />
                  </div>
                </ListGroup.Item>
              </ListGroup>
            </>
          ),
        };

      default:
        return {
          title: t("statusModal.default.title"),
          headerClass,
          content: <p>{t("statusModal.default.content")}</p>,
        };
    }
  };

  const { title, content, headerClass } = getContentAndStyle();

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className={headerClass}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{content}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {t("common.close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StatusExplanationModal;