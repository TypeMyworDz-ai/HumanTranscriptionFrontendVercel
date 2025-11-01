import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import './TrainingPayment.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const TRAINING_FEE_USD = 2.00;

const TrainingPayment = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [paymentInitiated, setPaymentInitiated] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('korapay');
    const [mobileNumber, setMobileNumber] = useState('');
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

        // Dynamically load KoraPay script if selected and not already loaded
        if (selectedPaymentMethod === 'korapay' && !window.Korapay) {
            const script = document.createElement('script');
            script.src = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
            script.async = true;
            document.body.appendChild(script);

            script.onload = () => {
                console.log("KoraPay script loaded successfully.");
            };
            script.onerror = (error) => {
                console.error("Failed to load KoraPay script:", error);
                showToast("Failed to load KoraPay payment gateway. Please try again.", "error");
            };

            return () => {
                // Cleanup: remove the script when component unmounts or method changes away from korapay
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
            };
        }
    }, [isAuthenticated, authLoading, user, navigate, selectedPaymentMethod, showToast]);


    const handleInitiatePayment = useCallback(async () => {
        if (!user?.email || paymentInitiated) {
            showToast('User email is missing or payment already initiated.', 'error');
            return;
        }
        if (!selectedPaymentMethod) {
            showToast('Please select a payment method.', 'error');
            return;
        }
        if (selectedPaymentMethod === 'korapay' && !mobileNumber) {
            showToast('Please enter your mobile number for KoraPay.', 'error');
            return;
        }


        setLoading(true);
        setPaymentInitiated(true);
        const token = localStorage.getItem('token');

        try {
            const paymentApiUrl = `${BACKEND_API_URL}/api/payment/initialize-training`;
            console.log(`[TrainingPayment] Initiating payment to URL: ${paymentApiUrl} with method: ${selectedPaymentMethod}`);

            const payload = {
                amount: TRAINING_FEE_USD,
                email: user.email,
                paymentMethod: selectedPaymentMethod,
                fullName: user.full_name, // Pass full name for KoraPay customer object
            };

            if (selectedPaymentMethod === 'korapay') {
                payload.mobileNumber = mobileNumber;
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
                showToast(`Failed to initiate payment: ${response.statusText}. Please check backend route.`, 'error');
                setLoading(false);
                setPaymentInitiated(false);
                return;
            }

            const data = await response.json();

            if (selectedPaymentMethod === 'paystack') {
                if (data.data?.authorization_url) {
                    showToast('Redirecting to payment gateway...', 'info');
                    window.location.href = data.data.authorization_url;
                } else {
                    showToast(data.error || 'Failed to initiate Paystack payment. Please try again.', 'error');
                    setLoading(false);
                    setPaymentInitiated(false);
                }
            } else if (selectedPaymentMethod === 'korapay') {
                if (data.korapayData && window.Korapay) {
                    const { key, reference, amount, currency, customer, notification_url } = data.korapayData;

                    window.Korapay.initialize({
                        key: key,
                        reference: reference,
                        amount: amount,
                        currency: currency || "NGN",
                        customer: customer,
                        notification_url: notification_url,
                        onClose: () => {
                            console.log("KoraPay modal closed.");
                            showToast("Payment cancelled by user.", "info");
                            setLoading(false);
                            setPaymentInitiated(false);
                        },
                        onSuccess: async (korapayResponse) => {
                            console.log("KoraPay payment successful:", korapayResponse);
                            showToast("Payment successful! Verifying...", "success");
                            
                            try {
                                const verifyResponse = await fetch(`${BACKEND_API_URL}/api/payment/verify-korapay-training`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ reference: korapayResponse.reference })
                                });

                                if (!verifyResponse.ok) {
                                    const errorText = await verifyResponse.text();
                                    console.error('[TrainingPayment] KoraPay verification failed:', verifyResponse.status, errorText);
                                    showToast(`Payment verification failed: ${verifyResponse.statusText}. Please contact support.`, 'error');
                                    setLoading(false);
                                    setPaymentInitiated(false);
                                    return;
                                }

                                const verifyData = await verifyResponse.json();
                                if (verifyData.success) {
                                    showToast("Payment successfully verified. Redirecting to dashboard!", "success");
                                    navigate('/trainee-dashboard');
                                } else {
                                    showToast(verifyData.error || "Payment verification failed. Please contact support.", "error");
                                    setLoading(false);
                                    setPaymentInitiated(false);
                                }

                            } catch (verifyError) {
                                console.error('Error during KoraPay verification:', verifyError);
                                showToast('Network error during payment verification. Please contact support.', 'error');
                                setLoading(false);
                                setPaymentInitiated(false);
                            }
                        },
                        onFailed: (korapayResponse) => {
                            console.error("KoraPay payment failed:", korapayResponse);
                            showToast("Payment failed. Please try again.", "error");
                            setLoading(false);
                            setPaymentInitiated(false);
                        }
                    });
                } else {
                    showToast(data.error || 'Failed to initialize KoraPay. Missing data or script not loaded.', 'error');
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
    }, [user, paymentInitiated, selectedPaymentMethod, mobileNumber, showToast, navigate]);


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
                                <label className="radio-label">
                                    <input
                                        type="radio"
                                        value="korapay"
                                        checked={selectedPaymentMethod === 'korapay'}
                                        onChange={() => setSelectedPaymentMethod('korapay')}
                                        disabled={loading || paymentInitiated}
                                    />
                                    KoraPay (Card, Bank Transfer, Mobile Money)
                                </label> {/* Corrected closing tag */}
                            </div>

                            {/* Mobile Number Input for KoraPay */}
                            {selectedPaymentMethod === 'korapay' && (
                                <div className="mobile-number-input">
                                    <label htmlFor="mobileNumber">Mobile Number for KoraPay:</label>
                                    <input
                                        type="text"
                                        id="mobileNumber"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        placeholder="e.g., 2547XXXXXXXX"
                                        disabled={loading || paymentInitiated}
                                        className="text-input-field"
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleInitiatePayment}
                                className="pay-now-btn"
                                disabled={loading || paymentInitiated || !selectedPaymentMethod || (selectedPaymentMethod === 'korapay' && !mobileNumber)}
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
