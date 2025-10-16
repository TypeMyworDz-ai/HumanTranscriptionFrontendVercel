// src/ClientNegotiations.js - Part 1 - UPDATED for Vercel deployment

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import NegotiationCard from './NegotiationCard';
import './ClientNegotiations.css';

// FIXED: Import connectSocket, disconnectSocket from ChatService
import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// --- Component Definition ---
const ClientNegotiations = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();

    const [negotiations, setNegotiations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

    const [showAcceptCounterModal, setShowAcceptCounterModal] = useState(false);
    const [showRejectCounterModal, setShowRejectCounterModal] = useState(false);
    const [showCounterBackModal, setShowCounterBackModal] = useState(false);
    const [selectedNegotiationId, setSelectedNegotiationId] = useState(null);
    const [counterBackOfferData, setCounterBackOfferData] = useState({
        proposedPrice: '',
        deadlineHours: '',
        clientResponse: ''
    });
    const [rejectCounterReason, setRejectCounterReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    const navigate = useNavigate();
    // REMOVED: socketRef is no longer needed as ChatService manages the global instance
    // const socketRef = useRef(null); 

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

    const fetchNegotiations = useCallback(async () => {
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
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                setNegotiations(data.negotiations);
                if (data.negotiations.length === 0) {
                    showToast('No negotiation requests found.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load negotiation requests', 'error');
            }
        } catch (error) {
            console.error("Fetch negotiations error:", error);
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

        if (user.user_type !== 'client') {
            console.warn("ClientNegotiations: Authenticated user is not a client. Redirecting.");
            navigate('/');
            return;
        }

        fetchNegotiations();
    }, [isAuthenticated, authLoading, user, navigate, fetchNegotiations]);

    // --- Socket.IO Event Listeners ---
    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("ClientNegotiations: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`ClientNegotiations: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        // FIXED: Connect via ChatService and get the global socket instance
        const socket = connectSocket(user.id);

        const handleNegotiationUpdate = (data) => {
            console.log('ClientNegotiations Real-time: Negotiation update received!', data);
            showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
            fetchNegotiations();
        };

        const handleTranscriberHired = (data) => {
            console.log('ClientNegotiations Real-time: Transcriber hired event received!', data);
            showToast(data.message || `Transcriber for negotiation ${data.negotiationId} was hired!`, 'success');
            fetchNegotiations();
        };

        // FIXED: Attach listeners to the global socket instance
        socket.on('negotiation_accepted', handleNegotiationUpdate);
        socket.on('negotiation_rejected', handleNegotiationUpdate);
        socket.on('negotiation_countered', handleNegotiationUpdate);
        socket.on('negotiation_cancelled', handleNegotiationUpdate);
        socket.on('transcriber_hired', handleTranscriberHired);


        return () => {
            console.log(`ClientNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
            // FIXED: Detach listeners from the global socket instance
            socket.off('negotiation_accepted', handleNegotiationUpdate);
            socket.off('negotiation_rejected', handleNegotiationUpdate);
            socket.off('negotiation_countered', handleNegotiationUpdate);
            socket.off('negotiation_cancelled', handleNegotiationUpdate);
            socket.off('transcriber_hired', handleTranscriberHired);
            disconnectSocket();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, isAuthenticated, fetchNegotiations, showToast]);
// src/ClientNegotiations.js - Part 2 - UPDATED for Vercel deployment (Continue from Part 1)


    // --- Modals Handlers ---
    const openAcceptCounterModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowAcceptCounterModal(true);
    }, []);

    const closeAcceptCounterModal = useCallback(() => {
        setShowAcceptCounterModal(false);
        setSelectedNegotiationId(null);
        setModalLoading(false);
    }, []);

    const openRejectCounterModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowRejectCounterModal(true);
        setRejectCounterReason('');
    }, []);

    const closeRejectCounterModal = useCallback(() => {
        setShowRejectCounterModal(false);
        setSelectedNegotiationId(null);
        setRejectCounterReason('');
        setModalLoading(false);
    }, []);

    const openCounterBackModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowCounterBackModal(true);
        const currentNegotiation = negotiations.find(n => n.id === negotiationId);
        if (currentNegotiation) {
            setCounterBackOfferData({
                proposedPrice: currentNegotiation.agreed_price_kes?.toString() || '',
                deadlineHours: currentNegotiation.deadline_hours?.toString() || '',
                clientResponse: ''
            });
        }
    }, [negotiations]);

    const closeCounterBackModal = useCallback(() => {
        setShowCounterBackModal(false);
        setSelectedNegotiationId(null);
        setCounterBackOfferData({ proposedPrice: '', deadlineHours: '', clientResponse: '' });
        setModalLoading(false);
    }, []);

    const handleCounterBackOfferChange = useCallback((e) => {
        setCounterBackOfferData({
            ...counterBackOfferData,
            [e.target.name]: e.target.value
        });
    }, [counterBackOfferData]);

    const handleRejectCounterReasonChange = useCallback((e) => {
        setRejectCounterReason(e.target.value);
    }, []);

    // --- ACTUAL API Actions ---
    const confirmAcceptCounter = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/accept-counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer accepted! Transcriber hired.', 'success');
                closeAcceptCounterModal();
                fetchNegotiations();
            } else {
                showToast(data.error || 'Failed to accept counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error accepting counter-offer:', error);
            showToast('Network error while accepting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, showToast, closeAcceptCounterModal, fetchNegotiations, logout]);

    const confirmRejectCounter = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/reject-counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    client_response: rejectCounterReason || 'Client rejected the counter-offer.'
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer rejected.', 'success');
                closeRejectCounterModal();
                fetchNegotiations();
            } else {
                showToast(data.error || 'Failed to reject counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error rejecting counter-offer:', error);
            showToast('Network error while rejecting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, rejectCounterReason, showToast, closeRejectCounterModal, fetchNegotiations, logout]);

    const confirmCounterBackNegotiation = useCallback(async () => {
        setModalLoading(true);
        if (!counterBackOfferData.proposedPrice || !counterBackOfferData.deadlineHours) {
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
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/counter-back`, { // Assuming a client-side counter-back endpoint
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    proposed_price_kes: parseFloat(counterBackOfferData.proposedPrice),
                    deadline_hours: parseInt(counterBackOfferData.deadlineHours, 10),
                    client_response: counterBackOfferData.clientResponse
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer sent!', 'success');
                closeCounterBackModal();
                fetchNegotiations();
            } else {
                showToast(data.error || 'Failed to send counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error submitting counter-offer:', error);
            showToast('Network error while submitting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, counterBackOfferData, showToast, closeCounterBackModal, fetchNegotiations, logout]);

    // --- Utility Functions for Status Display ---
    const getStatusColor = useCallback((status, isClientViewing) => {
        const colors = {
            'pending': '#007bff', // Client view: pending is blue (waiting for transcriber)
            'transcriber_counter': '#ffc107', // Client view: transcriber counter is yellow (action needed)
            'accepted': '#28a745',
            'rejected': '#dc3545',
            'hired': '#28a745', // Hired can be same as accepted visually
            'cancelled': '#dc3545',
            'completed': '#6f42c1'
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status, isClientViewing) => {
        const texts = {
            'pending': 'Waiting for Transcriber',
            'transcriber_counter': 'Transcriber Countered', // Client view
            'accepted': 'Accepted',
            'rejected': 'Rejected',
            'hired': 'Transcriber Hired',
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        };
        return texts[status] || status;
    }, []);

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
            // FIXED: Use BACKEND_API_URL constant
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
            } else {
                showToast(data.error || 'Failed to cancel negotiation', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchNegotiations, logout]);


    if (authLoading || !isAuthenticated || !user) {
        return <div className="loading-container">Loading authentication...</div>;
    }

    if (loading) {
        return <div className="loading-container">Loading negotiations...</div>;
    }

    return (
        <div className="client-negotiations-container">
            <header className="client-negotiations-header">
                <div className="header-content">
                    <h1>My Negotiations</h1>
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
                            <h2>Your Negotiation History</h2>
                            <p>Manage your ongoing and completed transcription service negotiations.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    {/* Pending Negotiations (Client Waiting for Transcriber Response) */}
                    <h3>Pending Transcriber Response</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'pending').map(negotiation => (
                            <NegotiationCard
                                key={negotiation.id}
                                negotiation={negotiation}
                                onDelete={handleDeleteNegotiation}
                                onLogout={logout}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                showToast={showToast}
                                currentUserId={user.id}
                                currentUserType={user.user_type}
                                // Client-specific modal handlers for counter-offers from transcriber
                                openAcceptCounterModal={openAcceptCounterModal}
                                openRejectCounterModal={openRejectCounterModal}
                                openCounterBackModal={openCounterBackModal}
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'pending').length === 0 && (
                            <p>No pending negotiations awaiting transcriber response.</p>
                        )}
                    </div>

                    {/* Transcriber Counter-Offers (Client needs to respond) */}
                    <h3>Transcriber Counter-Offers</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'transcriber_counter').map(negotiation => (
                            <NegotiationCard
                                key={negotiation.id}
                                negotiation={negotiation}
                                onDelete={handleDeleteNegotiation}
                                onLogout={logout}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                showToast={showToast}
                                currentUserId={user.id}
                                currentUserType={user.user_type}
                                openAcceptCounterModal={openAcceptCounterModal}
                                openRejectCounterModal={openRejectCounterModal}
                                openCounterBackModal={openCounterBackModal}
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'transcriber_counter').length === 0 && (
                            <p>No counter-offers from transcribers.</p>
                        )}
                    </div>

                    {/* Accepted/Hired Negotiations */}
                    <h3>Active Jobs</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'accepted' || n.status === 'hired').map(negotiation => (
                            <NegotiationCard
                                key={negotiation.id}
                                negotiation={negotiation}
                                onDelete={handleDeleteNegotiation}
                                onLogout={logout}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                showToast={showToast}
                                currentUserId={user.id}
                                currentUserType={user.user_type}
                                // Client-specific modal handlers for counter-offers from transcriber
                                openAcceptCounterModal={openAcceptCounterModal}
                                openRejectCounterModal={openRejectCounterModal}
                                openCounterBackModal={openCounterBackModal}
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'accepted' || n.status === 'hired').length === 0 && (
                            <p>No active jobs.</p>
                        )}
                    </div>

                    {/* Completed/Rejected/Cancelled Negotiations */}
                    <h3>Closed Negotiations</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'completed' || n.status === 'rejected' || n.status === 'cancelled').map(negotiation => (
                            <NegotiationCard
                                key={negotiation.id}
                                negotiation={negotiation}
                                onDelete={handleDeleteNegotiation}
                                onLogout={logout}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                showToast={showToast}
                                currentUserId={user.id}
                                currentUserType={user.user_type}
                                // Client-specific modal handlers for counter-offers from transcriber
                                openAcceptCounterModal={openAcceptCounterModal}
                                openRejectCounterModal={openRejectCounterModal}
                                openCounterBackModal={openCounterBackModal}
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'completed' || n.status === 'rejected' || n.status === 'cancelled').length === 0 && (
                            <p>No closed negotiations.</p>
                        )}
                    </div>
                </div>
            </main>

            {/* --- Modals --- */}
            {showAcceptCounterModal && (
                <Modal
                    show={showAcceptCounterModal}
                    title="Accept Counter-Offer"
                    onClose={closeAcceptCounterModal}
                    onSubmit={confirmAcceptCounter}
                    submitText="Confirm Accept"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to accept the transcriber's counter-offer?</p>
                    <p>This will finalize the negotiation and mark the job as active.</p>
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
                    <p>Are you sure you want to reject the transcriber's counter-offer?</p>
                    <p>You can optionally provide a reason for rejection.</p>
                    <div className="form-group">
                        <label htmlFor="rejectCounterReason">Reason for Rejection (Optional):</label>
                        <textarea
                            id="rejectCounterReason"
                            name="rejectCounterReason"
                            value={rejectCounterReason}
                            onChange={handleRejectCounterReasonChange}
                            placeholder="e.g., 'Price too high' or 'Deadline too short.'"
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
                    onSubmit={confirmCounterBackNegotiation}
                    submitText="Send Counter-Offer"
                    loading={modalLoading}
                >
                    <p>Propose new terms back to the transcriber:</p>
                    <div className="form-group">
                        <label htmlFor="counterBackProposedPrice">Proposed Price (KES):</label>
                        <input
                            id="counterBackProposedPrice"
                            type="number"
                            name="proposedPrice"
                            value={counterBackOfferData.proposedPrice}
                            onChange={handleCounterBackOfferChange}
                            placeholder="Enter your counter-offer in KES"
                            min="1"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="counterBackDeadlineHours">Revised Deadline (Hours):</label>
                        <input
                            id="counterBackDeadlineHours"
                            type="number"
                            name="deadlineHours"
                            value={counterBackOfferData.deadlineHours}
                            onChange={handleCounterBackOfferChange}
                            placeholder="Enter revised deadline in hours"
                            min="1"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="clientResponse">Your Message (Optional):</label>
                        <textarea
                            id="clientResponse"
                            name="clientResponse"
                            value={counterBackOfferData.clientResponse}
                            onChange={handleCounterBackOfferChange}
                            placeholder="e.g., 'I can offer KES 1200 for 4 hours.'"
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
                duration={toast.type === 'success' ? 2000 : 4000}
            />
        </div>
    );
};

export default ClientNegotiations;
