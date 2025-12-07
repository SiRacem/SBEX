import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createTournament } from '../redux/actions/tournamentAction';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Form, Row, Col, Spinner } from 'react-bootstrap';
import { FaTrophy, FaMoneyBillWave, FaGavel, FaCheckCircle, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './CreateTournamentPage.css';

const CreateTournamentPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loadingCreate } = useSelector(state => state.tournamentReducer);

    const steps = [
        { id: 1, label: t('createTournament.steps.basics'), icon: <FaTrophy /> },
        { id: 2, label: t('createTournament.steps.prizes'), icon: <FaMoneyBillWave /> },
        { id: 3, label: t('createTournament.steps.rules'), icon: <FaGavel /> },
        { id: 4, label: t('createTournament.steps.review'), icon: <FaCheckCircle /> }
    ];

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        startTime: '', 
        entryFee: 0,
        prizePool: 0,
        maxParticipants: 16,
        incompleteAction: 'cancel',
        firstPlace: 0,
        secondPlace: 0,
        teamCategory: 'Clubs',
        matchDurationMinutes: 15,
        eFootballMatchTime: '6 mins',
        allowedTeamsType: 'All', 
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleNext = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const handlePrev = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        const fullStartDate = new Date(`${formData.startDate}T${formData.startTime}`);
        const payload = {
            title: formData.title,
            description: formData.description,
            startDate: fullStartDate,
            entryFee: Number(formData.entryFee),
            prizePool: Number(formData.prizePool),
            maxParticipants: Number(formData.maxParticipants),
            incompleteAction: formData.incompleteAction,
            prizesDistribution: {
                firstPlace: Number(formData.firstPlace),
                secondPlace: Number(formData.secondPlace),
                thirdPlace: 0 
            },
            rules: {
                teamCategory: formData.teamCategory,
                matchDurationMinutes: Number(formData.matchDurationMinutes),
                eFootballMatchTime: formData.eFootballMatchTime
            }
        };

        const result = await dispatch(createTournament(payload));
        if (result.success) {
            toast.success(t('createTournament.successMessage'));
            navigate('/dashboard/tournaments');
        } else {
            toast.error(result.message);
        }
    };

    const variants = {
        enter: { x: 50, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -50, opacity: 0 }
    };

    return (
        <div className="create-tournament-container">
            <div className="wizard-card">
                
                <div className="wizard-progress">
                    {steps.map((step) => (
                        <div 
                            key={step.id} 
                            className={`steps-indicator ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
                        >
                            <div className="step-circle">
                                {currentStep > step.id ? <FaCheckCircle /> : step.id}
                            </div>
                            <span className="step-label">{step.label}</span>
                        </div>
                    ))}
                </div>

                <AnimatePresence mode='wait'>
                    <motion.div
                        key={currentStep}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        {currentStep === 1 && (
                            <div className="step-content">
                                <h4 className="form-section-title">{t('createTournament.basicsTitle')}</h4>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">{t('createTournament.fields.title')}</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        name="title" 
                                        className="custom-input" 
                                        placeholder="e.g. Weekly Cup #45"
                                        value={formData.title} 
                                        onChange={handleChange} 
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">{t('createTournament.fields.description')}</Form.Label>
                                    <Form.Control 
                                        as="textarea" 
                                        rows={3}
                                        name="description" 
                                        className="custom-input" 
                                        value={formData.description} 
                                        onChange={handleChange} 
                                    />
                                </Form.Group>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.startDate')}</Form.Label>
                                            <Form.Control 
                                                type="date" 
                                                name="startDate" 
                                                className="custom-input" 
                                                value={formData.startDate} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.startTime')}</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="startTime" 
                                                className="custom-input" 
                                                value={formData.startTime} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="step-content">
                                <h4 className="form-section-title">{t('createTournament.prizesTitle')}</h4>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.entryFee')}</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="entryFee" 
                                                className="custom-input" 
                                                value={formData.entryFee} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.prizePool')}</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="prizePool" 
                                                className="custom-input" 
                                                value={formData.prizePool} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <hr className="border-secondary my-4"/>
                                <h5 className="text-white mb-3">{t('createTournament.distributionTitle')}</h5>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.firstPlace')}</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="firstPlace" 
                                                className="custom-input" 
                                                value={formData.firstPlace} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.secondPlace')}</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="secondPlace" 
                                                className="custom-input" 
                                                value={formData.secondPlace} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="step-content">
                                <h4 className="form-section-title">{t('createTournament.rulesTitle')}</h4>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.participants')}</Form.Label>
                                            <Form.Select 
                                                name="maxParticipants" 
                                                className="custom-input" 
                                                value={formData.maxParticipants} 
                                                onChange={handleChange}
                                            >
                                                <option value="16">16 {t('createTournament.players')}</option>
                                                <option value="32">32 {t('createTournament.players')}</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="custom-label">{t('createTournament.fields.teams')}</Form.Label>
                                            <Form.Select 
                                                name="teamCategory" 
                                                className="custom-input" 
                                                value={formData.teamCategory} 
                                                onChange={handleChange}
                                            >
                                                <option value="Clubs">{t('createTournament.clubs')}</option>
                                                <option value="National Teams">{t('createTournament.nations')}</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">{t('createTournament.fields.incompleteAction')}</Form.Label>
                                    <Form.Select 
                                        name="incompleteAction" 
                                        className="custom-input" 
                                        value={formData.incompleteAction} 
                                        onChange={handleChange}
                                    >
                                        <option value="cancel">{t('createTournament.cancelAction')}</option>
                                        <option value="play_with_byes">{t('createTournament.playByesAction')}</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div className="step-content">
                                <h4 className="form-section-title">{t('createTournament.reviewTitle')}</h4>
                                <div className="review-grid">
                                    <div className="review-items">
                                        <div className="review-label">{t('createTournament.fields.title')}</div>
                                        <div className="review-value">{formData.title}</div>
                                    </div>
                                    <div className="review-items">
                                        <div className="review-label">{t('createTournament.fields.entryFee')}</div>
                                        <div className="review-value text-success">{formData.entryFee} TND</div>
                                    </div>
                                    <div className="review-items">
                                        <div className="review-label">{t('createTournament.fields.prizePool')}</div>
                                        <div className="review-value text-warning">{formData.prizePool} TND</div>
                                    </div>
                                    <div className="review-items">
                                        <div className="review-label">{t('createTournament.fields.startDate')}</div>
                                        <div className="review-value">{formData.startDate} {t('common.at', 'at')} {formData.startTime}</div>
                                    </div>
                                    <div className="review-items">
                                        <div className="review-label">{t('createTournament.fields.participants')}</div>
                                        <div className="review-value">{formData.maxParticipants}</div>
                                    </div>
                                    <div className="review-items">
                                        <div className="review-label">{t('createTournament.fields.teams')}</div>
                                        <div className="review-value">{formData.teamCategory}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="wizard-actions">
                    <button 
                        className={`btn-prev ${currentStep === 1 ? 'btn-disabled' : ''}`}
                        onClick={handlePrev}
                        disabled={currentStep === 1}
                    >
                        <FaChevronLeft className="me-2"/> {t('common.back', 'Back')}
                    </button>

                    {currentStep < 4 ? (
                        <button className="btn-next" onClick={handleNext}>
                            {t('common.next', 'Next')} <FaChevronRight className="ms-2"/>
                        </button>
                    ) : (
                        <button 
                            className="btn-submit" 
                            onClick={handleSubmit} 
                            disabled={loadingCreate}
                        >
                            {loadingCreate ? <Spinner size="sm"/> : <><FaCheckCircle className="me-2"/> {t('createTournament.submitBtn')}</>}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default CreateTournamentPage;