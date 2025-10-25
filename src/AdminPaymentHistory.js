// src/AdminPaymentHistory.js - UPDATED to display list of transcribers with total upcoming payouts
// IMPROVED: Styling for status badges in All Past Transactions table

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config';
import './AdminPaymentHistory.css';
import { Link, useNavigate } from 'react-router-dom';

const AdminPaymentHistory = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [allPayments, setAllPayments] = useState([]);
    const [transcriberPayoutSummary, setTranscriberPayoutSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const calculateTranscriberUpcomingPayouts = (paymentsData) => {
        const summary = {};

        paymentsData.forEach(payment => {
            if (payment.payout_status === 'awaiting_completion' && payment.transcriber_id && payment.transcriber_earning) {
                if (!summary[payment.transcriber_id]) {
                    summary[payment.transcriber_id] = {
                        id: payment.transcriber_id,
                        full_name: payment.transcriber?.full_name || 'Unknown Transcriber',
                        email: payment.transcriber?.email || 'N/A',
                        totalUpcoming: 0
                    };
                }
                summary[payment.transcriber_id].totalUpcoming += payment.transcriber_earning;
            }
        });

        return Object.values(summary).sort((a, b) => a.full_name.localeCompare(b.full_name));
    };

    const fetchAllPaymentHistory = useCallback(async () => {
        if (!user || user.user_type !== 'admin') {
            setError('Access denied. Only admins can view this page.');
            setLoading(false);
            navigate('/admin-dashboard');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/payments`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch payment history.');
            }

            const data = await response.json();
            setAllPayments(data);
            setTranscriberPayoutSummary(calculateTranscriberUpcomingPayouts(data));
        } catch (err) {
            console.error('Error fetching all payment history:', err);
            setError(err.message || 'Failed to load payment history.');
        } finally {
            setLoading(false);
        }
    }, [user, navigate]);

    useEffect(() => {
        fetchAllPaymentHistory();
    }, [fetchAllPaymentHistory]);

    const handleViewTranscriberPayouts = useCallback((transcriberId) => {
        navigate(`/admin/payments/transcriber/${transcriberId}`);
    }, [navigate]);


    if (loading) {
        return <div className="admin-payment-history-container">Loading payment history...</div>;
    }

    if (error) {
        return <div className="admin-payment-history-container error-message">Error: {error}</div>;
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Payment Management</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin-dashboard" className="back-link">← Back to Admin Dashboard</Link>
                </div>

                {/* NEW SECTION: Transcriber Upcoming Payouts */}
                <h2 style={{ marginBottom: '15px' }}>Transcriber Upcoming Payouts</h2>
                <p style={{ marginBottom: '20px', color: '#666' }}>Click on a transcriber to view and manage their individual upcoming payments.</p>
                {transcriberPayoutSummary.length === 0 ? (
                    <p className="no-data-message">No transcribers with upcoming payouts found.</p>
                ) : (
                    <div className="transcriber-payouts-summary-table-wrapper payment-history-table-wrapper">
                        <table className="transcriber-payouts-summary-table payment-history-table">
                            <thead>
                                <tr>
                                    <th>Transcriber Name</th>
                                    <th>Email</th>
                                    <th>Total Upcoming Payout (USD)</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transcriberPayoutSummary.map(transcriber => (
                                    <tr key={transcriber.id}>
                                        <td>{transcriber.full_name}</td>
                                        <td>{transcriber.email}</td>
                                        <td>USD {transcriber.totalUpcoming.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>
                                            <button 
                                                onClick={() => handleViewTranscriberPayouts(transcriber.id)}
                                                className="view-payout-btn"
                                            >
                                                View Payouts
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* EXISTING SECTION: All Past Transactions */}
                <h2 style={{ marginTop: '40px' }}>All Past Payment Transactions</h2>
                {allPayments.length === 0 ? (
                    <p className="no-data-message">No payment transactions found.</p>
                ) : (
                    <div className="payment-history-table-wrapper">
                        <table className="payment-history-table">
                            <thead>
                                <tr>
                                    <th>Payment ID</th>
                                    <th>Job Type</th>
                                    <th>Job ID</th> {/* NEW: Added Job ID column */}
                                    <th>Client Name</th>
                                    <th>Transcriber Name</th>
                                    <th>Amount Paid (USD)</th>
                                    <th>Transcriber Earning (USD)</th>
                                    <th>Reference</th>
                                    <th>Status</th>
                                    <th>Payout Status</th>
                                    <th>Transaction Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPayments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td>{payment.id?.substring(0, 8)}...</td>
                                        <td>{payment.related_job_type?.replace('_', ' ') || 'N/A'}</td>
                                        {/* NEW: Conditionally display job ID based on type */}
                                        <td>
                                            {payment.related_job_type === 'negotiation' && payment.negotiation_id?.substring(0, 8)}
                                            {payment.related_job_type === 'direct_upload' && payment.direct_upload_job_id?.substring(0, 8)}
                                            {payment.related_job_type === 'training' && payment.client_id?.substring(0, 8)}
                                            ...
                                        </td>
                                        <td>{payment.client?.full_name || (payment.related_job_type === 'training' ? payment.trainee_info?.full_name : 'N/A')}</td>
                                        <td>{payment.transcriber?.full_name || (payment.related_job_type === 'training' ? payment.trainee_info?.full_name : 'N/A')}</td>
                                        <td>USD {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>USD {payment.transcriber_earning?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</td>
                                        <td>{payment.paystack_reference}</td>
                                        {/* FIX: Apply status-badge class to both Status and Payout Status */}
                                        <td><span className={`status-badge ${payment.paystack_status}`}>{payment.paystack_status?.replace('_', ' ')}</span></td>
                                        <td><span className={`status-badge ${payment.payout_status}`}>{payment.payout_status?.replace('_', ' ')}</span></td>
                                        <td>{new Date(payment.transaction_date).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPaymentHistory;
