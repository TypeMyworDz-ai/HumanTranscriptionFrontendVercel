// src/TranscriberDashboard.js - UPDATED for conditional direct job fetch and graceful loading

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './TranscriberDashboard.css';

import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService';
import { BACKEND_API_URL } from './config';

const TranscriberDashboard = () => {
  const { user, isAuthenticated, authLoading, isAuthReady, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [negotiations, setNegotiations] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [availableDirectJobsCount, setAvailableDirectJobsCount] = useState(0);
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const navigate = useNavigate();

  const audioRef = useRef(null);

  const playNotificationSound = useCallback(() => {
      if (audioRef.current) {
          audioRef.current.play().catch(e => console.error("Error playing sound:", e));
      }
  }, []);

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

  const fetchTranscriberStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setIsAvailable(data.user.is_available || true);
        setCurrentJobId(data.user.current_job_id || null);
      } else {
        console.error('Failed to fetch transcriber status:', data.error);
        return Promise.reject(new Error(data.error || 'Failed to fetch transcriber status.')); // Reject to prevent Promise.all hang
      }
    } catch (error) {
      console.error('Network error fetching transcriber status:', error);
      return Promise.reject(error); // Reject to prevent Promise.all hang
    }
  }, [user]);

  const fetchUnreadMessageCount = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/user/chat/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && typeof data.count === 'number') {
        setUnreadMessageCount(data.count);
      } else {
        console.error('Failed to fetch unread message count:', data.error);
        return Promise.reject(new Error(data.error || 'Failed to fetch unread message count.'));
      }
    } catch (error) {
      console.error('Network error fetching unread message count:', error);
      return Promise.reject(error);
    }
  }, [user]);

  const fetchNegotiationsData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (isAuthenticated) {
        console.warn("TranscriberDashboard: Token missing for API call despite authenticated state. Forcing logout.");
        logout();
      }
      return Promise.reject(new Error('Authentication token missing.')); // Reject to prevent Promise.all hang
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/transcriber/negotiations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setNegotiations(data.negotiations);
      } else {
        console.error('Failed to load negotiations:', data.error);
        showToast(data.error || 'Failed to load negotiations.', 'error');
        return Promise.reject(new Error(data.error || 'Failed to load negotiations.'));
      }
    } catch (error) {
      console.error('Network error while fetching negotiations.', error);
      showToast('Network error while fetching negotiations.', 'error');
      return Promise.reject(error);
    }
  }, [isAuthenticated, logout, showToast]);

  const fetchTranscriberPaymentHistory = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/transcriber/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.summary) {
        setTotalEarnings(data.summary.totalEarnings || 0);
      } else {
        console.error('Failed to fetch transcriber payment history:', data.error);
        return Promise.reject(new Error(data.error || 'Failed to fetch transcriber payment history.'));
      }
    } catch (error) {
      console.error('Network error fetching transcriber payment history:', error);
      return Promise.reject(error);
    }
  }, [user]);

  const fetchAvailableDirectJobsCount = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.jobs) {
        setAvailableDirectJobsCount(data.jobs.length);
      } else {
        // Log the error, but don't show a toast for this specific 403, as it's expected for low-rated users
        console.warn('TranscriberDashboard: Expected 403 for direct jobs or failed to fetch:', data.error);
        setAvailableDirectJobsCount(0); // Set count to 0 if unauthorized or failed
        return Promise.resolve(0); // Resolve the promise to prevent Promise.all from failing
      }
    } catch (error) {
      console.error('Network error fetching available direct jobs count:', error);
      setAvailableDirectJobsCount(0); // Set count to 0 on network error
      return Promise.resolve(0); // Resolve the promise to prevent Promise.all from failing
    }
  }, [user]);


  useEffect(() => {
    console.log('TranscriberDashboard: Main useEffect. isAuthReady:', isAuthReady, 'user:', user, 'authLoading:', authLoading);

    if (!isAuthReady || authLoading || !user || !user.id) {
        if (isAuthReady && !user) {
             console.log("TranscriberDashboard: Auth ready but no user. Redirecting to login.");
             navigate('/login');
        }
        return;
    }

    const isTranscriber = user.user_type === 'transcriber';
    const userStatus = user.status || '';
    const userLevel = user.user_level || '';
    const transcriberRating = user.average_rating || 0; // Assuming average_rating is directly on user object

    const hasActiveTranscriberStatus = userStatus === 'active_transcriber' || userLevel === 'proofreader';

    if (!isTranscriber || !hasActiveTranscriberStatus) {
        console.warn(`TranscriberDashboard: Unauthorized access attempt by user_type: ${user.user_type}, status: ${userStatus}, level: ${userLevel}. Redirecting.`);
        navigate('/');
        return;
    }

    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("TranscriberDashboard: Token missing from localStorage despite isAuthenticated being true. Forcing logout.");
        logout();
        return;
    }

    const fetches = [
        fetchNegotiationsData().catch(e => { console.error("Error in fetchNegotiationsData:", e); return []; }),
        fetchUnreadMessageCount().catch(e => { console.error("Error in fetchUnreadMessageCount:", e); return 0; }),
        fetchTranscriberStatus().catch(e => { console.error("Error in fetchTranscriberStatus:", e); return {}; }),
        fetchTranscriberPaymentHistory().catch(e => { console.error("Error in fetchTranscriberPaymentHistory:", e); return 0; }),
    ];

    // Conditionally fetch direct jobs based on rating
    if (transcriberRating >= 4) {
        fetches.push(fetchAvailableDirectJobsCount().catch(e => { console.error("Error in fetchAvailableDirectJobsCount:", e); return 0; }));
    } else {
        console.log(`TranscriberDashboard: Skipping fetch for direct jobs as rating (${transcriberRating}) is below 4-star.`);
        setAvailableDirectJobsCount(0); // Explicitly set to 0 if not fetching
    }

    Promise.all(fetches).finally(() => {
        setLoading(false);
    });

    console.log(`TranscriberDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id);

    const handleNegotiationUpdate = (data) => {
      console.log('TranscriberDashboard Real-time: Negotiation update received!', data);
      showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
      fetchNegotiationsData();
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      if (transcriberRating >= 4) fetchAvailableDirectJobsCount(); // Only refresh if eligible
    };

    const handleUnreadMessageCountUpdate = (data) => {
        if (data.userId === user.id) {
            console.log('TranscriberDashboard Real-time: Unread message count update received!', data);
            setUnreadMessageCount(prevCount => prevCount + data.change);
            showToast('You have a new message!', 'info');
            if (data.change > 0) {
                playNotificationSound();
            }
        }
    };

    const handleNewChatMessage = (data) => {
        console.log('TranscriberDashboard Real-time: New chat message received!', data);
        if (data.sender_id !== user.id) {
            showToast(`New message from ${data.sender_name || 'Admin'}!`, 'info');
            fetchUnreadMessageCount();
            playNotificationSound();
        }
    };

    const handleJobCompleted = (data) => {
        console.log('TranscriberDashboard Real-time: Job completed!', data);
        showToast(data.message || `Job ${data.negotiationId} was completed!`, 'success');
        fetchNegotiationsData();
        fetchTranscriberStatus();
        fetchTranscriberPaymentHistory();
        if (transcriberRating >= 4) fetchAvailableDirectJobsCount(); // Only refresh if eligible
    };

    const handleJobHired = (data) => {
        console.log('TranscriberDashboard Real-time: Job hired!', data);
        showToast(data.message || `Job ${data.negotiationId} has been hired!`, 'success');
        fetchNegotiationsData();
        fetchTranscriberStatus();
        fetchTranscriberPaymentHistory();
        if (transcriberRating >= 4) fetchAvailableDirectJobsCount(); // Only refresh if eligible
    };

    const handleNewDirectJobAvailable = (data) => {
        console.log('TranscriberDashboard Real-time: New direct job available!', data);
        showToast(data.message || `A new direct upload job is available!`, 'info');
        if (transcriberRating >= 4) fetchAvailableDirectJobsCount(); // Only refresh if eligible
        playNotificationSound();
    };

    const handleDirectJobStatusUpdate = (data) => {
        console.log('TranscriberDashboard Real-time: Direct job status update!', data);
        showToast(`Direct job ${data.jobId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
        if (transcriberRating >= 4) fetchAvailableDirectJobsCount(); // Only refresh if eligible
        fetchTranscriberStatus();
        fetchNegotiationsData();
    };

    const handleSocketConnect = () => {
        socket.emit('joinUserRoom', user.id);
    };

    if (!socket.connected) {
        socket.on('connect', handleSocketConnect);
    } else {
        handleSocketConnect();
    }


    socket.on('new_negotiation_request', handleNegotiationUpdate);
    socket.on('negotiation_accepted', handleNegotiationUpdate);
    socket.on('negotiation_rejected', handleNegotiationUpdate);
    socket.on('negotiation_countered', handleNegotiationUpdate);
    socket.on('negotiation_cancelled', handleNegotiationUpdate);
    socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
    socket.on('newChatMessage', handleNewChatMessage);
    socket.on('job_completed', handleJobCompleted);
    socket.on('job_hired', handleJobHired);
    socket.on('new_direct_job_available', handleNewDirectJobAvailable);
    socket.on('direct_job_status_update', handleDirectJobStatusUpdate);


    return () => {
      console.log(`TranscriberDashboard: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
      socket.off('new_negotiation_request', handleNegotiationUpdate);
      socket.off('negotiation_accepted', handleNegotiationUpdate);
      socket.off('negotiation_rejected', handleNegotiationUpdate);
      socket.off('negotiation_countered', handleNegotiationUpdate);
      socket.off('negotiation_cancelled', handleNegotiationUpdate);
      socket.off('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
      socket.off('newChatMessage', handleNewChatMessage);
      socket.off('job_completed', handleJobCompleted);
      socket.off('job_hired', handleJobHired);
      socket.off('new_direct_job_available', handleNewDirectJobAvailable);
      socket.off('direct_job_status_update', handleDirectJobStatusUpdate);
      socket.off('connect', handleSocketConnect);
      disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user, authLoading, navigate, logout, showToast, fetchNegotiationsData, fetchUnreadMessageCount, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, playNotificationSound]);


  const handleLogout = useCallback(async () => {
    logout();
    disconnectSocket();
  }, [logout]);

  const toggleAvailability = useCallback(async () => {
    const newAvailability = !isAvailable;
    const token = localStorage.getItem('token');
    if (!user?.id || !token) {
      showToast('User not logged in.', 'error');
      return;
    }
    if (newAvailability && currentJobId) {
        showToast('You must complete your current job before becoming available for new ones.', 'error');
        return;
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}/availability-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_available: newAvailability })
      });
      const data = await response.json();
      if (response.ok) {
        setIsAvailable(newAvailability);
        showToast(`You are now ${newAvailability ? 'available' : 'busy'} for new jobs`, 'info');
      } else {
        showToast(data.error || 'Failed to update availability status', 'error');
      }
    } catch (error) {
      console.error('Error toggling availability status:', error);
      showToast('Network error. Please try again.', 'error');
    }
  }, [isAvailable, user, showToast, currentJobId]);

  if (!isAuthenticated || !user) {
    return <div>Not authenticated. Redirecting...</div>;
  }
  if (user.user_type !== 'transcriber') {
      return <div>Unauthorized access. Redirecting...</div>;
  }

  if (loading) {
    return (
        <div className="transcriber-dashboard-container">
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p className="ml-4 text-gray-600">Loading dashboard data...</p>
            </div>
        </div>
    );
  }

  const pendingCount = negotiations.filter(n => n.status === 'pending' || n.status === 'transcriber_counter').length;
  const activeCount = negotiations.filter(n => n.status === 'accepted' || n.status === 'hired' || n.status === 'accepted_awaiting_payment').length; // Include 'accepted_awaiting_payment' in active
  const completedCount = negotiations.filter(n => n.status === 'completed').length;
  const transcriberRating = user.average_rating || 0; // Get rating from user object

  return (
    <div className="transcriber-dashboard-container">
      <header className="transcriber-dashboard-header">
        <div className="header-content">
          <h1>Transcriber Dashboard</h1>
          <div className="profile-section">
            <Link to={`/transcriber-profile/${user.id}`} className="profile-avatar-link">
              <div className="profile-icon">
                {user?.full_name?.charAt(0).toUpperCase() || '👤'}
              </div>
            </Link>
            <span className="welcome-text">Welcome, {user?.full_name || 'Transcriber'}!</span>
          </div>
          <div className="user-profile-actions">
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="transcriber-dashboard-main">
        <div className="transcriber-dashboard-content">
          <div className="dashboard-overview">
            <h2 className="dashboard-title">Your Work Hub</h2>
            <p className="dashboard-description">Manage your profile, view negotiation requests, and track your transcription jobs.</p>
          </div>

          <div className="status-toggles">
            <button
              onClick={toggleAvailability}
              className={`status-toggle-btn ${isAvailable ? 'available' : 'busy'}`}
              disabled={!!currentJobId}
            >
              {isAvailable ? 'Set Busy' : 'Set Available'}
            </button>
          </div>

          <div className="dashboard-sections-grid">
            <Link to="/transcriber-negotiations" className="dashboard-card">
              <div className="card-icon">👋</div>
              <h3>Pending Negotiations ({pendingCount})</h3>
              <p>Review new job offers from clients.</p>
            </Link>

            <Link to={`/transcriber/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`} className="dashboard-card">
              <div className="card-icon">💬</div>
              <h3>My Messages {unreadMessageCount > 0 && <span className="unread-badge">{unreadMessageCount}</span>}</h3>
              <p>View and manage your direct messages.</p>
            </Link>

            <Link to="/transcriber-negotiations?status=active" className="dashboard-card">
              <div className="card-icon">📝</div>
              <h3>My Active Jobs ({activeCount})</h3>
              <p>See jobs you're currently working on.</p>
            </Link>

            <Link to="/transcriber-negotiations?status=completed" className="dashboard-card">
              <div className="card-icon">✅</div>
              <h3>My Completed Jobs ({completedCount})</h3>
              <p>View your finished projects and earnings.</p>
            </Link>

            <Link to={`/transcriber-profile/${user.id}`} className="dashboard-card">
              <div className="card-icon">⭐</div>
              <h3>Profile & Ratings</h3>
              <p>Update your profile and check client feedback.</p>
            </Link>

            <Link to="/transcriber-payments" className="dashboard-card">
              <div className="card-icon">💰</div>
              <h3>Payment History (KES {totalEarnings.toLocaleString()})</h3>
              <p>Review your past transactions and earnings.</p>
            </Link>

            {/* Conditionally render Other Jobs card based on rating */}
            {transcriberRating >= 4 && (
                <Link to="/transcriber-other-jobs" className="dashboard-card">
                <div className="card-icon">💼</div>
                <h3>Other Jobs ({availableDirectJobsCount})</h3>
                <p>Browse and take direct upload jobs from clients.</p>
                </Link>
            )}
          </div>
        </div>
      </main>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={toast.type === 'error' ? 4000 : 3000}
      />
      <audio ref={audioRef} src="/path/to/your/notification-sound.mp3" preload="auto" />
    </div>
  );
};

export default TranscriberDashboard;
