import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import Modal from './Modal';
import './AdminManagement.css';
import './TranscriberPaymentHistory.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminTranscriberPayouts = () => {
    const { transcriberId } = useParams();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [transcriberName, setTranscriberName] = useState('Loading...');
    const [upcomingPayouts, setUpcomingPayouts] = useState([]);
    const [totalUpcomingPayouts, setTotalUpcomingPayouts] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [paymentToMarkPaid, setPaymentToMarkPaid] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchTranscriberPayouts = useCallback(async () => {
        if (!user || user.user_type !== 'admin') {
            setError('Access denied. Only admins can view this page.');
            setLoading(false);
            navigate('/admin-dashboard');
            return;
        }
        if (!transcriberId) {
            setError('Transcriber ID is missing.');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch transcriber details
            const transcriberResponse = await fetch(`${BACKEND_API_URL}/api/users/${transcriberId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            // FIX: Corrected typo from 'transcriscriberResponse' to 'transcriberResponse'
            const transcriberData = await transcriberResponse.json(); 
            if (transcriberResponse.ok && transcriberData.user) {
                setTranscriberName(transcriberData.user.full_name);
            } else {
                showToast(transcriberData.error || 'Failed to fetch transcriber details.', 'error');
                setError('Failed to load transcriber details.');
                setLoading(false);
                return;
            }

            // Fetch upcoming payouts
            const paymentsResponse = await fetch(`${BACKEND_API_URL}/api/admin/transcriber/${transcriberId}/upcoming-payouts`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const paymentsData = await paymentsResponse.json();

            if (paymentsResponse.ok) {
                setUpcomingPayouts(paymentsData.upcomingPayouts || []);
                setTotalUpcomingPayouts(paymentsData.totalUpcomingPayouts || 0);
            } else {
                showToast(paymentsData.error || 'Failed to load upcoming payouts.', 'error');
                setError('Failed to load upcoming payouts.');
            }
        } catch (err) {
            console.error('Error fetching transcriber payouts:', err);
            setError(err.message || 'Failed to load payouts.');
        } finally {
            setLoading(false);
        }
    }, [user, transcriberId, navigate, showToast]);

    useEffect(() => {
        fetchTranscriberPayouts();
    }, [fetchTranscriberPayouts]);

    const openMarkPaidModal = useCallback((payment) => {
        setPaymentToMarkPaid(payment);
        setShowMarkPaidModal(true);
    }, []);

    const closeMarkPaidModal = useCallback(() => {
        setShowMarkPaidModal(false);
        setPaymentToMarkPaid(null);
        setModalLoading(false);
    }, []);

    const confirmMarkAsPaid = useCallback(async () => {
        if (!paymentToMarkPaid?.id) {
            showToast('No payment selected to mark as paid.', 'error');
            return;
        }

        setModalLoading(true);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/payments/${paymentToMarkPaid.id}/mark-paid`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Payment marked as paid successfully!', 'success');
                closeMarkPaidModal();
                fetchTranscriberPayouts(); // Refresh the list
            } else {
                showToast(data.error || 'Failed to mark payment as paid.', 'error');
            }
        } catch (err) {
            console.error('Error marking payment as paid:', err);
            showToast('Network error marking payment as paid.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [paymentToMarkPaid, showToast, closeMarkPaidModal, fetchTranscriberPayouts]);


    if (loading) {
        return <div className="admin-management-container">Loading transcriber payouts...</div>;
    }

    if (error) {
        return <div className="admin-management-container error-message">Error: {error}</div>;
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Payouts: {transcriberName}</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin/payments" className="back-link">← Back to Payment Management</Link>
                </div>

                <h2 style={{ marginBottom: '15px' }}>Upcoming Payouts for {transcriberName}</h2>
                <div className="summary-cards-grid">
                    <div className="summary-card">
                        <h3>Total Upcoming Payout</h3>
                        <p className="summary-value">USD {totalUpcomingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {upcomingPayouts.length === 0 ? (
                    <p className="no-data-message">No upcoming payouts for {transcriberName}.</p>
                ) : (
                    <div className="upcoming-payouts-table-container payments-table-container">
                        {upcomingPayouts.map(week => (
                            <div key={week.date} className="weekly-payout-group">
                                <h4>Week Ending: {week.date} (Total: USD {week.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</h4>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Payment ID</th>
                                            <th>Job ID</th>
                                            <th>Client</th>
                                            <th>Requirements</th>
                                            <th>Your Earning</th>
                                            <th>Status</th>
                                            <th>Transaction Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {week.payouts.map(payout => (
                                            <tr key={payout.id}>
                                                <td>{payout.id?.substring(0, 8)}...</td>
                                                <td>{payout.related_job_id ? payout.related_job_id.substring(0, 8) + '...' : 'N/A'}</td>
                                                <td>{payout.clientName || 'N/A'}</td>
                                                <td>{payout.jobRequirements ? payout.jobRequirements.substring(0, 50) + '...' : 'N/A'}</td>
                                                <td>USD {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td><span className={`status-badge ${payout.status}`}>{payout.status?.replace('_', ' ')}</span></td>
                                                <td>{payout.created_at}</td>
                                                <td>
                                                    <button 
                                                        onClick={() => openMarkPaidModal(payout)}
                                                        className="mark-paid-btn"
                                                        disabled={modalLoading}
                                                    >
                                                        Mark Paid
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showMarkPaidModal && paymentToMarkPaid && (
                <Modal
                    show={showMarkPaidModal}
                    title={`Mark Payment as Paid: ${paymentToMarkPaid.id?.substring(0, 8)}...`}
                    onClose={closeMarkPaidModal}
                    onSubmit={confirmMarkAsPaid}
                    submitText="Confirm Paid"
                    loading={modalLoading}
                    submitButtonClass="complete-training-confirm-btn"
                >
                    <p>Are you sure you want to mark this payment as 'Paid Out'?</p>
                    <p>This action will disburse USD {paymentToMarkPaid.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to {transcriberName}.</p>
                    <p className="modal-warning">This action cannot be undone.</p>
                </Modal>
            )}

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

export default AdminTranscriberPayouts;
