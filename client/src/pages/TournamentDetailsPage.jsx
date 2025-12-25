import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Row, Col, Card, Button, Spinner, Tabs, Tab, Badge, ListGroup, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { FaGavel, FaTrophy, FaCalendarAlt, FaUsers, FaGamepad, FaClock, FaCheckCircle, FaMoneyBillWave, FaArrowLeft, FaFutbol, FaShieldAlt, FaChartBar, FaInfoCircle, FaSitemap } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getTournamentDetails, joinTournament, checkInTournament, getTakenTeams, startTournament, getTournamentMatches } from '../redux/actions/tournamentAction';
import JoinTournamentModal from '../components/tournaments/JoinTournamentModal';
import TournamentBracket from '../components/tournaments/TournamentBracket';
import GroupStageView from '../components/tournaments/GroupStageView';
import LeagueStandingsView from '../components/tournaments/LeagueStandingsView';
import './TournamentDetailsPage.css';
import { SocketContext } from '../App';

const TournamentDetailsPage = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const socket = useContext(SocketContext);

    const { currentTournament: tournament, loadingDetails, takenTeams, errors, matches } = useSelector(state => state.tournamentReducer);
    const { user } = useSelector(state => state.userReducer);
    console.log("Tournament Details Debug:", { id, tournament, loadingDetails, errors, user, matches });

    const [showJoinModal, setShowJoinModal] = useState(false);
    const [key, setKey] = useState('overview');

    useEffect(() => {
        dispatch(getTournamentDetails(id));
    }, [dispatch, id]);

    // Socket listener for real-time match updates (standings, stats)
    useEffect(() => {
        if (socket && tournament?._id) {
            const handleMatchUpdate = (updatedMatch) => {
                // If the updated match belongs to this tournament, re-fetch matches
                if (updatedMatch.tournament === tournament._id ||
                    (updatedMatch.tournament?._id && updatedMatch.tournament._id === tournament._id)) {
                    console.log('[Socket] Match updated for this tournament, re-fetching matches');
                    dispatch(getTournamentMatches(id));
                }
            };

            socket.on('match_updated', handleMatchUpdate);

            return () => {
                socket.off('match_updated', handleMatchUpdate);
            };
        }
    }, [socket, tournament?._id, dispatch, id]);

    // تم نقل socket listener لـ tournament_participant_joined إلى App.js للمركزية
    // Fetch taken teams when modal opens
    useEffect(() => {
        if (showJoinModal) {
            dispatch(getTakenTeams(id));
        }
    }, [showJoinModal, dispatch, id]);

    // Fetch matches when tournament is active (for Group Stage / Bracket)
    useEffect(() => {
        if (tournament && (tournament.status === 'active' || tournament.status === 'completed')) {
            dispatch(getTournamentMatches(id));
        }
    }, [tournament?.status, dispatch, id]);

    const handleJoinClick = () => {
        if (!user) {
            toast.info(t('auth.loginRequired'));
            navigate('/login');
            return;
        }
        setShowJoinModal(true);
    };

    const handleCheckIn = async () => {
        const result = await dispatch(checkInTournament(id)); // [!] Fixed import name
        if (result.success) {
            toast.success(t('tournamentDetails.toasts.checkInSuccess'));
            dispatch(getTournamentDetails(id));
        } else {
            toast.error(result.message);
        }
    };

    // [New] Handle Start Tournament (Admin Only)
    const handleStartTournament = async () => {
        if (window.confirm(t('tournamentDetails.startConfirm'))) {
            const result = await dispatch(startTournament(id));
            if (result.success) {
                toast.success(t('tournamentDetails.toasts.startSuccess'));
            } else {
                toast.error(result.message);
            }
        }
    };

    // Helper to get image URL with fallback
    const getAvatarUrl = (url) => {
        if (!url) return "https://bootdey.com/img/Content/avatar/avatar7.png"; // Default User Avatar
        if (url.startsWith('http')) return url;
        return `${process.env.REACT_APP_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    if (loadingDetails) return <div className="text-center py-5 text-white"><Spinner animation="border" variant="primary" /></div>;
    if (errors) return <div className="text-center py-5 text-danger">{t(errors, errors)}</div>;
    if (!tournament) return <div className="text-center py-5 text-white">{t('tournamentDetails.notFound')}</div>;

    const isParticipant = tournament.participants.some(p => p.user._id === user?._id);
    const myParticipantData = tournament.participants.find(p => p.user._id === user?._id);
    const isFull = tournament.participants.length >= tournament.maxParticipants;
    const canCheckIn = tournament.status === 'check-in' && isParticipant && !myParticipantData.isCheckedIn;
    const canJoin = tournament.status === 'open' && !isParticipant && !isFull;
    const isAdmin = user?.userRole === 'Admin';

    // Helper to format date
    const formatDate = (date) => new Date(date).toLocaleString();

    return (
        <Container className="tournament-details-page py-4">

            {/* Header / Banner Area */}
            <div className="tournament-header-wrapper mb-4">
                <div className="header-overlay"></div>
                <div className="header-content p-4 p-md-5">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                        <Badge bg="warning" text="dark" className="fs-6 px-3 py-2 shadow-sm">
                            {t(`tournament.teamTypes.${tournament.rules.teamCategory}`, tournament.rules.teamCategory)}
                        </Badge>
                        <Button variant="link" className="text-white p-0" onClick={() => navigate('/dashboard/tournaments')}>
                            <FaArrowLeft /> {t('common.back')}
                        </Button>
                    </div>

                    <h1 className="display-5 fw-bold text-white mb-3 text-shadow">{tournament.title}</h1>

                    <div className="tournament-meta d-flex flex-wrap gap-4 text-light">
                        <span className="meta-item"><FaCalendarAlt className="me-2 text-info" /> {formatDate(tournament.startDate)}</span>
                        <span className="meta-item"><FaUsers className="me-2 text-info" /> {tournament.participants.length} / {tournament.maxParticipants}</span>
                        <span className="meta-item"><FaMoneyBillWave className="me-2 text-warning" /> {t('createTournament.fields.prizePool')} : {tournament.prizePool} {t('dashboard.currencies.TND')}</span>
                        <span className="meta-item"><FaGamepad className="me-2 text-success" /> {t(`createTournament.fields.${tournament.format}`)}</span>
                    </div>
                </div>

                <div className="header-actions p-4 d-flex justify-content-end align-items-center bg-dark-transparent">
                    <div className="status-badge me-auto">
                        <span className={`status-dot ${tournament.status}`}></span>
                        <span className="text-uppercase fw-bold text-white">{t(`status.${tournament.status}`)}</span>
                    </div>

                    {canJoin && (
                        <Button variant="primary" size="lg" onClick={handleJoinClick} className="px-5 fw-bold shadow-lg action-btn">
                            {t('tournamentDetails.sidebar.joinBtn')}
                        </Button>
                    )}

                    {canCheckIn && (
                        <Button variant="success" size="lg" onClick={handleCheckIn} className="px-5 fw-bold shadow-lg action-btn animate-pulse">
                            {t('tournamentDetails.sidebar.checkInBtn')}
                        </Button>
                    )}

                    {isParticipant && myParticipantData.isCheckedIn && (
                        <Badge bg="success" className="px-4 py-2 fs-6">
                            <FaCheckCircle className="me-2" /> {t('tournamentDetails.status.checkedInMsg')}
                        </Badge>
                    )}
                </div>
            </div>

            <Row>
                {/* Main Content (Tabs) */}
                <Col lg={8}>
                    <Tabs
                        id="tournament-tabs"
                        activeKey={key}
                        onSelect={(k) => setKey(k)}
                        className="mb-4 custom-tabs"
                    >
                        <Tab eventKey="overview" title={<><FaInfoCircle className="me-1" />{t('tournamentDetails.tabs.overview')}</>}>
                            <Card className="bg-dark text-white border-0 shadow-sm mb-4 card-content">
                                <Card.Body>
                                    <h5 className="text-primary mb-3"><FaTrophy className="me-2" /> {t('tournamentDetails.headers.description')}</h5>
                                    <p className="text-gray-300 lead fs-6">{tournament.description || t('tournamentDetails.noDescription')}</p>

                                    <hr className="border-secondary my-4" />

                                    <h5 className="text-info mb-3"><FaGamepad className="me-2" /> {t('tournamentDetails.headers.rules')}</h5>
                                    <ListGroup variant="flush" className="bg-transparent rules-list">
                                        <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                            <span>{t('tournamentDetails.rules.teamType')}</span>
                                            <strong>{t(`tournament.teamTypes.${tournament.rules.teamCategory}`, tournament.rules.teamCategory)}</strong>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                            <span>{t('tournamentDetails.rules.matchTime')}</span>
                                            <strong>{String(tournament.rules.eFootballMatchTime).replace(/[^0-9]/g, '')} {t('tournamentDetails.rules.mins')}</strong>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                            <span>{t('tournamentDetails.rules.duration')}</span>
                                            <strong>{tournament.rules.matchDurationMinutes} {t('tournamentDetails.rules.mins')}</strong>
                                        </ListGroup.Item>
                                    </ListGroup>

                                    {/* Tournament Format Details */}
                                    {tournament.format === 'hybrid' && tournament.groupSettings && (
                                        <>
                                            <hr className="border-secondary my-4" />
                                            <h5 className="text-success mb-3"><FaUsers className="me-2" /> {t('tournamentDetails.headers.formatDetails')}</h5>
                                            <ListGroup variant="flush" className="bg-transparent format-list">
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.type')}</span>
                                                    <strong>{t('tournamentDetails.format.hybrid')}</strong>
                                                </ListGroup.Item>
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.numGroups')}</span>
                                                    <strong>{tournament.groupSettings.numberOfGroups} {t('tournamentDetails.format.groups')}</strong>
                                                </ListGroup.Item>
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.qualifiersPerGroup')}</span>
                                                    <strong>
                                                        {tournament.groupSettings.qualifiersPerGroup === 1
                                                            ? t('tournamentDetails.format.oneQualifier')
                                                            : t('tournamentDetails.format.twoQualifiers')}
                                                    </strong>
                                                </ListGroup.Item>
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.pointsSystem')}</span>
                                                    <strong>
                                                        {t('tournamentDetails.format.pointsDisplay', {
                                                            win: tournament.groupSettings.pointsWin || 3,
                                                            draw: tournament.groupSettings.pointsDraw || 1,
                                                            loss: tournament.groupSettings.pointsLoss || 0
                                                        })}
                                                    </strong>
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </>
                                    )}

                                    {tournament.format === 'league' && (
                                        <>
                                            <hr className="border-secondary my-4" />
                                            <h5 className="text-success mb-3"><FaUsers className="me-2" /> {t('tournamentDetails.headers.formatDetails')}</h5>
                                            <ListGroup variant="flush" className="bg-transparent format-list">
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.type')}</span>
                                                    <strong>{t('tournamentDetails.format.leagueOnly')}</strong>
                                                </ListGroup.Item>
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.matchSystem')}</span>
                                                    <strong>{t('tournamentDetails.format.roundRobin')}</strong>
                                                </ListGroup.Item>
                                                <ListGroup.Item className="bg-transparent text-white border-secondary d-flex justify-content-between">
                                                    <span>{t('tournamentDetails.format.pointsSystem')}</span>
                                                    <strong>
                                                        {t('tournamentDetails.format.pointsDisplay', {
                                                            win: 3,
                                                            draw: 1,
                                                            loss: 0
                                                        })}
                                                    </strong>
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </>
                                    )}

                                    <hr className="border-secondary my-4" />

                                    <h5 className="text-warning mb-3"><FaMoneyBillWave className="me-2" /> {t('tournamentDetails.headers.prizes')}</h5>
                                    {tournament.format === 'league' ? (
                                        <Row className="g-3">
                                            <Col xs={4}>
                                                <div className="prize-card gold">
                                                    <FaTrophy className="prize-icon mb-2" />
                                                    <div className="small text-uppercase">{t('tournamentDetails.prizes.first')}</div>
                                                    <div className="fs-5 fw-bold">{tournament.prizesDistribution.firstPlace} {t('dashboard.currencies.TND')}</div>
                                                </div>
                                            </Col>
                                            <Col xs={4}>
                                                <div className="prize-card attack">
                                                    <FaFutbol className="prize-icon mb-2" />
                                                    <div className="small text-uppercase">{t('tournamentDetails.prizes.bestAttack')}</div>
                                                    <div className="fs-5 fw-bold">{tournament.prizesDistribution.bestAttack || 0} {t('dashboard.currencies.TND')}</div>
                                                </div>
                                            </Col>
                                            <Col xs={4}>
                                                <div className="prize-card defense">
                                                    <FaShieldAlt className="prize-icon mb-2" />
                                                    <div className="small text-uppercase">{t('tournamentDetails.prizes.bestDefense')}</div>
                                                    <div className="fs-5 fw-bold">{tournament.prizesDistribution.bestDefense || 0} {t('dashboard.currencies.TND')}</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    ) : (
                                        <Row className="g-3">
                                            <Col xs={6}>
                                                <div className="prize-card gold">
                                                    <FaTrophy className="prize-icon mb-2" />
                                                    <div className="small text-uppercase">{t('tournamentDetails.prizes.first')}</div>
                                                    <div className="fs-4 fw-bold">{tournament.prizesDistribution.firstPlace} {t('dashboard.currencies.TND')}</div>
                                                </div>
                                            </Col>
                                            <Col xs={6}>
                                                <div className="prize-card silver">
                                                    <FaTrophy className="prize-icon mb-2" />
                                                    <div className="small text-uppercase">{t('tournamentDetails.prizes.second')}</div>
                                                    <div className="fs-4 fw-bold">{tournament.prizesDistribution.secondPlace} {t('dashboard.currencies.TND')}</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    )}
                                </Card.Body>
                            </Card>
                        </Tab>

                        <Tab eventKey="participants" title={<><FaUsers className="me-1" />{t('tournamentDetails.tabs.participants')} ({tournament.participants.length})</>}>
                            <Row xs={1} md={2} className="g-3">
                                {tournament.participants.map((p) => (
                                    <Col key={p._id}>
                                        <div className={`participant-card-item old-design ${p.user._id === user?._id ? 'highlight' : ''}`}>
                                            {/* Left: Team Logo (Order 1) */}
                                            <div className="participant-logo">
                                                <img src={p.selectedTeamLogo || "https://placehold.co/40"} alt="Team" className="team-logo-md" />
                                            </div>

                                            {/* Center: Info (Order 2) */}
                                            <div className="participant-info">
                                                <div className="user-name">{p.user.fullName}</div>
                                                <div className="team-name">{p.selectedTeam}</div>
                                            </div>

                                            {/* Right: User Avatar (Order 3) */}
                                            <div className="participant-user-img">
                                                <img src={getAvatarUrl(p.user.avatarUrl)} alt="User" className="rounded-circle border border-secondary" width="45" height="45" />
                                            </div>

                                            {/* Check-in Badge */}
                                            {p.isCheckedIn && (
                                                <div className="checked-in-badge" title={t('status.checkedIn')}>
                                                    <FaCheckCircle className="text-success" />
                                                </div>
                                            )}
                                        </div>
                                    </Col>
                                ))}
                            </Row>
                        </Tab>

                        <Tab eventKey="bracket" title={<><FaSitemap className="me-1" />{t('tournamentDetails.tabs.bracket')}</>}>
                            {tournament.status === 'open' || tournament.status === 'check-in' ? (
                                <div className="bracket-placeholder text-center py-5">
                                    <FaClock size={50} className="mb-3 text-secondary" />
                                    <h5 className="text-muted">{t('tournamentDetails.bracket.placeholder')}</h5>
                                </div>
                            ) : tournament.format === 'league' ? (
                                // Regular League (Round Robin - all vs all)
                                <div className="league-wrapper bg-darker p-3 rounded">
                                    <LeagueStandingsView
                                        matches={matches || tournament.matches || []}
                                        participants={tournament.participants}
                                        hideStatsCards={true}
                                    />
                                </div>
                            ) : tournament.format === 'hybrid' && (matches || tournament.matches)?.some(m => m.groupIndex !== undefined) ? (
                                // Hybrid format with group matches
                                <div className="hybrid-wrapper">
                                    <GroupStageView
                                        matches={(matches || tournament.matches)?.filter(m => m.groupIndex !== undefined) || []}
                                        participants={tournament.participants}
                                        qualifiersPerGroup={tournament.groupSettings?.qualifiersPerGroup || 2}
                                    />
                                    <hr className="my-4 border-secondary" />
                                    <TournamentBracket
                                        tournamentId={id}
                                        maxParticipants={tournament.maxParticipants}
                                        format={tournament.format}
                                    />
                                </div>
                            ) : (
                                // Knockout format
                                <div className="bracket-wrapper bg-darker p-3 rounded">
                                    <TournamentBracket
                                        tournamentId={id}
                                        maxParticipants={tournament.maxParticipants}
                                        format={tournament.format}
                                    />
                                </div>
                            )}
                        </Tab>

                        {/* Statistics Tab - Shows for league format when tournament started */}
                        {tournament.format === 'league' && (tournament.status === 'active' || tournament.status === 'completed') && (
                            <Tab eventKey="stats" title={<><FaChartBar className="me-1" />{t('tournamentDetails.tabs.stats')}</>}>
                                <Card className="bg-dark text-white border-0 shadow-sm">
                                    <Card.Body>
                                        <h5 className="text-primary mb-4"><FaChartBar className="me-2" />{t('tournament.stats.title')}</h5>
                                        <LeagueStandingsView
                                            matches={matches || tournament.matches || []}
                                            participants={tournament.participants}
                                            showStatsOnly={true}
                                        />
                                    </Card.Body>
                                </Card>
                            </Tab>
                        )}
                    </Tabs>
                </Col>

                {/* Sidebar */}
                <Col lg={4}>
                    <Card className="bg-dark text-white border-0 shadow-sm mb-4 sidebar-card">
                        <Card.Header className="bg-darker border-bottom border-secondary fw-bold py-3">
                            {t('tournamentDetails.sidebar.yourStatus')}
                        </Card.Header>
                        <Card.Body>
                            {isParticipant ? (
                                <div>
                                    <div className="d-flex align-items-center mb-3 p-2 bg-darker rounded">
                                        <img src={myParticipantData.selectedTeamLogo} alt="Team" className="me-3 rounded" width="50" />
                                        <div>
                                            <div className="small text-muted">{t('tournamentDetails.sidebar.playingAs')}</div>
                                            <div className="fw-bold text-white">{myParticipantData.selectedTeam}</div>
                                        </div>
                                    </div>
                                    <div className="d-grid">
                                        <Badge bg={myParticipantData.isCheckedIn ? "success" : "warning"} className="p-3 fs-6 rounded-pill">
                                            {myParticipantData.isCheckedIn ? t('status.checkedIn') : t('status.registered')}
                                        </Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted py-3">
                                    <p>{t('matchRoom.accessDenied')}</p>
                                    {!isFull && tournament.status === 'open' && (
                                        <Button variant="outline-primary" size="sm" onClick={handleJoinClick}>
                                            {t('tournamentDetails.sidebar.joinBtn')}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>

                    {/* Admin Controls */}
                    {isAdmin && (
                        <Card className="bg-dark border-danger shadow-sm">
                            <Card.Header className="text-danger fw-bold border-danger py-3">
                                <FaGavel className="me-2" /> {t('tournamentDetails.sidebar.adminControls')}
                            </Card.Header>
                            <Card.Body>
                                <div className="d-grid gap-2">
                                    {(tournament.status === 'open' || tournament.status === 'check-in') && (
                                        <Button variant="danger" onClick={handleStartTournament}>
                                            {t('tournamentDetails.sidebar.startBtn')}
                                        </Button>
                                    )}
                                    <Button variant="outline-light" size="sm" onClick={() => navigate('/dashboard/admin/create-tournament')}>
                                        {t('tournamentDetails.sidebar.manageBtn')}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    )}
                </Col>
            </Row>

            {/* Join Modal */}
            <JoinTournamentModal
                show={showJoinModal}
                onHide={() => setShowJoinModal(false)}
                tournament={tournament}
                takenTeams={takenTeams}
                onSuccess={() => {
                    setShowJoinModal(false);
                    // Socket handles the participant update automatically
                    // Only refresh takenTeams to update locked icons
                    dispatch(getTakenTeams(id));
                }}
            />
        </Container>
    );
};

export default TournamentDetailsPage;