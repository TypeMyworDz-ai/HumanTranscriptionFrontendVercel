// frontend/client/src/UserChat.js

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './ClientDashboard.css'; 
import io from 'socket.io-client'; 

// Define the socket server URL explicitly
const SOCKET_SERVER_URL = 'http://localhost:5000'; 
// Initialize Socket.IO client outside the component with autoConnect: false
const socket = io(SOCKET_SERVER_URL, { autoConnect: false }); 


const UserChat = () => {
    const { chatId } = useParams(); 
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true); // Manages overall loading state
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });
    const [chatPartner, setChatPartner] = useState(null);

    const messagesEndRef = useRef(null); 
    const userRef = useRef(user); // Ref to hold latest user object
    const chatPartnerRef = useRef(chatPartner); // Ref to hold latest chatPartner object

    // Update refs whenever user or chatPartner change
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { chatPartnerRef.current = chatPartner; }, [chatPartner]);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Effect for initial authentication check and redirection
    useEffect(() => {
        console.log('UserChat: Auth check useEffect. isAuthReady:', isAuthReady, 'user:', user);

        if (!isAuthReady || !user || !user.id || !user.user_type) {
            if (isAuthReady && !user) { 
                 console.log("UserChat: Auth ready but no user. Redirecting to login.");
                 navigate('/login');
            }
            return;
        }
        // No setLoading(true) here; initial loading is handled by the component's main loading state
    }, [isAuthReady, user, navigate]);


    // Effect for fetching chat partner details
    useEffect(() => {
        let isMounted = true; // Cleanup flag
        const fetchDetails = async () => {
            if (!isAuthReady || !user || !user.id || !user.user_type) return; // Gate
            
            const token = localStorage.getItem('token');
            if (!token) { logout(); return; }

            console.log('UserChat: Fetching chat partner details for chatId:', chatId);
            try {
                const response = await fetch(`${SOCKET_SERVER_URL}/api/users/${chatId}`, { 
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (isMounted) {
                    if (response.ok && data.user) {
                        setChatPartner(data.user);
                    } else {
                        showToast(data.error || 'Chat partner not found.', 'error');
                        navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard'); 
                    }
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Error fetching chat partner details:', error);
                    showToast('Network error fetching chat partner details.', 'error');
                    navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard'); 
                }
            }
        };
        fetchDetails();
        return () => { isMounted = false; }; // Cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthReady, user?.id, user?.user_type, chatId, navigate, logout, showToast]); // Dependencies for this useEffect


    // Effect for managing Socket.IO connection and listeners
    useEffect(() => {
        let isMounted = true; // Cleanup flag

        if (!isAuthReady || !user || !user.id || !user.user_type || !chatPartner) {
            console.log('UserChat: Socket useEffect gated. isAuthReady:', isAuthReady, 'user:', user?.id, 'chatPartner:', chatPartner?.id);
            return; // Gate socket logic until auth and chatPartner are ready
        }

        console.log('UserChat: Socket useEffect running. Attempting to connect/join.');

        // Connect socket only if not already connected
        if (!socket.connected) {
            console.log('UserChat: Socket not connected, attempting to connect to:', SOCKET_SERVER_URL);
            socket.connect();
        }

        const handleSocketConnect = () => {
            if (!isMounted) return;
            console.log('UserChat: Socket connected, joining user room.');
            socket.emit('joinUserRoom', user.id);
            // Once connected and room joined, we can proceed to fetch messages
            // This prevents fetching messages until the socket is ready for real-time updates
            fetchChatHistory(); 
        };

        if (socket.connected) {
            handleSocketConnect();
        } else {
            socket.on('connect', handleSocketConnect);
        }

        const handleNewChatMessage = (msg) => {
            if (!isMounted) return;
            console.log('UserChat: Received new message via socket:', msg);
            setMessages((prevMessages) => {
                const currentLoggedInUser = userRef.current;
                const currentChatPartner = chatPartnerRef.current;

                const senderName = (msg.sender_id === currentLoggedInUser.id)
                    ? currentLoggedInUser.full_name
                    : (currentChatPartner?.full_name || 'Admin');

                if ((msg.sender_id === chatId && msg.receiver_id === currentLoggedInUser.id) ||
                    (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === chatId)) {
                    if (prevMessages.some(m => m.id === msg.id)) {
                        console.log('UserChat: Duplicate message received via socket, ignoring:', msg.id);
                        return prevMessages;
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

        // Cleanup on component unmount
        return () => {
            if (isMounted) {
                console.log('UserChat: Cleaning up socket listeners on unmount.');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthReady, user?.id, user?.full_name, user?.user_type, chatId, showToast, chatPartner]); // Added chatPartner to dependencies

    // This useEffect will only run once chatPartner and user are set, and after socket is connected
    const fetchChatHistory = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }
        
        console.log('UserChat: Fetching historical chat messages.');
        try {
            const response = await fetch(`${SOCKET_SERVER_URL}/api/user/chat/messages/${chatId}`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: msg.sender_id === userRef.current.id ? userRef.current.full_name : chatPartnerRef.current?.full_name || 'Admin', 
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
            setLoading(false); // Only set loading to false after messages are fetched
        }
    }, [chatId, logout, showToast]); // Removed user and chatPartner from dependencies, now using refs


    // Auto-scroll to the bottom of messages whenever messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const handleSendMessage = async () => {
        if (newMessage.trim() === '') return;

        console.log(`User ${user.full_name} sending message to ${chatPartner?.full_name}: ${newMessage}`);
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${SOCKET_SERVER_URL}/api/user/chat/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    receiverId: chatId, 
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
            <div className="client-dashboard-container">
                <div className="loading-spinner">Loading chat...</div>
            </div>
        );
    }

    if (!chatPartner) {
        return (
            <div className="client-dashboard-container">
                <p className="no-data-message">Chat partner not found.</p>
                <Link to={user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard'} className="back-link">← Back to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="client-dashboard-container">
            <header className="client-dashboard-header">
                <div className="header-content">
                    <h1>Chat with {chatPartner.full_name}</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'User'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="client-dashboard-main">
                <div className="back-link-container">
                    <Link to={user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard'} className="back-link">← Back to Dashboard</Link>
                </div>

                <div className="dashboard-content">
                    <h2>Conversation with {chatPartner.full_name}</h2>
                    <div className="chat-window">
                        <div className="messages-display">
                            {messages.length === 0 ? (
                                <p className="no-data-message">Start chat by typing a message below!</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.sender_id === user.id ? 'my-message' : 'partner-message'}`}>
                                        <div className="message-header">
                                            <strong>{msg.sender_id === user.id ? 'Me' : chatPartner.full_name}</strong>
                                            <span>{msg.timestamp}</span>
                                        </div>
                                        <p>{msg.text}</p>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="message-input-area">
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                placeholder="Type your message..."
                                rows="3"
                            ></textarea>
                            <button onClick={handleSendMessage} className="send-message-btn">Send</button>
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
        </div>
    );
};

export default UserChat;
