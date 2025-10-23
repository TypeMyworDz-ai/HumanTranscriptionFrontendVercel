import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './TrainingPayment.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const TRAINING_FEE_USD = 0.50; // Define the fixed training fee

const TrainingPayment = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false); // For payment initiation
    const [paymentInitiated, setPaymentInitiated] = useState(false); // To prevent multiple payment attempts
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    useEffect(() => {
        if (authLoading) return;

        // Redirect if not authenticated or not a trainee
        if (!isAuthenticated || !user || user.user_type !== 'trainee') {
            console.warn("TrainingPayment: Unauthorized access or not a trainee. Redirecting.");
            navigate('/');
            return;
        }

        // If trainee has already paid, redirect to training dashboard
        if (user.transcriber_status === 'paid_training_fee') {
            console.log("TrainingPayment: Trainee has already paid. Redirecting to training dashboard.");
            navigate('/trainee-dashboard');
            return;
        }

    }, [isAuthenticated, authLoading, user, navigate]);


    const handleInitiatePayment = useCallback(async () => {
        if (!user?.email || paymentInitiated) {
            showToast('User email is missing or payment already initiated.', 'error');
            return;
        }

        setLoading(true);
        setPaymentInitiated(true);
        const token = localStorage.getItem('token');

        try {
            // NEW: Log the full URL being called
            const paymentApiUrl = `${BACKEND_API_URL}/api/payment/initialize-training`;
            console.log(`[TrainingPayment] Initiating payment to URL: ${paymentApiUrl}`);

            const response = await fetch(paymentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: TRAINING_FEE_USD,
                    email: user.email
                })
            });

            // NEW: Improved error handling for non-OK responses
            if (!response.ok) {
                const errorText = await response.text(); // Read raw response text
                console.error('[TrainingPayment] Server responded with an error:', response.status, errorText);
                showToast(`Failed to initiate payment: ${response.statusText}. Please check backend route.`, 'error');
                setLoading(false);
                setPaymentInitiated(false);
                return; // Stop execution here
            }

            const data = await response.json(); // Only try to parse as JSON if response is OK

            if (data.data?.authorization_url) {
                showToast('Redirecting to payment gateway...', 'info');
                window.location.href = data.data.authorization_url; // Redirect to Paystack
            } else {
                showToast(data.error || 'Failed to initiate payment. Please try again.', 'error');
                setLoading(false);
                setPaymentInitiated(false);
            }

        } catch (error) {
            console.error('Error initiating training payment:', error);
            showToast('Network error during payment initiation. Please try again.', 'error');
            setLoading(false);
            setPaymentInitiated(false);
        }
    }, [user, paymentInitiated, showToast]);


    if (authLoading || !isAuthenticated || !user || user.user_type !== 'trainee') {
        return (
            <div className="training-payment-container">
                <div className="loading-spinner">Loading authentication...</div>
            </div>
        );
    }
    if (loading) {
        return (
            <div className="training-payment-container">
                <div className="loading-spinner">Initiating payment...</div>
            </div>
        );
    }

    return (
        <div className="training-payment-container">
            <header className="training-payment-header">
                <div className="header-content">
                    <h1>Training Access Payment</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="training-payment-main">
                <div className="training-payment-content">
                    <div className="payment-card">
                        <h2>Unlock Your Training Dashboard</h2>
                        <p className="intro-text">
                            Welcome to your journey to becoming a TypeMyworDz-certified transcriber!
                            To gain full access to the Training Room and Training Materials,
                            a one-time payment of **USD {TRAINING_FEE_USD.toFixed(2)}** is required.
                        </p>

                        <div className="payment-details">
                            <p className="fee-amount">
                                Training Fee: <strong>USD {TRAINING_FEE_USD.toFixed(2)}</strong>
                            </p>
                            <button
                                onClick={handleInitiatePayment}
                                className="pay-now-btn"
                                disabled={loading || paymentInitiated}
                            >
                                {loading ? 'Processing...' : `Pay Now (USD ${TRAINING_FEE_USD.toFixed(2)})`}
                            </button>
                        </div>

                        <p className="note-text">
                            Upon successful payment, you will be automatically redirected to your personalized
                            Training Dashboard.
                        </p>
                        <Link to="/" className="back-to-home-btn">← Back to Homepage</Link>
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

export default TrainingPayment;
