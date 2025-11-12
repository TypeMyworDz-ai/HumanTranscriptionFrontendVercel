import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import './TrainingPayment.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const TRAINING_FEE_USD = 2.00;

const TrainingPayment = () => {
    const { user, isAuthenticated, authLoading, logout, updateUser, checkAuth } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [paymentInitiated, setPaymentInitiated] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack'); // UPDATED: Default to Paystack
    // REMOVED: mobileNumber state
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'trainee') {
            console.warn("TrainingPayment: Unauthorized access or not a trainee. Redirecting.");
            navigate('/');
            return;
        }

        if (user.transcriber_status === 'paid_training_fee') {
            console.log("TrainingPayment: Trainee has already paid. Redirecting to training dashboard.");
            navigate('/trainee-dashboard');
            return;
        }

        // REMOVED: KoraPay dynamic script loading useEffect as KoraPay is no longer an option.
    }, [isAuthenticated, authLoading, user, navigate, showToast]);


    const handleInitiatePayment = useCallback(async () => {
        if (!user?.email || paymentInitiated) {
            showToast('User email is missing or payment already initiated.', 'error');
            return;
        }
        if (!selectedPaymentMethod) {
            showToast('Please select a payment method.', 'error');
            return;
        }
        // REMOVED: KoraPay mobileNumber validation


        setLoading(true);
        setPaymentInitiated(true);
        const token = localStorage.getItem('token');

        try {
            // MODIFIED: Updated to new dedicated training payment endpoint
            const paymentApiUrl = `${BACKEND_API_URL}/api/training/payment/initialize`;
            console.log(`[TrainingPayment] Initiating payment to URL: ${paymentApiUrl} with method: ${selectedPaymentMethod}`);

            const payload = {
                amount: TRAINING_FEE_USD,
                email: user.email,
                paymentMethod: 'paystack', // UPDATED: Always send 'paystack'
                fullName: user.full_name,
            };

            // REMOVED: KoraPay mobileNumber inclusion in payload

            const response = await fetch(paymentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[TrainingPayment] Server responded with an error:', response.status, errorText);
                showToast(`Failed to initiate payment: ${response.statusText}. Please check backend route.`, 'error');
                setLoading(false);
                setPaymentInitiated(false);
                return;
            }

            const data = await response.json();

            // Only Paystack logic remains
            if (selectedPaymentMethod === 'paystack') {
                if (data.data?.authorization_url) {
                    showToast('Redirecting to payment gateway...', 'info');
                    window.location.href = data.data.authorization_url;
                } else {
                    showToast(data.error || 'Failed to initiate Paystack payment. Please try again.', 'error');
                    setLoading(false);
                    setPaymentInitiated(false);
                }
            } else { // Fallback if selectedPaymentMethod is not 'paystack' (shouldn't happen now)
                showToast('Unknown payment method selected. Please try again.', 'error');
                setLoading(false);
                setPaymentInitiated(false);
            }

        } catch (error) {
            console.error('Error initiating training payment:', error);
            showToast('Network error during payment initiation. Please try again.', 'error');
            setLoading(false);
            setPaymentInitiated(false);
        }
    }, [user, paymentInitiated, selectedPaymentMethod, showToast, navigate, updateUser, checkAuth]); // Removed mobileNumber from dependency array


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
                        <span>Welcome, {user.full_name}!</span>
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
                            Welcome to your journey to becoming a TypeMyworDz-approved transcriber!
                            After successful completion of training, you have a chance of joining 
                            our active transcribers pool and start earning!
                            To gain full access to the Training Room and Training Materials,
                            a one-time payment of **USD {TRAINING_FEE_USD.toFixed(2)}** is required.
                        </p>

                        <div className="payment-details">
                            <p className="fee-amount">
                                Training Fee: <strong>USD {TRAINING_FEE_USD.toFixed(2)}</strong>
                            </p>

                            {/* Payment Method Selection */}
                            <div className="payment-method-selection">
                                <h3>Select Payment Method:</h3>
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        value="paystack"
                                        checked={selectedPaymentMethod === 'paystack'}
                                        onChange={() => setSelectedPaymentMethod('paystack')}
                                        disabled={loading || paymentInitiated}
                                    />
                                    Paystack (Card, Mobile Money, Bank Transfer, Pesalink)
                                </label>
                                {/* REMOVED: KoraPay radio button option */}
                            </div>

                            {/* REMOVED: Mobile Number Input for KoraPay */}
                            

                            <button
                                onClick={handleInitiatePayment}
                                className="pay-now-btn"
                                disabled={loading || paymentInitiated || !selectedPaymentMethod} // UPDATED: Removed mobileNumber check
                            >
                                {loading ? 'Processing...' : `Pay Now (USD ${TRAINING_FEE_USD.toFixed(2)})`}
                            </button>
                        </div>

                        <p className="note-text">
                            Upon successful payment, login to access your Training Dashboard.
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
