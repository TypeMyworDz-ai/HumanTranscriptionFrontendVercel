// src/TranscriberDirectUploadJobs.js - Handles ONLY Direct Upload Jobs for Transcribers
import React, { useState, useEffect, useCallback } from 'react'; // Removed Fragment import
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import DirectUploadJobCard from './DirectUploadJobCard';
import './TranscriberDirectUploadJobs.css';

import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';

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

// --- Component Definition ---
const TranscriberDirectUploadJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [directUploadJobs, setDirectUploadJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

    // State for Modals (Only for Transcriber's actions on Direct Upload Jobs)
    const [showSubmitDirectJobModal, setShowSubmitDirectJobModal] = useState(false); 
    const [submitDirectJobComment, setSubmitDirectJobComment] = useState('');
    const [submitDirectJobConfirmation, setSubmitDirectJobConfirmation] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(null); // The ID of the job to be submitted
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => {
        setToast({
            isVisible: true,
            message,
            type
        });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({
            ...prev,
            isVisible: false
        }));
    }, []);


    // Fetch ONLY direct upload jobs for the current transcriber
    const fetchDirectUploadJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            if (isAuthenticated) {
                console.warn("TranscriberDirectUploadJobs: Token or userId missing for API call despite authenticated state. Forcing logout.");
                logout();
            }
            return Promise.reject(new Error('Authentication token or userId missing.'));
        }

        setLoading(true);
        try {
            const directUploadResponse = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/all`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const directUploadData = await (directUploadResponse.ok ? directUploadResponse.json() : Promise.resolve({ jobs: [] }));

            const fetchedDirectUploadJobs = directUploadData.jobs || [];
            
            const typedDirectUploadJobs = fetchedDirectUploadJobs.map(job => ({
                ...job,
                jobType: 'direct_upload',
                client_name: job.client?.full_name || 'Unknown Client',
                client_average_rating: job.client?.client_average_rating || 0, 
                agreed_price_usd: job.quote_amount, // Mapped from quote_amount for display consistency
                deadline_hours: job.agreed_deadline_hours,
                file_name: job.file_name,
                completed_on: job.completed_at || job.client_completed_at, 
                transcriber_comment: job.transcriber_comment, 
                client_feedback_comment: job.client_feedback_comment,
                client_feedback_rating: job.client_feedback_rating
            }));

            setDirectUploadJobs(typedDirectUploadJobs); 

            console.log("TranscriberDirectUploadJobs: Fetched Direct Upload Jobs:", typedDirectUploadJobs.map(j => ({
                id: j.id,
                status: j.status,
                jobType: j.jobType,
                clientName: j.client_name,
                clientRating: j.client_average_rating,
                agreedPrice: j.agreed_price_usd,
                deadline: j.deadline_hours,
                completedOn: j.completed_on,
                transcriberComment: j.transcriber_comment, 
                clientFeedbackComment: j.client_feedback_comment, 
                clientFeedbackRating: j.client_feedback_rating 
            })));

            if (typedDirectUploadJobs.length === 0) {
                showToast('No direct upload jobs found.', 'info');
            }
        } catch (error) {
            console.error("Network error while fetching direct upload jobs:", error);
            showToast('Network error while fetching direct upload jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast, user?.id]); 


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn(`TranscriberDirectUploadJobs: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            logout();
            return;
        }

        const transcriberStatus = user.transcriber_status || '';
        const transcriberUserLevel = user.transcriber_user_level || '';
        const isTranscriber = user.user_type === 'transcriber';

        const hasActiveTranscriberStatus = isTranscriber && (transcriberStatus === 'active_transcriber' || transcriberUserLevel === 'proofreader');

        if (!isTranscriber || !hasActiveTranscriberStatus) {
            console.warn(`TranscriberDirectUploadJobs: Unauthorized access attempt by user_type: ${user.user_type}, status: ${transcriberStatus}, level: ${transcriberUserLevel}. Redirecting.`);
            logout();
            return;
        }

        fetchDirectUploadJobs(); 
    }, [isAuthenticated, authLoading, user, navigate, fetchDirectUploadJobs, logout]);

    const handleJobUpdate = useCallback((data) => {
        console.log('TranscriberDirectUploadJobs Real-time: Job update received! Triggering re-fetch for list cleanup.', data);
        const jobId = data.jobId; 
        showToast(`Direct upload job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
        fetchDirectUploadJobs(); 
    }, [showToast, fetchDirectUploadJobs]);

    const handleNewChatMessageForDirectUploadJobs = useCallback((data) => {
        console.log('TranscriberDirectUploadJobs Real-time: New chat message received!', data);
        const relatedJobId = data.direct_upload_job_id;
        
        setDirectUploadJobs(prevJobs => {
            const isForActiveJob = prevJobs.some(job => job.id === relatedJobId);

            if (!isForActiveJob) return prevJobs; 

            return prevJobs.map(job => {
                if (job.id === relatedJobId) {
                    return {
                        ...job,
                        last_message_text: data.message || 'New file uploaded.', 
                        last_message_timestamp: new Date().toISOString(),
                    };
                }
                return job;
            });
        });

        showToast(`New message for job ${relatedJobId?.substring(0, 8)} from ${data.sender_name || 'Client'}!`, 'info');
    }, [showToast]);


    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("TranscriberDirectUploadJobs: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`TranscriberDirectUploadJobs: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        if (socket) {
            socket.on('direct_job_taken', handleJobUpdate);
            socket.on('direct_job_completed', handleJobUpdate); 
            socket.on('direct_job_client_completed', handleJobUpdate);
            socket.on('direct_job_completed_transcriber_side', handleJobUpdate); 
            socket.on('newChatMessage', handleNewChatMessageForDirectUploadJobs);

            console.log('TranscriberDirectUploadJobs: Socket listeners attached.');
        }


        return () => {
            if (socket) {
                console.log(`TranscriberDirectUploadJobs: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('direct_job_taken', handleJobUpdate);
                socket.off('direct_job_completed', handleJobUpdate);
                socket.off('direct_job_client_completed', handleJobUpdate);
                socket.off('direct_job_completed_transcriber_side', handleJobUpdate); 
                socket.off('newChatMessage', handleNewChatMessageForDirectUploadJobs);
                disconnectSocket();
            }
        };
    }, [user?.id, isAuthenticated, handleJobUpdate, handleNewChatMessageForDirectUploadJobs]);


    // Utility functions (can be shared or defined here)
    const getStatusColor = useCallback((status) => { 
        const colors = {
            'available_for_transcriber': '#17a2b8', 
            'taken': '#007bff', 
            'in_progress': '#007bff', 
            'completed': '#6f42c1', 
            'client_completed': '#6f42c1',
            'cancelled': '#dc3545'
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status) => { 
        const texts = {
            'available_for_transcriber': 'Available',
            'taken': 'Job Taken',
            'in_progress': 'In Progress',
            'completed': 'Submitted for Review', 
            'client_completed': 'Completed by Client', 
            'cancelled': 'Cancelled'
        };
        return texts[status] || status;
    }, []);

    const handleDeleteJob = useCallback(async (jobId, jobType) => { 
        if (!window.confirm('Are you sure you want to delete this job from your list? This action cannot be undone.')) {
            return;
        }
        if (jobType !== 'direct_upload') { 
            showToast('Only direct upload jobs can be deleted from this view.', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }

            let apiUrl = `${BACKEND_API_URL}/api/direct-jobs/${jobId}`; 
            
            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Direct upload job deleted successfully!', 'success');
                fetchDirectUploadJobs(); 
            } else {
                showToast(data.error || 'Failed to delete direct upload job', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchDirectUploadJobs, logout]);

    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => { 
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }
        if (jobType !== 'direct_upload') { 
            showToast('Only direct upload job files can be downloaded from this view.', 'error');
            return;
        }

        try {
            const downloadUrl = `${BACKEND_API_URL}/api/direct-jobs/${jobId}/download/${fileName}`;
            
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

    // --- Modal Handlers for Transcriber Direct Upload Jobs ---
    const openSubmitDirectJobModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowSubmitDirectJobModal(true);
        setSubmitDirectJobComment(''); 
        setSubmitDirectJobConfirmation(false); 
    }, []);

    const closeSubmitDirectJobModal = useCallback(() => {
        setShowSubmitDirectJobModal(false);
        setSelectedJobId(null);
        setModalLoading(false);
        setSubmitDirectJobComment('');
        setSubmitDirectJobConfirmation(false);
    }, []);

    // --- API Action to Submit Direct Upload Job ---
    const confirmSubmitDirectJob = useCallback(async () => {
        if (!submitDirectJobConfirmation) {
            showToast('Please confirm that you are sure the job is complete.', 'error');
            return;
        }
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/${selectedJobId}/complete`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transcriberComment: submitDirectJobComment }) 
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Direct upload job submitted successfully!', 'success');
                closeSubmitDirectJobModal();
                fetchDirectUploadJobs(); 
            } else {
                showToast(data.error || 'Failed to submit direct upload job.', 'error');
            }
        } catch (error) {
            console.error('Error submitting direct upload job:', error);
            showToast('Network error while submitting direct upload job.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, submitDirectJobComment, submitDirectJobConfirmation, logout, showToast, closeSubmitDirectJobModal, fetchDirectUploadJobs]);


    if (authLoading || !isAuthenticated || !user) {
        return <div className="loading-container">Loading authentication...</div>;
    }

    if (loading) {
        return (
            <div className="loading-container">Loading jobs...</div>
        );
    }

    const query = new URLSearchParams(location.search);
    const statusFilter = query.get('status');

    let displayedJobs = [];
    let pageTitle = "My Direct Upload Jobs";
    let pageDescription = "Manage your assigned direct upload transcription projects.";
    let listSubtitle = "All Direct Upload Jobs";
    let emptyMessage = "No direct upload jobs found.";

    if (statusFilter === 'active') {
        displayedJobs = directUploadJobs.filter(job =>
            job.status === 'taken' || job.status === 'in_progress'
        );
        pageTitle = "My DU Jobs";
        pageDescription = "Track the progress of your assigned direct upload transcription jobs and communicate with clients.";
        listSubtitle = "Currently Assigned Direct Upload Jobs";
        emptyMessage = "No active direct upload jobs assigned to you.";
    } else if (statusFilter === 'completed') {
        displayedJobs = directUploadJobs.filter(job =>
            job.status === 'completed' || job.status === 'client_completed'
        );
        pageTitle = "My Completed Direct Upload Jobs";
        pageDescription = "Review your finished direct upload transcription projects and earnings.";
        listSubtitle = "Completed Direct Upload Jobs";
        emptyMessage = "No completed direct upload jobs yet.";
    } else { 
        displayedJobs = directUploadJobs; 
        pageTitle = "All Direct Upload Jobs";
        pageDescription = "View all direct upload jobs you have interacted with.";
        listSubtitle = "All Direct Upload Jobs";
        emptyMessage = "No direct upload jobs found.";
    }


    return (
        <div className="transcriber-direct-upload-jobs-container">
            <header className="transcriber-direct-upload-jobs-header">
                <div className="header-content">
                    <h1>{pageTitle}</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="transcriber-direct-upload-jobs-main">
                <div className="transcriber-direct-upload-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2 dangerouslySetInnerHTML={{ __html: pageTitle }}></h2>
                            <p>{pageDescription}</p>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3 className="direct-upload-jobs-subtitle">{listSubtitle}</h3>
                    {statusFilter === 'completed' ? ( 
                        <div className="completed-jobs-list-table">
                            {displayedJobs.length === 0 ? (
                                <p className="no-data-message">{emptyMessage}</p>
                            ) : (
                                <table className="completed-jobs-table">
                                    <thead>
                                        <tr>
                                            <th>Job ID</th>
                                            <th>Client</th>
                                            <th>Quote Amount</th>
                                            <th>Deadline</th>
                                            <th>Status</th>
                                            <th>Completed On</th>
                                            <th>Your Comment</th>
                                            <th>Client Feedback</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedJobs.map(job => (
                                            <tr key={job.id}>
                                                <td>{job.id?.substring(0, 8)}...</td>
                                                <td>
                                                    {job.client_name || 'N/A'}
                                                    {job.client_average_rating > 0 && (
                                                        <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                                                            ({'★'.repeat(Math.floor(job.client_average_rating))} {(job.client_average_rating).toFixed(1)})
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
                                                <td>{formatDisplayTimestamp(job.completed_on)}</td>
                                                <td>{job.transcriber_comment || 'N/A'}</td>
                                                <td>
                                                    {job.client_feedback_comment || 'N/A'}
                                                    {job.client_feedback_rating > 0 && (
                                                        <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                                                            ({'★'.repeat(job.client_feedback_rating)})
                                                        </span>
                                                        )}
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
                        ) : ( 
                            <div className="direct-upload-jobs-list">
                                {displayedJobs.length === 0 ? (
                                    <p>{emptyMessage}</p>
                                ) : (
                                    displayedJobs.map(job => (
                                        <DirectUploadJobCard
                                            key={job.id}
                                            job={job}
                                            onDelete={handleDeleteJob}
                                            onDownloadFile={handleDownloadFile}
                                            openSubmitDirectJobModal={openSubmitDirectJobModal}
                                            canSubmitDirectJob={job.status === 'taken' || job.status === 'in_progress'}
                                            getStatusColor={getStatusColor}
                                            getStatusText={getStatusText}
                                            showToast={showToast}
                                            currentUserId={user.id}
                                            currentUserType={user.user_type}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </main>

                {/* Modal for Submitting Direct Upload Job (Transcriber's action) */}
                {showSubmitDirectJobModal && (
                    <Modal
                        show={showSubmitDirectJobModal}
                        title="Submit Direct Upload Job"
                        onClose={closeSubmitDirectJobModal}
                        onSubmit={confirmSubmitDirectJob}
                        submitText="Submit Job"
                        loading={modalLoading}
                    >
                        <p>Please provide any final comments for the client and confirm job completion.</p>
                        <textarea
                            value={submitDirectJobComment}
                            onChange={(e) => setSubmitDirectJobComment(e.target.value)}
                            placeholder="Optional: Add a comment for the client..."
                            rows="4"
                            style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc' }}
                        ></textarea>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                checked={submitDirectJobConfirmation}
                                onChange={(e) => setSubmitDirectJobConfirmation(e.target.checked)}
                            />
                            I confirm that this direct upload job is complete and ready for client review.
                        </label>
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

export default TranscriberDirectUploadJobs;
