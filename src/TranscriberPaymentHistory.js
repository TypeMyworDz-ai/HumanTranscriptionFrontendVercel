// src/TranscriberPaymentHistory.js - UPDATED to display USD currency, Upcoming Payouts, and job status
// REMOVED: All Past Transactions table
// FIXED: Upcoming payouts now correctly displayed and grouped by week

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './TranscriberPaymentHistory.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberPaymentHistory = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    // Removed 'payments' state as 'All Past Transactions' table is removed
    const [upcomingPayouts, setUpcomingPayouts] = useState([]);
    const [summary, setSummary] = useState({ totalEarnings: 0, monthlyEarnings: 0 }); // Summary now reflects total paid earnings
    const [totalUpcomingPayouts, setTotalUpcomingPayouts] = useState(0);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchTranscriberPayouts = useCallback(async () => { // Renamed from fetchPaymentHistory for clarity
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
                // No longer setting 'payments' state for a separate table
                setSummary(data.summary || { totalEarnings: 0, monthlyEarnings: 0 });
                
                // Set upcoming payouts from the new data property
                setUpcomingPayouts(data.upcomingPayouts || []);
                setTotalUpcomingPayouts(data.totalUpcomingPayouts || 0);

                // Adjust toast message based on available data
                if (data.payments?.length === 0 && data.upcomingPayouts?.length === 0) {
                    showToast('No payment history or upcoming payouts found yet.', 'info');
                } else if (data.upcomingPayouts?.length === 0 && data.payments?.length > 0) {
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
            navigate('/'); // Redirect to home or login
            return;
        }

        // Only call fetchTranscriberPayouts
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
                            <h3>Total Earnings</h3>
                            <p className="summary-value">USD {summary.totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="summary-card">
                            <h3>This Month's Earnings</h3>
                            <p className="summary-value">USD {summary.monthlyEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="summary-card">
                            <h3>Total Upcoming Payouts</h3>
                            <p className="summary-value">USD {totalUpcomingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* NEW: Upcoming Payments Table */}
                    <h3 style={{ marginTop: '30px' }}>Upcoming Payouts (USD {totalUpcomingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</h3>
                    {upcomingPayouts.length === 0 ? (
                        <p className="no-data-message">No upcoming payouts found for the current week.</p>
                    ) : (
                        <div className="upcoming-payouts-table-container payments-table-container">
                            {upcomingPayouts.map(week => (
                                <div key={week.date} className="weekly-payout-group">
                                    <h4>Week Ending: {week.date} (Total: USD {week.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</h4>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Job Type</th> {/* NEW: Added Job Type column */}
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
                                                    <td>{payout.related_job_type?.replace('_', ' ') || 'N/A'}</td> {/* Display job type */}
                                                    {/* Conditionally display job ID based on type */}
                                                    <td>
                                                        {payout.related_job_type === 'negotiation' && payout.negotiation_id?.substring(0, 8)}
                                                        {payout.related_job_type === 'direct_upload' && payout.direct_upload_job_id?.substring(0, 8)}
                                                        {payout.related_job_type === 'training' && payout.client_id?.substring(0, 8)} {/* For training, client_id is the relevant ID */}
                                                        ...
                                                    </td>
                                                    <td>{payout.clientName || 'N/A'}</td>
                                                    <td>{payout.jobRequirements ? payout.jobRequirements.substring(0, 50) + '...' : 'N/A'}</td>
                                                    <td>USD {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td>
                                                        {/* FIXED: Display "Completed (Awaiting Payout)" if job_status is completed */}
                                                        <span className={`status-badge ${payout.job_status === 'completed' ? 'completed' : payout.status}`}>
                                                            {payout.job_status === 'completed' && payout.status === 'awaiting_completion'
                                                                ? 'Completed (Awaiting Payout)'
                                                                : payout.status?.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td>{payout.created_at}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* REMOVED: All Past Transactions table */}
                    {/*
                    <h3>All Past Transactions</h3>
                    {payments.length === 0 ? (
                        <p className="no-data-message">No completed payment transactions found.</p>
                    ) : (
                        <div className="payments-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Job ID</th>
                                        <th>Client</th>
                                        <th>Your Pay (80%)</th>
                                        <th>Status</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td>${new Date(payment.transaction_date).toLocaleDateString()}</td>
                                            <td>${payment.related_job_id ? payment.related_job_id.substring(0, 8) + '...' : 'N/A'}</td>
                                            <td>${payment.client?.full_name || 'N/A'}</td>
                                            <td>USD ${payment.transcriber_earning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td><span className={`status-badge ${payment.paystack_status}`}>${payment.paystack_status?.replace('_', ' ')}</span></td>
                                            <td>
                                                ${payment.related_job_type === 'negotiation' && payment.negotiation?.requirements ?
                                                    payment.negotiation.requirements.substring(0, 50) + '...' :
                                                payment.related_job_type === 'direct_upload' && payment.direct_upload_job?.client_instructions ?
                                                    payment.direct_upload_job.client_instructions.substring(0, 50) + '...' :
                                                'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    */}
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
