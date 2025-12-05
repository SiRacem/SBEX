// client/src/pages/GlobalChatPage.jsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import { Container, Form, Button, InputGroup, Image, Badge, Spinner, Dropdown } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { SocketContext } from '../App';
import { getRecentMessages, deleteMessage, muteUser, pinMessage, clearChat } from '../redux/actions/chatAction';
import { FaPaperPlane, FaThumbtack, FaReply, FaTrash, FaBan, FaEllipsisV } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import './GlobalChatPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const GlobalChatPage = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const socket = useContext(SocketContext);
    
    const { user } = useSelector(state => state.userReducer);
    const { messages, pinnedMessage, loading } = useSelector(state => state.chatReducer);
    
    const [newMessage, setNewMessage] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    
    const messagesEndRef = useRef(null);

    // دالة مساعدة لمعالجة رابط الصورة
    const getAvatarUrl = (url) => {
        // [!!!] استخدام رابط الصورة الذي طلبته كافتراضي [!!!]
        if (!url) return 'https://bootdey.com/img/Content/avatar/avatar7.png';
        
        if (url.startsWith('http') || url.startsWith('https')) return url;
        
        // تنظيف المسار المحلي
        const cleanPath = url.startsWith('/') ? url.substring(1) : url;
        return `${BACKEND_URL}/${cleanPath}`;
    };

    // 1. Initial Load & Socket Listeners
    useEffect(() => {
        dispatch(getRecentMessages());

        if (socket) {
            socket.emit('join_global_chat');

            socket.on('new_global_message', (msg) => {
                dispatch({ type: 'ADD_MESSAGE_REALTIME', payload: msg });
                scrollToBottom();
            });

            socket.on('message_deleted', (id) => {
                dispatch({ type: 'MESSAGE_DELETED_REALTIME', payload: id });
            });

            socket.on('message_pinned', (msg) => {
                dispatch({ type: 'MESSAGE_PINNED_REALTIME', payload: msg });
            });

            socket.on('chat_cleared', () => {
                dispatch({ type: 'CHAT_CLEARED_REALTIME' });
            });

            socket.on('user_typing_global', ({ userId, name }) => {
                setTypingUsers(prev => {
                    if (prev.find(u => u.userId === userId)) return prev;
                    return [...prev, { userId, name }];
                });
                setTimeout(() => {
                    setTypingUsers(prev => prev.filter(u => u.userId !== userId));
                }, 3000);
            });

            // [تعديل] معالجة الأخطاء المترجمة
            socket.on('global_chat_error', (errData) => {
                if (typeof errData === 'object' && errData.key) {
                    toast.error(t(errData.key, errData.params));
                } else {
                    toast.error(t(errData));
                }
            });
        }

        return () => {
            if (socket) {
                socket.off('new_global_message');
                socket.off('message_deleted');
                socket.off('message_pinned');
                socket.off('chat_cleared');
                socket.off('user_typing_global');
                socket.off('global_chat_error');
            }
        };
    }, [dispatch, socket, t]);

    // 2. Scroll Logic
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 3. Handlers
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        if (socket) {
            socket.emit('send_global_message', { 
                content: newMessage, 
                replyToId: replyTo?._id 
            });
            setNewMessage("");
            setReplyTo(null);
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (socket) {
            socket.emit('global_typing');
        }
    };

    const handleMute = (userId) => {
        const duration = prompt("Mute duration in minutes:", "10");
        if (duration) dispatch(muteUser({ userId, duration, unit: 'minutes' }));
    };

    return (
        <Container fluid className="global-chat-page p-0">
            {/* Header / Pinned Message */}
            <div className="chat-header p-3 shadow-sm d-flex justify-content-between align-items-center">
                <div>
                    <h5 className="mb-0 text-white fw-bold">🌍 {t('globalChat.title', 'Global Chat')}</h5>
                    {pinnedMessage && (
                        <div className="pinned-msg mt-2 p-2 rounded">
                            <FaThumbtack className="text-warning me-2" />
                            <small className="text-white-50">{pinnedMessage.sender?.fullName}: </small>
                            <small className="text-white">{pinnedMessage.content}</small>
                        </div>
                    )}
                </div>
                {user?.userRole === 'Admin' && (
                    <Button variant="danger" size="sm" onClick={() => {
                        if(window.confirm('Clear all chat history?')) dispatch(clearChat());
                    }}>
                        {t('globalChat.clearChat', 'Clear Chat')}
                    </Button>
                )}
            </div>

            {/* Messages Area */}
            <div className="messages-container p-3">
                {loading && messages.length === 0 ? (
                    <div className="text-center pt-5"><Spinner animation="border" variant="light" /></div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.sender?._id === user?._id;
                        const isAdmin = user?.userRole === 'Admin';
                        
                        return (
                            <div key={msg._id} className={`message-wrapper ${isMe ? 'my-message' : ''} mb-3`}>
                                {!isMe && (
                                    <Image 
                                        src={getAvatarUrl(msg.sender?.avatarUrl)} 
                                        roundedCircle 
                                        className="msg-avatar" 
                                    />
                                )}
                                
                                <div className="message-content-box">
                                    {/* Sender Name & Badges */}
                                    {!isMe && (
                                        <div className="msg-sender-name mb-1">
                                            {msg.sender?.fullName || 'Unknown'}
                                            {/* ترجمة الرتب */}
                                            {msg.sender?.userRole === 'Admin' && (
                                                <Badge bg="danger" className="ms-1">{t('common.roles.Admin', 'ADMIN')}</Badge>
                                            )}
                                            {msg.sender?.userRole === 'Vendor' && (
                                                <Badge bg="success" className="ms-1">{t('common.roles.Vendor', 'VENDOR')}</Badge>
                                            )}
                                        </div>
                                    )}

                                    {/* Reply Context */}
                                    {msg.replyTo && (
                                        <div className="reply-context p-2 mb-2 rounded">
                                            <small className="d-block text-muted">{msg.replyTo.sender?.fullName || 'User'}</small>
                                            <small>{msg.replyTo.content.substring(0, 50)}...</small>
                                        </div>
                                    )}

                                    {/* Message Text */}
                                    <div className="msg-text">{msg.content}</div>
                                    <small className="msg-time text-end d-block mt-1">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </small>
                                </div>

                                {/* Actions Menu */}
                                <Dropdown className="msg-actions">
                                    <Dropdown.Toggle variant="link" className="text-muted p-0 no-arrow">
                                        <FaEllipsisV size={12} />
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item onClick={() => setReplyTo(msg)}><FaReply className="me-2"/> {t('globalChat.reply', 'Reply')}</Dropdown.Item>
                                        {isAdmin && (
                                            <>
                                                <Dropdown.Divider />
                                                <Dropdown.Item onClick={() => dispatch(pinMessage(msg._id))}><FaThumbtack className="me-2"/> {t('globalChat.pin', 'Pin')}</Dropdown.Item>
                                                <Dropdown.Item onClick={() => handleMute(msg.sender._id)}><FaBan className="me-2"/> {t('globalChat.mute', 'Mute User')}</Dropdown.Item>
                                                <Dropdown.Item className="text-danger" onClick={() => dispatch(deleteMessage(msg._id))}><FaTrash className="me-2"/> {t('common.delete', 'Delete')}</Dropdown.Item>
                                            </>
                                        )}
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
                <div className="typing-indicator px-3 pb-1 text-muted small">
                    {typingUsers.map(u => u.name).join(', ')} {t('globalChat.isTyping', 'is typing...')}
                </div>
            )}

            {/* Input Area */}
            <div className="chat-input-area p-3 bg-white">
                {replyTo && (
                    <div className="reply-preview d-flex justify-content-between align-items-center p-2 mb-2 rounded">
                        <small>{t('globalChat.replyingTo', 'Replying to')}: <strong>{replyTo.sender?.fullName}</strong></small>
                        <Button variant="close" size="sm" onClick={() => setReplyTo(null)} />
                    </div>
                )}
                <Form onSubmit={handleSendMessage}>
                    <InputGroup>
                        <Form.Control
                            placeholder={t('globalChat.placeholder', 'Type a message...')}
                            value={newMessage}
                            onChange={handleTyping}
                            className="rounded-pill border-0 bg-light px-3"
                        />
                        <Button variant="primary" type="submit" className="rounded-pill ms-2 px-4" disabled={!newMessage.trim()}>
                            <FaPaperPlane />
                        </Button>
                    </InputGroup>
                </Form>
            </div>
        </Container>
    );
};

export default GlobalChatPage;