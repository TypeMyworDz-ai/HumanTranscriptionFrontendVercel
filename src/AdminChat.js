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
    // Removed individual userRef and targetUserRef updates, will use state directly
    const audioRef = useRef(null);

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


    // Refactored fetchChatMessages to directly use user and targetUser state
    const fetchChatMessages = useCallback(async () => {
        // Ensure user and targetUser are available before proceeding
        if (!user || !targetUser) {
            console.warn('AdminChat: fetchChatMessages called before user or targetUser are available.');
            setLoading(false); // Stop loading if prerequisites are not met
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log(`AdminChat: Fetching chat messages for admin ${user.id} and user ${targetUser.id}.`);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/chat/messages/${targetUser.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    // Direct access to user and targetUser state variables
                    sender_name: (msg.sender_id === user.id) ? user.full_name : targetUser.full_name || 'User',
                    text: msg.content,
                    timestamp: new Date(msg.timestamp).toLocaleString()
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
    }, [userId, logout, showToast, user, targetUser]); // Added user and targetUser to dependencies


    // Refactored handleNewChatMessage to directly use user and targetUser state
    const handleNewChatMessage = useCallback((msg) => {
        // Ensure user and targetUser are available before proceeding
        if (!user || !targetUser) {
            console.warn('AdminChat: handleNewChatMessage called before user or targetUser are available. Ignoring message.');
            return;
        }

        setMessages((prevMessages) => {
            // Use 'user' directly from the component's state, which is in the useCallback's closure
            const currentLoggedInUser = user;

            // Ensure message is relevant to this chat
            const isRelevant = (msg.sender_id === userId && msg.receiver_id === currentLoggedInUser.id) ||
                               (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === userId);

            if (!isRelevant) {
                console.log('AdminChat: Received irrelevant message, ignoring.', msg);
                return prevMessages;
            }

            if (prevMessages.some(m => m.id === msg.id)) {
                console.log('AdminChat: Received duplicate message, ignoring.', msg);
                return prevMessages;
            }
            if (msg.sender_id !== currentLoggedInUser.id) {
                playNotificationSound();
            }

            const newMessageObj = {
                id: msg.id,
                sender_id: msg.sender_id,
                receiver_id: msg.receiver_id,
                content: msg.content,
                timestamp: msg.timestamp,
                // Determine sender_name based on current user and targetUser
                sender_name: (msg.sender_id === currentLoggedInUser.id) ? currentLoggedInUser.full_name : targetUser?.full_name || 'User',
            };
            console.log('AdminChat: Adding new message to chat:', newMessageObj);
            return [...prevMessages, newMessageObj];
        });
    }, [userId, user, targetUser, playNotificationSound]); // Added user and targetUser to dependencies


    useEffect(() => {
        let isMounted = true;

        if (!isAuthReady || !user || !user.id || user.user_type !== 'admin' || !targetUser) {
            if (isAuthReady && user && user.user_type === 'admin' && !targetUser) {
                console.log('AdminChat: Waiting for targetUser details before connecting socket and fetching messages.');
            }
            return;
        }

        console.log(`AdminChat: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        const handleSocketConnect = () => {
            if (!isMounted) return;
            socket.emit('joinUserRoom', user.id);
            socket.emit('joinUserRoom', userId);
            console.log(`AdminChat: Socket connected. Joined rooms for ${user.id} and ${userId}. Fetching chat messages.`);
            fetchChatMessages(); // Call without arguments, as user and targetUser are in its closure
        };

        if (!socket.connected) {
            socket.on('connect', handleSocketConnect);
        } else {
            handleSocketConnect(); // If already connected, run immediately
        }

        // Attach listeners to the global socket instance from ChatService
        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            if (isMounted) {
                console.log('AdminChat: Cleaning up socket listeners on unmount.');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect); // Detach the connect listener
                disconnectSocket(); // Disconnect via ChatService
            }
        };
    }, [isAuthReady, user, targetUser, userId, navigate, logout, showToast, fetchChatMessages, handleNewChatMessage, playNotificationSound]);


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (newMessage.trim() === '') return;

        // Ensure user is available before sending message
        if (!user) {
            console.error('AdminChat: Attempted to send message before user object is available.');
            showToast('Cannot send message: User not logged in or not loaded.', 'error');
            return;
        }

        try {
            await sendMessage({
                senderId: user.id,
                receiverId: userId,
                negotiationId: null, // This is a direct chat, not negotiation specific
                messageText: newMessage,
                timestamp: new Date().toISOString(),
                senderUserType: user.user_type // Pass the sender's user type
            });

            setNewMessage('');
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
