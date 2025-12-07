// src/pages/TournamentDetailsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getTournamentDetails, joinTournament, checkInTournament, startTournament } from '../redux/actions/tournamentAction';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Badge, Button, Modal, Form, Spinner, Tab, Tabs } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { FaTrophy, FaClock, FaGamepad, FaCheckCircle, FaPlay } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './TournamentDetailsPage.css';

const TournamentDetailsPage = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { currentTournament, loadingDetails, loadingJoin, loadingStart, loadingCheckIn } = useSelector(state => state.tournamentReducer);
    const { user } = useSelector(state => state.userReducer);

    const [showJoinModal, setShowJoinModal] = useState(false);
    const [teamData, setTeamData] = useState({ selectedTeam: '', selectedTeamLogo: '' });
    const [key, setKey] = useState('overview');

    useEffect(() => {
        dispatch(getTournamentDetails(id));
    }, [dispatch, id]);

    if (loadingDetails || !currentTournament) {
        return <div className="loading-screen"><Spinner animation="border" variant="primary" /></div>;
    }

    const isParticipant = currentTournament.participants.some(p => p.user?._id === user?._id);
    const myParticipantData = currentTournament.participants.find(p => p.user?._id === user?._id);
    const isCheckedIn = myParticipantData?.isCheckedIn;

    const handleJoinSubmit = async () => {
        if (!teamData.selectedTeam) return toast.error(t('tournamentDetails.errors.enterTeamName', 'Please enter a team name'));
        
        const result = await dispatch(joinTournament(id, teamData));
        if (result.success) {
            toast.success(t('tournamentDetails.toasts.joinSuccess'));
            setShowJoinModal(false);
        } else {
            toast.error(result.message);
        }
    };

    const handleCheckIn = async () => {
        const result = await dispatch(checkInTournament(id));
        if (result.success) toast.success(t('tournamentDetails.toasts.checkInSuccess'));
        else toast.error(result.message);
    };

    const handleStart = async () => {
        const result = await dispatch(startTournament(id));
        if (result.success) toast.success(t('tournamentDetails.toasts.startSuccess'));
        else toast.error(result.message);
    };

    return (
        <div className="tournament-details-container">
            {/* --- Header Banner --- */}
            <div className="details-headers">
                <div className="header-content">
                    <motion.h1 
                        initial={{ y: -20, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }}
                        className="tournament-title"
                    >
                        {currentTournament.title}
                    </motion.h1>
                    <div className="tournament-meta">
                        <Badge bg="info" className="meta-badge"><FaGamepad /> eFootball</Badge>
                        <Badge bg={currentTournament.status === 'open' ? 'success' : 'secondary'} className="meta-badge">
                            {t(`status.${currentTournament.status}`)}
                        </Badge>
                        <span className="text-light ms-3"><FaClock /> {new Date(currentTournament.startDate).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <Container className="mt-4">
                <Row>
                    {/* --- Left Column: Info & Tabs --- */}
                    <Col lg={8}>
                        <div className="glass-panel main-panel">
                            <Tabs
                                id="tournament-tabs"
                                activeKey={key}
                                onSelect={(k) => setKey(k)}
                                className="mb-4 custom-tabs"
                            >
                                <Tab eventKey="overview" title={t('tournamentDetails.tabs.overview')}>
                                    <div className="tab-content-wrapper">
                                        <h4 className="section-title">{t('tournamentDetails.headers.description')}</h4>
                                        <p className="text-gray">{currentTournament.description || t('tournamentDetails.noDescription')}</p>
                                        
                                        <h4 className="section-title mt-4">{t('tournamentDetails.headers.rules')}</h4>
                                        <ul className="rules-list">
                                            <li><strong>{t('tournamentDetails.rules.teamType')}:</strong> {currentTournament.rules.teamCategory}</li>
                                            <li><strong>{t('tournamentDetails.rules.matchTime')}:</strong> {currentTournament.rules.eFootballMatchTime}</li>
                                            <li><strong>{t('tournamentDetails.rules.duration')}:</strong> {currentTournament.rules.matchDurationMinutes} {t('tournamentDetails.rules.mins')}</li>
                                        </ul>

                                        <h4 className="section-title mt-4">{t('tournamentDetails.headers.prizes')}</h4>
                                        <div className="prizes-grid">
                                            <div className="prize-card gold">
                                                <FaTrophy className="prize-icon" />
                                                <span className="prize-rank">{t('tournamentDetails.prizes.first')}</span>
                                                <span className="prize-amount">{currentTournament.prizesDistribution.firstPlace} {t('common.currency', 'TND')}</span>
                                            </div>
                                            <div className="prize-card silver">
                                                <FaTrophy className="prize-icon" />
                                                <span className="prize-rank">{t('tournamentDetails.prizes.second')}</span>
                                                <span className="prize-amount">{currentTournament.prizesDistribution.secondPlace} {t('common.currency', 'TND')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Tab>
                                
                                <Tab eventKey="participants" title={`${t('tournamentDetails.tabs.participants')} (${currentTournament.participants.length}/${currentTournament.maxParticipants})`}>
                                    <div className="participants-grid">
                                        {currentTournament.participants.map((p, idx) => (
                                            <motion.div 
                                                key={idx} 
                                                className={`participant-card ${p.user?._id === user?._id ? 'me' : ''}`}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                            >
                                                <img src={p.user?.avatarUrl || "https://via.placeholder.com/40"} alt="avatar" className="p-avatar" />
                                                <div className="p-info">
                                                    <span className="p-name">{p.username}</span>
                                                    <span className="p-team">{p.selectedTeam}</span>
                                                </div>
                                                {p.isCheckedIn && <FaCheckCircle className="text-success ms-auto" title={t('tournamentDetails.status.checkedIn')} />}
                                            </motion.div>
                                        ))}
                                    </div>
                                </Tab>

                                <Tab eventKey="bracket" title={t('tournamentDetails.tabs.bracket')}>
                                    <div className="bracket-placeholder">
                                        {currentTournament.status === 'open' || currentTournament.status === 'check-in' ? (
                                            <div className="text-center py-5">
                                                <FaClock size={40} className="text-muted mb-3" />
                                                <h5>{t('tournamentDetails.bracket.placeholder')}</h5>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <Button variant="outline-primary" onClick={() => navigate(`/dashboard/matches/${currentTournament._id}`)}>
                                                    {t('tournamentDetails.bracket.viewFull')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </Tab>
                            </Tabs>
                        </div>
                    </Col>

                    {/* --- Right Column: Actions --- */}
                    <Col lg={4}>
                        <div className="glass-panel action-panel">
                            <h4 className="panel-title">{t('tournamentDetails.sidebar.yourStatus')}</h4>
                            
                            {!isParticipant ? (
                                <>
                                    <div className="entry-fee-display">
                                        <span>{t('tournamentDetails.sidebar.entryFee')}</span>
                                        <h3>{currentTournament.entryFee} {t('common.currency', 'TND')}</h3>
                                    </div>
                                    <Button 
                                        className="w-100 action-btn-primary" 
                                        onClick={() => setShowJoinModal(true)}
                                        disabled={loadingJoin || currentTournament.status !== 'open'}
                                    >
                                        {loadingJoin ? <Spinner size="sm"/> : t('tournamentDetails.sidebar.joinBtn')}
                                    </Button>
                                </>
                            ) : (
                                <div className="participant-status">
                                    <AlertBadge variant="success">{t('tournamentDetails.status.registered')}</AlertBadge>
                                    <div className="team-display mt-3">
                                        <small>{t('tournamentDetails.sidebar.playingAs')}</small>
                                        <h5>{myParticipantData.selectedTeam}</h5>
                                    </div>

                                    {/* Check-in Button */}
                                    {currentTournament.status === 'check-in' && !isCheckedIn && (
                                        <Button 
                                            className="w-100 mt-3 btn-warning fw-bold"
                                            onClick={handleCheckIn}
                                            disabled={loadingCheckIn}
                                        >
                                            {loadingCheckIn ? <Spinner size="sm"/> : t('tournamentDetails.sidebar.checkInBtn')}
                                        </Button>
                                    )}

                                    {isCheckedIn && (
                                        <div className="mt-3 text-success text-center fw-bold">
                                            <FaCheckCircle /> {t('tournamentDetails.status.checkedInMsg')}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Admin Controls */}
                            {user.userRole === 'Admin' && (
                                <div className="admin-controls mt-4 pt-3 border-top border-secondary">
                                    <h6>{t('tournamentDetails.sidebar.adminControls')}</h6>
                                    <Button 
                                        variant="danger" 
                                        className="w-100"
                                        onClick={handleStart}
                                        disabled={loadingStart || currentTournament.status === 'active'}
                                    >
                                        {loadingStart ? <Spinner size="sm"/> : <><FaPlay /> {t('tournamentDetails.sidebar.startBtn')}</>}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* --- Join Modal --- */}
            <Modal show={showJoinModal} onHide={() => setShowJoinModal(false)} centered className="dark-modal">
                <Modal.Header closeButton>
                    <Modal.Title>{t('tournamentDetails.modal.title')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('tournamentDetails.modal.selectTeamLabel')} ({currentTournament.rules.teamCategory})</Form.Label>
                            <Form.Control 
                                type="text" 
                                placeholder={t('tournamentDetails.modal.teamPlaceholder')} 
                                value={teamData.selectedTeam}
                                onChange={(e) => setTeamData({...teamData, selectedTeam: e.target.value})}
                            />
                            <Form.Text className="text-muted">
                                {t('tournamentDetails.modal.teamHint')}
                            </Form.Text>
                        </Form.Group>
                        <div className="fee-summary">
                            <span>{t('tournamentDetails.modal.walletBalance')}:</span>
                            <span className={user.balance < currentTournament.entryFee ? "text-danger" : "text-success"}>
                                {user.balance} {t('common.currency', 'TND')}
                            </span>
                        </div>
                        {user.balance < currentTournament.entryFee && (
                            <div className="text-danger mt-2 small">{t('tournamentDetails.modal.insufficientBalance')}</div>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowJoinModal(false)}>{t('common.cancel')}</Button>
                    <Button 
                        variant="primary" 
                        onClick={handleJoinSubmit}
                        disabled={user.balance < currentTournament.entryFee || loadingJoin}
                    >
                        {loadingJoin ? t('common.processing') : `${t('tournamentDetails.modal.payAndJoin')} ${currentTournament.entryFee} TND`}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

const AlertBadge = ({ children, variant }) => (
    <div className={`custom-alert alert-${variant}`}>
        {children}
    </div>
);

export default TournamentDetailsPage;