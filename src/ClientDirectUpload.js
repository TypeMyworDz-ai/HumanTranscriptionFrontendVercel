// src/ClientDirectUpload.js - FINALIZED for Dynamic Pricing Rules, Audio Quality, Deadline Values, and USD Currency
// FIXED: TypeError: Cannot read properties of undefined (reading 'join')
// FIXED: ESLint warning: 'PAYSTACK_PUBLIC_KEY' is assigned a value but never used
// UPDATED: Re-introduced mobileNumber input and state to match training payment logic.
// FIXED: ESLint warning: 'handleDownloadFile' is assigned a value but never used
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import Modal from './Modal';
import './ClientDirectUpload.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
// eslint-disable-next-line no-unused-vars
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;

const ClientDirectUpload = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

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
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paystack');
    const [paymentModalLoading, setPaymentModalLoading] = useState(false);
    // RE-INTRODUCED: State for mobile number for KoraPay
    const [mobileNumber, setMobileNumber] = useState('');


    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientDirectUpload: Unauthorized access or not a client. Redirecting.");
            navigate('/');
            return;
        }

        // Dynamically load KoraPay script if selected and not already loaded
        if (selectedPaymentMethod === 'korapay' && !window.Korapay) {
            const script = document.createElement('script');
            script.src = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
            script.async = true;
            document.body.appendChild(script);

            script.onload = () => {
                console.log("KoraPay script loaded successfully in ClientDirectUpload.");
            };
            script.onerror = (error) => {
                console.error("Failed to load KoraPay script in ClientDirectUpload:", error);
                showToast("Failed to load KoraPay payment gateway. Please try again.", "error");
            };

            return () => {
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
            };
        }
    }, [isAuthenticated, authLoading, user, navigate, selectedPaymentMethod, showToast]);


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
        const files = Array.from(e.target.files);
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
    }, [audioVideoFile, clientInstructions, audioQualityParam, deadlineTypeParam, specialRequirements, instructionFiles, showToast]);


    const closeQuoteModal = useCallback(() => {
        setShowQuoteModal(false);
        setQuoteDetails(null);
    }, []);


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
                agreed_price_usd: quoteDetails.quote_amount
            });
            setSelectedPaymentMethod('paystack');
            setShowPaymentSelectionModal(true);
            closeQuoteModal();
            setLoading(false);

        } catch (error) {
            console.error('Error creating job or initiating payment:', error);
            showToast('Network error creating job or initiating payment. Please try again.', 'error');
            setLoading(false);
        } finally {
        }
    }, [audioVideoFile, clientInstructions, audioQualityParam, deadlineTypeParam, specialRequirements, instructionFiles, quoteDetails, user, showToast, closeQuoteModal]);

    const initiatePayment = useCallback(async () => {
        if (!jobToPayFor?.id || !selectedPaymentMethod) {
            showToast('Job or payment method not selected.', 'error');
            return;
        }
        // RE-INTRODUCED: Validate mobile number for KoraPay
        if (selectedPaymentMethod === 'korapay' && !mobileNumber) {
            showToast('Please enter your mobile number for KoraPay.', 'error');
            setPaymentModalLoading(false);
            return;
        }

        setPaymentModalLoading(true);
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
            setPaymentModalLoading(false);
            return;
        }

        try {
            const payload = {
                jobId: jobToPayFor.id,
                amount: amountToSend,
                email: user.email,
                paymentMethod: selectedPaymentMethod,
            };
            // RE-INTRODUCED: Add mobileNumber to payload if KoraPay is selected
            if (selectedPaymentMethod === 'korapay') {
                payload.mobileNumber = mobileNumber;
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
                            email: customer?.email || user.email,
                            // RE-INTRODUCED: phone to finalCustomer for KoraPay
                            phone: mobileNumber || customer?.phone || undefined
                        };

                        window.Korapay.initialize({
                            key: key,
                            reference: reference,
                            amount: amount,
                            currency: currency || "KES",
                            customer: finalCustomer,
                            notification_url: notification_url,
                            onClose: () => {
                                console.log("KoraPay modal closed for direct upload.");
                                showToast("Payment cancelled.", "info");
                                setPaymentModalLoading(false);
                                setShowPaymentSelectionModal(false);
                            },
                            onSuccess: async (korapayResponse) => {
                                console.log("KoraPay payment successful for direct upload:", korapayResponse);
                                showToast("Payment successful! Verifying...", "success");
                                try {
                                    const verifyEndpoint = `${BACKEND_API_URL}/api/direct-uploads/${jobToPayFor.id}/payment/verify/${korapayResponse.reference}?paymentMethod=korapay`;

                                    const verifyResponse = await fetch(verifyEndpoint, {
                                        method: 'GET',
                                        headers: { 'Authorization': `Bearer ${token}` },
                                    });
                                    const verifyData = await verifyResponse.json();

                                    if (verifyResponse.ok) {
                                        showToast("Payment successfully verified. Redirecting to dashboard!", "success");
                                        setShowPaymentSelectionModal(false);
                                        navigate('/client-dashboard');
                                    } else {
                                        showToast(verifyData.error || "Payment verification failed. Please contact support.", "error");
                                        setPaymentModalLoading(false);
                                    }
                                } catch (verifyError) {
                                    console.error('Error during KoraPay verification for direct upload:', verifyError);
                                    showToast('Network error during payment verification. Please contact support.', 'error');
                                    setPaymentModalLoading(false);
                                }
                            },
                            onFailed: (korapayResponse) => {
                                console.error("KoraPay payment failed for direct upload:", korapayResponse);
                                showToast("Payment failed. Please try again.", "error");
                                setPaymentModalLoading(false);
                            }
                        });
                    } else {
                        showToast('KoraPay script not loaded. Please try again or contact support.', 'error');
                        setPaymentModalLoading(false);
                        setShowPaymentSelectionModal(false);
                    }
                } else {
                    showToast(data.error || 'Failed to initiate KoraPay payment. Missing data from server.', 'error');
                }
                setPaymentModalLoading(false);
            } else {
                showToast(data.error || 'Failed to initiate payment. Please try again.', 'error');
                setPaymentModalLoading(false);
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            showToast('Network error while initiating payment. Please try again.', 'error');
            setPaymentModalLoading(false);
        } finally {
        }
    }, [jobToPayFor, selectedPaymentMethod, user, showToast, logout, navigate, mobileNumber]);

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
            const downloadUrl = `${BACKEND_API_URL}/api/direct-jobs/${jobId}/download/${fileName}`;

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
                    <h1>Direct Upload & Quote</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
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
                            <p>Upload your audio/video files for transcription and get an an immediate quote.</p>
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
                    onClose={() => setShowPaymentSelectionModal(false)}
                    onSubmit={initiatePayment}
                    submitText={`Pay Now (USD ${((jobToPayFor.jobType === 'negotiation' ? jobToPayFor.agreed_price_usd : jobToPayFor.quote_amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    loading={paymentModalLoading}
                >
                    <p>Select your preferred payment method:</p>
                    <div className="payment-method-selection">
                        <label className="radio-label">
                            <input
                                type="radio"
                                value="paystack"
                                checked={selectedPaymentMethod === 'paystack'}
                                onChange={() => setSelectedPaymentMethod('paystack')}
                                disabled={paymentModalLoading}
                            />
                            Paystack (Card, Mobile Money, Bank Transfer, Pesalink)
                        </label>
                        <label className="radio-label">
                            <input
                                type="radio"
                                value="korapay"
                                checked={selectedPaymentMethod === 'korapay'}
                                onChange={() => setSelectedPaymentMethod('korapay')}
                                disabled={paymentModalLoading}
                            />
                            KoraPay (Card, Bank Transfer, Mobile Money)
                        </label>
                    </div>

                    {/* RE-INTRODUCED: Mobile Number Input for KoraPay */}
                    {selectedPaymentMethod === 'korapay' && (
                        <div className="form-group mobile-number-input">
                            <label htmlFor="mobileNumber">Mobile Number for KoraPay (Optional):</label>
                            <input
                                type="text"
                                id="mobileNumber"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                placeholder="e.g., 2547XXXXXXXX"
                                disabled={paymentModalLoading}
                                className="text-input-field"
                            />
                            <small className="help-text">Required for some mobile money payments with KoraPay.</small>
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
