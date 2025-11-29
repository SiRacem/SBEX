import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FaCheck, FaCoins, FaClock } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { performCheckIn, getCheckInConfig } from '../../redux/actions/questAction'; // تأكد من استيراد getCheckInConfig
import { useTranslation } from 'react-i18next';
import './DailyCheckIn.css';

const DailyCheckInModal = ({ show, handleClose }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    
    // [!!!] نقرأ الإعدادات من Redux بدلاً من State محلي
    const { checkIn, loading, rewardsConfig } = useSelector(state => state.questReducer);
    
    // نستخدم rewardsConfig من الريدكس، أو مصفوفة فارغة مؤقتاً
    const rewardsList = rewardsConfig || [];

    const currentStreak = checkIn?.streak || 0;
    const isClaimedToday = checkIn?.claimedToday;
    const lastCheckInDate = checkIn?.lastCheckInDate;

    // جلب الإعدادات عند الفتح (للتأكد فقط، رغم أن السوكت سيحدثها)
    useEffect(() => {
        if (show) {
            dispatch(getCheckInConfig());
        }
    }, [show, dispatch]);

    const calculateTimeLeft = () => {
        if (!lastCheckInDate) return 0;
        const lastCheckIn = new Date(lastCheckInDate);
        const nextAvailableTime = new Date(lastCheckIn);
        nextAvailableTime.setHours(nextAvailableTime.getHours() + 24);

        const now = new Date();
        const diff = Math.floor((nextAvailableTime - now) / 1000);
        return diff > 0 ? diff : 0;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        if (isClaimedToday) {
            const timer = setInterval(() => {
                setTimeLeft(calculateTimeLeft());
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isClaimedToday, lastCheckInDate]);

    const handleCheckIn = () => {
        dispatch(performCheckIn());
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const cycleLength = rewardsList.length || 7;
    let activeDayIndex = isClaimedToday ? (currentStreak - 1) % cycleLength : currentStreak % cycleLength;
    if (activeDayIndex < 0) activeDayIndex = 0;

    return (
        <Modal show={show} onHide={handleClose} centered className="daily-checkin-modal">
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="w-100 text-center fw-bold">
                    <span role="img" aria-label="sparkles">✨</span> {t('quests.checkIn.title')} <span role="img" aria-label="sparkles">✨</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-center pt-0">
                <p className="text-muted mb-4">
                    {t('quests.checkIn.subtitle')}
                    <br />
                    <small className="fw-bold text-warning">
                        {t('quests.checkIn.streak', { count: currentStreak })}
                    </small>
                </p>

                <div className="days-grid-container mb-4">
                    {rewardsList.map((amount, index) => {
                        const dayNum = index + 1;
                        let status = 'locked';
                        
                        if (isClaimedToday) {
                            if (index <= activeDayIndex) status = 'done';
                        } else {
                            if (index < activeDayIndex) status = 'done';
                            else if (index === activeDayIndex) status = 'active';
                        }

                        const isLastDay = index === rewardsList.length - 1;
                        const cardClass = isLastDay ? 'day-card day-last' : 'day-card';

                        return (
                            <div key={index} className={`${cardClass} status-${status}`}>
                                <div className="bonus-tag">+{amount}</div>
                                <div className="icon-container">
                                    {status === 'done' ? (
                                        <FaCheck className="text-white" />
                                    ) : (
                                        <FaCoins className={status === 'active' ? 'text-white' : 'text-secondary'} />
                                    )}
                                </div>
                                <div className="day-label">{t('quests.checkIn.day')} {dayNum}</div>
                            </div>
                        );
                    })}
                </div>

                <Button 
                    variant={isClaimedToday ? "secondary" : "primary"} 
                    size="lg" 
                    className="w-75 rounded-pill shadow-sm checkin-btn"
                    onClick={handleCheckIn}
                    disabled={isClaimedToday || loading}
                >
                    {loading ? (
                        t('common.processing')
                    ) : isClaimedToday ? (
                        <div className="d-flex align-items-center justify-content-center gap-2">
                            <FaClock /> <span>{formatTime(timeLeft)}</span>
                        </div>
                    ) : (
                        t('quests.checkIn.button')
                    )}
                </Button>
                
                {isClaimedToday && (
                    <p className="mt-2 text-muted small">{t('quests.checkIn.comeBackTomorrow')}</p>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default DailyCheckInModal;