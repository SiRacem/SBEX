// src/pages/UserAchievementsPage.jsx

import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  ProgressBar,
  Badge,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { FaTrophy, FaLock } from "react-icons/fa";
import { getAvailableAchievements } from "../redux/actions/achievementAction";
import "./UserAchievementsPage.css"; // سنقوم بإنشاء هذا الملف للتنسيق

const AchievementCard = ({ achievement, unlocked, lang }) => {
  const { t } = useTranslation();
  const title = achievement.title[lang] || achievement.title.ar;
  const description =
    achievement.description[lang] || achievement.description.ar;

  return (
    <Card
      className={`h-100 shadow-sm achievement-card ${
        unlocked ? "unlocked" : "locked"
      }`}
    >
      <Card.Body className="d-flex flex-column text-center">
        <div className="achievement-icon-wrapper mb-3">
          <i
            className={`${achievement.icon} fa-3x ${
              unlocked ? "text-warning" : "text-muted"
            }`}
          ></i>
          {!unlocked && <FaLock className="lock-overlay" />}
        </div>
        <Card.Title as="h5" className="fw-bold">
          {title}
        </Card.Title>
        <Card.Text className="text-muted flex-grow-1">{description}</Card.Text>
        {unlocked && (
          <Badge pill bg="success" className="mt-auto align-self-center">
            <FaTrophy className="me-1" /> {t("achievements.unlocked")}
          </Badge>
        )}
      </Card.Body>
    </Card>
  );
};

const UserAchievementsPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const currentLang = i18n.language;

  const { user } = useSelector((state) => state.userReducer);
  const { availableAchievements, loadingAvailable, error } = useSelector(
    (state) => state.achievementReducer
  );

  useEffect(() => {
    dispatch(getAvailableAchievements());
  }, [dispatch]);

  const userAchievementIds = useMemo(() => {
    return new Set(user?.achievements?.map((a) => a.achievement) || []);
  }, [user]);

  const unlockedCount = userAchievementIds.size;
  const totalCount = availableAchievements.length;
  const progress =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const categorizedAchievements = useMemo(() => {
    if (!availableAchievements) return {};
    return availableAchievements.reduce((acc, ach) => {
      const category = ach.category || "SPECIAL";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(ach);
      return acc;
    }, {});
  }, [availableAchievements]);

  const categoryOrder = ["SALES", "PURCHASES", "COMMUNITY", "SPECIAL"];

  return (
    <Container className="py-5">
      <Row className="mb-4 align-items-center">
        <Col>
          <h1 className="fw-bold">{t("achievements.pageTitle")}</h1>
          <p className="text-muted">{t("achievements.pageSubtitle")}</p>
        </Col>
      </Row>

      <Card className="mb-5 shadow-sm">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={8}>
              <Card.Title>{t("achievements.progressTitle")}</Card.Title>
              <ProgressBar
                now={progress}
                label={`${progress}%`}
                variant="warning"
                className="mb-2"
                style={{ height: "25px" }}
              />
              <p className="mb-0 text-muted">
                {t("achievements.progressSubtitle", {
                  unlocked: unlockedCount,
                  total: totalCount,
                })}
              </p>
            </Col>
            <Col md={4} className="text-center text-md-end mt-3 mt-md-0">
              <FaTrophy size="4em" className="text-warning" />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {loadingAvailable && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">{t("common.loading")}</p>
        </div>
      )}
      {error && (
        <Alert variant="danger">{t("achievements.errorLoading")}</Alert>
      )}

      {!loadingAvailable &&
        categoryOrder.map(
          (category) =>
            categorizedAchievements[category] && (
              <div key={category} className="mb-5">
                <h2 className="category-title mb-4">
                  {t(`admin.achievements.categories.${category}`, category)}
                </h2>
                <Row xs={1} sm={2} md={3} lg={4} className="g-4">
                  {categorizedAchievements[category].map((ach) => (
                    <Col key={ach._id}>
                      <AchievementCard
                        achievement={ach}
                        unlocked={userAchievementIds.has(ach._id)}
                        lang={currentLang}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )
        )}
    </Container>
  );
};

export default UserAchievementsPage;