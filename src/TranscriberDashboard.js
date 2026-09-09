import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './TranscriberDashboard.css';
import './HumanDashboardShared.css';

import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService';
import { BACKEND_API_URL } from './config';

const TranscriberDashboard = () => {
  const { user, isAuthenticated, authLoading, isAuthReady, logout, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [negotiations, setNegotiations] = useState([]); 
  // const [directUploadJobs, setDirectUploadJobs] = useState([]); // No longer needed as separate state
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [availableDirectJobsCount, setAvailableDirectJobsCount] = useState(0);
  const [activeDirectUploadJobsCount, setActiveDirectUploadJobsCount] = useState(0);
  const [completedDirectUploadJobsCount, setCompletedDirectUploadJobsCount] = useState(0); // NEW: State for completed DU jobs count
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
  }, [user?.id, updateUser]); 

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
        // UPDATED: Call the history endpoint to get all direct upload jobs
        fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/history`, { 
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const negotiationData = await (negotiationResponse.ok ? negotiationResponse.json() : Promise.resolve({ negotiations: [] }));
      const directUploadData = await (directUploadResponse.ok ? directUploadResponse.json() : Promise.resolve({ jobs: [] }));

      setNegotiations(negotiationData.negotiations || []);
      // setDirectUploadJobs(directUploadData.jobs || []); // No longer needed as separate state

      // NEW: Calculate active and completed direct upload jobs from the fetched history
      const fetchedDirectUploadJobs = directUploadData.jobs || [];
      const activeJobs = fetchedDirectUploadJobs.filter(job => job.status === 'taken' || job.status === 'in_progress');
      const completedJobs = fetchedDirectUploadJobs.filter(job => job.status === 'completed' || job.status === 'client_completed');
      
      setActiveDirectUploadJobsCount(activeJobs.length);
      setCompletedDirectUploadJobsCount(completedJobs.length);

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

  // REMOVED: fetchActiveDirectUploadJobsCount as it's now handled by fetchAllTranscriberJobsForCounts


  const handleSocketConnect = useCallback(async (socketInstance) => {
    if (user?.id) {
        socketInstance.emit('joinUserRoom', user.id);
        console.log(`TranscriberDashboard: Sent joinUserRoom event for userId: ${user.id}`);
        
        fetchAvailableDirectJobsCount();
        // fetchActiveDirectUploadJobsCount(); // REMOVED
    } else {
        console.warn('TranscriberDashboard: userId not provided in activeSocketState, cannot join user room.');
    }
  }, [user?.id, fetchAvailableDirectJobsCount]); // REMOVED fetchActiveDirectUploadJobsCount from dependencies


  const handleNegotiationUpdate = useCallback((data) => {
    console.log('TranscriberDashboard Real-time: Negotiation update received!', data);
    showToast(`Negotiation ${data.negotiationId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
    fetchAllTranscriberJobsForCounts(); 
    fetchTranscriberStatus();
    fetchTranscriberPaymentHistory();
    fetchAvailableDirectJobsCount();
    // fetchActiveDirectUploadJobsCount(); // REMOVED
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount]); // REMOVED fetchActiveDirectUploadJobsCount from dependencies


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
      console.log('TranscriberDashboard Real-time: Job completed! (Negotiation)', data); 
      showToast(data.message || `Negotiation Job ${data.negotiationId?.substring(0, 8)}... was completed!`, 'success');
      fetchAllTranscriberJobsForCounts(); 
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      fetchAvailableDirectJobsCount();
      // fetchActiveDirectUploadJobsCount(); // REMOVED
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount]); // REMOVED fetchActiveDirectUploadJobsCount from dependencies

  const handleJobHired = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Job hired! (Negotiation)', data); 
      showToast(data.message || `Negotiation Job ${data.negotiationId?.substring(0, 8)}... has been hired!`, 'success');
      fetchAllTranscriberJobsForCounts(); 
      fetchTranscriberStatus();
      fetchTranscriberPaymentHistory();
      fetchAvailableDirectJobsCount();
      // fetchActiveDirectUploadJobsCount(); // REMOVED
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount]); // REMOVED fetchActiveDirectUploadJobsCount from dependencies

  const handleNewDirectJobAvailable = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: New direct job available!!', data);
      showToast(data.message || `A new direct upload job is available!`, 'info');
      fetchAvailableDirectJobsCount();
      fetchAllTranscriberJobsForCounts(); // UPDATED: Call this to update active/completed counts
      playNotificationSound();
  }, [showToast, fetchAvailableDirectJobsCount, fetchAllTranscriberJobsForCounts, playNotificationSound]); // UPDATED dependencies

  const handleDirectJobStatusUpdate = useCallback((data) => {
      console.log('TranscriberDashboard Real-time: Direct job status update! (General)', data);
      showToast(`Direct Job ${data.jobId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
      fetchAvailableDirectJobsCount();
      fetchTranscriberStatus();
      fetchAllTranscriberJobsForCounts(); 
      // fetchActiveDirectUploadJobsCount(); // REMOVED
  }, [showToast, fetchAvailableDirectJobsCount, fetchTranscriberStatus, fetchAllTranscriberJobsForCounts]); // REMOVED fetchActiveDirectUploadJobsCount from dependencies

  const handleDirectJobCompletedTranscriberSide = useCallback((data) => { 
    console.log('TranscriberDashboard Real-time: Direct job completed (Transcriber side)!', data);
    showToast(data.message || `Direct Job ${data.jobId?.substring(0, 8)}... submitted for client review!`, 'success');
    fetchAllTranscriberJobsForCounts(); 
    fetchTranscriberStatus();
    fetchTranscriberPaymentHistory(); 
    fetchAvailableDirectJobsCount();
    // fetchActiveDirectUploadJobsCount(); // REMOVED
  }, [showToast, fetchAllTranscriberJobsForCounts, fetchTranscriberStatus, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount]); // REMOVED fetchActiveDirectUploadJobsCount from dependencies


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
        fetchAllTranscriberJobsForCounts(), 
        fetchUnreadMessageCount().catch(e => { console.error("Error in fetchUnreadMessageCount:", e); return 0; }),
        fetchTranscriberPaymentHistory().catch(e => { console.error("Error in fetchTranscriberPaymentHistory:", e); return 0; }),
        // fetchActiveDirectUploadJobsCount().catch(e => { console.error("Error in fetchActiveDirectUploadJobsCount:", e); return 0; }), // REMOVED
        fetchAvailableDirectJobsCount().catch(e => { console.error("Error in fetchAvailableDirectJobsCount:", e); return 0; }),
    ];

    Promise.all(fetches).finally(() => {
        setLoading(false);
    });

    console.log(`TranscriberDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id);

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
    socket.on('direct_job_completed_transcriber_side', handleDirectJobCompletedTranscriberSide); 


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
      socket.off('direct_job_completed_transcriber_side', handleDirectJobCompletedTranscriberSide);
      socket.off('connect', onSocketConnect); 
      disconnectSocket();
    };
  }, [isAuthReady, user?.id, navigate, logout, showToast, fetchAllTranscriberJobsForCounts, fetchUnreadMessageCount, fetchTranscriberPaymentHistory, fetchAvailableDirectJobsCount, playNotificationSound, handleNegotiationUpdate, handleUnreadMessageCountUpdate, handleNewChatMessage, handleJobCompleted, handleJobHired, handleNewDirectJobAvailable, handleDirectJobStatusUpdate, handleSocketConnect, updateUser, isAuthenticated, authLoading, user, handleDirectJobCompletedTranscriberSide]); // UPDATED: Removed fetchActiveDirectUploadJobsCount from dependencies


  const handleLogout = useCallback(async () => {
    logout();
    disconnectSocket();
  }, [logout]);

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
  
  const completedNegotiationJobsCount = negotiations.filter(n => n.status === 'completed').length;
  // const completedDirectUploadJobsCount = directUploadJobs.filter(d => d.status === 'completed' || d.status === 'client_completed').length; // Now derived from state
  // Removed totalCompletedJobsCount and totalActiveJobsCount as they are no longer displayed in JSX
  // const totalCompletedJobsCount = completedNegotiationJobsCount + completedDirectUploadJobsCount;
  // const totalActiveJobsCount = activeNegotiationCount + activeDirectUploadJobsCount;

  const transcriberRating = user.transcriber_average_rating || 0;
  const firstLetter = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';


  return (
    <div className="transcriber-dashboard-container tm-suite-dashboard tm-worker-suite">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />
      <header className="tm-suite-topbar">
        <Link to="/transcriber-dashboard" className="tm-suite-brand" aria-label="TypeMyworDz worker dashboard">
          <img src="/logo192.png" alt="" />
          <span><b className="tm-brand-purple">Type</b><b className="tm-brand-green">My</b><b className="tm-brand-purple">worDz</b><small>Transcriber workspace</small></span>
        </Link>
        <div className="tm-suite-account">
          <Link to={`/transcriber-profile/${user.id}`} className="tm-suite-profile"><span>{firstLetter}</span>{user.full_name}</Link>
          <button onClick={handleLogout} className="tm-suite-logout">Log out</button>
        </div>
      </header>

      <main className="tm-suite-main">
        <section className="tm-suite-intro">
          <div><span className="tm-suite-eyebrow">WORKER WORKSPACE</span><h1>Keep your queue moving.</h1><p>See what needs your attention, what is in progress and what you have earned.</p></div>
          <div className="tm-suite-live-mark"><span />Available for work</div>
        </section>
        <section className="tm-suite-metrics" aria-label="Worker summary">
          <div><span>Offers to review</span><strong>{pendingNegotiationCount}</strong><small>Negotiations awaiting action</small></div>
          <div><span>Active work</span><strong>{activeNegotiationCount + activeDirectUploadJobsCount}</strong><small>Jobs currently in progress</small></div>
          <div><span>Completed</span><strong>{completedNegotiationJobsCount + completedDirectUploadJobsCount}</strong><small>Finished jobs in your history</small></div>
          <div><span>Unread messages</span><strong>{unreadMessageCount}</strong><small>Updates from clients and admin</small></div>
        </section>
        <section className="tm-suite-section">
          <div className="tm-suite-section-head"><div><span className="tm-suite-eyebrow">YOUR QUEUE</span><h2>Work and support</h2></div><span className="tm-suite-muted">Standard payout: 40 KES per minute · Rush: 50 KES</span></div>
          <div className="tm-suite-action-grid">
            <Link to="/transcriber-negotiations"><span className="tm-suite-card-label">OFFERS</span><strong>Negotiation room <b>{pendingNegotiationCount}</b></strong><p>Review client offers and agree on the right job terms.</p><em>Open negotiations →</em></Link>
            <Link to={`/transcriber/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`}><span className="tm-suite-card-label">MESSAGES</span><strong>My messages {unreadMessageCount > 0 && <b>{unreadMessageCount}</b>}</strong><p>Keep conversations and job questions in one place.</p><em>Open messages →</em></Link>
            <Link to="/transcriber-direct-upload-jobs"><span className="tm-suite-card-label">ACTIVE</span><strong>Direct-upload jobs <b>{activeDirectUploadJobsCount}</b></strong><p>Continue direct jobs already assigned to you.</p><em>View active jobs →</em></Link>
            <Link to="/transcriber-negotiations?status=active"><span className="tm-suite-card-label">ACTIVE</span><strong>Negotiated jobs <b>{activeNegotiationCount}</b></strong><p>Open the work you accepted from clients.</p><em>View active work →</em></Link>
            <Link to="/transcriber-completed-direct-upload-jobs"><span className="tm-suite-card-label">HISTORY</span><strong>Completed direct jobs <b>{completedDirectUploadJobsCount}</b></strong><p>Review completed work and earnings.</p><em>Open history →</em></Link>
            <Link to="/transcriber-negotiations?status=completed"><span className="tm-suite-card-label">HISTORY</span><strong>Completed negotiated jobs <b>{completedNegotiationJobsCount}</b></strong><p>See your finished negotiation projects.</p><em>Open history →</em></Link>
            <Link to={`/transcriber-profile/${user.id}`}><span className="tm-suite-card-label">PROFILE</span><strong>Profile and ratings</strong><p>Update your details and check client feedback.</p><em>Open profile →</em></Link>
            <Link to="/transcriber-payments"><span className="tm-suite-card-label">EARNINGS</span><strong>Payment history</strong><p>Review payouts and completed earnings.</p><em>View payments →</em></Link>
            {transcriberRating >= 4 && <Link to="/transcriber-other-jobs"><span className="tm-suite-card-label">AVAILABLE</span><strong>Available direct jobs <b>{availableDirectJobsCount}</b></strong><p>Browse additional jobs you can take.</p><em>Find work →</em></Link>}
            <Link to="/trainee/materials"><span className="tm-suite-card-label">LEARNING</span><strong>Knowledge base</strong><p>Refresh your skills with training materials.</p><em>Open resources →</em></Link>
          </div>
        </section>
      </main>
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} duration={toast.type === 'error' ? 4000 : 3000} />
    </div>
  );
};

export default TranscriberDashboard;
