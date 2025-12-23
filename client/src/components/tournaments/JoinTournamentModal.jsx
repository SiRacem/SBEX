import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Form } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { getTakenTeams, joinTournament } from '../../redux/actions/tournamentAction';
import { getActiveLeagues, getTeamsByLeague } from '../../redux/actions/leagueAction';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronLeft, FaCheckCircle, FaLock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './JoinTournamentModal.css';

const JoinTournamentModal = ({ show, onHide, tournament, onSuccess }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    // Redux State
    const { takenTeams } = useSelector(state => state.tournamentReducer);
    const { user } = useSelector(state => state.userReducer);

    // Local State
    const [step, setStep] = useState(1); // 1: Select League (if needed), 2: Select Team, 3: Confirm
    const [leagues, setLeagues] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedLeague, setSelectedLeague] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [joining, setJoining] = useState(false);

    // 1. عند الفتح: جلب الفرق المحجوزة وتحديد نقطة البداية
    useEffect(() => {
        if (show && tournament) {
            dispatch(getTakenTeams(tournament._id));
            setStep(1);
            setSelectedLeague(null);
            setSelectedTeam(null);

            // إذا كانت البطولة محددة بدوري معين مسبقاً
            if (tournament.rules.specificLeague) {
                // تخطي خطوة اختيار الدوري والذهاب مباشرة لجلب فرق هذا الدوري
                handleLeagueSelect({ _id: tournament.rules.specificLeague });
            } else {
                // وإلا، اجلب كل الدوريات المتاحة (Club or National)
                fetchLeagues();
            }
        }
    }, [show, tournament, dispatch]);

    const fetchLeagues = async () => {
        setLoadingData(true);
        // نفترض أن teamCategory هي 'Clubs' أو 'National Teams'
        const type = tournament.rules.teamCategory === 'Clubs' ? 'Club' : 'National';
        const data = await dispatch(getActiveLeagues(type));
        setLeagues(data || []);
        setLoadingData(false);
    };

    const handleLeagueSelect = async (league) => {
        setLoadingData(true);
        setSelectedLeague(league);

        // جلب فرق هذا الدوري
        const result = await dispatch(getTeamsByLeague(league._id));
        // نعتمد على أن الأكشن يرجع البيانات أو نقرأها من الستور عبر useEffect أدناه
    };

    // مراقبة تغير teams في الـ Store
    const storeTeams = useSelector(state => state.leagueReducer.teams);
    useEffect(() => {
        if (selectedLeague && storeTeams) {
            setTeams(storeTeams);
            setLoadingData(false);
            setStep(2);
        }
    }, [storeTeams, selectedLeague]);


    const handleTeamSelect = (team) => {
        // التحقق هل الفريق محجوز؟
        const isTaken = takenTeams.includes(team.name);

        if (!isTaken) {
            setSelectedTeam(team);
            setStep(3); // الذهاب للتأكيد
        }
    };

    const handleConfirm = async () => {
        setJoining(true);
        const result = await dispatch(joinTournament(tournament._id, {
            selectedTeam: selectedTeam.name,
            selectedTeamLogo: selectedTeam.logo
        }));

        setJoining(false);
        if (result.success) {
            toast.success(t('tournamentDetails.toasts.joinSuccess'));

            // [!] تم التصحيح هنا: استخدام onSuccess مباشرة بدلاً من props.onSuccess
            if (onSuccess) onSuccess();
            else if (onHide) onHide(); // Fallback لإغلاق النافذة
        } else {
            toast.error(t(result.message, result.message));
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="dark-modal join-modal">
            <Modal.Header closeButton>
                <Modal.Title>
                    {step === 1 && !tournament.rules.specificLeague ? t('joinModal.selectLeague') :
                        step === 2 ? t('joinModal.selectTeam') :
                            t('joinModal.confirmRegistration')}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="custom-modal-body">
                {loadingData ? (
                    <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                ) : (
                    <AnimatePresence mode='wait'>
                        {/* --- Step 1: Leagues Grid --- */}
                        {step === 1 && !tournament.rules.specificLeague && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="grid-container"
                            >
                                {leagues.map(league => (
                                    <div key={league._id} className="grid-item league-item" onClick={() => handleLeagueSelect(league)}>
                                        <img src={league.logo} alt={league.name} />
                                        <span>{league.name}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* --- Step 2: Teams Grid --- */}
                        {step === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            >
                                {selectedLeague && !tournament.rules.specificLeague && (
                                    <Button variant="link" className="back-link mb-3" onClick={() => setStep(1)}>
                                        <FaChevronLeft /> {t('joinModal.backToLeagues')}
                                    </Button>
                                )}
                                <div className="grid-container">
                                    {teams.map(team => {
                                        const isTaken = takenTeams.includes(team.name);
                                        return (
                                            <div
                                                key={team._id}
                                                className={`grid-item team-item ${isTaken ? 'taken' : ''}`}
                                                onClick={() => handleTeamSelect(team)}
                                            >
                                                <img src={team.logo} alt={team.name} />
                                                <span>{team.name}</span>
                                                {isTaken && <div className="taken-badge"><FaLock /> {t('common.taken', 'Taken')}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* --- Step 3: Confirm --- */}
                        {step === 3 && selectedTeam && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                className="confirm-step text-center"
                            >
                                <div className="selected-team-preview">
                                    <img src={selectedTeam.logo} alt={selectedTeam.name} className="preview-logo" />
                                    <h3>{selectedTeam.name}</h3>
                                </div>

                                <div className="payment-summary mt-4">
                                    <div className="d-flex justify-content-between summary-row">
                                        <span>{t('joinModal.entryFee')}:</span>
                                        <span className="text-warning">{tournament.entryFee} TND</span>
                                    </div>
                                    <div className="d-flex justify-content-between summary-row">
                                        <span>{t('joinModal.yourBalance')}:</span>
                                        <span className={user.balance >= tournament.entryFee ? "text-success" : "text-danger"}>
                                            {user.balance} TND
                                        </span>
                                    </div>
                                </div>

                                <div className="actions mt-4 d-flex gap-3 justify-content-center">
                                    <Button variant="secondary" onClick={() => setStep(2)}>{t('joinModal.changeTeam')}</Button>
                                    <Button
                                        variant="primary"
                                        onClick={handleConfirm}
                                        disabled={user.balance < tournament.entryFee || joining}
                                        className="btn-confirm"
                                    >
                                        {joining ? <Spinner size="sm" /> : t('joinModal.confirmPay')}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default JoinTournamentModal;