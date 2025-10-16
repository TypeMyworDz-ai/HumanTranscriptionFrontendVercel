// src/ClientPaymentHistory.js

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext';
import './ClientPaymentHistory.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientPaymentHistory = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({ totalPayments: 0, monthlyPayments: 0 });
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
                console.warn("ClientPaymentHistory: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/client/payments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                setPayments(data.payments || []);
                setSummary(data.summary || { totalPayments: 0, monthlyPayments: 0 });
                if (data.payments?.length === 0) {
                    showToast('No payment history found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load payment history.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching client payment history:', error);
            showToast('Network error while fetching payment history.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientPaymentHistory: Unauthorized access or not a client. Redirecting.");
            navigate('/'); // Redirect to home or login
            return;
        }

        fetchPaymentHistory();
    }, [isAuthenticated, authLoading, user, navigate, fetchPaymentHistory]);

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
                    <h1>Your Payment History</h1>
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
                            <h2>Overview of Your Payments</h2>
                            <p>Track all your payments made on the platform.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <div className="summary-cards-grid">
                        <div className="summary-card">
                            <h3>Total Payments</h3>
                            <p className="summary-value">KES {summary.totalPayments.toLocaleString()}</p>
                        </div>
                        <div className="summary-card">
                            <h3>This Month's Payments</h3>
                            <p className="summary-value">KES {summary.monthlyPayments.toLocaleString()}</p>
                        </div>
                        {/* Add more summary cards here (e.g., weekly, last 7 days) if your backend supports it */}
                    </div>

                    <h3>All Your Transactions</h3>
                    {payments.length === 0 ? (
                        <p className="no-data-message">No completed payment transactions found.</p>
                    ) : (
                        <div className="payments-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Negotiation ID</th>
                                        <th>Transcriber</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td>{new Date(payment.transaction_date).toLocaleDateString()}</td>
                                            <td>{payment.negotiation_id.substring(0, 8)}...</td>
                                            <td>{payment.transcriber?.full_name || 'N/A'}</td>
                                            <td>KES {payment.amount.toLocaleString()}</td>
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

export default ClientPaymentHistory;
