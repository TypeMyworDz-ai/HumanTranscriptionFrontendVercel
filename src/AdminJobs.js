// frontend/client/src/AdminJobs.js - COMPLETE AND UPDATED with functionality for admin job management

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Import Toast component
import Modal from './Modal'; // Import Modal component for delete confirmation
import './AdminManagement.css'; // Assuming common admin styles
import './AdminJobs.css'; // You'll need to create this CSS file for specific job table styling

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminJobs = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]); // State to store fetched jobs (negotiations and direct uploads)
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null); // Store entire job object to get jobType for deletion
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Helper function to format status for display
    const formatStatusDisplay = useCallback((status) => {
        switch (status) {
            case 'accepted_awaiting_payment':
                return 'Accepted - Awaiting Payment';
            case 'transcriber_counter':
                return 'Transcriber Countered';
            case 'client_counter':
                return 'Client Countered';
            case 'pending':
            case 'pending_review': // Direct Upload specific status
                return 'Pending';
            case 'hired':
                return 'Hired';
            case 'available_for_transcriber': // Direct Upload specific status
                return 'Available for Transcriber';
            case 'taken': // Direct Upload specific status
                return 'Taken';
            case 'in_progress': // Direct Upload specific status
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'client_completed': // Direct Upload specific status
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

    // Function to fetch all jobs (negotiations and direct uploads) for admin
    const fetchAllJobs = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            // Fetch negotiation jobs
            const negotiationsResponse = await fetch(`${BACKEND_API_URL}/api/admin/jobs`, { // This endpoint now specifically gets negotiation jobs
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const negotiationsData = await negotiationsResponse.json();
            const fetchedNegotiations = (negotiationsResponse.ok && Array.isArray(negotiationsData))
                ? negotiationsData.map(job => ({ ...job, jobType: 'negotiation' }))
                : (negotiationsResponse.ok && negotiationsData && Array.isArray(negotiationsData.jobs) ? negotiationsData.jobs.map(job => ({ ...job, jobType: 'negotiation' })) : []);

            // Fetch direct upload jobs
            const directUploadResponse = await fetch(`${BACKEND_API_URL}/api/admin/direct-upload-jobs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const directUploadData = await directUploadResponse.json();
            const fetchedDirectUploads = (directUploadResponse.ok && Array.isArray(directUploadData.jobs)) // directUploadData.jobs is an array
                ? directUploadData.jobs.map(job => ({ ...job, jobType: 'direct_upload' }))
                : [];

            // Combine and sort all jobs by creation date
            const combinedJobs = [...fetchedNegotiations, ...fetchedDirectUploads].sort((a, b) => {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

            setJobs(combinedJobs);

            if (combinedJobs.length === 0) {
                showToast('No jobs found.', 'info');
            }

        } catch (error) {
            console.error('Error fetching jobs:', error);
            showToast('Network error fetching jobs.ᐟ', 'error');
            setJobs([]); // Ensure jobs is an empty array on error
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
        fetchAllJobs();
    }, [user, navigate, fetchAllJobs]);

    const openDeleteModal = useCallback((job) => { // Now accepts full job object
        setJobToDelete(job);
        setShowDeleteModal(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setJobToDelete(null);
        setShowDeleteModal(false);
        setModalLoading(false);
    }, []);

    // NEW: Handle deletion of a job by Admin
    const handleDeleteJob = useCallback(async () => {
        if (!jobToDelete?.id || !jobToDelete?.jobType) return;

        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            let apiUrl;
            if (jobToDelete.jobType === 'negotiation') {
                apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToDelete.id}`;
            } else if (jobToDelete.jobType === 'direct_upload') {
                // Assuming a similar delete endpoint for direct upload jobs
                apiUrl = `${BACKEND_API_URL}/api/admin/direct-jobs/${jobToDelete.id}`; // You'll need to create this backend endpoint
            } else {
                showToast('Unknown job type for deletion.', 'error');
                setModalLoading(false);
                return;
            }

            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Job deleted successfully!ᐟ', 'success');
                closeDeleteModal();
                fetchAllJobs(); // Refresh the list of jobs
            } else {
                showToast(data.error || 'Failed to delete job.ᐟ', 'error');
            }
        } catch (error) {
            console.error('Error deleting job:', error);
            showToast('Network error deleting job.ᐟ', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [jobToDelete, logout, showToast, fetchAllJobs, closeDeleteModal]);

    // NEW: Handle viewing job details (placeholder for now)
    const handleViewJobDetails = useCallback((jobId, jobType) => { // Now accepts jobType
        // Implement navigation to a detailed job view page
        navigate(`/admin/jobs/${jobId}?type=${jobType}`); // Pass jobType as a query parameter
        console.log(`Viewing details for job: ${jobId}, Type: ${jobType}`);
    }, [navigate]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading jobs...</div>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage All Jobs</h1>
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
                    <h2>Ongoing & Completed Jobs</h2>
                    <p>Monitor all transcription jobs across the platform.</p>
                    
                    {Array.isArray(jobs) && jobs.length === 0 ? ( // Corrected check for empty array
                        <p className="no-data-message">No jobs found.ᐟ</p>
                    ) : (
                        <div className="jobs-list-table-wrapper"> {/* Added wrapper for table styling */}
                            <table className="jobs-list-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Type</th> {/* NEW: Job Type column */}
                                        <th>Client</th>
                                        <th>Transcriber</th>
                                        <th>Price (USD)</th> {/* Changed to USD */}
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Requested On</th>
                                        <th>Completed At</th> {/* NEW: Completed At column */}
                                        <th>Client Feedback</th> {/* NEW: Client Feedback column */}
                                        <th>Actions</th> {/* NEW: Actions column */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map(job => (
                                        <tr key={job.id}>
                                            <td>{job.id.substring(0, 8)}...</td>
                                            <td>{job.jobType === 'negotiation' ? 'Negotiation' : 'Direct Upload'}</td> {/* Display job type */}
                                            <td>{job.client?.full_name || 'N/A'}</td> {/* Access client.full_name */}
                                            <td>{job.transcriber?.full_name || 'N/A'}</td> {/* Access transcriber.full_name */}
                                            <td>USD {(job.agreed_price_usd || job.quote_amount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td> {/* Handle both price fields */}
                                            <td>{job.deadline_hours || job.agreed_deadline_hours} hrs</td> {/* Handle both deadline fields */}
                                            {/* UPDATED: Use formatStatusDisplay helper */}
                                            <td><span className={`status-badge ${job.status}`}>{formatStatusDisplay(job.status)}</span></td>
                                            <td>{new Date(job.created_at).toLocaleDateString()}</td>
                                            {/* NEW: Display Completed At */}
                                            <td>{job.completed_at ? formatDisplayTimestamp(job.completed_at) : 'N/A'}</td>
                                            {/* NEW: Display Client Feedback */}
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
                                                        e.stopPropagation(); // Prevent event bubbling
                                                        handleViewJobDetails(job.id, job.jobType);
                                                    }} 
                                                    className="action-btn view-btn"
                                                >
                                                    View
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent event bubbling
                                                        openDeleteModal(job); // Pass the entire job object
                                                    }} 
                                                    className="action-btn delete-btn"
                                                >
                                                    Delete
                                                </button>
                                            </td> {/* NEW: Action buttons */}
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

            {/* NEW: Delete Confirmation Modal */}
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

export default AdminJobs;
