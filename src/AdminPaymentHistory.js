// src/AdminPaymentHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config';
import './AdminPaymentHistory.css';
import { Link } from 'react-router-dom'; // Import Link for navigation

const AdminPaymentHistory = () => {
    const { user, logout } = useAuth(); // Destructure logout as well
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllPaymentHistory = useCallback(async () => {
        if (!user || user.user_type !== 'admin') {
            setError('Access denied. Only admins can view this page.');
            setLoading(false);
            // Optionally redirect if not admin
            // navigate('/admin-dashboard'); 
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
            setPayments(data);
        } catch (err) {
            console.error('Error fetching all payment history:', err);
            setError(err.message || 'Failed to load payment history.');
        } finally {
            setLoading(false);
        }
    }, [user]); // 'logout' removed from dependencies

    useEffect(() => {
        fetchAllPaymentHistory();
    }, [fetchAllPaymentHistory]);

    if (loading) {
        return <div className="admin-payment-history-container">Loading payment history...</div>;
    }

    if (error) {
        return <div className="admin-payment-history-container error-message">{error}</div>;
    }

    return (
        <div className="admin-payment-history-container">
            <header className="admin-management-header"> {/* Reusing admin-management-header for consistency */}
                <div className="header-content">
                    <h1>Payment History</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main"> {/* Reusing admin-management-main for consistency */}
                <div className="back-link-container">
                    <Link to="/admin-dashboard" className="back-link">← Back to Admin Dashboard</Link>
                </div>

                <h2>All Payment Transactions (Admin View)</h2>
                {payments.length === 0 ? (
                    <p className="no-data-message">No payment transactions found.</p>
                ) : (
                    <div className="payment-history-table-wrapper">
                        <table className="payment-history-table">
                            <thead>
                                <tr>
                                    <th>Payment ID</th>
                                    <th>Client Name</th>
                                    <th>Transcriber Name</th>
                                    <th>Amount Paid (USD)</th>
                                    <th>Transcriber Earning (USD)</th>
                                    <th>Reference</th>
                                    <th>Status</th>
                                    <th>Transaction Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td>{payment.id}</td>
                                        <td>{payment.client?.full_name || 'N/A'}</td>
                                        <td>{payment.transcriber?.full_name || 'N/A'}</td>
                                        <td>USD {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>USD {payment.transcriber_earning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td>{payment.paystack_reference}</td>
                                        <td><span className={`status-badge ${payment.paystack_status}`}>{payment.paystack_status.replace('_', ' ')}</span></td> {/* Added status badge */}
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
