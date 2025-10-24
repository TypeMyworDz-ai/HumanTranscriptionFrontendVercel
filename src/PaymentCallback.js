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
        const jobType = searchParams.get('jobType'); // Our custom type (e.g., 'negotiation', 'training')

        if (!reference || !relatedJobId || !jobType) {
            setPaymentStatus('failed');
            setMessage('Invalid payment callback. Missing transaction reference, job ID, or job type.');
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

            try {
                // Pass relatedJobId and jobType to the backend for verification
                const response = await fetch(`${BACKEND_API_URL}/api/payment/verify/${reference}?relatedJobId=${relatedJobId}&jobType=${jobType}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    setPaymentStatus('success');
                    
                    if (jobType === 'training') {
                        // NEW: More universal message for training payment
                        const successMessage = 'Training payment successful! You will now be logged out and redirected to login to access your training dashboard.';
                        setMessage(successMessage);
                        showToast(successMessage, 'success');
                        
                        console.log("Payment successful. Refreshing user data and redirecting to login...");
                        
                        // CRITICAL FIX: Force a complete re-authentication by logging out
                        // This ensures all user data is fresh on next login
                        setTimeout(() => {
                            console.log("Logging out and redirecting to login page...");
                            logout();
                            setTimeout(() => {
                                navigate('/login');
                            }, 500);
                        }, 3000);
                    } else {
                        // NEW: Universal success message for other payments
                        const successMessage = 'Payment successful! You will be redirected to your dashboard.';
                        setMessage(successMessage);
                        showToast(successMessage, 'success');
                        // Automatically redirect for other job types
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

    // Removed handleManualLogout as it's now conditionally rendered and handled in useEffect
    // const handleManualLogout = () => {
    //     console.log("Manual logout and redirect to login...");
    //     logout();
    //     setTimeout(() => {
    //         navigate('/login');
    //     }, 500);
    // };

    // Determine if the "Logout and Login Again" button should be shown
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
                    {/* NEW: Conditionally render the button for training payments */}
                    {showLogoutAndLoginButton && (
                        <button 
                            onClick={() => { logout(); navigate('/login'); }} // Directly trigger logout and redirect
                            className="back-to-dashboard-btn"
                        >
                            Go to Login
                        </button>
                    )}
                    {paymentStatus === 'failed' && (
                        <Link to="/training-payment" className="back-to-dashboard-btn">
                            Try Again
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
