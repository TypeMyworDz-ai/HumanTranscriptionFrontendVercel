// src/ClientJobs.js - UPDATED to fix modal dismissal and toast message logic,
// add logging for missing transcriber_id, and enable 'Mark as Complete' for client on direct upload jobs.
import React, { useState, useEffect, useCallback, Fragment } from 'react'; // Added Fragment import
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import NegotiationCard from './NegotiationCard';
import DirectUploadJobCard from './DirectUploadJobCard';
import Modal from './Modal';
import { useAuth } from './contexts/AuthContext';
// eslint-disable-next-line no-unused-vars
import { connectSocket, disconnectSocket } from './ChatService';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [activeJobs, setActiveJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // State for Mark Job Complete Modal (Client's action for Negotiation Jobs)
    const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);
    const [jobToComplete, setJobToComplete] = useState(null);
    const [clientFeedbackComment, setClientFeedbackComment] = useState('');
    const [clientFeedbackRating, setClientFeedbackRating] = useState(5);
    const [completeJobModalLoading, setCompleteJobModalLoading] = useState(false);

    // State for Payment Method selection in the payment modal
    const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState(false);
    const [jobToPayFor, setJobToPayFor] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack');
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

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

    const fetchClientJobs = useCallback(async (showNoJobsToast = true) => {
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
                fetch(`${BACKEND_API_URL}/api/client/direct-jobs`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const negotiationsData = await (negotiationsResponse.ok ? negotiationsResponse.json() : Promise.resolve({ negotiations: [] }));
            const directUploadJobsData = await (directUploadJobsResponse.ok ? directUploadJobsResponse.json() : Promise.resolve({ jobs: [] }));

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
                    d.status === 'in_progress' ||
                    d.status === 'completed'
                );
                combinedActiveJobs = [...combinedActiveJobs, ...activeDirectUploadJobs];
            } else {
                console.error('Failed to fetch direct upload jobs::', directUploadJobsData.error);
                showToast(directUploadJobsData.error || 'Failed to load direct upload jobs.', 'error');
            }

            console.log("ClientJobs: Combined Active Jobs:", combinedActiveJobs.map(j => ({
                id: j.id,
                status: j.status,
                type: j.jobType || (j.negotiation_id ? 'negotiation' : (j.file_name ? 'direct_upload' : 'unknown')) // UPDATED line
            })));
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


    const handleJobUpdate = useCallback((data) => {
        console.log('ClientJobs: Job status update received via Socket. Triggering re-fetch for list cleanup.', data);
        const jobId = data.negotiationId || data.jobId;
        showToast(`Job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
        fetchClientJobs();
    }, [showToast, fetchClientJobs]);

    const handleNewChatMessageForActiveJobs = useCallback((data) => {
        console.log('ClientJobs Real-time: New chat message received!', data);
        const relatedJobId = data.negotiation_id || data.direct_upload_job_id;

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
            navigate('/');
            return;
        }

        fetchClientJobs();

        const socket = connectSocket(user.id);
        if (socket) {
            socket.on('job_completed', handleJobUpdate);
            socket.on('direct_job_completed', handleJobUpdate);
            socket.on('negotiation_cancelled', handleJobUpdate);
            socket.on('direct_job_taken', handleJobUpdate);
            socket.on('payment_successful', handleJobUpdate);
            socket.on('newChatMessage', handleNewChatMessageForActiveJobs);

            console.log('ClientJobs: Socket listeners attached for active jobs.');
        }

        return () => {
            if (socket) {
                console.log(`ClientJobs: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('job_completed', handleJobUpdate);
                socket.off('direct_job_completed', handleJobUpdate);
                socket.off('negotiation_cancelled', handleJobUpdate);
                socket.off('direct_job_taken', handleJobUpdate);
                socket.off('payment_successful', handleJobUpdate);
                socket.off('newChatMessage', handleNewChatMessageForActiveJobs);
                disconnectSocket();
            }
        };

    }, [isAuthenticated, authLoading, user, navigate, fetchClientJobs, handleJobUpdate, handleNewChatMessageForActiveJobs]);

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
                showToast('Direct upload jobs cannot be deleted from this view.', 'error');
                return;
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
                fetchClientJobs();
            } else {
                showToast(data.error || 'Failed to cancel/delete job', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, fetchClientJobs, logout]);

    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => {
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
                downloadUrl = `${BACKEND_API_URL}/api/direct-jobs/${jobId}/download/${fileName}`;
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


    const openMarkJobCompleteModal = useCallback((job) => {
        const isNegotiationJob = job.jobType === 'negotiation'; // Use jobType from backend
        const isDirectUploadJob = job.jobType === 'direct_upload'; // Use jobType from backend

        if (isNegotiationJob && job.status === 'hired') { // UPDATED: Client can mark negotiation job complete when status is 'hired'
            setJobToComplete(job);
            setClientFeedbackComment('');
            setClientFeedbackRating(5);
            setShowCompleteJobModal(true);
        } else if (isDirectUploadJob && job.status === 'completed') {
            setJobToComplete(job);
            setClientFeedbackComment('');
            setClientFeedbackRating(5);
            setShowCompleteJobModal(true);
        } else {
            showToast('This job cannot be marked complete at this time.', 'info');
        }
    }, [showToast]);

    const closeMarkJobCompleteModal = useCallback(() => {
        setShowCompleteJobModal(false);
        setJobToComplete(null);
        setClientFeedbackComment('');
        setClientFeedbackRating(5);
        setCompleteJobModalLoading(false);
    }, []);

    const handleFeedbackCommentChange = useCallback((e) => {
        setClientFeedbackComment(e.target.value);
    }, []);

    const handleFeedbackRatingChange = useCallback((e) => {
        setClientFeedbackRating(parseInt(e.target.value, 10));
    }, []);


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
            if (jobToComplete.jobType === 'negotiation') { // Use jobType from backend
                apiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToComplete.id}/complete`;
            } else if (jobToComplete.jobType === 'direct_upload') { // Use jobType from backend
                apiUrl = `${BACKEND_API_URL}/api/client/direct-jobs/${jobToComplete.id}/complete`;
            } else {
                showToast('Unknown job type for completion.', 'error');
                setCompleteJobModalLoading(false);
                return;
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
                closeMarkJobCompleteModal();
                fetchClientJobs(false);
            } else {
                showToast(data.error || 'Failed to mark job as complete.', 'error');
            }
        } catch (error) {
            console.error('Network error marking job as complete: ', error);
            showToast('Network error while marking job as complete. Please try again.', 'error');
        } finally {
            setCompleteJobModalLoading(false);
        }
    }, [jobToComplete, clientFeedbackComment, clientFeedbackRating, showToast, logout, closeMarkJobCompleteModal, fetchClientJobs]);


    const handleProceedToPayment = useCallback(async (job) => {
        if (!user?.email || !job?.id || (!job?.agreed_price_usd && !job?.quote_amount)) {
            showToast('Missing client email or job details for payment.', 'error');
            return;
        }

        const jobType = job.jobType || (job.negotiation_id ? 'negotiation' : (job.file_name ? 'direct_upload' : 'unknown')); // UPDATED line

        setJobToPayFor({ ...job, jobType: jobType });
        setSelectedPaymentMethod('paystack');
        setShowPaymentSelectionModal(true);
    }, [showToast, user]);

    const initiatePayment = useCallback(async () => {
        if (!jobToPayFor?.id || !selectedPaymentMethod) {
            showToast('Job or payment method not selected..', 'error');
            return;
        }

        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        let paymentApiUrl;
        let amountToSend;

        if (jobToPayFor.jobType === 'negotiation') {
            paymentApiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToPayFor.id}/payment/initialize`;
            amountToSend = jobToPayFor.agreed_price_usd;
        } else if (jobToPayFor.jobType === 'direct_upload') {
            paymentApiUrl = `${BACKEND_API_URL}/api/direct-uploads/${jobToPayFor.id}/payment/initialize`;
            amountToSend = jobToPayFor.quote_amount;
        } else {
            showToast('Unknown job type for payment initiation.', 'error');
            setModalLoading(false);
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
                    jobId: jobToPayFor.id,
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
                } else if (selectedPaymentMethod === 'korapay' && data.korapayData && window.Korapay) {
                    if (!window.Korapay) {
                        const script = document.createElement('script');
                        script.src = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
                        script.async = true;
                        document.body.appendChild(script);
                        await new Promise(resolve => script.onload = resolve); // Corrected here
                    }

                    const { key, reference, amount, currency, customer, notification_url } = data.korapayData;
                    window.Korapay.initialize({
                        key: key,
                        reference: reference,
                        amount: amount,
                        currency: currency,
                        customer: customer,
                        notification_url: notification_url,
                        onClose: () => {
                            console.log("KoraPay modal closed for negotiation/direct upload.");
                            showToast("Payment cancelled.", "info");
                            setModalLoading(false);
                            setShowPaymentSelectionModal(false);
                        },
                        onSuccess: async (korapayResponse) => {
                            console.log("KoraPay payment successful for negotiation/direct upload:", korapayResponse);
                            showToast("Payment successful! Verifying...", "success");
                            try {
                                const verifyEndpoint = jobToPayFor.jobType === 'negotiation'
                                    ? `${BACKEND_API_URL}/api/negotiations/${jobToPayFor.id}/payment/verify/${korapayResponse.reference}?paymentMethod=korapay`
                                    : `${BACKEND_API_URL}/api/direct-uploads/${jobToPayFor.id}/payment/verify/${korapayResponse.reference}?paymentMethod=korapay`;

                                const verifyResponse = await fetch(verifyEndpoint, {
                                    method: 'GET',
                                    headers: { 'Authorization': `Bearer ${token}` },
                                });
                                const verifyData = await verifyResponse.json();

                                if (verifyResponse.ok) {
                                    showToast("Payment successfully verified. Redirecting to dashboard!", "success");
                                    setShowPaymentSelectionModal(false);
                                    fetchClientJobs();
                                    navigate('/client-dashboard');
                                } else {
                                    showToast(verifyData.error || "Payment verification failed. Please contact support.", "error");
                                    setModalLoading(false);
                                }
                            } catch (verifyError) {
                                console.error('Error during KoraPay verification for negotiation/direct upload:', verifyError);
                                showToast('Network error during payment verification. Please contact support.', 'error');
                                setModalLoading(false);
                            }
                        },
                        onFailed: (korapayResponse) => {
                            console.error("KoraPay payment failed for negotiation/direct upload:", korapayResponse);
                            showToast("Payment failed. Please try again.", "error");
                            setModalLoading(false);
                        }
                    });
                } else {
                    showToast(data.error || 'Failed to initiate KoraPay payment. Missing data or script not loaded.', 'error');
                }
                setModalLoading(false);
            } else {
                showToast(data.error || 'Failed to initiate payment. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            showToast('Network error while initiating payment. Please try again.', 'error');
            setModalLoading(false);
        } finally {
        }
    }, [jobToPayFor, selectedPaymentMethod, user, showToast, logout, fetchClientJobs, navigate]);


    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="client-jobs-container">
                <div className="loading-spinner">Loading active jobs...</div>
            </div>
        );
    }

    return (
        <div className="client-jobs-container">
            <Fragment>
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
                                    <strong>Note:</strong>
                                </p>
                                <ol>
                                    <li>Track the progress of your job here. Client can ask about progress of their job or clarify something.</li>
                                    <li>This Chat is moderated. Exchange of personal information is highly discouraged.</li>
                                </ol>
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
                                activeJobs.map((job) => {
                                    const jobType = job.jobType || (job.negotiation_id ? 'negotiation' : (job.file_name ? 'direct_upload' : 'unknown')); // UPDATED line

                                    if (jobType === 'direct_upload') {
                                        console.log(`ClientJobs: Full Direct Upload Job Object for ${job.id}:`, job);
                                        if (!job.transcriber_id && !job.transcriber?.id) {
                                            console.warn(`ClientJobs: Direct upload job ${job.id} (Type: ${jobType}) is missing 'transcriber_id' or 'transcriber.id'. Messaging features will be disabled.`, job);
                                        }
                                    }

                                    console.log(`ClientJobs: Rendering Job ${job.id} (Type: ${jobType}). Client Info:`, job.client_info || job.client);

                                    if (jobType === 'negotiation') {
                                        return (
                                            <NegotiationCard
                                                key={job.id}
                                                job={job}
                                                jobType={jobType}
                                                onDelete={handleDeleteJob}
                                                onPayment={handleProceedToPayment}
                                                onLogout={logout}
                                                getStatusColor={getStatusColor}
                                                getStatusText={getStatusText}
                                                showToast={showToast}
                                                currentUserId={user.id}
                                                currentUserType={user.user_type}
                                                openCompleteJobModal={openMarkJobCompleteModal}
                                                onDownloadFile={handleDownloadFile}
                                                clientAverageRating={parseFloat(user.client_average_rating) || 0}
                                                clientCompletedJobs={parseFloat(user.client_completed_jobs) || 0}
                                            />
                                        );
                                    } else if (jobType === 'direct_upload') {
                                        return (
                                            <DirectUploadJobCard
                                                key={job.id}
                                                job={job}
                                                onDelete={handleDeleteJob}
                                                onPayment={handleProceedToPayment}
                                                onLogout={logout}
                                                getStatusColor={getStatusColor}
                                                getStatusText={getStatusText}
                                                showToast={showToast}
                                                currentUserId={user.id}
                                                currentUserType={user.user_type}
                                                openCompleteJobModal={openMarkJobCompleteModal}
                                                onDownloadFile={handleDownloadFile}
                                                clientAverageRating={parseFloat(user.client_average_rating) || 0}
                                                clientCompletedJobs={parseFloat(user.client_completed_jobs) || 0}
                                            />
                                        );
                                    }
                                    return null;
                                })
                            )}
                        </div>
                    </div>
                </main>

                {/* Mark Job Complete with Feedback Modal (Client's action for Negotiation Jobs) */}
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

                {/* Payment Selection Modal */}
                {showPaymentSelectionModal && jobToPayFor && (
                    <Modal
                        show={showPaymentSelectionModal}
                        title={`Choose Payment Method for Job: ${jobToPayFor.id?.substring(0, 8)}...`}
                        onClose={() => setShowPaymentSelectionModal(false)}
                        onSubmit={initiatePayment}
                        submitText={`Pay Now (USD ${((jobToPayFor.jobType === 'negotiation' ? jobToPayFor.agreed_price_usd : jobToPayFor.quote_amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
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
            </Fragment>
        </div>
    );
};

export default ClientJobs;
