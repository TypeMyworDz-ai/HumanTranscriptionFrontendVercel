// src/ClientNegotiations.js - UPDATED to handle direct upload jobs and ensure correct transcriber info for negotiation cards
// FIXED: Removed undefined references to 'setJobToComplete', 'jobToComplete', 'getStatusColor', 'getStatusText', 'submitMarkJobComplete'.
// ClientNegotiations should not handle the 'Mark as Complete' modal directly.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import NegotiationCard from './NegotiationCard';
import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';
import './ClientNegotiations.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientNegotiations = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [allJobs, setAllJobs] = useState([]); // Renamed from negotiations
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

    const [showAcceptCounterModal, setShowAcceptCounterModal] = useState(false);
    const [showRejectCounterModal, setShowRejectCounterModal] = useState(false);
    const [showCounterBackModal, setShowCounterBackModal] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(null); // Renamed from selectedNegotiationId
    const [counterOfferData, setCounterOfferData] = useState({
        proposedPrice: '',
        clientResponse: ''
    });
    const [rejectReason, setRejectReason] = useState('');
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

    // UPDATED: fetchAllClientJobs to fetch both negotiation and direct upload jobs
    const fetchAllClientJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token && isAuthenticated) {
            console.warn("ClientNegotiations: Token missing for API call despite authenticated state. Forcing logout.");
            logout();
            return;
        }
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [negotiationResponse, directUploadResponse] = await Promise.all([
                fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${BACKEND_API_URL}/api/client/direct-jobs`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));
            const directUploadData = await (directUploadResponse.ok ? directUploadResponse.json() : Promise.resolve({ jobs: [] }));

            const fetchedNegotiations = negotiationData.negotiations || [];
            const fetchedDirectUploadJobs = directUploadData.jobs || [];

            // Add a jobType identifier to each job
            const typedNegotiations = fetchedNegotiations.map(job => ({ ...job, jobType: 'negotiation' }));
            const typedDirectUploadJobs = fetchedDirectUploadJobs.map(job => ({ ...job, jobType: 'direct_upload' }));

            const combinedJobs = [...typedNegotiations, ...typedDirectUploadJobs];
            setAllJobs(combinedJobs);

            console.log("ClientNegotiations: Fetched All Jobs:", combinedJobs.map(j => ({
                id: j.id,
                status: j.status,
                jobType: j.jobType,
                transcriberName: j.transcriber_info?.full_name || j.transcriber?.full_name,
                transcriberRating: j.transcriber_info?.transcriber_average_rating || j.transcriber?.transcriber_average_rating,
                transcriberCompletedJobs: j.transcriber_info?.transcriber_completed_jobs || j.transcriber?.transcriber_completed_jobs
            })));

            if (combinedJobs.length === 0) {
                showToast('No jobs found.', 'info');
            }
        } catch (error) {
            console.error("Network error while fetching all client jobs:", error);
            showToast('Network error while fetching jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast, user?.id]);


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn(`ClientNegotiations: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            navigate('/');
            return;
        }

        fetchAllClientJobs();
    }, [isAuthenticated, authLoading, user, navigate, fetchAllClientJobs]);

    const handleJobUpdate = useCallback((data) => {
        console.log('ClientNegotiations Real-time: Job status update received! Triggering re-fetch for list cleanup.', data);
        const jobId = data.negotiationId || data.jobId;
        showToast(`Job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
        fetchAllClientJobs();
    }, [showToast, fetchAllClientJobs]);


    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("ClientNegotiations: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`ClientNegotiations: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        if (socket) {
            socket.on('negotiation_accepted', handleJobUpdate);
            socket.on('negotiation_rejected', handleJobUpdate);
            socket.on('negotiation_countered', handleJobUpdate);
            socket.on('negotiation_cancelled', handleJobUpdate);
            socket.on('job_completed', handleJobUpdate); // For negotiation jobs completed by transcriber
            socket.on('direct_job_taken', handleJobUpdate); // For direct upload jobs taken by transcriber
            socket.on('direct_job_completed', handleJobUpdate); // For direct upload jobs completed by transcriber
            socket.on('direct_job_client_completed', handleJobUpdate); // For direct upload jobs client-completed

            console.log('ClientNegotiations: Socket listeners attached.');
        }

        return () => {
            if (socket) {
                console.log(`ClientNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('negotiation_accepted', handleJobUpdate);
                socket.off('negotiation_rejected', handleJobUpdate);
                socket.off('negotiation_countered', handleJobUpdate);
                socket.off('negotiation_cancelled', handleJobUpdate);
                socket.off('job_completed', handleJobUpdate);
                socket.off('direct_job_taken', handleJobUpdate);
                socket.off('direct_job_completed', handleJobUpdate);
                socket.off('direct_job_client_completed', handleJobUpdate);
                disconnectSocket();
            }
        };
    }, [user?.id, isAuthenticated, handleJobUpdate]);


    const openAcceptCounterModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowAcceptCounterModal(true);
    }, []);

    const closeAcceptCounterModal = useCallback(() => {
        setShowAcceptCounterModal(false);
        setSelectedJobId(null);
        setModalLoading(false);
    }, []);

    const openRejectCounterModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowRejectCounterModal(true);
        setRejectReason('');
    }, []);

    const closeRejectCounterModal = useCallback(() => {
        setShowRejectCounterModal(false);
        setSelectedJobId(null);
        setRejectReason('');
        setModalLoading(false);
    }, []);

    const openCounterBackModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowCounterBackModal(true);
        const currentJob = allJobs.find(n => n.id === jobId);
        if (currentJob) {
            setCounterOfferData({
                proposedPrice: currentJob.agreed_price_usd?.toString() || '',
                clientResponse: ''
            });
        }
    }, [allJobs]);

    const closeCounterBackModal = useCallback(() => {
        setShowCounterBackModal(false);
        setSelectedJobId(null);
        setCounterOfferData({ proposedPrice: '', clientResponse: '' });
        setModalLoading(false);
    }, []);

    const handleCounterOfferChange = useCallback((e) => {
        setCounterOfferData({
            ...counterOfferData,
            [e.target.name]: e.target.value
        });
    }, [counterOfferData]);

    const handleRejectReasonChange = useCallback((e) => {
        setRejectReason(e.target.value);
    }, []);

    const confirmAcceptCounter = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedJobId}/client/accept-counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer accepted! Proceed to payment.', 'success');
                closeAcceptCounterModal();
                fetchAllClientJobs();
            } else {
                showToast(data.error || 'Failed to accept counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error accepting counter-offer:', error);
            showToast('Network error while accepting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, showToast, closeAcceptCounterModal, fetchAllClientJobs, logout]);

    const confirmRejectCounter = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedJobId}/client/reject-counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ client_response: rejectReason })
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer rejected!', 'success');
                closeRejectCounterModal();
                fetchAllClientJobs();
            } else {
                showToast(data.error || 'Failed to reject counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error rejecting counter-offer:', error);
            showToast('Network error while rejecting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, rejectReason, showToast, closeRejectCounterModal, fetchAllClientJobs, logout]);

    const confirmCounterBack = useCallback(async () => {
        setModalLoading(true);
        if (!counterOfferData.proposedPrice) {
            showToast('Please provide a proposed price for your counter-offer.', 'error');
            setModalLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedJobId}/client/counter-back`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    proposed_price_usd: parseFloat(counterOfferData.proposedPrice),
                    client_response: counterOfferData.clientResponse
                })
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer sent successfully!', 'success');
                closeCounterBackModal();
                fetchAllClientJobs();
            } else {
                showToast(data.error || 'Failed to send counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error sending counter-offer back:', error);
            showToast('Network error while sending counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, counterOfferData, showToast, closeCounterBackModal, fetchAllClientJobs, logout]);

    // MODIFIED: handleProceedToPayment to use new dedicated endpoints
    const handleProceedToPayment = useCallback(async (job) => {
        if (!user?.email || !job?.id || (!job?.agreed_price_usd && !job?.quote_amount)) {
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

        let paymentApiUrl;
        let amountToSend;

        // Determine the correct payment initiation endpoint and amount based on job type
        if (job.jobType === 'negotiation') {
            paymentApiUrl = `${BACKEND_API_URL}/api/negotiations/${job.id}/payment/initialize`;
            amountToSend = job.agreed_price_usd;
        } else if (job.jobType === 'direct_upload') {
            paymentApiUrl = `${BACKEND_API_URL}/api/direct-uploads/${job.id}/payment/initialize`;
            amountToSend = job.quote_amount;
        } else {
            showToast('Unknown job type for payment initiation.', 'error');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(paymentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    negotiationId: job.id, // Use negotiationId for negotiation, jobId for direct upload (backend handles mapping)
                    jobId: job.id, // Also send jobId for direct uploads
                    amount: amountToSend,
                    email: user.email,
                    paymentMethod: 'paystack' // Default to Paystack for now, can be dynamic if UI allows
                })
            });
            const data = await response.json();

            if (response.ok && data.data && data.data.authorization_url) {
                showToast('Redirecting to payment gateway...', 'info');
                window.location.href = data.data.authorization_url;
            } else {
                showToast(data.error || 'Failed to initiate payment.', 'error');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            showToast('Network error while initiating payment. Please try again.', 'error');
            setLoading(false);
        }
    }, [showToast, user, logout]);

    const handleDeleteJob = useCallback(async (jobId, jobType) => {
        if (!window.confirm('Are you sure you want to cancel/delete this job? This action cannot be undone.')) {
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
                showToast('Job cancelled/deleted successfully!', 'success');
                fetchAllClientJobs();
            } else {
                showToast(data.error || 'Failed to cancel/delete job', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchAllClientJobs, logout]);

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


    // REMOVED: isClientViewing parameter as it's always client here
    const getStatusColor = useCallback((status) => {
        const colors = {
            'pending': '#007bff',
            'transcriber_counter': '#ffc107',
            'accepted_awaiting_payment': '#28a745',
            'rejected': '#dc3545',
            'hired': '#007bff',
            'available_for_transcriber': '#17a2b8',
            'taken': '#6c757d',
            'in_progress': '#6c757d',
            'cancelled': '#dc3545',
            'completed': '#6f42c1',
            'client_completed': '#6f42c1'
        };
        return colors[status] || '#6c757d';
    }, []);

    // REMOVED: isClientViewing parameter as it's always client here
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
            'completed': 'Completed by Transcriber',
            'client_completed': 'Completed by Client'
        };
        return texts[status] || status.replace(/_/g, ' ');
    }, []);


    if (authLoading || !isAuthenticated || !user) {
        return <div className="loading-container">Loading authentication...</div>;
    }

    if (loading) {
        return (
            <div className="loading-container">Loading negotiations...</div>
        );
    }

    const query = new URLSearchParams(location.search);
    const statusFilter = query.get('status');

    let displayedJobs = [];
    let pageTitle = "Negotiation Room";
    let pageDescription = "Manage all ongoing offers, counter-offers, and awaiting payment statuses for your transcription jobs.";
    let listSubtitle = "Ongoing Negotiations";
    let emptyMessage = "No ongoing negotiations.";

    if (statusFilter === 'active') {
        displayedJobs = allJobs.filter(job =>
            (job.jobType === 'negotiation' && job.status === 'hired') ||
            (job.jobType === 'direct_upload' && (job.status === 'taken' || job.status === 'in_progress' || job.status === 'completed'))
        );
        pageTitle = "My Active Jobs";
        pageDescription = "Track the progress of your active transcription jobs and communicate with transcribers.";
        listSubtitle = "Currently Active Jobs";
        emptyMessage = "You currently have no active jobs.";
    } else if (statusFilter === 'completed') {
        displayedJobs = allJobs.filter(job =>
            (job.jobType === 'negotiation' && job.status === 'completed') ||
            (job.jobType === 'direct_upload' && job.status === 'client_completed')
        );
        pageTitle = "My Completed Jobs";
        pageDescription = "Review your finished projects and provide feedback.";
        listSubtitle = "Completed Jobs";
        emptyMessage = "You currently have no completed jobs.";
    } else { // Default to 'Negotiation Room' view
        displayedJobs = allJobs.filter(job =>
            job.jobType === 'negotiation' && (
                job.status === 'pending' ||
                job.status === 'transcriber_counter' ||
                job.status === 'client_counter' ||
                job.status === 'accepted_awaiting_payment'
            )
        );
        pageTitle = "Negotiation Room";
        pageDescription = "Manage all ongoing offers, counter-offers, and awaiting payment statuses for your transcription jobs.";
        listSubtitle = "Ongoing Negotiations";
        emptyMessage = "No ongoing negotiations.";
    }


    return (
        <div className="client-negotiations-container">
            <header className="client-negotiations-header">
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

            <main className="client-negotiations-main">
                <div className="client-negotiations-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>{pageTitle}</h2>
                            <p>{pageDescription}</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3 className="negotiation-room-subtitle">{listSubtitle}</h3>
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
                                    onPayment={handleProceedToPayment}
                                    onLogout={logout}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    showToast={showToast}
                                    currentUserId={user.id}
                                    currentUserType={user.user_type}
                                    openAcceptCounterModal={openAcceptCounterModal}
                                    openRejectCounterModal={openRejectCounterModal}
                                    openCounterBackModal={openCounterBackModal}
                                    onDownloadFile={handleDownloadFile}
                                    clientAverageRating={parseFloat(user.client_average_rating) || 0}
                                    clientCompletedJobs={parseFloat(user.client_completed_jobs) || 0}
                                />
                            ))
                        )}
                    </div>
                </div>
            </main>

            {showAcceptCounterModal && (
                <Modal
                    show={showAcceptCounterModal}
                    title="Accept Counter-Offer"
                    onClose={closeAcceptCounterModal}
                    onSubmit={confirmAcceptCounter}
                    submitText="Confirm Accept"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to accept this counter-offer?</p>
                    <p>By accepting, you agree to the new terms and will proceed to payment.</p>
                </Modal>
            )}

            {showRejectCounterModal && (
                <Modal
                    show={showRejectCounterModal}
                    title="Reject Counter-Offer"
                    onClose={closeRejectCounterModal}
                    onSubmit={confirmRejectCounter}
                    submitText="Confirm Reject"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to reject this counter-offer?</p>
                    <p>This action will close the negotiation for this offer.</p>
                    <div className="form-group">
                        <label htmlFor="rejectReason">Reason for Rejection (Optional):</label>
                        <textarea
                            id="rejectReason"
                            name="rejectReason"
                            value={rejectReason}
                            onChange={handleRejectReasonChange}
                            placeholder="e.g., 'Price too high' or 'Deadline too long.'"
                            rows="3"
                        ></textarea>
                    </div>
                </Modal>
            )}

            {showCounterBackModal && (
                <Modal
                    show={showCounterBackModal}
                    title="Counter Back"
                    onClose={closeCounterBackModal}
                    onSubmit={confirmCounterBack}
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
                    <div className="form-group">
                        <label htmlFor="clientResponse">Your Message (Optional):</label>
                        <textarea
                            id="clientResponse"
                            name="clientResponse"
                            value={counterOfferData.clientResponse}
                            onChange={handleCounterOfferChange}
                            placeholder="e.g., 'I can only offer USD 12.00.'"
                            rows="3"
                        ></textarea>
                    </div>
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

export default ClientNegotiations;
