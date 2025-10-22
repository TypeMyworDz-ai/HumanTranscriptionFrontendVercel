// src/PaymentCallback.js - FIXED: 'user' is not defined error and improved header rendering
// UPDATED: Correctly extract and pass relatedJobId, jobType, and reference for verification.
//          Dynamic messages and redirection based on jobType.

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './PaymentCallback.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, isAuthenticated, authLoading, logout } = useAuth(); // Destructure 'user' from useAuth() hook

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

        // NEW: Extract all relevant parameters from the URL
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
                // NEW: Pass relatedJobId and jobType to the backend for verification
                const response = await fetch(`${BACKEND_API_URL}/api/payment/verify/${reference}?relatedJobId=${relatedJobId}&jobType=${jobType}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    setPaymentStatus('success');
                    let successMessage = 'Payment successful!';
                    let redirectTo = '/client-dashboard'; // Default redirection

                    if (jobType === 'training') {
                        successMessage = 'Training payment successful! You now have access to the training dashboard.';
                        redirectTo = '/trainee-dashboard';
                    } else if (jobType === 'negotiation' || jobType === 'direct_upload') {
                        successMessage = 'Payment successful! Your job is now active.';
                        redirectTo = '/client-dashboard';
                    }
                    
                    setMessage(successMessage);
                    showToast(successMessage, 'success');
                    setTimeout(() => navigate(redirectTo), 3000);
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
    }, [searchParams, isAuthenticated, authLoading, navigate, logout, showToast, hideToast]); // Added showToast, hideToast to dependencies

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

    // NEW: Determine dynamic dashboard link for "Go to Dashboard" button
    const getDashboardLink = () => {
        if (user?.user_type === 'trainee') return '/trainee-dashboard';
        if (user?.user_type === 'client') return '/client-dashboard';
        if (user?.user_type === 'admin') return '/admin-dashboard'; // Although admin wouldn't typically be here
        return '/';
    };


    return (
        <div className="payment-callback-container">
            <header className="payment-callback-header">
                <div className="header-content">
                    <h1>Payment Status</h1>
                    <div className="user-profile-actions">
                        {/* Ensure user is authenticated and the user object exists before accessing properties */}
                        {isAuthenticated && user && (
                            <>
                                <span className="welcome-text-badge">Welcome, {user.full_name || 'User'}!</span>
                                <button onClick={logout} className="logout-btn">Logout</button>
                            </>
                        )}
                        {/* Show login if not authenticated and auth loading is complete */}
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
                    {paymentStatus !== 'verifying' && (
                        // NEW: Use dynamic dashboard link
                        <Link to={getDashboardLink()} className="back-to-dashboard-btn">
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
