// src/ClientNegotiations.js - REFACTORED to ONLY handle negotiation jobs and their payments.
// All references to 'direct_upload' jobs have been removed.
// FIXED: SyntaxError: Expected corresponding JSX closing tag for <p>.
// FIXED: Removed unnecessary dependency 'user.id' from fetchNegotiationJobs useCallback.
// FIXED: KoraPay initialization logic to ensure script loading and required customer data.
// UPDATED: KoraPay initialization to remove explicit channels (backend change), and added extensive logging for verification.
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

    const [negotiations, setNegotiations] = useState([]); // Renamed from allJobs to negotiations
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

    const [showAcceptCounterModal, setShowAcceptCounterModal] = useState(false);
    const [showRejectCounterModal, setShowRejectCounterModal] = useState(false);
    const [showCounterBackModal, setShowCounterBackModal] = useState(false);
    const [selectedNegotiationId, setSelectedNegotiationId] = useState(null); // Renamed from selectedJobId
    const [counterOfferData, setCounterOfferData] = useState({
        proposedPrice: '',
        clientResponse: ''
    });
    const [rejectReason, setRejectReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    // State for Payment Method selection in the payment modal - now strictly for negotiations
    const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState(false);
    const [negotiationToPayFor, setNegotiationToPayFor] = useState(null); // Renamed from jobToPayFor
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack'); // Default to Paystack


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

    // REFACTORED: fetchNegotiationJobs to ONLY fetch negotiation jobs
    const fetchNegotiationJobs = useCallback(async () => {
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
            const negotiationResponse = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));

            const fetchedNegotiations = negotiationData.negotiations || [];

            // Add a jobType identifier to each job (still 'negotiation' for consistency with NegotiationCard)
            const typedNegotiations = fetchedNegotiations.map(job => ({ ...job, jobType: 'negotiation' }));

            setNegotiations(typedNegotiations); // Set negotiations state

            console.log("ClientNegotiations: Fetched Negotiations:", typedNegotiations.map(n => ({
                id: n.id,
                status: n.status,
                jobType: n.jobType,
                transcriberName: n.transcriber_info?.full_name || n.transcriber?.full_name,
                transcriberRating: n.transcriber_info?.transcriber_average_rating || n.transcriber?.transcriber_average_rating,
                transcriberCompletedJobs: n.transcriber_info?.transcriber_completed_jobs || n.transcriber?.transcriber_completed_jobs
            })));

            if (typedNegotiations.length === 0) {
                showToast('No negotiations found.', 'info');
            }
        } catch (error) {
            console.error("Network error while fetching client negotiations:", error);
            showToast('Network error while fetching negotiations.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn(`ClientNegotiations: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            navigate('/');
            return;
        }

        fetchNegotiationJobs();
    }, [isAuthenticated, authLoading, user, navigate, fetchNegotiationJobs]);

    const handleNegotiationUpdate = useCallback((data) => { // Renamed from handleJobUpdate
        console.log('ClientNegotiations Real-time: Negotiation status update received! Triggering re-fetch for list cleanup.', data);
        const negotiationId = data.negotiationId;
        showToast(`Negotiation status updated for ID: ${negotiationId?.substring(0, 8)}.`, 'info');
        fetchNegotiationJobs();
    }, [showToast, fetchNegotiationJobs]);


    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("ClientNegotiations: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`ClientNegotiations: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        if (socket) {
            socket.on('negotiation_accepted', handleNegotiationUpdate);
            socket.on('negotiation_rejected', handleNegotiationUpdate);
            socket.on('negotiation_countered', handleNegotiationUpdate);
            socket.on('negotiation_cancelled', handleNegotiationUpdate);
            socket.on('job_completed', handleNegotiationUpdate); // For negotiation jobs completed by transcriber
            console.log('ClientNegotiations: Socket listeners attached.');
        }

        return () => {
            if (socket) {
                console.log(`ClientNegotiations: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('negotiation_accepted', handleNegotiationUpdate);
                socket.off('negotiation_rejected', handleNegotiationUpdate);
                socket.off('negotiation_countered', handleNegotiationUpdate);
                socket.off('negotiation_cancelled', handleNegotiationUpdate);
                socket.off('job_completed', handleNegotiationUpdate);
                disconnectSocket();
            }
        };
    }, [user?.id, isAuthenticated, handleNegotiationUpdate]);


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
        setRejectReason('');
    }, []);

    const closeRejectCounterModal = useCallback(() => {
        setShowRejectCounterModal(false);
        setSelectedNegotiationId(null);
        setRejectReason('');
        setModalLoading(false);
    }, []);

    const openCounterBackModal = useCallback((negotiationId) => {
        setSelectedNegotiationId(negotiationId);
        setShowCounterBackModal(true);
        const currentNegotiation = negotiations.find(n => n.id === negotiationId);
        if (currentNegotiation) {
            setCounterOfferData({
                proposedPrice: currentNegotiation.agreed_price_usd?.toString() || '',
                clientResponse: ''
            });
        }
    }, [negotiations]);

    const closeCounterBackModal = useCallback(() => {
        setShowCounterBackModal(false);
        setSelectedNegotiationId(null);
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
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/client/accept-counter`, {
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
                fetchNegotiationJobs();
            } else {
                showToast(data.error || 'Failed to accept counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error accepting counter-offer:', error);
            showToast('Network error while accepting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, showToast, closeAcceptCounterModal, fetchNegotiationJobs, logout]);

    const confirmRejectCounter = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/client/reject-counter`, {
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
                fetchNegotiationJobs();
            } else {
                showToast(data.error || 'Failed to reject counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error rejecting counter-offer:', error);
            showToast('Network error while rejecting counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, rejectReason, showToast, closeRejectCounterModal, fetchNegotiationJobs, logout]);

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
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${selectedNegotiationId}/client/counter-back`, {
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
                fetchNegotiationJobs();
            } else {
                showToast(data.error || 'Failed to send counter-offer.', 'error');
            }
        } catch (error) {
            console.error('Error sending counter-offer back:', error);
            showToast('Network error while sending counter-offer.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedNegotiationId, counterOfferData, showToast, closeCounterBackModal, fetchNegotiationJobs, logout]);

    const handleProceedToPayment = useCallback(async (negotiation) => {
        if (!user?.email || !negotiation?.id || !negotiation?.agreed_price_usd) {
            showToast('Missing client email, negotiation ID, or agreed price for payment.', 'error');
            return;
        }

        setNegotiationToPayFor(negotiation);
        setSelectedPaymentMethod('paystack');
        setShowPaymentSelectionModal(true);
    }, [showToast, user]);

    const initiatePayment = useCallback(async () => {
        if (!negotiationToPayFor?.id || !selectedPaymentMethod) {
            showToast('Negotiation or payment method not selected.', 'error');
            return;
        }

        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        let paymentApiUrl = `${BACKEND_API_URL}/api/negotiations/${negotiationToPayFor.id}/payment/initialize`;
        let amountToSend = negotiationToPayFor.agreed_price_usd;


        try {
            const response = await fetch(paymentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    negotiationId: negotiationToPayFor.id,
                    amount: amountToSend,
                    email: user.email,
                    paymentMethod: selectedPaymentMethod,
                })
            });
            const data = await response.json();

            if (response.ok) {
                if (selectedPaymentMethod === 'paystack' && data.data?.authorization_url) {
                    showToast('Redirecting to Paystack...', 'info');
                    window.location.href = data.data.authorization_url;
                } else if (selectedPaymentMethod === 'korapay' && data.korapayData) {
                    console.log('KoraPay Data from Backend:', data.korapayData); // DEBUG: Log KoraPay data

                    // Load KoraPay script if not already loaded
                    if (!window.Korapay) {
                        const script = document.createElement('script');
                        script.src = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
                        script.async = true;
                        document.body.appendChild(script);
                        await new Promise(resolve => script.onload = resolve);
                    }

                    if (window.Korapay) {
                        const { key, reference, amount, currency, customer, notification_url } = data.korapayData;

                        const finalCustomer = {
                            name: customer?.name || user.full_name,
                            email: customer?.email || user.email
                        };

                        window.Korapay.initialize({
                            key: key,
                            reference: reference,
                            amount: amount,
                            currency: currency || "KES", // Default to KES if not provided by backend
                            customer: finalCustomer,
                            notification_url: notification_url,
                            // channels: ['card', 'mobile_money'], // Removed explicit channels (handled by backend now)
                            onClose: () => {
                                console.log("KoraPay modal closed for negotiation. Re-fetching jobs.");
                                showToast("Payment cancelled by user.", "info");
                                setModalLoading(false);
                                setShowPaymentSelectionModal(false);
                                fetchNegotiationJobs(); // Re-fetch jobs on close
                            },
                            onSuccess: async (korapayResponse) => {
                                console.log("KoraPay payment successful for negotiation:", korapayResponse);
                                console.log("Verifying with backend. Negotiation ID:", negotiationToPayFor?.id, "Reference:", korapayResponse?.reference); // DEBUG: Log verification parameters

                                showToast("Payment successful! Verifying...", "success");
                                try {
                                    const verifyResponse = await fetch(`${BACKEND_API_URL}/api/negotiations/${negotiationToPayFor.id}/payment/verify/${korapayResponse.reference}?paymentMethod=korapay`, {
                                        method: 'GET',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                    });
                                    const verifyData = await verifyResponse.json();

                                    if (verifyResponse.ok) {
                                        showToast("Payment successfully verified. Redirecting to dashboard!", "success");
                                        setShowPaymentSelectionModal(false);
                                        fetchNegotiationJobs();
                                        navigate('/client-dashboard');
                                    } else {
                                        console.error("KoraPay verification failed with backend:", verifyData.error); // DEBUG: Log backend verification error
                                        showToast(verifyData.error || "Payment verification failed. Please contact support.", "error");
                                        setModalLoading(false);
                                    }
                                } catch (verifyError) {
                                    console.error('Error during KoraPay verification for negotiation:', verifyError);
                                    showToast('Network error during payment verification. Please contact support.', 'error');
                                    setModalLoading(false);
                                }
                            },
                            onFailed: (korapayResponse) => {
                                console.error("KoraPay payment failed for negotiation:", korapayResponse);
                                showToast("Payment failed. Please try again.", "error");
                                setModalLoading(false);
                                setShowPaymentSelectionModal(false); // Close the selection modal on failure
                            }
                        });
                    } else {
                        showToast('Failed to load KoraPay script. Please try again or contact support.', 'error');
                        setModalLoading(false);
                        setShowPaymentSelectionModal(false);
                    }
                } else {
                    showToast(data.error || 'Failed to initiate KoraPay payment. Missing data from server.', 'error');
                }
                setModalLoading(false);
            } else {
                showToast(data.error || 'Failed to initiate payment. Please try again.', 'error');
                setModalLoading(false);
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            showToast('Network error while initiating payment. Please try again.', 'error');
            setModalLoading(false);
        } finally {
            // Handled within callbacks
        }
    }, [negotiationToPayFor, selectedPaymentMethod, user, showToast, logout, fetchNegotiationJobs, navigate]);


    const handleDeleteJob = useCallback(async (jobId, jobType) => {
        if (jobType !== 'negotiation') {
            showToast('This action is only for negotiation jobs.', 'error');
            return;
        }
        if (!window.confirm('Are you sure you want to cancel/delete this negotiation? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }

            const apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobId}`;

            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Negotiation cancelled/deleted successfully!', 'success');
                fetchNegotiationJobs();
            } else {
                showToast(data.error || 'Failed to cancel/delete negotiation', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchNegotiationJobs, logout]);

    const handleDownloadFile = useCallback(async (jobId, jobType, fileName) => { // Added fileName as param
        if (jobType !== 'negotiation') {
            showToast('This action is only for negotiation files.', 'error');
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
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


    const getStatusColor = useCallback((status) => {
        const colors = {
            'pending': '#007bff',
            'transcriber_counter': '#ffc107',
            'accepted_awaiting_payment': '#28a745',
            'rejected': '#dc3545',
            'hired': '#007bff',
            'cancelled': '#dc3545',
            'completed': '#6f42c1',
            'client_completed': '#6f42c1'
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

    let displayedNegotiations = [];
    let pageTitle = "Negotiation Room";
    let pageDescription = "Manage all ongoing offers, counter-offers, and awaiting payment statuses for your transcription jobs.";
    let listSubtitle = "Ongoing Negotiations";
    let emptyMessage = "No ongoing negotiations.";

    if (statusFilter === 'active') {
        displayedNegotiations = negotiations.filter(negotiation =>
            negotiation.status === 'hired'
        );
        pageTitle = "My Active Jobs";
        pageDescription = "Track the progress of your active transcription jobs and communicate with transcribers.";
        listSubtitle = "Currently Active Jobs";
        emptyMessage = "You currently have no active jobs.";
    } else if (statusFilter === 'completed') {
        displayedNegotiations = negotiations.filter(negotiation =>
            negotiation.status === 'completed' || negotiation.status === 'client_completed'
        );
        pageTitle = "My Completed Jobs";
        pageDescription = "Review your finished projects and provide feedback.";
        listSubtitle = "Completed Jobs";
        emptyMessage = "You currently have no completed jobs.";
    } else { // Default to 'Negotiation Room' view
        displayedNegotiations = negotiations.filter(negotiation =>
            negotiation.status === 'pending' ||
            negotiation.status === 'transcriber_counter' ||
            negotiation.status === 'client_counter' ||
            negotiation.status === 'accepted_awaiting_payment'
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
                        {displayedNegotiations.length === 0 ? (
                            <p>{emptyMessage}</p>
                        ) : (
                            displayedNegotiations.map(negotiation => (
                                <NegotiationCard
                                    key={negotiation.id}
                                    job={negotiation}
                                    jobType={'negotiation'}
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

            {/* NEW: Payment Selection Modal */}
            {showPaymentSelectionModal && negotiationToPayFor && (
                <Modal
                    show={showPaymentSelectionModal}
                    title={`Choose Payment Method for Negotiation: ${negotiationToPayFor.id?.substring(0, 8)}...`}
                    onClose={() => setShowPaymentSelectionModal(false)}
                    onSubmit={initiatePayment}
                    submitText={`Pay Now (USD ${((negotiationToPayFor.agreed_price_usd) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    loading={modalLoading}
                >
                    <p>Select your preferred payment method:</p>
                    <div className="payment-method-selection">
                        <label className="radio-label">
                            <input
                                type="radio"
                                value="paystack"
                                checked={selectedPaymentMethod === 'paystack'}
                                onChange={() => setSelectedPaymentMethod('paystack')}
                                disabled={modalLoading}
                            />
                            Paystack (Card, Mobile Money, Bank Transfer, Pesalink)
                        </label>
                        <label className="radio-label">
                            <input
                                type="radio"
                                value="korapay"
                                checked={selectedPaymentMethod === 'korapay'}
                                onChange={() => setSelectedPaymentMethod('korapay')}
                                disabled={modalLoading}
                            />
                            KoraPay (Card, Bank Transfer, Mobile Money)
                        </label>
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
