import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Button,
  Badge,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  getNews,
  likeNews,
  dislikeNews,
  markNewsAsRead,
} from "../redux/actions/newsAction";
import {
  FaThumbsUp,
  FaThumbsDown,
  FaEye,
  FaExternalLinkAlt,
  FaArrowRight,
} from "react-icons/fa";
import { formatErrorMessage } from "../utils/errorUtils";
import NewsDetailsModal from "../components/commun/NewsDetailsModal";
import "./NewsPage.css";

const NewsItem = ({
  post,
  onLike,
  onDislike,
  onMarkAsRead,
  currentUserId,
  actionLoading,
}) => {
  const { t, i18n } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const currentLang = i18n.language;

  const title = post.title[currentLang] || post.title.en;
  const content = post.content[currentLang] || post.content.en;

  const isRead = currentUserId && post.readBy.includes(currentUserId);
  const hasLiked = currentUserId && post.likes.includes(currentUserId);
  const hasDisliked = currentUserId && post.dislikes.includes(currentUserId);

  const handleOpenModal = (e) => {
    e.stopPropagation(); // منع أي نقرات أخرى
    if (!isRead) {
      onMarkAsRead([post._id]);
    }
    setShowDetails(true);
  };

  return (
    <>
      <Card
        className={`mb-4 shadow-sm news-card ${!isRead ? "unread-news" : ""}`}
      >
        {post.mediaUrl && post.mediaType === "image" && (
          <div className="card-img-top-container">
            <Card.Img
              variant="top"
              src={`${
                process.env.REACT_APP_BACKEND_URL || "http://localhost:8000"
              }/${post.mediaUrl}`}
            />
            <div className="card-img-overlay-custom" onClick={handleOpenModal}>
              <Button variant="light" className="read-more-btn">
                <FaExternalLinkAlt className="me-2" /> {t("news.readMore")}
              </Button>
            </div>
          </div>
        )}
        <Card.Body>
          {!isRead && (
            <Badge bg="primary" className="position-absolute top-0 start-0 m-2">
              {t("news.new")}
            </Badge>
          )}
          <Card.Title as="h3" className="mb-3">
            {title}
          </Card.Title>
          <Card.Subtitle className="mb-3 text-muted">
            {t("news.postedOn", {
              date: new Date(post.createdAt).toLocaleDateString(i18n.language),
            })}
          </Card.Subtitle>

          <Card.Text className="content-excerpt">{content}</Card.Text>

          <div className="read-more-container mt-3">
            <Button
              variant="link"
              className="read-more-link p-0"
              onClick={handleOpenModal}
            >
              {t("news.readMore")} <FaArrowRight className="ms-1" />
            </Button>
          </div>
        </Card.Body>
        <Card.Footer className="d-flex justify-content-between align-items-center bg-light">
          <div className="d-flex align-items-center gap-3">
            <Button
              variant={hasLiked ? "primary" : "outline-primary"}
              size="sm"
              onClick={() => onLike(post._id)}
              disabled={!currentUserId || actionLoading}
            >
              <FaThumbsUp className="me-2" /> {post.likes.length}
            </Button>
            <Button
              variant={hasDisliked ? "danger" : "outline-danger"}
              size="sm"
              onClick={() => onDislike(post._id)}
              disabled={!currentUserId || actionLoading}
            >
              <FaThumbsDown className="me-2" /> {post.dislikes.length}
            </Button>
          </div>
          <div className="d-flex align-items-center text-muted">
            <FaEye className="me-2" />
            <span>
              {post.readBy.length} {t("news.views")}
            </span>
          </div>
        </Card.Footer>
      </Card>

      <NewsDetailsModal
        show={showDetails}
        onHide={() => setShowDetails(false)}
        post={post}
      />
    </>
  );
};

const NewsPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.userReducer);
  const { posts, loading, error, pagination, unreadCount } = useSelector(
    (state) => state.newsReducer
  );
  const actionLoadingState = useSelector(
    (state) => state.newsReducer.actionLoading
  );

  useEffect(() => {
    dispatch(getNews());
  }, [dispatch]);

  const handleMarkAllRead = () => {
    const unreadPostIds = posts
      .filter((post) => !post.readBy.includes(user?._id))
      .map((p) => p._id);
    if (unreadPostIds.length > 0) {
      dispatch(markNewsAsRead(unreadPostIds));
    }
  };

  return (
    <Container className="py-5">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="fw-bold">{t("news.pageTitle")}</h1>
        </Col>
        <Col xs="auto">
          {user && unreadCount > 0 && (
            <Button variant="primary" onClick={handleMarkAllRead}>
              {t("news.markAllRead", { count: unreadCount })}
            </Button>
          )}
        </Col>
      </Row>

      {loading && (
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
        </div>
      )}
      {error && <Alert variant="danger">{formatErrorMessage(error, t)}</Alert>}

      {!loading && posts.length === 0 && (
        <Alert variant="info" className="text-center">
          {t("news.noNews")}
        </Alert>
      )}

      {posts.map((post) => (
        <NewsItem
          key={post._id}
          post={post}
          onLike={(postId) => dispatch(likeNews(postId))}
          onDislike={(postId) => dispatch(dislikeNews(postId))}
          onMarkAsRead={(postIds) => dispatch(markNewsAsRead(postIds))}
          currentUserId={user?._id}
          actionLoading={actionLoadingState[post._id]}
        />
      ))}

      {/* يمكنك إضافة Pagination هنا لاحقًا باستخدام بيانات `pagination` */}
    </Container>
  );
};

export default NewsPage;
