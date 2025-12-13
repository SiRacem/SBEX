// src/components/admin/AdminLeaguesPage.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllLeagues, createLeague, updateLeague, deleteLeague, getTeamsByLeague, addTeam, deleteTeam } from '../../redux/actions/leagueAction';
import { Container, Row, Col, Button, Modal, Form, Spinner, Badge } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaGlobe, FaTshirt, FaUsersCog, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import './AdminLeaguesPage.css';

const AdminLeaguesPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { leagues, teams, loadingLeagues, loadingTeams, loadingAction } = useSelector(state => state.leagueReducer);

    // --- State for League Modal ---
    const [showLeagueModal, setShowLeagueModal] = useState(false);
    const [isEditingLeague, setIsEditingLeague] = useState(false);
    const [currentLeague, setCurrentLeague] = useState(null);
    const [leagueFormData, setLeagueFormData] = useState({ name: '', logo: '', type: 'Club', region: '' });

    // --- State for Teams Modal ---
    const [showTeamsModal, setShowTeamsModal] = useState(false);
    const [teamFormData, setTeamFormData] = useState({ name: '', logo: '' });
    const [selectedLeagueId, setSelectedLeagueId] = useState(null);

    useEffect(() => {
        dispatch(getAllLeagues());
    }, [dispatch]);

    // --- League Handlers ---
    const handleOpenLeagueModal = (league = null) => {
        if (league) {
            setIsEditingLeague(true);
            setCurrentLeague(league);
            setLeagueFormData({ name: league.name, logo: league.logo, type: league.type, region: league.region });
        } else {
            setIsEditingLeague(false);
            setCurrentLeague(null);
            setLeagueFormData({ name: '', logo: '', type: 'Club', region: '' });
        }
        setShowLeagueModal(true);
    };

    const handleLeagueSubmit = async (e) => {
        e.preventDefault();
        let result;
        if (isEditingLeague) {
            result = await dispatch(updateLeague(currentLeague._id, leagueFormData));
        } else {
            result = await dispatch(createLeague(leagueFormData));
        }

        if (result.success) {
            toast.success(isEditingLeague ? t('admin.leagues.leagueUpdated') : t('admin.leagues.leagueCreated'));
            setShowLeagueModal(false);
        } else {
            toast.error(result.message || t('admin.leagues.operationFailed'));
        }
    };

    const handleDeleteLeague = async (id) => {
        if (window.confirm(t('admin.leagues.deleteLeagueConfirm'))) {
            await dispatch(deleteLeague(id));
            toast.success(t('admin.leagues.leagueDeleted'));
        }
    };

    const handleToggleActive = async (league) => {
        await dispatch(updateLeague(league._id, { isActive: !league.isActive }));
        toast.info(league.isActive ? t('admin.leagues.leagueDeactivated') : t('admin.leagues.leagueActivated'));
    };

    // --- Team Handlers ---
    const handleManageTeams = async (leagueId) => {
        setSelectedLeagueId(leagueId);
        await dispatch(getTeamsByLeague(leagueId));
        setShowTeamsModal(true);
    };

    const handleTeamSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...teamFormData, leagueId: selectedLeagueId };
        const result = await dispatch(addTeam(payload));
        if (result.success) {
            toast.success(t('admin.leagues.teamAdded'));
            setTeamFormData({ name: '', logo: '' }); // Clear form
        } else {
            toast.error(result.message);
        }
    };

    const handleDeleteTeam = async (teamId) => {
        if (window.confirm(t('admin.leagues.deleteTeamConfirm'))) {
            await dispatch(deleteTeam(teamId));
            toast.success(t('admin.leagues.teamDeleted'));
        }
    };

    // Animation variants
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="admin-leagues-container">
            <Container fluid>
                {/* Header */}
                <div className="page-header">
                    <div className="header-title">
                        <FaGlobe className="text-primary" /> {t('admin.leagues.title')}
                    </div>
                    <button className="add-btn" onClick={() => handleOpenLeagueModal()}>
                        <FaPlus /> {t('admin.leagues.addLeague')}
                    </button>
                </div>

                {/* Content */}
                {loadingLeagues ? (
                    <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                ) : leagues.length === 0 ? (
                    <div className="no-leagues">
                        <h4>{t('admin.leagues.noLeagues')}</h4>
                        <p>{t('admin.leagues.createFirst')}</p>
                    </div>
                ) : (
                    <div className="leagues-grid">
                        <AnimatePresence>
                            {leagues.map((league) => (
                                <motion.div
                                    key={league._id}
                                    variants={cardVariants}
                                    initial="hidden"
                                    animate="visible"
                                    layout
                                    className="league-card"
                                >
                                    {/* Toggle Switch */}
                                    <div className="toggle-switch">
                                        <Form.Check
                                            type="switch"
                                            checked={league.isActive}
                                            onChange={() => handleToggleActive(league)}
                                            title={t('admin.leagues.toggleActive')}
                                        />
                                    </div>

                                    <img src={league.logo} alt={league.name} className="league-logo" onError={(e) => e.target.src = 'https://via.placeholder.com/80'} />
                                    <h4 className="league-name">{league.name}</h4>
                                    <span className="league-type-badge">{league.type}</span>

                                    <div className="card-actions">
                                        <button className="action-icon-btn btn-manage" onClick={() => handleManageTeams(league._id)}>
                                            <FaUsersCog /> {t('admin.leagues.teams')}
                                        </button>
                                        <div>
                                            <button className="action-icon-btn btn-edit me-2" onClick={() => handleOpenLeagueModal(league)}>
                                                <FaEdit />
                                            </button>
                                            <button className="action-icon-btn btn-delete" onClick={() => handleDeleteLeague(league._id)}>
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </Container>

            {/* --- League Modal (Create/Edit) --- */}
            <Modal show={showLeagueModal} onHide={() => setShowLeagueModal(false)} centered className="dark-modal">
                <Modal.Header closeButton>
                    <Modal.Title>{isEditingLeague ? t('admin.leagues.editLeague') : t('admin.leagues.addLeague')}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleLeagueSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('admin.leagues.leagueName')}</Form.Label>
                            <Form.Control
                                type="text"
                                required
                                value={leagueFormData.name}
                                onChange={(e) => setLeagueFormData({ ...leagueFormData, name: e.target.value })}
                                placeholder={t('admin.leagues.namePlaceholder')}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('admin.leagues.logoUrl')}</Form.Label>
                            <Form.Control
                                type="text"
                                required
                                value={leagueFormData.logo}
                                onChange={(e) => setLeagueFormData({ ...leagueFormData, logo: e.target.value })}
                                placeholder={t('admin.leagues.logoPlaceholder')}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('admin.leagues.type')}</Form.Label>
                            <Form.Select
                                value={leagueFormData.type}
                                onChange={(e) => setLeagueFormData({ ...leagueFormData, type: e.target.value })}
                            >
                                <option value="Club">{t('admin.leagues.clubOption')}</option>
                                <option value="National">{t('admin.leagues.nationalOption')}</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('admin.leagues.region')}</Form.Label>
                            <Form.Control
                                type="text"
                                value={leagueFormData.region}
                                onChange={(e) => setLeagueFormData({ ...leagueFormData, region: e.target.value })}
                                placeholder={t('admin.leagues.regionPlaceholder')}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowLeagueModal(false)}>{t('common.cancel')}</Button>
                        <Button variant="primary" type="submit" disabled={loadingAction}>
                            {loadingAction ? <Spinner size="sm" /> : t('admin.leagues.saveLeague')}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* --- Teams Management Modal --- */}
            <Modal show={showTeamsModal} onHide={() => setShowTeamsModal(false)} size="lg" centered className="dark-modal">
                <Modal.Header closeButton>
                    <Modal.Title>{t('admin.leagues.manageTeams')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Add Team Form */}
                    <div className="p-3 bg-dark rounded mb-4 border border-secondary">
                        <h6>{t('admin.leagues.addTeam')}</h6>
                        <Form onSubmit={handleTeamSubmit} className="d-flex gap-2">
                            <Form.Control
                                type="text"
                                placeholder={t('admin.leagues.teamName')}
                                required
                                value={teamFormData.name}
                                onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                            />
                            <Form.Control
                                type="text"
                                placeholder={t('admin.leagues.logoPlaceholder')}
                                required
                                value={teamFormData.logo}
                                onChange={(e) => setTeamFormData({ ...teamFormData, logo: e.target.value })}
                            />
                            <Button type="submit" disabled={loadingAction}>
                                <FaPlus /> {t('admin.leagues.add')}
                            </Button>
                        </Form>
                    </div>

                    {/* Teams List */}
                    <div className="teams-list-container">
                        {loadingTeams ? (
                            <div className="text-center"><Spinner animation="border" size="sm" /></div>
                        ) : teams.length === 0 ? (
                            <p className="text-center text-muted">{t('admin.leagues.noTeams')}</p>
                        ) : (
                            teams.map(team => (
                                <div key={team._id} className="team-item">
                                    <div className="team-info">
                                        <img src={team.logo} alt={team.name} className="team-logo-sm" onError={(e) => e.target.src = 'https://bootdey.com/img/Content/avatar/avatar7.png'} />
                                        <span className="fw-bold">{team.name}</span>
                                    </div>
                                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteTeam(team._id)}>
                                        <FaTrash />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default AdminLeaguesPage;