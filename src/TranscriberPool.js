// src/TranscriberPool.js - Part 1 - UPDATED for Vercel deployment, prominent transcriber ratings, and decoupled file upload

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './TranscriberPool.css';

import { useAuth } from './contexts/AuthContext';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const MAX_FILE_SIZE_MB = 500; // Define max file size for client-side validation

const TranscriberPool = () => {
  const { user, isAuthenticated, authLoading, logout } = useAuth();

  const [transcribers, setTranscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscriber, setSelectedTranscriber] = useState(null);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [negotiationData, setNegotiationData] = useState({
    requirements: '',
    proposedPrice: '',
    deadlineHours: '24',
    selectedFile: null, // Holds the File object selected by the user
    uploadedFileUrl: null, // Holds the URL/ID from the backend after temp upload
    isUploadingFile: false // Indicates if a file upload is in progress
  });
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
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

  const fetchAvailableTranscribers = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/transcribers/available`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        // Filter out transcribers that are not truly available based on backend logic
        const trulyAvailableTranscribers = data.transcribers.filter(transcriber =>
            transcriber &&
            transcriber.users &&
            transcriber.users.full_name &&
            typeof transcriber.users.full_name === 'string' &&
            transcriber.id
            // The backend's getAvailableTranscribers function now correctly filters by is_online and current_job_id
            // So no additional filtering is strictly needed here unless frontend specific logic is required.
        );
        setTranscribers(trulyAvailableTranscribers);
      } else {
        showToast(data.error || 'Failed to load transcribers', 'error');
      }
    } catch (error) {
      console.error("Fetch transcribers error:", error);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (authLoading) {
        setLoading(true);
        return;
    }

    if (!isAuthenticated || !user) {
        setLoading(false);
        return;
    }

    if (user.user_type !== 'client') {
        console.warn(`TranscriberPool: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting to appropriate dashboard.`);
        if (user.user_type === 'transcriber') {
            navigate('/transcriber-dashboard');
        } else {
            navigate('/');
        }
        return;
    }

    fetchAvailableTranscribers();
  }, [isAuthenticated, authLoading, user, navigate, fetchAvailableTranscribers]);

  const openNegotiation = useCallback((transcriber) => {
    console.log("openNegotiation function called.", transcriber);
    setSelectedTranscriber(transcriber);
    setShowNegotiation(true);
    setNegotiationData({
      requirements: '',
      proposedPrice: '',
      deadlineHours: '24',
      selectedFile: null,
      uploadedFileUrl: null,
      isUploadingFile: false
    });
  }, []);

  const closeNegotiation = useCallback(() => {
    setShowNegotiation(false);
    setSelectedTranscriber(null);
    setNegotiationData({
      requirements: '',
      proposedPrice: '',
      deadlineHours: '24',
      selectedFile: null,
      uploadedFileUrl: null,
      isUploadingFile: false
    });
    const fileInput = document.getElementById('negotiationFileInput');
    if (fileInput) fileInput.value = '';
  }, []);

  const uploadFileForNegotiation = useCallback(async (file) => {
    setNegotiationData(prev => ({ ...prev, isUploadingFile: true, uploadedFileUrl: null }));
    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Authentication token missing. Please log in again.', 'error');
        setNegotiationData(prev => ({ ...prev, isUploadingFile: false }));
        return null;
    }

    const formData = new FormData();
    formData.append('negotiationFile', file);

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/negotiations/temp-upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            showToast('File uploaded successfully!', 'success');
            setNegotiationData(prev => ({ ...prev, uploadedFileUrl: data.fileUrl, isUploadingFile: false }));
            return data.fileUrl;
        } else {
            showToast(data.error || 'Failed to upload file.', 'error');
            setNegotiationData(prev => ({ ...prev, selectedFile: null, uploadedFileUrl: null, isUploadingFile: false }));
            const fileInput = document.getElementById('negotiationFileInput');
            if (fileInput) fileInput.value = '';
            return null;
        }
    } catch (error) {
        console.error("File upload error:", error);
        showToast('Network error during file upload. Please try again.', 'error');
        setNegotiationData(prev => ({ ...prev, selectedFile: null, uploadedFileUrl: null, isUploadingFile: false }));
        const fileInput = document.getElementById('negotiationFileInput');
        if (fileInput) fileInput.value = '';
        return null;
    }
  }, [showToast]);


  const handleNegotiationChange = useCallback(async (e) => {
    const { name, value, files } = e.target;
    if (name === 'negotiationFile') {
      const file = files[0];
      if (file) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          showToast(`File must be smaller than ${MAX_FILE_SIZE_MB}MB`, 'error');
          e.target.value = '';
          setNegotiationData((prev) => ({ ...prev, selectedFile: null, uploadedFileUrl: null, isUploadingFile: false }));
          return;
        }
        setNegotiationData((prev) => ({ ...prev, selectedFile: file }));
        await uploadFileForNegotiation(file); // Trigger file upload
      } else {
        setNegotiationData((prev) => ({ ...prev, selectedFile: null, uploadedFileUrl: null, isUploadingFile: false }));
      }
    } else {
      setNegotiationData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  }, [showToast, uploadFileForNegotiation]);

  const handleRemoveNegotiationFile = useCallback(() => {
    setNegotiationData((prev) => ({
      ...prev,
      selectedFile: null,
      uploadedFileUrl: null,
      isUploadingFile: false
    }));
    const fileInput = document.getElementById('negotiationFileInput');
    if (fileInput) fileInput.value = '';
  }, []);

  const submitNegotiation = useCallback(async () => {
    if (!negotiationData.requirements || !negotiationData.proposedPrice || !negotiationData.uploadedFileUrl) {
      showToast('Please fill in all required fields and ensure the file is uploaded.', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        return;
      }

      const postData = {
        transcriber_id: selectedTranscriber.id,
        requirements: negotiationData.requirements,
        proposed_price_usd: parseFloat(negotiationData.proposedPrice),
        deadline_hours: parseInt(negotiationData.deadlineHours),
        negotiation_file_url: negotiationData.uploadedFileUrl // Pass the URL, not the file object
      };

      const response = await fetch(`${BACKEND_API_URL}/api/negotiations/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Now sending JSON
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      });

      const data = await response.json();
      if (response.ok) {
        showToast('Negotiation request sent successfully! Redirecting...', 'success');
        closeNegotiation();
        setTimeout(() => {
          navigate('/client-negotiations');
        }, 2000);
      } else {
        showToast(data.error || 'Failed to send negotiation request', 'error');
      }
    } catch (error) {
      console.error("Submit negotiation error:", error);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [negotiationData, selectedTranscriber, showToast, closeNegotiation, navigate, logout]);

  const getBadgeColor = useCallback((badge) => {
    const colors = {
      'fast_delivery': '#28a745',
      'quality_expert': '#007bff',
      'reliable': '#17a2b8',
      'experienced': '#6f42c1'
    };
    return colors[badge] || '#6c757d';
  }, []);
