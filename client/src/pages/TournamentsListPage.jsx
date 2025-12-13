// src/pages/TournamentsListPage.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllTournaments } from '../redux/actions/tournamentAction';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrophy, FaGamepad, FaUsers, FaCoins, FaSearch, FaClock, FaCheckCircle, FaTimesCircle, FaRunning } from 'react-icons/fa';
import './TournamentsListPage.css';

// صورة افتراضية في حال لم نستخدم صوراً مخصصة لكل بطولة
const DEFAULT_COVER = "https://res.cloudinary.com/draghygoj/image/upload/v1746477147/wmremove-transformed-removebg-preview_adyzjs.png"; // يمكنك استبدالها بصورة eFootball جذابة

const TournamentsListPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { tournaments, loading } = useSelector(state => state.tournamentReducer);
    const [filter, setFilter] = useState('all'); // all, open, active, completed

    useEffect(() => {
        // [!] جلب البيانات دائماً عند الدخول للصفحة للتأكد من التحديث
        dispatch(getAllTournaments());
    }, [dispatch]);

    // [!] تأكد أن filteredTournaments لا يعتمد على state محلي قديم
    const filteredTournaments = tournaments.filter(tournament => {
        if (!tournament) return false;
        
        // طباعة الحالة في الكونسول للتأكد (Debugging)
        console.log(`Tournament: ${tournament.title}, Status: ${tournament.status}`);

        switch (filter) {
            case 'all': 
                return true;
            case 'open': 
                return tournament.status === 'open' || tournament.status === 'check-in';
            case 'active': 
                return tournament.status === 'active';
            case 'completed': 
                return tournament.status === 'completed';
            case 'cancelled': 
                return tournament.status === 'cancelled';
            default:
                return true;
        }
    });

    // إعدادات الحركة (Animation Variants)
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1 // تأخير ظهور كل بطاقة عن الأخرى
            }
        }
    };

    const cardVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { 
            y: 0, 
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    return (
        <div className="tournaments-page-container">
            <Container fluid>
                {/* --- Hero Section --- */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="tournaments-hero"
                >
                    <h1 className="heros-title">{t('tournaments.pageTitle', 'eFootball Arena')}</h1>
                    <p className="hero-subtitle">
                        {t('tournaments.pageSubtitle', 'Compete with the best, climb the ranks, and win real cash prizes.')}
                    </p>
                </motion.div>

                {/* --- Filters --- */}
                <motion.div 
                    className="filters-container"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <button 
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <FaTrophy /> {t('common.all', 'All')}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
                        onClick={() => setFilter('open')}
                    >
                        <FaClock /> {t('status.open', 'Registration Open')}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                        onClick={() => setFilter('active')}
                    >
                        <FaRunning /> {t('status.active', 'Live Now')}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
                        onClick={() => setFilter('cancelled')}
                    >
                        <FaTimesCircle /> {t('status.cancelled', 'Cancelled')}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilter('completed')}
                    >
                        <FaCheckCircle /> {t('status.completed', 'Completed')}
                    </button>
                </motion.div>

                {/* --- Content --- */}
                {loading ? (
                    <div className="d-flex justify-content-center py-5">
                        <Spinner animation="grow" variant="primary" />
                    </div>
                ) : filteredTournaments.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="empty-state"
                    >
                        <FaGamepad className="empty-icon" />
                        <h3>{t('tournaments.noTournaments', 'No tournaments found in this category.')}</h3>
                        <p>{t('tournaments.checkBack', 'Check back later for new competitions!')}</p>
                    </motion.div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <Row>
                            <AnimatePresence>
                                {filteredTournaments.map((tournament) => (
                                    <Col key={tournament._id} xs={12} md={6} lg={4} xl={3} className="mb-4">
                                        <TournamentCard 
                                            tournament={tournament} 
                                            variants={cardVariants}
                                            navigate={navigate}
                                            t={t}
                                        />
                                    </Col>
                                ))}
                            </AnimatePresence>
                        </Row>
                    </motion.div>
                )}
            </Container>
        </div>
    );
};

// --- Sub-Component: Tournament Card ---
const TournamentCard = ({ tournament, variants, navigate, t }) => {
    // حساب نسبة الامتلاء
    const participantsCount = tournament.participants?.length || 0;
    const maxParticipants = tournament.maxParticipants;
    const fillPercentage = (participantsCount / maxParticipants) * 100;

    // تحديد لون ونصوص الحالة
    const getStatusInfo = (status) => {
        switch (status) {
            case 'open': return { label: t('status.open', 'Open'), class: 'status-open', icon: <FaClock /> };
            case 'check-in': return { label: t('status.checkIn', 'Check-in'), class: 'status-active', icon: <FaCheckCircle /> };
            case 'active': return { label: t('status.live', 'Live'), class: 'status-active', icon: <FaRunning /> };
            case 'completed': return { label: t('status.completed', 'Finished'), class: 'status-completed', icon: <FaTrophy /> };
            default: return { label: t('status.cancelled', 'cancelled'), class: 'status-cancelled', icon: <FaTimesCircle /> };
        }
    };

    const statusInfo = getStatusInfo(tournament.status);

    return (
        <motion.div 
            className="tournament-card-wrapper"
            variants={variants}
            layout // Smooth reordering when filtering
        >
            <div className="tournament-card" onClick={() => navigate(`/dashboard/tournaments/${tournament._id}`)}>
                {/* Banner Image */}
                <div 
                    className="card-banner" 
                    style={{ backgroundImage: `url(${DEFAULT_COVER})` }} // يمكن وضع صورة مخصصة لاحقاً
                >
                    <div className="card-overlay"></div>
                    <div className={`status-badges ${statusInfo.class}`}>
                        {statusInfo.icon} {statusInfo.label}
                    </div>
                </div>

                <div className="card-content">
                    <h3 className="cards-title" title={tournament.title}>{tournament.title}</h3>
                    <div className="game-type">
                        <FaGamepad /> eFootball Mobile
                    </div>

                    {/* Stats Grid */}
                    <div className="card-stats">
                        <div className="stat-item">
                            <span className="stats-label">{t('tournaments.entry', 'Entry')}</span>
                            <span className="stats-value text-white">
                                {tournament.entryFee === 0 ? t('common.free', 'FREE') : `${tournament.entryFee} TND`}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stats-label">{t('tournaments.prize', 'Prize Pool')}</span>
                            <span className="stats-value prize-highlight">
                                <FaCoins className="me-1" /> {tournament.prizePool} TND
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar (Only if Open/Check-in) */}
                    {(tournament.status === 'open' || tournament.status === 'check-in') && (
                        <div className="participants-progress">
                            <div className="progress-info">
                                <span><FaUsers className="me-1"/> {participantsCount}/{maxParticipants}</span>
                                <span>{Math.round(fillPercentage)}%</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div 
                                    className="progress-bar-fill" 
                                    style={{ width: `${fillPercentage}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <div className="card-action">
                        {tournament.status === 'open' ? (
                            <button className="actions-btn btn-join">
                                {t('tournaments.joinNow', 'Join Tournament')}
                            </button>
                        ) : (
                            <button className="actions-btn btn-view">
                                {t('tournaments.viewDetails', 'View Details')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default TournamentsListPage;