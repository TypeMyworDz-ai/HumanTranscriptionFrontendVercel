// src/TranscriberPaymentHistory.js - UPDATED to display 80% Transcriber Pay and Upcoming Payouts

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './TranscriberPaymentHistory.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberPaymentHistory = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [payments, setPayments] = useState([]);
    const [upcomingPayouts, setUpcomingPayouts] = useState([]); // NEW: State for upcoming payouts
    const [summary, setSummary] = useState({ totalEarnings: 0, monthlyEarnings: 0 });
    const [totalUpcomingPayouts, setTotalUpcomingPayouts] = useState(0); // NEW: Total for upcoming payouts
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchPaymentHistory = useCallback(async () => {
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
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/payments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                setPayments(data.payments || []);
                setSummary(data.summary || { totalEarnings: 0, monthlyEarnings: 0 });
                if (data.payments?.length === 0) {
                    showToast('No payment history found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load payment history.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching payment history:', error);
            showToast('Network error while fetching payment history.', 'error');
        } finally {
            // setLoading(false); // Will be set by fetchUpcomingPayouts
        }
    }, [isAuthenticated, logout, showToast]);

    // NEW: Function to fetch upcoming payouts
    const fetchUpcomingPayouts = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("TranscriberPaymentHistory: Token missing for upcoming payouts. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/payouts/upcoming`, { // NEW API endpoint
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                setUpcomingPayouts(data.upcomingPayouts || []);
                setTotalUpcomingPayouts(data.totalUpcomingPayouts || 0);
            } else {
                showToast(data.error || 'Failed to load upcoming payouts.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching upcoming payouts:', error);
            showToast('Network error while fetching upcoming payouts.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn("TranscriberPaymentHistory: Unauthorized access or not a transcriber. Redirecting.");
            navigate('/'); // Redirect to home or login
            return;
        }

        // Fetch both payment history and upcoming payouts
        Promise.all([
            fetchPaymentHistory(),
            fetchUpcomingPayouts()
        ]).finally(() => {
            setLoading(false);
        });
    }, [isAuthenticated, authLoading, user, navigate, fetchPaymentHistory, fetchUpcomingPayouts]);

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
                        <div className="header-text">
                            <h2>Your Earnings Overview</h2>
                            <p>Track all your completed jobs and earnings on the platform.</p>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <div className="summary-cards-grid">
                        <div className="summary-card">
                            <h3>Total Earnings</h3>
                            <p className="summary-value">KES {summary.totalEarnings.toLocaleString()}</p>
                        </div>
                        <div className="summary-card">
                            <h3>This Month's Earnings</h3>
                            <p className="summary-value">KES {summary.monthlyEarnings.toLocaleString()}</p>
                        </div>
                        <div className="summary-card"> {/* NEW: Card for Total Upcoming Payouts */}
                            <h3>Total Upcoming Payouts</h3>
                            <p className="summary-value">KES {totalUpcomingPayouts.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* NEW: Upcoming Payments Table */}
                    <h3 style={{ marginTop: '30px' }}>Upcoming Payouts ({totalUpcomingPayouts.toLocaleString()})</h3>
                    {upcomingPayouts.length === 0 ? (
                        <p className="no-data-message">No upcoming payouts found.</p>
                    ) : (
                        <div className="upcoming-payouts-table-container payments-table-container"> {/* Reused payments-table-container for styling */}
                            {upcomingPayouts.map(week => (
                                <div key={week.date} className="weekly-payout-group">
                                    <h4>Week Ending: {week.date} (Total: KES {week.totalAmount.toLocaleString()})</h4>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Job ID</th>
                                                <th>Client</th>
                                                <th>Requirements</th>
                                                <th>Your Earning</th>
                                                <th>Status</th>
                                                <th>Created On</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {week.payouts.map(payout => (
                                                <tr key={payout.id}>
                                                    <td>{payout.negotiation_id.substring(0, 8)}...</td>
                                                    <td>{payout.clientName}</td>
                                                    <td>{payout.jobRequirements.substring(0, 50)}...</td>
                                                    <td>KES {payout.amount.toLocaleString()}</td>
                                                    <td><span className={`status-badge ${payout.status}`}>{payout.status}</span></td>
                                                    <td>{payout.created_at}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}


                    <h3 style={{ marginTop: '30px' }}>All Past Transactions</h3> {/* Adjusted margin */}
                    {payments.length === 0 ? (
                        <p className="no-data-message">No completed payment transactions found.</p>
                    ) : (
                        <div className="payments-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Negotiation ID</th>
                                        <th>Client</th>
                                        <th>Your Pay (80%)</th> {/* UPDATED: Column header */}
                                        <th>Status</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td>{new Date(payment.transaction_date).toLocaleDateString()}</td>
                                            <td>{payment.negotiation_id.substring(0, 8)}...</td>
                                            <td>{payment.client?.full_name || 'N/A'}</td>
                                            <td>KES {payment.transcriber_earning.toLocaleString()}</td> {/* UPDATED: Display transcriber_earning */}
                                            <td>{payment.paystack_status}</td>
                                            <td>{payment.negotiation?.requirements?.substring(0, 50)}...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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
