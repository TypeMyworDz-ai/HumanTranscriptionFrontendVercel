// src/TranscriberPool.js - Part 1

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './TranscriberPool.css';

import { useAuth } from './contexts/AuthContext';

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
    negotiationFile: null
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
      const response = await fetch('http://localhost:5000/api/transcribers/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        // FIXED: Filter out transcribers with missing essential data - now checking users.full_name
        const validTranscribers = data.transcribers.filter(transcriber => 
          transcriber && 
          transcriber.users &&
          transcriber.users.full_name && 
          typeof transcriber.users.full_name === 'string' &&
          transcriber.id
        );
        setTranscribers(validTranscribers);
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
      negotiationFile: null
    });
  }, []);

  const closeNegotiation = useCallback(() => {
    setShowNegotiation(false);
    setSelectedTranscriber(null);
    setNegotiationData({
      requirements: '',
      proposedPrice: '',
      deadlineHours: '24',
      negotiationFile: null
    });
    const fileInput = document.getElementById('negotiationFileInput');
    if (fileInput) fileInput.value = '';
  }, []);

  const handleNegotiationChange = useCallback((e) => {
    const { name, value, files } = e.target;
    if (name === 'negotiationFile') {
      const file = files[0];
      if (file) {
        if (file.size > 100 * 1024 * 1024) {
          showToast('Negotiation file must be smaller than 100MB', 'error');
          e.target.value = '';
          setNegotiationData((prev) => ({ ...prev, negotiationFile: null }));
          return;
        }
        setNegotiationData((prev) => ({ ...prev, negotiationFile: file }));
      } else {
        setNegotiationData((prev) => ({ ...prev, negotiationFile: null }));
      }
    } else {
      setNegotiationData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  }, [showToast]);

  const handleRemoveNegotiationFile = useCallback(() => {
    setNegotiationData((prev) => ({
      ...prev,
      negotiationFile: null
    }));
    const fileInput = document.getElementById('negotiationFileInput');
    if (fileInput) fileInput.value = '';
  }, []);

  const submitNegotiation = useCallback(async () => {
    if (!negotiationData.requirements || !negotiationData.proposedPrice || !negotiationData.negotiationFile) {
      showToast('Please fill in all required fields and attach an audio/video file.', 'error');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        return;
      }

      const formData = new FormData();
      formData.append('transcriber_id', selectedTranscriber.id);
      formData.append('requirements', negotiationData.requirements);
      formData.append('proposed_price_kes', parseFloat(negotiationData.proposedPrice));
      formData.append('deadline_hours', parseInt(negotiationData.deadlineHours));
      formData.append('negotiationFile', negotiationData.negotiationFile);

      const response = await fetch('http://localhost:5000/api/negotiations/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
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
// src/TranscriberPool.js - Part 2 (Continue from Part 1)

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
                  <div className="transcriber-avatar">
                    {(transcriber.users?.full_name || 'Unknown').charAt(0).toUpperCase()}
                  </div>
                  <div className="transcriber-info">
                    <h3>{transcriber.users?.full_name || 'Unknown Transcriber'}</h3>
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
              <div className="form-group">
                <label>Project Requirements:</label>
                <textarea
                  name="requirements"
                  value={negotiationData.requirements}
                  onChange={handleNegotiationChange}
                  placeholder="Describe your transcription project, special requirements, audio quality, etc."
                  rows="4"
                  required
                />
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
                    required
                  />
                  {negotiationData.negotiationFile && (
                    <div className="attached-file-info">
                      <span>📄 {negotiationData.negotiationFile.name}</span>
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
                    Mandatory: Attach the audio/video file for the transcriber to assess. Also supports documents (PDF, DOC, TXT) and images (Max 100MB).
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label>Proposed Price (KES):</label>
                <input
                  type="number"
                  name="proposedPrice"
                  value={negotiationData.proposedPrice}
                  onChange={handleNegotiationChange}
                  placeholder="Enter your budget in Kenyan Shillings"
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
                <button onClick={submitNegotiation} className="send-btn" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Negotiation Request'}
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
