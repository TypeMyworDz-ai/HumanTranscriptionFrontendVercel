// src/ClientDirectUpload.js - FINALIZED for Dynamic Pricing Rules, Audio Quality, Deadline Values, and USD Currency

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import Modal from './Modal'; // Assuming you have a Modal component
import './ClientDirectUpload.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const PAYSTACK_PUBLIC_KEY = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY; // Paystack Public Key

const ClientDirectUpload = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false); // Overall loading for job creation/payment
    const [quoteLoading, setQuoteLoading] = useState(false); // For quote calculation
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    // FIX: quoteDetails will now contain quote_amount, price_per_minute_usd, etc.
    const [quoteDetails, setQuoteDetails] = useState(null); 
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // Form data states
    const [audioVideoFile, setAudioVideoFile] = useState(null);
    const [instructionFiles, setInstructionFiles] = useState([]);
    const [clientInstructions, setClientInstructions] = useState('');
    // UPDATED: Renamed to audioQualityParam and values adjusted
    const [audioQualityParam, setAudioQualityParam] = useState('standard'); // 'excellent', 'good', 'standard', 'difficult'
    // UPDATED: Renamed to deadlineTypeParam, values: 'flexible', 'standard', 'urgent'
    const [deadlineTypeParam, setDeadlineTypeParam] = useState('standard'); 
    const [specialRequirements, setSpecialRequirements] = useState([]); // Array of selected special requirements

    const fileInputRef = useRef(null);
    const instructionFileInputRef = useRef(null);


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
    }, [isAuthenticated, authLoading, user, navigate]);


    // --- File Handling ---
    const handleAudioVideoFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            // UPDATED: File size limit to 500MB
            if (file.size > 500 * 1024 * 1024) { 
                showToast('Main audio/video file must be smaller than 500MB', 'error');
                e.target.value = null; // Clear input
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
            if (file.size > 10 * 1024 * 1024) { // 10MB limit per instruction file
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
        // Note: Clearing instructionFileInputRef.current.value can be tricky for multiple files
        // and might clear all selected. Better to manage state.
    }, []);

    const handleSpecialRequirementsChange = useCallback((e) => {
        const { value, checked } = e.target;
        setSpecialRequirements(prev =>
            checked ? [...prev, value] : prev.filter(req => req !== value)
        );
    }, []);


    // --- Quote Calculation ---
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
        formData.append('audioQualityParam', audioQualityParam); // Correct parameter name
        formData.append('deadlineTypeParam', deadlineTypeParam); 
        formData.append('specialRequirements', JSON.stringify(specialRequirements));
        
        instructionFiles.forEach((file) => {
            formData.append(`instructionFiles`, file);
        });

        // Debugging: Log FormData content
        console.log('FormData for quote request:');
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }

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
                console.log("Quote Details received:", data.quoteDetails); // Debugging log
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


    // --- Job Creation & Payment ---
    const createAndPayForJob = useCallback(async () => {
        if (!quoteDetails || !audioVideoFile) {
            showToast('Quote not calculated or file missing. Please re-calculate quote.', 'error');
            return;
        }
        // FIX: Ensure quoteDetails has the USD amount using the correct property name
        if (typeof quoteDetails.quote_amount !== 'number' || quoteDetails.quote_amount <= 0) {
            showToast('Invalid quote amount for payment. Please re-calculate quote.', 'error');
            return;
        }
        if (!user?.email || !PAYSTACK_PUBLIC_KEY) {
            showToast('Payment gateway not configured or user email missing. Please contact support.', 'error');
            console.error('PAYSTACK_PUBLIC_KEY or user email is not set.');
            return;
        }

        setLoading(true); // Overall loading for job creation and payment
        const token = localStorage.getItem('token');

        // First, create the job entry on the backend
        const formData = new FormData();
        formData.append('audioVideoFile', audioVideoFile);
        formData.append('clientInstructions', clientInstructions);
        formData.append('audioQualityParam', audioQualityParam); // Correct parameter name
        formData.append('deadlineTypeParam', deadlineTypeParam); 
        formData.append('specialRequirements', JSON.stringify(specialRequirements));
        // FIX: Pass the calculated USD quote using the correct property name
        formData.append('quote_amount', quoteDetails.quote_amount); // FIX: Changed 'quoteAmountUsd' to 'quote_amount'
        formData.append('pricePerMinuteUsd', quoteDetails.price_per_minute_usd); // Pass price per minute
        formData.append('agreedDeadlineHours', quoteDetails.agreed_deadline_hours); // Pass the calculated deadline

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

            // Then, initialize Paystack transaction using the new job ID
            const initializePaymentResponse = await fetch(`${BACKEND_API_URL}/api/payment/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    negotiationId: jobId, // Use the new jobId as negotiationId for payment
                    // FIX: Pass USD amount for payment using the correct property name
                    amount: quoteDetails.quote_amount, 
                    email: user.email
                })
            });
            const initializePaymentData = await initializePaymentResponse.json();

            if (initializePaymentResponse.ok && initializePaymentData.data?.authorization_url) {
                showToast('Job created. Redirecting to payment...', 'info');
                window.location.href = initializePaymentData.data.authorization_url; // Redirect to Paystack
            } else {
                showToast(initializePaymentData.error || 'Failed to initiate payment for job. Please try again.', 'error');
                setLoading(false);
            }

        } catch (error) {
            console.error('Error creating job or initiating payment:', error);
            showToast('Network error creating job or initiating payment. Please try again.', 'error');
            setLoading(false);
        } finally {
            closeQuoteModal(); // Close quote modal regardless
        }
    }, [audioVideoFile, clientInstructions, audioQualityParam, deadlineTypeParam, specialRequirements, instructionFiles, quoteDetails, user, showToast, closeQuoteModal]);


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
                    // FIX: Use quote_amount for display in submit button text
                    submitText={`Proceed to Payment (USD ${quoteDetails.quote_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                    loading={loading} // Use overall loading for payment
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
                            <strong>{quoteDetails.special_requirements?.length > 0 ? quoteDetails.special_requirements.join(', ') : 'None'}&nbsp;</strong>
                        </div>
                        <div className="quote-item total-quote">
                            <span>Total Quote:</span>
                            {/* FIX: Use quote_amount for display */}
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
