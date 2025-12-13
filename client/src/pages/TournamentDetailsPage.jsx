import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getTournamentDetails, joinTournament, checkInTournament, startTournament } from '../redux/actions/tournamentAction';
import { getProfile } from '../redux/actions/userAction'; // [!] استيراد مهم لتحديث الرصيد
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Badge, Button, Spinner, Tab, Tabs } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { FaTrophy, FaClock, FaGamepad, FaCheckCircle, FaPlay } from 'react-icons/fa';
import { toast } from 'react-toastify';
import JoinTournamentModal from '../components/tournaments/JoinTournamentModal';
import './TournamentDetailsPage.css';
import TournamentBracket from '../components/tournaments/TournamentBracket';

const TournamentDetailsPage = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Redux State
    const { currentTournament, loadingDetails, loadingStart, loadingCheckIn, loadingJoin } = useSelector(state => state.tournamentReducer);
    const { user } = useSelector(state => state.userReducer);

    // Local State
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [key, setKey] = useState('overview');

    // Fetch details on mount
    useEffect(() => {
        dispatch(getTournamentDetails(id));
    }, [dispatch, id, currentTournament?.status]);

    if (loadingDetails || !currentTournament) {
        return <div className="loading-screen"><Spinner animation="border" variant="primary" /></div>;
    }

    // Check user status
    const isParticipant = currentTournament.participants.some(p => p.user?._id === user?._id);
    const myParticipantData = currentTournament.participants.find(p => p.user?._id === user?._id);
    const isCheckedIn = myParticipantData?.isCheckedIn;

    // --- Handlers ---

    // [!] هذه هي الدالة التي كانت مفقودة، وتم تصحيحها لتحديث الرصيد
    // ملاحظة: JoinTournamentModal يستدعي joinTournament داخلياً، لكننا نمرر له الدالة للتحكم بالإغلاق والتحديث
    // ولكن، المكون JoinTournamentModal الذي بنيناه يتعامل مع الـ dispatch داخله
    // لذا، نحن لا نحتاج هذه الدالة هنا إلا إذا كنا نستخدم زر انضمام بسيط.
    // وبما أننا نستخدم Modal متطور، فإن التحديث يجب أن يحدث عند إغلاق الـ Modal بنجاح.

    // الحل الأذكى: نمرر دالة callback للـ Modal ليخبرنا بالنجاح
    const handleJoinSuccess = () => {
        setShowJoinModal(false);
        dispatch(getProfile()); // تحديث الرصيد
        dispatch(getTournamentDetails(id)); // تحديث القائمة
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

    const getTeamCategoryLabel = (cat) => {
        if (cat === 'National Teams') return t('createTournament.nations');
        if (cat === 'Clubs') return t('createTournament.clubs');
        return cat;
    };

    const getAvatarUrl = (url) => {
        if (!url) return "https://bootdey.com/img/Content/avatar/avatar7.png";
        if (url.startsWith('http')) return url;
        return `${process.env.REACT_APP_API_URL}/${url}`;
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
                                {/* Tab 1: Overview */}
                                <Tab eventKey="overview" title={t('tournamentDetails.tabs.overview')}>
                                    <div className="tab-content-wrapper">
                                        <h4 className="section-title">{t('tournamentDetails.headers.description')}</h4>
                                        <p className="text-gray">{currentTournament.description || t('tournamentDetails.noDescription')}</p>

                                        <h4 className="section-title mt-4">{t('tournamentDetails.headers.rules')}</h4>
                                        <ul className="rules-list">
                                            <li><strong>{t('tournamentDetails.rules.teamType')}:</strong> {getTeamCategoryLabel(currentTournament.rules.teamCategory)}</li>
                                            <li><strong>{t('tournamentDetails.rules.matchTime')}:</strong> {currentTournament.rules.eFootballMatchTime.replace('mins', t('tournamentDetails.rules.mins'))}</li>
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

                                {/* Tab 2: Participants */}
                                <Tab eventKey="participants" title={`${t('tournamentDetails.tabs.participants')} (${currentTournament.participants.length}/${currentTournament.maxParticipants})`}>
                                    <div className="participants-grid">
                                        {currentTournament.participants.map((p, idx) => (
                                            <motion.div
                                                key={idx}
                                                className={`participant-card ${p.user?._id === user?._id ? 'me' : ''}`}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                            >
                                                <img
                                                    src={getAvatarUrl(p.avatar || p.user?.avatarUrl)}
                                                    alt="avatar"
                                                    className="p-avatar"
                                                    onError={(e) => e.target.src = "https://bootdey.com/img/Content/avatar/avatar7.png"}
                                                />
                                                <div className="p-info">
                                                    <span className="p-name">{p.username}</span>
                                                    <span className="p-team">{p.selectedTeam}</span>
                                                </div>
                                                {p.selectedTeamLogo && (
                                                    <img src={p.selectedTeamLogo} alt={p.selectedTeam} className="team-logo-mini ms-2" style={{ width: 30 }} />
                                                )}

                                                {p.isCheckedIn && <FaCheckCircle className="text-success ms-auto" title={t('tournamentDetails.status.checkedIn')} />}
                                            </motion.div>
                                        ))}
                                    </div>
                                </Tab>

                                {/* Tab 3: Bracket */}
                                <Tab eventKey="bracket" title={t('tournamentDetails.tabs.bracket')}>
                                    {currentTournament.status === 'open' || currentTournament.status === 'check-in' ? (
                                        <div className="bracket-placeholder">
                                            <div className="text-center py-5">
                                                <FaClock size={40} className="text-muted mb-3" />
                                                <h5>{t('tournamentDetails.bracket.placeholder')}</h5>
                                            </div>
                                        </div>
                                    ) : (
                                        <TournamentBracket
                                            tournamentId={currentTournament._id}
                                            maxParticipants={currentTournament.maxParticipants}
                                        />
                                    )}
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
                                        disabled={currentTournament.status !== 'open'}
                                    >
                                        {t('tournamentDetails.sidebar.joinBtn')}
                                    </Button>
                                </>
                            ) : (
                                <div className="participant-status">
                                    <AlertBadge variant="success">{t('tournamentDetails.status.registered')}</AlertBadge>
                                    <div className="team-display mt-3 text-center">
                                        <small>{t('tournamentDetails.sidebar.playingAs')}</small>
                                        <div className="d-flex align-items-center justify-content-center gap-2 mt-1">
                                            {myParticipantData.selectedTeamLogo && (
                                                <img src={myParticipantData.selectedTeamLogo} alt="Team" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                                            )}
                                            <h5>{myParticipantData.selectedTeam}</h5>
                                        </div>
                                    </div>

                                    {currentTournament.status === 'check-in' && !isCheckedIn && (
                                        <Button
                                            className="w-100 mt-3 btn-warning fw-bold"
                                            onClick={handleCheckIn}
                                            disabled={loadingCheckIn}
                                        >
                                            {loadingCheckIn ? <Spinner size="sm" /> : t('tournamentDetails.sidebar.checkInBtn')}
                                        </Button>
                                    )}

                                    {isCheckedIn && (
                                        <div className="mt-3 text-success text-center fw-bold">
                                            <FaCheckCircle /> {t('tournamentDetails.status.checkedInMsg')}
                                        </div>
                                    )}
                                </div>
                            )}

                            {user.userRole === 'Admin' && (
                                <div className="admin-controls mt-4 pt-3 border-top border-secondary">
                                    <h6>{t('tournamentDetails.sidebar.adminControls')}</h6>
                                    <Button
                                        variant="danger"
                                        className="w-100"
                                        onClick={handleStart}
                                        disabled={loadingStart || currentTournament.status === 'active'}
                                    >
                                        {loadingStart ? <Spinner size="sm" /> : <><FaPlay /> {t('tournamentDetails.sidebar.startBtn')}</>}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* --- The New Intelligent Join Modal --- */}
            {currentTournament && (
                <JoinTournamentModal
                    show={showJoinModal}
                    onHide={() => setShowJoinModal(false)}
                    tournament={currentTournament}
                    onSuccess={handleJoinSuccess} // [!] تمرير دالة النجاح للـ Modal
                />
            )}
        </div>
    );
};

const AlertBadge = ({ children, variant }) => (
    <div className={`custom-alert alert-${variant}`}>
        {children}
    </div>
);

export default TournamentDetailsPage;