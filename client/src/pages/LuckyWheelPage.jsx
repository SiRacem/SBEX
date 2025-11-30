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

    // استخدام Fallback لتجنب الأخطاء
    const { user } = useSelector(state => state.userReducer || {});
    // تأكد أنك أنشأت questReducer كما ذكرت سابقاً، أو استخدم مصفوفة فارغة احتياطاً
    const questState = useSelector(state => state.questReducer || {});
    const wheelConfig = questState.wheelConfig || [];

    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [spinHistory, setSpinHistory] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const pendingResult = useRef(null);
    const SPIN_COST = 100;

    // 1. جلب البيانات عند التحميل
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                // جلب إعدادات العجلة إذا لم تكن موجودة
                if (!wheelConfig || wheelConfig.length === 0) {
                    await dispatch(getWheelConfig());
                }

                // جلب السجل
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
        // eslint-disable-next-line
    }, [dispatch]);

    // 2. تجهيز قطاعات العجلة
    const wheelSegments = useMemo(() => {
        if (!wheelConfig || !Array.isArray(wheelConfig) || wheelConfig.length === 0) {
            // بيانات وهمية للتحميل لتجنب اختفاء العجلة
            return [
                { option: '...', style: { backgroundColor: '#ddd' } },
                { option: '...', style: { backgroundColor: '#bbb' } }
            ];
        }

        return wheelConfig.map(seg => {
            const typeKey = `luckyWheel.prizes.${seg.type}`;
            const translatedType = t(typeKey, { defaultValue: seg.type });
            const text = seg.text || `${seg.amount} ${translatedType}`;

            let smartFontSize = 14;
            if (text.length > 15) smartFontSize = 10;
            else if (text.length > 8) smartFontSize = 12;

            return {
                option: text,
                style: { backgroundColor: seg.color, textColor: 'white', fontSize: smartFontSize },
                original: seg
            };
        });
    }, [wheelConfig, t]);

    // 3. زر التدوير
    const handleSpinClick = async () => {
        if ((user?.credits || 0) < SPIN_COST) {
            toast.error(t('luckyWheel.noCredits', 'Insufficient Credits'));
            return;
        }

        setSpinning(true); // قفل الزر

        try {
            const token = localStorage.getItem("token");
            const { data } = await axios.post("/quests/spin", {}, { headers: { Authorization: `Bearer ${token}` } });

            pendingResult.current = data;

            // تحديد الفائز
            const winningIndex = wheelSegments.findIndex(seg =>
                seg.original?.type === data.reward.type &&
                Number(seg.original?.amount) === Number(data.reward.amount)
            );

            // بدء الدوران نحو الفائز
            setPrizeNumber(winningIndex !== -1 ? winningIndex : 0);
            setMustSpin(true);

        } catch (error) {
            setSpinning(false);
            setMustSpin(false);
            const msg = error.response?.data?.msg || "Error spinning";
            toast.error(t(`apiErrors.${msg}`, msg));
        }
    };

    // 4. عند توقف العجلة (هنا نظهر النتيجة)
    const handleStopSpinning = () => {
        setMustSpin(false);
        setSpinning(false);

        if (pendingResult.current) {
            const data = pendingResult.current;
            const prizeSeg = wheelSegments[prizeNumber];

            // إظهار التوست
            if (data.reward.type === 'empty') {
                toast.info(t('luckyWheel.loseMessage', 'Hard Luck!'));
            } else {
                toast.success(t('luckyWheel.winMessage', { prize: prizeSeg.option }));
            }

            // تحديث السجل محلياً (ليظهر فوراً دون انتظار السيرفر)
            const newRecord = {
                _id: Date.now(),
                createdAt: new Date(),
                cost: SPIN_COST,
                reward: data.reward
            };
            setSpinHistory([newRecord, ...spinHistory]);

            // الآن نطلب تحديث البروفايل للتأكد من الرصيد
            dispatch(getProfile());
            pendingResult.current = null;
        }
    };

    const getPrizeIcon = (type) => {
        switch (type) {
            case 'credits': return <FaCoins className="text-warning" />;
            case 'xp': return <FaStar className="text-info" />;
            case 'balance': return <FaMoneyBillWave className="text-success" />;
            case 'empty': return <FaFrown className="text-secondary" />;
            default: return <FaCoins />;
        }
    };

    if (isLoadingData) {
        return (
            <Container className="py-5 text-center d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="light" />
            </Container>
        );
    }

    return (
        <Container className="py-5 lucky-wheel-page">
            <div className="text-center mb-5">
                <h2 className="mb-3 text-white fw-bold display-5 wheel-title">
                    <span className="glow">🎡</span> {t('luckyWheel.title', 'Lucky Wheel')} <span className="glow">🎡</span>
                </h2>
                <div className="user-balance-badge mx-auto">
                    <span className="label">{t('luckyWheel.balanceLabel')}</span>

                    {(user?.credits === undefined || (user?.credits === 0 && isLoadingData)) ? (
                        <Spinner animation="grow" variant="warning" size="sm" className="mx-2" />
                    ) : (
                        <span className="value">{user?.credits}</span>
                    )}

                    <FaCoins className="icon" />
                </div>
            </div>

            <div className="wheel-container-wrapper mb-5">
                <div className="wheel-border">
                    {/* العجلة موجودة دائماً */}
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
                    variant="warning"
                    size="lg"
                    className="spin-action-btn"
                    onClick={handleSpinClick}
                    disabled={spinning || (user?.credits || 0) < SPIN_COST}
                >
                    {spinning ? <Spinner size="sm" animation="border" /> : t('luckyWheel.spinBtn', 'SPIN NOW')}
                </Button>
                <div className="text-white mt-2 opacity-75 small">
                    {t('luckyWheel.subtitle', { cost: SPIN_COST })}
                </div>
            </div>

            {/* قسم السجل */}
            <div className="history-section mt-5">
                <h4 className="text-white mb-4 d-flex align-items-center justify-content-center">
                    <FaHistory className="me-2" /> {t('luckyWheel.history.title', 'History')}
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
                            {t('luckyWheel.history.empty', 'No spins yet')}
                        </div>
                    )}
                </div>
            </div>
        </Container>
    );
};

export default LuckyWheelPage;