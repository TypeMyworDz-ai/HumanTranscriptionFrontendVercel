import React, { useState, useEffect, useCallback } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; 
import NegotiationCard from './NegotiationCard'; 
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

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Placeholder for opening modals (these would be passed to NegotiationCard)
    const openAcceptModal = useCallback((negotiationId) => showToast('Accept not allowed for active jobs.', 'info'), [showToast]);
    const onOpenCounterModal = useCallback((negotiationId) => showToast('Counter not allowed for active jobs.', 'info'), [showToast]);
    const openRejectModal = useCallback((negotiationId) => showToast('Reject not allowed for active jobs.', 'info'), [showToast]);

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
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                const fetchedNegotiations = data.negotiations || [];
                // Filter for only 'hired' status for Active Jobs
                const jobs = fetchedNegotiations.filter(n => n.status === 'hired');
                console.log("TranscriberJobs: Filtered Active Jobs:", jobs.map(j => ({ id: j.id, status: j.status })));
                setActiveJobs(jobs);
                if (jobs.length === 0) {
                    showToast('No active jobs found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load active jobs.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching transcriber jobs:', error);
            showToast('Network error while fetching active jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);


    // Function to handle job status updates received via Socket.IO
    const handleJobUpdate = useCallback((data) => {
        console.log('TranscriberJobs: Job status update received via Socket. Triggering re-fetch for list cleanup.  Data:', data);
        showToast(`Job status updated for ID: ${data.negotiationId?.substring(0, 8)}.`, 'info'); // FIX: Changed data.negotiation_id to data.negotiationId
        // A full re-fetch is necessary here to remove completed jobs from the 'activeJobs' filter
        fetchTranscriberJobs(); 
    }, [showToast, fetchTranscriberJobs]);

    // --- Real-time Message Handling for Active Jobs (Job-specific Messages) ---
    const handleNewChatMessageForActiveJobs = useCallback((data) => {
        console.log('TranscriberJobs Real-time: New chat message received!', data);
        const receivedNegotiationId = data.negotiationId; // FIX: Changed data.negotiation_id to data.negotiationId
        
        setActiveJobs(prevJobs => {
            const isForActiveJob = prevJobs.some(job => job.id === receivedNegotiationId);

            if (!isForActiveJob) return prevJobs; 

            return prevJobs.map(job => {
                if (job.id === receivedNegotiationId) {
                    return {
                        ...job,
                        last_message_text: data.message || 'New file uploaded.', 
                        last_message_timestamp: new Date().toISOString(),
                    };
                }
                return job;
            });
        });

        showToast(`New message for job ${receivedNegotiationId} from ${data.sender_name || 'Client'}!`, 'info');
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
            // Listen for events relevant to active jobs
            socket.on('job_completed', handleJobUpdate);
            socket.on('job_hired', handleJobUpdate); 
            socket.on('negotiation_cancelled', handleJobUpdate); 
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
            'hired': '#007bff',
            'cancelled': '#dc3545',
            'completed': '#6f42c1'
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
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        };
        return texts[status] || status;
    }, []);

    // Delete negotiation handler (placeholder for active jobs - usually not deleted directly)
    const handleDeleteNegotiation = useCallback(async (negotiationId) => {
        showToast('Deletion not allowed for active jobs.', 'error');
    }, [showToast]);

    // NEW: Function to handle downloading negotiation files
    const handleDownloadFile = useCallback(async (negotiationId, fileName) => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            // Construct the API endpoint URL
            const downloadUrl = `${BACKEND_API_URL}/api/negotiations/${negotiationId}/download/${fileName}`;
            
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
                                <ol>
                                    <li>Track the progress of your assigned job here. Clients can ask about job progress or clarify something. This chat is solely dedicated for you to upload transcripts ONLY when you finish the job. Exhaust job prerequisites and details in Negotiation Room.</li>
                                    <li>Exchange of personal information is highly discouraged.</li>
                                    <li>This Chat is moderated. Messages you send will appear real-time on the client's side.</li>
                                </ol>
                            </p>
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
                            activeJobs.map((job) => (
                                <NegotiationCard
                                    key={job.id}
                                    negotiation={job}
                                    onDelete={handleDeleteNegotiation}
                                    onPayment={() => showToast('Payment is handled by client.', 'info')} // Placeholder
                                    onLogout={logout}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    showToast={showToast}
                                    currentUserId={user.id}
                                    currentUserType={user.user_type}
                                    openAcceptModal={openAcceptModal}
                                    canAccept={false} // Transcriber cannot accept an already hired job
                                    canCounter={false} // Transcriber cannot counter an already hired job
                                    onOpenCounterModal={onOpenCounterModal}
                                    openRejectModal={openRejectModal}
                                    onDownloadFile={handleDownloadFile} // NEW: Pass the download function
                                    // Removed openCompleteJobModal as 'Mark Complete' is now client-side
                                />
                            ))
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

export default TranscriberJobs;
