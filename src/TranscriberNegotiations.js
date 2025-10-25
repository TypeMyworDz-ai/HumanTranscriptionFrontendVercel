// src/TranscriberNegotiations.js - FINALIZED for USD currency and syntax fix (removed inline comments from select, corrected loading block, fixed 'not defined' errors, fixed canTranscriberAccept warning)
// UPDATED: Transcribers can no longer counter the deadline. Only price and message are counterable.
// NEW: Display client's job count in negotiation cards.
// FIXED: JSX parsing error (Expected corresponding JSX closing tag for <div>)
// FIXED: Removed unused 'useRef' import

import React, { useState, useEffect, useCallback } from 'react'; // Removed useRef
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import NegotiationCard from './NegotiationCard';
import './TranscriberNegotiations.css';

import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// --- Component Definition ---
const TranscriberNegotiations = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [negotiations, setNegotiations] = useState([]);
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
    const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);

    // Removed isTranscriberAvailable state as it will be derived from user.is_online and transcriberCurrentJobId
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
            // setIsTranscriberAvailable(false); // Removed
            setTranscriberCurrentJobId(null);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.user) {
                // setIsTranscriberAvailable(data.user.is_available || true); // Removed
                setTranscriberCurrentJobId(data.user.current_job_id || null);
            } else {
                console.error('Failed to fetch transcriber detailed status:', data.error);
                // setIsTranscriberAvailable(true); // Removed
                setTranscriberCurrentJobId(null);
            }
        } catch (error) {
            console.error('Network error fetching transcriber detailed status:', error);
            // setIsTranscriberAvailable(true); // Removed
            setTranscriberCurrentJobId(null);
        }
    }, [user?.id, setTranscriberCurrentJobId]); // Removed setIsTranscriberAvailable from dependencies


    const fetchNegotiations = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token && isAuthenticated) {
            console.warn("TranscriberNegotiations: Token missing for API call despite authenticated state. Forcing logout.");
            logout();
            return;
        }
        if (!token) {
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
                setNegotiations(data.negotiations);
                console.log("Fetched Negotiations for TranscriberNegotiations:", data.negotiations.map(n => ({ 
                    id: n.id, 
                    status: n.status, 
                    clientRating: n.client_info?.client_rating, 
                    clientJobs: n.client_info?.client_completed_jobs, 
                    dueDate: n.due_date,
                    completed_at: n.completed_at,
                    client_feedback_comment: n.client_feedback_comment,
                    client_feedback_rating: n.client_feedback_rating
                })));
                if (data.negotiations.length === 0) {
                    showToast('No pending negotiation requests found.', 'info');
                }
            } else {
                console.error('Error in fetchNegotiationsData:', data.error);
                showToast(data.error || 'Failed to load negotiation requests', 'error');
            }
        } catch (error) {
            console.error("Network error while fetching negotiations:", error);
            showToast('Network error while fetching negotiation requests.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    useEffect(() => {
        if (authLoading || !isAuthenticated || !user) {
            setLoading(false);
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

        fetchNegotiations();
        fetchTranscriberDetailedStatus();
    }, [isAuthenticated, authLoading, user, navigate, fetchNegotiations, fetchTranscriberDetailedStatus, logout]);

    const handleNegotiationUpdate = useCallback((data) => {
        console.log('TranscriberNegotiations Real-time: Negotiation update received!', data);
        showToast(`Negotiation ${data.negotiationId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
        fetchNegotiations();
        fetchTranscriberDetailedStatus();
    }, [showToast, fetchNegotiations, fetchTranscriberDetailedStatus]);


    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("TranscriberNegotiations: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`TranscriberNegotiations: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        if (socket) {
            socket.on('new_negotiation_request', handleNegotiationUpdate);
            socket.on('negotiation_accepted', handleNegotiationUpdate);
            socket.on('negotiation_rejected', handleNegotiationUpdate);
            socket.on('negotiation_countered', handleNegotiationUpdate);
            socket.on('job_completed', handleNegotiationUpdate);
            socket.on('job_hired', handleNegotiationUpdate); // NEW: Listen for 'job_hired' event

            console.log('TranscriberNegotiations: Socket listeners attached.');
        }


        return () => {
            if (socket) {
                console.log(`TranscriberNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('new_negotiation_request', handleNegotiationUpdate);
                socket.off('negotiation_accepted', handleNegotiationUpdate);
                socket.off('negotiation_rejected', handleNegotiationUpdate);
                socket.off('negotiation_countered', handleNegotiationUpdate);
                socket.off('job_completed', handleNegotiationUpdate);
                socket.off('job_hired', handleNegotiationUpdate); // NEW: Clean up 'job_hired' listener
                disconnectSocket();
            }
        };
    }, [user?.id, isAuthenticated, handleNegotiationUpdate]);


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
        const currentNegotiation = negotiations.find(n => n.id === negotiationId);
        if (currentNegotiation) {
            setCounterOfferData({
                proposedPrice: currentNegotiation.agreed_price_usd?.toString() || '',
                transcriberResponse: ''
            });
        }
    }, [negotiations]);

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

    const openCompleteJobModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowCompleteJobModal(true);
    }, []);

    const closeCompleteJobModal = useCallback(() => {
        setShowCompleteJobModal(false);
        setSelectedNegotiationId(null);
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
                fetchNegotiations();
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
    }, [selectedNegotiationId, showToast, closeAcceptModal, fetchNegotiations, logout, fetchTranscriberDetailedStatus]);

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
                fetchNegotiations();
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
    }, [selectedNegotiationId, counterOfferData, showToast, closeCounterModal, fetchNegotiations, logout, fetchTranscriberDetailedStatus]);

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
                showToast(data.message || 'Negotiation rejected!', 'success');
                closeRejectModal();
                fetchNegotiations();
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
    }, [selectedNegotiationId, rejectReason, showToast, closeRejectModal, fetchNegotiations, logout, fetchTranscriberDetailedStatus]);

    const handleCompleteJob = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations/${selectedNegotiationId}/complete`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Job marked as complete!', 'success');
                closeCompleteJobModal();
                fetchNegotiations();
                fetchTranscriberDetailedStatus();
            } else {
                showToast(data.error || 'Failed to mark job as complete.', 'error');
            }
        } catch (error) {
            console.error('Error completing job:', error);
            showToast('Network error while completing job.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, showToast, closeCompleteJobModal, fetchNegotiations, logout, fetchTranscriberDetailedStatus]);


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
        if (!isClientViewing && status === 'pending') {
            return '#ffc107';
        }
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
        if (!isClientViewing && status === 'pending') {
            return 'New Offer';
        }
        return texts[status] || status;
    }, []);

    const proceedToPayment = useCallback((negotiation) => {
        localStorage.setItem('selectedNegotiation', JSON.stringify(negotiation));
        showToast('Redirecting to payment...', 'success');
        setTimeout(() => {
            navigate('/payment');
        }, 1500);
    }, [navigate, showToast]);

    const handleDeleteNegotiation = useCallback(async (negotiationId) => {
        if (!window.confirm('Are you sure you want to cancel this negotiation? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${negotiationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Negotiation cancelled successfully!', 'success');
                fetchNegotiations();
                fetchTranscriberDetailedStatus();
            } else {
                showToast(data.error || 'Failed to cancel negotiation', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchNegotiations, logout, fetchTranscriberDetailedStatus]);

    const handleDownloadFile = useCallback(async (negotiationId, fileName) => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const downloadUrl = `${BACKEND_API_URL}/api/negotiations/${negotiationId}/download/${fileName}`;
            
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
            <div className="loading-container">Loading negotiations...</div>
        );
    }

    // Derived availability: Transcriber is available if online AND has no current job
    const canTranscriberAccept = user?.is_online && !transcriberCurrentJobId;

    const query = new URLSearchParams(location.search);
    const statusFilter = query.get('status');

    let displayedNegotiations = [];
    let pageTitle = "Negotiation Room";
    let pageDescription = "Review negotiation requests from clients and decide whether to accept, counter, or reject.";
    let listSubtitle = "Ongoing Negotiations";
    let emptyMessage = "No ongoing negotiations.";

    if (statusFilter === 'active') {
        displayedNegotiations = negotiations.filter(n => n.status === 'hired');
        pageTitle = "My Active Jobs";
        pageDescription = "Track the progress of your assigned transcription jobs and communicate with clients.";
        listSubtitle = "Currently Assigned Jobs";
        emptyMessage = "No active jobs assigned to you.";
    } else if (statusFilter === 'completed') {
        displayedNegotiations = negotiations.filter(n => n.status === 'completed');
        pageTitle = "My Completed Jobs";
        pageDescription = "Review your finished transcription projects and earnings.";
        listSubtitle = "Completed Jobs";
        emptyMessage = "No completed jobs yet.";
    } else {
        displayedNegotiations = negotiations.filter(n =>
            n.status === 'pending' ||
            n.status === 'transcriber_counter' ||
            n.status === 'client_counter' ||
            n.status === 'accepted_awaiting_payment'
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
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
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
                    <div className="negotiations-list">
                        {displayedNegotiations.length === 0 ? (
                            <p>{emptyMessage}</p>
                        ) : (
                            displayedNegotiations.map(negotiation => (
                                <NegotiationCard
                                    key={negotiation.id}
                                    negotiation={negotiation}
                                    onDelete={handleDeleteNegotiation}
                                    onPayment={proceedToPayment}
                                    onLogout={logout}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    showToast={showToast}
                                    currentUserId={user.id}
                                    currentUserType={user.user_type}
                                    openAcceptModal={openAcceptModal}
                                    canAccept={
                                        (negotiation.status === 'pending' || negotiation.status === 'client_counter') && canTranscriberAccept
                                    }
                                    canCounter={
                                        (negotiation.status === 'pending' || negotiation.status === 'client_counter') && canTranscriberAccept
                                    }
                                    onOpenCounterModal={openCounterModal}
                                    openRejectModal={openRejectModal}
                                    openCompleteJobModal={openCompleteJobModal}
                                    onDownloadFile={handleDownloadFile}
                                    // FIXED: Pass client_completed_jobs to NegotiationCard
                                    clientCompletedJobs={negotiation.client_info?.client_completed_jobs}
                                    // FIXED: Pass client_rating as clientAverageRating to NegotiationCard
                                    clientAverageRating={parseFloat(negotiation.client_info?.client_average_rating) || 0}
                                />
                            ))
                        )}
                    </div>
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

            {showCompleteJobModal && (
                <Modal
                    show={showCompleteJobModal}
                    title="Mark Job as Complete"
                    onClose={closeCompleteJobModal}
                    onSubmit={handleCompleteJob}
                    submitText="Confirm Completion"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to mark this job as complete?</p>
                    <p>This will update your status and notify the client.</p>
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

export default TranscriberNegotiations;
