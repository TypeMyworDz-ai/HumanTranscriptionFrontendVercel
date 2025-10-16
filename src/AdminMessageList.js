// frontend/client/src/AdminMessageList.js

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminManagement.css'; // Re-using general admin styles
import './AdminMessageList.css'; // NEW: Import dedicated CSS for this component
import io from 'socket.io-client'; 

const SOCKET_SERVER_URL = 'http://localhost:5000'; 
const socket = io(SOCKET_SERVER_URL, { autoConnect: false }); 

const AdminMessageList = () => {
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [chatList, setChatList] = useState([]); // List of users admin has chatted with
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Function to fetch the list of users the admin has chatted with
    const fetchAdminChatList = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            logout();
            return;
        }

        console.log('AdminMessageList: Fetching admin chat list.');
        try {
            const response = await fetch(`${SOCKET_SERVER_URL}/api/admin/chat/list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && data.chatList) {
                setChatList(data.chatList);
            } else {
                showToast(data.error || 'Failed to fetch chat list.', 'error');
            }
        } catch (error) {
            console.error('Error fetching admin chat list:', error);
            showToast('Network error fetching admin chat list.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, logout, showToast]);


    useEffect(() => {
        console.log('AdminMessageList: Auth check useEffect. isAuthReady:', isAuthReady, 'user:', user);

        if (!isAuthReady || !user || !user.id || user.user_type !== 'admin') {
            if (isAuthReady && !user) { 
                 console.log("AdminMessageList: Auth ready but no user. Redirecting to login.");
                 navigate('/login');
            }
            return;
        }

        setLoading(true);
        fetchAdminChatList();

        // --- Socket.IO Connection Setup for Real-Time Updates ---
        console.log(`AdminMessageList: Attempting to connect socket for user ID: ${user.id}`);
        
        if (!socket.connected) {
            console.log('AdminMessageList: Socket not connected, attempting to connect to:', SOCKET_SERVER_URL);
            socket.connect();
        }

        const handleSocketConnect = () => {
            console.log('AdminMessageList: Socket connected, joining admin room.');
            socket.emit('joinUserRoom', user.id); 
        };

        if (socket.connected) {
            handleSocketConnect(); 
        } else {
            socket.on('connect', handleSocketConnect); 
        }

        const handleNewChatMessage = (msg) => {
            console.log('AdminMessageList: New chat message received!', msg);
            // If a new message comes in, refresh the chat list to update latest message and unread count
            fetchAdminChatList(); 
            showToast(`New message from ${msg.sender_name || 'User'}!`, 'info');
        };

        const handleUnreadMessageCountUpdate = (data) => {
            if (data.userId === user.id) {
                console.log('Real-time: Unread message count update received!', data);
                // Refresh the list to get the accurate new count
                fetchAdminChatList(); 
            }
        };

        socket.on('newChatMessage', handleNewChatMessage);
        socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
        socket.on('connect', handleSocketConnect);

        return () => {
            console.log('AdminMessageList: Cleaning up socket listeners on unmount.');
            socket.off('newChatMessage', handleNewChatMessage);
            socket.off('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
            socket.off('connect', handleSocketConnect);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthReady, user, navigate, logout, showToast, fetchAdminChatList]);


    if (loading) {
        return (
            <div className="admin-message-list-container"> {/* Use new container class */}
                <div className="loading-spinner">Loading messages...</div>
            </div>
        );
    }

    if (!user || user.user_type !== 'admin') {
        return <div>Unauthorized access. Redirecting...</div>;
    }

    return (
        <div className="admin-message-list-container"> {/* Use new container class */}
            <header className="admin-management-header"> {/* Re-use general admin header */}
                <div className="header-content">
                    <h1>My Messages</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-message-list-main"> {/* Use new main class */}
                <div className="back-link-container">
                    <Link to="/admin-dashboard" className="back-link">← Back to Admin Dashboard</Link>
                </div>

                <div className="admin-message-list-section"> {/* Use new section class */}
                    <h2>Conversations</h2>
                    <p>Select a user to view chat history and send messages.</p>

                    {chatList.length === 0 ? (
                        <p className="no-data-message">No active conversations found.</p>
                    ) : (
                        <div className="chat-list-container">
                            {chatList.map(chat => (
                                <Link to={`/admin/chat/${chat.partner_id}`} key={chat.partner_id} className="chat-list-item">
                                    <div className="chat-list-details">
                                        <h3>
                                            {chat.partner_name} 
                                            {chat.partner_type && <span className="partner-type">({chat.partner_type})</span>}
                                        </h3>
                                        <p className="last-message">{chat.last_message_content}</p>
                                    </div>
                                    <span className="last-message-time">{chat.last_message_timestamp}</span>
                                    {chat.unread_count > 0 && (
                                        <span className="unread-badge">{chat.unread_count}</span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
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

export default AdminMessageList;
