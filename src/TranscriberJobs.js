import React, { useState, useEffect, useCallback } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; 
import NegotiationCard from './NegotiationCard'; 
import Modal from './Modal'; // Import the Modal component
import { useAuth } from './contexts/AuthContext';
import { connectSocket } from './ChatService'; 
import './TranscriberJobs.css'; 

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [activeJobs, setActiveJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // State for Modals (Only for Transcriber's actions on Direct Upload Jobs)
    const [showSubmitDirectJobModal, setShowSubmitDirectJobModal] = useState(false); // For Direct Upload Jobs
    const [submitDirectJobComment, setSubmitDirectJobComment] = useState('');
    const [submitDirectJobConfirmation, setSubmitDirectJobConfirmation] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Placeholder for opening modals (these would be passed to NegotiationCard)
    const openAcceptModal = useCallback((jobId) => showToast('Accept not allowed for active jobs.', 'info'), [showToast]);
    const onOpenCounterModal = useCallback((jobId) => showToast('Counter not allowed for active jobs.', 'info'), [showToast]);
    const openRejectModal = useCallback((jobId) => showToast('Reject not allowed for active jobs.', 'info'), [showToast]);

    // Function to fetch active jobs
    const fetchTranscriberJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("TranscriberJobs: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch active negotiation jobs (status 'hired')
            const negotiationResponse = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));
            const fetchedNegotiations = negotiationData.negotiations || [];
            const activeNegotiationJobs = fetchedNegotiations.filter(n => n.status === 'hired');
            console.log("TranscriberJobs: Fetched Active Negotiation Jobs:", activeNegotiationJobs.map(j => ({ id: j.id, status: j.status })));

            // Fetch active direct upload jobs (status 'taken')
            const directUploadResponse = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs`, { // Endpoint for all direct jobs assigned to transcriber
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const directUploadData = await (directUploadResponse.ok ? directUploadResponse.json() : Promise.resolve({ jobs: [] }));
            const fetchedDirectUploadJobs = directUploadData.jobs || [];
            const activeDirectUploadJobs = fetchedDirectUploadJobs.filter(j => j.status === 'taken' && j.transcriber_id === user.id); 
            console.log("TranscriberJobs: Fetched Active Direct Upload Jobs:", activeDirectUploadJobs.map(j => ({ id: j.id, status: j.status })));
            
            // Combine both types of active jobs
            const combinedActiveJobs = [...activeNegotiationJobs, ...activeDirectUploadJobs];
            setActiveJobs(combinedActiveJobs);

            if (combinedActiveJobs.length === 0) {
                showToast('No active jobs found yet.', 'info');
            }
        } catch (error) {
            console.error('Network error fetching transcriber jobs:', error);
            showToast('Network error while fetching active jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast, user?.id]);


    // Function to handle job status updates received via Socket.IO
    const handleJobUpdate = useCallback((data) => {
        console.log('TranscriberJobs: Job status update received via Socket. Triggering re-fetch for list cleanup.  Data:', data);
        showToast(`Job status updated for ID: ${data.negotiationId?.substring(0, 8) || data.jobId?.substring(0, 8)}.`, 'info');
        fetchTranscriberJobs(); 
    }, [showToast, fetchTranscriberJobs]);

    // --- Real-time Message Handling for Active Jobs (Job-specific Messages) ---
    const handleNewChatMessageForActiveJobs = useCallback((data) => {
        console.log('TranscriberJobs Real-time: New chat message received!', data);
        const receivedJobId = data.negotiationId || data.jobId;
        
        setActiveJobs(prevJobs => {
            const isForActiveJob = prevJobs.some(job => job.id === receivedJobId);

            if (!isForActiveJob) return prevJobs; 

            return prevJobs.map(job => {
                if (job.id === receivedJobId) {
                    return {
                        ...job,
                        last_message_text: data.message || 'New file uploaded.', 
                        last_message_timestamp: new Date().toISOString(),
                    };
                }
                return job;
            });
        });

        showToast(`New message for job ${receivedJobId} from ${data.sender_name || 'Client'}!`, 'info');
    }, [showToast]);


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn("TranscriberJobs: Unauthorized access or not a transcriber. Redirecting.");
            navigate('/');
            return;
        }

        fetchTranscriberJobs();

        // Socket.IO setup for this component
        const socket = connectSocket(user.id);
        if (socket) {
            // Listen for events relevant to active jobs (both negotiation and direct upload)
            socket.on('job_completed', handleJobUpdate); // For negotiation jobs
            socket.on('job_hired', handleJobUpdate); // For negotiation jobs
            socket.on('negotiation_cancelled', handleJobUpdate); // For negotiation jobs
            socket.on('direct_job_taken', handleJobUpdate); // For direct upload jobs
            socket.on('direct_job_completed', handleJobUpdate); // For direct upload jobs
            socket.on('direct_job_client_completed', handleJobUpdate); // For direct upload jobs

            // Listen for job-specific chat messages
            socket.on('newChatMessage', handleNewChatMessageForActiveJobs); 

            console.log('TranscriberJobs: Socket listeners attached for active jobs.');
        }

        return () => {
            if (socket) {
                console.log(`TranscriberJobs: Cleaning up socket listeners for user ID: ${user.id}`);
                socket.off('job_completed', handleJobUpdate);
                socket.off('job_hired', handleJobUpdate);
                socket.off('negotiation_cancelled', handleJobUpdate);
                socket.off('direct_job_taken', handleJobUpdate);
                socket.off('direct_job_completed', handleJobUpdate);
                socket.off('direct_job_client_completed', handleJobUpdate);
                socket.off('newChatMessage', handleNewChatMessageForActiveJobs); 
            }
        };
    }, [isAuthenticated, authLoading, user, navigate, fetchTranscriberJobs, handleJobUpdate, handleNewChatMessageForActiveJobs]);


    // Utility functions for NegotiationCard (can be shared or defined here)
    const getStatusColor = useCallback((status, isClientViewing) => {
        const colors = {
            'pending': '#ffc107',
            'transcriber_counter': '#007bff',
            'client_counter': '#6c757d',
            'accepted_awaiting_payment': '#28a745',
            'rejected': '#dc3545',
            'hired': '#007bff', // Negotiation job taken
            'taken': '#007bff', // Direct upload job taken
            'cancelled': '#dc3545',
            'completed': '#6f42c1',
            'client_completed': '#6f42c1' // Client marked direct job complete
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status, isClientViewing) => {
        const texts = {
            'pending': 'Waiting for Response',
            'transcriber_counter': 'Counter-Offer Received',
            'client_counter': 'Client Counter-Offer',
            'accepted_awaiting_payment': 'Accepted - Awaiting Payment',
            'rejected': 'Rejected',
            'hired': 'Transcriber Hired',
            'taken': 'Job Taken', // Direct upload job taken
            'cancelled': 'Cancelled',
            'completed': 'Completed',
            'client_completed': 'Completed by Client' // Client marked direct job complete
        };
        return texts[status] || status;
    }, []);

    // Delete negotiation handler (placeholder for active jobs - usually not deleted directly)
    const handleDeleteNegotiation = useCallback(async (jobId) => {
        showToast('Deletion not allowed for active jobs.', 'error');
    }, [showToast]);

    // NEW: Function to handle downloading negotiation files
    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.','error');
            logout();
            return;
        }

        try {
            // Construct the API endpoint URL based on jobType
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

    // --- Modal Handlers for Transcriber Jobs ---
    const openSubmitDirectJobModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowSubmitDirectJobModal(true);
        setSubmitDirectJobComment(''); // Reset comment
        setSubmitDirectJobConfirmation(false); // Reset confirmation
    }, []);

    const closeSubmitDirectJobModal = useCallback(() => {
        setShowSubmitDirectJobModal(false);
        setSelectedJobId(null);
        setModalLoading(false);
        setSubmitDirectJobComment('');
        setSubmitDirectJobConfirmation(false);
    }, []);

    // Removed openCompleteNegotiationJobModal and closeCompleteNegotiationJobModal as transcribers do not mark negotiation jobs complete.

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
                body: JSON.stringify({ transcriberComment: submitDirectJobComment }) // Send comment to backend
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Direct upload job submitted successfully!', 'success');
                closeSubmitDirectJobModal();
                fetchTranscriberJobs(); // Refresh list
            } else {
                showToast(data.error || 'Failed to submit direct upload job.', 'error');
            }
        } catch (error) {
            console.error('Error submitting direct upload job:', error);
            showToast('Network error while submitting direct upload job.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, submitDirectJobComment, submitDirectJobConfirmation, logout, showToast, closeSubmitDirectJobModal, fetchTranscriberJobs]);

    // Removed confirmCompleteNegotiationJob as transcribers do not mark negotiation jobs complete.


    if (loading) {
        return (
            <div className="transcriber-jobs-container">
                <div className="loading-spinner">Loading active jobs...</div>
            </div>
        );
    }

    return (
        <div className="transcriber-jobs-container">
            <header className="transcriber-jobs-header">
                <div className="header-content">
                    <h1>My Active Jobs</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="transcriber-jobs-main">
                <div className="transcriber-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Your Currently Assigned Transcription Projects</h2>
                            <p>
                                <strong>Note:</strong>
                            </p>
                            <ol>
                                <li>Track the progress of your assigned job here. Clients can ask about job progress or clarify something. This chat is solely dedicated for you to upload transcripts ONLY when you finish the job. Exhaust job prerequisites and details in Negotiation Room.</li>
                                <li>Exchange of personal information is highly discouraged.</li>
                                <li>This Chat is moderated. Messages you send will appear real-time on the client's side.</li>
                            </ol>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3>Active Jobs ({activeJobs.length})</h3>
                    <div className="active-jobs-list">
                        {activeJobs.length === 0 ? (
                            <p className="no-data-message">You currently have no active jobs assigned.</p>
                        ) : (
                            activeJobs.map((job) => {
                                const jobType = job.negotiation_id ? 'negotiation' : 'direct_upload';

                                console.log(`TranscriberJobs: Rendering Job ${job.id} (Type: ${jobType}). Client Info:`, job.client_info || job.client);
                                return (
                                    <NegotiationCard
                                        key={job.id}
                                        job={job}
                                        jobType={jobType}
                                        onDelete={handleDeleteNegotiation}
                                        onPayment={() => showToast('Payment is handled by client.', 'info')}
                                        onLogout={logout}
                                        getStatusColor={getStatusColor}
                                        getStatusText={getStatusText}
                                        showToast={showToast}
                                        currentUserId={user.id}
                                        currentUserType={user.user_type}
                                        openAcceptModal={openAcceptModal}
                                        canAccept={false}
                                        canCounter={false}
                                        onOpenCounterModal={onOpenCounterModal}
                                        openRejectModal={openRejectModal}
                                        onDownloadFile={handleDownloadFile}
                                        // NEW: Pass modal opening function for submitting direct upload jobs
                                        openSubmitDirectJobModal={openSubmitDirectJobModal}
                                        // Removed openCompleteNegotiationJobModal as transcribers do not mark negotiation jobs complete.
                                        
                                        clientAverageRating={parseFloat(job.client_info?.client_rating || job.client?.client_average_rating) || 0} 
                                        clientCompletedJobs={parseFloat(job.client_info?.client_completed_jobs || job.client?.client_completed_jobs) || 0}
                                    />
                                );
                            })
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

            {/* Removed Modal for Completing Negotiation Job as transcribers do not perform this action. */}

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

export default TranscriberJobs;
