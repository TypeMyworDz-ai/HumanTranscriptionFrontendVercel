import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService'; // Assuming ChatService is used for general socket management
import { BACKEND_API_URL } from './config'; // Assuming you have a config for backend URL
import './TraineeDashboard.css'; // You'll need to create this CSS file
import './HumanDashboardShared.css';

const TraineeDashboard = () => {
    const { user, isAuthenticated, authLoading, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [traineeStatus, setTraineeStatus] = useState(null);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const audioRef = useRef(null); // For notification sounds

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    // Function to fetch trainee-specific status from the backend
    const fetchTraineeStatus = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            console.warn("fetchTraineeStatus: Token missing or user ID unavailable.");
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/trainee/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                setTraineeStatus(data);
                // Redirect if status changes unexpectedly (e.g., admin marks them active transcriber)
                if (data.user_level === 'transcriber' && data.status === 'active_transcriber') {
                    showToast('Congratulations! You are now an active transcriber. Redirecting...', 'success');
                    setTimeout(() => navigate('/transcriber-dashboard'), 2000);
                }
            } else {
                showToast(data.error || 'Failed to fetch training status.', 'error');
                console.error('Failed to fetch training status:', data.error);
            }
        } catch (error) {
            console.error('Network error fetching training status:', error);
            showToast('Network error while fetching training status.', 'error');
        }
    }, [user?.id, showToast, navigate]);


    useEffect(() => {
        if (!isAuthReady || authLoading || !user || !user.id) {
            if (isAuthReady && !user) {
                console.log("TraineeDashboard: Auth ready but no user. Redirecting to login.");
                navigate('/login');
            }
            return;
        }

        // Ensure the user is a trainee and has paid
        if (user.user_type !== 'trainee') {
            console.warn(`TraineeDashboard: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            navigate('/');
            return;
        }
        if (user.transcriber_status !== 'paid_training_fee') {
            console.warn(`TraineeDashboard: Trainee (${user.full_name}) has not paid for training. Redirecting to payment page.`);
            navigate('/training-payment');
            return;
        }

        setLoading(true);
        fetchTraineeStatus().finally(() => setLoading(false));

        // --- Socket.IO setup for real-time updates for trainee status ---
        const socket = connectSocket(user.id);
        if (socket) {
            socket.emit('joinUserRoom', user.id);
            console.log(`TraineeDashboard: Sent joinUserRoom event for userId: ${user.id}`);

            const handleTrainingPaymentSuccessful = (data) => {
                console.log('TraineeDashboard Real-time: Training payment successful!', data);
                showToast(data.message, 'success');
                fetchTraineeStatus(); // Re-fetch status to update UI
            };

            const handleTraineeStatusUpdate = (data) => {
                console.log('TraineeDashboard Real-time: Trainee status update received!', data);
                showToast(`Your training status was updated to ${data.newStatus}.`, 'info');
                fetchTraineeStatus(); // Re-fetch status to update UI
                playNotificationSound();
            };

            socket.on('training_payment_successful', handleTrainingPaymentSuccessful);
            socket.on('trainee_status_update', handleTraineeStatusUpdate); // Listen for admin-triggered status updates

            return () => {
                console.log(`TraineeDashboard: Cleaning up socket listeners for user ID: ${user.id}`);
                socket.off('training_payment_successful', handleTrainingPaymentSuccessful);
                socket.off('trainee_status_update', handleTraineeStatusUpdate);
                disconnectSocket(); // Disconnect general socket
            };
        }
    }, [isAuthReady, user, authLoading, navigate, fetchTraineeStatus, showToast, playNotificationSound]);


    if (loading || authLoading || !isAuthenticated || !user || user.user_type !== 'trainee') {
        return (
            <div className="trainee-dashboard-container">
                <div className="loading-spinner">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="trainee-dashboard-container tm-suite-dashboard tm-trainee-suite">
            <header className="tm-suite-topbar">
                <Link to="/trainee-dashboard" className="tm-suite-brand" aria-label="TypeMyworDz trainee dashboard">
                    <img src="/logo192.png" alt="" />
                    <span><b className="tm-brand-purple">Type</b><b className="tm-brand-green">My</b><b className="tm-brand-purple">worDz</b><small>Training workspace</small></span>
                </Link>
                <div className="tm-suite-account"><span className="tm-suite-profile"><span>{user.full_name?.charAt(0).toUpperCase() || 'T'}</span>{user.full_name}</span><button onClick={logout} className="tm-suite-logout">Log out</button></div>
            </header>
            <main className="tm-suite-main">
                <section className="tm-suite-intro">
                    <div><span className="tm-suite-eyebrow">TRAINEE WORKSPACE</span><h1>Build the habits of a great transcriber.</h1><p>Use your materials and trainer conversations to move confidently toward approval.</p></div>
                    <div className="tm-suite-live-mark"><span />Training access active</div>
                </section>
                <section className="tm-trainee-status"><div><span className="tm-suite-eyebrow">CURRENT LEVEL</span><strong>{traineeStatus?.user_level || 'Loading...'}</strong></div><p>{traineeStatus?.status === 'paid_training_fee' ? 'Your training access is ready. Start with the materials, then bring questions to your trainer.' : 'Your training status is being checked.'}</p></section>
                <section className="tm-suite-section">
                    <div className="tm-suite-section-head"><div><span className="tm-suite-eyebrow">TRAINING PATH</span><h2>Learn, practise and ask</h2></div></div>
                    <div className="tm-suite-action-grid tm-trainee-grid">
                        <Link to={`/trainee/training-room/${user.id}`}><span className="tm-suite-card-label">CONVERSATION</span><strong>Training room</strong><p>Ask your trainer questions and exchange files.</p><em>Open training room →</em></Link>
                        <Link to="/trainee/materials"><span className="tm-suite-card-label">RESOURCES</span><strong>Training materials</strong><p>Read the guides and practical resources for your next assessment.</p><em>Browse materials →</em></Link>
                    </div>
                </section>
            </main>
            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} duration={toast.type === 'error' ? 4000 : 3000} />
            <audio ref={audioRef} src="/audio/notification-sound.mp3" preload="auto" />
        </div>
    );
};

export default TraineeDashboard;
