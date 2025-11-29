import React, { useEffect } from 'react';
import { Container, Row, Col, Card, ProgressBar, Button, Badge, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { getUserQuests, claimReward } from '../redux/actions/questAction';
import { FaCoins, FaTrophy, FaCheckCircle, FaTasks } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import './QuestsPage.css'; // سننشئه تالياً

const QuestsPage = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    
    const { quests, credits, loading } = useSelector(state => state.questReducer);

    useEffect(() => {
        dispatch(getUserQuests());
    }, [dispatch]);

    const handleClaim = (questId) => {
        dispatch(claimReward(questId));
    };

    // ترتيب المهمات: القابلة للاستلام أولاً، ثم الجارية، ثم المكتملة
    const sortedQuests = [...quests].sort((a, b) => {
        const aClaimable = a.isCompleted && !a.isClaimed;
        const bClaimable = b.isCompleted && !b.isClaimed;
        if (aClaimable && !bClaimable) return -1;
        if (!aClaimable && bClaimable) return 1;
        if (a.isClaimed && !b.isClaimed) return 1;
        if (!a.isClaimed && b.isClaimed) return -1;
        return 0;
    });

    return (
        <Container className="py-5 quests-page-container">
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-5 header-section text-white p-4 rounded-3 shadow-sm">
                <div>
                    <h2 className="fw-bold mb-1">
                        <FaTasks className="me-2" /> {t('quests.pageTitle')}
                    </h2>
                    <p className="mb-0 opacity-75">{t('quests.subtitle')}</p>
                </div>
                <div className="credits-display bg-white text-dark px-4 py-2 rounded-pill shadow fw-bold">
                    <FaCoins className="text-warning me-2" />
                    {credits} Credits
                </div>
            </div>

            {loading && quests.length === 0 ? (
                <div className="text-center py-5 text-white">
                    <Spinner animation="border" />
                </div>
            ) : (
                <Row className="g-4">
                    {sortedQuests.map((quest) => {
                        const progressPercent = Math.min(100, (quest.progress / quest.targetCount) * 100);
                        const isClaimable = quest.isCompleted && !quest.isClaimed;

                        return (
                            <Col key={quest._id} md={6} lg={4}>
                                <Card className={`quest-card h-100 border-0 shadow-sm ${quest.isClaimed ? 'claimed' : ''} ${isClaimable ? 'claimable' : ''}`}>
                                    <Card.Body className="d-flex flex-column">
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div className="quest-icon-wrapper">
                                                <FaTrophy className={isClaimable ? 'text-warning fa-beat' : 'text-muted'} size={24} />
                                            </div>
                                            <Badge bg={quest.type === 'Daily' ? 'info' : 'primary'} pill>
                                                {t(`quests.types.${quest.type}`, quest.type)}
                                            </Badge>
                                        </div>

                                        <Card.Title className="fw-bold mb-2">
                                            {quest.title[i18n.language] || quest.title.en}
                                        </Card.Title>
                                        
                                        <Card.Text className="text-muted small flex-grow-1">
                                            {quest.description[i18n.language] || quest.description.en}
                                        </Card.Text>

                                        {/* Rewards Display */}
                                        <div className="rewards-badge mb-3">
                                            {quest.reward.credits > 0 && (
                                                <Badge bg="light" text="dark" className="me-2 border">
                                                    <FaCoins className="text-warning me-1" /> +{quest.reward.credits}
                                                </Badge>
                                            )}
                                            {quest.reward.xp > 0 && (
                                                <Badge bg="light" text="dark" className="border">
                                                    ⭐ +{quest.reward.xp} XP
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-auto">
                                            <div className="d-flex justify-content-between small mb-1 fw-bold">
                                                <span>{t('quests.progress')}</span>
                                                <span>{quest.progress} / {quest.targetCount}</span>
                                            </div>
                                            <ProgressBar 
                                                now={progressPercent} 
                                                variant={isClaimable ? "success" : "primary"} 
                                                className="mb-3" 
                                                style={{height: '8px'}}
                                            />

                                            {isClaimable ? (
                                                <Button 
                                                    variant="success" 
                                                    className="w-100 fw-bold shadow-sm"
                                                    onClick={() => handleClaim(quest._id)}
                                                >
                                                    {t('quests.claimBtn')}
                                                </Button>
                                            ) : quest.isClaimed ? (
                                                <Button variant="secondary" className="w-100" disabled>
                                                    <FaCheckCircle className="me-1" /> {t('quests.completedBtn')}
                                                </Button>
                                            ) : (
                                                <Button variant="outline-primary" className="w-100" disabled>
                                                    {t('quests.inProgressBtn')}
                                                </Button>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}
        </Container>
    );
};

export default QuestsPage;