// src/TranscriberPool.js - Part 2 - UPDATED for Vercel deployment and prominent transcriber ratings (Continue from Part 1)

  // Conditional rendering based on AuthContext state and local loading
  if (authLoading) {
    return <div className="loading-container">Loading authentication...</div>;
  }
  if (!isAuthenticated || !user) {
    return <div className="loading-container">Not authenticated. Redirecting...</div>;
  }
  if (user.user_type !== 'client') {
      return <div className="loading-container">Unauthorized access. Redirecting...</div>;
  }

  if (loading) {
    return <div className="loading-container">Loading transcribers...</div>;
  }

  return (
    <div className="pool-container">
      <header className="pool-header">
        <div className="header-content">
          <h1>Available Transcribers</h1>
          <div className="user-info">
            <span>Welcome, {user?.full_name || 'User'}!</span>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="pool-main">
        <div className="pool-intro">
          <h2>Find Your Perfect Transcriber</h2>
          <p>Browse our pool of active, qualified transcribers. Negotiate directly and hire the best fit for your project.</p>
          <Link to="/client-dashboard" className="back-to-dashboard-btn">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="transcribers-grid">
          {transcribers.length === 0 ? (
            <div className="no-transcribers">
              <h3>No transcribers available right now</h3>
              <p>Please check back later or try refreshing the page.</p>
            </div>
          ) : (
            transcribers.map(transcriber => (
              <div key={transcriber.id} className="transcriber-card">
                <div className="transcriber-header">
                  <Link to={`/transcriber-profile/${transcriber.id}`} className="transcriber-profile-link"> {/* NEW: Link to Transcriber Profile */}
                    <div className="transcriber-avatar">
                      {(transcriber.users?.full_name || 'Unknown').charAt(0).toUpperCase()}
                    </div>
                  </Link>
                  <div className="transcriber-info">
                    <Link to={`/transcriber-profile/${transcriber.id}`} className="transcriber-profile-link"> {/* NEW: Link to Transcriber Profile */}
                      <h3>{transcriber.users?.full_name || 'Unknown Transcriber'}</h3>
                    </Link>
                    <div className="online-status">
                      <span className="status-dot online"></span>
                      Online & Available
                    </div>
                  </div>
                </div>

                <div className="transcriber-stats">
                  <div className="stat">
                    <span className="stat-label">Rating</span>
                    <div className="rating">
                      {'★'.repeat(Math.floor(transcriber.average_rating || 0))}
                      {'☆'.repeat(5 - Math.floor(transcriber.average_rating || 0))}
                      <span className="rating-number">({(transcriber.average_rating || 0).toFixed(1)})</span>
                    </div>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Completed Jobs</span>
                    <span className="stat-value">{transcriber.completed_jobs || 0}</span>
                  </div>
                </div>

                {transcriber.badges && (
                  <div className="badges">
                    {transcriber.badges.split(',').map(badge => (
                      <span
                        key={badge}
                        className="badge"
                        style={{ backgroundColor: getBadgeColor(badge) }}
                      >
                        {badge.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    console.log("Start Negotiation button clicked for transcriber:", transcriber.users?.full_name);
                    openNegotiation(transcriber);
                  }}
                  className="hire-btn"
                >
                  Start Negotiation
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Negotiation Modal */}
      {showNegotiation && (
        <div className={`modal-overlay ${showNegotiation ? 'show' : ''}`}>
          <div className="negotiation-modal">
            <div className="modal-header">
              <h3>Negotiate with {selectedTranscriber?.users?.full_name || 'Transcriber'}</h3>
              <button onClick={closeNegotiation} className="close-btn">×</button>
            </div>

            <div className="modal-content">
              {/* NEW: Client Info with Rating */}
              <div className="client-info-for-transcriber">
                <h4>Your Rating:</h4>
                <div className="rating-display">
                  {'★'.repeat(Math.floor(user?.client_average_rating || 0))}
                  {'☆'.repeat(5 - Math.floor(user?.client_average_rating || 0))}
                  <span className="rating-number">({(user?.client_average_rating || 0).toFixed(1)})</span>
                </div>
              </div>
              
              <div className="form-group">
                <label>Project Requirements:</label>
                <textarea
                  name="requirements"
                  value={negotiationData.requirements}
                  onChange={handleNegotiationChange}
                  placeholder="Describe your transcription project, special requirements, audio quality, etc."
                  rows="4"
                  required
                ></textarea>
              </div>

              <div className="form-group">
                <label>Attach Audio/Video File:</label>
                <div className="file-upload-container">
                  <input
                    type="file"
                    id="negotiationFileInput"
                    name="negotiationFile"
                    accept="audio/*,video/*,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    onChange={handleNegotiationChange}
                    disabled={negotiationData.isUploadingFile} // Disable input during upload
                    required
                  />
                  {negotiationData.isUploadingFile && (
                    <div className="upload-progress">Uploading file...</div>
                  )}
                  {negotiationData.uploadedFileUrl && negotiationData.selectedFile && (
                    <div className="attached-file-info">
                      <span>📄 {negotiationData.selectedFile.name} (Uploaded)</span>
                      <button
                        type="button"
                        onClick={handleRemoveNegotiationFile}
                        className="remove-file-btn"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <small className="help-text">
                    Mandatory: Attach the audio/video file for the transcriber to assess. Also supports documents (PDF, DOC, TXT) and images (Max {MAX_FILE_SIZE_MB}MB).
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label>Proposed Price (USD):</label> {/* Changed from KES to USD */}
                <input
                  type="number"
                  name="proposedPrice"
                  value={negotiationData.proposedPrice}
                  onChange={handleNegotiationChange}
                  placeholder="Enter your budget in US Dollars" // Changed placeholder text
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Deadline (Hours):</label>
                <select
                  name="deadlineHours"
                  value={negotiationData.deadlineHours}
                  onChange={handleNegotiationChange}
                >
                  <option value="6">6 hours (Rush)</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="72">72 hours</option>
                </select>
              </div>

              <div className="modal-actions">
                <button onClick={closeNegotiation} className="cancel-btn">
                  Cancel
                </button>
                <button
                  onClick={submitNegotiation}
                  className="send-btn"
                  disabled={loading || negotiationData.isUploadingFile || !negotiationData.uploadedFileUrl} // Disable if overall loading, file uploading, or no file uploaded
                >
                  {loading ? 'Sending...' : (negotiationData.isUploadingFile ? 'Uploading File...' : 'Send Negotiation Request')}
                </button>
              </div>
            </div>
          </div>
        </div>
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

export default TranscriberPool;
