import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Spinner, Form, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaPaperPlane, FaUpload, FaExclamationTriangle, FaCheckCircle, FaClock, FaTrophy } from 'react-icons/fa';
import axios from 'axios';
import { getTournamentMatches, submitMatchResult, confirmMatchResult } from '../redux/actions/tournamentAction';
import { SocketContext } from '../App';
import './MatchRoomPage.css';

const MatchRoomPage = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const socket = useContext(SocketContext);
    const messagesEndRef = useRef(null);

    const { matches, loadingMatchAction } = useSelector(state => state.tournamentReducer);
    const { user } = useSelector(state => state.userReducer);

    const [match, setMatch] = useState(null);
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [proofFile, setProofFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    
    // Chat State
    const [messages, setMessages] = useState([]);
    const [msgText, setMsgText] = useState("");

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Get Match Data
    useEffect(() => {
        if (!matches || matches.length === 0) {
            // توجيه في حالة التحديث
            const timer = setTimeout(() => {
                toast.info(t('matchRoom.errors.refreshRedirect', "Please select the tournament to view the match."));
                navigate('/dashboard/tournaments');
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            const foundMatch = matches.find(m => m._id === id);
            if (foundMatch) {
                setMatch(foundMatch);
                if (foundMatch.chatMessages) setMessages(foundMatch.chatMessages);
            } else {
                navigate('/dashboard/tournaments');
            }
        }
    }, [matches, id, navigate, t]);

    // 2. Socket Logic
    useEffect(() => {
        if (socket && id) {
            socket.emit('join_match_room', id);
            
            socket.on('new_match_message', (msg) => {
                setMessages((prev) => [...prev, msg]);
            });

            socket.on('match_updated', (updatedMatch) => {
                console.log("Match Updated via Socket:", updatedMatch);
                setMatch(updatedMatch);
            });

            return () => {
                socket.off('new_match_message');
                socket.off('match_updated');
            };
        }
    }, [socket, id]);

    const sendMessage = () => {
        if (!msgText.trim()) return;
        const msgData = {
            matchId: id,
            senderId: user._id,
            senderName: user.fullName,
            text: msgText,
            timestamp: new Date()
        };
        socket.emit('send_match_message', msgData);
        setMsgText("");
    };

    const handleFileChange = (e) => {
        setProofFile(e.target.files[0]);
    };

    const handleSubmitResult = async (e) => {
        e.preventDefault();
        if (!proofFile) return toast.error(t('matchRoom.errors.uploadProof'));

        setUploading(true);
        const formData = new FormData();
        formData.append('proofImage', proofFile); // اسم الحقل المصحح
        
        try {
            const token = localStorage.getItem('token');
            const uploadRes = await axios.post(`${process.env.REACT_APP_API_URL}/uploads/proof`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': token 
                }
            });
            const proofUrl = uploadRes.data.filePath; // تأكد من المسار (filePath أو url حسب رد السيرفر)

            const resultData = {
                scoreMy: myScore,
                scoreOpponent: opponentScore,
                proofScreenshot: proofUrl
            };

            const result = await dispatch(submitMatchResult(id, resultData));
            if (result.success) {
                toast.success(t('matchRoom.toasts.resultSubmitted'));
            } else {
                toast.error(result.message);
            }

        } catch (error) {
            console.error(error);
            toast.error(t('matchRoom.errors.uploadFailed'));
        } finally {
            setUploading(false);
        }
    };

    const handleConfirm = async () => {
        const result = await dispatch(confirmMatchResult(id));
        if (result.success) {
            toast.success(t('matchRoom.toasts.matchCompleted'));
        } else {
            toast.error(result.message);
        }
    };

    const getAvatarUrl = (url) => {
        if (!url) return "https://bootdey.com/img/Content/avatar/avatar7.png";
        if (url.startsWith('http')) return url;
        return `${process.env.REACT_APP_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // --- Render ---
    if (!match) {
        return <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
            <Spinner animation="border" variant="primary" />
            <span className="ms-3">{t('matchRoom.loading')}</span>
        </div>;
    }

    const isPlayer1 = match.player1?._id === user?._id;
    const isPlayer2 = match.player2?._id === user?._id;
    
    if (!isPlayer1 && !isPlayer2 && user?.userRole !== 'Admin') {
        return <div className="text-center py-5 text-danger">{t('matchRoom.accessDenied')}</div>;
    }

    const opponentData = isPlayer1 ? match.player2 : match.player1;
    const myTeam = isPlayer1 ? match.player1Team : match.player2Team;
    const opponentTeam = isPlayer1 ? match.player2Team : match.player1Team;
    
    // الشعارات (إذا كانت متوفرة، أو نستخدم placeholder)
    // يمكن تحسين الموديل لاحقاً لتخزين الشعارات في المباراة نفسها
    // حالياً سنعرض الاسم
    
    const iSubmitted = match.submittedBy === user?._id;
    const opponentSubmitted = match.status === 'review' && !iSubmitted;

    return (
        <div className="match-room-container">
            {/* Header (The Stage) */}
            <div className="match-header">
                <div className="status-badge-container">
                    <span className={`match-status-badge ${match.status === 'ongoing' ? 'ongoing' : ''}`}>
                        {t(`matchRoom.status.${match.status}`, match.status)}
                    </span>
                </div>
                
                <Container>
                    <div className="vs-display">
                        {/* Me */}
                        <div className={`player-card-lg ${match.winner === user?._id ? 'winner' : ''}`}>
                            <div className="avatar-team-wrapper">
                                <img src={getAvatarUrl(user?.avatarUrl)} alt="Me" className="player-avatar-lg" />
                            </div>
                            <h4 className="player-name-lg">{user?.fullName}</h4>
                            <span className="player-label me">{t('matchRoom.you')}</span>
                            <div className="player-team-lg mt-2">{myTeam}</div>
                            {match.winner === user?._id && <div className="winner-badge mt-2 text-success fw-bold"><FaTrophy/> {t('matchRoom.status.winner')}</div>}
                        </div>

                        <div className="vs-badge">{t('matchRoom.vs')}</div>

                        {/* Opponent */}
                        <div className={`player-card-lg ${match.winner === opponentData?._id ? 'winner' : ''}`}>
                            <div className="avatar-team-wrapper">
                                <img 
                                    src={getAvatarUrl(opponentData?.avatarUrl)} 
                                    alt="Opponent" 
                                    className="player-avatar-lg"
                                />
                            </div>
                            <h4 className="player-name-lg">{opponentData?.fullName || t('matchRoom.tbd')}</h4>
                            <span className="player-label opp">{t('matchRoom.opponent')}</span>
                            <div className="player-team-lg mt-2">{opponentTeam || t('matchRoom.waiting')}</div>
                            {match.winner === opponentData?._id && <div className="winner-badge mt-2 text-success fw-bold"><FaTrophy/> {t('matchRoom.status.winner')}</div>}
                        </div>
                    </div>
                </Container>
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
                
                {/* Left: Actions (Score & Upload) */}
                <div className="actions-panel">
                    <h4 className="action-title">{t('matchRoom.actions.reportResult')}</h4>
                    
                    {match.status === 'completed' ? (
                        <div className="text-center py-4">
                            <FaCheckCircle size={60} className="text-success mb-3" />
                            <h4>{t('matchRoom.status.completed')}</h4>
                            <div className="final-score-display mt-3">
                                <span className="score-num fs-2 fw-bold">{match.scorePlayer1}</span>
                                <span className="score-sep mx-3 fs-2">-</span>
                                <span className="score-num fs-2 fw-bold">{match.scorePlayer2}</span>
                            </div>
                            <p className="text-muted mt-2">{t('matchRoom.status.winner')}: <span className="text-white fw-bold">{match.winner === user?._id ? t('matchRoom.you') : opponentData?.fullName}</span></p>
                        </div>
                    ) : opponentSubmitted ? (
                        <div className="text-center">
                            <div className="alert alert-warning mb-3">
                                {t('matchRoom.actions.opponentSubmittedMsg')}
                            </div>
                            
                            {/* [!] عرض النتيجة التي اقترحها الخصم */}
                            <div className="proposed-score mb-3 p-2 bg-dark rounded border border-secondary">
                                <h6>Result:</h6>
                                <div className="d-flex justify-content-center align-items-center gap-2">
                                    <span>{opponentData?.fullName}: <strong>{isPlayer1 ? match.scorePlayer2 : match.scorePlayer1}</strong></span>
                                    <span>-</span>
                                    <span>{t('matchRoom.you')}: <strong>{isPlayer1 ? match.scorePlayer1 : match.scorePlayer2}</strong></span>
                                </div>
                            </div>

                            {/* [!] عرض صورة الإثبات بشكل صحيح */}
                            <div className="proof-preview mb-3">
                                <p className="text-muted small">Proof Screenshot:</p>
                                <a href={getAvatarUrl(match.proofScreenshot)} target="_blank" rel="noopener noreferrer">
                                    <img 
                                        src={getAvatarUrl(match.proofScreenshot)} 
                                        alt="Proof" 
                                        className="img-fluid rounded border border-light" 
                                        style={{maxHeight: '200px', cursor: 'pointer'}} 
                                    />
                                </a>
                            </div>

                            <Button 
                                variant="success" 
                                className="w-100 mb-2 py-2 fw-bold"
                                onClick={handleConfirm}
                                disabled={loadingMatchAction}
                            >
                                {loadingMatchAction ? <Spinner size="sm"/> : t('matchRoom.actions.confirmResult')}
                            </Button>
                            <Button variant="outline-danger" className="w-100">
                                {t('matchRoom.actions.dispute')}
                            </Button>
                        </div>
                    ) : (
                        <Form onSubmit={handleSubmitResult}>
                            <div className="score-inputs-container">
                                <div className="score-box">
                                    <span className="team-name-score text-primary">{myTeam || t('matchRoom.you')}</span>
                                    <input 
                                        type="number" 
                                        className="score-input" 
                                        value={myScore}
                                        onChange={(e) => setMyScore(e.target.value)}
                                        min="0"
                                    />
                                </div>
                                <span className="vs-sep">:</span>
                                <div className="score-box">
                                    <span className="team-name-score text-danger">{opponentTeam || t('matchRoom.opponent')}</span>
                                    <input 
                                        type="number" 
                                        className="score-input" 
                                        value={opponentScore}
                                        onChange={(e) => setOpponentScore(e.target.value)}
                                        min="0"
                                    />
                                </div>
                            </div>

                            <label className="file-upload-label">
                                <input type="file" hidden onChange={handleFileChange} accept="image/*" />
                                {proofFile ? (
                                    <div className="text-success fw-bold">{proofFile.name}</div>
                                ) : (
                                    <>
                                        <FaUpload className="upload-icon" />
                                        <div className="text-muted small mt-2">{t('matchRoom.actions.uploadProof')}</div>
                                    </>
                                )}
                            </label>

                            <Button 
                                type="submit" 
                                className="btn-submit-result"
                                disabled={uploading || loadingMatchAction || iSubmitted}
                            >
                                {uploading ? t('common.processing') : iSubmitted ? t('matchRoom.actions.waitingOpponent') : t('matchRoom.actions.submitBtn')}
                            </Button>
                        </Form>
                    )}
                </div>

                {/* Right: Chat */}
                <div className="chat-panel">
                    <div className="chat-header">
                        <FaClock className="me-2 text-warning" /> 
                        {t('matchRoom.chat.title')}
                    </div>
                    <div className="chat-messages custom-scrollbar">
                        <div className="message-bubble received text-center opacity-75">
                            <small>{t('matchRoom.chat.welcome')}</small>
                        </div>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message-bubble ${msg.senderId === user._id ? 'sent' : 'received'}`}>
                                <span className="chat-sender">{msg.senderName}</span>
                                {msg.text}
                                <div className="text-end" style={{fontSize: '0.6rem', opacity: 0.5, marginTop: '2px'}}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="chat-input-area">
                        <Form.Control 
                            placeholder={t('matchRoom.chat.placeholder')} 
                            className="custom-chat-input"
                            value={msgText}
                            onChange={(e) => setMsgText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <Button variant="primary" className="btn-send" onClick={sendMessage}>
                            <FaPaperPlane />
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MatchRoomPage;