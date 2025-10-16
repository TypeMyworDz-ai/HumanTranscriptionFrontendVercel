// src/PaymentCallback.js

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './PaymentCallback.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAuthenticated, authLoading, logout } = useAuth();

    const [paymentStatus, setPaymentStatus] = useState('verifying'); // 'verifying', 'success', 'failed'
    const [message, setMessage] = useState('Verifying your payment...');
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = (msg, type = 'success') => setToast({ isVisible: true, message: msg, type });
    const hideToast = () => setToast((prev) => ({ ...prev, isVisible: false }));

    useEffect(() => {
        if (authLoading || !isAuthenticated) {
            // Wait for auth to be ready, or redirect if not authenticated
            if (authLoading === false && !isAuthenticated) {
                navigate('/login');
            }
            return;
        }

        const reference = searchParams.get('reference');
        const negotiationId = searchParams.get('negotiationId'); // Our custom negotiationId from metadata

        if (!reference || !negotiationId) {
            setPaymentStatus('failed');
            setMessage('Invalid payment callback. Missing reference or negotiation ID.');
            showToast('Invalid payment callback.', 'error');
            return;
        }

        const verifyPayment = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Authentication token missing. Please log in again.', 'error');
                logout();
                return;
            }

            try {
                const response = await fetch(`${BACKEND_API_URL}/api/payment/verify/${reference}?negotiationId=${negotiationId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    setPaymentStatus('success');
                    setMessage('Payment successful! Your job is now active.');
                    showToast('Payment successful!', 'success');
                    // Optionally, redirect to client dashboard after a short delay
                    setTimeout(() => navigate('/client-dashboard'), 3000);
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
    }, [searchParams, isAuthenticated, authLoading, navigate, logout]);

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

    return (
        <div className="payment-callback-container">
            <header className="payment-callback-header">
                <div className="header-content">
                    <h1>Payment Status</h1>
                    <div className="user-profile-actions">
                        {isAuthenticated && user && (
                            <>
                                <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                                <button onClick={logout} className="logout-btn">Logout</button>
                            </>
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
