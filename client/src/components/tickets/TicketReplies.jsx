// src/components/tickets/TicketReplies.jsx
import React from "react";
import { Card, Image, Badge, ListGroup } from "react-bootstrap";
import moment from "moment";
import { useTranslation } from "react-i18next";
import {
  FaPaperclip,
  FaFileAlt,
  FaFileImage,
  FaFileVideo,
  FaFileAudio,
} from "react-icons/fa";
import "./TicketReplies.css";

const API_URL = "http://localhost:8000";
// --- THIS IS THE FIX: Using a self-contained SVG Data URI for the default avatar ---
const DEFAULT_AVATAR_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45"><circle cx="22.5" cy="22.5" r="22.5" fill="%23ced4da"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="22px" fill="%23ffffff">U</text></svg>';
// --- END OF FIX ---

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = 2;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const FileIcon = ({ fileType }) => {
  if (fileType.startsWith("image/")) return <FaFileImage className="me-2" />;
  if (fileType.startsWith("video/")) return <FaFileVideo className="me-2" />;
  if (fileType.startsWith("audio/")) return <FaFileAudio className="me-2" />;
  return <FaFileAlt className="me-2" />;
};

const TicketReplies = ({ replies, currentUser }) => {
  const { t } = useTranslation();

  if (!replies || replies.length === 0) {
    return (
      <Card className="mt-4 shadow-sm">
        <Card.Body className="text-center text-muted py-4">
          {t(
            "ticketDetails.noRepliesYet",
            "No replies yet. Be the first to respond!"
          )}
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="mt-4 ticket-replies-container">
      <h4 className="mb-3">
        {t("ticketDetails.repliesTitle", "Conversation")}
      </h4>
      <ListGroup variant="flush" className="p-0">
        {replies.map((reply) => {
          if (!reply || !reply.user) return null;

          const isCurrentUser = reply.user._id === currentUser?._id;
          const isSupport = ["Admin", "Support"].includes(reply.user.userRole);
          const alignClass = isCurrentUser
            ? "d-flex justify-content-end"
            : "d-flex justify-content-start";

          const avatarUrl = reply.user.avatarUrl
            ? `${API_URL}/${reply.user.avatarUrl}`
            : DEFAULT_AVATAR_URL;
          const currentUserAvatarUrl = currentUser?.avatarUrl
            ? `${API_URL}/${currentUser.avatarUrl}`
            : DEFAULT_AVATAR_URL;

          return (
            <ListGroup.Item
              key={reply._id}
              className={`border-0 bg-transparent px-0 py-2 ${alignClass}`}
            >
              <div className="d-flex w-100" style={{ maxWidth: "85%" }}>
                {!isCurrentUser && (
                  <Image
                    src={avatarUrl}
                    roundedCircle
                    width="45"
                    height="45"
                    className="flex-shrink-0 me-3 mt-1"
                    alt={`${reply.user.fullName}'s avatar`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = DEFAULT_AVATAR_URL;
                    }}
                  />
                )}
                <div className="flex-grow-1">
                  <Card
                    className={`reply-card ${
                      isCurrentUser ? "bg-primary-light" : "bg-light-subtle"
                    }`}
                  >
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold text-dark">
                          {isCurrentUser
                            ? t("ticketDetails.you", "You")
                            : reply.user.fullName ||
                              t("common.unknownUser", "Unknown User")}
                          {isSupport && !isCurrentUser && (
                            <Badge bg="info" className="ms-2">
                              {t("ticketDetails.supportBadge", "Support")}
                            </Badge>
                          )}
                        </span>
                        <span
                          className="text-muted small"
                          title={moment(reply.createdAt).format("llll")}
                        >
                          {moment(reply.createdAt).fromNow()}
                        </span>
                      </div>
                      <pre className="reply-message mb-0">{reply.message}</pre>
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="mt-3">
                          <hr className="my-2" />
                          <strong className="small d-block mb-2">
                            <FaPaperclip className="me-1" />{" "}
                            {t("createTicket.labels.attachments")}
                          </strong>
                          <ListGroup
                            variant="flush"
                            className="attachment-list bg-transparent"
                          >
                            {reply.attachments.map((att, idx) => (
                              <ListGroup.Item
                                key={idx}
                                className="bg-transparent border-0 p-0"
                              >
                                <a
                                  href={`${API_URL}/${att.filePath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="d-flex align-items-center text-decoration-none text-primary-hover p-1 rounded"
                                >
                                  <FileIcon fileType={att.fileType || ""} />
                                  <div className="flex-grow-1">
                                    <span className="fw-semibold small">
                                      {att.fileName}
                                    </span>
                                    <small className="d-block text-muted">
                                      {formatFileSize(att.fileSize)}
                                    </small>
                                  </div>
                                </a>
                              </ListGroup.Item>
                            ))}
                          </ListGroup>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
                {isCurrentUser && (
                  <Image
                    src={currentUserAvatarUrl}
                    roundedCircle
                    width="45"
                    height="45"
                    className="flex-shrink-0 ms-3 mt-1"
                    alt={t("ticketDetails.yourAvatar", "Your avatar")}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = DEFAULT_AVATAR_URL;
                    }}
                  />
                )}
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    </div>
  );
};

export default TicketReplies;