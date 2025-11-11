// frontend/client/src/AdminNegotiationJobs.js - COMPLETE AND UPDATED for Admin Negotiation Job Management

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Import Toast component
import Modal from './Modal'; // Import Modal component for delete confirmation
import './AdminManagement.css'; // Assuming common admin styles
import './AdminJobs.css'; // Assuming styling for job tables

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminNegotiationJobs = () => { // UPDATED: Component name
    const { user, logout } = useAuth();
    const navigate = useNavigate(); // Use useNavigate
    const [negotiationJobs, setNegotiationJobs] = useState([]); // UPDATED: State to store fetched negotiation jobs
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null); // Store entire job object to get jobType for deletion
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Helper function to format status for display (specific to negotiation jobs)
    const formatStatusDisplay = useCallback((status) => {
        switch (status) {
            case 'accepted_awaiting_payment':
                return 'Accepted - Awaiting Payment';
            case 'transcriber_counter':
                return 'Transcriber Countered';
            case 'client_counter':
                return 'Client Countered';
            case 'pending':
                return 'Pending';
            case 'hired':
                return 'Hired';
            case 'completed':
                return 'Completed';
            case 'client_completed':
                return 'Client Completed';
            case 'rejected':
                return 'Rejected';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status.replace(/_/g, ' '); // Fallback for other statuses
        }
    }, []);

    // Helper function to format timestamp robustly for display
    const formatDisplayTimestamp = useCallback((isoTimestamp) => {
        if (!isoTimestamp) return 'N/A';
        try {
            const date = new Date(isoTimestamp);
            if (isNaN(date.getTime())) { 
                console.warn(`Attempted to format invalid date string: ${isoTimestamp}`);
                return 'Invalid Date';
            }
            return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            console.error(`Error formatting timestamp ${isoTimestamp}:`, e);
            return 'Invalid Date';
        }
    }, []);

    // Function to fetch all negotiation jobs for admin
    const fetchNegotiationJobs = useCallback(async () => { // UPDATED: Function name
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            // Fetch negotiation jobs only
            const response = await fetch(`${BACKEND_API_URL}/api/admin/jobs`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && Array.isArray(data)) { 
                const typedNegotiations = data.map(job => ({ ...job, jobType: 'negotiation' }));
                setNegotiationJobs(typedNegotiations); // UPDATED: Set negotiationJobs
            } else if (response.ok && data && Array.isArray(data.jobs)) { 
                const typedNegotiations = data.jobs.map(job => ({ ...job, jobType: 'negotiation' }));
                setNegotiationJobs(typedNegotiations); // UPDATED: Set negotiationJobs
            }
            else {
                showToast(data.error || 'Failed to fetch negotiation jobs.ᐟ', 'error');
                setNegotiationJobs([]); // UPDATED: Ensure negotiationJobs is an empty array on error
            }

        } catch (error) {
            console.error('Error fetching negotiation jobs:', error);
            showToast('Network error fetching negotiation jobs.ᐟ', 'error');
            setNegotiationJobs([]); // UPDATED: Ensure negotiationJobs is an empty array on error
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    useEffect(() => {
        // Basic role check (ProtectedRoute already handles main access)
        if (!user || user.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            return;
        }
        fetchNegotiationJobs(); // UPDATED: Call fetchNegotiationJobs
    }, [user, navigate, fetchNegotiationJobs]);

    const openDeleteModal = useCallback((job) => { // Now accepts full job object
        setJobToDelete(job);
        setShowDeleteModal(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setJobToDelete(null);
        setShowDeleteModal(false);
        setModalLoading(false);
    }, []);

    // Handle deletion of a negotiation job by Admin
    const handleDeleteJob = useCallback(async () => {
        if (!jobToDelete?.id || jobToDelete.jobType !== 'negotiation') return; // Ensure it's a negotiation job

        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToDelete.id}`; // Always negotiation delete endpoint

            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Negotiation job deleted successfully!ᐟ', 'success');
                closeDeleteModal();
                fetchNegotiationJobs(); // Refresh the list of negotiation jobs
            } else {
                showToast(data.error || 'Failed to delete negotiation job.ᐟ', 'error');
            }
        } catch (error) {
            console.error('Error deleting negotiation job:', error);
            showToast('Network error deleting negotiation job.ᐟ', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [jobToDelete, logout, showToast, fetchNegotiationJobs, closeDeleteModal]);

    // Handle viewing job details
    const handleViewJobDetails = useCallback((jobId, jobType) => { 
        navigate(`/admin/jobs/${jobId}?type=${jobType}`); // Pass jobType as a query parameter
        console.log(`Viewing details for job: ${jobId}, Type: ${jobType}`);
    }, [navigate]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading negotiation jobs...</div> {/* UPDATED: Loading message */}
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Negotiation Jobs</h1> {/* UPDATED: Title */}
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

                <div className="admin-content-section">
                    <h2>All Negotiation Jobs</h2> {/* UPDATED: Subtitle */}
                    <p>Monitor all negotiation jobs across the platform.</p> {/* UPDATED: Description */}
                    
                    {Array.isArray(negotiationJobs) && negotiationJobs.length === 0 ? ( // UPDATED: Check negotiationJobs
                        <p className="no-data-message">No negotiation jobs found.ᐟ</p> 
                    ) : (
                        <div className="jobs-list-table-wrapper"> 
                            <table className="jobs-list-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Client</th>
                                        <th>Transcriber</th>
                                        <th>Price (USD)</th>
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Requested On</th>
                                        <th>Completed At</th>
                                        <th>Client Feedback</th>
                                        <th>Actions</th> 
                                    </tr>
                                </thead>
                                <tbody>
                                    {negotiationJobs.map(job => ( // UPDATED: Map negotiationJobs
                                        <tr key={job.id}>
                                            <td>{job.id.substring(0, 8)}...</td>
                                            <td>{job.client?.full_name || 'N/A'}</td> 
                                            <td>{job.transcriber?.full_name || 'N/A'}</td> 
                                            <td>USD {job.agreed_price_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td> 
                                            <td>{job.deadline_hours} hrs</td> 
                                            <td><span className={`status-badge ${job.status}`}>{formatStatusDisplay(job.status)}</span></td>
                                            <td>{new Date(job.created_at).toLocaleDateString()}</td>
                                            <td>{job.completed_at ? formatDisplayTimestamp(job.completed_at) : 'N/A'}</td>
                                            <td>
                                                {(job.status === 'completed' || job.status === 'client_completed') && (job.client_feedback_comment || job.client_feedback_rating) ? (
                                                    <div className="admin-client-feedback">
                                                        {job.client_feedback_rating && (
                                                            <div className="rating-display" style={{ marginBottom: '3px', fontSize: '0.9em' }}>
                                                                {'★'.repeat(job.client_feedback_rating)}
                                                                {'☆'.repeat(5 - job.client_feedback_rating)}
                                                                <span className="rating-number">({job.client_feedback_rating.toFixed(1)})</span>
                                                            </div>
                                                        )}
                                                        {job.client_feedback_comment && (
                                                            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.85em', color: '#555' }}>
                                                                "{job.client_feedback_comment.substring(0, 50)}{job.client_feedback_comment.length > 50 ? '...' : ''}"
                                                            </p>
                                                        )}
                                                        {!job.client_feedback_comment && !job.client_feedback_rating && <span>No feedback provided.</span>}
                                                    </div>
                                                ) : 'N/A'}
                                            </td>
                                            <td>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        handleViewJobDetails(job.id, job.jobType);
                                                    }} 
                                                    className="action-btn view-btn"
                                                >
                                                    View
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        openDeleteModal(job); 
                                                    }} 
                                                    className="action-btn delete-btn"
                                                >
                                                    Delete
                                                </button>
                                            </td> 
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
                duration={toast.type === 'error' ? 4000 : 3000}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <Modal
                    show={showDeleteModal}
                    title="Confirm Delete Job"
                    onClose={closeDeleteModal}
                    onSubmit={handleDeleteJob}
                    submitText="Confirm Delete"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to delete job ID: {jobToDelete?.id?.substring(0, 8)}...? This action cannot be undone and will remove all associated data, including messages and files.</p>
                    <p className="modal-warning">This action is irreversible.ᐟ</p>
                </Modal>
            )}
        </div>
    );
};

export default AdminNegotiationJobs; // UPDATED: Export new component name
