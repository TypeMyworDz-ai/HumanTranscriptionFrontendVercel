// src/ClientJobs.js - UPDATED to fix modal dismissal and toast message logic
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import NegotiationCard from './NegotiationCard'; // To display individual job details
import Modal from './Modal'; // Import the Modal component
import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService'; // Added disconnectSocket
import './ClientJobs.css'; // You'll need to create this CSS file
import './AdminManagement.css'; // Reusing some modal styles from AdminManagement.css

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [activeJobs, setActiveJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // NEW: State for Mark Job Complete Modal
    const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);
    const [jobToComplete, setJobToComplete] = useState(null); // Stores the entire job object
    const [clientFeedbackComment, setClientFeedbackComment] = useState('');
    const [clientFeedbackRating, setClientFeedbackRating] = useState(5); // Default rating
    const [completeJobModalLoading, setCompleteJobModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchClientJobs = useCallback(async (showNoJobsToast = true) => { // FIX: Added showNoJobsToast parameter
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("ClientJobs: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [negotiationsResponse, directUploadJobsResponse] = await Promise.all([
                fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${BACKEND_API_URL}/api/client/direct-jobs`, { // Fetch direct upload jobs
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const negotiationsData = await negotiationsResponse.json();
            const directUploadJobsData = await directUploadJobsResponse.json();

            let combinedActiveJobs = [];

            if (negotiationsResponse.ok) {
                const fetchedNegotiations = negotiationsData.negotiations || [];
                const activeNegotiations = fetchedNegotiations.filter(n => n.status === 'hired');
                combinedActiveJobs = [...combinedActiveJobs, ...activeNegotiations];
            } else {
                console.error('Failed to fetch negotiations:', negotiationsData.error);
                showToast(negotiationsData.error || 'Failed to load negotiations.', 'error');
            }

            if (directUploadJobsResponse.ok) {
                const fetchedDirectUploadJobs = directUploadJobsData.jobs || [];
                const activeDirectUploadJobs = fetchedDirectUploadJobs.filter(d => 
                    d.status === 'available_for_transcriber' || 
                    d.status === 'taken' || 
                    d.status === 'in_progress'
                );
                combinedActiveJobs = [...combinedActiveJobs, ...activeDirectUploadJobs];
            } else {
                console.error('Failed to fetch direct upload jobs:', directUploadJobsData.error);
                showToast(directUploadJobsData.error || 'Failed to load direct upload jobs.', 'error');
            }

            console.log("Combined Active Jobs:", combinedActiveJobs.map(j => ({ id: j.id, status: j.status, type: j.negotiation_files ? 'negotiation' : 'direct_upload' })));
            setActiveJobs(combinedActiveJobs);

            if (combinedActiveJobs.length === 0 && showNoJobsToast) { 
                showToast('No active jobs found yet.', 'info');
            }
        } catch (error) {
            console.error('Network error fetching client jobs:', error);
            showToast('Network error while fetching active jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    // Function to handle job status updates received via Socket.IO
    const handleJobUpdate = useCallback((data) => {
        console.log('ClientJobs: Job status update received via Socket. Triggering re-fetch for list cleanup.', data);
        const jobId = data.negotiationId || data.jobId; // Handle both negotiationId and jobId
        showToast(`Job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info'); 
        fetchClientJobs(); 
    }, [showToast, fetchClientJobs]);

    const handleNewChatMessageForActiveJobs = useCallback((data) => {
        console.log('ClientJobs Real-time: New chat message received!', data);
        const relatedJobId = data.negotiation_id || data.direct_upload_job_id; // Handle both types
        
        setActiveJobs(prevJobs => {
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

        showToast(`New message for job ${relatedJobId?.substring(0, 8)} from ${data.sender_name || 'Transcriber'}!`, 'info');
    }, [showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientJobs: Unauthorized access or not a client. Redirecting.");
            navigate('/'); // Redirect to home or login
            return;
        }

        fetchClientJobs();

        // Socket.IO setup for this component
        const socket = connectSocket(user.id);
        if (socket) {
            // Listen for events relevant to active jobs (completion/cancellation/taken)
            socket.on('job_completed', handleJobUpdate); // Negotiation completed
            socket.on('direct_job_completed', handleJobUpdate); // Direct upload completed
            socket.on('negotiation_cancelled', handleJobUpdate);
            socket.on('direct_job_taken', handleJobUpdate); // Direct upload job taken by transcriber
            socket.on('payment_successful', handleJobUpdate); // Payment successful (for direct upload status change)
            // Listen for job-specific chat messages
            socket.on('newChatMessage', handleNewChatMessageForActiveJobs); 

            console.log('ClientJobs: Socket listeners attached for active jobs.');
        }

        return () => {
            if (socket) {
                console.log(`ClientJobs: Cleaning up socket listeners for user ID: ${user.id}`);
                socket.off('job_completed', handleJobUpdate);
                socket.off('direct_job_completed', handleJobUpdate);
                socket.off('negotiation_cancelled', handleJobUpdate);
                socket.off('direct_job_taken', handleJobUpdate);
                socket.off('payment_successful', handleJobUpdate);
                socket.off('newChatMessage', handleNewChatMessageForActiveJobs); 
                disconnectSocket(); // Disconnect when component unmounts
            }
        };

    }, [isAuthenticated, authLoading, user, navigate, fetchClientJobs, handleJobUpdate, handleNewChatMessageForActiveJobs]);

    // Utility functions for NegotiationCard (can be shared or defined here)
    const getStatusColor = useCallback((status) => {
        const colors = {
            'pending': '#007bff',
            'transcriber_counter': '#ffc107',
            'accepted_awaiting_payment': '#28a745', 
            'rejected': '#dc3545',
            'hired': '#007bff', // For negotiation jobs
            'available_for_transcriber': '#17a2b8', // For direct upload jobs
            'taken': '#6c757d', // For direct upload jobs
            'in_progress': '#6c757d', // For direct upload jobs
            'cancelled': '#dc3545',
            'completed': '#6f42c1'
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status) => {
        const texts = {
            'pending': 'Waiting for Transcriber',
            'transcriber_counter': 'Transcriber Countered',
            'client_counter': 'Client Countered',
            'accepted_awaiting_payment': 'Accepted - Awaiting Payment', 
            'rejected': 'Rejected',
            'hired': 'Job Active - Paid',
            'available_for_transcriber': 'Available for Transcriber',
            'taken': 'Taken by Transcriber',
            'in_progress': 'In Progress',
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        };
        return texts[status] || status.replace(/_/g, ' ');
    }, []);

    // Placeholder for delete negotiation (if clients can cancel active jobs directly from here)
    const handleDeleteNegotiation = useCallback(async (negotiationId) => {
        // Implement deletion logic if needed
        showToast('Deletion not implemented for active jobs in this view.', 'info');
    }, [showToast]);

    // NEW: Open the modal to mark a job as complete
    const openMarkJobCompleteModal = useCallback((job) => {
        setJobToComplete(job);
        setClientFeedbackComment(''); // Reset comment
        setClientFeedbackRating(5); // Reset rating
        setShowCompleteJobModal(true);
    }, []);

    // NEW: Close the modal
    const closeMarkJobCompleteModal = useCallback(() => {
        setShowCompleteJobModal(false);
        setJobToComplete(null);
        setClientFeedbackComment('');
        setClientFeedbackRating(5);
        setCompleteJobModalLoading(false);
    }, []);

    // NEW: Handle comment change
    const handleFeedbackCommentChange = useCallback((e) => {
        setClientFeedbackComment(e.target.value);
    }, []);

    // NEW: Handle rating change
    const handleFeedbackRatingChange = useCallback((e) => {
        setClientFeedbackRating(parseInt(e.target.value, 10));
    }, []);


    // NEW: Function to handle marking a job as complete with feedback (client-side)
    const submitMarkJobComplete = useCallback(async () => {
        if (!jobToComplete?.id) {
            showToast('No job selected for completion!', 'error');
            return;
        }

        setCompleteJobModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            let apiUrl;
            // Determine if it's a negotiation job or a direct upload job
            if (jobToComplete.negotiation_files) { // Assuming negotiation_files is unique to negotiation jobs
                apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToComplete.id}/complete`;
            } else { // It's a direct upload job
                apiUrl = `${BACKEND_API_URL}/api/client/direct-jobs/${jobToComplete.id}/complete`;
            }

            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientFeedbackComment: clientFeedbackComment,
                    clientFeedbackRating: clientFeedbackRating
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Job marked as complete successfully! Thank you for your feedback.', 'success');
                closeMarkJobCompleteModal(); // Close the modal
                fetchClientJobs(false); // FIX: Pass false to prevent "No active jobs" toast
            } else {
                showToast(data.error || 'Failed to mark job as complete.', 'error');
            }
        } catch (error) {
            console.error('Network error marking job as complete:', error);
            showToast('Network error while marking job as complete. Please try again.', 'error');
        } finally {
            setCompleteJobModalLoading(false);
        }
    }, [jobToComplete, clientFeedbackComment, clientFeedbackRating, showToast, logout, closeMarkJobCompleteModal, fetchClientJobs]);


    // Placeholder for payment (should already be handled in ClientNegotiations)
    const handleProceedToPayment = useCallback((job) => { // Changed negotiation to job
        // Check if the job is in 'accepted_awaiting_payment' status (for negotiations) or 'pending_review' (for direct uploads before payment)
        if (job.status === 'accepted_awaiting_payment' || job.status === 'pending_review') { 
            if (!user?.email || !job?.id || !job?.agreed_price_usd && !job?.quote_amount) { // Handle both agreed_price_usd and quote_amount
                showToast('Missing client email or job details for payment.', 'error');
                return;
            }
            
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Authentication token missing. Please log in again.', 'error');
                logout();
                return;
            }

            setLoading(true);
            
            fetch(`${BACKEND_API_URL}/api/payment/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobId: job.id,
                    amount: job.agreed_price_usd || job.quote_amount, // Use appropriate amount field
                    jobType: job.negotiation_files ? 'negotiation' : 'direct_upload', // Infer jobType
                    clientEmail: user.email
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.data && data.data.authorization_url) {
                    showToast('Redirecting to payment gateway...', 'info');
                    window.location.href = data.data.authorization_url;
                } else {
                    showToast(data.error || 'Failed to initiate payment.', 'error');
                    setLoading(false);
                }
            })
            .catch(error => {
                console.error('Error initiating payment:', error);
                showToast('Network error while initiating payment. Please try again.', 'error');
                setLoading(false);
            });
        } else {
            showToast('Payment already processed for active jobs.', 'info');
        }
    }, [showToast, user, logout]);

    // NEW: Function to handle downloading negotiation files
    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => { // Added jobType parameter
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            let downloadUrl;
            if (jobType === 'negotiation') {
                downloadUrl = `${BACKEND_API_URL}/api/negotiations/${jobId}/download/${fileName}`;
            } else if (jobType === 'direct_upload') {
                // Assuming direct upload files are served from a generic /uploads/direct_upload_files/
                downloadUrl = `${BACKEND_API_URL}/uploads/direct_upload_files/${fileName}`;
            } else {
                showToast('Unknown job type for download.', 'error');
                return;
            }
            
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Get the blob from the response
                const blob = await response.blob();
                // Create a temporary URL for the blob
                const url = window.URL.createObjectURL(blob);
                // Create a temporary link element
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName; // Set the download filename
                document.body.appendChild(a);
                a.click(); // Programmatically click the link to trigger download
                a.remove(); // Clean up the link element
                window.URL.revokeObjectURL(url); // Clean up the temporary URL
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


    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="client-jobs-container">
                <div className="loading-spinner">Loading active jobs...</div>
            </div>
        );
    }

    return (
        <div className="client-jobs-container">
            <header className="client-jobs-header">
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

            <main className="client-jobs-main">
                <div className="client-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Your Current Transcription Projects</h2>
                            <p>
                                <span style={{ color: 'red', textTransform: 'uppercase', fontWeight: 'bold' }}>Note:</span>
                                <ol>
                                    <li>Track the progress of your job here. Client can ask about progress of their job or clarify something. This chat is solely dedicated for the transcriber to upload transcripts ONLY when they finish the job.</li>
                                    <li>This Chat is moderated. Exchange of personal information is highly discouraged.</li>
                                    <li>For clients, when they send a message, it appears real-time on transcriber's side but not true for clients.</li>
                                </ol>
                            </p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3>Active Jobs ({activeJobs.length})</h3>
                    <div className="active-jobs-list">
                        {activeJobs.length === 0 ? (
                            <p className="no-data-message">You currently have no active jobs.</p>
                        ) : (
                            activeJobs.map((job) => (
                                <NegotiationCard
                                    key={job.id}
                                    negotiation={job} // Pass the job object, which can be either negotiation or direct_upload
                                    onDelete={handleDeleteNegotiation} // Pass placeholder
                                    onPayment={handleProceedToPayment} 
                                    onLogout={logout}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    showToast={showToast}
                                    currentUserId={user.id}
                                    currentUserType={user.user_type}
                                    openCompleteJobModal={openMarkJobCompleteModal} 
                                    onDownloadFile={handleDownloadFile} 
                                />
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* NEW: Mark Job Complete with Feedback Modal */}
            {showCompleteJobModal && jobToComplete && (
                <Modal
                    show={showCompleteJobModal}
                    title={`Complete Job: ${jobToComplete.id?.substring(0, 8)}...`}
                    onClose={closeMarkJobCompleteModal}
                    onSubmit={submitMarkJobComplete}
                    submitText="Mark as Complete"
                    loading={completeJobModalLoading}
                    submitButtonClass="complete-training-confirm-btn" // Reuse green button style
                >
                    <p>Provide feedback for the transcriber and mark this job as complete.</p>
                    <div className="form-group">
                        <label htmlFor="clientFeedbackComment">Your Feedback (Optional):</label>
                        <textarea
                            id="clientFeedbackComment"
                            value={clientFeedbackComment}
                            onChange={handleFeedbackCommentChange}
                            placeholder="Share your thoughts on the transcriber's performance, quality of work, communication, etc."
                            rows="4"
                        ></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="clientFeedbackRating">Rate Transcriber (1-5 Stars):</label>
                        <select
                            id="clientFeedbackRating"
                            value={clientFeedbackRating}
                            onChange={handleFeedbackRatingChange}
                            required
                        >
                            <option value="5">5 Stars - Excellent</option>
                            <option value="4">4 Stars - Very Good</option>
                            <option value="3">3 Stars - Good</option>
                            <option value="2">2 Stars - Fair</option>
                            <option value="1">1 Star - Poor</option>
                        </select>
                    </div>
                    <p className="modal-note">Your rating here will be visible to the admin and will help in their overall evaluation of the transcriber.</p>
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

export default ClientJobs;
