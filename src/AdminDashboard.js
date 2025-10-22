// frontend/client/src/AdminDashboard.js - COMPLETE AND UPDATED for Vercel deployment

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './AdminDashboard.css';
import Toast from './Toast';
// FIXED: Removed direct 'io' import, use ChatService for socket management
import { connectSocket, disconnectSocket } from './ChatService'; // REMOVED: getSocketInstance

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminDashboard = () => {
    const { user, isAuthReady, authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [adminStats, setAdminStats] = useState({
        pendingTranscriberTests: 0,
        activeJobs: 0,
        disputes: 0,
        totalUsers: 0,
    });
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const audioRef = React.useRef(null);

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);


    // Fetch unread message count for the admin
    const fetchUnreadMessageCount = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) return;

        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/user/chat/unread-count`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && typeof data.count === 'number') {
                setUnreadMessageCount(data.count);
            } else {
                console.error('Failed to fetch unread message count:', data.error);
            }
        } catch (error) {
            console.error('Network error fetching unread message count:', error);
        }
    }, [user]);


    // Function to fetch admin dashboard statistics
    const fetchAdminStats = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        console.log('AdminDashboard: Fetching admin stats.');
        try {
            const headers = { 'Authorization': `Bearer ${token}` };

            const [
                testsResponse,
                jobsResponse,
                disputesResponse,
                usersResponse
            ] = await Promise.all([
                // FIXED: Use BACKEND_API_URL constant for all fetch calls
                fetch(`${BACKEND_API_URL}/api/admin/stats/pending-tests`, { headers }),
                fetch(`${BACKEND_API_URL}/api/admin/stats/active-jobs`, { headers }),
                fetch(`${BACKEND_API_URL}/api/admin/stats/disputes`, { headers }),
                fetch(`${BACKEND_API_URL}/api/admin/stats/total-users`, { headers })
            ]);

            const [testsData, jobsData, disputesData, usersData] = await Promise.all([
                testsResponse.json(),
                jobsResponse.json(),
                disputesResponse.json(),
                usersResponse.json()
            ]);

            setAdminStats({
                pendingTranscriberTests: testsResponse.ok ? testsData.count : 0,
                activeJobs: jobsResponse.ok ? jobsData.count : 0,
                disputes: disputesResponse.ok ? disputesData.count : 0,
                totalUsers: usersResponse.ok ? usersData.count : 0,
            });

        } catch (error) {
            console.error('Error fetching admin stats:', error);
            showToast('Failed to fetch admin statistics.', 'error');
        } finally {
            // setLoading(false); // Will be set by the main useEffect after all promises settle
        }
    }, [logout, showToast]);


    // Main useEffect for authentication, data fetching, and socket setup
    useEffect(() => {
        console.log('AdminDashboard: Main useEffect. isAuthReady:', isAuthReady, 'user:', user, 'authLoading:', authLoading);

        if (!isAuthReady || authLoading || !user || !user.id) {
            if (isAuthReady && !user) {
                 console.log("AdminDashboard: Auth ready but no user. Redirecting to login.");
                 navigate('/login');
            }
            return;
        }

        if (user.user_type !== 'admin') {
            console.warn(`AdminDashboard: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            navigate('/');
            return;
        }

        setLoading(true);

        const token = localStorage.getItem('token');
        if (!token) {
            console.warn("AdminDashboard: Token missing from localStorage despite isAuthenticated being true. Forcing logout.");
            logout();
            return;
        }

        Promise.all([
            fetchAdminStats(),
            fetchUnreadMessageCount()
        ]).finally(() => {
            setLoading(false);
        });


        // FIXED: Use ChatService for Socket.IO connection
        console.log(`AdminDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        const handleSocketConnect = () => {
            console.log('AdminDashboard: Socket connected, joining admin room.');
            socket.emit('joinUserRoom', user.id);
        };

        // FIXED: Only attach 'connect' listener if not already connected
        if (!socket.connected) {
            socket.on('connect', handleSocketConnect);
        } else {
            handleSocketConnect(); // If already connected, run immediately
        }
        

        const handleNegotiationUpdate = (data) => {
            console.log('AdminDashboard Real-time: Negotiation update received!', data);
            showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
            fetchAdminStats();
        };

        const handleUnreadMessageCountUpdate = (data) => {
            if (data.userId === user.id) {
                console.log('AdminDashboard Real-time: Unread message count update received!', data);
                fetchUnreadMessageCount();
                showToast('You have a new message!', 'info');
                if (data.change > 0) {
                    playNotificationSound();
                }
            }
        };

        const handleNewChatMessage = (data) => {
            console.log('AdminDashboard Real-time: New chat message received!', data);
            if (data.sender_id !== user.id) {
                showToast(`New message from ${data.sender_name || 'User'}!`, 'info');
                fetchUnreadMessageCount();
                playNotificationSound();
            }
        };

        // FIXED: Attach listeners to the global socket instance from ChatService
        socket.on('negotiation_accepted', handleNegotiationUpdate);
        socket.on('negotiation_rejected', handleNegotiationUpdate);
        socket.on('negotiation_countered', handleNegotiationUpdate);
        socket.on('negotiation_cancelled', handleNegotiationUpdate);
        socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            console.log(`AdminDashboard: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
            // FIXED: Detach listeners from the global socket instance
            socket.off('negotiation_accepted', handleNegotiationUpdate);
            socket.off('negotiation_rejected', handleNegotiationUpdate);
            socket.off('negotiation_countered', handleNegotiationUpdate);
            socket.off('negotiation_cancelled', handleNegotiationUpdate);
            socket.off('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
            socket.off('newChatMessage', handleNewChatMessage);
            socket.off('connect', handleSocketConnect); // Detach the connect listener
            disconnectSocket(); // Disconnect via ChatService
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthReady, user, authLoading, navigate, logout, showToast, fetchAdminStats, fetchUnreadMessageCount, playNotificationSound]);


    if (loading || authLoading) {
        return (
            <div className="admin-dashboard-container">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    <p className="ml-4 text-gray-600">Loading admin data...</p>
                </div>
            </div>
        );
    }

    if (!user || user.user_type !== 'admin') {
        return <div>Unauthorized access. Redirecting...</div>;
    }

    return (
        <div className="admin-dashboard-container">
            <header className="admin-dashboard-header">
                <div className="header-content">
                    <h1>Admin Dashboard</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="admin-dashboard-main">
                <div className="admin-dashboard-content">
                    <h2>Admin Overview</h2>
                    <p>Manage users, content, and system settings.</p>

                    <div className="admin-stats-overview">
                        <div className="stat-card">
                            <h4>Pending Tests</h4>
                            <p className="stat-value">{adminStats.pendingTranscriberTests}</p>
                        </div>
                        <div className="stat-card">
                            <h4>Active Jobs</h4>
                            <p className="stat-value">{adminStats.activeJobs}</p>
                        </div>
                        <div className="stat-card">
                            <h4>Open Disputes</h4>
                            <p className="stat-value">{adminStats.disputes}</p>
                        </div>
                        <div className="stat-card">
                            <h4>Total Users</h4>
                            <p className="stat-value">{adminStats.totalUsers}</p>
                        </div>
                    </div>

                    <div className="admin-sections-grid">
                        <Link to="/admin/transcriber-tests" className="admin-card">
                            <div className="card-icon">📝</div>
                            <h3>Approve Transcriber Tests ({adminStats.pendingTranscriberTests})</h3>
                            <p>Review and approve submitted transcriber tests.</p>
                        </Link>

                        <Link to="/admin/users" className="admin-card">
                            <div className="card-icon">👤</div>
                            <h3>Manage Users ({adminStats.totalUsers})</h3>
                            <p>View, edit, or remove clients and transcribers.</p>
                        </Link>

                        <Link to="/admin/jobs" className="admin-card">
                            <div className="card-icon">💼</div>
                            <h3>Manage All Jobs ({adminStats.activeJobs})</h3>
                            <p>Monitor all ongoing and completed transcription jobs.</p>
                        </Link>

                        <Link to="/admin/direct-upload-jobs" className="admin-card"> {/* NEW CARD */}
                            <div className="card-icon">📤</div>
                            <h3>Direct Upload Jobs</h3>
                            <p>Review and manage all client direct upload requests.</p>
                        </Link>

                        <Link to="/admin/payments" className="admin-card"> {/* NEW CARD */}
                            <div className="card-icon">💳</div>
                            <h3>Payment History</h3>
                            <p>View all client payments and transcriber earnings.</p>
                        </Link>

                        <Link to="/admin/disputes" className="admin-card">
                            <div className="card-icon">⚖️</div>
                            <h3>Dispute Resolution ({adminStats.disputes})</h3>
                            <p>Address conflicts between clients and transcribers.</p>
                        </Link>

                        <Link to="/admin/chat" className="admin-card">
                            <div className="card-icon">💬</div>
                            <h3>My Messages {unreadMessageCount > 0 && <span className="unread-badge">{unreadMessageCount}</span>}</h3>
                            <p>View and respond to direct messages from users.</p>
                        </Link>

                        <Link to="/admin/training-materials" className="admin-card"> {/* NEW: Knowledge Base Card */}
                            <div className="card-icon">📚</div>
                            <h3>Knowledge Base</h3>
                            <p>Manage training materials and resources for trainees.</p>
                        </Link>

                        <Link to="/admin/training-rooms" className="admin-card"> {/* NEW: Training Room Management Card */}
                            <div className="card-icon">🧑‍🏫</div>
                            <h3>Manage Training Rooms</h3>
                            <p>Oversee and participate in trainee communication channels.</p>
                        </Link>

                        <Link to="/admin/settings" className="admin-card">
                            <div className="card-icon">⚙️</div>
                            <h3>System Settings</h3>
                            <p>Configure platform parameters and integrations.</p>
                        </Link>
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
            <audio ref={audioRef} src="/path/to/your/notification-sound.mp3" preload="auto" />
        </div>
    );
};

export default AdminDashboard;
