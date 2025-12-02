import React, { useEffect, useState } from 'react';
import { Container, Table, Button, Modal, Form, Row, Col, Badge } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { adminGetAllQuests, createQuest, updateQuest, deleteQuest } from '../../redux/actions/questAction';
import { FaEdit, FaTrash, FaPlus, FaCoins, FaStar, FaGift } from 'react-icons/fa'; // أيقونة Gift
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

const AdminQuestManagement = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const { quests } = useSelector(state => state.questReducer);

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);

    const initialForm = {
        titleAr: '', titleEn: '',
        descAr: '', descEn: '',
        type: 'Daily',
        eventTrigger: 'LOGIN',
        targetCount: 1,
        creditsReward: 0,
        xpReward: 0,
        freeSpinsReward: 0,
        isActive: true
    };
    const [formData, setFormData] = useState(initialForm);

    useEffect(() => {
        dispatch(adminGetAllQuests());
    }, [dispatch]);

    const handleOpenCreate = () => {
        setFormData(initialForm);
        setEditMode(false);
        setShowModal(true);
    };

    const handleOpenEdit = (quest) => {
        setFormData({
            titleAr: quest.title.ar,
            titleEn: quest.title.en,
            descAr: quest.description.ar,
            descEn: quest.description.en,
            type: quest.type,
            eventTrigger: quest.eventTrigger,
            targetCount: quest.targetCount,
            creditsReward: quest.reward.credits,
            xpReward: quest.reward.xp,
            freeSpinsReward: quest.reward.freeSpins || 0,
            isActive: quest.isActive
        });
        setCurrentId(quest._id);
        setEditMode(true);
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.titleAr) {
            toast.error(t('admin.quests.validationError', 'Arabic title is required'));
            return;
        }

        const payload = {
            title: { ar: formData.titleAr, en: formData.titleEn },
            description: { ar: formData.descAr, en: formData.descEn },
            type: formData.type,
            eventTrigger: formData.eventTrigger,
            targetCount: Number(formData.targetCount),
            reward: { 
                credits: Number(formData.creditsReward), 
                xp: Number(formData.xpReward),
                freeSpins: Number(formData.freeSpinsReward)
            },
            isActive: formData.isActive
        };

        try {
            if (editMode) {
                await dispatch(updateQuest(currentId, payload));
                toast.success(t('admin.quests.toast.updateSuccess'));
            } else {
                await dispatch(createQuest(payload));
                toast.success(t('admin.quests.toast.createSuccess'));
            }
            setShowModal(false);
        } catch (error) {
            toast.error(t('admin.quests.toast.error'));
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('common.confirmDelete', 'Are you sure?'))) {
            try {
                await dispatch(deleteQuest(id));
                toast.success(t('admin.quests.toast.deleteSuccess'));
            } catch (error) {
                toast.error(t('admin.quests.toast.error'));
            }
        }
    };

    return (
        <Container className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>{t('admin.quests.pageTitle', 'Quest Management System')}</h3>
                <Button variant="success" onClick={handleOpenCreate}>
                    <FaPlus className="me-2" /> {t('admin.quests.addNew', 'Add New Quest')}
                </Button>
            </div>

            <Table striped bordered hover responsive className="align-middle text-center">
                <thead className="bg-light">
                    <tr>
                        <th>{t('admin.quests.table.title')}</th>
                        <th>{t('admin.quests.table.type')}</th>
                        <th>{t('admin.quests.table.trigger')}</th>
                        <th>{t('admin.quests.table.rewards')}</th>
                        <th>{t('admin.quests.table.status')}</th>
                        <th>{t('admin.quests.table.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {quests && quests.map(quest => (
                        <tr key={quest._id}>
                            <td className="text-start">
                                <strong>{quest.title?.ar}</strong>
                                {quest.title?.en && quest.title.en !== quest.title.ar && <><br /><small className="text-muted">{quest.title.en}</small></>}
                            </td>
                            <td><Badge bg="info">{t(`quests.types.${quest.type}`, quest.type)}</Badge></td>
                            <td><Badge bg="secondary">{quest.eventTrigger}</Badge> <span className="ms-2">x {quest.targetCount}</span></td>
                            <td>
                                <div className="d-flex justify-content-center gap-2">
                                    {quest.reward?.credits > 0 && <Badge bg="warning" text="dark"><FaCoins /> {quest.reward.credits}</Badge>}
                                    {quest.reward?.xp > 0 && <Badge bg="primary"><FaStar /> {quest.reward.xp}</Badge>}
                                    {quest.reward?.freeSpins > 0 && <Badge bg="success"><FaGift /> {quest.reward.freeSpins}</Badge>}
                                </div>
                            </td>
                            <td>{quest.isActive ? <Badge bg="success">{t('common.active', 'Active')}</Badge> : <Badge bg="danger">{t('common.inactive', 'Inactive')}</Badge>}</td>
                            <td>
                                <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleOpenEdit(quest)}><FaEdit /></Button>
                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(quest._id)}><FaTrash /></Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>{editMode ? t('admin.quests.modal.editTitle') : t('admin.quests.modal.createTitle')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.titleAr')} <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="text" value={formData.titleAr} onChange={e => setFormData({ ...formData, titleAr: e.target.value })} dir="rtl" />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.titleEn')} <small className="text-muted">({t('common.optional')})</small></Form.Label>
                                    <Form.Control type="text" value={formData.titleEn} onChange={e => setFormData({ ...formData, titleEn: e.target.value })} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <hr />
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.descAr')}</Form.Label>
                                    <Form.Control as="textarea" rows={2} value={formData.descAr} onChange={e => setFormData({ ...formData, descAr: e.target.value })} dir="rtl" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.descEn')}</Form.Label>
                                    <Form.Control as="textarea" rows={2} value={formData.descEn} onChange={e => setFormData({ ...formData, descEn: e.target.value })} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.type')}</Form.Label>
                                    <Form.Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="Daily">Daily (Resets daily)</option>
                                        <option value="OneTime">One Time</option>
                                        <option value="Weekly">Weekly</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.trigger')}</Form.Label>
                                    <Form.Select value={formData.eventTrigger} onChange={e => setFormData({ ...formData, eventTrigger: e.target.value })}>
                                        <option value="LOGIN">Login</option>
                                        <option value="CHECK_IN">Daily Check-in</option>
                                        <option value="SELL_PRODUCT">Sell Product</option>
                                        <option value="BUY_PRODUCT">Buy Product</option>
                                        <option value="ADD_PRODUCT">Add Product</option>
                                        <option value="REFERRAL">Referral</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>{t('admin.quests.form.target')}</Form.Label>
                                    <Form.Control type="number" min="1" value={formData.targetCount} onChange={e => setFormData({ ...formData, targetCount: e.target.value })} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Credits Reward</Form.Label>
                                    <Form.Control type="number" min="0" value={formData.creditsReward} onChange={e => setFormData({ ...formData, creditsReward: e.target.value })} />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>XP Reward</Form.Label>
                                    <Form.Control type="number" min="0" value={formData.xpReward} onChange={e => setFormData({ ...formData, xpReward: e.target.value })} />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                {/* [!!!] حقل اللفات المجانية الجديد [!!!] */}
                                <Form.Group>
                                    <Form.Label>Free Spins</Form.Label>
                                    <Form.Control type="number" min="0" value={formData.freeSpinsReward} onChange={e => setFormData({ ...formData, freeSpinsReward: e.target.value })} />
                                </Form.Group>
                            </Col>
                            <Col md={3} className="d-flex align-items-center justify-content-center">
                                <Form.Check type="switch" id="custom-switch" label={t('common.active')} checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={handleSubmit}>{editMode ? t('common.saveChanges') : t('common.create')}</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default AdminQuestManagement;