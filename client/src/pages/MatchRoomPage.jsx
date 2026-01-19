import React, { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Spinner, Form, Button, Card, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaPaperPlane, FaUpload, FaTrophy, FaCheckCircle, FaClock, FaExclamationTriangle, FaGavel, FaArrowLeft, FaImage, FaGamepad } from 'react-icons/fa';
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

    // Admin Dispute Resolution States
    const [adminScore1, setAdminScore1] = useState('');
    const [adminScore2, setAdminScore2] = useState('');
    const [adminPen1, setAdminPen1] = useState('');
    const [adminPen2, setAdminPen2] = useState('');

    // Chat State
    const [messages, setMessages] = useState([]);
    const [msgText, setMsgText] = useState("");
    const [chatImage, setChatImage] = useState(null);
    const [isSocketReady, setIsSocketReady] = useState(false);
    const [opponentOnline, setOpponentOnline] = useState(false); // تتبع وجود الخصم
    const [roomUsers, setRoomUsers] = useState([]); // قائمة المتصلين في الغرفة
    const [waitStartTime, setWaitStartTime] = useState(null); // وقت بدء الانتظار
    const [timeoutReached, setTimeoutReached] = useState(false); // هل انتهى المؤقت؟
    const [remainingTime, setRemainingTime] = useState(180); // 3 دقائق = 180 ثانية
    const chatImageRef = useRef(null);

    // ⏱️ Ready Button & Server Timeout States
    const [isReady, setIsReady] = useState(false);
    const [opponentReady, setOpponentReady] = useState(false);
    const [serverTimeRemaining, setServerTimeRemaining] = useState(null); // الوقت المتبقي من الخادم
    const [roundDeadline, setRoundDeadline] = useState(null);
    const [readyLoading, setReadyLoading] = useState(false);

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

    // 2. Socket Logic - انتظار الاتصال قبل الانضمام للغرفة
    useEffect(() => {
        if (!socket || !id) {
            console.log('[Socket] Socket or id missing:', { socket: !!socket, id });
            return;
        }

        const joinRoom = () => {
            console.log('[Socket] Joining match room:', id, 'Socket connected:', socket.connected);
            socket.emit('join_match_room', { matchId: id, userId: user?._id });
        };

        // إذا كان متصلاً بالفعل، انضم للغرفة فوراً
        if (socket.connected) {
            joinRoom();
            setIsSocketReady(true);
        } else {
            // انتظر حدث الاتصال
            console.log('[Socket] Waiting for connection...');
            socket.on('connect', () => {
                joinRoom();
                setIsSocketReady(true);
            });
        }

        // تتبع الانقطاع
        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
            setIsSocketReady(false);
            setOpponentOnline(false);
        });

        // تتبع المستخدمين في الغرفة
        socket.on('room_users', (users) => {
            console.log('[Socket] Room users updated:', users);
            setRoomUsers(users);
        });

        socket.on('new_match_message', (msg) => {
            console.log('[Socket] Received new_match_message:', msg);
            setMessages((prev) => [...prev, msg]);
        });

        socket.on('match_updated', (updatedMatch) => {
            if (updatedMatch._id === id) {
                setMatch(updatedMatch);
            }
        });

        // ⏱️ Ready Button Events
        // ⏱️ Ready Button Events
        socket.on('player_ready_confirmed', (data) => {
            if (data.matchId === id) {
                console.log('[Socket] Ready confirmed:', data);

                // التحقق من هوية المستخدم لتحديث الحالة الصحيحة
                if (data.userId === user?._id) {
                    setIsReady(true);
                    setReadyLoading(false);
                } else {
                    setOpponentReady(true);
                }

                if (data.bothReady) {
                    setOpponentReady(true);
                    // إذا كان المستخدم الحالي هو من ضغط، فسيتم تحديثه أعلاه
                    // إذا كان الخصم، فسيتم تحديث setOpponentReady أعلاه
                }
            }
        });

        socket.on('player_ready_error', (data) => {
            if (data.matchId === id) {
                console.log('[Socket] Ready error:', data.message);
                setReadyLoading(false);

                // تحسين رسالة الخطأ إذا كانت تقنية
                let errorMessage = data.message;
                if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ETIMEDOUT')) {
                    errorMessage = t('errors.connectionError', 'خطأ في الاتصال، حاول مرة أخرى');
                }

                toast.error(errorMessage);
            }
        });

        socket.on('opponent_ready', (data) => {
            if (data.matchId === id) {
                console.log('[Socket] Opponent is ready');
                setOpponentReady(true);
            }
        });

        socket.on('match_timeout_status', (data) => {
            if (data.matchId === id && data.success) {
                console.log('[Socket] Timeout status:', data);
                setServerTimeRemaining(data.timeRemaining);
                setRoundDeadline(data.roundDeadline);

                // تحديث حالة الجهوزية من الخادم
                const isPlayer1Check = match?.player1?._id?.toString() === user?._id?.toString();
                if (isPlayer1Check) {
                    setIsReady(data.player1Ready?.isReady || false);
                    setOpponentReady(data.player2Ready?.isReady || false);
                } else {
                    setIsReady(data.player2Ready?.isReady || false);
                    setOpponentReady(data.player1Ready?.isReady || false);
                }
            }
        });

        return () => {
            console.log('[Socket] Cleaning up match room:', id);
            socket.emit('leave_match_room', { matchId: id, userId: user?._id });
            socket.off('connect');
            socket.off('disconnect');
            socket.off('new_match_message');
            socket.off('match_updated');
            socket.off('room_users');
            socket.off('player_ready_confirmed');
            socket.off('player_ready_error');
            socket.off('opponent_ready');
            socket.off('match_timeout_status');
        };
    }, [socket, id, user?._id, match?.player1?._id]);

    // تحديد ما إذا كان الخصم متصلاً
    useEffect(() => {
        if (!match || !user) return;

        // تحديد هل المستخدم الحالي هو player1 داخل useEffect لتجنب ReferenceError
        const isPlayer1Check = match.player1?._id?.toString() === user?._id?.toString();
        const opponentId = isPlayer1Check ? match.player2?._id : match.player1?._id;
        const isOpponentInRoom = roomUsers.includes(opponentId);
        setOpponentOnline(isOpponentInRoom);

        console.log('[Presence] Opponent online check:', {
            opponentId,
            roomUsers,
            isOpponentInRoom
        });
    }, [roomUsers, match, user]);

    // مؤقت 3 دقائق للانتظار
    useEffect(() => {
        // إذا انتهى المؤقت مسبقاً، ابقِه كذلك
        if (timeoutReached) return;

        // إذا الخصم متصل، لا نحتاج للمؤقت (لكن لا نعيد تعيينه!)
        if (opponentOnline) {
            // لا نعيد تعيين waitStartTime حتى يكمل العد عند خروج الخصم
            return;
        }

        // إذا الخصم غير متصل وكان المستخدم لاعب في المباراة
        if (!opponentOnline && match && (match.player1?._id === user?._id || match.player2?._id === user?._id)) {
            // ابدأ العد التنازلي إذا لم يبدأ من قبل
            if (!waitStartTime) {
                setWaitStartTime(Date.now());
            }

            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - (waitStartTime || Date.now())) / 1000);
                const remaining = Math.max(0, 180 - elapsed);
                setRemainingTime(remaining);

                if (remaining === 0) {
                    setTimeoutReached(true);
                    clearInterval(interval);
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [opponentOnline, match, user, waitStartTime, timeoutReached]);

    // ⏱️ طلب حالة الـ timeout من الخادم عند الاتصال
    useEffect(() => {
        if (!socket || !isSocketReady || !id) return;

        // طلب حالة الـ timeout
        socket.emit('get_match_timeout_status', { matchId: id });

        // تحديث كل 30 ثانية
        const interval = setInterval(() => {
            socket.emit('get_match_timeout_status', { matchId: id });
        }, 30000);

        return () => clearInterval(interval);
    }, [socket, isSocketReady, id]);

    // ⏱️ عداد تنازلي للوقت من الخادم
    useEffect(() => {
        if (!roundDeadline) return;

        const interval = setInterval(() => {
            const remaining = Math.max(0, new Date(roundDeadline).getTime() - Date.now());
            setServerTimeRemaining(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [roundDeadline]);

    // 🎮 دالة الضغط على زر "جاهز للعب"
    const handleReadyClick = () => {
        if (!socket || !isSocketReady || !user) {
            toast.error(t('matchRoom.socketNotReady', 'جاري الاتصال...'));
            return;
        }

        setReadyLoading(true);
        socket.emit('player_ready', { matchId: id, userId: user._id });
    };

    // تنسيق الوقت المتبقي
    const formatServerTime = (ms) => {
        if (!ms || ms <= 0) return '00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const sendMessage = async () => {
        console.log('[Chat] sendMessage called:', { msgText, chatImage, socket: !!socket, socketConnected: socket?.connected });

        if (!msgText.trim() && !chatImage) return;

        // تحقق من وجود socket والاتصال
        if (!socket || !isSocketReady) {
            console.error('[Chat] Socket not connected! isSocketReady:', isSocketReady);
            toast.error('Socket غير متصل، يرجى تحديث الصفحة');
            return;
        }

        let imageUrl = null;

        // رفع الصورة إذا وجدت
        if (chatImage) {
            try {
                const formData = new FormData();
                formData.append('image', chatImage);
                const token = localStorage.getItem('token');
                const uploadRes = await axios.post(
                    `${process.env.REACT_APP_API_URL}/uploads/chat-image`,
                    formData,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );
                imageUrl = uploadRes.data.imageUrl;
                console.log('[Chat] Image uploaded:', imageUrl);
            } catch (error) {
                console.error('Error uploading chat image:', error);
                toast.error(t('matchRoom.chat.uploadError', 'خطأ في رفع الصورة'));
                return;
            }
        }

        const msgData = {
            matchId: id,
            senderId: user._id,
            senderName: user.fullName,
            text: msgText || '',
            imageUrl: imageUrl,
            timestamp: new Date()
        };

        console.log('[Chat] Emitting send_match_message:', msgData);
        socket.emit('send_match_message', msgData);
        setMsgText("");
        setChatImage(null);
    };

    const handleChatImageChange = (e) => {
        if (e.target.files[0]) {
            setChatImage(e.target.files[0]);
        }
    };

    const handleFileChange = (e) => {
        setProofFile(e.target.files[0]);
    };

    const handleSubmitResult = async (e) => {
        e.preventDefault();

        if (myScore === '' || opponentScore === '') return toast.error(t('matchRoom.fillAllFields'));
        if (!proofFile) return toast.error(t('matchRoom.errors.uploadProof'));

        const isDraw = parseInt(myScore) === parseInt(opponentScore);
        // Only require penalties for knockout stage (not group or league)
        const requiresPenalties = isDraw && match.stage === 'knockout';
        if (requiresPenalties) {
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
                penaltiesMy: requiresPenalties ? parseInt(myPenalties) : undefined,
                penaltiesOpponent: requiresPenalties ? parseInt(opponentPenalties) : undefined,
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
                else toast.info("📋 تم فتح النزاع بنجاح");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Error");
        }
    };

    // Admin Action - resolve dispute with optional scores
    const handleAdminResolve = async (winnerId, isDraw = false) => {
        // Validate scores
        const score1 = parseInt(adminScore1) || 0;
        const score2 = parseInt(adminScore2) || 0;
        const pen1 = parseInt(adminPen1);
        const pen2 = parseInt(adminPen2);

        if (isDraw && score1 !== score2) {
            toast.error(t('matchRoom.admin.drawScoresMustMatch', "For a draw, scores must be equal."));
            return;
        }

        // في knockout مع تعادل، يجب إدخال ضربات الجزاء
        const isKnockout = match.stage !== 'league';
        const isTiedScore = score1 === score2;

        if (isKnockout && isTiedScore && !isDraw) {
            if (isNaN(pen1) || isNaN(pen2)) {
                toast.error(t('matchRoom.enterPenaltiesInfo', "الرجاء ملء نتيجة ضربات الجزاء."));
                return;
            }
            if (pen1 === pen2) {
                toast.error(t('matchRoom.noDrawInPenalties', "ضربات الجزاء ليس لها تعادل!"));
                return;
            }
            // تحديد الفائز بناءً على ضربات الجزاء
            winnerId = pen1 > pen2 ? match.player1._id : match.player2._id;
        }

        if (!isDraw && !winnerId) {
            toast.error(t('matchRoom.admin.selectWinner', "Please select a winner."));
            return;
        }

        if (!window.confirm(t('matchRoom.admin.confirmResolve', "Are you sure? This action is final."))) return;

        setResolving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${process.env.REACT_APP_API_URL}/matches/${id}/resolve`,
                {
                    winnerId: isDraw ? null : winnerId,
                    scorePlayer1: score1,
                    scorePlayer2: score2,
                    penaltiesPlayer1: (isKnockout && isTiedScore && !isDraw) ? pen1 : undefined,
                    penaltiesPlayer2: (isKnockout && isTiedScore && !isDraw) ? pen2 : undefined,
                    isDraw
                },
                { headers: { 'Authorization': token } }
            );
            toast.success(t('matchRoom.admin.resolveSuccess', "Dispute resolved successfully!"));
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || t('matchRoom.admin.resolveError', "Error resolving dispute."));
        } finally {
            setResolving(false);
        }
    };

    const getAvatarUrl = (url) => {
        if (!url) return "https://bootdey.com/img/Content/avatar/avatar7.png";
        if (url.startsWith('http')) return url;
        if (url.startsWith('data:')) return url; // base64 data URLs
        return `${process.env.REACT_APP_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    if (loading) {
        return <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
            <Spinner animation="border" variant="primary" />
            <span className="ms-3">{t('matchRoom.loading')}</span>
        </div>;
    }

    if (!match) return <div className="text-center py-5 text-white">{t('matchRoom.errors.refreshRedirect')}</div>;

    const isPlayer1 = match.player1?._id?.toString() === user?._id?.toString();
    const isPlayer2 = match.player2?._id?.toString() === user?._id?.toString();
    const isAdmin = user?.userRole === 'Admin';

    if (!isPlayer1 && !isPlayer2 && !isAdmin) {
        return <div className="text-center py-5 text-danger">{t('matchRoom.accessDenied')}</div>;
    }

    const opponentData = isPlayer1 ? match.player2 : match.player1;
    const myTeam = isPlayer1 ? match.player1Team : match.player2Team;
    const opponentTeam = isPlayer1 ? match.player2Team : match.player1Team;

    // Handle both populated object and raw ObjectId/String
    const submittedById = match.submittedBy?._id?.toString() || match.submittedBy?.toString();
    const currentUserId = user?._id?.toString();
    const iSubmitted = submittedById && currentUserId && submittedById === currentUserId;
    const opponentSubmitted = match.status === 'review' && match.submittedBy && !iSubmitted;

    // Debug logging
    console.log('MatchRoom Debug:', {
        status: match.status,
        submittedBy: match.submittedBy,
        submittedById,
        currentUserId,
        iSubmitted,
        opponentSubmitted,
        proofScreenshot: match.proofScreenshot
    });

    const isDispute = match.status === 'dispute';
    const isDrawInput = myScore !== '' && opponentScore !== '' && parseInt(myScore) === parseInt(opponentScore) && match.stage === 'knockout';

    const renderScoreDisplay = (mainScore, penaltyScore) => {
        return (
            <div>
                <div className="score-display display-4">{mainScore}</div>
                {(penaltyScore !== undefined && penaltyScore !== null) && (
                    <div className="text-warning small fw-bold">{t('matchRoom.penalties', 'ض.ج')}: {penaltyScore}</div>
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
            {/* Back Button */}
            <div className="match-room-back-nav p-2">
                <Button
                    variant="outline-light"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="d-flex align-items-center gap-2"
                >
                    <FaArrowLeft /> {t('common.back', 'رجوع')}
                </Button>
            </div>
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

                    {/* ⏱️ Ready Button & Match Timer Section */}
                    {match.status === 'scheduled' && (isPlayer1 || isPlayer2) && !isAdmin && (
                        <Card className="mb-4 border-secondary bg-dark shadow-sm">
                            <Card.Body className="text-center">
                                {/* عداد الدور */}
                                {roundDeadline && serverTimeRemaining !== null && (
                                    <div className="mb-3">
                                        <div className="text-light mb-1 opacity-75">
                                            {t('matchRoom.roundTimeRemaining', 'الوقت المتبقي للدور')}
                                        </div>
                                        <div className="fs-2 fw-bold" style={{
                                            color: serverTimeRemaining < 5 * 60 * 1000 ? '#ef4444' : '#ffffff' // White instead of green for better contrast on dark
                                        }}>
                                            ⏱️ {formatServerTime(serverTimeRemaining)}
                                        </div>
                                    </div>
                                )}

                                {/* حالة الجهوزية */}
                                <div className="d-flex justify-content-center gap-3 mb-3">
                                    <div className={`p-2 rounded border ${isReady ? 'border-success bg-success bg-opacity-10' : 'border-secondary bg-secondary bg-opacity-10'}`} style={{ minWidth: '110px' }}>
                                        <small className="d-block text-light mb-1 opacity-75">{t('matchRoom.you', 'أنت')}</small>
                                        <Badge bg={isReady ? 'success' : 'secondary'} className="px-2 py-1">
                                            {isReady ? '✅ جاهز' : '⏳ غير جاهز'}
                                        </Badge>
                                    </div>
                                    <div className={`p-2 rounded border ${opponentReady ? 'border-success bg-success bg-opacity-10' : 'border-secondary bg-secondary bg-opacity-10'}`} style={{ minWidth: '110px' }}>
                                        <small className="d-block text-light mb-1 opacity-75">{t('matchRoom.opponent', 'الخصم')}</small>
                                        <Badge bg={opponentReady ? 'success' : 'secondary'} className="px-2 py-1">
                                            {opponentReady ? '✅ جاهز' : '⏳ غير جاهز'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* زر جاهز للعب */}
                                {!isReady ? (
                                    <Button
                                        variant="success"
                                        size="lg"
                                        className="w-100 py-2 fw-bold shadow-sm"
                                        onClick={handleReadyClick}
                                        disabled={readyLoading}
                                    >
                                        {readyLoading ? (
                                            <Spinner size="sm" className="me-2" />
                                        ) : (
                                            <FaGamepad className="me-2" />
                                        )}
                                        {t('matchRoom.readyToPlay', 'جاهز للعب!')}
                                    </Button>
                                ) : (
                                    <div className="alert alert-success mb-0 py-2 fw-bold border-success">
                                        ✅ {t('matchRoom.youAreReady', 'أنت جاهز! في انتظار الخصم...')}
                                    </div>
                                )}

                                {/* تحذير */}
                                <div className="text-warning mt-3 small d-flex align-items-center justify-content-center gap-1">
                                    <FaExclamationTriangle />
                                    {t('matchRoom.readyWarning', 'إحذر! إذا انتهى الوقت ولم تكن جاهزاً، ستخسر المباراة تلقائياً')}
                                </div>
                            </Card.Body>
                        </Card>
                    )}

                    <h4 className="action-title">{t('matchRoom.actions.reportResult')}</h4>

                    {isDispute && isAdmin && (
                        <Card className="mb-4 border-warning bg-dark shadow-sm">
                            <Card.Header className="bg-warning text-dark fw-bold d-flex align-items-center">
                                <FaGavel className="me-2" /> {t('matchRoom.admin.resolutionTitle')}
                            </Card.Header>
                            <Card.Body>
                                <p className="text-white small mb-3 text-center">
                                    {t('matchRoom.admin.resolutionDesc')}
                                </p>

                                {match.proofScreenshot && (
                                    <div className="mb-3 text-center">
                                        <a href={getAvatarUrl(match.proofScreenshot)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-light">
                                            📷 {t('matchRoom.admin.viewProof')}
                                        </a>
                                    </div>
                                )}

                                {/* Admin Score Inputs - تصميم محسّن */}
                                <div className="admin-scores-container mb-4 p-3 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                    <label className="text-warning small d-block mb-3 text-center fw-bold">
                                        📝 {t('matchRoom.admin.setFinalScore', 'أدخل النتيجة النهائية')}
                                    </label>

                                    <div className="d-flex justify-content-center align-items-center gap-3">
                                        {/* فريق 1 */}
                                        <div className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.1)', minWidth: '120px' }}>
                                            {match.player1TeamLogo && (
                                                <img
                                                    src={getAvatarUrl(match.player1TeamLogo)}
                                                    alt={match.player1Team}
                                                    style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                                                    className="mb-2"
                                                />
                                            )}
                                            <div className="text-white small fw-bold mb-2">{match.player1Team}</div>
                                            <input
                                                type="number"
                                                className="form-control form-control-lg text-center mx-auto"
                                                style={{ width: '70px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                                value={adminScore1}
                                                onChange={(e) => setAdminScore1(e.target.value)}
                                                min="0"
                                                placeholder="0"
                                            />
                                        </div>

                                        <span className="text-white fs-3 fw-bold">-</span>

                                        {/* فريق 2 */}
                                        <div className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.1)', minWidth: '120px' }}>
                                            {match.player2TeamLogo && (
                                                <img
                                                    src={getAvatarUrl(match.player2TeamLogo)}
                                                    alt={match.player2Team}
                                                    style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                                                    className="mb-2"
                                                />
                                            )}
                                            <div className="text-white small fw-bold mb-2">{match.player2Team}</div>
                                            <input
                                                type="number"
                                                className="form-control form-control-lg text-center mx-auto"
                                                style={{ width: '70px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                                value={adminScore2}
                                                onChange={(e) => setAdminScore2(e.target.value)}
                                                min="0"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ضربات الجزاء - تظهر فقط في knockout عند التعادل */}
                                {match.stage !== 'league' && adminScore1 !== '' && adminScore2 !== '' &&
                                    parseInt(adminScore1) === parseInt(adminScore2) && (
                                        <div className="mt-4 p-3 rounded border border-warning" style={{ background: 'rgba(255, 193, 7, 0.1)' }}>
                                            <h6 className="text-warning text-center mb-3">
                                                ⚽ {t('matchRoom.admin.penaltiesRequired', 'ضربات الجزاء (النتيجة متعادلة)')}
                                            </h6>
                                            <div className="d-flex justify-content-center align-items-center gap-4">
                                                <div className="text-center">
                                                    <div className="text-white small mb-1">{match.player1Team}</div>
                                                    <input
                                                        type="number"
                                                        className="form-control text-center mx-auto"
                                                        style={{ width: '60px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                                        value={adminPen1}
                                                        onChange={(e) => setAdminPen1(e.target.value)}
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <span className="text-warning fs-4 fw-bold">-</span>
                                                <div className="text-center">
                                                    <div className="text-white small mb-1">{match.player2Team}</div>
                                                    <input
                                                        type="number"
                                                        className="form-control text-center mx-auto"
                                                        style={{ width: '60px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                                        value={adminPen2}
                                                        onChange={(e) => setAdminPen2(e.target.value)}
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            {adminPen1 !== '' && adminPen2 !== '' && parseInt(adminPen1) === parseInt(adminPen2) && (
                                                <div className="text-danger text-center mt-2 small">
                                                    ⚠️ {t('matchRoom.noDrawInPenalties', 'ضربات الجزاء ليس لها تعادل!')}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                {/* أزرار اختيار الفائز */}
                                <div className="text-center mb-2 mt-3">
                                    <small className="text-muted">👆 {t('matchRoom.admin.selectWinnerHint', 'اختر الفريق الفائز')}</small>
                                </div>

                                <div className="d-flex gap-3 justify-content-center flex-wrap">
                                    {/* زر فوز الفريق 1 */}
                                    <Button
                                        variant="success"
                                        size="lg"
                                        className="d-flex align-items-center gap-2 px-4"
                                        onClick={() => handleAdminResolve(match.player1._id)}
                                        disabled={resolving}
                                        style={{ minWidth: '150px' }}
                                    >
                                        {match.player1TeamLogo && (
                                            <img
                                                src={getAvatarUrl(match.player1TeamLogo)}
                                                alt=""
                                                style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                            />
                                        )}
                                        🏆 {match.player1Team}
                                    </Button>

                                    {/* زر التعادل - للدوري فقط */}
                                    {match.stage === 'league' && (
                                        <Button
                                            variant="warning"
                                            size="lg"
                                            className="px-4"
                                            onClick={() => handleAdminResolve(null, true)}
                                            disabled={resolving}
                                        >
                                            🤝 {t('matchRoom.admin.drawBtn', 'تعادل')}
                                        </Button>
                                    )}

                                    {/* زر فوز الفريق 2 */}
                                    <Button
                                        variant="success"
                                        size="lg"
                                        className="d-flex align-items-center gap-2 px-4"
                                        onClick={() => handleAdminResolve(match.player2._id)}
                                        disabled={resolving}
                                        style={{ minWidth: '150px' }}
                                    >
                                        {match.player2TeamLogo && (
                                            <img
                                                src={getAvatarUrl(match.player2TeamLogo)}
                                                alt=""
                                                style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                            />
                                        )}
                                        🏆 {match.player2Team}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    )}

                    {isDispute ? (
                        <div className="text-center py-4">
                            <div className="d-inline-block w-100 p-4 rounded-3"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 41, 59, 0.95) 100%)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)'
                                }}>
                                <FaExclamationTriangle size={40} className="mb-3 d-block mx-auto text-warning" />
                                <h5 className="text-warning mb-2">{t('matchRoom.disputeActive')}</h5>
                                <p className="mb-0 small text-light opacity-75">{t('matchRoom.disputeInfo')}</p>
                            </div>
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

                            {match.proofScreenshot && (
                                <div className="proof-preview mb-3">
                                    <p className="text-muted small">{t('matchRoom.proofScreenshot', 'Proof Screenshot:')}</p>
                                    <a href={getAvatarUrl(match.proofScreenshot)} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={getAvatarUrl(match.proofScreenshot)}
                                            alt="Proof"
                                            className="img-fluid rounded border border-light"
                                            style={{ maxHeight: '200px', cursor: 'pointer' }}
                                        />
                                    </a>
                                </div>
                            )}

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
                    ) : (!match.player1 || !match.player2) ? (
                        // لا يمكن إدخال النتيجة إذا كان أحد اللاعبين غير محدد
                        <div className="text-center py-4">
                            <div className="p-4 rounded-3" style={{
                                background: 'rgba(255, 193, 7, 0.1)',
                                border: '1px solid rgba(255, 193, 7, 0.3)'
                            }}>
                                <FaClock size={40} className="mb-3 text-warning" />
                                <h5 className="text-warning">{t('matchRoom.waitingForOpponent', 'في انتظار الخصم')}</h5>
                                <p className="mb-0 small text-light opacity-75">
                                    {t('matchRoom.cannotSubmitYet', 'لا يمكن إدخال النتيجة حتى يتم تحديد الخصم')}
                                </p>
                            </div>
                        </div>
                    ) : !opponentOnline && !timeoutReached && (isPlayer1 || isPlayer2) ? (
                        // لا يمكن إدخال النتيجة إذا كان الخصم غير متصل (مع مؤقت)
                        <div className="text-center py-4">
                            <div className="p-4 rounded-3" style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                                <FaClock size={40} className="mb-3 text-primary" />
                                <h5 className="text-primary">{t('matchRoom.waitingForOpponentOnline', 'في انتظار اتصال الخصم')}</h5>
                                <p className="mb-0 small text-light opacity-75">
                                    {t('matchRoom.opponentMustBeOnline', 'يجب أن يكون الخصم متصلاً في غرفة المباراة قبل إدخال النتيجة')}
                                </p>
                                <div className="mt-3">
                                    <span className="badge bg-danger pulse-badge">
                                        🔴 {t('matchRoom.opponentOffline', 'الخصم غير متصل')}
                                    </span>
                                </div>
                                {/* المؤقت */}
                                <div className="mt-3 p-2 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    <small className="text-light d-block mb-1">
                                        {t('matchRoom.canSubmitAfter', 'يمكنك إرسال النتيجة بعد:')}
                                    </small>
                                    <span className="fs-4 fw-bold text-warning">
                                        {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
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

                            {/* Show uploaded proof image if match is in review and user already submitted */}
                            {iSubmitted && match.proofScreenshot && (
                                <div className="proof-preview mb-3 text-center">
                                    <p className="text-muted small">{t('matchRoom.yourProof', 'Your uploaded proof:')}</p>
                                    <a href={getAvatarUrl(match.proofScreenshot)} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={getAvatarUrl(match.proofScreenshot)}
                                            alt="Proof"
                                            className="img-fluid rounded border border-light"
                                            style={{ maxHeight: '200px', cursor: 'pointer' }}
                                        />
                                    </a>
                                </div>
                            )}

                            {/* Show file upload only if not submitted yet */}
                            {!iSubmitted && (
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
                            )}

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
                            <div key={idx} className={`message-bubble ${msg.senderId === user._id || msg.senderId?._id === user._id ? 'sent' : 'received'}`}>
                                <span className="chat-sender">{msg.senderName || msg.senderId?.fullName}</span>
                                {msg.imageUrl && (
                                    <div className="chat-image-container mb-2">
                                        <a href={`${process.env.REACT_APP_API_URL}${msg.imageUrl}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={`${process.env.REACT_APP_API_URL}${msg.imageUrl}`}
                                                alt="Chat"
                                                className="chat-image rounded"
                                                style={{ maxWidth: '200px', maxHeight: '200px', cursor: 'pointer' }}
                                            />
                                        </a>
                                    </div>
                                )}
                                {msg.text && <div>{msg.text}</div>}
                                <div className="text-end" style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '2px' }}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {(isPlayer1 || isPlayer2 || isAdmin) && (
                        <div className="chat-input-area">
                            {/* Image preview */}
                            {chatImage && (
                                <div className="chat-image-preview mb-2 p-2 bg-dark rounded d-flex align-items-center gap-2">
                                    <img
                                        src={URL.createObjectURL(chatImage)}
                                        alt="Preview"
                                        style={{ maxHeight: '50px', borderRadius: '4px' }}
                                    />
                                    <Button size="sm" variant="outline-danger" onClick={() => setChatImage(null)}>✕</Button>
                                </div>
                            )}
                            <div className="d-flex gap-2 w-100">
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={chatImageRef}
                                    hidden
                                    accept="image/*"
                                    onChange={handleChatImageChange}
                                />
                                {/* Image upload button */}
                                <Button
                                    variant="outline-secondary"
                                    className="btn-chat-image"
                                    onClick={() => chatImageRef.current?.click()}
                                    title={t('matchRoom.chat.uploadImage', 'إرسال صورة')}
                                >
                                    <FaImage />
                                </Button>
                                <Form.Control
                                    placeholder={t('matchRoom.chat.placeholder')}
                                    className="custom-chat-input flex-grow-1"
                                    value={msgText}
                                    onChange={(e) => setMsgText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                />
                                <Button variant="primary" className="btn-send" onClick={sendMessage}>
                                    <FaPaperPlane />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MatchRoomPage;