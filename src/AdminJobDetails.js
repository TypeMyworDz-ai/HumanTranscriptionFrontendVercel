// frontend/client/src/AdminJobDetails.js

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminManagement.css'; // Assuming common admin styles

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminJobDetails = () => {
    const { jobId } = useParams();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation(); // Use useLocation to get query params

    const [jobData, setJobData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

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

    const fetchJobDetails = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        // Get jobType from URL query parameters
        const query = new URLSearchParams(location.search);
        const jobType = query.get('type');

        let apiUrl;
        if (jobType === 'negotiation') {
            apiUrl = `${BACKEND_API_URL}/api/admin/jobs/${jobId}`; // Endpoint for negotiation job details
        } else if (jobType === 'direct_upload') {
            apiUrl = `${BACKEND_API_URL}/api/admin/direct-upload-jobs/${jobId}`; // Endpoint for direct upload job details
        } else {
            showToast('Invalid job type provided for details.ᐟ', 'error');
            navigate('/admin/jobs'); // Redirect back if jobType is missing or invalid
            return;
        }

        try {
            const response = await fetch(apiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && data) {
                setJobData({ ...data, jobType: jobType }); // Store jobType with data
            } else {
                showToast(data.error || 'Failed to fetch job details.ᐟ', 'error');
                navigate('/admin/jobs'); // Redirect back to all jobs if not found or error
            }
        } catch (error) {
            console.error('Error fetching job details: ', error);
            showToast('Network error fetching job details.ᐟ', 'error');
            navigate('/admin/jobs'); // Redirect back to all jobs on network error
        } finally {
            setLoading(false);
        }
    }, [jobId, logout, navigate, showToast, location.search]);

    useEffect(() => {
        // Basic role check (ProtectedRoute already handles main access)
        if (!user || user.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            return;
        }
        fetchJobDetails();
    }, [user, navigate, fetchJobDetails]);

    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading job details...</div>
            </div>
        );
    }

    if (!jobData) {
        return (
            <div className="admin-management-container">
                <p className="no-data-message">Job details not found.ᐟ</p>
                <Link to="/admin/jobs" className="back-link">← Back to Manage All Jobs</Link>
            </div>
        );
    }

    // Determine what to display based on jobType
    const isNegotiationJob = jobData.jobType === 'negotiation';
    const isDirectUploadJob = jobData.jobType === 'direct_upload';

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Job Details: {jobData.id?.substring(0, 8)}...</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin/jobs" className="back-link">← Back to Manage All Jobs</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Job Details: {isNegotiationJob ? 'Negotiation' : 'Direct Upload'}</h2>
                    <p>Comprehensive overview of job ID: {jobData.id}</p>
                    
                    <div className="job-detail-card">
                        <h3>Overview</h3>
                        <div className="detail-row">
                            <span>Status:</span>
                            <strong><span className={`status-badge ${jobData.status}`}>{formatStatusDisplay(jobData.status)}</span></strong>
                        </div>
                        <div className="detail-row">
                            <span>Requested On:</span>
                            <strong>{formatDisplayTimestamp(jobData.created_at)}</strong>
                        </div>
                        {isNegotiationJob && (
                            <>
                                <div className="detail-row">
                                    <span>Agreed Price:</span>
                                    <strong>USD {jobData.agreed_price_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Deadline:</span>
                                    <strong>{jobData.deadline_hours} hours</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Requirements:</span>
                                    <strong>{jobData.requirements}</strong>
                                </div>
                                {jobData.negotiation_files && (
                                    <div className="detail-row">
                                        <span>Attached File:</span>
                                        <strong>
                                            <a
                                                href={`${BACKEND_API_URL}/api/negotiations/${jobData.id}/download/${jobData.negotiation_files}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="file-link"
                                            >
                                                📄 {jobData.negotiation_files}
                                            </a>
                                        </strong>
                                    </div>
                                )}
                            </>
                        )}

                        {isDirectUploadJob && (
                            <>
                                <div className="detail-row">
                                    <span>Quote Amount:</span>
                                    <strong>USD {jobData.quote_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Agreed Deadline:</span>
                                    <strong>{jobData.agreed_deadline_hours} hours</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Audio Length:</span>
                                    <strong>{jobData.audio_length_minutes?.toFixed(2)} minutes</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Main File:</span>
                                    <strong>
                                        <a
                                            href={`${BACKEND_API_URL}/api/direct-jobs/${jobData.id}/download/${jobData.file_name}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="file-link"
                                        >
                                            📄 {jobData.file_name}
                                        </a>
                                    </strong>
                                </div>
                                {jobData.instruction_files && (
                                    <div className="detail-row">
                                        <span>Instruction Files:</span>
                                        <strong>
                                            {jobData.instruction_files.split(',').map((file, index) => (
                                                <a
                                                    key={index}
                                                    href={`${BACKEND_API_URL}/api/direct-jobs/${jobData.id}/download/${file}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="file-link"
                                                    style={{ display: 'block' }}
                                                >
                                                    📄 {file}
                                                </a>
                                            ))}
                                        </strong>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span>Client Instructions:</span>
                                    <strong>{jobData.client_instructions || 'N/A'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Audio Quality:</span>
                                    <strong>{jobData.audio_quality_param || 'N/A'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Deadline Type:</span>
                                    <strong>{jobData.deadline_type_param || 'N/A'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>Special Requirements:</span>
                                    <strong>{jobData.special_requirements?.length > 0 ? jobData.special_requirements.join(', ') : 'None'}</strong>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="job-detail-card">
                        <h3>Client Information</h3>
                        <div className="detail-row">
                            <span>Name:</span>
                            <strong>{jobData.client?.full_name || 'Unknown Client'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Email:</span>
                            <strong>{jobData.client?.email || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Client ID:</span>
                            <strong>{jobData.client?.id || 'N/A'}</strong>
                        </div>
                    </div>

                    <div className="job-detail-card">
                        <h3>Transcriber Information</h3>
                        <div className="detail-row">
                            <span>Name:</span>
                            <strong>{jobData.transcriber?.full_name || 'Unassigned'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Email:</span>
                            <strong>{jobData.transcriber?.email || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Transcriber ID:</span>
                            <strong>{jobData.transcriber?.id || 'N/A'}</strong>
                        </div>
                    </div>

                    {jobData.client_message && isNegotiationJob && ( // Only show client_message for negotiation jobs
                        <div className="job-detail-card">
                            <h3>Client's Message</h3>
                            <p>{jobData.client_message}</p>
                        </div>
                    )}

                    {jobData.transcriber_response && isNegotiationJob && ( // Only show transcriber_response for negotiation jobs
                        <div className="job-detail-card">
                            <h3>Transcriber's Response</h3>
                            <p>{jobData.transcriber_response}</p>
                        </div>
                    )}
                    
                    {(jobData.status === 'completed' || jobData.status === 'client_completed') && (jobData.client_feedback_comment || jobData.client_feedback_rating) && (
                        <div className="job-detail-card">
                            <h3>Client Feedback</h3>
                            {jobData.client_feedback_rating && (
                                <div className="rating-display" style={{ marginBottom: '5px' }}>
                                    {'★'.repeat(jobData.client_feedback_rating)}
                                    {'☆'.repeat(5 - jobData.client_feedback_rating)}
                                    <span className="rating-number">({jobData.client_feedback_rating.toFixed(1)})</span>
                                </div>
                            )}
                            {jobData.client_feedback_comment && (
                                <p style={{ margin: 0, fontStyle: 'italic', color: '#555' }}>"{jobData.client_feedback_comment}"</p>
                            )}
                            {!jobData.client_feedback_comment && !jobData.client_feedback_rating && <p>No feedback provided.</p>}
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
        </div>
    );
};

export default AdminJobDetails;
