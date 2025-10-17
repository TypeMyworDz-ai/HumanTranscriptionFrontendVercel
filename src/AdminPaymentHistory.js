import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext'; // CORRECTED PATH
import { BACKEND_API_URL } from './config';
import './AdminPaymentHistory.css';

const AdminPaymentHistory = () => {
    const { user } = useAuth();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAllPaymentHistory = async () => {
            if (!user || user.userType !== 'admin') {
                setError('Access denied. Only admins can view this page.');
                setLoading(false);
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
        };

        fetchAllPaymentHistory();
    }, [user]);

    if (loading) {
        return <div className="admin-payment-history-container">Loading payment history...</div>;
    }

    if (error) {
        return <div className="admin-payment-history-container error-message">{error}</div>;
    }

    return (
        <div className="admin-payment-history-container">
            <h2>All Payment Transactions (Admin View)</h2>
            {payments.length === 0 ? (
                <p>No payment transactions found.</p>
            ) : (
                <div className="payment-history-table-wrapper">
                    <table className="payment-history-table">
                        <thead>
                            <tr>
                                <th>Payment ID</th>
                                <th>Client Name</th>
                                <th>Transcriber Name</th>
                                <th>Amount Paid (KES)</th>
                                <th>Transcriber Earning (KES)</th>
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
                                    <td>{payment.amount.toFixed(2)}</td>
                                    <td>{payment.transcriber_earning.toFixed(2)}</td>
                                    <td>{payment.paystack_reference}</td>
                                    <td>{payment.paystack_status}</td>
                                    <td>{new Date(payment.transaction_date).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminPaymentHistory;
