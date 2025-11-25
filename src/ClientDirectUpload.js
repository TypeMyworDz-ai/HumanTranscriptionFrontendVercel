// src/ClientDirectUpload.js - FINALIZED for Dynamic Pricing Rules, Audio Quality, Deadline Values, and USD Currency
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import Modal from './Modal';
import './ClientDirectUpload.css'; // Assuming you have a CSS file for styling

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
// eslint-disable-next-line no-unused-vars
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;

const ClientDirectUpload = () => {
    const { user, isAuthenticated, authLoading, logout, updateUser, checkAuth } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [loading, setLoading] = useState(false);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [quoteDetails, setQuoteDetails] = useState(null);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const [audioVideoFile, setAudioVideoFile] = useState(null);
    const [instructionFiles, setInstructionFiles] = useState([]);
    const [clientInstructions, setClientInstructions] = useState('');
    const [audioQualityParam, setAudioQualityParam] = useState('standard');
    const [deadlineTypeParam, setDeadlineTypeParam] = useState('standard');
    const [specialRequirements, setSpecialRequirements] = useState([]);

    const fileInputRef = useRef(null);
    const instructionFileInputRef = useRef(null);

    const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState(false);
    const [jobToPayFor, setJobToPayFor] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack'); // Default to Paystack
    const [paymentModalLoading, setPaymentModalLoading] = useState(false);
    const [mobileNumber, setMobileNumber] = useState(''); // Re-introduced mobileNumber state for KoraPay
    const [korapayScriptLoaded, setKorapayScriptLoaded] = useState(false); // Re-introduced KoraPay script loading state

    // NEW REF: To prevent multiple KoraPay verification calls from onSuccess
    const korapayVerificationInitiated = useRef(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Load KoraPay SDK dynamically
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
            console.log('[ClientDirectUpload] KoraPay SDK loaded successfully');
            setKorapayScriptLoaded(true);
        };
        script.onerror = () => {
            console.error('[ClientDirectUpload] Failed to load KoraPay SDK');
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

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientDirectUpload: Unauthorized access or not a client. Redirecting.");
            navigate('/');
            return;
        }
    }, [isAuthenticated, authLoading, user, navigate]);

    // NEW: Handle URL parameters for payment status after redirect from PaymentCallback
    useEffect(() => {
        const paymentStatusParam = searchParams.get('paymentStatus');
        const paymentMessageParam = searchParams.get('message');
        const paymentTypeParam = searchParams.get('type'); // 'success' or 'error'

        if (paymentStatusParam || paymentMessageParam || paymentTypeParam) {
            if (paymentStatusParam === 'success' || paymentTypeParam === 'success') {
                showToast(paymentMessageParam || 'Payment was successful!', 'success');
            } else if (paymentStatusParam === 'failed' || paymentTypeParam === 'error') {
                showToast(paymentMessageParam || 'Payment verification failed. Please contact support.', 'error');
            }

            // Clear the URL parameters to prevent the toast from reappearing on refresh
            // Use navigate with replace: true to remove the params from history
            const currentPath = window.location.pathname;
            navigate(currentPath, { replace: true });
        }
    }, [searchParams, navigate, showToast]);


    const handleAudioVideoFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024 * 1024) {
                showToast(`Main audio/video file must be smaller than 500MB`, 'error');
                e.target.value = null;
                setAudioVideoFile(null);
                return;
            }
            setAudioVideoFile(file);
        } else {
            setAudioVideoFile(null);
        }
    }, [showToast]);

    const handleInstructionFilesChange = useCallback((e) => {
        const files = Array.from(e.target.files); // Corrected from e.files
        const validFiles = files.filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                showToast(`Instruction file ${file.name} is too large (max 10MB).`, 'error');
                return false;
            }
            return true;
        });
        setInstructionFiles(validFiles);
    }, [showToast]);

    const removeAudioVideoFile = useCallback(() => {
        setAudioVideoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = null;
    }, []);

    const removeInstructionFile = useCallback((indexToRemove) => {
        setInstructionFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    }, []);

    const handleSpecialRequirementsChange = useCallback((e) => {
        const { value, checked } = e.target;
        setSpecialRequirements(prev =>
            checked ? [...prev, value] : prev.filter(req => req !== value)
        );
    }, []);


    const getQuote = useCallback(async () => {
        if (!audioVideoFile) {
            showToast('Please upload your main audio/video file first.', 'error');
            return;
        }

        setQuoteLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout(); // Redirect to login if token is missing
            return;
        }

        const formData = new FormData();
        formData.append('audioVideoFile', audioVideoFile);
        formData.append('clientInstructions', clientInstructions);
        formData.append('audioQualityParam', audioQualityParam);
        formData.append('deadlineTypeParam', deadlineTypeParam);
        formData.append('specialRequirements', JSON.stringify(specialRequirements));

        instructionFiles.forEach((file) => {
            formData.append(`instructionFiles`, file);
        });

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/direct-upload/job/quote`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                setQuoteDetails(data.quoteDetails);
                setShowQuoteModal(true);
            } else {
                showToast(data.error || 'Failed to calculate quote.', 'error');
            }
        } catch (error) {
            console.error('Error calculating quote:', error);
            showToast('Network error while calculating quote. Please try again.', 'error');
        } finally {
            setQuoteLoading(false);
        }
    }, [audioVideoFile, clientInstructions, audioQualityParam, deadlineTypeParam, specialRequirements, instructionFiles, showToast, logout]);


    const closeQuoteModal = useCallback(() => {
        setShowQuoteModal(false);
        setQuoteDetails(null);
    }, []);


    // KoraPay Payment Handler
    const handleKorapayPayment = useCallback(async (korapayData, jobId) => {
        if (!window.Korapay) {
            showToast('KoraPay is not loaded. Please refresh the page and try again.', 'error');
            setPaymentModalLoading(false);
            setShowPaymentSelectionModal(false);
            return;
        }

        try {
            window.Korapay.initialize({
                ...korapayData,
                onClose: function () {
                    console.log('[ClientDirectUpload] KoraPay modal closed by user');
                    showToast('Payment cancelled. You can try again when ready.', 'info');
                    setPaymentModalLoading(false);
                    setShowPaymentSelectionModal(false);
                    korapayVerificationInitiated.current = false; // Reset flag on close
                },
                onSuccess: async function (data) {
                    // Prevent duplicate verification calls from onSuccess
                    if (korapayVerificationInitiated.current) {
                        console.warn('[ClientDirectUpload] KoraPay onSuccess triggered multiple times. Ignoring duplicate verification attempt.');
                        return; 
                    }
                    korapayVerificationInitiated.current = true; // Set flag to true

                    console.log('[ClientDirectUpload] KoraPay payment successful:', data);
                    showToast('Payment successful! Verifying...', 'success');

                    try {
                        const token = localStorage.getItem('token');
                        
                        // UPDATED: Use POST method and body for KoraPay direct upload verification
                        const verifyResponse = await fetch(
                            `${BACKEND_API_URL}/api/direct-uploads/payment/verify-korapay`, // Dedicated POST endpoint
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ reference: data.reference, relatedJobId: jobId, paymentMethod: 'korapay' })
                            }
                        );

                        const verifyData = await verifyResponse.json();

                        if (verifyResponse.ok && verifyData.message && verifyData.message.includes('Payment verified')) {
                            showToast('Payment verified! Your job is now active.', 'success');
                            await updateUser(); // Update AuthContext user state
                            await checkAuth(); // Re-fetch auth status
                            korapayVerificationInitiated.current = false; // Reset flag after successful verification
                            setTimeout(() => {
                                navigate('/client-dashboard'); // Redirect to dashboard
                            }, 2000);
                        } else {
                            showToast(verifyData.error || 'Payment verification failed. Please contact support.', 'error');
                            setPaymentModalLoading(false);
                            setShowPaymentSelectionModal(false);
                            korapayVerificationInitiated.current = false; // Reset flag on verification failure
                        }
                    } catch (verifyError) {
                        console.error('[ClientDirectUpload] Error verifying KoraPay payment:', verifyError);
                        showToast('Error verifying payment. Please contact support with your transaction reference.', 'error');
                        setPaymentModalLoading(false);
                        setShowPaymentSelectionModal(false);
                        korapayVerificationInitiated.current = false; // Reset flag on error
                    }
                },
                onFailed: function (data) {
                    console.error('[ClientDirectUpload] KoraPay payment failed:', data);
                    showToast('Payment failed. Please try again or contact support.', 'error');
                    setPaymentModalLoading(false);
                    setShowPaymentSelectionModal(false);
                    korapayVerificationInitiated.current = false; // Reset flag on failure
                }
            });
        } catch (error) {
            console.error('[ClientDirectUpload] Error initializing KoraPay:', error);
            showToast('Failed to initialize payment. Please try again.', 'error');
            setPaymentModalLoading(false);
            setShowPaymentSelectionModal(false);
            korapayVerificationInitiated.current = false; // Reset flag on error
        }
    }, [showToast, navigate, updateUser, checkAuth]);


    const createAndPayForJob = useCallback(async () => {
        if (!quoteDetails || !audioVideoFile) {
            showToast('Quote not calculated or file missing. Please re-calculate quote.', 'error');
            return;
        }
        if (typeof quoteDetails.quote_amount !== 'number' || quoteDetails.quote_amount <= 0) {
            showToast('Invalid quote amount for payment. Please re-calculate quote.', 'error');
            return;
        }
        if (!user?.email) {
            showToast('User email missing. Please contact support.', 'error');
            console.error('User email is not set.');
            return;
        }

        setLoading(true);
        const token = localStorage.getItem('token');

        const formData = new FormData();
        formData.append('audioVideoFile', audioVideoFile);
        formData.append('clientInstructions', clientInstructions);
        formData.append('audioQualityParam', audioQualityParam);
        formData.append('deadlineTypeParam', deadlineTypeParam);
        formData.append('specialRequirements', JSON.stringify(specialRequirements));
        formData.append('quote_amount', quoteDetails.quote_amount);
        formData.append('pricePerMinuteUsd', quoteDetails.price_per_minute_usd);
        formData.append('agreedDeadlineHours', quoteDetails.agreed_deadline_hours);
        formData.append('jobType', 'direct_upload');

        instructionFiles.forEach((file) => {
            formData.append(`instructionFiles`, file);
        });

        try {
            const createJobResponse = await fetch(`${BACKEND_API_URL}/api/direct-upload/job`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const createJobData = await createJobResponse.json();

            if (!createJobResponse.ok || !createJobData.job) {
                showToast(createJobData.error || 'Failed to create job entry. Please try again.', 'error');
                setLoading(false);
                return;
            }

            const jobId = createJobData.job.id;

            setJobToPayFor({
                id: jobId,
                jobType: 'direct_upload',
                quote_amount: quoteDetails.quote_amount,
                agreed_price_usd: quoteDetails.quote_amount // Use quote_amount for direct upload agreed price
            });
            setSelectedPaymentMethod('paystack'); // Default to Paystack for the modal
            setShowPaymentSelectionModal(true);
            closeQuoteModal();
            setLoading(false); // Set loading to false after job creation, payment handled by modal
            showToast('Job created successfully! Please select a payment method.', 'success');


        } catch (error) {
            console.error('Error creating job or initiating payment:', error);
            showToast('Network error creating job or initiating payment. Please try again.', 'error');
            setLoading(false);
        }
    }, [audioVideoFile, clientInstructions, audioQualityParam, deadlineTypeParam, specialRequirements, instructionFiles, quoteDetails, user, showToast, closeQuoteModal]);

    const initiatePayment = useCallback(async () => {
        if (!jobToPayFor?.id || !selectedPaymentMethod) {
            showToast('Job or payment method not selected.', 'error');
            return;
        }
        // Validate mobile number if KoraPay is selected
        if (selectedPaymentMethod === 'korapay' && !mobileNumber.trim()) {
            showToast('Please enter your mobile number for KoraPay payment.', 'error');
            return;
        }

        setPaymentModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error'); // Corrected typo
            logout();
            return;
        }

        let paymentApiUrl;
        let amountToSend;
        const jobType = jobToPayFor.jobType; // Use the explicitly set jobType

        if (jobType === 'negotiation') {
            paymentApiUrl = `${BACKEND_API_URL}/api/negotiations/${jobToPayFor.id}/payment/initialize`;
            amountToSend = jobToPayFor.agreed_price_usd;
        } else if (jobType === 'direct_upload') {
            paymentApiUrl = `${BACKEND_API_URL}/api/direct-uploads/${jobToPayFor.id}/payment/initialize`;
            amountToSend = jobToPayFor.quote_amount;
        } else {
            showToast('Unknown job type for payment initiation.', 'error');
            setPaymentModalLoading(false);
            return;
        }

        try {
            const payload = {
                jobId: jobToPayFor.id,
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
                    showToast('Opening KoraPay payment modal...', 'info');
                    await handleKorapayPayment(data.korapayData, jobToPayFor.id); // Pass job ID for verification
                } else {
                    showToast(data.error || 'Failed to initiate KoraPay payment. Missing data or script not loaded.', 'error');
                    setPaymentModalLoading(false);
                }
            } else {
                showToast(data.error || 'Failed to initiate payment. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            showToast('Network error while initiating payment. Please try again.', 'error');
            setPaymentModalLoading(false);
        } finally {
            // No need to setPaymentModalLoading(false) here, as it's handled by callbacks or redirects
        }
    }, [jobToPayFor, selectedPaymentMethod, mobileNumber, user, showToast, logout, handleKorapayPayment]);


    // eslint-disable-next-line no-unused-vars
    const handleDownloadFile = useCallback(async (jobId, jobType, fileName) => {
        if (jobType !== 'direct_upload') {
            showToast('This action is only for direct upload files.', 'error');
            return;
        }
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


    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="client-direct-upload-container">
                <div className="loading-spinner">Loading authentication...</div>
            </div>
        );
    }
    if (loading) {
        return (
            <div className="client-direct-upload-container">
                <div className="loading-spinner">Processing your request...</div>
            </div>
        );
    }

    return (
        <div className="client-direct-upload-container">
            <header className="client-direct-upload-header">
                <div className="header-content">
                    <h1>⬆️ Direct Upload & Quote</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text">Welcome, <strong>{user.full_name}</strong>!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="client-direct-upload-main">
                <div className="client-direct-upload-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Get an Instant Quote & Upload</h2>
                            <p>Upload your audio/video files for transcription and get an immediate quote.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <form className="upload-form" onSubmit={(e) => { e.preventDefault(); getQuote(); }}>
                        <div className="form-group">
                            <label htmlFor="audioVideoFile">Main Audio/Video File:</label>
                            <input
                                type="file"
                                id="audioVideoFile"
                                name="audioVideoFile"
                                accept="audio/*,video/*"
                                onChange={handleAudioVideoFileChange}
                                ref={fileInputRef}
                                required
                            />
                            {audioVideoFile && (
                                <div className="attached-file-info">
                                    <span>📄 {audioVideoFile.name}</span>
                                    <button type="button" onClick={removeAudioVideoFile} className="remove-file-btn">✕</button>
                                </div>
                            )}
                            <small className="help-text">Mandatory: Max 500MB. Supported formats: MP3, WAV, MP4, etc.</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="clientInstructions">Additional Instructions:</label>
                            <textarea
                                id="clientInstructions"
                                name="clientInstructions"
                                value={clientInstructions}
                                onChange={(e) => setClientInstructions(e.target.value)}
                                placeholder="e.g., 'Speaker 1 is male, Speaker 2 is female', 'Exclude filler words', 'Specific terminology: XYZ'."
                                rows="4"
                            ></textarea>
                        </div>

                        <div className="form-group">
                            <label htmlFor="instructionFiles">Attach More Instruction Files (Optional):</label>
                            <input
                                type="file"
                                id="instructionFiles"
                                name="instructionFiles"
                                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                                multiple
                                onChange={handleInstructionFilesChange}
                                ref={instructionFileInputRef}
                            />
                            {instructionFiles.length > 0 && (
                                <div className="attached-files-list">
                                    {instructionFiles.map((file, index) => (
                                        <div key={index} className="attached-file-info">
                                            <span>📄 {file.name}</span>
                                            <button type="button" onClick={() => removeInstructionFile(index)} className="remove-file-btn">✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <small className="help-text">Optional: Max 5 files, 10MB each. For guidelines, terminology, images.</small>
                        </div>

                        {/* UPDATED: Audio Quality Selection */}
                        <div className="form-group">
                            <label htmlFor="audioQualityParam">Audio Quality:</label>
                            <select id="audioQualityParam" name="audioQualityParam" value={audioQualityParam} onChange={(e) => setAudioQualityParam(e.target.value)}>
                                <option value="excellent">Excellent (Clear, no background noise)</option>
                                <option value="good">Good (Minor background noise, clear voices)</option>
                                <option value="standard">Standard (Some background noise, audible voices)</option>
                                <option value="difficult">Difficult (Heavy background noise, faint/overlapping voices)</option>
                            </select>
                            <small className="help-text">Select the overall clarity of your audio. Higher quality audio typically results in faster and more accurate transcription.</small>
                        </div>

                        {/* UPDATED: Deadline Preference Selection with Timeframes */}
                        <div className="form-group">
                            <label htmlFor="deadlineTypeParam">Deadline Preference:</label>
                            <select id="deadlineTypeParam" name="deadlineTypeParam" value={deadlineTypeParam} onChange={(e) => setDeadlineTypeParam(e.target.value)}>
                                <option value="flexible">Flexible (Est. 24-72 hours)</option>
                                <option value="standard">Standard (Est. 12-24 hours)</option>
                                <option value="urgent">Urgent (Est. 2-12 hours)</option>
                            </select>
                            <small className="help-text">Impacts pricing significantly. 'Urgent' for fastest delivery, 'Flexible' for lower cost.</small>
                        </div>

                        <div className="form-group special-requirements-group">
                            <label>Special Requirements (may affect quote):</label>
                            <div className="checkbox-group">
                                <label>
                                    <input type="checkbox" name="timestamps" value="timestamps" checked={specialRequirements.includes('timestamps')} onChange={handleSpecialRequirementsChange} />
                                    Timestamps (e.g., [00:01:23] Speaker: Text)
                                </label>
                                <label>
                                    <input type="checkbox" name="full_verbatim" value="full_verbatim" checked={specialRequirements.includes('full_verbatim')} onChange={handleSpecialRequirementsChange} />
                                    Full Verbatim (include 'um', 'uh', stutters)
                                </label>
                                <label>
                                    <input type="checkbox" name="speaker_identification" value="speaker_identification" checked={specialRequirements.includes('speaker_identification')} onChange={handleSpecialRequirementsChange} />
                                    Speaker Identification (e.g., Speaker 1: Text)
                                </label>
                                <label>
                                    <input type="checkbox" name="clean_verbatim" value="clean_verbatim" checked={specialRequirements.includes('clean_verbatim')} onChange={handleSpecialRequirementsChange} />
                                    Clean Verbatim (remove filler words)
                                </label>
                            </div>
                            <small className="help-text">Select additional services like timestamps or specific verbatim styles.</small>
                        </div>

                        <button type="submit" className="get-quote-btn" disabled={quoteLoading || !audioVideoFile}>
                            {quoteLoading ? 'Calculating Quote...' : 'Get Instant Quote'}
                        </button>
                    </form>
                </div>
            </main>

            {/* Quote Modal */}
            {showQuoteModal && quoteDetails && (
                <Modal
                    show={showQuoteModal}
                    title="Your Instant Quote"
                    onClose={closeQuoteModal}
                    onSubmit={createAndPayForJob}
                    submitText={`Proceed to Payment (USD ${quoteDetails.quote_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    loading={loading}
                >
                    <p>Based on your selections, here's your instant quote:</p>
                    <div className="quote-summary">
                        <div className="quote-item">
                            <span>Estimated Audio Length:</span>
                            <strong>{quoteDetails.audio_length_minutes?.toFixed(1)} minutes</strong>
                        </div>
                        <div className="quote-item">
                            <span>Audio Quality Selected:</span>
                            <strong>{quoteDetails.audio_quality_param}</strong>
                        </div>
                        <div className="quote-item">
                            <span>Deadline Preference:</span>
                            <strong>{quoteDetails.deadline_type_param}</strong>
                        </div>
                        <div className="quote-item">
                            <span>Special Requirements:</span>
                            <strong>
                                {Array.isArray(quoteDetails.special_requirements) && quoteDetails.special_requirements.length > 0
                                    ? quoteDetails.special_requirements.join(', ')
                                    : 'None'}
                                &nbsp;
                            </strong>
                        </div>
                        <div className="quote-item total-quote">
                            <span>Total Quote:</span>
                            <strong>USD {quoteDetails.quote_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                        <div className="quote-item total-quote">
                            <span>Estimated Delivery:</span>
                            <strong>{quoteDetails.agreed_deadline_hours} hours</strong>
                        </div>
                    </div>
                    <p>Click "Proceed to Payment" to finalize your order.</p>
                </Modal>
            )}

            {/* NEW: Payment Selection Modal */}
            {showPaymentSelectionModal && jobToPayFor && (
                <Modal
                    show={showPaymentSelectionModal}
                    title={`Choose Payment Method for Job: ${jobToPayFor.id?.substring(0, 8)}...`}
                    onClose={() => {setShowPaymentSelectionModal(false); setPaymentModalLoading(false);}}
                    onSubmit={initiatePayment}
                    submitText={paymentModalLoading ? 'Processing...' : `Pay Now (USD ${((jobToPayFor.jobType === 'negotiation' ? jobToPayFor.agreed_price_usd : jobToPayFor.quote_amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    loading={paymentModalLoading}
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
                                    disabled={paymentModalLoading}
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
                                    disabled={paymentModalLoading || !korapayScriptLoaded}
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
                                    disabled={paymentModalLoading}
                                />
                                <small className="input-hint">
                                    Enter your mobile number for faster mobile money payments
                                </small>
                            </div>
                        )}
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

export default ClientDirectUpload;
