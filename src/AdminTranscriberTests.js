// frontend/client/src/AdminTranscriberTests.js - COMPLETE AND UPDATED for Vercel deployment

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Link } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import './AdminManagement.css';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminTranscriberTests = () => {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState([]);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchSubmissions = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/admin/transcriber-tests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setSubmissions(data.submissions);
            } else {
                showToast(data.error || 'Failed to fetch test submissions.', 'error');
            }
        } catch (error) {
            console.error('Error fetching test submissions:', error);
            showToast('Network error fetching test submissions.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const approveSubmission = useCallback(async () => {
        if (!selectedSubmission) return;
        setModalLoading(true);
        const token = localStorage.getItem('token');
        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/admin/transcriber-tests/${selectedSubmission.id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ transcriberId: selectedSubmission.user_id })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Test approved successfully!', 'success');
                fetchSubmissions();
                setShowApproveModal(false);
                setSelectedSubmission(null);
            } else {
                showToast(data.error || 'Failed to approve test.', 'error');
            }
        } catch (error) {
            console.error('Error approving test:', error);
            showToast('Network error approving test.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedSubmission, fetchSubmissions, showToast]);

    const rejectSubmission = useCallback(async () => {
        if (!selectedSubmission) return;
        setModalLoading(true);
        const token = localStorage.getItem('token');
        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/admin/transcriber-tests/${selectedSubmission.id}/reject`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ transcriberId: selectedSubmission.user_id, reason: rejectionReason })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Test rejected successfully!', 'success');
                fetchSubmissions();
                setShowRejectModal(false);
                setSelectedSubmission(null);
                setRejectionReason('');
            } else {
                showToast(data.error || 'Failed to reject test.', 'error');
            }
        } catch (error) {
            console.error('Error rejecting test:', error);
            showToast('Network error rejecting test.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedSubmission, rejectionReason, fetchSubmissions, showToast]);


    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading submissions...</div>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Transcriber Tests</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin-dashboard" className="back-link">← Back to Admin Dashboard</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Pending & Reviewed Submissions</h2>
                    <p>Review submitted tests and manage transcriber statuses.</p>

                    {submissions.length === 0 ? (
                        <p className="no-data-message">No transcriber test submissions found.</p>
                    ) : (
                        <div className="submissions-list">
                            {submissions.map(submission => (
                                <div key={submission.id} className={`submission-card ${submission.status}`}>
                                    <div className="submission-header">
                                        <h3>{submission.users?.full_name || 'Unknown User'}</h3>
                                        <span className={`status-badge ${submission.status}`}>{submission.status.replace('_', ' ')}</span>
                                    </div>
                                    <p>Email: {submission.users?.email}</p>
                                    <p>Grammar Score: {submission.grammar_score.toFixed(2)}%</p>
                                    <p>Submitted: {new Date(submission.created_at).toLocaleString()}</p>
                                    <div className="submission-actions">
                                        <Link to={`/admin/transcriber-tests/${submission.id}`} className="view-details-btn">
                                            View Details
                                        </Link>
                                        {submission.status === 'pending' && (
                                            <>
                                                <button onClick={() => { setSelectedSubmission(submission); setShowApproveModal(true); }} className="approve-btn">Approve</button>
                                                <button onClick={() => { setSelectedSubmission(submission); setShowRejectModal(true); }} className="reject-btn">Reject</button>
                                            </>
                                        )}
                                        {submission.status === 'rejected' && submission.rejection_reason && (
                                            <p className="rejection-reason">Reason: {submission.rejection_reason}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Approve Modal */}
            {showApproveModal && selectedSubmission && (
                <Modal
                    show={showApproveModal}
                    title="Approve Transcriber Test"
                    onClose={() => setShowApproveModal(false)} // FIX: Simplified, Modal handles stopPropagation
                    onSubmit={approveSubmission} // FIX: Simplified, Modal handles stopPropagation
                    submitText="Confirm Approval"
                    loading={modalLoading}
                >
                    {/* FIX: Removed redundant onClick handler, Modal handles its own event bubbling */}
                    <div>
                        <p>Are you sure you want to approve the test for <strong>{selectedSubmission.users?.full_name}</strong>?</p>
                        <p>This will set their status to 'active_transcriber'.</p>
                    </div>
                </Modal>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedSubmission && (
                <Modal
                    show={showRejectModal}
                    title="Reject Transcriber Test"
                    onClose={() => setShowRejectModal(false)} // FIX: Simplified, Modal handles stopPropagation
                    onSubmit={rejectSubmission} // FIX: Simplified, Modal handles stopPropagation
                    submitText="Confirm Rejection"
                    loading={modalLoading}
                >
                    {/* FIX: Removed redundant onClick handler, Modal handles its own event bubbling */}
                    <div>
                        <p>Are you sure you want to reject the test for <strong>{selectedSubmission.users?.full_name}</strong>?</p>
                        <p>This will set their status to 'rejected'.</p>
                        <div className="form-group">
                            <label htmlFor="rejectionReason">Reason for Rejection (Optional):</label>
                            <textarea
                                id="rejectionReason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows="3"
                                placeholder="e.g., 'Low grammar score' or 'Poor transcription quality'"
                            ></textarea>
                        </div>
                    </div>
                </Modal>
            )}

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
                duration={toast.type === 'error' ? 4000 : 3000}
            />
        </div>
    );
};

export default AdminTranscriberTests;
