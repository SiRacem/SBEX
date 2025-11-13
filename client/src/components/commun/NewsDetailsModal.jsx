// client/src/components/commun/NewsDetailsModal.jsx

import React from "react";
import { Modal, Button, Badge } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { FaCalendarAlt, FaUserEdit } from "react-icons/fa";

const NewsDetailsModal = ({ post, show, onHide }) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  if (!post) return null;

  const title = post.title[currentLang] || post.title.en;
  const content = post.content[currentLang] || post.content.en;
  const authorName = post.author?.name || "Admin"; // Fallback to 'Admin'
  const BACKEND_URL =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      dialogClassName="news-details-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title as="h3">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex justify-content-between text-muted mb-3 small">
          <span>
            <FaUserEdit className="me-2" />
            {t("news.postedBy", { author: authorName })}
          </span>
          <span>
            <FaCalendarAlt className="me-2" />
            {t("news.postedOn", {
              date: new Date(post.createdAt).toLocaleDateString(),
            })}
          </span>
        </div>

        {post.mediaUrl && (
          <div className="news-media-container mb-4">
            {post.mediaType === "image" ? (
              <img
                src={`${BACKEND_URL}/${post.mediaUrl}`}
                alt={title}
                className="img-fluid rounded"
              />
            ) : (
              <video controls width="100%" className="rounded">
                <source
                  src={`${BACKEND_URL}/${post.mediaUrl}`}
                  type={post.mediaType === "video" ? "video/mp4" : "video/webm"}
                />
                {t("news.videoNotSupported")}
              </video>
            )}
          </div>
        )}

        <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.8" }}>{content}</p>
      </Modal.Body>
      <Modal.Footer>
        <Badge bg="info">
          {t(`newsCategories.${post.category}`, post.category)}
        </Badge>
        <Button variant="secondary" onClick={onHide}>
          {t("common.close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NewsDetailsModal;