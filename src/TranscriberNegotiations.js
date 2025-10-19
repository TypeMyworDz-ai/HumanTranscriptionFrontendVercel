// src/TranscriberNegotiations.js - FINALIZED for USD currency and syntax fix (removed inline comments from select, corrected loading block, fixed 'not defined' errors, fixed canTranscriberAccept warning)

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
        proposedPrice: '', // This will now be in USD
        deadlineHours: '',
        transcriberResponse: ''
    });
    const [rejectReason, setRejectReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);

    // CRITICAL: Restored and verified state variables
    const [isTranscriberAvailable, setIsTranscriberAvailable] = useState(true); // Default to true
    const [transcriberCurrentJobId, setTranscriberCurrentJobId] = useState(null);


    const navigate = useNavigate();

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

    // CRITICAL: Restored and verified fetchTranscriberDetailedStatus
    const fetchTranscriberDetailedStatus = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            setIsTranscriberAvailable(false);
            setTranscriberCurrentJobId(null);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}`, { // Using the adminController's endpoint for comprehensive user data
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.user) {
                setIsTranscriberAvailable(data.user.is_available || true); // Default to true
                setTranscriberCurrentJobId(data.user.current_job_id || null);
            } else {
                console.error('Failed to fetch transcriber detailed status:', data.error);
                setIsTranscriberAvailable(true); // Default to true on error
                setTranscriberCurrentJobId(null);
            }
        } catch (error) {
            console.error('Network error fetching transcriber detailed status:', error);
            setIsTranscriberAvailable(true); // Default to true on error
            setTranscriberCurrentJobId(null);
        }
    }, [user?.id, setIsTranscriberAvailable, setTranscriberCurrentJobId]); // CRITICAL: Correct dependencies for state setters


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

        const userStatus = user.status || '';
        const userLevel = user.user_level || '';
        const isTranscriber = user.user_type === 'transcriber';

        const hasActiveTranscriberStatus = isTranscriber && (userStatus === 'active_transcriber' || userLevel === 'proofreader');

        if (!isTranscriber || !hasActiveTranscriberStatus) {
            console.warn(`TranscriberNegotiations: Unauthorized access attempt by user_type: ${user.user_type}, status: ${userStatus}, level: ${userLevel}. Redirecting.`);
            navigate('/');
            return;
        }

        // Fetch negotiations and transcriber's detailed status
        fetchNegotiations();
        fetchTranscriberDetailedStatus(); // Fetch detailed status when component mounts or user changes
    }, [isAuthenticated, authLoading, user, navigate, fetchNegotiations, fetchTranscriberDetailedStatus]);

    // CRITICAL: handleNegotiationUpdate defined correctly here, outside useEffect
    const handleNegotiationUpdate = useCallback((data) => {
        console.log('TranscriberNegotiations Real-time: Negotiation update received!', data);
        showToast(`Negotiation ${data.negotiationId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
        fetchNegotiations();
        fetchTranscriberDetailedStatus(); // Refresh status on new request
    }, [showToast, fetchNegotiations, fetchTranscriberDetailedStatus]);


    // --- Socket.IO Event Listeners ---
    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("TranscriberNegotiations: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`TranscriberNegotiations: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        // All handlers use the top-level useCallback definitions
        socket.on('new_negotiation_request', handleNegotiationUpdate);
        socket.on('negotiation_accepted', handleNegotiationUpdate);
        socket.on('negotiation_rejected', handleNegotiationUpdate);
        socket.on('negotiation_countered', handleNegotiationUpdate);
        socket.on('job_completed', handleNegotiationUpdate); // Re-use general update handler for job completion


        return () => {
            console.log(`TranscriberNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
            socket.off('new_negotiation_request', handleNegotiationUpdate);
            socket.off('negotiation_accepted', handleNegotiationUpdate);
            socket.off('negotiation_rejected', handleNegotiationUpdate);
            socket.off('negotiation_countered', handleNegotiationUpdate);
            socket.off('job_completed', handleNegotiationUpdate);
            disconnectSocket();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, isAuthenticated, handleNegotiationUpdate]);


    // --- Modal Handlers ---
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
                proposedPrice: currentNegotiation.agreed_price_usd?.toString() || '', // UPDATED: Use agreed_price_usd
                deadlineHours: currentNegotiation.deadline_hours?.toString() || '',
                transcriberResponse: ''
            });
        }
    }, [negotiations]);

    const closeCounterModal = useCallback(() => {
        setShowCounterModal(false);
        setSelectedNegotiationId(null);
        setCounterOfferData({ proposedPrice: '', deadlineHours: '', transcriberResponse: '' });
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

    // --- ACTUAL API Actions ---
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
                fetchTranscriberDetailedStatus(); // Refresh status on successful accept
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
        if (!counterOfferData.proposedPrice || !counterOfferData.deadlineHours) {
            showToast('Please provide both a price and a deadline for your counter-offer.', 'error');
            setModalLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations/${selectedNegotiationId}/counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    proposed_price_usd: parseFloat(counterOfferData.proposedPrice), // UPDATED: Use proposed_price_usd
                    deadline_hours: parseInt(counterOfferData.deadlineHours, 10),
                    transcriber_response: counterOfferData.transcriberResponse
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer sent! Awaiting client response.', 'success');
                closeCounterModal();
                fetchNegotiations();
                fetchTranscriberDetailedStatus(); // Refresh status on successful counter
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
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations/${selectedNegotiationId}/reject`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    transcriber_response: rejectReason || 'Transcriber rejected the offer.'
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Negotiation rejected!', 'success');
                closeRejectModal();
                fetchNegotiations();
                fetchTranscriberDetailedStatus(); // Refresh status on successful reject
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
                fetchTranscriberDetailedStatus(); // Refresh status on successful complete
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


    // --- Utility Functions for Status Display ---
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

    // --- Navigation to Payment (placeholder) ---
    const proceedToPayment = useCallback((negotiation) => {
        localStorage.setItem('selectedNegotiation', JSON.stringify(negotiation));
        showToast('Redirecting to payment...', 'success');
        setTimeout(() => {
            navigate('/payment');
        }, 1500);
    }, [navigate, showToast]);

    // --- Delete Negotiation Handler ---
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
                fetchTranscriberDetailedStatus(); // Refresh status on successful delete
            } else {
                showToast(data.error || 'Failed to cancel negotiation', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchNegotiations, logout, fetchTranscriberDetailedStatus]);

    if (authLoading || !isAuthenticated || !user) {
        return <div className="loading-container">Loading authentication...</div>;
    }

    if (loading) {
        return (
            <div className="loading-container">Loading negotiations...</div>
        );
    }

    // Determine if transcriber can accept based on their own availability
    const canTranscriberAccept = isTranscriberAvailable && !transcriberCurrentJobId;

    return (
        <div className="transcriber-negotiations-container">
            <header className="transcriber-negotiations-header">
                <div className="header-content">
                    <h1>Pending Negotiations</h1>
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
                            <h2>Negotiation Room</h2>
                            <p>Review negotiation requests from clients and decide whether to accept, counter, or reject.</p>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3 className="negotiation-room-subtitle">Active Negotiations</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'pending' || n.status === 'transcriber_counter' || n.status === 'client_counter' || n.status === 'accepted_awaiting_payment').map(negotiation => (
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
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'pending' || n.status === 'transcriber_counter' || n.status === 'client_counter' || n.status === 'accepted_awaiting_payment').length === 0 && (
                            <p>No active negotiations.</p>
                        )}
                    </div>

                    <h3>Accepted Jobs</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'hired').map(negotiation => (
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
                                canAccept={false}
                                canCounter={false}
                                onOpenCounterModal={openCounterModal}
                                openRejectModal={openRejectModal}
                                openCompleteJobModal={openCompleteJobModal}
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'hired').length === 0 && (
                            <p>No accepted jobs yet.</p>
                        )}
                    </div>

                    <h3>Completed or Rejected</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'completed' || n.status === 'rejected' || n.status === 'cancelled').map(negotiation => (
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
                                canAccept={false}
                                canCounter={false}
                                onOpenCounterModal={openCounterModal}
                                openRejectModal={openRejectModal}
                                openCompleteJobModal={openCompleteJobModal}
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'completed' || n.status === 'rejected' || n.status === 'cancelled').length === 0 && (
                            <p>No completed or rejected negotiations.</p>
                        )}
                    </div>
                </div>
            </main>

            {/* --- Modals --- */}
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
                    <div className="form-group">
                        <label htmlFor="deadlineHours">Revised Deadline (Hours):</label>
                        <input
                            id="deadlineHours"
                            type="number"
                            name="deadlineHours"
                            value={counterOfferData.deadlineHours}
                            onChange={handleCounterOfferChange}
                            placeholder="Enter revised deadline in hours"
                            min="1"
                            required
                        />
                    </div>
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
