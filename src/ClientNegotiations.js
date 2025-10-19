import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import NegotiationCard from './NegotiationCard';
import './ClientNegotiations.css';

import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;

const ClientNegotiations = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

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
        proposedPrice: '', // This will be in USD
        deadlineHours: '',
        clientResponse: '',
        counterBackFile: null // State to hold the selected file
    });
    const [rejectCounterReason, setRejectCounterReason] = useState('');
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
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                setNegotiations(data.negotiations);
                // Log the fetched negotiations and their statuses for debugging
                console.log("Fetched Negotiations for ClientNegotiations:", data.negotiations.map(n => ({ id: n.id, status: n.status })));

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

    // MOVED: handleNegotiationUpdate to top level
    const handleNegotiationUpdate = useCallback((data) => {
        console.log('ClientNegotiations Real-time: Negotiation update received!', data);
        showToast(`Negotiation ${data.negotiationId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
        fetchNegotiations(); // Re-fetch all negotiations to update UI
    }, [fetchNegotiations, showToast]);

    // MOVED: handleTranscriberHired to top level
    const handleTranscriberHired = useCallback((data) => {
        console.log('ClientNegotiations Real-time: Transcriber hired event received! (Client)', data);
        showToast(data.message || `Transcriber for negotiation ${data.negotiationId?.substring(0, 8)}... was hired!`, 'success');
        fetchNegotiations();
    }, [fetchNegotiations, showToast]);

    // MOVED: handlePaymentSuccessful to top level
    const handlePaymentSuccessful = useCallback((data) => {
        console.log('ClientNegotiations Real-time: Payment successful event received!!', data);
        showToast(data.message || `Payment for negotiation ${data.negotiationId?.substring(0, 8)}... was successful!`, 'success');
        fetchNegotiations();
    }, [fetchNegotiations, showToast]);


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

        // Socket.IO setup
        const socket = connectSocket(user.id);
        if (socket) {
            socket.on('negotiation_accepted', handleNegotiationUpdate);
            socket.on('negotiation_rejected', handleNegotiationUpdate);
            socket.on('negotiation_countered', handleNegotiationUpdate);
            socket.on('negotiation_cancelled', handleNegotiationUpdate);
            socket.on('transcriber_hired', handleTranscriberHired);
            socket.on('payment_successful', handlePaymentSuccessful);

            console.log('ClientNegotiations: Socket listeners attached.');
        }

        return () => {
            if (socket) {
                console.log(`ClientNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('negotiation_accepted', handleNegotiationUpdate);
                socket.off('negotiation_rejected', handleNegotiationUpdate);
                socket.off('negotiation_countered', handleNegotiationUpdate);
                socket.off('negotiation_cancelled', handleNegotiationUpdate);
                socket.off('transcriber_hired', handleTranscriberHired);
                socket.off('payment_successful', handlePaymentSuccessful);
                disconnectSocket();
            }
        };
    }, [isAuthenticated, authLoading, user, navigate, fetchNegotiations, handleNegotiationUpdate, handleTranscriberHired, handlePaymentSuccessful]);


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
        const currentNeg = negotiations.find(n => n.id === negotiationId);
        if (currentNeg) {
            setSelectedNegotiationId(negotiationId);
            setCounterBackOfferData({
                proposedPrice: currentNeg.agreed_price_usd?.toString() || '', // UPDATED: Use agreed_price_usd
                deadlineHours: currentNeg.deadline_hours?.toString() || '',
                clientResponse: '',
                counterBackFile: null // Reset file on modal open
            });
            setShowCounterBackModal(true);
        }
    }, [negotiations]);

    const closeCounterBackModal = useCallback(() => {
        setShowCounterBackModal(false);
        setSelectedNegotiationId(null);
        setCounterBackOfferData({ proposedPrice: '', deadlineHours: '', clientResponse: '', counterBackFile: null }); // Reset file on modal close
        setModalLoading(false);
    }, []);

    const handleCounterBackOfferChange = useCallback((e) => {
        setCounterBackOfferData({
            ...counterBackOfferData,
            [e.target.name]: e.target.value
        });
    }, [counterBackOfferData]);

    // Handle file selection for counter-offer
    const handleCounterBackFileChange = useCallback((e) => {
        setCounterBackOfferData(prevData => ({
            ...prevData,
            counterBackFile: e.target.files[0] || null
        }));
    }, []);

    const handleRejectCounterReasonChange = useCallback((e) => {
        setRejectCounterReason(e.target.value);
    }, []);

    const confirmAcceptCounter = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/client/accept-counter`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    // No file for accept, so no FormData needed here
                })
            });

            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Counter-offer accepted! Proceed to payment.', 'success');
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
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/client/reject-counter`, {
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
            // Use FormData for file upload
            const formData = new FormData();
            formData.append('proposed_price_usd', parseFloat(counterBackOfferData.proposedPrice)); // UPDATED: Use proposed_price_usd
            formData.append('deadline_hours', parseInt(counterBackOfferData.deadlineHours, 10));
            formData.append('client_response', counterBackOfferData.clientResponse);
            
            if (counterBackOfferData.counterBackFile) {
                formData.append('negotiationFile', counterBackOfferData.counterBackFile); // Append the file
            }

            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/client/counter-back`, {
                method: 'PUT',
                headers: {
                    // DO NOT set Content-Type header when sending FormData; browser sets it automatically
                    'Authorization': `Bearer ${token}`
                },
                body: formData // Send FormData directly
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

    const handleProceedToPayment = useCallback(async (negotiation) => {
        if (!user?.email || !negotiation?.id || !negotiation?.agreed_price_usd) { // UPDATED: Use agreed_price_usd
            showToast('Missing client email or negotiation details for payment.', 'error');
            return;
        }
        if (!PAYSTACK_PUBLIC_KEY) {
            showToast('Payment gateway not configured. Please contact support.', 'error');
            console.error('PAYSTACK_PUBLIC_KEY is not set in environment variables.');
            return;
        }

        setLoading(true);
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/payment/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    negotiationId: negotiation.id,
                    amount: negotiation.agreed_price_usd, // UPDATED: Pass agreed_price_usd
                    email: user.email
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
    }, [user, showToast]);


    const getStatusColor = useCallback((status, isClientViewing) => {
        const colors = {
            'pending': '#007bff',
            'transcriber_counter': '#ffc107',
            'client_counter': '#007bff',
            'accepted_awaiting_payment': '#28a745', // Green for accepted, but awaiting payment
            'rejected': '#dc3545',
            'hired': '#007bff', // Blue for active job
            'cancelled': '#dc3545', // Reverted to red for cancelled as it's a terminal, negative state
            'completed': '#6f42c1'
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status, isClientViewing) => {
        const texts = {
            'pending': 'Waiting for Transcriber',
            'transcriber_counter': 'Transcriber Countered',
            'client_counter': 'Client Countered',
            'accepted_awaiting_payment': 'Accepted - Awaiting Payment',
            'rejected': 'Rejected',
            'hired': 'Job Active - Paid',
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        };
        return texts[status] || status;
    }, []);

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
                showToast('Negotiation cancelled successfully! Redirecting to dashboard.', 'success'); // Updated message
                fetchNegotiations();
                navigate('/client-dashboard'); // Redirect to dashboard
            } else {
                showToast(data.error || 'Failed to cancel negotiation', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchNegotiations, logout, navigate]);

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
                            <h2 className="negotiation-room-title">Negotiation Room</h2> {/* Changed heading */}
                            {/* UPDATED: New descriptive text for chat guidelines with red, all-caps NOTE */}
                            <p>
                                <span style={{ color: 'red', textTransform: 'uppercase', fontWeight: 'bold' }}>Note:</span>
                                <ol>
                                    <li>Manage all ongoing offers, counter-offers, and awaiting payment statuses for your transcription jobs.</li>
                                    <li>Exhaust job prerequisites and details here. My Active Jobs room is for transcripts uploads ONLY and is limited to minimal chats.</li>
                                </ol>
                            </p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3 className="negotiation-room-subtitle">Ongoing Negotiations</h3> {/* New subtitle for the consolidated list */}
                    <div className="negotiations-list">
                        {/* This filter ensures negotiations accepted by a transcriber (awaiting payment)
                            remain visible in the "Negotiation Room" until payment is completed,
                            but EXCLUDES 'hired' jobs. */}
                        {negotiations.filter(n =>
                            (n.status === 'pending' ||
                            n.status === 'transcriber_counter' ||
                            n.status === 'client_counter' ||
                            n.status === 'accepted_awaiting_payment') &&
                            n.status !== 'hired' // EXCLUDE 'hired' jobs from Negotiation Room
                        ).map(negotiation => (
                            <NegotiationCard
                                key={negotiation.id}
                                negotiation={negotiation}
                                onDelete={handleDeleteNegotiation}
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
                            />
                        ))}
                        {negotiations.filter(n =>
                            (n.status === 'pending' ||
                            n.status === 'transcriber_counter' ||
                            n.status === 'client_counter' ||
                            n.status === 'accepted_awaiting_payment') &&
                            n.status !== 'hired'
                        ).length === 0 && (
                            <p>No ongoing negotiations in the Negotiation Room.</p>
                        )}
                    </div>

                    {/* Removed "Closed Negotiations" section from here entirely */}
                    {/* <h3 className="negotiation-room-subtitle">Closed Negotiations</h3>
                    <div className="negotiations-list">
                        {negotiations.filter(n => n.status === 'completed' || n.status === 'rejected' || n.status === 'cancelled').map(negotiation => (
                            <NegotiationCard
                                key={negotiation.id}
                                negotiation={negotiation}
                                onDelete={handleDeleteNegotiation}
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
                            />
                        ))}
                        {negotiations.filter(n => n.status === 'completed' || n.status === 'rejected' || n.status === 'cancelled').length === 0 && (
                            <p>No closed negotiations.</p>
                        )}
                    </div> */}
                </div>
            </main>

            {showAcceptCounterModal && (
                <Modal
                    show={showAcceptCounterModal}
                    title="Accept Transcriber's Counter-Offer"
                    onClose={closeAcceptCounterModal}
                    onSubmit={confirmAcceptCounter}
                    submitText="Confirm Accept"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to accept the transcriber's counter-offer?</p>
                    <p className="modal-warning">This will finalize the agreement and you will be prompted for payment.</p>
                </Modal>
            )}

            {showRejectCounterModal && (
                <Modal
                    show={showRejectCounterModal}
                    title="Reject Transcriber's Counter-Offer"
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
                        <label htmlFor="counterBackProposedPrice">Proposed Price (USD):</label> {/* UPDATED: Changed KES to USD */}
                        <input
                            id="counterBackProposedPrice"
                            type="number"
                            name="proposedPrice"
                            value={counterBackOfferData.proposedPrice}
                            onChange={handleCounterBackOfferChange}
                            placeholder="Enter your counter-offer in USD" // UPDATED: Changed KES to USD
                            min="1"
                            step="0.01" // Allow for cents
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
                    {/* NEW: File input for counter-offer */}
                    <div className="form-group">
                        <label htmlFor="counterBackFile">Attach Audio/Video/Doc File (Optional, Max 500MB):</label> {/* Updated max size in comment */}
                        <input
                            id="counterBackFile"
                            type="file"
                            name="counterBackFile"
                            onChange={handleCounterBackFileChange}
                            accept="audio/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="clientResponse">Your Message (Optional):</label>
                        <textarea
                            id="clientResponse"
                            name="clientResponse"
                            value={counterBackOfferData.clientResponse}
                            onChange={handleCounterBackOfferChange}
                            placeholder="e.g., 'I can offer USD 12.00 for 4 hours.'" // UPDATED: Changed KES to USD
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
