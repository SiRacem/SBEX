// src/pages/TournamentsListPage.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllTournaments } from '../redux/actions/tournamentAction';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrophy, FaGamepad, FaUsers, FaCoins, FaClock, FaCheckCircle, FaTimesCircle, FaRunning } from 'react-icons/fa';
// Socket listener removed - App.js now handles tournament_participant_joined centrally
import './TournamentsListPage.css';

const DEFAULT_COVER = "https://res.cloudinary.com/draghygoj/image/upload/v1746477147/wmremove-transformed-removebg-preview_adyzjs.png";

const TournamentsListPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { tournaments, loading } = useSelector(state => state.tournamentReducer);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        dispatch(getAllTournaments());
    }, [dispatch]);

    // Socket listener removed - App.js handles tournament_participant_joined centrally

    // [تصحيح] فلترة آمنة
    const filteredTournaments = (tournaments || []).filter(tournament => {
        if (!tournament || !tournament.status) return false;

        const status = tournament.status;

        switch (filter) {
            case 'all': return true;
            case 'open': return status === 'open' || status === 'check-in';
            case 'active': return status === 'active';
            case 'completed': return status === 'completed';
            case 'cancelled': return status === 'cancelled';
            default: return true;
        }
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const cardVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
    };

    return (
        <div className="tournaments-page-container">
            <Container fluid>
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="tournaments-hero">
                    <h1 className="heros-title">{t('tournaments.pageTitle', 'eFootball Arena')}</h1>
                    <p className="hero-subtitle">{t('tournaments.pageSubtitle')}</p>
                </motion.div>

                <motion.div className="filters-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    {['all', 'open', 'active', 'cancelled', 'completed'].map(f => (
                        <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f === 'all' && <FaTrophy />}
                            {f === 'open' && <FaClock />}
                            {f === 'active' && <FaRunning />}
                            {f === 'cancelled' && <FaTimesCircle />}
                            {f === 'completed' && <FaCheckCircle />}
                            {' '}{t(f === 'all' ? 'common.all' : `status.${f}`)}
                        </button>
                    ))}
                </motion.div>

                {loading ? (
                    <div className="d-flex justify-content-center py-5"><Spinner animation="grow" variant="primary" /></div>
                ) : filteredTournaments.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
                        <FaGamepad className="empty-icon" />
                        <h3>{t('tournaments.noTournaments')}</h3>
                        <p>{t('tournaments.checkBack')}</p>
                    </motion.div>
                ) : (
                    <motion.div variants={containerVariants} initial="hidden" animate="visible">
                        <Row>
                            <AnimatePresence>
                                {filteredTournaments.map((tournament) => (
                                    <Col key={tournament._id} xs={12} md={6} lg={4} xl={3} className="mb-4">
                                        <TournamentCard tournament={tournament} variants={cardVariants} navigate={navigate} t={t} />
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

const TournamentCard = ({ tournament, variants, navigate, t }) => {
    const participantsCount = tournament.participants?.length || 0;
    const maxParticipants = tournament.maxParticipants;
    const fillPercentage = (participantsCount / maxParticipants) * 100;

    const getStatusInfo = (status) => {
        switch (status) {
            case 'open': return { label: t('status.open'), class: 'status-open', icon: <FaClock /> };
            case 'check-in': return { label: t('status.checkIn'), class: 'status-active', icon: <FaCheckCircle /> };
            case 'active': return { label: t('status.live'), class: 'status-active', icon: <FaRunning /> };
            case 'completed': return { label: t('status.completed'), class: 'status-completed', icon: <FaTrophy /> };
            default: return { label: t('status.cancelled'), class: 'status-cancelled', icon: <FaTimesCircle /> };
        }
    };
    const statusInfo = getStatusInfo(tournament.status);

    return (
        <motion.div className="tournament-card-wrapper" variants={variants} layout>
            <div className="tournament-card" onClick={() => navigate(`/dashboard/tournaments/${tournament._id}`)}>
                <div className="card-banner" style={{ backgroundImage: `url(${DEFAULT_COVER})` }}>
                    <div className="card-overlay"></div>
                    <div className={`status-badges ${statusInfo.class}`}>{statusInfo.icon} {statusInfo.label}</div>
                </div>
                <div className="card-content">
                    <h3 className="cards-title" title={tournament.title}>{tournament.title}</h3>
                    <div className="game-type"><FaGamepad /> {tournament.format === 'league' ? t('createTournament.fields.league') : 'Knockout'}</div>

                    <div className="card-stats">
                        <div className="stat-item"><span className="stats-label">{t('tournaments.entry')}</span><span className="stats-value text-white">{tournament.entryFee === 0 ? "FREE" : `${tournament.entryFee}` } {t('dashboard.currencies.TND')}</span></div>
                        <div className="stat-item"><span className="stats-label">{t('tournaments.prize')}</span><span className="stats-value prize-highlight"><FaCoins className="me-1" /> {tournament.prizePool} {t('dashboard.currencies.TND')}</span></div>
                    </div>

                    {(tournament.status === 'open' || tournament.status === 'check-in') && (
                        <div className="participants-progress">
                            <div className="progress-info"><span><FaUsers className="me-1" /> {participantsCount}/{maxParticipants}</span><span>{Math.round(fillPercentage)}%</span></div>
                            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${fillPercentage}%` }}></div></div>
                        </div>
                    )}

                    <div className="card-action">
                        {tournament.status === 'open' ? (
                            <button className="actions-btn btn-join">{t('tournaments.joinNow')}</button>
                        ) : (
                            <button className="actions-btn btn-view">{t('tournaments.viewDetails')}</button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default TournamentsListPage;