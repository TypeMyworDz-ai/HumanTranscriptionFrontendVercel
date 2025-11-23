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
    // Removed 'updateUser' and 'checkAuth' as they are not directly used in this component
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

        // Redirect to login if auth is resolved and user is not authenticated
        // This handles cases where the callback might happen after a session expires
        if (!isAuthenticated) {
            console.warn("PaymentCallback: User not authenticated. Redirecting to login.");
            navigate('/login');
            return;
        }

        // Extract all relevant parameters from the URL
        const reference = searchParams.get('reference'); // Paystack's transaction reference (also for KoraPay GET)
        const relatedJobId = searchParams.get('relatedJobId'); // Our custom ID (negotiationId, traineeId, or directUploadJobId)
        const jobType = searchParams.get('jobType'); // Our custom type (e.g., 'negotiation', 'training', 'direct_upload')
        const paymentMethod = searchParams.get('paymentMethod') || 'paystack'; // Get paymentMethod, default to paystack

        // Determine the redirect path for failed/cancelled payments
        let redirectPathOnFailure = '/client-dashboard'; // Default redirect
        if (jobType === 'training') {
            redirectPathOnFailure = '/training-payment';
        } else if (jobType === 'direct_upload') {
            redirectPathOnFailure = '/client-direct-upload';
        } else if (jobType === 'negotiation') {
            redirectPathOnFailure = '/client-negotiations';
        }

        // Handle payment cancellation explicitly or missing parameters
        if (!reference || !relatedJobId || !jobType) {
            setPaymentStatus('failed');
            setMessage('Payment was cancelled or an error occurred. Redirecting you to the relevant page...');
            showToast('Payment cancelled or incomplete.', 'error');
            setTimeout(() => navigate(redirectPathOnFailure), 3000);
            return; // Stop further execution in this useEffect
        }

        const verifyPayment = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Authentication token missing. Please log in again.', 'error');
                logout(); // Log out if token is missing despite isAuthenticated
                return;
            }

            let verificationApiUrl;
            let method = 'GET'; // Default for Paystack verification and KoraPay GET verification
            let body = null;

            // Dynamically construct the verification URL and method based on jobType and paymentMethod
            if (jobType === 'training') {
                if (paymentMethod === 'korapay') {
                    verificationApiUrl = `${BACKEND_API_URL}/api/training/payment/verify-korapay`;
                    method = 'POST'; // KoraPay training verification is a POST request
                    body = JSON.stringify({ reference: reference });
                } else { // Assume Paystack for training
                    verificationApiUrl = `${BACKEND_API_URL}/api/training/payment/verify/${reference}?relatedJobId=${relatedJobId}&paymentMethod=${paymentMethod}`;
                }
            } else if (jobType === 'negotiation') {
                // Backend's verifyNegotiationPayment expects GET with reference in params
                verificationApiUrl = `${BACKEND_API_URL}/api/negotiations/${relatedJobId}/payment/verify/${reference}?paymentMethod=${paymentMethod}`;
            } else if (jobType === 'direct_upload') {
                if (paymentMethod === 'korapay') {
                    // KoraPay direct upload verification should use POST and a dedicated endpoint or handle POST at unified endpoint
                    // Assuming a similar pattern to training payment verification for KoraPay
                    verificationApiUrl = `${BACKEND_API_URL}/api/direct-uploads/payment/verify-korapay`;
                    method = 'POST';
                    body = JSON.stringify({ reference: reference, relatedJobId: relatedJobId }); // Include relatedJobId in body for KoraPay POST
                } else { // Assume Paystack for direct upload, which expects GET
                    verificationApiUrl = `${BACKEND_API_URL}/api/direct-uploads/${relatedJobId}/payment/verify/${reference}?paymentMethod=${paymentMethod}`;
                }
            } else {
                setPaymentStatus('failed');
                setMessage('Unknown job type for payment verification. Redirecting...');
                showToast('Unknown job type for verification.', 'error');
                setTimeout(() => navigate(redirectPathOnFailure), 3000);
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

                        console.log("Payment successful. Redirecting to login...");

                        // Logout user and redirect to login page for training payments
                        setTimeout(() => {
                            logout(); // Clear local storage and reset auth context
                            setTimeout(() => {
                                navigate('/login');
                            }, 500); // Small delay to ensure logout completes before navigation
                        }, 3000);
                    } else {
                        const successMessage = 'Payment successful! You will be redirected to your dashboard.';
                        setMessage(successMessage);
                        showToast(successMessage, 'success');
                        // For other job types, assume user remains logged in and goes to dashboard
                        setTimeout(() => navigate('/client-dashboard'), 3000);
                    }
                } else {
                    setPaymentStatus('failed');
                    setMessage(data.error || 'Payment verification failed. Please try again.');
                    showToast(data.error || 'Payment failed!', 'error');
                    setTimeout(() => navigate(redirectPathOnFailure), 3000); // Redirect on failed verification
                }
            } catch (error) {
                console.error('Error verifying payment:', error);
                setPaymentStatus('failed');
                setMessage('Network error during payment verification. Please check your internet connection and try again.');
                showToast('Network error during payment verification.', 'error');
                setTimeout(() => navigate(redirectPathOnFailure), 3000); // Redirect on network error
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
