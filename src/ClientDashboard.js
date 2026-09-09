// frontend/client/src/ClientDashboard.js - UPDATED for improved Profile Link UI/UX and consistent card styling
// FIXED: Corrected 'My Completed Jobs' count to include direct upload jobs.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import './ClientDashboard.css'; // Ensure this CSS file exists and has styles for .profile-link, .profile-avatar, .profile-icon
import './HumanDashboardShared.css';

import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService'; // Removed getSocketInstance
import { BACKEND_API_URL } from './config';

// --- Component Definition ---
const ClientDashboard = () => {
  const { user, isAuthenticated, isAuthReady, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [clientStats, setClientStats] = useState({
    pendingNegotiations: 0,
    activeJobs: 0,
    completedJobs: 0, // Initialized to 0
    clientRating: 5.0 // This will be updated from user.client_average_rating
  });
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [totalClientPayments, setTotalClientPayments] = useState(0);
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
  }, [user]);


  const fetchClientStats = useCallback(async (clientId, token) => {
    if (!clientId || !token) {
        setLoading(false);
        return;
    }
    try {
      const clientRating = user.client_average_rating || 5.0; 

      const [negotiationsResponse, directUploadJobsResponse] = await Promise.all([
        fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        // FIX: Changed the API endpoint to match the backend route
        fetch(`${BACKEND_API_URL}/api/client/direct-jobs`, { 
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
      ]);
      
      const negotiationsData = await negotiationsResponse.json();
      const directUploadJobsData = await directUploadJobsResponse.json(); // NEW: Parse direct upload jobs data

      let pendingNegotiations = 0;
      let activeJobs = 0;
      let completedJobsCount = 0; // Renamed to avoid conflict with state variable

      if (negotiationsResponse.ok) {
        pendingNegotiations = negotiationsData.negotiations.filter(n => 
            n.status === 'pending' || 
            n.status === 'transcriber_counter' || 
            n.status === 'client_counter' ||
            n.status === 'accepted_awaiting_payment' 
        ).length; 
        activeJobs += negotiationsData.negotiations.filter(n => n.status === 'hired').length;
        completedJobsCount += negotiationsData.negotiations.filter(n => n.status === 'completed').length;
      } else {
        console.error('Failed to fetch negotiations:', negotiationsData.error);
        showToast(negotiationsData.error || 'Failed to load negotiations.', 'error');
      }

      // NEW: Process direct upload jobs
      if (directUploadJobsResponse.ok) {
          activeJobs += directUploadJobsData.jobs.filter(d => 
              d.status === 'available_for_transcriber' || // New status after payment
              d.status === 'taken' || 
              d.status === 'in_progress'
          ).length;
          // CHANGED: Also count direct upload jobs that are 'client_completed'
          completedJobsCount += directUploadJobsData.jobs.filter(d => d.status === 'client_completed').length;
      } else {
          console.error('Failed to fetch direct upload jobs:', directUploadJobsData.error);
          showToast(directUploadJobsData.error || 'Failed to load direct upload jobs.', 'error');
      }

      setClientStats({
        pendingNegotiations,
        activeJobs,
        completedJobs: completedJobsCount, // Use the aggregated count
        clientRating 
      });
    } catch (error) {
      console.error('Failed to fetch client stats:', error);
      showToast('Network error while fetching dashboard data.', 'error');
    } finally {
      // setLoading(false); // This will be set by the main useEffect after all data is fetched
    }
  }, [showToast, user]); 

  // NEW: Fetch Client Payment History
  const fetchClientPaymentHistory = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/client/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.summary) {
        setTotalClientPayments(data.summary.totalPayments || 0);
      } else {
        console.error('Failed to fetch client payment history:', data.error);
      }
    } catch (error) {
      console.error('Network error fetching client payment history:', error);
    }
  }, [user]); 


  // --- Main Data Management and Socket Setup useEffect ---
  useEffect(() => {
    console.log('ClientDashboard: Main useEffect. isAuthReady:', isAuthReady, 'user:', user);

    if (!isAuthReady || !user || !user.id) {
        if (isAuthReady && !user) {
            console.log("ClientDashboard: Auth ready but no user. Redirecting to login.");
            navigate('/login');
        }
        return;
    }

    if (user.user_type !== 'client') {
        console.warn(`ClientDashboard: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
        navigate('/');
        return;
    }

    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("ClientDashboard: Token missing from localStorage despite isAuthenticated being true. Forcing logout.");
        logout();
        return;
    }

    Promise.all([
        fetchClientStats(user.id, token),
        fetchUnreadMessageCount(),
        fetchClientPaymentHistory()
    ]).finally(() => {
        setLoading(false);
    });

    // --- Socket.IO Connection and Listener Setup ---
    console.log(`ClientDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id); // Connect or get existing socket instance

    // Define handlers for Socket.IO events within the useEffect to ensure they have fresh state/props
    const handleNegotiationUpdate = (data) => {
        console.log('ClientDashboard Real-time: Negotiation update received!', data);
        showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
        // Use the current user ID and token from closure, or re-fetch token if necessary
        fetchClientStats(user.id, localStorage.getItem('token')); 
        fetchClientPaymentHistory();
    };

    const handleUnreadMessageCountUpdate = (data) => {
        if (data.userId === user.id) {
            console.log('ClientDashboard Real-time: Unread message count update received!', data);
            setUnreadMessageCount(prevCount => prevCount + data.change);
            showToast('You have a new message!', 'info');
            if (data.change > 0) {
                playNotificationSound();
            }
        }
    };

    const handleNewChatMessage = (data) => {
        console.log('ClientDashboard Real-time: New chat message received!', data);
        if (data.sender_id !== user.id) { // Only show toast/play sound if message is from someone else
            showToast(`New message from ${data.sender_name || 'Admin'}!`, 'info');
            fetchUnreadMessageCount(); // Re-fetch unread count to update badge
            playNotificationSound();
        }
    };

    const handleJobCompleted = (data) => {
        console.log('ClientDashboard Real-time: Job completed event received!', data);
        showToast(data.message || `Job ${data.negotiationId || data.directUploadJobId} was completed!`, 'success'); // Updated to handle directUploadJobId
        fetchClientStats(user.id, localStorage.getItem('token')); // Refresh stats to update completed jobs count
        fetchClientPaymentHistory();
    };

    const handlePaymentSuccessful = (data) => {
        console.log('ClientDashboard Real-time: Payment successful event received!', data);
        showToast(data.message || `Payment for job ${data.relatedJobId} was successful!`, 'success'); // Updated to use relatedJobId
        fetchClientStats(user.id, localStorage.getItem('token'));
        fetchClientPaymentHistory();
    };

    const handleJobTaken = (data) => { // NEW: Handler for 'job_taken' event
        console.log('ClientDashboard Real-time: Job taken event received!', data);
        showToast(data.message || `Your direct upload job ${data.jobId} has been taken by a transcriber!`, 'info');
        fetchClientStats(user.id, localStorage.getItem('token'));
    };

    // Attach listeners directly to the socket instance
    socket.on('negotiation_accepted', handleNegotiationUpdate);
    socket.on('negotiation_rejected', handleNegotiationUpdate);
    socket.on('negotiation_countered', handleNegotiationUpdate);
    socket.on('negotiation_cancelled', handleNegotiationUpdate);
    socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
    socket.on('newChatMessage', handleNewChatMessage);
    socket.on('job_completed', handleJobCompleted);
    socket.on('payment_successful', handlePaymentSuccessful);
    socket.on('job_taken', handleJobTaken); // NEW: Listen for 'job_taken' event


    return () => {
      console.log(`ClientDashboard: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
      disconnectSocket(); // Ensure disconnectSocket is called only when the component unmounts
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user, navigate, logout, showToast, fetchClientStats, fetchUnreadMessageCount, fetchClientPaymentHistory, playNotificationSound, isAuthenticated]);


  // Display a loading indicator if client-specific data is still being fetched.
  if (loading) {
    return (
        <div className="client-dashboard-container">
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p className="ml-4 text-gray-600">Loading dashboard data...</p>
            </div>
        </div>
    );
  }

  // If, for some reason, user is not available here (which ProtectedRoute should prevent)
  // or if the user type check failed, we can show a fallback or redirect.
  if (!user || !isAuthenticated) {
    return <div>Authentication error or not logged in. Redirecting...</div>;
  }

  // Get the first letter of the user's full name for the avatar
  const firstLetter = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';


  return (
    <div className="client-dashboard-container tm-suite-dashboard tm-client-suite">
      <header className="tm-suite-topbar">
        <Link to="/client-dashboard" className="tm-suite-brand" aria-label="TypeMyworDz client dashboard">
          <img src="/logo192.png" alt="" />
          <span><b className="tm-brand-purple">Type</b><b className="tm-brand-green">My</b><b className="tm-brand-purple">worDz</b><small>Human transcription</small></span>
        </Link>
        <div className="tm-suite-account">
          <Link to={`/client-profile/${user.id}`} className="tm-suite-profile"><span>{firstLetter}</span>{user.full_name}</Link>
          <button onClick={logout} className="tm-suite-logout">Log out</button>
        </div>
      </header>

      <main className="tm-suite-main">
        <section className="tm-suite-intro">
          <div><span className="tm-suite-eyebrow">CLIENT WORKSPACE</span><h1>Your projects, at a glance.</h1><p>Move from quote to completed transcript without losing the thread.</p></div>
          <Link to="/client-direct-upload" className="tm-suite-primary-action">Start a transcription <span>→</span></Link>
        </section>

        <section className="tm-suite-metrics" aria-label="Client summary">
          <div><span>Pending negotiations</span><strong>{clientStats.pendingNegotiations}</strong><small>Offers waiting for your reply</small></div>
          <div><span>Active jobs</span><strong>{clientStats.activeJobs}</strong><small>Projects currently in progress</small></div>
          <div><span>Completed jobs</span><strong>{clientStats.completedJobs}</strong><small>Finished projects in your account</small></div>
          <div><span>Payments</span><strong>USD {totalClientPayments.toLocaleString()}</strong><small>Total recorded payments</small></div>
        </section>

        <section className="tm-suite-section">
          <div className="tm-suite-section-head"><div><span className="tm-suite-eyebrow">WORKSPACE</span><h2>What would you like to do?</h2></div><span className="tm-suite-muted">Your support team is one message away</span></div>
          <div className="tm-suite-action-grid">
            <Link to="/transcriber-pool"><span className="tm-suite-card-label">DIRECTORY</span><strong>Browse transcribers</strong><p>Find and negotiate with vetted professionals.</p><em>Open directory →</em></Link>
            <Link to="/client-negotiations"><span className="tm-suite-card-label">NEGOTIATIONS</span><strong>Negotiation room <b>{clientStats.pendingNegotiations}</b></strong><p>Review offers, deadlines and job status.</p><em>View negotiations →</em></Link>
            <Link to="/client-direct-upload"><span className="tm-suite-card-label">FAST TRACK</span><strong>Direct upload and quote</strong><p>Send a file and get a clear quote without waiting.</p><em>Get a quote →</em></Link>
            <Link to="/client-jobs"><span className="tm-suite-card-label">IN PROGRESS</span><strong>My active jobs <b>{clientStats.activeJobs}</b></strong><p>Track work currently moving through the queue.</p><em>Track jobs →</em></Link>
            <Link to="/client-completed-jobs"><span className="tm-suite-card-label">ARCHIVE</span><strong>Completed jobs <b>{clientStats.completedJobs}</b></strong><p>Review finished projects and leave feedback.</p><em>Open archive →</em></Link>
            <Link to={`/client/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`}><span className="tm-suite-card-label">SUPPORT</span><strong>Messages {unreadMessageCount > 0 && <b>{unreadMessageCount}</b>}</strong><p>Speak with the TypeMyworDz support team.</p><em>Open messages →</em></Link>
          </div>
        </section>

        <section className="tm-suite-footer-panel">
          <div><span className="tm-suite-eyebrow">ACCOUNT HEALTH</span><h2>A trusted workspace for your files.</h2><p>Your current client rating is <strong>{(user.client_average_rating || 5.0).toFixed(1)}</strong> out of 5. Keep your briefs clear and your feedback timely for the smoothest turnaround.</p></div>
          <Link to={`/client-profile/${user.id}`}>View profile and settings →</Link>
        </section>
      </main>
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} duration={toast.type === 'error' ? 4000 : 3000} />
      <audio ref={audioRef} src="/audio/notification-sound.mp3" preload="auto" />
    </div>
  );
};

export default ClientDashboard;
