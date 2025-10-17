// src/ClientDirectUpload.js

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

    const [loading, setLoading] = useState(false);
    const [fileLoading, setFileLoading] = useState(false); // For file processing/upload
    const [quoteLoading, setQuoteLoading] = useState(false); // For quote calculation
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [quoteDetails, setQuoteDetails] = useState(null);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // Form data states
    const [audioVideoFile, setAudioVideoFile] = useState(null);
    const [instructionFiles, setInstructionFiles] = useState([]);
    const [clientInstructions, setClientInstructions] = useState('');
    const [qualityParam, setQualityParam] = useState('standard'); // 'standard', 'premium', 'basic'
    const [deadlineParam, setDeadlineParam] = useState('normal'); // 'normal', 'rush', 'extended'
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
            if (file.size > 200 * 1024 * 1024) { // 200MB limit
                showToast('Audio/Video file must be smaller than 200MB', 'error');
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
            logout();
            return;
        }

        const formData = new FormData();
        formData.append('audioVideoFile', audioVideoFile);
        formData.append('clientInstructions', clientInstructions);
        formData.append('qualityParam', qualityParam);
        formData.append('deadlineParam', deadlineParam);
        formData.append('specialRequirements', JSON.stringify(specialRequirements));
        
        instructionFiles.forEach((file, index) => {
            formData.append(`instructionFiles`, file);
        });

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/direct-upload/job/quote`, { // NEW: Dedicated quote endpoint
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
    }, [audioVideoFile, clientInstructions, qualityParam, deadlineParam, specialRequirements, instructionFiles, logout, showToast]);

    const closeQuoteModal = useCallback(() => {
        setShowQuoteModal(false);
        setQuoteDetails(null);
    }, []);


    // --- Job Creation & Payment ---
    const createAndPayForJob = useCallback(async () => {
        if (!quoteDetails || !audioVideoFile) {
            showToast('Quote not calculated or file missing.', 'error');
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
        formData.append('qualityParam', qualityParam);
        formData.append('deadlineParam', deadlineParam);
        formData.append('specialRequirements', JSON.stringify(specialRequirements));
        formData.append('quoteAmount', quoteDetails.quote); // Pass the calculated quote
        formData.append('agreedDeadlineHours', quoteDetails.agreed_deadline_hours); // Pass the calculated deadline

        instructionFiles.forEach((file, index) => {
            formData.append(`instructionFiles`, file);
        });

        try {
            const createJobResponse = await fetch(`${BACKEND_API_URL}/api/direct-upload/job`, { // NEW: Job creation endpoint
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            const createJobData = await createJobResponse.json();

            if (!createJobResponse.ok || !createJobData.job) {
                showToast(createJobData.error || 'Failed to create job entry.', 'error');
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
                    amount: quoteDetails.quote,
                    email: user.email
                })
            });
            const initializePaymentData = await initializePaymentResponse.json();

            if (initializePaymentResponse.ok && initializePaymentData.data?.authorization_url) {
                showToast('Job created. Redirecting to payment...', 'info');
                window.location.href = initializePaymentData.data.authorization_url; // Redirect to Paystack
            } else {
                showToast(initializePaymentData.error || 'Failed to initiate payment for job.', 'error');
                // If payment initiation fails after job creation, you might want to mark the job as cancelled or pending payment.
                // For now, it remains 'pending_review' or could be updated to 'payment_failed' via another API call.
                setLoading(false);
            }

        } catch (error) {
            console.error('Error creating job or initiating payment:', error);
            showToast('Network error creating job or initiating payment. Please try again.', 'error');
            setLoading(false);
        } finally {
            closeQuoteModal(); // Close quote modal regardless
        }
    }, [audioVideoFile, clientInstructions, qualityParam, deadlineParam, specialRequirements, instructionFiles, quoteDetails, user, logout, showToast, closeQuoteModal]);


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
                            <small className="help-text">Mandatory: Max 200MB. Supported formats: MP3, WAV, MP4, etc.</small>
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

                        <div className="form-group">
                            <label htmlFor="qualityParam">Transcription Quality:</label>
                            <select id="qualityParam" name="qualityParam" value={qualityParam} onChange={(e) => setQualityParam(e.target.value)}>
                                <option value="basic">Basic (Lower Cost)</option>
                                <option value="standard">Standard (Recommended)</option>
                                <option value="premium">Premium (Higher Accuracy)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="deadlineParam">Deadline Preference:</label>
                            <select id="deadlineParam" name="deadlineParam" value={deadlineParam} onChange={(e) => setDeadlineParam(e.target.value)}>
                                <option value="extended">Extended (Lower Cost)</option>
                                <option value="normal">Normal</option>
                                <option value="rush">Rush (Higher Cost)</option>
                            </select>
                        </div>

                        <div className="form-group special-requirements-group">
                            <label>Special Requirements:</label>
                            <div className="checkbox-group">
                                <label>
                                    <input type="checkbox" name="timestamps" value="timestamps" checked={specialRequirements.includes('timestamps')} onChange={handleSpecialRequirementsChange} />
                                    Timestamps
                                </label>
                                <label>
                                    <input type="checkbox" name="full_verbatim" value="full_verbatim" checked={specialRequirements.includes('full_verbatim')} onChange={handleSpecialRequirementsChange} />
                                    Full Verbatim (include 'um', 'uh', stutters)
                                </label>
                                <label>
                                    <input type="checkbox" name="speaker_identification" value="speaker_identification" checked={specialRequirements.includes('speaker_identification')} onChange={handleSpecialRequirementsChange} />
                                    Speaker Identification
                                </label>
                                <label>
                                    <input type="checkbox" name="clean_verbatim" value="clean_verbatim" checked={specialRequirements.includes('clean_verbatim')} onChange={handleSpecialRequirementsChange} />
                                    Clean Verbatim (remove filler words)
                                </label>
                            </div>
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
                    submitText={`Proceed to Payment (KES ${quoteDetails.quote.toLocaleString()})`}
                    loading={loading} // Use overall loading for payment
                >
                    <p>Based on your selections, here's your instant quote:</p>
                    <div className="quote-summary">
                        <div className="quote-item">
                            <span>Estimated Audio Length:</span>
                            <strong>{quoteDetails.audio_length_minutes?.toFixed(1)} minutes</strong>
                        </div>
                        <div className="quote-item">
                            <span>Service Quality:</span>
                            <strong>{quoteDetails.quality_param}</strong>
                        </div>
                        <div className="quote-item">
                            <span>Deadline Preference:</span>
                            <strong>{quoteDetails.deadline_param}</strong>
                        </div>
                        <div className="quote-item">
                            <span>Special Requirements:</span>
                            <strong>{quoteDetails.special_requirements?.length > 0 ? quoteDetails.special_requirements.join(', ') : 'None'}</strong>
                        </div>
                        <div className="quote-item total-quote">
                            <span>Total Quote:</span>
                            <strong>KES {quoteDetails.quote.toLocaleString()}</strong>
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
