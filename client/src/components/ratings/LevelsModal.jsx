// src/components/modals/LevelsModal.jsx
import React, { useMemo } from "react";
import {
  Modal,
  Button,
  ListGroup,
  Badge,
  ProgressBar,
  Col,
  Row,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  FaStar,
  FaGift,
  FaAward,
  FaMedal,
  FaTrophy,
  FaGem,
  FaCrown,
  FaSkullCrossbones,
  FaDragon,
  FaShieldAlt,
  FaQuestionCircle,
  FaCheckCircle,
  FaLock,
} from "react-icons/fa";
import "./LevelsModal.css";

const BASE_POINTS_FOR_LEVEL_2_FRONTEND = 10;
const POINTS_INCREMENT_PER_LEVEL_STEP_FRONTEND = 5;
const BASE_REWARD_FOR_LEVEL_2_FRONTEND = 2;
const REWARD_INCREMENT_PER_LEVEL_FRONTEND = 2;
const DEFAULT_CURRENCY_FRONTEND = "TND";
const MAX_LEVEL_CAP_FRONTEND = 100;

function calculateCumulativePointsForLevelFrontend(targetLevel) {
  if (targetLevel <= 1) return 0;
  let totalPoints = 0;
  let pointsForCurrentStep = BASE_POINTS_FOR_LEVEL_2_FRONTEND;
  for (let i = 2; i <= targetLevel; i++) {
    totalPoints += pointsForCurrentStep;
    if (i < targetLevel) {
      pointsForCurrentStep += POINTS_INCREMENT_PER_LEVEL_STEP_FRONTEND;
    }
  }
  return totalPoints;
}
function calculateRewardForLevelFrontend(targetLevel) {
  if (targetLevel < 2)
    return { amount: 0, currency: DEFAULT_CURRENCY_FRONTEND };
  const rewardAmount =
    BASE_REWARD_FOR_LEVEL_2_FRONTEND +
    (targetLevel - 2) * REWARD_INCREMENT_PER_LEVEL_FRONTEND;
  return { amount: rewardAmount, currency: DEFAULT_CURRENCY_FRONTEND };
}

function determineReputationBadgeFrontend(numericLevel) {
  if (numericLevel >= 35)
    return {
      name: "Mythic",
      IconComponent: FaSkullCrossbones,
      color: "#A020F0",
      bgColor: "rgba(160, 32, 240, 0.08)",
      tierColor: "#A020F0",
    };
  if (numericLevel >= 30)
    return {
      name: "Legend",
      IconComponent: FaDragon,
      color: "#FF8C00",
      bgColor: "rgba(255, 140, 0, 0.08)",
      tierColor: "#FF8C00",
    };
  if (numericLevel >= 25)
    return {
      name: "Grandmaster",
      IconComponent: FaCrown,
      color: "#FF4500",
      bgColor: "rgba(255, 69, 0, 0.08)",
      tierColor: "#FF4500",
    };
  if (numericLevel >= 20)
    return {
      name: "Master",
      IconComponent: FaCrown,
      color: "#D4AF37",
      bgColor: "rgba(212, 175, 55, 0.08)",
      tierColor: "#D4AF37",
    };
  if (numericLevel >= 15)
    return {
      name: "Diamond",
      IconComponent: FaGem,
      color: "#00BFFF",
      bgColor: "rgba(0, 191, 255, 0.08)",
      tierColor: "#00BFFF",
    };
  if (numericLevel >= 10)
    return {
      name: "Platinum",
      IconComponent: FaShieldAlt,
      color: "#708090",
      bgColor: "rgba(112, 128, 144, 0.08)",
      tierColor: "#708090",
    };
  if (numericLevel >= 7)
    return {
      name: "Gold",
      IconComponent: FaTrophy,
      color: "#FFD700",
      bgColor: "rgba(255, 215, 0, 0.08)",
      tierColor: "#FFD700",
    };
  if (numericLevel >= 5)
    return {
      name: "Silver",
      IconComponent: FaMedal,
      color: "#A9A9A9",
      bgColor: "rgba(169, 169, 169, 0.08)",
      tierColor: "#A9A9A9",
    };
  if (numericLevel >= 3)
    return {
      name: "Bronze",
      IconComponent: FaAward,
      color: "#CD7F32",
      bgColor: "rgba(205, 127, 50, 0.08)",
      tierColor: "#CD7F32",
    };
  if (numericLevel >= 1)
    return {
      name: "Novice",
      IconComponent: FaStar,
      color: "#6C757D",
      bgColor: "rgba(108, 117, 125, 0.08)",
      tierColor: "#6C757D",
    };
  return {
    name: "Unranked",
    IconComponent: FaQuestionCircle,
    color: "#6C757D",
    bgColor: "rgba(108, 117, 125, 0.08)",
    tierColor: "#6C757D",
  };
}

