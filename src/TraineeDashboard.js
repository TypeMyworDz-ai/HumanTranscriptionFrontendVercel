import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService'; // Assuming ChatService is used for general socket management
import { BACKEND_API_URL } from './config'; // Assuming you have a config for backend URL
import './TraineeDashboard.css'; // You'll need to create this CSS file

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
        <div className="trainee-dashboard-container">
            <header className="trainee-dashboard-header">
                <div className="header-content">
                    <h1>Trainee Dashboard</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="trainee-dashboard-main">
                <div className="trainee-dashboard-content">
                    <div className="dashboard-overview">
                        <h2 className="dashboard-title">Welcome to Your Training Room!</h2>
                        <p className="dashboard-description">
                            Here you will gain the knowledge and skills to become a top-tier transcriber
                            who will achieve the needed qualities of becoming a TypeMyworDz-certified transcriber.
                            Dive into our materials and chat with your trainer to accelerate your learning.
                        </p>
                    </div>

                    <div className="trainee-status-display">
                        <p>Your Current Status: <strong>{traineeStatus?.status?.replace(/_/g, ' ') || 'Loading...'}</strong></p>
                        <p>Your User Level: <strong>{traineeStatus?.user_level || 'Loading...'}</strong></p>
                        {traineeStatus?.status === 'paid_training_fee' && (
                            <p className="status-message">You have successfully paid for training access. Start learning!</p>
                        )}
                        {/* Add more status-based messages if needed */}
                    </div>

                    <div className="dashboard-sections-grid">
                        <Link to={`/trainee/training-room/${user.id}`} className="dashboard-card">
                            <div className="card-icon">💬</div>
                            <h3>Training Room</h3>
                            <p>Chat with your trainer and exchange files.</p>
                        </Link>

                        <Link to="/trainee/materials" className="dashboard-card">
                            <div className="card-icon">📚</div>
                            <h3>Training Materials</h3>
                            <p>Access useful resources, guides, and tools.</p>
                        </Link>

                        {/* Future: Add a card for 'Complete Training' button, visible only to admin or specific conditions */}
                        {user.user_type === 'admin' && ( // Example: Admin can see a button to complete training for this trainee
                            <Link to={`/admin/complete-training/${user.id}`} className="dashboard-card admin-action-card">
                                <div className="card-icon">✅</div>
                                <h3>Complete Training (Admin)</h3>
                                <p>Transition this trainee to an active transcriber.</p>
                            </Link>
                        )}
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

export default TraineeDashboard;
