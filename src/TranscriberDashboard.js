import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './TranscriberDashboard.css';

import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService';
import { BACKEND_API_URL } from './config';

const TranscriberDashboard = () => {
  const { user, isAuthenticated, authLoading, isAuthReady, logout, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [negotiations, setNegotiations] = useState([]); // Still holds negotiation data
  const [directUploadJobs, setDirectUploadJobs] = useState([]); // NEW: State for direct upload jobs
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [availableDirectJobsCount, setAvailableDirectJobsCount] = useState(0);
  const [activeDirectUploadJobsCount, setActiveDirectUploadJobsCount] = useState(0);
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

  // fetchTranscriberStatus is re-added here as it is a dependency of this callback. The issue is more likely in the main useEffect's dependencies.
  const fetchTranscriberStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        updateUser(data.user);
        return data.user;
      } else {
        console.error('Failed to fetch transcriber status:', data.error);
        return Promise.reject(new Error(data.error || 'Failed to fetch transcriber status.'));
      }
    } catch (error) {
      console.error('Network error fetching transcriber status:', error);
      return Promise.reject(error);
    }
  }, [user?.id, updateUser]); // updateUser is correctly a dependency here as it's called internally.

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

  // UPDATED: Fetch all negotiations and direct upload jobs for the dashboard counts
  const fetchAllTranscriberJobsForCounts = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) {
        if (isAuthenticated) {
            console.warn("TranscriberDashboard: Token or userId missing for API call despite authenticated state. Forcing logout.");
            logout();
        }
        return Promise.reject(new Error('Authentication token or userId missing.'));
    }

    try {
      const [negotiationResponse, directUploadResponse] = await Promise.all([
        fetch(`${BACKEND_API_URL}/api/transcriber/negotiations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/all`, { // Use the new 'all' endpoint
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));
      const directUploadData = await (directUploadResponse.ok ? directUploadResponse.json() : Promise.resolve({ jobs: [] }));

      setNegotiations(negotiationData.negotiations || []);
      setDirectUploadJobs(directUploadData.jobs || []); // Set direct upload jobs state

    } catch (error) {
      console.error('Network error while fetching all transcriber jobs for counts:', error);
      showToast('Network error while fetching dashboard data.', 'error');
      return Promise.reject(error);
    }
  }, [isAuthenticated, logout, showToast, user?.id]);


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
      // Removed redundant frontend eligibility checks. Backend is the single source of truth.
      const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.jobs) {
        setAvailableDirectJobsCount(data.jobs.length);
      } else {
        console.warn('TranscriberDashboard: Failed to fetch available direct jobs or user not eligible: ', data.error);
        setAvailableDirectJobsCount(0);
      }
    } catch (error) {
      console.error('Network error fetching available direct jobs count:', error);
      setAvailableDirectJobsCount(0);
    }
  }, [user?.id, setAvailableDirectJobsCount]);

  // NEW: Fetch active direct upload jobs count for dashboard display
  const fetchActiveDirectUploadJobsCount = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs`, { // This endpoint returns jobs with status 'taken'
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok && data.jobs) {
            setActiveDirectUploadJobsCount(data.jobs.length);
        } else {
            console.error('TranscriberDashboard: Failed to fetch active direct upload jobs count:', data.error);
            setActiveDirectUploadJobsCount(0);
        }
    } catch (error) {
        console.error('Network error fetching active direct upload jobs count:', error);
        setActiveDirectUploadJobsCount(0);
    }
  }, [user?.id, setActiveDirectUploadJobsCount]);


  const handleSocketConnect = useCallback(async (socketInstance) => {
    if (user?.id) {
        socketInstance.emit('joinUserRoom', user.id);
        console.log(`TranscriberDashboard: Sent joinUserRoom event for userId: ${user.id}`);
        
        fetchAvailableDirectJobsCount();
        fetchActiveDirectUploadJobsCount();
    } else {
        console.warn('TranscriberDashboard: userId not provided in activeSocketState, cannot join user room.');
    }
  }, [user?.id, fetchAvailableDirectJobsCount, fetchActiveDirectUploadJobsCount]);


  const handleNegotiationUpdate = useCallback((data) => {
    console.log('TranscriberDashboard Real-time: Negotiation update received!', data);
    showToast(`Negotiation ${data.negotiationId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
    fetchAllTranscriberJobsForCounts(); // Re-fetch all jobs for counts
    fetchTranscriberStatus();
    fetchTranscriberPaymentHistory();
    fetchAvailableDirectJobsCount();
    fetchActiveDirectUploadJobsCount();
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, fetchActiveDirectUploadJobsCount]);


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
      fetchAllTranscriberJobsForCounts(); // Re-fetch all jobs for counts
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      fetchAvailableDirectJobsCount();
      fetchActiveDirectUploadJobsCount();
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, fetchActiveDirectUploadJobsCount]);

  const handleJobHired = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Job hired! (Negotiation)', data);
      showToast(data.message || `Job ${data.negotiationId?.substring(0, 8)}... has been hired!`, 'success');
      fetchAllTranscriberJobsForCounts(); // Re-fetch all jobs for counts
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      fetchAvailableDirectJobsCount();
      fetchActiveDirectUploadJobsCount();
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, fetchActiveDirectUploadJobsCount]);

  const handleNewDirectJobAvailable = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: New direct job available!!', data);
      showToast(data.message || `A new direct upload job is available!`, 'info');
      fetchAvailableDirectJobsCount();
      fetchActiveDirectUploadJobsCount();
      playNotificationSound();
  }, [showToast, fetchAvailableDirectJobsCount, fetchActiveDirectUploadJobsCount, playNotificationSound]);

  const handleDirectJobStatusUpdate = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Direct job status update!.', data);
      showToast(`Direct job ${data.jobId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
      fetchAvailableDirectJobsCount();
      fetchTranscriberStatus();
      fetchAllTranscriberJobsForCounts(); // Re-fetch all jobs for counts
      fetchActiveDirectUploadJobsCount();
  }, [showToast, fetchAvailableDirectJobsCount, fetchTranscriberStatus, fetchAllTranscriberJobsForCounts, fetchActiveDirectUploadJobsCount]);


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
    const transcriberStatus = user.transcriber_status || '';
    const transcriberUserLevel = user.transcriber_user_level || '';

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
        fetchAllTranscriberJobsForCounts(), // Use the new function to fetch both types of jobs
        fetchUnreadMessageCount().catch(e => { console.error("Error in fetchUnreadMessageCount:", e); return 0; }),
        fetchTranscriberPaymentHistory().catch(e => { console.error("Error in fetchTranscriberPaymentHistory:", e); return 0; }),
        fetchActiveDirectUploadJobsCount().catch(e => { console.error("Error in fetchActiveDirectUploadJobsCount:", e); return 0; }),
        fetchAvailableDirectJobsCount().catch(e => { console.error("Error in fetchAvailableDirectJobsCount:", e); return 0; }),
    ];

    Promise.all(fetches).finally(() => {
        setLoading(false);
    });

    console.log(`TranscriberDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id);

    // Define a stable function for the socket 'connect' event listener
    const onSocketConnect = () => handleSocketConnect(socket);
    socket.on('connect', onSocketConnect);

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
      // Use the stable function for cleanup
      socket.off('connect', onSocketConnect); 
      disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user?.id, navigate, logout, showToast, fetchAllTranscriberJobsForCounts, fetchUnreadMessageCount, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, fetchActiveDirectUploadJobsCount, playNotificationSound, handleNegotiationUpdate, handleUnreadMessageCountUpdate, handleNewChatMessage, handleJobCompleted, handleJobHired, handleNewDirectJobAvailable, handleDirectJobStatusUpdate, handleSocketConnect, updateUser, isAuthenticated]);


  const handleLogout = useCallback(async () => {
    logout();
    disconnectSocket();
  }, [logout]);

  // Removed isCurrentlyAvailable derived state entirely.
  // The 'Available' display is removed from JSX.

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

  const pendingNegotiationCount = negotiations.filter(n => n.status === 'pending' || n.status === 'transcriber_counter' || n.status === 'client_counter' || n.status === 'accepted_awaiting_payment').length;
  const activeNegotiationCount = negotiations.filter(n => n.status === 'hired').length;
  // UPDATED: Calculate total completed jobs from both negotiation and direct upload jobs
  const completedJobsCount = negotiations.filter(n => n.status === 'completed').length +
                           directUploadJobs.filter(d => d.status === 'completed' || d.status === 'client_completed').length;
  
  // NEW: Combine active negotiation and active direct upload jobs for total active count
  const totalActiveJobsCount = activeNegotiationCount + activeDirectUploadJobsCount;

  const transcriberRating = user.transcriber_average_rating || 0;
  const firstLetter = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';


  return (
    <div className="transcriber-dashboard-container">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" /> {/* Add audio element for notifications */}
      <header className="transcriber-dashboard-header">
        <div className="header-content">
          <h1>Transcriber Dashboard</h1>
          <div className="user-profile-actions">
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

                    {/* REMOVED: The 'Available' status display completely */}
                    {/* The status display logic for 'Online' and 'Offline' will be handled elsewhere if needed */}

                    <div className="dashboard-sections-grid">
                        <Link to="/transcriber-negotiations" className="dashboard-card">
                            <div className="card-icon">👋</div>
                            <h3>Negotiation Room ({pendingNegotiationCount})</h3>
                            <p>Review and manage all ongoing negotiation offers from clients.</p>
                        </Link>

                        <Link to={`/transcriber/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`} className="dashboard-card">
                            <div className="card-icon">💬</div>
                            <h3>My Messages {unreadMessageCount > 0 && <span className="unread-badge">{unreadMessageCount}</span>}</h3>
                            <p>View and manage your direct messages.</p>
                        </Link>

                        <Link to="/transcriber-jobs" className="dashboard-card">
                            <div className="card-icon">📝</div>
                            <h3>My Active Jobs ({totalActiveJobsCount})</h3> {/* UPDATED: Display total active jobs */}
                            <p>See jobs you're currently working on.</p>
                        </Link>

                        <Link to="/transcriber-negotiations?status=completed" className="dashboard-card">
                            <div className="card-icon">✅</div>
                            <h3>My Completed Jobs ({completedJobsCount})</h3> {/* UPDATED: Uses new combined count */}
                            <p>View your finished projects and earnings.</p>
                        </Link>

                        <Link to={`/transcriber-profile/${user.id}`} className="dashboard-card">
                            <div className="card-icon">⭐</div
                            ><h3>Profile & Ratings</h3>
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
                        
                        <Link to="/trainee/materials" className="dashboard-card"> 
                            <div className="card-icon">📚</div
                            ><h3>Knowledge Base</h3>
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
        </div>
    );
};

export default TranscriberDashboard;
