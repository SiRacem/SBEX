import React, { useEffect } from 'react';
import { Container, Row, Col, Card, ProgressBar, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { getUserQuests, claimReward } from '../redux/actions/questAction';
import { FaCoins, FaTrophy, FaCheckCircle, FaTasks, FaGift } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { formatErrorMessage } from '../utils/errorUtils'; 
import './QuestsPage.css'; 

const QuestsPage = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    
    // [!!!] جلبنا freeSpins من state.userReducer [!!!]
    const { user } = useSelector(state => state.userReducer || {});
    const { quests, credits, loading, error } = useSelector(state => state.questReducer);

    useEffect(() => {
        dispatch(getUserQuests());
    }, [dispatch]);

    const handleClaim = (questId) => {
        dispatch(claimReward(questId));
    };

    const sortedQuests = [...(quests || [])].sort((a, b) => {
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
            <div className="d-flex justify-content-between align-items-center mb-5 header-section text-white p-4 rounded-3 shadow-sm flex-wrap gap-3">
                <div>
                    <h2 className="fw-bold mb-1">
                        <FaTasks className="me-2" /> {t('quests.pageTitle')}
                    </h2>
                    <p className="mb-0 opacity-75">{t('quests.subtitle')}</p>
                </div>
                
                {/* [!!!] عرض الرصيد واللفات بشكل مترجم [!!!] */}
                <div className="d-flex gap-2">
                    <div className="credits-display bg-white text-dark px-3 py-2 rounded-pill shadow fw-bold d-flex align-items-center">
                        <FaCoins className="text-warning me-2" />
                        {/* ترجمة العملات */}
                        {t('quests.header.credits', { count: credits || 0 })}
                    </div>
                    
                    {/* [!!!] خانة اللفات المجانية الجديدة [!!!] */}
                    <div className="credits-display bg-success text-white px-3 py-2 rounded-pill shadow fw-bold d-flex align-items-center">
                        <FaGift className="text-white me-2" />
                        {/* ترجمة اللفات */}
                        {t('quests.header.freeSpins', { count: user?.freeSpins || 0 })}
                    </div>
                </div>
            </div>

            {error && (
                <Alert variant="danger" className="mb-4">
                    {formatErrorMessage(error, t)}
                </Alert>
            )}

            {loading && (!quests || quests.length === 0) ? (
                <div className="text-center py-5 text-white">
                    <Spinner animation="border" />
                    <p className="mt-2">{t('common.loading')}</p>
                </div>
            ) : (
                <Row className="g-4">
                    {sortedQuests.length > 0 ? sortedQuests.map((quest) => {
                        if (!quest) return null;

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
                                            {quest.title ? (quest.title[i18n.language] || quest.title.en) : 'Untitled'}
                                        </Card.Title>
                                        
                                        <Card.Text className="text-muted small flex-grow-1">
                                            {quest.description ? (quest.description[i18n.language] || quest.description.en) : ''}
                                        </Card.Text>

                                        <div className="rewards-badge mb-3 d-flex flex-wrap gap-2">
                                            {quest.reward?.credits > 0 && (
                                                <Badge bg="light" text="dark" className="border">
                                                    <FaCoins className="text-warning me-1" /> +{quest.reward.credits}
                                                </Badge>
                                            )}
                                            {quest.reward?.xp > 0 && (
                                                <Badge bg="light" text="dark" className="border">
                                                    ⭐ +{quest.reward.xp} XP
                                                </Badge>
                                            )}
                                            {/* [!!!] ترجمة كلمة Spin [!!!] */}
                                            {quest.reward?.freeSpins > 0 && (
                                                <Badge bg="success" className="border border-success">
                                                    <FaGift className="me-1" /> +{quest.reward.freeSpins} {t('quests.rewards.spin')}
                                                </Badge>
                                            )}
                                        </div>

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
                    }) : (
                        <div className="text-center w-100 py-5 text-white">
                            <p>{t('quests.noQuests')}</p>
                        </div>
                    )}
                </Row>
            )}
        </Container>
    );
};

export default QuestsPage;