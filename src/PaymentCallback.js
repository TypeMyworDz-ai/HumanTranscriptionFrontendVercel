// src/PaymentCallback.js - Updated to redirect to login after successful payment

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './PaymentCallback.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, isAuthenticated, authLoading, logout } = useAuth();

    const [paymentStatus, setPaymentStatus] = useState('verifying'); // 'verifying', 'success', 'failed'
    const [message, setMessage] = useState('Verifying your payment...');
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((msg, type = 'success') => setToast({ isVisible: true, message: msg, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    useEffect(() => {
        // Only proceed if authentication state is resolved
        if (authLoading) {
            return; // Still loading auth, do nothing
        }

        if (!isAuthenticated) {
            // If auth is resolved and user is not authenticated, redirect to login
            navigate('/login');
            return;
        }

        // Extract all relevant parameters from the URL
        const reference = searchParams.get('reference'); // Paystack's transaction reference
        const relatedJobId = searchParams.get('relatedJobId'); // Our custom ID (negotiationId or traineeId)
        const jobType = searchParams.get('jobType'); // Our custom type (e.g., 'negotiation', 'training', 'direct_upload')
        const paymentMethod = searchParams.get('paymentMethod') || 'paystack'; // NEW: Get paymentMethod, default to paystack

        // Handle payment cancellation explicitly
        if (!reference) {
            setPaymentStatus('failed');
            setMessage('Payment was cancelled or not completed. Redirecting...');
            showToast('Payment cancelled or not completed.', 'error');

            // Redirect based on jobType
            if (jobType === 'training') {
                setTimeout(() => navigate('/training-payment'), 3000); // Redirect to training payment page
            } else {
                setTimeout(() => navigate('/client-dashboard'), 3000); // Redirect to client dashboard for other job types
            }
            return; // Stop further execution in this useEffect
        }

        if (!relatedJobId || !jobType) {
            setPaymentStatus('failed');
            setMessage('Invalid payment callback. Missing job ID or job type.');
            showToast('Invalid payment callback.', 'error');
            return;
        }

        const verifyPayment = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Authentication token missing. Please log in again.', 'error');
                logout(); // Log out if token is missing despite isAuthenticated
                return;
            }

            let verificationApiUrl;
            let method = 'GET'; // Default for Paystack verification
            let body = null;

            // Dynamically construct the verification URL based on jobType and paymentMethod
            if (jobType === 'training') {
                if (paymentMethod === 'korapay') {
                    verificationApiUrl = `${BACKEND_API_URL}/api/training/payment/verify-korapay`;
                    method = 'POST'; // KoraPay verification is a POST request
                    body = JSON.stringify({ reference: reference });
                } else { // Assume Paystack for training
                    verificationApiUrl = `${BACKEND_API_URL}/api/training/payment/verify/${reference}?relatedJobId=${relatedJobId}&paymentMethod=${paymentMethod}`;
                }
            } else if (jobType === 'negotiation') {
                verificationApiUrl = `${BACKEND_API_URL}/api/negotiations/${relatedJobId}/payment/verify/${reference}?paymentMethod=${paymentMethod}`;
            } else if (jobType === 'direct_upload') {
                verificationApiUrl = `${BACKEND_API_URL}/api/direct-uploads/${relatedJobId}/payment/verify/${reference}?paymentMethod=${paymentMethod}`;
            } else {
                setPaymentStatus('failed');
                setMessage('Unknown job type for payment verification.');
                showToast('Unknown job type.', 'error');
                return;
            }

            try {
                const response = await fetch(verificationApiUrl, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: body
                });
                const data = await response.json();

                if (response.ok) {
                    setPaymentStatus('success');

                    if (jobType === 'training') {
                        const successMessage = 'Training payment successful! You will now be logged out and redirected to login to access your training dashboard.';
                        setMessage(successMessage);
                        showToast(successMessage, 'success');

                        console.log("Payment successful. Refreshing user data and redirecting to login...");

                        setTimeout(() => {
                            console.log("Logging out and redirecting to login page...");
                            logout();
                            setTimeout(() => {
                                navigate('/login');
                            }, 500);
                        }, 3000);
                    } else {
                        const successMessage = 'Payment successful! You will be redirected to your dashboard.';
                        setMessage(successMessage);
                        showToast(successMessage, 'success');
                        setTimeout(() => navigate('/client-dashboard'), 3000);
                    }
                } else {
                    setPaymentStatus('failed');
                    setMessage(data.error || 'Payment verification failed.');
                    showToast(data.error || 'Payment failed!', 'error');
                }
            } catch (error) {
                console.error('Error verifying payment:', error);
                setPaymentStatus('failed');
                setMessage('Network error during payment verification.');
                showToast('Network error during payment verification.', 'error');
            }
        };

        verifyPayment();
    }, [searchParams, isAuthenticated, authLoading, navigate, logout, showToast]);

    const getStatusIcon = () => {
        if (paymentStatus === 'verifying') return '⏳';
        if (paymentStatus === 'success') return '✅';
        if (paymentStatus === 'failed') return '❌';
        return '';
    };

    const getStatusClass = () => {
        if (paymentStatus === 'verifying') return 'verifying-status';
        if (paymentStatus === 'success') return 'success-status';
        if (paymentStatus === 'failed') return 'failed-status';
        return '';
    };

    const relatedJobType = searchParams.get('jobType');
    const showLogoutAndLoginButton = paymentStatus === 'success' && relatedJobType === 'training';


    return (
        <div className="payment-callback-container">
            <header className="payment-callback-header">
                <div className="header-content">
                    <h1>Payment Status</h1>
                    <div className="user-profile-actions">
                        {isAuthenticated && user && (
                            <>
                                <span className="welcome-text-badge">Welcome, {user.full_name || 'User'}!</span>
                                <button onClick={logout} className="logout-btn">Logout</button>
                            </>
                        )}
                        {!isAuthenticated && !authLoading && (
                            <Link to="/login" className="back-to-dashboard-btn">Login</Link>
                        )}
                    </div>
                </div>
            </header>
            <main className="payment-callback-main">
                <div className="status-card">
                    <div className={`status-icon ${getStatusClass()}`}>
                        {getStatusIcon()}
                    </div>
                    <h2 className={getStatusClass()}>{message}</h2>
                    {paymentStatus === 'failed' && (
                        <p>If you believe this is an error, please contact support.</p>
                    )}
                    {showLogoutAndLoginButton && (
                        <button
                            onClick={() => { logout(); navigate('/login'); }}
                            className="back-to-dashboard-btn"
                        >
                            Go to Login
                        </button>
                    )}
                    {paymentStatus === 'failed' && relatedJobType === 'training' && ( // Only show "Try Again" for training payment failures
                        <Link to="/training-payment" className="back-to-dashboard-btn">
                            Try Again
                        </Link>
                    )}
                    {paymentStatus === 'failed' && relatedJobType !== 'training' && ( // For other job types, go to client dashboard
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            Go to Dashboard
                        </Link>
                    )}
                </div>
            </main>
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
                duration={toast.type === 'error' ? 5000 : 3000}
            />
        </div>
    );
};

export default PaymentCallback;
