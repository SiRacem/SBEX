import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Row, Col, Card, Button, Form, InputGroup, Table, Badge, Modal, Spinner, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { FaCopy, FaUsers, FaExchangeAlt, FaLink } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getReferralStats, bindReferral, transferReferralBalance } from '../redux/actions/referralAction';
import './ReferralsPage.css';

const TND_USD_RATE = 3.0; // سعر الصرف التقريبي

const ReferralsPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { stats, loading, bindLoading, transferLoading } = useSelector(state => state.referralReducer);
    const { user } = useSelector(state => state.userReducer);

    const [referralCodeInput, setReferralCodeInput] = useState('');
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');

    // حساب القيم الديناميكية للتحويل
    const feePercentage = stats?.config?.transferFee || 2;
    const minAmount = stats?.config?.minTransferAmount || 30;
    const amountNum = parseFloat(transferAmount) || 0;
    const feeValue = (amountNum * feePercentage) / 100;
    const netValue = amountNum - feeValue;

    useEffect(() => {
        dispatch(getReferralStats());
    }, [dispatch]);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        toast.success(t('referrals.inviteCard.copied'));
    };

    const handleBind = () => {
        dispatch(bindReferral(referralCodeInput))
            .then(() => {
                toast.success(t('referrals.bindCard.success'));
                setReferralCodeInput('');
            })
            .catch((err) => toast.error(err.response?.data?.msg || 'Error'));
    };

    const handleTransfer = () => {
        dispatch(transferReferralBalance(transferAmount))
            .then((data) => {
                toast.success(t('referrals.stats.transferSuccess'));
                setShowTransferModal(false);
                setTransferAmount('');
            })
            .catch((err) => toast.error(err.response?.data?.msg || 'Error'));
    };

    // رابط الدعوة (استخدم window.location.origin ليكون ديناميكياً)
    const origin = window.location.origin;
    const referralCode = stats?.referralCode || user?.referralCode || '...';
    const referralLink = `${origin}/register?ref=${referralCode}`;

    return (
        <Container className="py-5 referrals-page">
            {/* [!] إصلاح الترجمة هنا */}
            <h2 className="mb-4 fw-bold"><FaUsers className="me-2 text-primary" /> {t('referrals.pageTitle')}</h2>

            <Row className="mb-4 g-4">
                {/* بطاقة الدعوة */}
                <Col md={user?.referredBy ? 12 : 8}>
                    <Card className="h-100 shadow-sm border-0 bg-gradient-primary-light">
                        <Card.Body>
                            <h4 className="invite-card-title">{t('referrals.inviteCard.title')}</h4>
                            <p className="text-muted">{t('referrals.inviteCard.subtitle')}</p>
                            
                            <Row className="align-items-end mt-4">
                                <Col md={6}>
                                    <Form.Label className="fw-bold text-secondary">{t('referrals.inviteCard.codeLabel')}</Form.Label>
                                    <InputGroup className="mb-3">
                                        <Form.Control value={referralCode} readOnly className="referral-code-input fw-bold text-center text-primary fs-4" />
                                        <Button variant="outline-primary" className="referral-copy-btn" onClick={() => handleCopy(referralCode)}><FaCopy /></Button>
                                    </InputGroup>
                                </Col>
                                <Col md={6}>
                                    <Button variant="light" className="w-100 mb-3 border py-2" onClick={() => handleCopy(referralLink)}>
                                        <FaLink className="me-2" /> {t('referrals.inviteCard.shareLink')}
                                    </Button>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>

                {/* بطاقة الربط - تظهر فقط إذا لم يكن مربوطاً */}
                {!user?.referredBy && (
                    <Col md={4}>
                        <Card className="h-100 shadow-sm border-0 bind-card">
                            <Card.Body>
                                <h5 className="fw-bold">{t('referrals.bindCard.title')}</h5>
                                <p className="small text-muted mb-4">{t('referrals.bindCard.subtitle')}</p>
                                <Form.Group className="mb-3">
                                    <Form.Control 
                                        placeholder={t('referrals.bindCard.placeholder')} 
                                        value={referralCodeInput}
                                        onChange={(e) => setReferralCodeInput(e.target.value)}
                                        className="py-2"
                                    />
                                </Form.Group>
                                <Button variant="success" className="w-100 py-2 fw-bold" onClick={handleBind} disabled={bindLoading || !referralCodeInput}>
                                    {bindLoading ? <Spinner size="sm" /> : t('referrals.bindCard.button')}
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                )}
            </Row>

            {/* الإحصائيات */}
            <Row className="mb-4 g-3">
                {/* بطاقة الرصيد والتحويل */}
                <Col md={3}>
                    <Card className="shadow-sm border-0 stat-card h-100">
                        <Card.Body className="d-flex flex-column justify-content-center align-items-center text-center">
                            <div className="stat-label">{t('referrals.stats.balance')}</div>
                            <h3 className="stat-value text-success-dark mb-0">
                                {(stats?.referralBalance || user?.referralBalance || 0).toFixed(2)} TND
                            </h3>
                            {/* [!!!] إضافة القيمة التقريبية [!!!] */}
                            <small className="text-muted mb-3">
                                ≈ ${((stats?.referralBalance || user?.referralBalance || 0) / TND_USD_RATE).toFixed(2)}
                            </small>
                            
                            <Button size="sm" variant="success" onClick={() => setShowTransferModal(true)} className="w-100">
                                <FaExchangeAlt className="me-1" /> {t('referrals.stats.transferButton')}
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
                
                {/* بطاقة إجمالي الأرباح */}
                <Col md={3}>
                    <Card className="shadow-sm border-0 stat-card h-100">
                        <Card.Body className="d-flex flex-column justify-content-center text-center">
                             <div className="stat-label">{t('referrals.stats.totalEarnings')}</div>
                             <h3 className="stat-value text-dark mb-0">
                                 {(stats?.totalEarnings || user?.totalReferralEarnings || 0).toFixed(2)} TND
                             </h3>
                             {/* [!!!] إضافة القيمة التقريبية [!!!] */}
                             <small className="text-muted">
                                ≈ ${((stats?.totalEarnings || user?.totalReferralEarnings || 0) / TND_USD_RATE).toFixed(2)}
                             </small>
                        </Card.Body>
                    </Card>
                </Col>

                {/* [!!!] بطاقة إجمالي المدعوين (الكل) [!!!] */}
                <Col md={3}>
                    <Card className="shadow-sm border-0 stat-card h-100">
                         <Card.Body className="d-flex flex-column justify-content-center text-center">
                             <div className="stat-label">{t('referrals.stats.totalInvited')}</div>
                             <h3 className="stat-value text-primary mb-0">{stats?.referralsList?.length || 0}</h3>
                        </Card.Body>
                    </Card>
                </Col>

                {/* [!!!] بطاقة الشركاء النشطين [!!!] */}
                <Col md={3}>
                    <Card className="shadow-sm border-0 stat-card h-100">
                         <Card.Body className="d-flex flex-column justify-content-center text-center">
                             <div className="stat-label text-success">{t('referrals.stats.activePartners')}</div>
                             <h3 className="stat-value text-success mb-0">
                                 {/* نحسب النشطين من القائمة مباشرة للدقة */}
                                 {stats?.referralsList?.filter(r => r.isReferralActive).length || 0}
                             </h3>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* الجدول */}
            <Card className="shadow-sm border-0 referrals-table-card">
                <Card.Body className="p-0">
                    <Table hover responsive className="mb-0 align-middle">
                        <thead>
                            <tr>
                                <th className="ps-4">#</th>
                                <th>{t('referrals.table.user')}</th>
                                <th>{t('referrals.table.date')}</th>
                                <th>{t('referrals.table.status')}</th>
                                <th className="text-end pe-4">{t('referrals.table.earnings')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.referralsList?.length > 0 ? (
                                stats.referralsList.map((refUser, idx) => (
                                    <tr key={refUser._id} className="table-row-hover">
                                        <td className="ps-4 text-muted fw-bold">{idx + 1}</td>
                                        <td className="fw-bold text-dark">{refUser.fullName}</td>
                                        <td className="text-muted">{new Date(refUser.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            {refUser.isReferralActive ? 
                                                <Badge bg="success" className="badge-status">{t('referrals.stats.active')}</Badge> : 
                                                <Badge bg="secondary" className="badge-status">{t('referrals.stats.inactive')}</Badge>
                                            }
                                        </td>
                                        <td className="text-end pe-4 fw-bold text-success">
                                            {refUser.earningsGeneratedForReferrer ? refUser.earningsGeneratedForReferrer.toFixed(2) : '0.00'} TND
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-5 text-muted">
                                        {t('referrals.noReferralsYet', 'No referrals yet. Share your code!')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            {/* مودال التحويل */}
            <Modal show={showTransferModal} onHide={() => setShowTransferModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{t('referrals.stats.transferModalTitle')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center mb-4">
                        <p className="text-muted mb-1">{t('referrals.available')}</p>
                        <h3 className="text-success fw-bold">{(stats?.referralBalance || 0).toFixed(2)} TND</h3>
                    </div>

                    <Form.Group className="mb-3">
                        <Form.Label>{t('referrals.transferAmountLabel', 'المبلغ المراد تحويله')}</Form.Label>
                        <InputGroup>
                            <Form.Control 
                                type="number" 
                                placeholder="0.00" 
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                className="py-2 fs-5"
                            />
                            <InputGroup.Text>TND</InputGroup.Text>
                        </InputGroup>
                        <Form.Text className="text-muted">
                            {t('referrals.minTransferInfo', { min: minAmount, fee: feePercentage })}
                        </Form.Text>
                    </Form.Group>

                    {/* عرض التفاصيل الحسابية إذا كان المبلغ > 0 */}
                    {amountNum > 0 && (
                        <div className="bg-light p-3 rounded border">
                            <div className="d-flex justify-content-between mb-2">
                                <span>{t('referrals.transferAmount', 'مبلغ التحويل')}:</span>
                                <strong>{amountNum.toFixed(2)} TND</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2 text-danger">
                                <span>{t('referrals.transferFee', 'رسوم التحويل')} ({feePercentage}%):</span>
                                <span>- {feeValue.toFixed(2)} TND</span>
                            </div>
                            <hr className="my-2" />
                            <div className="d-flex justify-content-between text-success">
                                <span>{t('referrals.netReceive', 'ستحصل على')}:</span>
                                <strong className="fs-5">+ {netValue.toFixed(2)} TND</strong>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowTransferModal(false)}>{t('common.cancel')}</Button>
                    <Button 
                        variant="success" 
                        onClick={handleTransfer} 
                        disabled={transferLoading || !transferAmount || amountNum < minAmount || amountNum > (stats?.referralBalance || 0)}
                    >
                        {transferLoading ? <Spinner size="sm" /> : t('common.confirmTransfer')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ReferralsPage;