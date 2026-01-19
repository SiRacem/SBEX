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

    // 🏆 Handle Force Complete Tournament (Admin Only)
    const handleForceComplete = async () => {
        if (!window.confirm(t('tournamentDetails.forceCompleteConfirm', 'هل أنت متأكد من إكمال البطولة وتوزيع الجوائز؟'))) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.REACT_APP_API_URL}/tournaments/${id}/force-complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (data.success) {
                toast.success('🏆 تم إكمال البطولة وتوزيع الجوائز بنجاح!');
                dispatch(getTournamentDetails(id)); // Refresh tournament data
            } else {
                toast.error(data.message || 'حدث خطأ');
            }
        } catch (error) {
            console.error('Force complete error:', error);
            toast.error('حدث خطأ في الاتصال');
        }
    };

    // Helper to get image URL with fallback
    const getAvatarUrl = (url) => {
        if (!url) return "https://bootdey.com/img/Content/avatar/avatar7.png"; // Default User Avatar
        if (url.startsWith('http')) return url;
        if (url.startsWith('data:')) return url; // base64 data URLs
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

            {/* 🏆 Winners Podium - 3D Design */}
            {tournament.status === 'completed' && tournament.winners && (
                <div className="winners-podium mb-4 p-4 rounded-4 position-relative overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                        border: '3px solid #ffd700',
                        boxShadow: '0 25px 80px rgba(255, 215, 0, 0.25), inset 0 0 120px rgba(255, 215, 0, 0.03)'
                    }}>

                    {/* Animated glow background */}
                    <div className="podium-glow" style={{
                        position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
                        width: '100%', height: '200%',
                        background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.15) 0%, transparent 60%)',
                        animation: 'pulseGlow 3s ease-in-out infinite', pointerEvents: 'none'
                    }} />

                    <h4 className="text-center mb-5 position-relative" style={{
                        color: '#ffd700',
                        textShadow: '0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3)',
                        fontSize: '1.63rem', fontWeight: 'bold', letterSpacing: '2px',
                        zIndex: 20
                    }}>
                        🏆 {t('tournamentDetails.winners.title', 'الأبطال والجوائز')} 🏆
                    </h4>

                    <Row className="justify-content-center align-items-end g-3 position-relative" style={{ minHeight: '260px', paddingTop: '20px' }}>

                        {/* أفضل هجوم - يسار */}
                        {tournament.winners.topScorer?.user && (
                            <Col xs={6} md={4} className="order-md-1 order-2">
                                <div className="winner-card-3d text-center p-3 rounded-4"
                                    style={{
                                        background: 'linear-gradient(180deg, #34d058 0%, #22863a 100%)',
                                        color: 'white',
                                        boxShadow: '0 20px 50px rgba(52, 208, 88, 0.4), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                                        transform: 'perspective(800px) rotateY(8deg) translateY(20px)',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'perspective(800px) rotateY(0deg) translateY(0px) scale(1.08)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'perspective(800px) rotateY(8deg) translateY(20px)'; }}
                                >
                                    <div style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))', marginBottom: '8px' }}>⚽</div>
                                    {tournament.winners.topScorer.teamLogo && (
                                        <img src={getAvatarUrl(tournament.winners.topScorer.teamLogo)} alt=""
                                            style={{
                                                width: '55px', height: '55px', objectFit: 'contain', borderRadius: '50%',
                                                background: 'white', padding: '4px', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.3)'
                                            }}
                                            className="mb-2" />
                                    )}
                                    <div className="fw-bold opacity-75" style={{ fontSize: '0.85rem' }}>{t('tournamentDetails.winners.topScorer', 'أقوى هجوم')}</div>
                                    <div className="fw-bold" style={{ fontSize: '1.1rem' }}>{tournament.winners.topScorer.teamName}</div>
                                    <div className="opacity-75" style={{ fontSize: '0.8rem' }}>{tournament.winners.topScorer.goals} {t('tournamentDetails.winners.goals', 'هدف')}</div>
                                    <div className="mt-2 fw-bold" style={{
                                        background: 'rgba(0,0,0,0.25)', borderRadius: '20px', padding: '6px 16px',
                                        display: 'inline-block', fontSize: '0.9rem', backdropFilter: 'blur(10px)'
                                    }}>{tournament.winners.topScorer.prize} {t('dashboard.currencies.TND')}</div>
                                </div>
                            </Col>
                        )}

                        {/* البطل - المركز (مرتفع ومتحرك) */}
                        {tournament.winners.champion?.user && (
                            <Col xs={12} md={4} className="order-md-2 order-1">
                                <div className="winner-card-champion text-center p-4 rounded-4 position-relative"
                                    style={{
                                        background: 'linear-gradient(180deg, #ffd700 0%, #ffb700 40%, #d4a000 100%)',
                                        color: '#1a1a2e',
                                        boxShadow: '0 30px 70px rgba(255, 215, 0, 0.5), 0 15px 40px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
                                        transform: 'translateY(-10px) scale(1.08)',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        border: '3px solid rgba(255,255,255,0.4)', cursor: 'pointer',
                                        zIndex: 10
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-20px) scale(1.12)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(-10px) scale(1.08)'; }}
                                >
                                    {/* Crown decoration */}
                                    <div style={{
                                        position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                                        fontSize: '1.5rem', textShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                    }}>👑</div>

                                    <div className="trophy-animate" style={{
                                        fontSize: '4rem', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.4))',
                                        animation: 'trophyBounce 2s ease-in-out infinite', marginBottom: '10px'
                                    }}>🏆</div>
                                    {tournament.winners.champion.teamLogo && (
                                        <img src={getAvatarUrl(tournament.winners.champion.teamLogo)} alt=""
                                            style={{
                                                width: '75px', height: '75px', objectFit: 'contain', borderRadius: '50%',
                                                background: 'white', padding: '5px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', border: '3px solid rgba(255,255,255,0.5)'
                                            }}
                                            className="mb-2" />
                                    )}
                                    <div className="fw-bold" style={{ fontSize: '1rem', opacity: 0.8 }}>{t('tournamentDetails.winners.champion', 'البطل')}</div>
                                    <div className="fw-bold" style={{ fontSize: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{tournament.winners.champion.teamName}</div>
                                    <div className="mt-2 fw-bold" style={{
                                        background: 'rgba(0,0,0,0.15)', borderRadius: '25px', padding: '8px 24px',
                                        fontSize: '1.2rem', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
                                    }}>{tournament.winners.champion.prize} {t('dashboard.currencies.TND')}</div>
                                </div>
                            </Col>
                        )}

                        {/* أفضل دفاع - يمين */}
                        {tournament.winners.bestDefense?.user && (
                            <Col xs={6} md={4} className="order-md-3 order-3">
                                <div className="winner-card-3d text-center p-3 rounded-4"
                                    style={{
                                        background: 'linear-gradient(180deg, #2188ff 0%, #0366d6 100%)',
                                        color: 'white',
                                        boxShadow: '0 20px 50px rgba(33, 136, 255, 0.4), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                                        transform: 'perspective(800px) rotateY(-8deg) translateY(20px)',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'perspective(800px) rotateY(0deg) translateY(0px) scale(1.08)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'perspective(800px) rotateY(-8deg) translateY(20px)'; }}
                                >
                                    <div style={{ fontSize: '2.8rem', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))', marginBottom: '8px' }}>🛡️</div>
                                    {tournament.winners.bestDefense.teamLogo && (
                                        <img src={getAvatarUrl(tournament.winners.bestDefense.teamLogo)} alt=""
                                            style={{
                                                width: '55px', height: '55px', objectFit: 'contain', borderRadius: '50%',
                                                background: 'white', padding: '4px', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.3)'
                                            }}
                                            className="mb-2" />
                                    )}
                                    <div className="fw-bold opacity-75" style={{ fontSize: '0.85rem' }}>{t('tournamentDetails.winners.bestDefense', 'أقوى دفاع')}</div>
                                    <div className="fw-bold" style={{ fontSize: '1.1rem' }}>{tournament.winners.bestDefense.teamName}</div>
                                    <div className="opacity-75" style={{ fontSize: '0.8rem' }}>{tournament.winners.bestDefense.goalsAgainst} {t('tournamentDetails.winners.goalsAgainst', 'هدف ضده')}</div>
                                    <div className="mt-2 fw-bold" style={{
                                        background: 'rgba(0,0,0,0.25)', borderRadius: '20px', padding: '6px 16px',
                                        display: 'inline-block', fontSize: '0.9rem', backdropFilter: 'blur(10px)'
                                    }}>{tournament.winners.bestDefense.prize} {t('dashboard.currencies.TND')}</div>
                                </div>
                            </Col>
                        )}
                    </Row>

                    {/* CSS Animations */}
                    <style>{`
                        @keyframes trophyBounce {
                            0%, 100% { transform: translateY(0) rotate(0deg); }
                            25% { transform: translateY(-8px) rotate(-3deg); }
                            75% { transform: translateY(-8px) rotate(3deg); }
                        }
                        @keyframes pulseGlow {
                            0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
                            50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
                        }
                    `}</style>
                </div>
            )}

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
                                            <div className="small text-info opacity-75">{t('tournamentDetails.sidebar.playingAs')}</div>
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

                                    {/* 🏆 زر إكمال البطولة وتوزيع الجوائز */}
                                    {tournament.status === 'active' && (
                                        <Button
                                            variant="success"
                                            onClick={handleForceComplete}
                                            className="d-flex align-items-center justify-content-center gap-2"
                                        >
                                            <FaTrophy /> {t('tournamentDetails.sidebar.forceCompleteBtn', 'إكمال البطولة وتوزيع الجوائز')}
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