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
        negotiationJobsCount: 0, // UPDATED: Separate count for negotiation jobs
        directUploadJobsCount: 0, // UPDATED: Separate count for direct upload jobs
        totalActiveJobs: 0, // Keep total for overall dashboard stat
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
                jobsCountResponse, // UPDATED: Renamed to reflect it's for counts
                disputesResponse,
                usersResponse
            ] = await Promise.all([
                // FIXED: Use BACKEND_API_URL constant for all fetch calls
                fetch(`${BACKEND_API_URL}/api/admin/stats/pending-tests`, { headers }),
                fetch(`${BACKEND_API_URL}/api/admin/stats/active-jobs`, { headers }), // This now returns separate counts
                fetch(`${BACKEND_API_URL}/api/admin/stats/disputes`, { headers }),
                fetch(`${BACKEND_API_URL}/api/admin/stats/total-users`, { headers })
            ]);

            const [testsData, jobsCountData, disputesData, usersData] = await Promise.all([ // UPDATED: Renamed
                testsResponse.json(),
                jobsCountResponse.json(), // UPDATED: Renamed
                disputesResponse.json(),
                usersResponse.json()
            ]);

            setAdminStats({
                pendingTranscriberTests: testsResponse.ok ? testsData.count : 0,
                negotiationJobsCount: jobsCountResponse.ok ? jobsCountData.negotiationJobsCount : 0, // UPDATED: Set negotiationJobsCount
                directUploadJobsCount: jobsCountResponse.ok ? jobsCountData.directUploadJobsCount : 0, // UPDATED: Set directUploadJobsCount
                totalActiveJobs: jobsCountResponse.ok ? jobsCountData.totalActiveJobs : 0, // Keep total for overall dashboard stat
                disputes: disputesResponse.ok ? disputesData.count : 0,
                totalUsers: usersResponse.ok ? usersData.count : 0,
            });

        } catch (error) {
            console.error('Error fetching admin stats:', error);
            showToast('Failed to fetch admin statistics.ᐟ', 'error');
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
            console.log('AdminDashboard Real-time: Negotiation update received!ᐟ', data);
            showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
            fetchAdminStats();
        };

        const handleUnreadMessageCountUpdate = (data) => {
            if (data.userId === user.id) {
                console.log('AdminDashboard Real-time: Unread message count update received!ᐟ', data);
                fetchUnreadMessageCount();
                showToast('You have a new message!ᐟ', 'info');
                if (data.change > 0) {
                    playNotificationSound();
                }
            }
        };

        const handleNewChatMessage = (data) => {
            console.log('AdminDashboard Real-time: New chat message received!ᐟ', data);
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
                    <p className="ml-4 text-gray-600">Loading admin data...ᐟ</p>
                </div>
            </div>
        );
    }

    if (!user || user.user_type !== 'admin') {
        return <div>Unauthorized access. Redirecting...ᐟ</div>;
    }

    return (
        <div className="admin-dashboard-container tm-admin-shell">
            <header className="tm-admin-topbar">
                <div className="tm-admin-brand">
                    <strong><span className="tm-admin-purple">Type</span><span className="tm-admin-green">My</span><span className="tm-admin-purple">worDz</span></strong>
                    <span>Operations console</span>
                </div>
                <div className="tm-admin-user">
                    <span>Welcome, {user?.full_name || 'Admin'}</span>
                    <button onClick={logout} className="tm-admin-logout">Log out</button>
                </div>
            </header>

            <main className="tm-admin-main">
                <section className="tm-admin-hero">
                    <div>
                        <span className="tm-admin-eyebrow">OPERATIONS</span>
                        <h1>Admin dashboard</h1>
                        <p>A calm, current view of the human transcription marketplace.</p>
                    </div>
                    <div className="tm-admin-status">
                        <span className="tm-admin-status-dot" />
                        <div>
                            <strong>Workspace online</strong>
                            <span>Live job and account monitoring</span>
                        </div>
                    </div>
                </section>

                <section className="tm-admin-stats" aria-label="Platform summary">
                    <div className="tm-admin-stat tm-admin-stat-purple">
                        <span>People on the platform</span>
                        <strong>{adminStats.totalUsers}</strong>
                        <small>Clients, transcribers and trainees</small>
                    </div>
                    <div className="tm-admin-stat tm-admin-stat-green">
                        <span>Active work</span>
                        <strong>{adminStats.totalActiveJobs}</strong>
                        <small>{adminStats.negotiationJobsCount} negotiated · {adminStats.directUploadJobsCount} direct upload</small>
                    </div>
                    <div className="tm-admin-stat tm-admin-stat-amber">
                        <span>Tests to review</span>
                        <strong>{adminStats.pendingTranscriberTests}</strong>
                        <small>Transcriber applications waiting</small>
                    </div>
                    <div className="tm-admin-stat tm-admin-stat-rose">
                        <span>Open disputes</span>
                        <strong>{adminStats.disputes}</strong>
                        <small>Cases that may need a decision</small>
                    </div>
                </section>

                <div className="tm-admin-dashboard-grid">
                    <section className="tm-admin-panel">
                        <div className="tm-admin-panel-head">
                            <div>
                                <span className="tm-admin-eyebrow">NEEDS ATTENTION</span>
                                <h2>Work queues</h2>
                            </div>
                            <span className="tm-admin-panel-note">Open items</span>
                        </div>
                        <div className="tm-admin-queue-list">
                            <Link to="/admin/transcriber-tests" className="tm-admin-queue-row">
                                <span><strong>Transcriber tests</strong><small>Review new applications and assessments</small></span>
                                <b>{adminStats.pendingTranscriberTests}</b><em>View</em>
                            </Link>
                            <Link to="/admin/negotiation-jobs" className="tm-admin-queue-row">
                                <span><strong>Negotiated jobs</strong><small>Monitor client and transcriber agreements</small></span>
                                <b>{adminStats.negotiationJobsCount}</b><em>View</em>
                            </Link>
                            <Link to="/admin/direct-upload-jobs" className="tm-admin-queue-row">
                                <span><strong>Direct-upload jobs</strong><small>Track paid jobs moving through the queue</small></span>
                                <b>{adminStats.directUploadJobsCount}</b><em>View</em>
                            </Link>
                            <Link to="/admin/disputes" className="tm-admin-queue-row">
                                <span><strong>Disputes</strong><small>Resolve issues before they become delays</small></span>
                                <b>{adminStats.disputes}</b><em>View</em>
                            </Link>
                        </div>
                    </section>

                    <aside className="tm-admin-panel tm-admin-quick-panel">
                        <div className="tm-admin-panel-head">
                            <div>
                                <span className="tm-admin-eyebrow">SHORTCUTS</span>
                                <h2>Quick access</h2>
                            </div>
                        </div>
                        <div className="tm-admin-quick-list">
                            <Link to="/admin/users">Manage people <span>→</span></Link>
                            <Link to="/admin/payments">Review payments <span>→</span></Link>
                            <Link to="/admin/chat">Open messages {unreadMessageCount > 0 && <b>{unreadMessageCount}</b>} <span>→</span></Link>
                            <Link to="/admin/settings">System settings <span>→</span></Link>
                        </div>
                    </aside>
                </div>

                <section className="tm-admin-panel tm-admin-link-panel">
                    <div className="tm-admin-panel-head">
                        <div>
                            <span className="tm-admin-eyebrow">PLATFORM MANAGEMENT</span>
                            <h2>People, finance and training</h2>
                        </div>
                        <span className="tm-admin-panel-note">All admin tools</span>
                    </div>
                    <div className="tm-admin-link-grid">
                        <Link to="/admin/users"><strong>People</strong><span>Search and manage clients, transcribers and trainees.</span></Link>
                        <Link to="/admin/payments"><strong>Payments</strong><span>Review client payments and transcriber earnings.</span></Link>
                        <Link to="/admin/training-materials"><strong>Knowledge base</strong><span>Keep training materials current and useful.</span></Link>
                        <Link to="/admin/training-rooms"><strong>Training rooms</strong><span>Support conversations with new trainees.</span></Link>
                    </div>
                </section>
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
