// frontend/client/src/AdminDashboard.js

import React, { useState, useEffect, useCallback } from 'react'; // FIX: Removed useRef from destructuring here
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './AdminDashboard.css';
import Toast from './Toast';
import io from 'socket.io-client';

// Define the socket server URL explicitly
const SOCKET_SERVER_URL = 'http://localhost:5000';
// Initialize Socket.IO client outside the component with autoConnect: false
const socket = io(SOCKET_SERVER_URL, { autoConnect: false });


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

    // FIX: Explicitly use React.useRef to resolve 'useRef is not defined' runtime error
    const audioRef = React.useRef(null);

    // Function to play notification sound
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
            const response = await fetch(`${SOCKET_SERVER_URL}/api/user/chat/unread-count`, {
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
                fetch(`${SOCKET_SERVER_URL}/api/admin/stats/pending-tests`, { headers }),
                fetch(`${SOCKET_SERVER_URL}/api/admin/stats/active-jobs`, { headers }),
                fetch(`${SOCKET_SERVER_URL}/api/admin/stats/disputes`, { headers }),
                fetch(`${SOCKET_SERVER_URL}/api/admin/stats/total-users`, { headers })
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

        // Gate all logic until authentication is ready and user is defined
        if (!isAuthReady || authLoading || !user || !user.id) {
            if (isAuthReady && !user) {
                 console.log("AdminDashboard: Auth ready but no user. Redirecting to login.");
                 navigate('/login');
            }
            return;
        }

        // CRITICAL: If the authenticated user is NOT an admin, redirect them.
        if (user.user_type !== 'admin') {
            console.warn(`AdminDashboard: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            navigate('/');
            return;
        }

        setLoading(true); // Start loading for all data fetches

        const token = localStorage.getItem('token');
        if (!token) {
            console.warn("AdminDashboard: Token missing from localStorage despite isAuthenticated being true. Forcing logout.");
            logout();
            return;
        }

        // Fetch all necessary data concurrently
        Promise.all([
            fetchAdminStats(),
            fetchUnreadMessageCount()
        ]).finally(() => {
            setLoading(false); // Set loading to false only after all promises settle
        });


        // --- Socket.IO Connection Setup for Real-Time Updates ---
        console.log(`AdminDashboard: Attempting to connect socket for user ID: ${user.id}`);

        if (!socket.connected) {
            console.log('AdminDashboard: Socket not connected, attempting to connect to:', SOCKET_SERVER_URL);
            socket.connect();
        }

        const handleSocketConnect = () => {
            console.log('AdminDashboard: Socket connected, joining admin room.');
            socket.emit('joinUserRoom', user.id);
        };

        if (socket.connected) {
            handleSocketConnect();
        } else {
            socket.on('connect', handleSocketConnect);
        }

        const handleNegotiationUpdate = (data) => {
            console.log('Real-time: Negotiation update received!', data);
            showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
            fetchAdminStats(); // Refresh stats
        };

        const handleUnreadMessageCountUpdate = (data) => {
            if (data.userId === user.id) {
                console.log('Real-time: Unread message count update received!', data);
                fetchUnreadMessageCount(); // Re-fetch the unread message count to ensure it's accurate after any update (read/unread)
                showToast('You have a new message!', 'info');
                if (data.change > 0) { // Play sound only if count increased
                    playNotificationSound();
                }
            }
        };

        const handleNewChatMessage = (data) => {
            console.log('Real-time: New chat message received!', data);
            if (data.sender_id !== user.id) { // Only show toast if message is from another user
                showToast(`New message from ${data.sender_name || 'User'}!`, 'info');
                fetchUnreadMessageCount(); // Refresh count just in case
                playNotificationSound(); // Play sound for new messages
            }
        };

        socket.on('negotiation_accepted', handleNegotiationUpdate);
        socket.on('negotiation_rejected', handleNegotiationUpdate);
        socket.on('negotiation_countered', handleNegotiationUpdate);
        socket.on('negotiation_cancelled', handleNegotiationUpdate);
        socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            console.log(`AdminDashboard: Cleaning up socket listeners for user ID: ${user.id}`);
            socket.off('negotiation_accepted', handleNegotiationUpdate);
            socket.off('negotiation_rejected', handleNegotiationUpdate);
            socket.off('negotiation_countered', handleNegotiationUpdate);
            socket.off('negotiation_cancelled', handleNegotiationUpdate);
            socket.off('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
            socket.off('newChatMessage', handleNewChatMessage);
            socket.off('connect', handleSocketConnect);
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
