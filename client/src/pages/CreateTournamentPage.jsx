import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaTrophy, FaMoneyBillWave, FaGavel, FaCheck, FaUsers, FaGamepad, FaLayerGroup } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from 'axios';
import './CreateTournamentPage.css'; // تأكد من استيراد ملف التصميم الجديد

const CreateTournamentPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [leagues, setLeagues] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startDate: '',
        startTime: '',
        entryFee: 0,
        prizePool: 0,
        firstPlace: 0,
        secondPlace: 0,
        bestAttackPrize: 0, // جائزة أفضل هجوم
        bestDefensePrize: 0, // جائزة أفضل دفاع
        maxParticipants: 16,
        teamCategory: 'Clubs',
        specificLeague: '',
        incompleteAction: 'cancel',
        format: 'knockout',
        numberOfGroups: 4,
        qualifiersPerGroup: 2
    });

    const totalSteps = 4;
    // Step 2: Rules (Gavel), Step 3: Prizes (Money)
    const stepIcons = [<FaTrophy />, <FaGavel />, <FaMoneyBillWave />, <FaCheck />];
    const stepLabels = ['basics', 'rules', 'prizes', 'review'];

    // Fetch Leagues
    useEffect(() => {
        const fetchLeagues = async () => {
            try {
                // [تصحيح] جلب التوكن من التخزين المحلي
                const token = localStorage.getItem('token');

                // [تصحيح] إرسال التوكن في الـ Headers
                const res = await axios.get(`${process.env.REACT_APP_API_URL}/leagues/active`, {
                    headers: { Authorization: token }
                });

                setLeagues(res.data);
            } catch (err) {
                console.error("Error fetching leagues:", err);
                // اختياري: إذا فشل جلب الدوريات، لا داعي لطرد المستخدم، فقط سجل الخطأ
            }
        };
        fetchLeagues();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleNext = () => setStep(prev => Math.min(prev + 1, totalSteps));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));
    const goToStep = (s) => { if (s < step) setStep(s); };

    const handleSubmit = async () => {
        if (!formData.title || !formData.startDate || !formData.startTime) {
            return toast.error(t('createTournament.errors.fillRequired'));
        }
        setLoading(true);
        try {
            const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
            const payload = {
                title: formData.title,
                description: formData.description,
                entryFee: Number(formData.entryFee),
                prizePool: Number(formData.prizePool),
                prizesDistribution: {
                    firstPlace: Number(formData.firstPlace),
                    secondPlace: Number(formData.secondPlace),
                    bestAttack: Number(formData.bestAttackPrize || 0),
                    bestDefense: Number(formData.bestDefensePrize || 0)
                },
                maxParticipants: Number(formData.maxParticipants),
                startDate: startDateTime,
                incompleteAction: formData.incompleteAction,
                rules: {
                    teamCategory: formData.teamCategory,
                    specificLeague: formData.specificLeague || null,
                    matchDurationMinutes: 15,
                    eFootballMatchTime: '6'
                },
                format: formData.format,
                groupSettings: formData.format !== 'knockout' ? {
                    numberOfGroups: Number(formData.numberOfGroups),
                    qualifiersPerGroup: Number(formData.qualifiersPerGroup)
                } : {}
            };
            const token = localStorage.getItem('token');
            await axios.post(`${process.env.REACT_APP_API_URL}/tournaments/create`, payload, {
                headers: { Authorization: token }
            });
            toast.success(t('createTournament.successMessage'));
            navigate('/dashboard/tournaments');
        } catch (error) {
            toast.error(error.response?.data?.message || "Error");
        } finally {
            setLoading(false);
        }
    };

    // --- Render Steps ---

    const renderStepContent = () => {
        switch (step) {
            case 1: return (
                <div>
                    <h3 className="form-section-title">{t('createTournament.basicsTitle')}</h3>
                    <Form.Group className="mb-3">
                        <Form.Label className="custom-label">{t('createTournament.fields.title')}</Form.Label>
                        <Form.Control name="title" value={formData.title} onChange={handleChange} className="custom-input" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="custom-label">{t('createTournament.fields.description')}</Form.Label>
                        <Form.Control as="textarea" rows={3} name="description" value={formData.description} onChange={handleChange} className="custom-input" />
                    </Form.Group>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="custom-label">{t('createTournament.fields.startDate')}</Form.Label>
                                <Form.Control type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="custom-input" />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="custom-label">{t('createTournament.fields.startTime')}</Form.Label>
                                <Form.Control type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="custom-input" />
                            </Form.Group>
                        </Col>
                    </Row>
                </div>
            );
            case 2: return (
                <div>
                    <h3 className="form-section-title">{t('createTournament.rulesTitle')}</h3>
                    <Form.Group className="mb-4">
                        <Form.Label className="custom-label"><FaGamepad className="me-2" />{t('createTournament.fields.format')}</Form.Label>
                        <Form.Select name="format" value={formData.format} onChange={handleChange} className="custom-input">
                            <option value="knockout">{t('createTournament.fields.knockout')}</option>
                            <option value="league">{t('createTournament.fields.league')}</option>
                            <option value="hybrid">{t('createTournament.fields.hybrid')}</option>
                        </Form.Select>
                    </Form.Group>
                    {formData.format === 'hybrid' && (
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="custom-label"><FaLayerGroup className="me-2" />{t('createTournament.fields.numGroups')}</Form.Label>
                                    <Form.Select name="numberOfGroups" value={formData.numberOfGroups} onChange={handleChange} className="custom-input">
                                        <option value="2">2 {t('createTournament.groups')}</option>
                                        <option value="4">4 {t('createTournament.groups')}</option>
                                        <option value="8">8 {t('createTournament.groups')}</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="custom-label">{t('createTournament.fields.qualifiers')}</Form.Label>
                                    <Form.Select name="qualifiersPerGroup" value={formData.qualifiersPerGroup} onChange={handleChange} className="custom-input">
                                        <option value="1">1 ({t('createTournament.winnerOnly')})</option>
                                        <option value="2">2 ({t('createTournament.winnerRunner')})</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                    )}
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="custom-label"><FaUsers className="me-1" /> {t('createTournament.fields.participants')}</Form.Label>
                                <Form.Select name="maxParticipants" value={formData.maxParticipants} onChange={handleChange} className="custom-input">
                                    <option value="8">8 {t('createTournament.players')}</option>
                                    <option value="16">16 {t('createTournament.players')}</option>
                                    <option value="32">32 {t('createTournament.players')}</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="custom-label">{t('createTournament.fields.teams')}</Form.Label>
                                <Form.Select name="teamCategory" value={formData.teamCategory} onChange={handleChange} className="custom-input">
                                    <option value="Clubs">{t('createTournament.clubs')}</option>
                                    <option value="National Teams">{t('createTournament.nations')}</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group className="mb-3">
                        <Form.Label>{t('createTournament.fields.specificLeague')}</Form.Label>
                        <Form.Select
                            name="specificLeague"
                            value={formData.specificLeague}
                            onChange={handleChange}
                            className="custom-input"
                        >
                            <option value="">{t('createTournament.allLeagues')}</option>
                            {leagues
                                // [!] فلترة الدوريات حسب النوع المختار (Club/National)
                                .filter(l => l.type === (formData.teamCategory === 'Clubs' ? 'Club' : 'National'))
                                .map(l => (
                                    <option key={l._id} value={l._id}>{l.name}</option>
                                ))
                            }
                        </Form.Select>
                        <Form.Text className="text-muted">{t('createTournament.hints.league')}</Form.Text>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="custom-label">{t('createTournament.fields.incompleteAction')}</Form.Label>
                        <Form.Select name="incompleteAction" value={formData.incompleteAction} onChange={handleChange} className="custom-input">
                            <option value="cancel">{t('createTournament.cancelAction')}</option>
                            <option value="play_with_byes">{t('createTournament.playByesAction')}</option>
                        </Form.Select>
                    </Form.Group>
                </div>
            );
            case 3: return (
                <div>
                    <h3 className="form-section-title">{t('createTournament.prizesTitle')}</h3>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="custom-label">{t('createTournament.fields.entryFee')}</Form.Label>
                                <InputGroup><Form.Control type="number" name="entryFee" value={formData.entryFee} onChange={handleChange} className="custom-input" /><InputGroup.Text>TND</InputGroup.Text></InputGroup>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="custom-label">{t('createTournament.fields.prizePool')}</Form.Label>
                                <InputGroup><Form.Control type="number" name="prizePool" value={formData.prizePool} onChange={handleChange} className="custom-input" /><InputGroup.Text>TND</InputGroup.Text></InputGroup>
                            </Form.Group>
                        </Col>
                    </Row>
                    <h4 className="mt-4 mb-3">{t('createTournament.distributionTitle')}</h4>
                    {formData.format === 'league' ? (
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">🥇 {t('createTournament.fields.firstPlace')}</Form.Label>
                                    <Form.Control type="number" name="firstPlace" value={formData.firstPlace} onChange={handleChange} className="custom-input" />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">🎯 {t('createTournament.fields.bestAttack')}</Form.Label>
                                    <Form.Control type="number" name="bestAttackPrize" value={formData.bestAttackPrize} onChange={handleChange} className="custom-input" />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">🛡️ {t('createTournament.fields.bestDefense')}</Form.Label>
                                    <Form.Control type="number" name="bestDefensePrize" value={formData.bestDefensePrize} onChange={handleChange} className="custom-input" />
                                </Form.Group>
                            </Col>
                        </Row>
                    ) : (
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">🥇 {t('createTournament.fields.firstPlace')}</Form.Label>
                                    <Form.Control type="number" name="firstPlace" value={formData.firstPlace} onChange={handleChange} className="custom-input" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="custom-label">🥈 {t('createTournament.fields.secondPlace')}</Form.Label>
                                    <Form.Control type="number" name="secondPlace" value={formData.secondPlace} onChange={handleChange} className="custom-input" />
                                </Form.Group>
                            </Col>
                        </Row>
                    )}
                </div>
            );
            case 4: return (
                <div className="text-center">
                    <h3 className="form-section-title justify-content-center">{t('createTournament.reviewTitle')}</h3>
                    <div className="review-grid">
                        <div className="review-items">
                            <div className="review-label">{t('createTournament.fields.title')}</div>
                            <div className="review-value">{formData.title || "-"}</div>
                        </div>
                        <div className="review-items">
                            <div className="review-label">{t('createTournament.fields.format')}</div>
                            <div className="review-value text-warning">{t(`createTournament.fields.${formData.format}`)}</div>
                        </div>
                        <div className="review-items">
                            <div className="review-label">{t('createTournament.fields.entryFee')}</div>
                            <div className="review-value text-success">{formData.entryFee} TND</div>
                        </div>
                        <div className="review-items">
                            <div className="review-label">{t('createTournament.fields.participants')}</div>
                            <div className="review-value">{formData.maxParticipants}</div>
                        </div>
                    </div>
                </div>
            );
            default: return null;
        }
    };

    return (
        <Container className="create-tournament-container">
            <div className="wizard-card">
                <div className="wizard-progress">
                    {stepLabels.map((label, index) => (
                        <div
                            key={index}
                            className={`steps-indicator ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'completed' : ''}`}
                            onClick={() => goToStep(index + 1)}
                        >
                            <div className="step-circle">{step > index + 1 ? <FaCheck /> : stepIcons[index]}</div>
                            <div className="step-label">{t(`createTournament.steps.${label}`)}</div>
                        </div>
                    ))}
                </div>

                <div className="form-content">
                    {renderStepContent()}
                </div>

                <div className="wizard-actions">
                    <Button onClick={handleBack} className="btn-prev" disabled={step === 1}>
                        {t('common.back')}
                    </Button>
                    {step < totalSteps ? (
                        <Button onClick={handleNext} className="btn-next">
                            {t('common.next')}
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} className="btn-submit" disabled={loading}>
                            {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : t('createTournament.submitBtn')}
                        </Button>
                    )}
                </div>
            </div>
        </Container>
    );
};

export default CreateTournamentPage;