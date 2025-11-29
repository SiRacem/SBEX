import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Button, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Wheel } from 'react-custom-roulette';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getProfile } from '../redux/actions/userAction';
import { getWheelConfig } from '../redux/actions/questAction';
import { FaCoins, FaStar, FaMoneyBillWave, FaFrown, FaHistory } from 'react-icons/fa';
import './LuckyWheelPage.css';

const LuckyWheelPage = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    
    const { user } = useSelector(state => state.userReducer);
    const { wheelConfig } = useSelector(state => state.questReducer);
    
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [spinHistory, setSpinHistory] = useState([]);
    
    const pendingResult = useRef(null);
    const SPIN_COST = 100;

    // [!!!] تحسين useMemo لمنع التغيير العشوائي [!!!]
    const wheelSegments = useMemo(() => {
        if (!wheelConfig || !Array.isArray(wheelConfig) || wheelConfig.length === 0) return [];
        
        return wheelConfig.map(seg => {
            const typeKey = `luckyWheel.prizes.${seg.type}`;
            const translatedType = t(typeKey, { defaultValue: seg.type });
            const text = seg.text || `${seg.amount} ${translatedType}`;
            
            let smartFontSize = 16;
            if (text.length > 15) smartFontSize = 10;
            else if (text.length > 8) smartFontSize = 12;

            return {
                option: text,
                style: { backgroundColor: seg.color, textColor: 'white', fontSize: smartFontSize },
                original: seg
            };
        });
    }, [wheelConfig, t]);

    // [!!!] شرط التحميل: فقط إذا لم يكن هناك أي بيانات [!!!]
    const isLoading = !wheelSegments.length;

    useEffect(() => {
        if (!wheelConfig || wheelConfig.length === 0) {
            dispatch(getWheelConfig());
        }
        fetchHistory();
    }, [dispatch]); // أزلنا wheelConfig من التبعيات

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem("token");
            const { data } = await axios.get("/quests/spin-history", { headers: { Authorization: `Bearer ${token}` } });
            setSpinHistory(data);
        } catch (error) { console.error("History error"); }
    };

    const handleSpinClick = async () => {
        if ((user?.credits || 0) < SPIN_COST) {
            toast.error(t('luckyWheel.noCredits'));
            return;
        }

        setSpinning(true); // قفل الزر

        try {
            const token = localStorage.getItem("token");
            const { data } = await axios.post("/quests/spin", {}, { headers: { Authorization: `Bearer ${token}` } });

            pendingResult.current = data;

            const winningIndex = wheelSegments.findIndex(seg => 
                seg.original.type === data.reward.type && 
                Number(seg.original.amount) === Number(data.reward.amount)
            );

            // [!!!] حماية إضافية: إذا لم نجد الفائز، نختار الأول لتجنب الكراش [!!!]
            setPrizeNumber(winningIndex !== -1 ? winningIndex : 0);
            
            setMustSpin(true); // ابدأ الدوران

            // لا نحدث Redux هنا، ننتظر التوقف

        } catch (error) {
            setSpinning(false);
            setMustSpin(false);
            const errorMsg = error.response?.data?.msg || "Spin failed";
            toast.error(t(errorMsg, { defaultValue: errorMsg }));
        }
    };

    const handleStopSpinning = () => {
        setMustSpin(false);
        setSpinning(false);
        
        if (pendingResult.current) {
            const data = pendingResult.current;
            const prizeText = wheelSegments[prizeNumber].option; // النص المترجم

            if (data.reward.type === 'empty') {
                toast.info(t('luckyWheel.loseMessage'));
            } else {
                toast.success(t('luckyWheel.winMessage', { prize: prizeText }));
            }

            // تحديث السجل محلياً
            const newRecord = {
                _id: Date.now(),
                createdAt: new Date(),
                cost: SPIN_COST,
                reward: data.reward
            };
            setSpinHistory([newRecord, ...spinHistory]);

            // تحديث البيانات من السيرفر
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
            default: return <FaCoins />;
        }
    };

    return (
        <Container className="py-5 lucky-wheel-page">
            <div className="text-center mb-5">
                <h2 className="mb-3 text-white fw-bold display-5 wheel-title">
                    <span className="glow">🎡</span> {t('luckyWheel.title')} <span className="glow">🎡</span>
                </h2>
                <div className="user-balance-badge mx-auto">
                    <span className="label">{t('luckyWheel.balanceLabel')}</span>
                    <span className="value">{user?.credits || 0}</span>
                    <FaCoins className="icon" />
                </div>
            </div>

            {/* [!!!] Spinner يظهر فقط في البداية، لا يظهر عند الدوران [!!!] */}
            {isLoading ? (
                <div className="text-center text-white py-5"><Spinner animation="border" variant="light" /></div>
            ) : (
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
                        />
                    </div>
                </div>
            )}

            <div className="text-center mb-5">
                <Button 
                    variant="warning" 
                    size="lg" 
                    className="spin-action-btn"
                    onClick={handleSpinClick}
                    // [!!!] تعطيل الزر أثناء الدوران [!!!]
                    disabled={spinning || isLoading || (user?.credits || 0) < SPIN_COST}
                >
                    {spinning ? <Spinner size="sm" animation="border" /> : t('luckyWheel.spinBtn')}
                </Button>
                <div className="text-white mt-2 opacity-75 small">
                    {t('luckyWheel.subtitle', { cost: SPIN_COST })}
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
                                            t('luckyWheel.empty', 'Hard Luck') : 
                                            `+${spin.reward.amount} ${t(`luckyWheel.prizes.${spin.reward.type}`, spin.reward.type)}`
                                        }
                                    </div>
                                    <div className="history-date">
                                        {new Date(spin.createdAt).toLocaleString(i18n.language)}
                                    </div>
                                </div>
                                <div className="history-cost">
                                    -{spin.cost} <FaCoins size={10} />
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