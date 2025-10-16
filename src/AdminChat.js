// frontend/client/src/AdminChat.js

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminChat.css'; // Referencing the dedicated AdminChat.css
import io from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:5000';
const socket = io(SOCKET_SERVER_URL, { autoConnect: false });

const AdminChat = () => {
    const { userId } = useParams();
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [targetUser, setTargetUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    // Removed: selectedFile, uploadingFile, fileInputRef, handleFileSelect, handleRemoveFile
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const messagesEndRef = useRef(null);
    const userRef = useRef(user);
    const targetUserRef = useRef(targetUser);
    const audioRef = useRef(null);

    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { targetUserRef.current = targetUser; }, [targetUser]);

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);

    useEffect(() => {
        if (isAuthReady && (!user || !user.id || user.user_type !== 'admin')) {
            navigate('/login');
        }
    }, [isAuthReady, user, navigate]);

    useEffect(() => {
        let isMounted = true;
        const fetchDetails = async () => {
            if (!isAuthReady || !user || !user.id || user.user_type !== 'admin') return;
            
            const token = localStorage.getItem('token');
            if (!token) { logout(); return; }

            try {
                const response = await fetch(`${SOCKET_SERVER_URL}/api/admin/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (isMounted) {
                    if (response.ok && data.user) {
                        setTargetUser(data.user);
                    } else {
                        showToast(data.error || 'Failed to fetch user details for chat.', 'error');
                        navigate('/admin/users');
                    }
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Error fetching target user details:', error);
                    showToast('Network error fetching user details for chat.', 'error');
                    navigate('/admin/users');
                }
            }
        };
        fetchDetails();
        return () => { isMounted = false; };
    }, [isAuthReady, user, userId, navigate, logout, showToast]);

    useEffect(() => {
        let isMounted = true;

        if (!isAuthReady || !user || !user.id || user.user_type !== 'admin' || !targetUser) {
            return;
        }

        if (!socket.connected) {
            socket.connect();
        }

        const handleSocketConnect = () => {
            if (!isMounted) return;
            socket.emit('joinUserRoom', user.id);
            socket.emit('joinUserRoom', userId);
            fetchChatMessages();
        };

        if (socket.connected) {
            handleSocketConnect();
        } else {
            socket.on('connect', handleSocketConnect);
        }

        const handleNewChatMessage = (msg) => {
            if (!isMounted) return;
            
            setMessages((prevMessages) => {
                const currentLoggedInUser = userRef.current;
                const currentTargetUser = targetUserRef.current;

                const senderName = (msg.sender_id === currentLoggedInUser.id)
                    ? currentLoggedInUser.full_name
                    : (currentTargetUser?.full_name || 'User');

                if ((msg.sender_id === userId && msg.receiver_id === currentLoggedInUser.id) || 
                    (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === userId)) {
                    if (prevMessages.some(m => m.id === msg.id)) {
                        return prevMessages;
                    }
                    if (msg.sender_id !== currentLoggedInUser.id) {
                        playNotificationSound();
                    }

                    return [...prevMessages, {
                        id: msg.id,
                        sender_id: msg.sender_id,
                        receiver_id: msg.receiver_id,
                        content: msg.content,
                        text: msg.content,
                        timestamp: new Date(msg.timestamp).toLocaleString(),
                        sender_name: senderName,
                    }];
                }
                return prevMessages;
            });
        };

        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            if (isMounted) {
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect);
            }
        };
    }, [isAuthReady, user?.id, user?.full_name, user?.user_type, userId, navigate, showToast, targetUser, playNotificationSound]);

    const fetchChatMessages = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }
        
        try {
            const response = await fetch(`${SOCKET_SERVER_URL}/api/admin/chat/messages/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: msg.sender_id === userRef.current.id ? userRef.current.full_name : targetUserRef.current?.full_name || 'User',
                    text: msg.content,
                    timestamp: new Date(msg.timestamp).toLocaleString()
                }));
                setMessages(formattedMessages);
            } else {
                showToast(data.error || 'Failed to fetch chat messages.', 'error');
            }
        } catch (error) {
            console.error('Error fetching chat messages:', error);
            showToast('Network error fetching chat messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [userId, logout, showToast]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (newMessage.trim() === '') return; // Simplified condition

        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`${SOCKET_SERVER_URL}/api/admin/chat/send-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    receiverId: userId,
                    messageText: newMessage,
                })
            });

            const data = await response.json();
            if (response.ok) {
                setNewMessage('');
            } else {
                showToast(data.error || 'Failed to send message.', 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Network error sending message.', 'error');
        } 
    };

    if (loading) {
        return (
            <div className="admin-chat-container">
                <div className="loading-spinner">Loading chat...</div>
            </div>
        );
    }

    if (!targetUser) {
        return (
            <div className="admin-chat-container">
                <p className="no-data-message">User not found for chat.</p>
                <Link to="/admin/users" className="back-link">← Back to Manage Users</Link>
            </div>
        );
    }

    return (
        <div className="admin-chat-container">
            <header className="admin-chat-header">
                <div className="header-content">
                    <h1>Chat with {targetUser.full_name}</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-chat-main">
                <div className="back-link-container">
                    <Link to="/admin/users" className="back-link">← Back to Manage Users</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Conversation with {targetUser.full_name} ({targetUser.email})</h2>
                    <div className="chat-window">
                        <div className="messages-display">
                            {messages.length === 0 ? (
                                <p className="no-data-message">Start chat by typing a message below!</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.sender_id === user.id ? 'admin-message' : 'user-message'}`}>
                                        <div className="message-header">
                                            <strong>{msg.sender_id === user.id ? 'Admin' : targetUser.full_name}</strong>
                                            <span>{msg.timestamp}</span>
                                        </div>
                                        {msg.text && <p>{msg.text}</p>}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="message-input-area">
                            <div className="input-controls">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    placeholder="Type your message..."
                                    rows="3"
                                />
                                <div className="message-actions">
                                    <button 
                                        onClick={handleSendMessage} 
                                        className="send-message-btn"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
                duration={toast.type === 'error' ? 4000 : 3000}
            />
            <audio ref={audioRef} src="/audio/notification-sound.mp3" preload="auto" />
        </div>
    );
};

export default AdminChat;
