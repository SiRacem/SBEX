import React, { useEffect, useState } from 'react';
import { Container, Card, Button, Form, Row, Col, Badge } from 'react-bootstrap';
import { FaPlus, FaTrash, FaSave, FaGift } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

const AdminWheelSettings = () => {
    const { t } = useTranslation();
    const [segments, setSegments] = useState([]);
    
    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem("token");
            const { data } = await axios.get('/quests/config/wheel', { headers: { Authorization: `Bearer ${token}` }});
            setSegments(data);
        } catch (error) {
            toast.error("Failed to load settings");
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleChange = (index, field, value) => {
        const newSegments = [...segments];
        newSegments[index][field] = value;
        
        // اقتراح لون تلقائي عند تغيير النوع (اختياري)
        if (field === 'type' && value === 'free_spin' && !newSegments[index].color) {
            newSegments[index].color = '#28a745'; // أخضر للفات المجانية
        }
        
        setSegments(newSegments);
    };

    const addSegment = () => {
        setSegments([...segments, { type: 'credits', amount: 50, chance: 10, color: '#333333', text: 'Prize' }]);
    };

    const removeSegment = (index) => {
        if(segments.length <= 2) return toast.warning("Must have at least 2 segments");
        const newSegments = segments.filter((_, i) => i !== index);
        setSegments(newSegments);
    };

    const saveSettings = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.put('/quests/admin/config/wheel', { segments }, { headers: { Authorization: `Bearer ${token}` }});
            toast.success(t('admin.wheelSettings.saveSuccess'));
        } catch (error) {
            toast.error(t('admin.wheelSettings.saveError'));
        }
    };

    // دالة مساعدة لتحديد عنوان حقل الكمية
    const getAmountLabel = (type) => {
        switch(type) {
            case 'credits': return 'Credits Amount';
            case 'xp': return 'XP Points';
            case 'balance': return 'Money Amount (TND)';
            case 'free_spin': return 'Number of Spins'; // [!!!] تسمية واضحة
            default: return 'Amount';
        }
    };

    return (
        <Container className="py-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>🎡 {t('admin.wheelSettings.title')}</h3>
                <Button variant="primary" onClick={saveSettings}><FaSave className="me-2"/> {t('common.saveChanges')}</Button>
            </div>
            
            <Row>
                {segments.map((seg, index) => (
                    <Col md={6} lg={4} key={index} className="mb-3">
                        <Card className="h-100 shadow-sm border-0">
                            <Card.Header className="d-flex justify-content-between align-items-center" style={{backgroundColor: seg.color, color: '#fff'}}>
                                <span className="fw-bold">{t('admin.wheelSettings.segment')} {index + 1}</span>
                                <Button variant="link" size="sm" className="text-white p-0" onClick={() => removeSegment(index)}><FaTrash /></Button>
                            </Card.Header>
                            <Card.Body>
                                <Form.Group className="mb-2">
                                    <Form.Label>{t('admin.wheelSettings.type')}</Form.Label>
                                    <Form.Select value={seg.type} onChange={(e) => handleChange(index, 'type', e.target.value)}>
                                        <option value="credits">{t('luckyWheel.prizes.credits')}</option>
                                        <option value="xp">{t('luckyWheel.prizes.xp')}</option>
                                        <option value="balance">{t('luckyWheel.prizes.currency')}</option>
                                        {/* [!!!] الخيار الجديد [!!!] */}
                                        <option value="free_spin">{t('luckyWheel.prizes.free_spin', 'Free Spin')}</option>
                                        <option value="empty">{t('admin.wheelSettings.empty')}</option>
                                    </Form.Select>
                                </Form.Group>
                                
                                {seg.type !== 'empty' && (
                                    <Form.Group className="mb-2">
                                        <Form.Label>{getAmountLabel(seg.type)}</Form.Label>
                                        <Form.Control type="number" value={seg.amount} onChange={(e) => handleChange(index, 'amount', Number(e.target.value))} />
                                    </Form.Group>
                                )}

                                <Form.Group className="mb-2">
                                    <Form.Label>{t('admin.wheelSettings.chance')} (%)</Form.Label>
                                    <Form.Control type="number" value={seg.chance} onChange={(e) => handleChange(index, 'chance', Number(e.target.value))} />
                                </Form.Group>

                                <Form.Group className="mb-2">
                                    <Form.Label>{t('admin.wheelSettings.color')}</Form.Label>
                                    <div className="d-flex gap-2">
                                        <Form.Control type="color" value={seg.color} onChange={(e) => handleChange(index, 'color', e.target.value)} className="form-control-color" />
                                        <Form.Control type="text" value={seg.color} onChange={(e) => handleChange(index, 'color', e.target.value)} />
                                    </div>
                                </Form.Group>
                                
                                <Form.Group>
                                    <Form.Label>{t('admin.wheelSettings.textLabel')}</Form.Label>
                                    <Form.Control type="text" value={seg.text || ''} onChange={(e) => handleChange(index, 'text', e.target.value)} placeholder={t('admin.wheelSettings.textPlaceholder')} />
                                </Form.Group>

                                {/* معاينة بسيطة */}
                                {seg.type === 'free_spin' && (
                                    <div className="mt-2 text-center">
                                        <Badge bg="success"><FaGift /> Free Spin</Badge>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
                <Col md={6} lg={4} className="mb-3">
                    <Button variant="outline-success" className="w-100 h-100 d-flex align-items-center justify-content-center" style={{minHeight: '200px', borderStyle: 'dashed', borderWidth: '2px'}} onClick={addSegment}>
                        <FaPlus size={30} /> <span className="ms-2 fw-bold">{t('admin.wheelSettings.addSegment')}</span>
                    </Button>
                </Col>
            </Row>
        </Container>
    );
};

export default AdminWheelSettings;