const LevelsModal = ({ show, handleClose, currentUserData }) => {
  const { t } = useTranslation();

  const levelsToDisplay = useMemo(() => {
    const data = [];
    const userLevel = currentUserData?.level || 1;
    const startLevel = Math.max(1, userLevel - 2);
    const displayLimit = Math.min(MAX_LEVEL_CAP_FRONTEND, userLevel + 5, 25);
    for (let i = startLevel; i <= displayLimit; i++) {
      const pointsReq = calculateCumulativePointsForLevelFrontend(i);
      const reward = calculateRewardForLevelFrontend(i);
      const badgeInfo = determineReputationBadgeFrontend(i);
      const isClaimed =
        currentUserData?.claimedLevelRewards?.includes(i) && reward.amount > 0;
      const isCurrent = currentUserData?.level === i;
      const isAchieved = currentUserData?.level >= i;
      const isNextLevel = currentUserData?.level + 1 === i;
      let progressWithinLevel = 0;
      let pointsForThisStep = 0;
      let pointsEarnedInThisStep = 0;
      if (i < MAX_LEVEL_CAP_FRONTEND) {
        const pointsForCurrentLevelStart =
          calculateCumulativePointsForLevelFrontend(i);
        const pointsForNextLevelStart =
          calculateCumulativePointsForLevelFrontend(i + 1);
        pointsForThisStep =
          pointsForNextLevelStart - pointsForCurrentLevelStart;
        if (isCurrent) {
          pointsEarnedInThisStep = Math.max(
            0,
            (currentUserData?.reputationPoints || 0) -
              pointsForCurrentLevelStart
          );
          progressWithinLevel =
            pointsForThisStep > 0
              ? Math.min(
                  100,
                  Math.round((pointsEarnedInThisStep / pointsForThisStep) * 100)
                )
              : 0;
        } else if (isAchieved) {
          progressWithinLevel = 100;
          pointsEarnedInThisStep = pointsForThisStep;
        }
      } else if (i === MAX_LEVEL_CAP_FRONTEND && isAchieved) {
        progressWithinLevel = 100;
      }
      data.push({
        level: i,
        pointsRequired: pointsReq,
        rewardAmount: reward.amount,
        rewardCurrency: reward.currency,
        badgeName: badgeInfo.name,
        BadgeIcon: badgeInfo.IconComponent,
        badgeIconColor: badgeInfo.color,
        badgeIconBgColor: badgeInfo.bgColor,
        tierColor: badgeInfo.tierColor,
        isCurrentLevel: isCurrent,
        isRewardClaimed: isClaimed,
        isAchieved: isAchieved,
        isNextLevel: isNextLevel,
        progress: progressWithinLevel,
        pointsNeededForNextStep: pointsForThisStep,
        pointsEarnedInCurrentStep: pointsEarnedInThisStep,
      });
    }
    return data;
  }, [currentUserData]);

  return (
    <Modal
      show={show}
      onHide={handleClose}
      dialogClassName="levels-modal-final"
      centered
      scrollable
    >
      <Modal.Header closeButton className="levels-modal-header-final">
        <Modal.Title className="levels-modal-title-final">
          <FaStar className="title-icon-final" /> {t("levelsModal.title")}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="levels-modal-body-final p-0">
        {currentUserData && (
          <div className="current-user-summary-final p-3">
            {t("levelsModal.summary", {
              level: currentUserData.level,
              badgeName: t(
                `reputationLevels.${
                  determineReputationBadgeFrontend(currentUserData.level).name
                }`
              ),
              points: currentUserData.reputationPoints,
            })}
          </div>
        )}
        <ListGroup variant="flush" className="m-0">
          {levelsToDisplay.map((item) => (
            <ListGroup.Item
              key={item.level}
              className={`level-entry-final ${
                item.isCurrentLevel ? "current-level-entry-final" : ""
              } ${
                !item.isAchieved
                  ? "locked-level-entry-final"
                  : item.isAchieved && !item.isCurrentLevel
                  ? "achieved-level-entry-final"
                  : ""
              }`}
              style={{ "--level-tier-color": item.tierColor }}
            >
              <Row className="gx-3 align-items-center">
                <Col xs="auto" className="level-icon-col-final-v2">
                  <div
                    className="level-badge-icon-wrapper-final"
                    style={{
                      backgroundColor:
                        item.isAchieved || item.isCurrentLevel
                          ? item.badgeIconBgColor
                          : "#e9ecef",
                    }}
                  >
                    <item.BadgeIcon
                      size={28}
                      style={{
                        color:
                          item.isAchieved || item.isCurrentLevel
                            ? item.badgeIconColor
                            : "#adb5bd",
                      }}
                    />
                  </div>
                </Col>
                <Col className="level-main-content-area-final">
                  <div className="level-top-info-final">
                    <div>
                      <h6 className="level-title-final mb-0">
                        {t("common.level", { level: item.level })}
                      </h6>
                      <span
                        className="badge-name-final"
                        style={{
                          color:
                            item.isAchieved || item.isCurrentLevel
                              ? item.tierColor
                              : "#6c757d",
                        }}
                      >
                        {t(`reputationLevels.${item.badgeName}`)}
                      </span>
                    </div>
                    {item.isCurrentLevel && (
                      <Badge pill className="current-tag-final ms-2">
                        {t("levelsModal.current")}
                      </Badge>
                    )}
                  </div>
                  {item.isCurrentLevel ||
                  item.isNextLevel ||
                  (item.isAchieved && !item.isCurrentLevel) ? (
                    <>
                      <div className="level-details-final mt-2">
                        <div className="detail-item-final">
                          <span className="detail-label-final">
                            {t("levelsModal.requires")}:
                          </span>
                          <span className="detail-value-final">
                            {t("levelsModal.totalPoints", {
                              count: item.pointsRequired,
                            })}
                          </span>
                        </div>
                        <div className="detail-item-final">
                          <span className="detail-label-final">
                            {t("levelsModal.reward")}:
                          </span>
                          {item.rewardAmount > 0 ? (
                            <span className="detail-value-final reward-value-final">
                              {item.isRewardClaimed ? (
                                <FaCheckCircle
                                  className="text-success me-1"
                                  title={t("levelsModal.rewardClaimed")}
                                />
                              ) : item.isAchieved ? (
                                <FaGift
                                  className="text-info me-1"
                                  title={t("levelsModal.rewardUnlocked")}
                                />
                              ) : (
                                <FaGift
                                  className="text-muted me-1"
                                  title={t("levelsModal.rewardForLevel")}
                                />
                              )}
                              {item.rewardAmount} {item.rewardCurrency}
                            </span>
                          ) : (
                            <span className="detail-value-final text-muted">
                              {t("levelsModal.noCashReward")}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.isAchieved &&
                        item.level < MAX_LEVEL_CAP_FRONTEND && (
                          <div className="level-progress-bar-wrapper-final mt-2">
                            <div className="d-flex align-items-center">
                              <ProgressBar
                                now={item.progress}
                                className={`level-progress-final flex-grow-1 ${
                                  item.isCurrentLevel
                                    ? "current"
                                    : item.isAchieved
                                    ? "achieved"
                                    : ""
                                }`}
                              />
                              {item.isAchieved && !item.isCurrentLevel && (
                                <span className="progress-text-final text-success-emphasis small ms-2 achieved-text-final">
                                  <FaCheckCircle className="me-1" />{" "}
                                  {t("levelsModal.achieved")}
                                </span>
                              )}
                            </div>
                            {item.isCurrentLevel &&
                              item.pointsNeededForNextStep > 0 && (
                                <div className="progress-text-final text-muted small mt-1 text-end">
                                  {t("levelsModal.progressText", {
                                    earned: item.pointsEarnedInCurrentStep,
                                    needed: item.pointsNeededForNextStep,
                                    nextLevel: item.level + 1,
                                  })}
                                </div>
                              )}
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="locked-details-final mt-2">
                      <FaLock size={12} className="me-1 text-muted" />
                      <span className="text-muted small">
                        {t("levelsModal.unlockDetails", {
                          points: item.pointsRequired,
                        })}
                      </span>
                    </div>
                  )}
                </Col>
              </Row>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer className="levels-modal-footer-final">
        <Button
          variant="outline-primary"
          onClick={handleClose}
          className="close-button-final"
        >
          {t("common.close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
export default LevelsModal;