import React, { useEffect, useState } from 'react';
import { Container, Card, Button, Form, Row, Col } from 'react-bootstrap';
import { FaPlus, FaTrash, FaSave, FaCoins } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

const AdminCheckInSettings = () => {
    const { t } = useTranslation();
    const [rewards, setRewards] = useState([]);
    const [loading, setLoading] = useState(true);

    const getTokenConfig = () => {
        const token = localStorage.getItem("token");
        return { headers: { Authorization: `Bearer ${token}` } };
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await axios.get('/quests/config/check-in', getTokenConfig());
            if(Array.isArray(data)) setRewards(data);
            setLoading(false);
        } catch (error) {
            toast.error(t('admin.checkInSettings.loadError', 'Failed to load settings'));
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await axios.put('/quests/admin/config/check-in', { rewards }, getTokenConfig());
            toast.success(t('admin.checkInSettings.saveSuccess', 'Settings updated successfully!'));
        } catch (error) {
            toast.error(t('admin.checkInSettings.saveError', 'Failed to save settings'));
        }
    };

    const handleAmountChange = (index, value) => {
        const newRewards = [...rewards];
        newRewards[index] = Number(value);
        setRewards(newRewards);
    };

    const addDay = () => {
        setRewards([...rewards, 50]); // Default value
    };

    const removeDay = (index) => {
        const newRewards = rewards.filter((_, i) => i !== index);
        setRewards(newRewards);
    };

    return (
        <Container className="py-5">
            <Card className="shadow-sm border-0">
                <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">{t('admin.checkInSettings.title', 'Daily Check-in Rewards Config')}</h5>
                    <Button variant="light" size="sm" onClick={handleSave} disabled={loading}>
                        <FaSave className="me-2" /> {t('common.saveChanges', 'Save Changes')}
                    </Button>
                </Card.Header>
                <Card.Body>
                    <p className="text-muted mb-4">
                        {t('admin.checkInSettings.description', 'Define the rewards for each day. The cycle will loop automatically after the last day.')}
                    </p>
                    
                    {loading ? (
                        <div className="text-center">{t('common.loading')}</div>
                    ) : (
                        <Row className="g-3">
                            {rewards.map((amount, index) => (
                                <Col key={index} xs={6} md={4} lg={3}>
                                    <Card className="h-100 border text-center p-3 position-relative bg-light">
                                        <span className="position-absolute top-0 start-0 m-2 badge bg-secondary rounded-circle">
                                            {t('quests.checkIn.day')} {index + 1}
                                        </span>
                                        {rewards.length > 1 && (
                                            <Button 
                                                variant="link" 
                                                className="position-absolute top-0 end-0 text-danger p-1"
                                                onClick={() => removeDay(index)}
                                            >
                                                <FaTrash size={12} />
                                            </Button>
                                        )}
                                        
                                        <div className="my-3 text-warning display-6">
                                            <FaCoins />
                                        </div>
                                        
                                        <Form.Group>
                                            <Form.Label className="small text-muted">{t('admin.checkInSettings.amountLabel', 'Credits')}</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                min="1"
                                                value={amount} 
                                                onChange={(e) => handleAmountChange(index, e.target.value)}
                                                className="text-center fw-bold"
                                            />
                                        </Form.Group>
                                    </Card>
                                </Col>
                            ))}
                            
                            <Col xs={6} md={4} lg={3}>
                                <Button 
                                    variant="outline-primary" 
                                    className="w-100 h-100 d-flex flex-column align-items-center justify-content-center border-dashed"
                                    style={{ borderStyle: 'dashed', minHeight: '180px', borderWidth: '2px' }}
                                    onClick={addDay}
                                >
                                    <FaPlus size={24} className="mb-2" />
                                    <span>{t('admin.checkInSettings.addDay', 'Add Day')}</span>
                                </Button>
                            </Col>
                        </Row>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default AdminCheckInSettings;