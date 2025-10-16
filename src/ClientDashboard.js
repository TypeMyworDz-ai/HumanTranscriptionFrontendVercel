// src/ClientDashboard.js - Part 1 - UPDATED for Vercel deployment

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './ClientDashboard.css';

import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService'; 

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// --- Component Definition ---
const ClientDashboard = () => {
  const { user, isAuthenticated, isAuthReady, logout } = useAuth(); 

  const [loading, setLoading] = useState(true);
  const [clientStats, setClientStats] = useState({
    pendingNegotiations: 0,
    activeJobs: 0,
    completedJobs: 0,
    clientRating: 5.0
  });
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
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
      // FIXED: Use BACKEND_API_URL constant
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
    setLoading(true);
    try {
      // FIXED: Use BACKEND_API_URL constant
      const userResponse = await fetch(`${BACKEND_API_URL}/api/auth/user/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const userDataFromApi = await userResponse.json();
      const clientRating = userDataFromApi.user?.client_profile?.client_rating || 5.0;

      // FIXED: Use BACKEND_API_URL constant
      const negotiationsResponse = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const negotiationsData = await negotiationsResponse.json();
      if (negotiationsResponse.ok) {
        const pendingNegotiations = negotiationsData.negotiations.filter(n => n.status === 'pending' || n.status === 'transcriber_counter').length;
        const activeJobs = negotiationsData.negotiations.filter(n => n.status === 'accepted' || n.status === 'hired').length;
        const completedJobs = negotiationsData.negotiations.filter(n => n.status === 'completed').length;

        setClientStats({
          pendingNegotiations,
          activeJobs,
          completedJobs,
          clientRating
        });
      } else {
        console.error('Failed to fetch negotiations:', negotiationsData.error);
        showToast(negotiationsData.error || 'Failed to load negotiations.', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch client stats:', error);
      showToast('Network error while fetching dashboard data.', 'error');
    } finally {
      // setLoading(false); // This will be set by the main useEffect after all data is fetched
    }
  }, [showToast]);

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
        fetchUnreadMessageCount()
    ]).finally(() => {
        setLoading(false);
    });

    console.log(`ClientDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id);

    const handleNegotiationUpdate = (data) => {
        console.log('ClientDashboard Real-time: Negotiation update received!', data);
        showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
        fetchClientStats(user.id, localStorage.getItem('token'));
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
        if (data.sender_id !== user.id) {
            showToast(`New message from ${data.sender_name || 'Admin'}!`, 'info');
            fetchUnreadMessageCount();
            playNotificationSound();
        }
    };

    socket.on('negotiation_accepted', handleNegotiationUpdate);
    socket.on('negotiation_rejected', handleNegotiationUpdate);
    socket.on('negotiation_countered', handleNegotiationUpdate);
    socket.on('negotiation_cancelled', handleNegotiationUpdate);
    socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
    socket.on('newChatMessage', handleNewChatMessage);

    return () => {
        console.log(`ClientDashboard: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
        socket.off('negotiation_accepted', handleNegotiationUpdate);
        socket.off('negotiation_rejected', handleNegotiationUpdate);
        socket.off('negotiation_countered', handleNegotiationUpdate);
        socket.off('negotiation_cancelled', handleNegotiationUpdate);
        socket.off('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
        socket.off('newChatMessage', handleNewChatMessage);
        disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user, navigate, logout, showToast, fetchClientStats, fetchUnreadMessageCount, playNotificationSound]);
// src/ClientDashboard.js - Part 2 - UPDATED for Vercel deployment (Continue from Part 1)


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
  if (!user || !isAuthenticated) { // isAuthenticated is still checked by ProtectedRoute
    return <div>Authentication error or not logged in. Redirecting...</div>;
  }


  return (
    <div className="client-dashboard-container">
      <header className="client-dashboard-header">
        <div className="header-content">
          <h1>Client Dashboard</h1>
          <div className="user-info">
            {/* Safely access user.full_name with optional chaining */}
            <span>Welcome, {user?.full_name || 'Client'}!</span>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="client-dashboard-main">
        <div className="client-dashboard-content">
          <h2 className="dashboard-title">Your Hub for Transcription Services</h2>
          <p className="dashboard-description">Manage your projects, track negotiations, and connect with transcribers.</p>

          {/* NEW: Dashboard Action Cards (moved to top) */}
          <div className="dashboard-cards-grid">
            <Link to="/transcriber-pool" className="dashboard-card">
              <div className="card-icon">👥</div>
              <h3>Browse Transcribers</h3>
              <p>Find and negotiate with professional transcribers.</p>
            </Link>

            {/* Updated My Negotiations Card */}
            <Link to="/client-negotiations" className="dashboard-card">
              <div className="card-icon">👋</div> {/* Changed icon to hands greeting */}
              <h3>My Negotiations ({clientStats.pendingNegotiations})</h3>
              <p>View pending, agreed, and completed negotiation requests.</p>
            </Link>

            {/* NEW: My Messages Card */}
            {/* Using the actual admin ID */}
            <Link to={`/client/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`} className="dashboard-card">
              <div className="card-icon">💬</div> {/* Message icon */}
              <h3>My Messages {unreadMessageCount > 0 && <span className="unread-badge">{unreadMessageCount}</span>}</h3> {/* NEW unread count badge */}
              <p>View and manage your direct messages.</p>
            </Link>

            <Link to="/client-jobs" className="dashboard-card">
              <div className="card-icon">📝</div>
              <h3>My Jobs ({clientStats.activeJobs})</h3>
              <p>Track the progress of your active transcription jobs.</p>
            </Link>

            <Link to="/client-payments" className="dashboard-card">
              <div className="card-icon">💰</div>
              <h3>Payment History ({clientStats.completedJobs})</h3>
              <p>Review your past transactions and invoices.</p>
            </Link>
          </div>

          {/* NEW: Combined Client Stats Card */}
          <div className="combined-stats-card-wrapper"> {/* Wrapper for the single stats card */}
            <div className="combined-stats-card">
              <h3>Your Performance Overview</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <h4>Client Rating</h4>
                  <p className="stat-value rating-stars">
                    {'★'.repeat(Math.floor(clientStats.clientRating))}
                    {'☆'.repeat(5 - Math.floor(clientStats.clientRating))}
                    <span>({clientStats.clientRating.toFixed(1)})</span>
                  </p>
                </div>
                <div className="stat-item">
                  <h4>Pending Negotiations</h4>
                  <p className="stat-value">{clientStats.pendingNegotiations}</p>
                </div>
                <div className="stat-item">
                  <h4>Active Jobs</h4>
                  <p className="stat-value">{clientStats.activeJobs}</p>
                </div>
                <div className="stat-item">
                  <h4>Completed Jobs</h4>
                  <p className="stat-value">{clientStats.completedJobs}</p>
                </div>
              </div>
            </div>
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
      {/* NEW: Hidden audio element for notification sound */}
      <audio ref={audioRef} src="/path/to/your/notification-sound.mp3" preload="auto" />
    </div>
  );
};

export default ClientDashboard;
