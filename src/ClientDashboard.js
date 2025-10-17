// frontend/client/src/ClientDashboard.js - UPDATED for improved Profile Link UI/UX

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import './ClientDashboard.css'; // Ensure this CSS file exists and has styles for .profile-link, .profile-avatar, .profile-icon

import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket } from './ChatService';
import { BACKEND_API_URL } from './config';

// --- Component Definition ---
const ClientDashboard = () => {
  const { user, isAuthenticated, isAuthReady, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [clientStats, setClientStats] = useState({
    pendingNegotiations: 0,
    activeJobs: 0,
    completedJobs: 0,
    clientRating: 5.0 // This will be updated from user.client_rating
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
      // Fetch client's main user data to get the latest rating
      const userResponse = await fetch(`${BACKEND_API_URL}/api/auth/user/${clientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userDataFromApi = await userResponse.json();
      // Ensure client_profile and client_rating exist before accessing
      const clientRating = userDataFromApi.user?.client_profile?.client_rating || 5.0;

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
          clientRating // Use the fetched clientRating
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

    console.log(`ClientDashboard: Attempting to connect socket via ChatService for user ID: ${user.id}`);
    const socket = connectSocket(user.id);

    const handleNegotiationUpdate = (data) => {
        console.log('ClientDashboard Real-time: Negotiation update received!', data);
        showToast(`Negotiation ${data.negotiationId} was updated!`, 'info');
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
        if (data.sender_id !== user.id) {
            showToast(`New message from ${data.sender_name || 'Admin'}!`, 'info');
            fetchUnreadMessageCount();
            playNotificationSound();
        }
    };

    const handlePaymentSuccessful = (data) => {
        console.log('ClientDashboard Real-time: Payment successful event received!', data);
        showToast(data.message || `Payment for negotiation ${data.negotiationId} was successful!`, 'success');
        fetchClientStats(user.id, localStorage.getItem('token'));
        fetchClientPaymentHistory();
    };

    const handleSocketConnect = () => {
        socket.emit('joinUserRoom', user.id);
    };

    if (!socket.connected) {
        socket.on('connect', handleSocketConnect);
    } else {
        handleSocketConnect();
    }


    socket.on('negotiation_accepted', handleNegotiationUpdate);
    socket.on('negotiation_rejected', handleNegotiationUpdate);
    socket.on('negotiation_countered', handleNegotiationUpdate);
    socket.on('negotiation_cancelled', handleNegotiationUpdate);
    socket.on('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
    socket.on('newChatMessage', handleNewChatMessage);
    socket.on('payment_successful', handlePaymentSuccessful);


    return () => {
        console.log(`ClientDashboard: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
        socket.off('negotiation_accepted', handleNegotiationUpdate);
        socket.off('negotiation_rejected', handleNegotiationUpdate);
        socket.off('negotiation_countered', handleNegotiationUpdate);
        socket.off('negotiation_cancelled', handleNegotiationUpdate);
        socket.off('unreadMessageCountUpdate', handleUnreadMessageCountUpdate);
        socket.off('newChatMessage', handleNewChatMessage);
        socket.off('payment_successful', handlePaymentSuccessful);
        socket.off('connect', handleSocketConnect);
        disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, navigate, logout, showToast, fetchClientStats, fetchUnreadMessageCount, fetchClientPaymentHistory, playNotificationSound, isAuthReady]);


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
    <div className="client-dashboard-container">
      <header className="client-dashboard-header">
        <div className="header-content">
          <h1>Client Dashboard</h1>
          <div className="profile-section">
            {/* UPDATED: Profile link with icon and text */}
            <Link to={`/client-profile/${user.id}`} className="profile-link" title="View/Edit Profile">
                <div className="profile-avatar">
                    {firstLetter}
                </div>
                <span className="welcome-text">Welcome, {user.full_name}!</span>
                <span className="profile-icon">⚙️</span> {/* Added a small gear icon */}
            </Link>
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

          <div className="dashboard-cards-grid">
            <Link to="/transcriber-pool" className="dashboard-card">
              <div className="card-icon">👥</div>
              <h3>Browse Transcribers</h3>
              <p>Find and negotiate with professional transcribers.</p>
            </Link>

            <Link to="/client-direct-upload" className="dashboard-card">
              <div className="card-icon">⬆️</div>
              <h3>Direct Upload & Quote</h3>
              <p>Get instant quotes for your audio/video uploads.</p>
            </Link>

            <Link to="/client-jobs" className="client-card">
              <div className="card-icon">📝</div>
              <h3>My Active Jobs ({clientStats.activeJobs})</h3>
              <p>Track the progress of your active transcription jobs.</p>
            </Link>

            <Link to="/client-negotiations" className="dashboard-card">
              <div className="card-icon">🤝</div>
              <h3>Negotiations History ({clientStats.pendingNegotiations})</h3>
              <p>View pending, agreed, and completed negotiation requests.</p>
            </Link>

            <Link to="/client-payments" className="dashboard-card">
              <div className="card-icon">💳</div>
              <h3>Payment History (KES {totalClientPayments.toLocaleString()})</h3>
              <p>View your transaction history and payment details.</p>
            </Link>

            <Link to={`/client/chat/${'e3d38454-bd09-4922-b94e-9538daf41bcc'}`} className="dashboard-card"> {/* Assuming 'admin' is a fixed ID for chat with admin */}
              <div className="card-icon">💬</div>
              <h3>Messages {unreadMessageCount > 0 && <span className="unread-badge">{unreadMessageCount}</span>}</h3>
              <p>Chat with transcribers or support.</p>
            </Link>
          </div>

          {/* NEW: Combined Client Stats Card */}
          <div className="combined-stats-card-wrapper">
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
      {/* Audio element for notifications, ensure path is correct */}
      <audio ref={audioRef} src="/audio/notification-sound.mp3" preload="auto" /> 
    </div>
  );
};

export default ClientDashboard;
