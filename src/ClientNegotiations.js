// src/ClientNegotiations.js - REFACTORED to ONLY handle negotiation jobs and their payments.
// All references to 'direct_upload' jobs have been removed.
// FIXED: SyntaxError: Expected corresponding JSX closing tag for <p>.
// FIXED: Removed unnecessary dependency 'user.id' from fetchNegotiationJobs useCallback.
// FIXED: KoraPay initialization logic to ensure script loading and required customer data.
// UPDATED: KoraPay initialization to remove explicit channels (backend change), and added extensive logging for verification.
// UPDATED: KoraPay onSuccess/onClose callbacks to handle modal closure more gracefully and ensure verification params are logged.
// FIXED: KoraPay TypeError by explicitly calling Korapay.close() and adding a small delay for modal cleanup.
// UPDATED: Added client-side 'Mark as Complete' functionality for negotiation jobs.
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
    // eslint-disable-next-line no-unused-vars
    const { user, isAuthenticated, authLoading, logout, updateUser, checkAuth } = useAuth();
    const location = useLocation();
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
    const [counterOfferData, setCounterOfferData] = useState({
        proposedPrice: '',
        clientResponse: ''
    });
    const [rejectReason, setRejectReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState(false);
    const [negotiationToPayFor, setNegotiationToPayFor] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack');
    const [mobileNumber, setMobileNumber] = useState(''); // RE-INTRODUCED: Mobile number state for KoraPay
    const [korapayScriptLoaded, setKorapayScriptLoaded] = useState(false); // RE-INTRODUCED: KoraPay script loading state


    // NEW: State for Mark Job Complete Modal (Client's action for Negotiation Jobs)
    const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);
    const [jobToComplete, setJobToComplete] = useState(null); // Renamed from negotiationToComplete for consistency with ClientJobs
    const [clientFeedbackComment, setClientFeedbackComment] = useState('');
    const [clientFeedbackRating, setClientFeedbackRating] = useState(5);
    const [completeJobModalLoading, setCompleteJobModalLoading] = useState(false);


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

    // NEW: Load KoraPay SDK dynamically
    useEffect(() => {
        const existingScript = document.getElementById('korapay-sdk');
        if (existingScript) {
            setKorapayScriptLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'korapay-sdk';
        script.src = 'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js';
        script.async = true;
        script.onload = () => {
            console.log('[ClientNegotiations] KoraPay SDK loaded successfully');
            setKorapayScriptLoaded(true);
        };
        script.onerror = () => {
            console.error('[ClientNegotiations] Failed to load KoraPay SDK');
            showToast('Failed to load KoraPay payment system. Please refresh the page.', 'error');
        };
        document.body.appendChild(script);

        return () => {
            const scriptToRemove = document.getElementById('korapay-sdk');
            if (scriptToRemove) {
                document.body.removeChild(scriptToRemove);
            }
        };
    }, [showToast]);

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

            const typedNegotiations = fetchedNegotiations.map(job => ({ ...job, jobType: 'negotiation' }));

            setNegotiations(typedNegotiations);

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

    const handleNegotiationUpdate = useCallback((data) => {
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
            socket.on('job_completed', handleNegotiationUpdate);
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
        setSelectedPaymentMethod('paystack'); // Default to Paystack for the modal
        setMobileNumber(''); // Clear mobile number
        setShowPaymentSelectionModal(true);
    }, [showToast, user]);

    const initiatePayment = useCallback(async () => {
        if (!negotiationToPayFor?.id || !selectedPaymentMethod) {
            showToast('Negotiation or payment method not selected.', 'error');
            return;
        }
        // Validate mobile number if KoraPay is selected
        if (selectedPaymentMethod === 'korapay' && !mobileNumber.trim()) {
            showToast('Please enter your mobile number for KoraPay payment.', 'error');
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
            const payload = {
                negotiationId: negotiationToPayFor.id,
                amount: amountToSend,
                email: user.email,
                paymentMethod: selectedPaymentMethod,
                fullName: user.full_name, // Include full name
            };

            // Conditionally add mobileNumber to payload for KoraPay
            if (selectedPaymentMethod === 'korapay' && mobileNumber.trim()) {
                payload.mobileNumber = mobileNumber.trim();
            }

            const response = await fetch(paymentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (response.ok) {
                if (selectedPaymentMethod === 'paystack' && data.data?.authorization_url) {
                    showToast('Redirecting to Paystack...', 'info');
                    window.location.href = data.data.authorization_url;
                } else if (selectedPaymentMethod === 'korapay' && data.korapayData) {
                    console.log('KoraPay Data from Backend:', data.korapayData);

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
                            currency: currency || "KES",
                            customer: finalCustomer,
                            notification_url: notification_url,
                            onClose: () => {
                                console.log("KoraPay modal closed for negotiation. Attempting to close payment selection modal and re-fetch jobs.");
                                if (window.Korapay && typeof window.Korapay.close === 'function') {
                                    try {
                                        window.Korapay.close();
                                    } catch (e) {
                                        console.error("Error explicitly closing KoraPay modal on close:", e);
                                    }
                                }
                                setTimeout(() => { // Add a slight delay before closing React modal
                                    showToast("Payment cancelled by user.", "info");
                                    setModalLoading(false);
                                    setShowPaymentSelectionModal(false);
                                    fetchNegotiationJobs();
                                }, 500); // 500ms delay
                            },
                            onSuccess: async (korapayResponse) => {
                                console.log("KoraPay payment successful for negotiation:", korapayResponse);
                                console.log("Verifying with backend. Negotiation ID:", negotiationToPayFor?.id, "Reference:", korapayResponse?.reference);

                                showToast("Payment successful! Verifying...", "success");
                                if (window.Korapay && typeof window.Korapay.close === 'function') {
                                    try {
                                        window.Korapay.close();
                                    } catch (e) {
                                        console.error("Error explicitly closing KoraPay modal on success:", e);
                                    }
                                }
                                
                                setTimeout(async () => {
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
                                            console.error("KoraPay verification failed with backend:", verifyData.error);
                                            showToast(verifyData.error || "Payment verification failed. Please contact support.", "error");
                                            setModalLoading(false);
                                            setShowPaymentSelectionModal(false);
                                        }
                                    } catch (verifyError) {
                                        console.error('Error during KoraPay verification for negotiation:', verifyError);
                                        showToast('Network error during payment verification. Please contact support.', 'error');
                                        setModalLoading(false);
                                        setShowPaymentSelectionModal(false);
                                    }
                                }, 500); // 500ms delay for cleanup
                            },
                            onFailed: (korapayResponse) => {
                                console.error("KoraPay payment failed for negotiation:", korapayResponse);
                                showToast("Payment failed. Please try again.", "error");
                                setModalLoading(false);
                                setShowPaymentSelectionModal(false);
                                fetchNegotiationJobs();
                            }
                        });
                    } else {
                        showToast('Failed to load KoraPay script. Please try again or contact support.', 'error');
                        setModalLoading(false);
                        setShowPaymentSelectionModal(false);
                    }
                } else {
                    showToast(data.error || 'Failed to initiate KoraPay payment. Missing data from server.', 'error');
                    setModalLoading(false);
                }
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
    }, [negotiationToPayFor, selectedPaymentMethod, mobileNumber, user, showToast, logout, fetchNegotiationJobs, navigate]);


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

    const handleDownloadFile = useCallback(async (jobId, jobType, fileName) => {
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

    // NEW: Open Mark Job Complete Modal
    const openMarkJobCompleteModal = useCallback((job) => {
        // This function is specifically for negotiation jobs in ClientNegotiations.js
        if (job.jobType === 'negotiation' && job.status === 'hired') {
            setJobToComplete(job);
            setClientFeedbackComment('');
            setClientFeedbackRating(5);
            setShowCompleteJobModal(true);
        } else {
            showToast('This job cannot be marked complete at this time.', 'info');
        }
    }, [showToast]);

    // NEW: Close Mark Job Complete Modal
    const closeMarkJobCompleteModal = useCallback(() => {
        setShowCompleteJobModal(false);
        setJobToComplete(null);
        setClientFeedbackComment('');
        setClientFeedbackRating(5);
        setCompleteJobModalLoading(false);
    }, []);

    // NEW: Handle Feedback Comment Change
    const handleFeedbackCommentChange = useCallback((e) => {
        setClientFeedbackComment(e.target.value);
    }, []);

    // NEW: Handle Feedback Rating Change
    const handleFeedbackRatingChange = useCallback((e) => {
        setClientFeedbackRating(parseInt(e.target.value, 10));
    }, []);

    // NEW: Submit Mark Job Complete
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
            let apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToComplete.id}/complete`;

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
                closeMarkJobCompleteModal();
                fetchNegotiationJobs(); // Re-fetch negotiations to update status
            } else {
                showToast(data.error || 'Failed to mark job as complete.', 'error');
            }
        } catch (error) {
            console.error('Network error marking job as complete: ', error);
            showToast('Network error while marking job as complete. Please try again.', 'error');
        } finally {
            setCompleteJobModalLoading(false);
        }
    }, [jobToComplete, clientFeedbackComment, clientFeedbackRating, showToast, logout, closeMarkJobCompleteModal, fetchNegotiationJobs]);


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
    } else {
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
                    <h1>🤝 {pageTitle}</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, <strong>{user.full_name}</strong>!</span>
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
                                    openCompleteJobModal={openMarkJobCompleteModal}
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
                    onClose={() => {setShowPaymentSelectionModal(false); setModalLoading(false);}}
                    onSubmit={initiatePayment}
                    submitText={modalLoading ? 'Processing...' : `Pay Now (USD ${((negotiationToPayFor.agreed_price_usd || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    loading={modalLoading}
                >
                    <p className="modal-intro-text">Select your preferred payment method to complete your order securely.</p>
                    <div className="payment-method-selection-modal">
                        <div className="payment-options">
                            <label className={`payment-option ${selectedPaymentMethod === 'paystack' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="paystack"
                                    checked={selectedPaymentMethod === 'paystack'}
                                    onChange={() => setSelectedPaymentMethod('paystack')}
                                    disabled={modalLoading}
                                />
                                <div className="option-content">
                                    <div className="option-header">
                                        <span className="option-icon">💳</span>
                                        <span className="option-name">Paystack</span>
                                    </div>
                                    <span className="option-description">
                                        Card, Mobile Money, Bank Transfer, Pesalink
                                    </span>
                                </div>
                            </label>
                            <label className={`payment-option ${selectedPaymentMethod === 'korapay' ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    value="korapay"
                                    checked={selectedPaymentMethod === 'korapay'}
                                    onChange={() => setSelectedPaymentMethod('korapay')}
                                    disabled={modalLoading || !korapayScriptLoaded}
                                />
                                <div className="option-content">
                                    <div className="option-header">
                                        <span className="option-icon">📱</span>
                                        <span className="option-name">KoraPay</span>
                                    </div>
                                    <span className="option-description">
                                        Mobile Money, Card, Bank Transfer
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Mobile Number Input for KoraPay */}
                    {selectedPaymentMethod === 'korapay' && (
                        <div className="mobile-input-section-modal">
                            <label htmlFor="mobileNumberModal" className="input-label">
                                📱 Mobile Number (Optional for KoraPay)
                            </label>
                            <input
                                type="tel"
                                id="mobileNumberModal"
                                className="mobile-input"
                                placeholder="e.g., +254712345678"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                disabled={modalLoading}
                            />
                            <small className="input-hint">
                                Enter your mobile number for faster mobile money payments
                            </small>
                        </div>
                    )}
                </Modal>
            )}

            {/* NEW: Mark Job Complete with Feedback Modal (Client's action for Negotiation Jobs) */}
            {showCompleteJobModal && jobToComplete && (
                <Modal
                    show={showCompleteJobModal}
                    title={`Complete Job: ${jobToComplete.id?.substring(0, 8)}...`}
                    onClose={closeMarkJobCompleteModal}
                    onSubmit={submitMarkJobComplete}
                    submitText="Mark as Complete"
                    loading={completeJobModalLoading}
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
                duration={toast.type === 'error' ? 4000 : 3000}
            />
        </div>
    );
};

export default ClientNegotiations;
