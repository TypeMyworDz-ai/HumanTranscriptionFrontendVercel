import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
// import NegotiationCard from './NegotiationCard'; // We will no longer directly use NegotiationCard here
import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService';
import './ClientCompletedJobs.css'; // You'll need to create/update this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Helper function to format timestamp robustly for display
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

const ClientCompletedJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [completedJobs, setCompletedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchClientCompletedJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("ClientCompletedJobs: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch completed negotiation jobs
            const negotiationResponse = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));
            const fetchedNegotiations = negotiationData.negotiations || [];
            const completedNegotiationJobs = fetchedNegotiations.filter(n => n.status === 'completed');

            // Fetch client-completed direct upload jobs
            const directUploadResponse = await fetch(`${BACKEND_API_URL}/api/client/direct-jobs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const directUploadData = await (directUploadResponse.ok ? directUploadResponse.json() : Promise.resolve({ jobs: [] }));
            const fetchedDirectUploadJobs = directUploadData.jobs || [];
            const clientCompletedDirectUploadJobs = fetchedDirectUploadJobs.filter(j => j.status === 'client_completed');

            // Combine and add jobType identifier
            const combinedJobs = [
                ...completedNegotiationJobs.map(job => ({
                    ...job,
                    jobType: 'negotiation',
                    transcriber_name: job.transcriber_info?.full_name || 'Unknown Transcriber',
                    transcriber_rating: job.transcriber_info?.transcriber_average_rating || 0,
                    agreed_price_usd: job.agreed_price_usd,
                    deadline_hours: job.deadline_hours,
                    requirements: job.requirements,
                    file_name: job.negotiation_files
                })),
                ...clientCompletedDirectUploadJobs.map(job => ({
                    ...job,
                    jobType: 'direct_upload',
                    transcriber_name: job.transcriber?.full_name || 'Unknown Transcriber',
                    transcriber_rating: job.transcriber?.transcriber_average_rating || 0,
                    agreed_price_usd: job.quote_amount,
                    deadline_hours: job.agreed_deadline_hours,
                    requirements: job.client_instructions,
                    file_name: job.file_name
                }))
            ];

            console.log("ClientCompletedJobs: Combined Completed Jobs:", combinedJobs.map(j => ({
                id: j.id,
                status: j.status,
                jobType: j.jobType,
                completed_at: j.completed_at || j.client_completed_at,
                client_feedback_comment: j.client_feedback_comment,
                client_feedback_rating: j.client_feedback_rating,
                transcriber_name: j.transcriber_name, // Now correctly mapped
                transcriber_rating: j.transcriber_rating, // Now correctly mapped
                agreed_price_usd: j.agreed_price_usd,
                deadline_hours: j.deadline_hours,
                requirements: j.requirements,
                file_name: j.file_name
            })));

            setCompletedJobs(prevJobs => {
                if (JSON.stringify(combinedJobs) !== JSON.stringify(prevJobs)) {
                    console.log("ClientCompletedJobs: Updating completedJobs state. New data differs from previous.");
                    return combinedJobs;
                }
                console.log("ClientCompletedJobs: Not updating completedJobs state. Data is identical.");
                return prevJobs;
            });

            if (combinedJobs.length === 0) {
                showToast('No completed jobs found yet.', 'info');
            }
        } catch (error) {
            console.error('Network error fetching client completed jobs:', error);
            showToast('Network error while fetching completed jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);


    const handleJobUpdate = useCallback((data) => {
        console.log('ClientCompletedJobs: Job status update received via Socket. Triggering re-fetch for list cleanup.', data);
        const jobId = data.negotiationId || data.jobId;
        showToast(`Job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
        fetchClientCompletedJobs();
    }, [showToast, fetchClientCompletedJobs]);


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientCompletedJobs: Unauthorized access or not a client. Redirecting.");
            navigate('/');
            return;
        }

        fetchClientCompletedJobs();
    }, [isAuthenticated, authLoading, user, navigate, fetchClientCompletedJobs]);


    useEffect(() => {
        if (isAuthenticated && user && user.user_type === 'client' && user.id) {
            const socket = connectSocket(user.id);
            if (socket) {
                socket.on('job_completed', handleJobUpdate); // For negotiation jobs
                socket.on('direct_job_client_completed', handleJobUpdate); // For direct upload jobs
                console.log('ClientCompletedJobs: Socket listeners attached for completed jobs.');
            }

            return () => {
                if (socket) {
                    console.log(`ClientCompletedJobs: Cleaning up socket listeners for user ID: ${user.id}`);
                    socket.off('job_completed', handleJobUpdate);
                    socket.off('direct_job_client_completed', handleJobUpdate);
                    disconnectSocket();
                }
            };
        }
    }, [isAuthenticated, user, handleJobUpdate]);


    const getStatusColor = useCallback((status) => { // Removed isClientViewing as it's always client here
        const colors = {
            'completed': '#6f42c1', // Transcriber completed
            'client_completed': '#6f42c1' // Client completed
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status) => { // Removed isClientViewing as it's always client here
        const texts = {
            'completed': 'Completed by Transcriber',
            'client_completed': 'Completed by Client'
        };
        return texts[status] || status;
    }, []);

    const handleDeleteJob = useCallback(async (jobId, jobType) => { // Renamed from handleDeleteNegotiation for clarity
        if (!window.confirm('Are you sure you want to delete this completed job from your list? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }

            let apiUrl;
            if (jobType === 'negotiation') {
                apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobId}`;
            } else if (jobType === 'direct_upload') {
                // Assuming a delete endpoint for direct upload jobs if needed
                showToast('Direct upload jobs cannot be deleted from this view.', 'error');
                return; // Prevent deletion for now
            } else {
                showToast('Unknown job type for deletion.', 'error');
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
                showToast('Completed job deleted successfully!', 'success');
                fetchClientCompletedJobs();
            } else {
                showToast(data.error || 'Failed to delete completed job', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, logout, fetchClientCompletedJobs]);

    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const downloadUrl = jobType === 'direct_upload'
                ? `${BACKEND_API_URL}/api/direct-jobs/${jobId}/download/${fileName}`
                : `${BACKEND_API_URL}/api/negotiations/${jobId}/download/${fileName}`;

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showToast(`Downloading ${fileName}...`, 'success');
            } else {
                const errorData = await response.json();
                showToast(errorData.error || `Failed to download ${fileName}.`, 'error');
            }
        } catch (error) {
            console.error('Network error during file download:', error);
            showToast('Network error during file download. Please try again.', 'error');
        }
    }, [showToast, logout]);


    if (loading) {
        return (
            <div className="client-completed-jobs-container">
                <div className="loading-spinner">Loading completed jobs...</div>
            </div>
        );
    }

    return (
        <div className="client-completed-jobs-container">
            <header className="client-completed-jobs-header">
                <div className="header-content">
                    <h1>My Completed Jobs</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="client-completed-jobs-main">
                <div className="client-completed-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Your Finished Transcription Projects</h2>
                            <p>Review your completed jobs and provide valuable feedback to transcribers.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3>Completed Jobs ({completedJobs.length})</h3>
                    <div className="completed-jobs-list-table">
                        {completedJobs.length === 0 ? (
                            <p className="no-data-message">You currently have no completed jobs.</p>
                        ) : (
                            <table className="completed-jobs-table">
                                <thead>
                                    <tr>
                                        <th>Job ID</th>
                                        <th>Transcriber</th>
                                        <th>Agreed Price</th>
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Completed On</th>
                                        <th>Your Feedback</th>
                                        <th>Transcriber Rating</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedJobs.map((job) => (
                                        <tr key={job.id}>
                                            <td>{job.id?.substring(0, 8)}...</td>
                                            <td>
                                                {job.transcriber_name || 'N/A'} {/* Display transcriber name */}
                                                {job.transcriber_rating > 0 && (
                                                    <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                                                        ({'★'.repeat(Math.floor(job.transcriber_rating))} {(job.transcriber_rating).toFixed(1)})
                                                    </span>
                                                )}
                                            </td>
                                            <td>USD {job.agreed_price_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td>{job.deadline_hours} hours</td>
                                            <td>
                                                <span className="status-badge" style={{ backgroundColor: getStatusColor(job.status) }}>
                                                    {getStatusText(job.status)}
                                                </span>
                                            </td>
                                            <td>{formatDisplayTimestamp(job.completed_at || job.client_completed_at)}</td>
                                            <td>
                                                {job.client_feedback_comment || 'N/A'}
                                                {job.client_feedback_rating > 0 && (
                                                    <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                                                        ({'★'.repeat(job.client_feedback_rating)})
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {job.transcriber_rating > 0 ? (
                                                    <span>
                                                        {'★'.repeat(Math.floor(job.transcriber_rating))} ({job.transcriber_rating.toFixed(1)})
                                                    </span>
                                                ) : 'N/A'}
                                            </td>
                                            <td>
                                                {job.file_name && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadFile(job.id, job.file_name, job.jobType);
                                                        }}
                                                        className="action-btn download-btn"
                                                        title="Download File"
                                                    >
                                                        ⬇️
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteJob(job.id, job.jobType);
                                                    }}
                                                    className="action-btn delete-btn"
                                                    title="Delete Job"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
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

export default ClientCompletedJobs;
