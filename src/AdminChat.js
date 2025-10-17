// frontend/client/src/AdminChat.js - COMPLETE AND UPDATED for Vercel deployment

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminChat.css';
// FIXED: Removed direct 'io' import, use ChatService for socket management
import { connectSocket, disconnectSocket, sendMessage, getSocketInstance } from './ChatService';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminChat = () => {
    const { userId } = useParams();
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [targetUser, setTargetUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
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
            if (!isAuthReady || !user || !user.id || user.user_type !== 'admin') {
                console.warn('AdminChat: Not authorized or user not ready for fetching target user details. Skipping fetchDetails.');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) { logout(); return; }

            console.log(`AdminChat: Attempting to fetch details for target user ID: ${userId}`);
            try {
                const response = await fetch(`${BACKEND_API_URL}/api/admin/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (isMounted) {
                    if (response.ok && data.user) {
                        setTargetUser(data.user);
                        console.log(`AdminChat: Successfully fetched details for user ${userId}.`, data.user);
                    } else {
                        console.error(`AdminChat: Failed to fetch user details for ${userId}. Response not OK or missing user data.`, data);
                        showToast(data.error || 'Failed to fetch user details for chat.', 'error');
                        navigate('/admin/users');
                    }
                }
            } catch (error) {
                if (isMounted) {
                    console.error('AdminChat: Network error fetching target user details:', error);
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
            if (isAuthReady && user && user.user_type === 'admin' && !targetUser) {
                console.log('AdminChat: Waiting for targetUser details before connecting socket and fetching messages.');
            }
            return;
        }

        // FIXED: Use ChatService for Socket.IO connection
        console.log(`AdminChat: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        const handleSocketConnect = () => {
            if (!isMounted) return;
            // FIXED: Use standardized 'joinUserRoom'
            socket.emit('joinUserRoom', user.id);
            socket.emit('joinUserRoom', userId);
            console.log(`AdminChat: Socket connected. Joined rooms for ${user.id} and ${userId}. Fetching chat messages.`);
            fetchChatMessages();
        };

        // FIXED: Only attach 'connect' listener if not already connected
        if (!socket.connected) {
            socket.on('connect', handleSocketConnect);
        } else {
            handleSocketConnect(); // If already connected, run immediately
        }

        const handleNewChatMessage = (msg) => {
            if (!isMounted) return;

            setMessages((prevMessages) => {
                const currentLoggedInUser = userRef.current;
                // const currentTargetUser = targetUserRef.current; // Not directly used here, but for context

                // Ensure message is relevant to this chat
                const isRelevant = (msg.sender_id === userId && msg.receiver_id === currentLoggedInUser.id) ||
                                   (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === userId);

                if (!isRelevant) {
                    console.log('AdminChat: Received irrelevant message, ignoring.', msg);
                    return prevMessages; // Ignore irrelevant messages
                }

                if (prevMessages.some(m => m.id === msg.id)) {
                    console.log('AdminChat: Received duplicate message, ignoring.', msg);
                    return prevMessages; // Avoid duplicate messages
                }
                if (msg.sender_id !== currentLoggedInUser.id) {
                    playNotificationSound();
                }

                // Ensure consistent message structure with fetched messages
                const newMessageObj = {
                    id: msg.id,
                    sender_id: msg.sender_id,
                    receiver_id: msg.receiver_id,
                    content: msg.content, // Use 'content' as per backend
                    timestamp: msg.timestamp, // Keep as ISO string
                    sender_name: msg.sender_name, // Should be provided by backend
                };
                console.log('AdminChat: Adding new message to chat:', newMessageObj);
                return [...prevMessages, newMessageObj];
            });
        };

        // FIXED: Attach listeners to the global socket instance from ChatService
        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            if (isMounted) {
                console.log('AdminChat: Cleaning up socket listeners on unmount.');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect); // Detach the connect listener
                disconnectSocket(); // Disconnect via ChatService
            }
        };
    }, [isAuthReady, user?.id, user?.full_name, user?.user_type, userId, navigate, showToast, targetUser, playNotificationSound, fetchChatMessages]);

    const fetchChatMessages = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log(`AdminChat: Fetching chat messages for admin ${user.id} and user ${userId}.`);
        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/admin/chat/messages/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: (msg.sender_id === userRef.current.id) ? userRef.current.full_name : targetUserRef.current?.full_name || 'User',
                    text: msg.content, // Use 'content' as per backend
                    timestamp: new Date(msg.timestamp).toLocaleString() // Format for display
                }));
                setMessages(formattedMessages);
                console.log(`AdminChat: Successfully fetched ${formattedMessages.length} messages.`);
            } else {
                console.error('AdminChat: Failed to fetch chat messages. Response not OK or missing messages data.', data);
                showToast(data.error || 'Failed to fetch chat messages.', 'error');
            }
        } catch (error) {
            console.error('AdminChat: Network error fetching chat messages:', error);
            showToast('Network error fetching chat messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [userId, logout, showToast, user?.id, userRef, targetUserRef]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (newMessage.trim() === '') return;

        try {
            // FIXED: Use sendMessage from ChatService, passing senderUserType
            await sendMessage({
                senderId: user.id,
                receiverId: userId,
                negotiationId: null, // This is a direct chat, not negotiation specific
                messageText: newMessage,
                timestamp: new Date().toISOString(),
                senderUserType: user.user_type // NEW: Pass the sender's user type
            });

            setNewMessage('');
            // The message will be emitted back via WebSocket and handled by handleNewChatMessage
            console.log('AdminChat: Message sent successfully via ChatService.');
        } catch (error) {
            console.error('AdminChat: Error sending message:', error);
            showToast(error.message || 'Network error sending message.', 'error');
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
                </div> {/* Corrected: Removed the extra </Link> and closed the div */}

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
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {msg.content && <p>{msg.content}</p>}
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
                                ></textarea>
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
