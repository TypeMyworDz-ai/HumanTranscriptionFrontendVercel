// src/TranscriberDirectUploadJobs.js - Handles ONLY Direct Upload Jobs for Transcribers
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Removed useLocation import
import Toast from './Toast';
import Modal from './Modal';
import DirectUploadJobCard from './DirectUploadJobCard';
import './TranscriberDirectUploadJobs.css';

import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// --- Component Definition ---
const TranscriberDirectUploadJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
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

    // NEW: State for Cancel Job Modal
    const [showCancelJobModal, setShowCancelJobModal] = useState(false);
    const [jobToCancelId, setJobToCancelId] = useState(null);


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
            // UPDATED: Call the new endpoint for a single active job
            const directUploadResponse = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/active`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            let directUploadData = { job: null }; // Expect a single job or null
            if (directUploadResponse.ok) {
                directUploadData = await directUploadResponse.json();
            }

            const fetchedDirectUploadJob = directUploadData.job; // Get the single job
            
            let typedDirectUploadJobs = [];
            if (fetchedDirectUploadJob) {
                console.log(`[TranscriberDirectUploadJobs] Raw job data from backend for ID ${fetchedDirectUploadJob.id}:`, fetchedDirectUploadJob);

                const transcriberEarning = parseFloat(fetchedDirectUploadJob.transcriber_earning) || 0; 
                console.log(`[TranscriberDirectUploadJobs] Job ${fetchedDirectUploadJob.id}: quote_amount=${fetchedDirectUploadJob.quote_amount}, raw transcriber_earning=${fetchedDirectUploadJob.transcriber_earning}, parsed transcriber_earning=${transcriberEarning}`);

                const mappedJob = {
                    ...fetchedDirectUploadJob,
                    jobType: 'direct_upload',
                    client_name: fetchedDirectUploadJob.client?.full_name || 'Unknown Client',
                    client_average_rating: fetchedDirectUploadJob.client?.client_average_rating || 0, 
                    agreed_price_usd: fetchedDirectUploadJob.quote_amount, // Mapped from quote_amount for display consistency
                    deadline_hours: fetchedDirectUploadJob.agreed_deadline_hours,
                    file_name: fetchedDirectUploadJob.file_name,
                    completed_on: fetchedDirectUploadJob.completed_at || fetchedDirectUploadJob.client_completed_at, 
                    transcriber_comment: fetchedDirectUploadJob.transcriber_comment, 
                    client_feedback_comment: fetchedDirectUploadJob.client_feedback_comment,
                    client_feedback_rating: fetchedDirectUploadJob.client_feedback_rating,
                    transcriber_earning: transcriberEarning 
                };
                console.log(`[TranscriberDirectUploadJobs] Mapped job data for ID ${fetchedDirectUploadJob.id}:`, mappedJob);
                typedDirectUploadJobs = [mappedJob]; // Wrap the single job in an array
            }

            setDirectUploadJobs(typedDirectUploadJobs); 

            console.log("TranscriberDirectUploadJobs: Fetched Direct Upload Jobs (summary):", typedDirectUploadJobs.map(j => ({
                id: j.id,
                status: j.status,
                earning: j.transcriber_earning,
                completedOn: j.completed_on,
                transcriberComment: j.transcriber_comment,
                clientFeedbackComment: j.client_feedback_comment,
                clientFeedbackRating: j.client_feedback_rating
            })));

            if (typedDirectUploadJobs.length === 0) {
                showToast('No active direct upload job assigned to you.', 'info'); // UPDATED message
            }
        } catch (error) {
            console.error("Network error while fetching direct upload jobs:", error);
            showToast('Network error while fetching direct upload job.ᐟ', 'error'); // UPDATED message
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
        showToast(data.message || `Direct upload job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
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
                        last_message_text: data.message || 'New Message, Check.',
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
            socket.on('direct_job_cancelled', handleJobUpdate); // NEW: Listen for transcriber cancellation event

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
                socket.off('direct_job_cancelled', handleJobUpdate); // NEW: Cleanup listener
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
        if (!window.confirm('Are you sure you want to delete this job from your list? This action cannot be undone.ᐟ')) {
            return;
        }
        if (jobType !== 'direct_upload') { 
            showToast('Only direct upload jobs can be deleted from this view.ᐟ', 'error');
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
                showToast('Direct upload job deleted successfully!ᐟ', 'success');
                fetchDirectUploadJobs(); 
            } else {
                showToast(data.error || 'Failed to delete direct upload job.ᐟ', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.ᐟ', 'error');
        }
    }, [showToast, fetchDirectUploadJobs, logout]);

    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => { 
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.ᐟ', 'error');
            logout();
            return;
        }
        if (jobType !== 'direct_upload') { 
            showToast('Only direct upload job files can be downloaded from this view.ᐟ', 'error');
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
                showToast(`Downloading ${fileName}...ᐟ`, 'success');
            } else {
                const errorData = await response.json();
                showToast(errorData.error || `Failed to download ${fileName}.ᐟ`, 'error');
            }
        } catch (error) {
            console.error('Network error during file download:', error);
            showToast('Network error during file download. Please try again.ᐟ', 'error');
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

    // NEW: Open Cancel Job Modal
    const openCancelJobModal = useCallback((jobId) => {
        setJobToCancelId(jobId);
        setShowCancelJobModal(true);
    }, []);

    // NEW: Close Cancel Job Modal
    const closeCancelJobModal = useCallback(() => {
        setShowCancelJobModal(false);
        setJobToCancelId(null);
        setModalLoading(false);
    }, []);

    // NEW: Handle Cancel Job API Call
    const confirmCancelDirectJob = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/${jobToCancelId}/cancel`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Job successfully cancelled and returned to available jobs.ᐟ', 'success');
                closeCancelJobModal();
                fetchDirectUploadJobs(); // Re-fetch to update the list
            } else {
                showToast(data.error || 'Failed to cancel job.ᐟ', 'error');
            }
        } catch (error) {
            console.error('Error cancelling direct upload job:', error);
            showToast('Network error while cancelling direct upload job.ᐟ', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [jobToCancelId, logout, showToast, closeCancelJobModal, fetchDirectUploadJobs]);


    // --- API Action to Submit Direct Upload Job ---
    const confirmSubmitDirectJob = useCallback(async () => {
        if (!submitDirectJobConfirmation) {
            showToast('Please confirm that you are sure the job is complete.ᐟ', 'error');
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
                showToast(data.message || 'Direct upload job submitted successfully! Waiting for client review.ᐟ', 'success');
                closeSubmitDirectJobModal();
                fetchDirectUploadJobs(); 
            } else {
                showToast(data.error || 'Failed to submit direct upload job.ᐟ', 'error');
            }
        } catch (error) {
            console.error('Error submitting direct upload job:', error);
            showToast('Network error while submitting direct upload job.ᐟ', 'error');
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

    // Hardcode values for "DU In Progress"
    const pageTitle = "DU In Progress"; // UPDATED: singular
    const pageDescription = "Track the progress of your assigned direct upload transcription job and communicate with the client."; // UPDATED: singular
    const listSubtitle = "Currently Assigned Direct Upload Job"; // UPDATED: singular
    const emptyMessage = "No active direct upload job assigned to you.ᐟ"; // UPDATED: singular

    // Display jobs directly from state, as backend now filters for active jobs
    const displayedJobs = directUploadJobs; 

    return (
        <div className="transcriber-direct-upload-jobs-container">
            <header className="transcriber-direct-upload-jobs-header">
                <div className="header-content">
                    <h1>{pageTitle}</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, <strong>{user.full_name}</strong>!</span>
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
                                    openCancelJobModal={openCancelJobModal}
                                    canCancelDirectJob={job.status === 'taken' || job.status === 'in_progress'}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    showToast={showToast}
                                    currentUserId={user.id}
                                    currentUserType={user.user_type}
                                />
                            ))
                        )}
                    </div>
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

            {/* NEW: Modal for Cancelling Direct Upload Job */}
            {showCancelJobModal && (
                <Modal
                    show={showCancelJobModal}
                    title="Confirm Job Cancellation"
                    onClose={closeCancelJobModal}
                    onSubmit={confirmCancelDirectJob}
                    submitText="Confirm Cancellation"
                    loading={modalLoading}
                    isDestructive={true} // Style as a destructive action
                >
                    <p>Are you sure you want to cancel this job?</p>
                    <p>This action will unassign the job from you and make it available for other transcribers to take.</p>
                    <p className="modal-note" style={{ color: 'red' }}>This action cannot be undone for this job.</p>
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
