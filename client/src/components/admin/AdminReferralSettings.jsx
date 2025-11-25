import React, { useEffect, useState } from 'react';
import { Container, Card, Form, Button, Spinner, Row, Col, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaCogs, FaSave } from 'react-icons/fa';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const AdminReferralSettings = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState({ commissionRate: 1, minTransferAmount: 30, transferFee: 2 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // جلب الإعدادات عند التحميل
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const token = localStorage.getItem('token');
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const { data } = await axios.get(`${BACKEND_URL}/referral/admin/settings`, config);
                setSettings(data);
            } catch (error) {
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.put(`${BACKEND_URL}/referral/admin/settings`, settings, config);
            toast.success(t('admin.referrals.success'));
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error saving");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Container className="py-5 text-center"><Spinner animation="border" /></Container>;

    return (
        <Container className="py-5">
            <h2 className="mb-4 text-primary"><FaCogs className="me-2" /> {t('admin.referrals.pageTitle')}</h2>
            
            <Card className="shadow-sm border-0" style={{maxWidth: '600px'}}>
                <Card.Body className="p-4">
                    <Form onSubmit={handleSubmit}>
                        
                        {/* 1. نسبة العمولة */}
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold">{t('admin.referrals.rateLabel')}</Form.Label>
                            <div className="input-group">
                                <Form.Control 
                                    type="number" 
                                    step="0.1" 
                                    name="commissionRate" 
                                    value={settings.commissionRate} 
                                    onChange={handleChange} 
                                    required 
                                />
                                <span className="input-group-text">%</span>
                            </div>
                            <Form.Text className="text-muted">{t('admin.referrals.descRate')}</Form.Text>
                        </Form.Group>

                        {/* 2. الحد الأدنى للتحويل */}
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold">{t('admin.referrals.minTransferLabel')}</Form.Label>
                            <div className="input-group">
                                <Form.Control 
                                    type="number" 
                                    name="minTransferAmount" 
                                    value={settings.minTransferAmount} 
                                    onChange={handleChange} 
                                    required 
                                />
                                <span className="input-group-text">TND</span>
                            </div>
                            <Form.Text className="text-muted">{t('admin.referrals.descMin')}</Form.Text>
                        </Form.Group>

                        {/* 3. رسوم التحويل */}
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold">{t('admin.referrals.feeLabel')}</Form.Label>
                            <div className="input-group">
                                <Form.Control 
                                    type="number" 
                                    step="0.1" 
                                    name="transferFee" 
                                    value={settings.transferFee} 
                                    onChange={handleChange} 
                                    required 
                                />
                                <span className="input-group-text">%</span>
                            </div>
                             <Form.Text className="text-muted">{t('admin.referrals.descFee')}</Form.Text>
                        </Form.Group>

                        <Button variant="primary" type="submit" className="w-100" disabled={saving}>
                            {saving ? <Spinner size="sm" /> : <><FaSave className="me-2" /> {t('admin.referrals.saveButton')}</>}
                        </Button>

                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default AdminReferralSettings;