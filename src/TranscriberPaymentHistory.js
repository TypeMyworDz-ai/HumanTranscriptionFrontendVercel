// src/TranscriberPaymentHistory.js - UPDATED to display only two summary cards
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; 
import { useAuth } from './contexts/AuthContext';
import './TranscriberPaymentHistory.css'; 

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberPaymentHistory = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    // State to hold only the summary values for the cards
    const [totalEarned, setTotalEarned] = useState(0);
    const [upcomingPayout, setUpcomingPayout] = useState(0); // Renamed from totalUpcomingPayouts for clarity
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchTranscriberPayouts = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("TranscriberPaymentHistory: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // This endpoint now returns separated completed and upcoming payments
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/payments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                // Set summary values directly for the cards
                setTotalEarned(data.summary?.totalEarned || 0);
                setUpcomingPayout(data.summary?.upcomingPayout || 0);

                if (data.summary?.totalEarned === 0 && data.summary?.upcomingPayout === 0) {
                    showToast('No payment history or upcoming payouts found yet.', 'info');
                } else if (data.summary?.upcomingPayout === 0 && data.summary?.totalEarned > 0) {
                    showToast('No upcoming payouts found, but you have past earnings.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load payment history.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching payment history:', error);
            showToast('Network error while fetching payment history.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn("TranscriberPaymentHistory: Unauthorized access or not a transcriber. Redirecting.");
            navigate('/'); 
            return;
        }

        fetchTranscriberPayouts();
        
    }, [isAuthenticated, authLoading, user, navigate, fetchTranscriberPayouts]);

    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="payment-history-container">
                <div className="loading-spinner">Loading payment history...</div>
            </div>
        );
    }

    return (
        <div className="payment-history-container">
            <header className="payment-history-header">
                <div className="header-content">
                    <h1>Payment History</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="payment-history-main">
                <div className="payment-history-content">
                    <div className="page-header">
                        <h2 className="header-text">Your Earnings Overview</h2>
                        <p>Track all your completed jobs and earnings on the platform.</p>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <div className="summary-cards-grid">
                        <div className="summary-card">
                            <h3>Total Earned</h3> {/* Updated label */}
                            <p className="summary-value">USD {totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="summary-card">
                            <h3>Upcoming Payout</h3> {/* Updated label */}
                            <p className="summary-value">USD {upcomingPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* REMOVED: All table rendering logic for upcoming payouts and past transactions */}
                    {/* The detailed tables are removed as per requirement */}
                </div>
            </main>

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
                duration={toast.type === 'success' ? 2000 : 4000}
            />
        </div>
    );
};

export default TranscriberPaymentHistory;
