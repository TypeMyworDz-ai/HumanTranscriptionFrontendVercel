import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import './TrainingPayment.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const TRAINING_FEE_USD = 50.00;

const TrainingPayment = () => {
    const { user, isAuthenticated, authLoading, logout, updateUser, checkAuth } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [paymentInitiated, setPaymentInitiated] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack');
    const [mobileNumber, setMobileNumber] = useState('');
    const [korapayScriptLoaded, setKorapayScriptLoaded] = useState(false);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    // Load KoraPay SDK
    useEffect(() => {
        const existingScript = document.getElementById('korapay-sdk');
        if (existingScript) {
            setKorapayScriptLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'korapay-sdk';
        script.src = 'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js';
        script.async = true;
        script.onload = () => {
            console.log('[TrainingPayment] KoraPay SDK loaded successfully');
            setKorapayScriptLoaded(true);
        };
        script.onerror = () => {
            console.error('[TrainingPayment] Failed to load KoraPay SDK');
            showToast('Failed to load KoraPay payment system. Please refresh the page.', 'error');
        };
        document.body.appendChild(script);

        return () => {
            const scriptToRemove = document.getElementById('korapay-sdk');
            if (scriptToRemove) {
                document.body.removeChild(scriptToRemove);
            }
        };
    }, [showToast]);

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
    }, [isAuthenticated, authLoading, user, navigate]);

    const handleKorapayPayment = useCallback(async (korapayData) => {
        if (!window.Korapay) {
            showToast('KoraPay is not loaded. Please refresh the page and try again.', 'error');
            setLoading(false);
            setPaymentInitiated(false);
            return;
        }

        try {
            window.Korapay.initialize({
                ...korapayData,
                onClose: function () {
                    console.log('[TrainingPayment] KoraPay modal closed by user');
                    showToast('Payment cancelled. You can try again when ready.', 'info');
                    setLoading(false);
                    setPaymentInitiated(false);
                },
                onSuccess: async function (data) {
                    console.log('[TrainingPayment] KoraPay payment successful:', data);
                    showToast('Payment successful! Verifying...', 'success');

                    try {
                        const token = localStorage.getItem('token');
                        const verifyResponse = await fetch(
                            `${BACKEND_API_URL}/api/training/payment/verify-korapay`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ reference: data.reference })
                            }
                        );

                        const verifyData = await verifyResponse.json();

                        if (verifyResponse.ok && verifyData.success) {
                            showToast('Payment verified! Redirecting to training dashboard...', 'success');
                            
                            // Important: Refresh user data to reflect new transcriber_status
                            await updateUser();
                            await checkAuth();
                            
                            setTimeout(() => {
                                navigate('/trainee-dashboard');
                            }, 2000); // Give user time to read toast before redirect
                        } else {
                            showToast(verifyData.error || 'Payment verification failed. Please contact support.', 'error');
                            setLoading(false);
                            setPaymentInitiated(false);
                        }
                    } catch (verifyError) {
                        console.error('[TrainingPayment] Error verifying KoraPay payment:', verifyError);
                        showToast('Error verifying payment. Please contact support with your transaction reference.', 'error');
                        setLoading(false);
                        setPaymentInitiated(false);
                    }
                },
                onFailed: function (data) {
                    console.error('[TrainingPayment] KoraPay payment failed:', data);
                    showToast('Payment failed. Please try again or contact support.', 'error');
                    setLoading(false);
                    setPaymentInitiated(false);
                }
            });
        } catch (error) {
            console.error('[TrainingPayment] Error initializing KoraPay:', error);
            showToast('Failed to initialize payment. Please try again.', 'error');
            setLoading(false);
            setPaymentInitiated(false);
        }
    }, [showToast, navigate, updateUser, checkAuth]);

    const handleInitiatePayment = useCallback(async () => {
        if (!user?.email || paymentInitiated) {
            showToast('User email is missing or payment already initiated.', 'error');
            return;
        }
        if (!selectedPaymentMethod) {
            showToast('Please select a payment method.', 'error');
            return;
        }
        // Only require mobile number for KoraPay if it's selected
        if (selectedPaymentMethod === 'korapay' && !mobileNumber.trim()) {
            showToast('Please enter your mobile number for KoraPay payment.', 'error');
            return;
        }

        setLoading(true);
        setPaymentInitiated(true);
        const token = localStorage.getItem('token');

        try {
            const paymentApiUrl = `${BACKEND_API_URL}/api/training/payment/initialize`;
            console.log(`[TrainingPayment] Initiating payment to URL: ${paymentApiUrl} with method: ${selectedPaymentMethod}`);

            const payload = {
                amount: TRAINING_FEE_USD,
                email: user.email,
                paymentMethod: selectedPaymentMethod,
                fullName: user.full_name,
            };

            // Conditionally add mobileNumber to payload for KoraPay
            if (selectedPaymentMethod === 'korapay' && mobileNumber.trim()) {
                payload.mobileNumber = mobileNumber.trim();
            }

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
                showToast(`Failed to initiate payment: ${response.statusText}`, 'error');
                setLoading(false);
                setPaymentInitiated(false);
                return;
            }

            const data = await response.json();

            if (selectedPaymentMethod === 'paystack') {
                if (data.data?.authorization_url) {
                    showToast('Redirecting to Paystack...', 'info');
                    window.location.href = data.data.authorization_url;
                } else {
                    showToast(data.error || 'Failed to initiate Paystack payment.', 'error');
                    setLoading(false);
                    setPaymentInitiated(false);
                }
            } else if (selectedPaymentMethod === 'korapay') {
                if (data.korapayData) {
                    showToast('Opening KoraPay payment modal...', 'info');
                    await handleKorapayPayment(data.korapayData);
                } else {
                    showToast(data.error || 'Failed to initiate KoraPay payment.', 'error');
                    setLoading(false);
                    setPaymentInitiated(false);
                }
            }

        } catch (error) {
            console.error('Error initiating training payment:', error);
            showToast('Network error during payment initiation. Please try again.', 'error');
            setLoading(false);
            setPaymentInitiated(false);
        }
    }, [user, paymentInitiated, selectedPaymentMethod, mobileNumber, showToast, handleKorapayPayment]);

    // Render loading states
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
                <div className="loading-spinner">
                    {selectedPaymentMethod === 'korapay' ? 'Opening payment modal...' : 'Redirecting to payment gateway...'}
                </div>
            </div>
        );
    }

    return (
        <div className="training-payment-container">
            <header className="training-payment-header">
                <div className="header-content">
                    <h1>🎓 Training Access Payment</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text">Welcome, <strong>{user.full_name}</strong>!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="training-payment-main">
                <div className="training-payment-content">
                    <div className="payment-card">
                        <div className="card-header">
                            <h2>🚀 Unlock Your Training Dashboard</h2>
                            <p className="subtitle">Start your journey to becoming a certified transcriber</p>
                        </div>

                        <div className="intro-section">
                            <p className="intro-text">
                                Welcome to your journey to becoming a <strong>TypeMyworDz-approved transcriber</strong>! 
                                After successful completion of training, you'll have the opportunity to join our active 
                                transcribers pool and start earning.
                            </p>
                            <div className="benefits-list">
                                <div className="benefit-item">
                                    ✓ Access to comprehensive training materials
                                </div>
                                <div className="benefit-item">
                                    ✓ Live training room with admin support
                                </div>
                                <div className="benefit-item">
                                    ✓ Certification upon completion
                                </div>
                            </div>
                        </div>

                        <div className="payment-details">
                            <div className="fee-display">
                                <span className="fee-label">One-time Training Fee:</span>
                                <span className="fee-amount">USD {TRAINING_FEE_USD.toFixed(50)}</span>
                            </div>

                            {/* Payment Method Selection */}
                            <div className="payment-method-selection">
                                <h3 className="section-title">💳 Select Payment Method</h3>
                                <div className="payment-options">
                                    <label className={`payment-option ${selectedPaymentMethod === 'paystack' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            value="paystack"
                                            checked={selectedPaymentMethod === 'paystack'}
                                            onChange={() => setSelectedPaymentMethod('paystack')}
                                            disabled={loading || paymentInitiated}
                                        />
                                        <div className="option-content">
                                            <div className="option-header">
                                                <span className="option-icon">💳</span>
                                                <span className="option-name">Paystack</span>
                                            </div>
                                            <span className="option-description">
                                                Card, Mobile Money, Bank Transfer, Pesalink
                                            </span>
                                        </div>
                                    </label>

                                    <label className={`payment-option ${selectedPaymentMethod === 'korapay' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            value="korapay"
                                            checked={selectedPaymentMethod === 'korapay'}
                                            onChange={() => setSelectedPaymentMethod('korapay')}
                                            disabled={loading || paymentInitiated || !korapayScriptLoaded}
                                        />
                                        <div className="option-content">
                                            <div className="option-header">
                                                <span className="option-icon">📱</span>
                                                <span className="option-name">KoraPay</span>
                                            </div>
                                            <span className="option-description">
                                                Mobile Money, Card, Bank Transfer
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Mobile Number Input for KoraPay */}
                            {selectedPaymentMethod === 'korapay' && (
                                <div className="mobile-input-section">
                                    <label htmlFor="mobileNumber" className="input-label">
                                        📱 Mobile Number (Optional for KoraPay)
                                    </label>
                                    <input
                                        type="tel"
                                        id="mobileNumber"
                                        className="mobile-input"
                                        placeholder="e.g., +254712345678"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        disabled={loading || paymentInitiated}
                                    />
                                    <small className="input-hint">
                                        Enter your mobile number for faster mobile money payments
                                    </small>
                                </div>
                            )}

                            <button
                                onClick={handleInitiatePayment}
                                className="pay-now-btn"
                                disabled={loading || paymentInitiated || !selectedPaymentMethod}
                            >
                                {loading ? (
                                    <>
                                        <span className="btn-spinner"></span>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <span className="btn-icon">🔒</span>
                                        Pay Now - USD {TRAINING_FEE_USD.toFixed(50)}
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="footer-section">
                            <p className="note-text">
                                🔒 Your payment is secure and encrypted. Upon successful payment, 
                                you'll be automatically redirected to your Training Dashboard.
                            </p>
                            <Link to="/" className="back-to-home-btn">
                                ← Back to Homepage
                            </Link>
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

export default TrainingPayment;
