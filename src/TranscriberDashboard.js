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
  // Removed isAvailable state as it will be derived
  const [currentJobId, setCurrentJobId] = useState(null); // Keep currentJobId to derive availability
  const [negotiations, setNegotiations] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
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
        // Only update currentJobId, isAvailable is now derived from user.is_online and currentJobId
        setCurrentJobId(data.user.current_job_id || null);
      } else {
        console.error('Failed to fetch transcriber status:', data.error);
        return Promise.reject(new Error(data.error || 'Failed to fetch transcriber status.'));
      }
    } catch (error) {
      console.error('Network error fetching transcriber status:', error);
      return Promise.reject(error);
    }
  }, [user?.id, setCurrentJobId]); // Removed setIsAvailable from dependencies

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
      }
    } catch (error) {
      console.error('Network error fetching unread message count:', error);
    }
  }, [user?.id]);

  const fetchNegotiationsData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (isAuthenticated) {
        console.warn("TranscriberDashboard: Token missing for API call despite authenticated state. Forcing logout.");
        logout();
      }
      return Promise.reject(new Error('Authentication token missing.'));
    }

    setLoading(true);
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
        console.error('Error in fetchNegotiationsData:', data.error);
        showToast(data.error || 'Failed to load negotiations.', 'error');
        return Promise.reject(new Error(data.error || 'Failed to load negotiations.'));
      }
    } catch (error) {
      console.error('Network error while fetching negotiations.', error);
      showToast('Network error while fetching negotiations.', 'error');
      return Promise.reject(error);
    } finally {
        setLoading(false); // Ensure loading is reset even if fetchTranscriberPaymentHistory fails
    }
  }, [isAuthenticated, logout, showToast, setNegotiations]);

  const fetchTranscriberPaymentHistory = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/transcriber/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.summary) {
        // Data fetched, but not directly used in this component's state
      } else {
        console.error('Failed to fetch transcriber payment history:', data.error);
        return Promise.reject(new Error(data.error || 'Failed to fetch transcriber payment history.'));
      }
    } catch (error) {
      console.error('Network error fetching transcriber payment history:', error);
      return Promise.reject(error);
    }
  }, [user?.id]);

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
        console.warn('TranscriberDashboard: Expected 403 for direct jobs or failed to fetch: ', data.error);
        setAvailableDirectJobsCount(0);
        return Promise.resolve(0);
      }
    } catch (error) {
      console.error('Network error fetching available direct jobs count:', error);
      setAvailableDirectJobsCount(0);
      return Promise.resolve(0);
    }
  }, [user?.id, setAvailableDirectJobsCount]);


  const handleSocketConnect = useCallback((socketInstance) => {
    if (user?.id) {
        socketInstance.emit('joinUserRoom', user.id);
        console.log(`TranscriberDashboard: Sent joinUserRoom event for userId: ${user.id}`);
    } else {
        console.warn('TranscriberDashboard: userId not provided in activeSocketState, cannot join user room.');
    }
  }, [user?.id]);

  const handleNegotiationUpdate = useCallback((data) => {
    console.log('TranscriberDashboard Real-time: Negotiation update received!', data);
    showToast(`Negotiation ${data.negotiationId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
    fetchNegotiationsData();
    fetchTranscriberStatus();
    fetchTranscriberPaymentHistory();
    if (user?.average_rating >= 4) fetchAvailableDirectJobsCount();
  }, [showToast, fetchNegotiationsData, fetchTranscriberStatus, fetchTranscriberPaymentHistory, user?.average_rating, fetchAvailableDirectJobsCount]);


  const handleUnreadMessageCountUpdate = useCallback((data) => {
      if (data.userId === user.id) {
          console.log('TranscriberDashboard Real-time: Unread message count update received!', data);
          setUnreadMessageCount(prevCount => prevCount + data.change);
          showToast('You have a new message!', 'info');
          if (data.change > 0) {
              playNotificationSound();
          }
      }
  }, [user?.id, showToast, playNotificationSound, setUnreadMessageCount]);

  const handleNewChatMessage = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: New chat message received!', data);
      if (data.sender_id !== user.id) {
          showToast(`New message from ${data.sender_name || 'Admin'}!`, 'info');
          fetchUnreadMessageCount();
          playNotificationSound();
      }
  }, [user?.id, showToast, fetchUnreadMessageCount, playNotificationSound]);

  const handleJobCompleted = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Job completed!', data);
      showToast(data.message || `Job ${data.negotiationId?.substring(0, 8)}... was completed!`, 'success');
      fetchNegotiationsData();
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      if (user?.average_rating >= 4) fetchAvailableDirectJobsCount();
  }, [showToast, fetchNegotiationsData, fetchTranscriberStatus, fetchTranscriberPaymentHistory, user?.average_rating, fetchAvailableDirectJobsCount]);

  const handleJobHired = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Job hired!', data);
      showToast(data.message || `Job ${data.negotiationId?.substring(0, 8)}... has been hired!`, 'success');
      fetchNegotiationsData();
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      if (user?.average_rating >= 4) fetchAvailableDirectJobsCount();
  }, [showToast, fetchNegotiationsData, fetchTranscriberStatus, fetchTranscriberPaymentHistory, user?.average_rating, fetchAvailableDirectJobsCount]);

  const handleNewDirectJobAvailable = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: New direct job available!', data);
      showToast(data.message || `A new direct upload job is available!`, 'info');
      if (user?.average_rating >= 4) fetchAvailableDirectJobsCount();
      playNotificationSound();
  }, [showToast, user?.average_rating, fetchAvailableDirectJobsCount, playNotificationSound]);

  const handleDirectJobStatusUpdate = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Direct job status update!', data);
      showToast(`Direct job ${data.jobId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
      if (user?.average_rating >= 4) fetchAvailableDirectJobsCount();
      fetchTranscriberStatus();
      fetchNegotiationsData();
  }, [showToast, user?.average_rating, fetchAvailableDirectJobsCount, fetchTranscriberStatus, fetchNegotiationsData]);


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
    // FIX: Access transcriber_status and transcriber_user_level from the user object
    const transcriberStatus = user.transcriber_status || '';
    const transcriberUserLevel = user.transcriber_user_level || '';
    const transcriberRating = user.average_rating || 0;

    // FIX: Update authorization check to use transcriber_status and transcriber_user_level
    const hasActiveTranscriberStatus = isTranscriber && (transcriberStatus === 'active_transcriber' || transcriberUserLevel === 'proofreader');

    if (!isTranscriber || !hasActiveTranscriberStatus) {
        console.warn(`TranscriberDashboard: Unauthorized access attempt by user_type: ${user.user_type}, status: ${transcriberStatus}, level: ${transcriberUserLevel}. Redirecting.`);
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

    if (transcriberRating >= 4) {
        fetches.push(fetchAvailableDirectJobsCount().catch(e => { console.error("Error in fetchAvailableDirectJobsCount:", e); return 0; }));
    } else {
        console.log(`TranscriberDashboard: Skipping fetch for direct jobs as rating (${transcriberRating}) is below 4-star.`);
        setAvailableDirectJobsCount(0);
    }

    Promise.all(fetches).finally(() => {
        setLoading(false);
    });

    console.log(`TranscriberDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id);

    // Attach the connect listener here, passing the socket instance
    socket.on('connect', () => handleSocketConnect(socket));


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
  }, [isAuthReady, user, authLoading, navigate, logout, showToast, fetchNegotiationsData, fetchUnreadMessageCount, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, playNotificationSound, handleNegotiationUpdate, handleUnreadMessageCountUpdate, handleNewChatMessage, handleJobCompleted, handleJobHired, handleNewDirectJobAvailable, handleDirectJobStatusUpdate, handleSocketConnect]);


  const handleLogout = useCallback(async () => {
    logout();
    disconnectSocket();
  }, [logout]);

  // Removed toggleAvailability function as availability is now derived
  // Removed isAvailable state as it's no longer manually set

  // Derived state for availability display
  // Transcriber is available if they are online (user.is_online) AND not currently assigned a job (currentJobId is null)
  const isCurrentlyAvailable = user?.is_online && !currentJobId; 

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

  const pendingCount = negotiations.filter(n => n.status === 'pending' || n.status === 'transcriber_counter' || n.status === 'client_counter' || n.status === 'accepted_awaiting_payment').length;
  const activeCount = negotiations.filter(n => n.status === 'hired').length;
  const completedCount = negotiations.filter(n => n.status === 'completed').length;
  const transcriberRating = user.average_rating || 0;
  const firstLetter = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';


  return (
    <div className="transcriber-dashboard-container">
      <header className="transcriber-dashboard-header">
        <div className="header-content">
          <h1>Transcriber Dashboard</h1>
          <div className="user-profile-actions">
                        {/* FIX: Used firstLetter in avatar display */}
                        <Link to={`/transcriber-profile/${user.id}`} className="profile-link" title="View/Edit Profile">
                            <div className="profile-avatar">
                                {firstLetter}
                            </div>
                            <span className="welcome-text">Welcome, {user.full_name}!</span>
                            <span className="profile-icon">⚙️</span>
                        </Link>
                        <button onClick={handleLogout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="transcriber-dashboard-main">
                <div className="transcriber-dashboard-content">
                    <div className="dashboard-overview">
                        <h2>Your Work Hub</h2>
                        <p>Manage your profile, view negotiation requests, and track your transcription jobs.</p>
                    </div>

                    {/* UPDATED: Derived Status Display, centered */}
                    <div className="status-display-container">
                        <span className={`status-pill ${isCurrentlyAvailable ? 'status-available' : 'status-busy'}`}>
                            {isCurrentlyAvailable ? 'Available' : 'Busy'}
                        </span>
                        {currentJobId && (
                            <span className="job-id-display"> (Job ID: {currentJobId.substring(0, 8)}...)</span>
                        )}
                        {!user?.is_online && (
                             <span className="offline-indicator"> (Offline)</span>
                        )}
                    </div>

                    <div className="dashboard-sections-grid">
                        <Link to="/transcriber-negotiations" className="dashboard-card">
                            <div className="card-icon">👋</div>
                            <h3>Negotiation Room ({pendingCount})</h3>
                            <p>Review and manage all ongoing negotiation offers from clients.</p>
                        </Link>

                        <Link to={`/transcriber/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`} className="dashboard-card">
                            <div className="card-icon">💬</div>
                            <h3>My Messages {unreadMessageCount > 0 && <span className="unread-badge">{unreadMessageCount}</span>}</h3>
                            <p>View and manage your direct messages.</p>
                        </Link>

                        <Link to="/transcriber-jobs" className="dashboard-card"> {/* UPDATED: Link to TranscriberJobs.js */}
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
                            <h3>Payment History</h3>
                            <p>Review your past transactions and earnings.</p>
                        </Link>

                        {transcriberRating >= 4 && (
                            <Link to="/transcriber-other-jobs" className="dashboard-card">
                            <div className="card-icon">💼</div>
                            <h3>Other Jobs ({availableDirectJobsCount})</h3>
                            <p>Browse and take direct upload jobs from clients.</p>
                            </Link>
                        )}
                        
                        {/* NEW: Knowledge Base Card for Transcribers */}
                        <Link to="/trainee/materials" className="dashboard-card"> 
                            <div className="card-icon">📚</div>
                            <h3>Knowledge Base</h3>
                            <p>Access training materials and helpful resources.</p>
                        </Link>
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
            <audio ref={audioRef} src="/audio/notification-sound.mp3" preload="auto" /> 
        </div>
    );
};

export default TranscriberDashboard;
