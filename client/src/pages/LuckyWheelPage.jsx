import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Button, Spinner, Badge } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Wheel } from 'react-custom-roulette';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getProfile } from '../redux/actions/userAction';
import { getWheelConfig } from '../redux/actions/questAction';
import { FaCoins, FaStar, FaMoneyBillWave, FaFrown, FaHistory, FaGift } from 'react-icons/fa';
import './LuckyWheelPage.css';

const LuckyWheelPage = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();

    const { user } = useSelector(state => state.userReducer || {});
    const questState = useSelector(state => state.questReducer || {});
    const wheelConfig = questState.wheelConfig || [];

    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [spinHistory, setSpinHistory] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const pendingResult = useRef(null);
    const SPIN_COST = 100;

    const hasFreeSpins = (user?.freeSpins || 0) > 0;

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                if (!wheelConfig || wheelConfig.length === 0) {
                    await dispatch(getWheelConfig());
                }
                const token = localStorage.getItem("token");
                if (token) {
                    const { data } = await axios.get("/quests/spin-history", { headers: { Authorization: `Bearer ${token}` } });
                    if (isMounted) setSpinHistory(data);
                }
            } catch (error) {
                console.error("Error loading wheel data", error);
            } finally {
                if (isMounted) setIsLoadingData(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [dispatch]);

    const wheelSegments = useMemo(() => {
        if (!wheelConfig || !Array.isArray(wheelConfig) || wheelConfig.length === 0) {
            return [ { option: '...', style: { backgroundColor: '#ddd' } }, { option: '...', style: { backgroundColor: '#bbb' } } ];
        }
        return wheelConfig.map(seg => {
            const typeKey = `luckyWheel.prizes.${seg.type}`;
            const translatedType = t(typeKey, { defaultValue: seg.type });
            
            // [!!!] أيقونات عالمية مدعومة في كل الأنظمة [!!!]
            let iconEmoji = '';
            switch(seg.type) {
                case 'credits': iconEmoji = '💰'; break; // كيس مال (يظهر للجميع)
                case 'xp': iconEmoji = '⭐'; break;      // نجمة
                case 'balance': iconEmoji = '💵'; break; // ورقة نقدية
                case 'free_spin': iconEmoji = '🎁'; break; // هدية
                case 'empty': iconEmoji = '💔'; break;   // قلب مكسور
                default: iconEmoji = '';
            }

            // استخدام النص المخصص أو النص الافتراضي مع الأيقونة
            const text = seg.text ? seg.text : `${seg.amount > 0 ? seg.amount : ''} ${translatedType} ${iconEmoji}`;
            
            // تكبير الخط قليلاً ليكون واضحاً
            let smartFontSize = 16;
            if (text.length > 15) smartFontSize = 11;
            else if (text.length > 10) smartFontSize = 13;
            
            return { option: text, style: { backgroundColor: seg.color, textColor: 'white', fontSize: smartFontSize }, original: seg };
        });
    }, [wheelConfig, t]);

    const handleSpinClick = async () => {
        if (!hasFreeSpins && (user?.credits || 0) < SPIN_COST) {
            toast.error(t('luckyWheel.noCredits'));
            return;
        }

        setSpinning(true);

        try {
            const token = localStorage.getItem("token");
            const { data } = await axios.post("/quests/spin", {}, { headers: { Authorization: `Bearer ${token}` } });

            pendingResult.current = data;

            const winningIndex = wheelSegments.findIndex(seg => 
                seg.original?.type === data.reward.type && 
                Number(seg.original?.amount) === Number(data.reward.amount)
            );
            setPrizeNumber(winningIndex !== -1 ? winningIndex : 0);
            setMustSpin(true);

        } catch (error) {
            setSpinning(false);
            setMustSpin(false);
            const msg = error.response?.data?.msg || "Error spinning";
            toast.error(t(`apiErrors.${msg}`, msg));
        }
    };

    const handleStopSpinning = () => {
        setMustSpin(false);
        setSpinning(false);
        if (pendingResult.current) {
            const data = pendingResult.current;
            const prizeSeg = wheelSegments[prizeNumber];
            if (data.reward.type === 'empty') {
                toast.info(t('luckyWheel.loseMessage'));
            } else {
                toast.success(t('luckyWheel.winMessage', { prize: prizeSeg.option }));
            }
            const newRecord = { _id: Date.now(), createdAt: new Date(), cost: data.usedFreeSpin ? 0 : SPIN_COST, reward: data.reward };
            setSpinHistory([newRecord, ...spinHistory]);
            dispatch(getProfile()); 
            pendingResult.current = null;
        }
    };

    const getPrizeIcon = (type) => {
        switch(type) {
            case 'credits': return <FaCoins className="text-warning" />;
            case 'xp': return <FaStar className="text-info" />;
            case 'balance': return <FaMoneyBillWave className="text-success" />;
            case 'empty': return <FaFrown className="text-secondary" />;
            case 'free_spin': return <FaGift className="text-white" />;
            default: return <FaCoins />;
        }
    };

    if (isLoadingData) {
        return ( <Container className="py-5 text-center d-flex align-items-center justify-content-center" style={{minHeight: '60vh'}}> <Spinner animation="border" variant="light" /> </Container> );
    }

    return (
        <Container className="py-5 lucky-wheel-page">
            <div className="text-center mb-5">
                <h2 className="mb-3 text-white fw-bold display-5 wheel-title">
                    <span className="glow">🎡</span> {t('luckyWheel.title')} <span className="glow">🎡</span>
                </h2>
                
                <div className="d-flex justify-content-center gap-3 flex-wrap">
                    {/* [!!!] عرض الرصيد بشكل مفصول وسليم [!!!] */}
                    <div className="user-balance-badge">
                        <span className="label me-2">{t('luckyWheel.balanceLabel')}</span>
                        {(user?.credits === undefined || (user?.credits === 0 && isLoadingData)) ? (
                            <Spinner animation="grow" variant="warning" size="sm" className="mx-2" />
                        ) : (
                            <span className="value">{user?.credits}</span>
                        )}
                        <FaCoins className="icon ms-2" />
                    </div>

                    <div className={`user-balance-badge ${hasFreeSpins ? 'bg-success border-success' : ''}`}>
                        <span className="label me-2">{t('luckyWheel.labels.freeSpins')}</span>
                        <span className="value">{user?.freeSpins || 0}</span>
                        <FaGift className="icon text-white ms-2" />
                    </div>
                </div>
            </div>

            <div className="wheel-container-wrapper mb-5">
                <div className="wheel-border">
                    <Wheel
                        mustStartSpinning={mustSpin}
                        prizeNumber={prizeNumber}
                        data={wheelSegments}
                        onStopSpinning={handleStopSpinning}
                        outerBorderColor="#2c3e50"
                        outerBorderWidth={8}
                        innerRadius={10}
                        innerBorderColor="#2c3e50"
                        innerBorderWidth={0}
                        radiusLineColor="rgba(255, 255, 255, 0.2)"
                        radiusLineWidth={1}
                        fontSize={14}
                        textDistance={60}
                        perpendicularText={false}
                        textColors={['#ffffff']}
                        backgroundColors={['#3f51b5', '#e91e63', '#4caf50', '#ffc107', '#009688', '#795548']}
                    />
                </div>
            </div>

            <div className="text-center mb-5">
                <Button 
                    variant={hasFreeSpins ? "success" : "warning"} 
                    size="lg" 
                    className={`spin-action-btn ${hasFreeSpins ? 'pulse-animation' : ''}`}
                    onClick={handleSpinClick}
                    disabled={spinning || (!hasFreeSpins && (user?.credits || 0) < SPIN_COST)}
                >
                    {spinning ? <Spinner size="sm" animation="border" /> : 
                     hasFreeSpins ? 
                        <span><FaGift className="me-2"/> {t('luckyWheel.spinFree')}</span> : 
                        t('luckyWheel.spinBtn')
                    }
                </Button>
                <div className="text-white mt-2 opacity-75 small">
                    {hasFreeSpins ? 
                        <span className="text-success fw-bold">{t('luckyWheel.hasFreeSpins', {count: user.freeSpins})}</span> : 
                        t('luckyWheel.subtitle', { cost: SPIN_COST })
                    }
                </div>
            </div>

            <div className="history-section mt-5">
                <h4 className="text-white mb-4 d-flex align-items-center justify-content-center">
                    <FaHistory className="me-2" /> {t('luckyWheel.history.title')}
                </h4>
                <div className="history-list">
                    {spinHistory.length > 0 ? (
                        spinHistory.slice(0, 10).map((spin) => (
                            <div key={spin._id} className="history-item glass-effect">
                                <div className="history-icon-wrapper">
                                    {getPrizeIcon(spin.reward?.type)}
                                </div>
                                <div className="history-content">
                                    <div className="history-prize-title">
                                        {spin.reward?.type === 'empty' ? 
                                            t('luckyWheel.prizes.empty', 'Hard Luck') : 
                                            `${spin.reward.amount > 0 ? '+' + spin.reward.amount : ''} ${t(`luckyWheel.prizes.${spin.reward.type}`, spin.reward.type)}`
                                        }
                                    </div>
                                    <div className="history-date">
                                        {new Date(spin.createdAt).toLocaleString(i18n.language)}
                                    </div>
                                </div>
                                <div className="history-cost">
                                    {spin.cost === 0 ? <Badge bg="success">Free</Badge> : <span className="text-danger">-{spin.cost} <FaCoins size={10} /></span>}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-white-50 py-4 glass-effect rounded">
                            {t('luckyWheel.history.empty')}
                        </div>
                    )}
                </div>
            </div>
        </Container>
    );
};

export default LuckyWheelPage;