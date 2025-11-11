// frontend/client/src/AdminDirectUploadJobs.js - COMPLETE AND UPDATED for Admin Direct Upload Job Management

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom'; // Import useNavigate and Link
import Toast from './Toast'; // Import Toast component
import Modal from './Modal'; // Import Modal component for delete confirmation
import './AdminManagement.css'; // Assuming common admin styles
import './AdminDirectUploadJobs.css'; // Specific styling for direct upload job table

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Helper function to format timestamp robustly for display (ensuring consistency across components)
const formatDisplayTimestamp = (isoTimestamp) => {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error(`Error formatting timestamp ${isoTimestamp}:`, e);
        return 'Invalid Date';
    }
};

// Helper function to format status for display (specific to direct upload jobs)
const formatStatusDisplay = (status) => {
    switch (status) {
        case 'pending_review':
            return 'Pending Review';
        case 'available_for_transcriber':
            return 'Available for Transcriber';
        case 'taken':
            return 'Taken';
        case 'in_progress':
            return 'In Progress';
        case 'completed':
            return 'Completed by Transcriber';
        case 'client_completed':
            return 'Completed by Client';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status.replace(/_/g, ' '); // Fallback for other statuses
    }
};

const AdminDirectUploadJobs = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); // Use useNavigate
    const [directUploadJobs, setDirectUploadJobs] = useState([]); // UPDATED: State to store fetched direct upload jobs
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });
    const [error, setError] = useState(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null); // Store entire job object for deletion
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);


    const fetchAllDirectUploadJobs = useCallback(async () => {
        if (!user || user.user_type !== 'admin') {
            setError('Access denied. Only admins can view this page.ᐟ');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/direct-upload-jobs`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch direct upload jobs.ᐟ');
            }

            const data = await response.json();
            setDirectUploadJobs(data.jobs); // UPDATED: Set directUploadJobs
        } catch (err) {
            console.error('Error fetching all direct upload jobs:', err);
            setError(err.message || 'Failed to load direct upload jobs.ᐟ');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAllDirectUploadJobs();
    }, [fetchAllDirectUploadJobs]);


    const openDeleteModal = useCallback((job) => { // Now accepts full job object
        console.log("openDeleteModal called with job:", job); // NEW LOG
        setJobToDelete(job);
        setShowDeleteModal(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        console.log("closeDeleteModal called."); // NEW LOG
        setJobToDelete(null);
        setShowDeleteModal(false);
        setModalLoading(false);
    }, []);

    // Handle deletion of a direct upload job by Admin
    const handleDeleteJob = useCallback(async () => {
        console.log("handleDeleteJob called. jobToDelete:", jobToDelete); // NEW LOG
        if (!jobToDelete?.id || jobToDelete.jobType !== 'direct_upload') {
            console.error("handleDeleteJob: Invalid jobToDelete or jobType is not 'direct_upload'.", jobToDelete); // NEW LOG
            showToast('Invalid job selected for deletion.ᐟ', 'error');
            setModalLoading(false); // Ensure loading is reset
            return;
        }

        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            setModalLoading(false); // Ensure loading is reset
            return;
        }

        try {
            const apiUrl = `${BACKEND_API_URL}/api/admin/direct-jobs/${jobToDelete.id}`; // Direct upload delete endpoint
            console.log("handleDeleteJob: Deleting direct upload job with URL:", apiUrl); // NEW LOG

            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Direct upload job deleted successfully!ᐟ', 'success');
                closeDeleteModal();
                fetchAllDirectUploadJobs(); // Refresh the list of direct upload jobs
            } else {
                console.error("handleDeleteJob: Backend error response:", data); // NEW LOG
                showToast(data.error || 'Failed to delete direct upload job.ᐟ', 'error');
            }
        } catch (error) {
            console.error('Error deleting direct upload job:', error);
            showToast('Network error deleting direct upload job.ᐟ', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [jobToDelete, logout, showToast, fetchAllDirectUploadJobs, closeDeleteModal]);

    // Handle viewing job details
    const handleViewJobDetails = useCallback((jobId, jobType) => { 
        navigate(`/admin/jobs/${jobId}?type=${jobType}`); // Pass jobType as a query parameter
        console.log(`Viewing details for job: ${jobId}, Type: ${jobType}`);
    }, [navigate]);


    if (loading) {
        return <div className="admin-direct-upload-jobs-container">Loading direct upload jobs...</div>;
    }

    if (error) {
        return <div className="admin-direct-upload-jobs-container error-message">Error: {error}</div>; // UPDATED: Display error message clearly
    }

    return (
        <div className="admin-direct-upload-jobs-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Direct Upload Jobs</h1>
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
                    <h2>All Direct Upload Jobs (Admin View)</h2>
                    {directUploadJobs.length === 0 ? ( // UPDATED: Check directUploadJobs
                        <p className="no-data-message">No direct upload jobs found.ᐟ</p>
                    ) : (
                        <div className="direct-upload-jobs-table-wrapper">
                            <table className="direct-upload-jobs-table">
                                <thead>
                                    <tr>
                                        <th>Job ID</th>
                                        <th>Client Name</th>
                                        <th>Transcriber Name</th>
                                        <th>File Name</th>
                                        <th>Audio Length (min)</th>
                                        <th>Quote Amount (USD)</th>
                                        <th>Status</th>
                                        <th>Created At</th>
                                        <th>Taken At</th>
                                        <th>Completed At</th>
                                        <th>Actions</th> {/* NEW: Actions column */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {directUploadJobs.map((job) => ( // UPDATED: Map directUploadJobs
                                        <tr key={job.id}>
                                            <td>{job.id.substring(0, 8)}...</td>
                                            <td>{job.client?.full_name || 'N/A'}</td>
                                            <td>{job.transcriber?.full_name || 'N/A'}</td>
                                            <td>{job.file_name || 'N/A'}</td>
                                            <td>{job.audio_length_minutes ? job.audio_length_minutes.toFixed(2) : 'N/A'}</td>
                                            <td>USD {job.quote_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</td>
                                            <td><span className={`status-badge ${job.status}`}>{formatStatusDisplay(job.status)}</span></td> {/* Use specific formatStatusDisplay */}
                                            <td>{formatDisplayTimestamp(job.created_at)}</td>
                                            <td>{job.taken_at ? formatDisplayTimestamp(job.taken_at) : 'N/A'}</td>
                                            <td>{job.completed_at ? formatDisplayTimestamp(job.completed_at) : 'N/A'}</td>
                                            <td>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        handleViewJobDetails(job.id, 'direct_upload'); // Pass jobType
                                                    }} 
                                                    className="action-btn view-btn"
                                                >
                                                    View
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        openDeleteModal(job); // Pass the entire job object
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
                    <p>Are you sure you want to delete Direct Upload Job ID: {jobToDelete?.id?.substring(0, 8)}...? This action cannot be undone and will remove all associated data, including messages and files.</p>
                    <p className="modal-warning">This action is irreversible.ᐟ</p>
                </Modal>
            )}
        </div>
    );
};

export default AdminDirectUploadJobs;
