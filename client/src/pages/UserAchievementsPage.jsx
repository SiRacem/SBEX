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
import "./UserAchievementsPage.css";

const AchievementCard = ({ achievement, unlocked, lang }) => {
  const { t } = useTranslation();
  const title = achievement.title[lang] || achievement.title.ar;
  const description = achievement.description[lang] || achievement.description.ar;
  const categoryClass = `achievement-${achievement.category?.toLowerCase() || 'special'}`;

  return (
    <Card
      className={`h-100 shadow-sm achievement-card ${unlocked ? "unlocked" : "locked"} ${unlocked ? categoryClass : ''}`}
    >
      <Card.Body className="d-flex flex-column text-center">
        <div className={`achievement-icon-wrapper mb-3 ${unlocked ? 'glow' : ''}`}>
          <i
            className={`${achievement.icon} fa-3x achievement-icon`}
          ></i>
          {!unlocked && <div className="lock-overlay"><FaLock /></div>}
        </div>
        <Card.Title as="h5" className="fw-bold achievement-title">
          {title}
        </Card.Title>
        <Card.Text className="text-muted flex-grow-1 small">{description}</Card.Text>

        {unlocked ? (
          <Badge bg="light" text="dark" className="mt-auto align-self-center border status-badge">
            <FaTrophy className="me-1 text-warning" /> {t('achievements.unlocked')}
          </Badge>
        ) : (
          <Badge bg="secondary" className="mt-auto align-self-center opacity-50">
            {t('achievements.locked')}
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
    if (!user?.achievements) return new Set();
    return new Set(user.achievements.map((a) => {
      return a.achievement._id ? a.achievement._id.toString() : a.achievement.toString();
    }));
  }, [user]);

  const unlockedCount = userAchievementIds.size;
  const totalCount = availableAchievements.length;
  const progress = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

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

      <Card className="mb-5 shadow-sm border-0 bg-gradient-primary text-white" style={{ background: 'linear-gradient(45deg, #2b32b2, #1488cc)' }}>
        <Card.Body className="p-4">
          <Row className="align-items-center text-white">
            <Col md={8}>
              <Card.Title className="fs-3 mb-3">{t("achievements.progressTitle")}</Card.Title>
              <div className="d-flex align-items-center mb-2">
                <ProgressBar
                  now={progress}
                  className="flex-grow-1 me-3 bg-white-50"
                  variant="warning"
                  style={{ height: "15px", borderRadius: '10px' }}
                />
                <span className="fw-bold">{progress}%</span>
              </div>
              <p className="mb-0 opacity-75">
                {t("achievements.progressSubtitle", {
                  unlocked: unlockedCount,
                  total: totalCount,
                })}
              </p>
            </Col>
            <Col md={4} className="text-center text-md-end mt-3 mt-md-0">
              <FaTrophy size="5em" className="text-warning drop-shadow" />
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
                <h3 className="category-title mb-4 border-bottom pb-2">
                  <span className={`cat-indicator cat-${category.toLowerCase()}`}></span>
                  {t(`admin.achievements.categories.${category}`, category)}
                </h3>
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