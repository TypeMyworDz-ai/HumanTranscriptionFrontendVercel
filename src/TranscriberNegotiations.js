// src/TranscriberNegotiations.js - Refactored to handle ONLY Negotiation Jobs
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import NegotiationCard from './NegotiationCard'; 
import './TranscriberNegotiations.css'; 

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
const TranscriberNegotiations = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [negotiationJobs, setNegotiationJobs] = useState([]); // Renamed from allJobs
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [showCounterModal, setShowCounterModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedNegotiationId, setSelectedNegotiationId] = useState(null);
    const [counterOfferData, setCounterOfferData] = useState({
        proposedPrice: '',
        transcriberResponse: ''
    });
    const [rejectReason, setRejectReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    // Removed: showSubmitJobModal state

    const [transcriberCurrentJobId, setTranscriberCurrentJobId] = useState(null);


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

    const fetchTranscriberDetailedStatus = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            setTranscriberCurrentJobId(null);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.user) {
                setTranscriberCurrentJobId(data.user.current_job_id || null);
            } else {
                console.error('Failed to fetch transcriber detailed status:', data.error);
                setTranscriberCurrentJobId(null);
            }
        } catch (error) {
            console.error('Network error fetching transcriber detailed status:', error);
            setTranscriberCurrentJobId(null);
        }
    }, [user?.id, setTranscriberCurrentJobId]);


    // Refactored: fetchNegotiationJobs to ONLY fetch negotiation jobs
    const fetchNegotiationJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            if (isAuthenticated) {
                console.warn("TranscriberNegotiations: Token or userId missing for API call despite authenticated state. Forcing logout.");
                logout();
            }
            return Promise.reject(new Error('Authentication token or userId missing.'));
        }

        setLoading(true);
        try {
            const negotiationResponse = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));

            const fetchedNegotiations = negotiationData.negotiations || [];
            
            // Add a jobType identifier and format data for table display
            const typedNegotiations = fetchedNegotiations.map(job => ({
                ...job,
                jobType: 'negotiation',
                client_name: job.client_info?.full_name || 'Unknown Client',
                client_average_rating: job.client_info?.client_average_rating || 0, 
                agreed_price_usd: job.agreed_price_usd,
                deadline_hours: job.deadline_hours,
                file_name: job.negotiation_files, // Assuming this is the relevant file for negotiation jobs
                completed_on: job.completed_at,
                transcriber_comment: job.transcriber_response, 
                client_feedback_comment: job.client_feedback_comment,
                client_feedback_rating: job.client_feedback_rating,
                transcriber_earning: job.transcriber_earning // ADDED: Transcriber's actual earning
            }));

            setNegotiationJobs(typedNegotiations); // Update state for negotiation jobs only

            console.log("TranscriberNegotiations: Fetched Negotiation Jobs:", typedNegotiations.map(j => ({
                id: j.id,
                status: j.status,
                jobType: j.jobType,
                clientName: j.client_name,
                clientRating: j.client_average_rating,
                agreedPrice: j.agreed_price_usd,
                earning: j.transcriber_earning, // ADDED: Log earning
                deadline: j.deadline_hours,
                completedOn: j.completed_on,
                transcriberComment: j.transcriber_comment, 
                clientFeedbackComment: j.client_feedback_comment, 
                clientFeedbackRating: j.client_feedback_rating 
            })));

            if (typedNegotiations.length === 0) {
                showToast('No negotiation jobs found.', 'info');
            }
        } catch (error) {
            console.error("Network error while fetching negotiation jobs:", error);
            showToast('Network error while fetching negotiation jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast, user?.id]); 


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn(`TranscriberNegotiations: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            logout();
            return;
        }

        const transcriberStatus = user.transcriber_status || '';
        const transcriberUserLevel = user.transcriber_user_level || '';
        const isTranscriber = user.user_type === 'transcriber';

        const hasActiveTranscriberStatus = isTranscriber && (transcriberStatus === 'active_transcriber' || transcriberUserLevel === 'proofreader');

        if (!isTranscriber || !hasActiveTranscriberStatus) {
            console.warn(`TranscriberNegotiations: Unauthorized access attempt by user_type: ${user.user_type}, status: ${transcriberStatus}, level: ${transcriberUserLevel}. Redirecting.`);
            logout();
            return;
        }

        fetchNegotiationJobs(); // Call the refactored fetch function
        fetchTranscriberDetailedStatus();
    }, [isAuthenticated, authLoading, user, navigate, fetchNegotiationJobs, fetchTranscriberDetailedStatus, logout]);

    const handleJobUpdate = useCallback((data) => {
        console.log('TranscriberNegotiations Real-time: Job update received! Triggering re-fetch for list cleanup.', data);
        const jobId = data.negotiationId; // Only expect negotiationId now
        showToast(`Negotiation status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
        fetchNegotiationJobs(); // Re-fetch only negotiation jobs
        fetchTranscriberDetailedStatus();
    }, [showToast, fetchNegotiationJobs, fetchTranscriberDetailedStatus]);


    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("TranscriberNegotiations: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`TranscriberNegotiations: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        if (socket) {
            socket.on('new_negotiation_request', handleJobUpdate);
            socket.on('negotiation_accepted', handleJobUpdate);
            socket.on('negotiation_rejected', handleJobUpdate);
            socket.on('negotiation_countered', handleJobUpdate);
            socket.on('job_completed', handleJobUpdate);
            socket.on('job_hired', handleJobUpdate);
            // Removed direct upload job listeners
            console.log('TranscriberNegotiations: Socket listeners attached for negotiation jobs.');
        }


        return () => {
            if (socket) {
                console.log(`TranscriberNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('new_negotiation_request', handleJobUpdate);
                socket.off('negotiation_accepted', handleJobUpdate);
                socket.off('negotiation_rejected', handleJobUpdate);
                socket.off('negotiation_countered', handleJobUpdate);
                socket.off('job_completed', handleJobUpdate);
                socket.off('job_hired', handleJobUpdate);
                // Removed direct upload job listeners
                disconnectSocket();
            }
        };
    }, [user?.id, isAuthenticated, handleJobUpdate]);


    const openAcceptModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowAcceptModal(true);
    }, []);

    const closeAcceptModal = useCallback(() => {
        setShowAcceptModal(false);
        setSelectedNegotiationId(null);
        setModalLoading(false);
    }, []);

    const openCounterModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowCounterModal(true);
        const currentNegotiation = negotiationJobs.find(n => n.id === negotiationId); // Use negotiationJobs
        if (currentNegotiation) {
            setCounterOfferData({
                proposedPrice: currentNegotiation.agreed_price_usd?.toString() || '',
                transcriberResponse: ''
            });
        }
    }, [negotiationJobs]); // Dependency on negotiationJobs

    const closeCounterModal = useCallback(() => {
        setShowCounterModal(false);
        setSelectedNegotiationId(null);
        setCounterOfferData({ proposedPrice: '', transcriberResponse: '' });
        setModalLoading(false);
    }, []);

    const openRejectModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowRejectModal(true);
        setRejectReason('');
    }, []);

    const closeRejectModal = useCallback(() => {
        setShowRejectModal(false);
        setSelectedNegotiationId(null);
        setRejectReason('');
        setModalLoading(false);
    }, []);

    // Removed: openSubmitJobModal and closeSubmitJobModal functions
    // Removed: handleSubmitJob function

    const handleCounterOfferChange = useCallback((e) => {
        setCounterOfferData({
            ...counterOfferData,
            [e.target.name]: e.target.value
        });
    }, [counterOfferData]);

    const handleRejectReasonChange = useCallback((e) => {
        setRejectReason(e.target.value);
    }, []);

    const confirmAcceptNegotiation = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/accept`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Negotiation accepted! Job is now active.', 'success');
                closeAcceptModal();
                fetchNegotiationJobs(); // Re-fetch only negotiation jobs
                fetchTranscriberDetailedStatus();
            } else {
                showToast(data.error || 'Failed to accept negotiation.', 'error');
            }
        } catch (error) {
            console.error('Error accepting negotiation:', error);
            showToast('Network error while accepting negotiation.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, showToast, closeAcceptModal, fetchNegotiationJobs, logout, fetchTranscriberDetailedStatus]);

    const confirmCounterNegotiation = useCallback(async () => {
        setModalLoading(true);
        if (!counterOfferData.proposedPrice) {
            showToast('Please provide a proposed price for your counter-offer.', 'error');
            setModalLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    proposed_price_usd: parseFloat(counterOfferData.proposedPrice),
                    transcriber_response: counterOfferData.transcriberResponse
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer sent! Awaiting client response.', 'success');
                closeCounterModal();
                fetchNegotiationJobs(); // Re-fetch only negotiation jobs
                fetchTranscriberDetailedStatus();
            } else {
                showToast(data.error || 'Failed to send counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error submitting counter-offer:', error);
            showToast('Network error while submitting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, counterOfferData, showToast, closeCounterModal, fetchNegotiationJobs, logout, fetchTranscriberDetailedStatus]);

    const confirmRejectNegotiation = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/reject`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: rejectReason || 'Transcriber rejected the offer.ᐟ'
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Negotiation rejected!.ᐟ', 'success');
                closeRejectModal();
                fetchNegotiationJobs(); // Re-fetch only negotiation jobs
                fetchTranscriberDetailedStatus();
            } else {
                showToast(data.error || 'Failed to reject negotiation.', 'error');
            }
        } catch (error) {
            console.error('Error rejecting negotiation:', error);
            showToast('Network error while rejecting negotiation.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, rejectReason, showToast, closeRejectModal, fetchNegotiationJobs, logout, fetchTranscriberDetailedStatus]);

    // Removed: handleSubmitJob (as it's not needed for transcribers in negotiation jobs)

    const getStatusColor = useCallback((status) => { 
        const colors = {
            'pending': '#ffc107',
            'transcriber_counter': '#007bff',
            'client_counter': '#6c757d',
            'accepted_awaiting_payment': '#28a745',
            'rejected': '#dc3545',
            'hired': '#007bff', 
            'taken': '#007bff', 
            'cancelled': '#dc3545',
            'completed': '#6f42c1', // Reverted to original 'completed' status text
            'client_completed': '#6f42c1' 
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status) => { 
        const texts = {
            'pending': 'New Offer',
            'transcriber_counter': 'Counter-Offer Sent', 
            'client_counter': 'Client Counter-Offer',
            'accepted_awaiting_payment': 'Accepted - Awaiting Payment',
            'rejected': 'Rejected',
            'hired': 'Job Hired',
            'taken': 'Job Taken',
            'cancelled': 'Cancelled',
            'completed': 'Completed by Client', // Updated to reflect client completion
            'client_completed': 'Completed by Client'
        };
        return texts[status] || status;
    }, []);

    const handleDeleteJob = useCallback(async (jobId, jobType) => { 
        if (!window.confirm('Are you sure you want to delete this job from your list? This action cannot be undone.')) {
            return;
        }
        if (jobType !== 'negotiation') { // Only allow deletion for negotiation jobs here
            showToast('Only negotiation jobs can be deleted from this view.', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }

            let apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobId}`;
            
            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Negotiation job deleted successfully!ᐟ', 'success');
                fetchNegotiationJobs(); // Re-fetch only negotiation jobs
                fetchTranscriberDetailedStatus();
            } else {
                showToast(data.error || 'Failed to delete negotiation job', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.ᐟ', 'error');
        }
    }, [showToast, fetchNegotiationJobs, logout, fetchTranscriberDetailedStatus]);

    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => { 
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }
        if (jobType !== 'negotiation') { // Only allow download for negotiation jobs here
            showToast('Only negotiation job files can be downloaded from this view.', 'error');
            return;
        }

        try {
            const downloadUrl = `${BACKEND_API_URL}/api/negotiations/${jobId}/download/${fileName}`;
            
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


    if (authLoading || !isAuthenticated || !user) {
        return <div className="loading-container">Loading authentication...</div>;
    }

    if (loading) {
        return (
            <div className="loading-container">Loading jobs...</div>
        );
    }

    const canTranscriberAccept = user?.is_online && !transcriberCurrentJobId;

    const query = new URLSearchParams(location.search);
    const statusFilter = query.get('status');

    let displayedJobs = [];
    let pageTitle = "Negotiation Room";
    let pageDescription = "Review negotiation requests from clients and decide whether to accept, counter, or reject.";
    let listSubtitle = "Ongoing Negotiations";
    let emptyMessage = "No ongoing negotiations.";

    if (statusFilter === 'active') {
        displayedJobs = negotiationJobs.filter(job =>
            job.status === 'hired'
        );
        pageTitle = "My Negotiation Jobs"; // Specific title
        pageDescription = "Track the progress of your assigned negotiation jobs and communicate with clients.";
        listSubtitle = "Currently Assigned Negotiation Jobs";
        emptyMessage = "No active negotiation jobs assigned to you.";
    } else if (statusFilter === 'completed') {
        displayedJobs = negotiationJobs.filter(job =>
            job.status === 'completed' || job.status === 'client_completed' // Include client_completed for transcriber's completed view
        );
        pageTitle = "My Completed Negotiation Jobs"; // Specific title
        pageDescription = "Review your finished negotiation projects and earnings.";
        listSubtitle = "Completed Negotiation Jobs";
        emptyMessage = "No completed negotiation jobs yet.";
    } else { // Default to 'Negotiation Room' view
        displayedJobs = negotiationJobs.filter(job =>
            job.status === 'pending' ||
            job.status === 'transcriber_counter' ||
            job.status === 'client_counter' ||
            job.status === 'accepted_awaiting_payment'
        );
        pageTitle = "Negotiation Room";
        pageDescription = "Review negotiation requests from clients and decide whether to accept, counter, or reject.";
        listSubtitle = "Ongoing Negotiations";
        emptyMessage = "No ongoing negotiations.";
    }


    return (
        <div className="transcriber-negotiations-container">
            <header className="transcriber-negotiations-header">
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

            <main className="transcriber-negotiations-main">
                <div className="transcriber-negotiations-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>{pageTitle}</h2>
                            <p>{pageDescription}</p>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3 className="negotiation-room-subtitle">{listSubtitle}</h3>
                    {statusFilter === 'completed' ? ( // Render table for completed negotiation jobs
                        <div className="completed-jobs-list-table">
                            {displayedJobs.length === 0 ? (
                                <p className="no-data-message">{emptyMessage}</p>
                            ) : (
                                <table className="completed-jobs-table">
                                    <thead>
                                        <tr>
                                            <th>Job ID</th>
                                            <th>Client</th>
                                            {/* Removed 'Your Pay (USD)' column */}
                                            <th>Deadline</th>
                                            <th>Status</th>
                                            <th>Completed On</th>
                                            <th>Your Comment</th>
                                            <th>Client Feedback</th>
                                            {/* Removed 'Actions' column */}
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
                                                {/* Removed 'Your Pay (USD)' data cell */}
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
                                                {/* Removed 'Actions' data cell */}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : ( // Render cards for other views (Negotiation Room, Active Jobs)
                        <div className="negotiations-list">
                            {displayedJobs.length === 0 ? (
                                <p>{emptyMessage}</p>
                            ) : (
                                displayedJobs.map(job => (
                                    <NegotiationCard
                                        key={job.id}
                                        job={job}
                                        jobType={job.jobType}
                                        onDelete={handleDeleteJob}
                                        onPayment={null} 
                                        onLogout={logout}
                                        getStatusColor={getStatusColor}
                                        getStatusText={getStatusText}
                                        showToast={showToast}
                                        currentUserId={user.id}
                                        currentUserType={user.user_type}
                                        openAcceptModal={openAcceptModal}
                                        canAccept={
                                            job.jobType === 'negotiation' && (job.status === 'pending' || job.status === 'client_counter') && canTranscriberAccept
                                        }
                                        canCounter={
                                            job.jobType === 'negotiation' && (job.status === 'pending' || job.status === 'client_counter') && canTranscriberAccept
                                        }
                                        onOpenCounterModal={openCounterModal}
                                        openRejectModal={openRejectModal}
                                        openCompleteJobModal={null} // Client's complete job modal should not be passed here
                                        // Removed: openTranscriberSubmitJobModal prop
                                        onDownloadFile={handleDownloadFile}
                                        clientCompletedJobs={job.client_info?.client_completed_jobs || job.client?.client_completed_jobs || 0}
                                        clientAverageRating={parseFloat(job.client_info?.client_average_rating || job.client?.client_average_rating) || 0}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </main>

            {showAcceptModal && (
                <Modal
                    show={showAcceptModal}
                    title="Accept Negotiation"
                    onClose={closeAcceptModal}
                    onSubmit={confirmAcceptNegotiation}
                    submitText="Confirm Accept"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to accept this negotiation?</p>
                    <p>By accepting, you commit to completing the job under the agreed terms.</p>
                </Modal>
            )}

            {showCounterModal && (
                <Modal
                    show={showCounterModal}
                    title="Counter Negotiation"
                    onClose={closeCounterModal}
                    onSubmit={confirmCounterNegotiation}
                    submitText="Send Counter-Offer"
                    loading={modalLoading}
                >
                    <p>Propose new terms for this negotiation:</p>
                    <div className="form-group">
                        <label htmlFor="proposedPrice">Proposed Price (USD):</label>
                        <input
                            id="proposedPrice"
                            type="number"
                            name="proposedPrice"
                            value={counterOfferData.proposedPrice}
                            onChange={handleCounterOfferChange}
                            placeholder="Enter your counter-offer in USD"
                            min="1"
                            step="0.01"
                            required
                        />
                    </div>
                    {/* Removed the deadlineHours input field as transcribers cannot counter it */}
                    <div className="form-group">
                        <label htmlFor="transcriberResponse">Your Message (Optional):</label>
                        <textarea
                            id="transcriberResponse"
                            name="transcriberResponse"
                            value={counterOfferData.transcriberResponse}
                            onChange={handleCounterOfferChange}
                            placeholder="e.g., 'I can do this for USD 15.00 in 3 hours.'"
                            rows="3"
                        ></textarea>
                    </div>
                </Modal>
            )}

            {showRejectModal && (
                <Modal
                    show={showRejectModal}
                    title="Reject Negotiation"
                    onClose={closeRejectModal}
                    onSubmit={confirmRejectNegotiation}
                    submitText="Confirm Reject"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to reject this negotiation?</p>
                    <p>This action will close the negotiation for this job.</p>
                    <div className="form-group">
                        <label htmlFor="rejectReason">Reason for Rejection (Optional):</label>
                        <textarea
                            id="rejectReason"
                            name="rejectReason"
                            value={rejectReason}
                            onChange={handleRejectReasonChange}
                            placeholder="e.g., 'Currently unavailable for new jobs' or 'Project requirements do not match my expertise.'"
                            rows="3"
                        ></textarea>
                    </div>
                </Modal>
            )}

            {/* Removed: showSubmitJobModal and its associated Modal JSX */}

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

export default TranscriberNegotiations;
