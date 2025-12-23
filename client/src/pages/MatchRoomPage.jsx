import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Spinner, Form, Button, Card, Badge, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaPaperPlane, FaUpload, FaTrophy, FaCheckCircle, FaClock, FaExclamationTriangle, FaGavel } from 'react-icons/fa';
import axios from 'axios';
import { submitMatchResult, confirmMatchResult } from '../redux/actions/tournamentAction';
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
    const [loading, setLoading] = useState(true);

    // Score States
    const [myScore, setMyScore] = useState('');
    const [opponentScore, setOpponentScore] = useState('');

    // Penalty States
    const [myPenalties, setMyPenalties] = useState('');
    const [opponentPenalties, setOpponentPenalties] = useState('');

    const [proofFile, setProofFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [resolving, setResolving] = useState(false);

    // Chat State
    const [messages, setMessages] = useState([]);
    const [msgText, setMsgText] = useState("");

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 1. Fetch Match Data
    useEffect(() => {
        const fetchMatchData = async () => {
            if (matches && matches.length > 0) {
                const foundMatch = matches.find(m => m._id === id);
                if (foundMatch) {
                    setMatch(foundMatch);
                    if (foundMatch.chatMessages) setMessages(foundMatch.chatMessages);
                    setLoading(false);
                    return;
                }
            }

            try {
                const res = await axios.get(`${process.env.REACT_APP_API_URL}/matches/${id}`);
                setMatch(res.data);
                if (res.data.chatMessages) setMessages(res.data.chatMessages);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching match:", error);
                toast.error(t('matchRoom.errors.refreshRedirect', "Match not found"));
                setLoading(false);
            }
        };

        fetchMatchData();
    }, [matches, id, t]);

    // 2. Socket Logic
    useEffect(() => {
        if (socket && id) {
            socket.emit('join_match_room', id);

            socket.on('new_match_message', (msg) => {
                setMessages((prev) => [...prev, msg]);
            });

            socket.on('match_updated', (updatedMatch) => {
                if (updatedMatch._id === id) {
                    setMatch(updatedMatch);
                }
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

        if (myScore === '' || opponentScore === '') return toast.error(t('matchRoom.fillAllFields'));
        if (!proofFile) return toast.error(t('matchRoom.errors.uploadProof'));

        const isDraw = parseInt(myScore) === parseInt(opponentScore);
        if (isDraw) {
            if (myPenalties === '' || opponentPenalties === '') {
                return toast.error(t('matchRoom.enterPenaltiesInfo', "Please enter penalties score."));
            }
            if (parseInt(myPenalties) === parseInt(opponentPenalties)) {
                return toast.error(t('matchRoom.noDrawInPenalties', "Penalties cannot end in a draw."));
            }
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('proofImage', proofFile);

        try {
            const token = localStorage.getItem('token');
            const uploadRes = await axios.post(`${process.env.REACT_APP_API_URL}/uploads/proof`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': token
                }
            });
            const proofUrl = uploadRes.data.filePath;

            const resultData = {
                scoreMy: parseInt(myScore),
                scoreOpponent: parseInt(opponentScore),
                penaltiesMy: isDraw ? parseInt(myPenalties) : undefined,
                penaltiesOpponent: isDraw ? parseInt(opponentPenalties) : undefined,
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

    const handleConfirm = async (action) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/matches/${id}/confirm`, { action }, {
                headers: { 'Authorization': token }
            });

            if (res.data.success) {
                if (action === 'confirm') toast.success(t('matchRoom.toasts.matchCompleted'));
                else toast.info(t('matchRoom.toasts.disputeOpened', "Dispute Opened"));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Error");
        }
    };

    // Admin Action
    const handleAdminResolve = async (winnerId) => {
        if (!window.confirm(t('matchRoom.admin.confirmResolve', "Are you sure? This action is final."))) return;

        setResolving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${process.env.REACT_APP_API_URL}/matches/${id}/resolve`,
                { winnerId },
                { headers: { 'Authorization': token } }
            );
            toast.success("Dispute resolved successfully!");
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Error resolving dispute.");
        } finally {
            setResolving(false);
        }
    };

    const getAvatarUrl = (url) => {
        if (!url) return "https://bootdey.com/img/Content/avatar/avatar7.png";
        if (url.startsWith('http')) return url;
        return `${process.env.REACT_APP_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    if (loading) {
        return <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
            <Spinner animation="border" variant="primary" />
            <span className="ms-3">{t('matchRoom.loading')}</span>
        </div>;
    }

    if (!match) return <div className="text-center py-5 text-white">{t('matchRoom.errors.refreshRedirect')}</div>;

    const isPlayer1 = match.player1?._id === user?._id;
    const isPlayer2 = match.player2?._id === user?._id;
    const isAdmin = user?.userRole === 'Admin';

    if (!isPlayer1 && !isPlayer2 && !isAdmin) {
        return <div className="text-center py-5 text-danger">{t('matchRoom.accessDenied')}</div>;
    }

    const opponentData = isPlayer1 ? match.player2 : match.player1;
    const myTeam = isPlayer1 ? match.player1Team : match.player2Team;
    const opponentTeam = isPlayer1 ? match.player2Team : match.player1Team;

    const iSubmitted = match.submittedBy === user?._id;
    const opponentSubmitted = match.status === 'review' && !iSubmitted;

    const isDispute = match.status === 'dispute';
    const isDrawInput = myScore !== '' && opponentScore !== '' && parseInt(myScore) === parseInt(opponentScore);

    const renderScoreDisplay = (mainScore, penaltyScore) => {
        return (
            <div>
                <div className="score-display display-4">{mainScore}</div>
                {(penaltyScore !== undefined && penaltyScore !== null) && (
                    <div className="text-warning small fw-bold">Pen: {penaltyScore}</div>
                )}
            </div>
        );
    };

    const mySavedScore = isPlayer1 ? match.scorePlayer1 : match.scorePlayer2;
    const oppSavedScore = isPlayer1 ? match.scorePlayer2 : match.scorePlayer1;
    const mySavedPen = isPlayer1 ? match.penaltiesPlayer1 : match.penaltiesPlayer2;
    const oppSavedPen = isPlayer1 ? match.penaltiesPlayer2 : match.penaltiesPlayer1;

    return (
        <div className="match-room-container">
            <div className={`match-header ${isDispute ? 'dispute-header' : ''}`}>
                <Container>
                    <div className="vs-display">
                        <div className={`player-card-lg ${match.winner === (isPlayer1 ? user?._id : match.player1?._id) ? 'winner' : ''}`}>
                            <div className="avatar-team-wrapper">
                                <img src={getAvatarUrl(isPlayer1 ? user?.avatarUrl : match.player1?.avatarUrl)} alt="P1" className="player-avatar-lg" />
                            </div>
                            <h4 className="player-name-lg">{isPlayer1 ? user?.fullName : match.player1?.fullName}</h4>
                            <span className="player-label me">{isPlayer1 ? t('matchRoom.you') : t('matchRoom.opponent')}</span>
                            <div className="player-team-lg mt-2">{isPlayer1 ? myTeam : match.player1Team}</div>
                            {renderScoreDisplay(
                                isPlayer1 ? mySavedScore : match.scorePlayer1,
                                isPlayer1 ? mySavedPen : match.penaltiesPlayer1
                            )}
                            {match.winner === (isPlayer1 ? user?._id : match.player1?._id) && <div className="winner-badge mt-2 text-success fw-bold"><FaTrophy /> {t('matchRoom.status.winner')}</div>}
                        </div>

                        <div className="vs-badge">{t('matchRoom.vs')}</div>

                        <div className={`player-card-lg ${match.winner === (isPlayer1 ? opponentData?._id : match.player2?._id) ? 'winner' : ''}`}>
                            <div className="avatar-team-wrapper">
                                <img src={getAvatarUrl(isPlayer1 ? opponentData?.avatarUrl : match.player2?.avatarUrl)} alt="P2" className="player-avatar-lg" />
                            </div>
                            <h4 className="player-name-lg">{isPlayer1 ? opponentData?.fullName : match.player2?.fullName || t('matchRoom.tbd')}</h4>
                            <span className="player-label opp">{isPlayer1 ? t('matchRoom.opponent') : t('matchRoom.you')}</span>
                            <div className="player-team-lg mt-2">{isPlayer1 ? opponentTeam : match.player2Team || t('matchRoom.waiting')}</div>
                            {renderScoreDisplay(
                                isPlayer1 ? oppSavedScore : match.scorePlayer2,
                                isPlayer1 ? oppSavedPen : match.penaltiesPlayer2
                            )}
                            {match.winner === (isPlayer1 ? opponentData?._id : match.player2?._id) && <div className="winner-badge mt-2 text-success fw-bold"><FaTrophy /> {t('matchRoom.status.winner')}</div>}
                        </div>
                    </div>
                </Container>
            </div>

            <div className="content-grid">
                <div className="actions-panel">
                    <h4 className="action-title">{t('matchRoom.actions.reportResult')}</h4>

                    {isDispute && isAdmin && (
                        <Card className="mb-4 border-warning bg-dark shadow-sm">
                            <Card.Header className="bg-warning text-dark fw-bold d-flex align-items-center">
                                <FaGavel className="me-2" /> {t('matchRoom.admin.resolutionTitle')}
                            </Card.Header>
                            <Card.Body>
                                <p className="text-white small mb-3">
                                    {t('matchRoom.admin.resolutionDesc')}
                                </p>

                                {match.proofScreenshot && (
                                    <div className="mb-3 text-center">
                                        <a href={getAvatarUrl(match.proofScreenshot)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-light">
                                            {t('matchRoom.admin.viewProof')}
                                        </a>
                                    </div>
                                )}

                                <div className="d-flex gap-2 justify-content-center">
                                    <Button
                                        variant="outline-success"
                                        onClick={() => handleAdminResolve(match.player1._id)}
                                        disabled={resolving}
                                    >
                                        {t('matchRoom.admin.winBtn', { team: match.player1Team })}
                                    </Button>
                                    <Button
                                        variant="outline-success"
                                        onClick={() => handleAdminResolve(match.player2._id)}
                                        disabled={resolving}
                                    >
                                        {t('matchRoom.admin.winBtn', { team: match.player2Team })}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    )}

                    {isDispute ? (
                        <div className="text-center py-4">
                            <Alert variant="danger" className="d-inline-block w-100">
                                <FaExclamationTriangle size={40} className="mb-3 d-block mx-auto" />
                                <h5 className="alert-heading">{t('matchRoom.disputeActive')}</h5>
                                <p className="mb-0 small">{t('matchRoom.disputeInfo')}</p>
                            </Alert>
                        </div>
                    ) : match.status === 'completed' ? (
                        <div className="text-center py-4">
                            <FaCheckCircle size={60} className="text-success mb-3" />
                            <h4>{t('matchRoom.status.completed')}</h4>
                            <p className="text-muted mt-2">{t('matchRoom.status.winner')}: <span className="text-white fw-bold">{match.winner === user?._id ? t('matchRoom.you') : (isPlayer1 ? opponentData?.fullName : match.winner?.fullName || "TBD")}</span></p>
                        </div>
                    ) : (opponentSubmitted && !isAdmin) ? (
                        <div className="text-center">
                            <div className="alert alert-warning mb-3">
                                {t('matchRoom.actions.opponentSubmittedMsg')}
                            </div>

                            <div className="proposed-score mb-3 p-2 bg-dark rounded border border-secondary">
                                <h6>Result:</h6>
                                <div className="d-flex justify-content-center align-items-center gap-2">
                                    <span>{opponentData?.fullName}: <strong>{isPlayer1 ? match.scorePlayer2 : match.scorePlayer1}</strong></span>
                                    {(isPlayer1 ? match.penaltiesPlayer2 : match.penaltiesPlayer1) !== undefined &&
                                        <span className="text-warning">({isPlayer1 ? match.penaltiesPlayer2 : match.penaltiesPlayer1})</span>
                                    }
                                    <span>-</span>
                                    <span>{t('matchRoom.you')}: <strong>{isPlayer1 ? match.scorePlayer1 : match.scorePlayer2}</strong></span>
                                    {(isPlayer1 ? match.penaltiesPlayer1 : match.penaltiesPlayer2) !== undefined &&
                                        <span className="text-warning">({isPlayer1 ? match.penaltiesPlayer1 : match.penaltiesPlayer2})</span>
                                    }
                                </div>
                            </div>

                            <div className="proof-preview mb-3">
                                <p className="text-muted small">Proof Screenshot:</p>
                                <a href={getAvatarUrl(match.proofScreenshot)} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={getAvatarUrl(match.proofScreenshot)}
                                        alt="Proof"
                                        className="img-fluid rounded border border-light"
                                        style={{ maxHeight: '200px', cursor: 'pointer' }}
                                    />
                                </a>
                            </div>

                            <Button
                                variant="success"
                                className="w-100 mb-2 py-2 fw-bold"
                                onClick={() => handleConfirm('confirm')}
                                disabled={loadingMatchAction}
                            >
                                {loadingMatchAction ? <Spinner size="sm" /> : t('matchRoom.actions.confirmResult')}
                            </Button>
                            <Button
                                variant="outline-danger"
                                className="w-100"
                                onClick={() => handleConfirm('reject')}
                            >
                                {t('matchRoom.actions.dispute')}
                            </Button>
                        </div>
                    ) : (isPlayer1 || isPlayer2) ? (
                        <Form onSubmit={handleSubmitResult}>
                            <div className="score-inputs-container">
                                <div className="score-box">
                                    <img
                                        src={isPlayer1 ? match.player1TeamLogo : match.player2TeamLogo}
                                        alt=""
                                        className="score-team-logo"
                                    />
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
                                    <img
                                        src={isPlayer1 ? match.player2TeamLogo : match.player1TeamLogo}
                                        alt=""
                                        className="score-team-logo"
                                    />
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

                            {isDrawInput && (
                                <div className="penalties-section mt-3 p-2 border border-warning rounded">
                                    <div className="text-center text-warning mb-2 small fw-bold">
                                        {t('matchRoom.drawDetected', "Draw Detected! Enter Penalties:")}
                                    </div>
                                    <div className="d-flex justify-content-center gap-3 align-items-center">
                                        <div className="text-center">
                                            <label className="small text-muted mb-1">My Pen</label>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm text-center"
                                                style={{ width: '60px' }}
                                                value={myPenalties}
                                                onChange={(e) => setMyPenalties(e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                        <span>-</span>
                                        <div className="text-center">
                                            <label className="small text-muted mb-1">Opp Pen</label>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm text-center"
                                                style={{ width: '60px' }}
                                                value={opponentPenalties}
                                                onChange={(e) => setOpponentPenalties(e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <label className="file-upload-label mt-3">
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
                    ) : (
                        <div className="text-center py-4 text-muted">
                            {isAdmin ? "Admin View" : "Spectator View"}
                        </div>
                    )}
                </div>

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
                                <div className="text-end" style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '2px' }}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {(isPlayer1 || isPlayer2 || isAdmin) && (
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
                    )}
                </div>

            </div>
        </div>
    );
};

export default MatchRoomPage;