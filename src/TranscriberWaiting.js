import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './TranscriberWaiting.css';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config'; // NEW: Import BACKEND_API_URL

const TranscriberWaiting = () => {
  const { user, isAuthenticated, authLoading, logout } = useAuth();

  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) {
        setLoading(true);
        return;
    }

    if (!isAuthenticated || !user) {
        setLoading(false);
        return;
    }

    if (user.user_type !== 'transcriber') {
        console.warn(`TranscriberWaiting: Unauthorized access by user_type: ${user.user_type}. Redirecting.`);
        if (user.user_type === 'client') {
            navigate('/client-dashboard');
        } else {
            navigate('/');
        }
        return;
    }

    const checkTestStatusAndRedirect = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }
            // CORRECTED: Use BACKEND_API_URL
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statusData = await response.json();

            if (response.ok) {
                if (!statusData.has_submitted_test) {
                    console.log('TranscriberWaiting: Test not submitted. Redirecting to /transcriber-test.');
                    navigate('/transcriber-test');
                    return;
                }
                if (statusData.user_status === 'active_transcriber' || statusData.user_level === 'proofreader') {
                    console.log('TranscriberWaiting: Test approved. Redirecting to /transcriber-dashboard.');
                    navigate('/transcriber-dashboard');
                    return;
                }
                if (statusData.test_submission?.status === 'rejected') {
                    console.log('TranscriberWaiting: Test rejected. Redirecting to home.');
                    navigate('/');
                    return;
                }
                console.log('TranscriberWaiting: User is correctly on waiting page.');

            } else {
                console.error('TranscriberWaiting: Failed to check transcriber status:', statusData.error);
                navigate('/');
                return;
            }
        } catch (error) {
            console.error('TranscriberWaiting: Error checking test status:', error);
            navigate('/');
            return;
        } finally {
            setLoading(false);
        }
    };

    checkTestStatusAndRedirect();

  }, [isAuthenticated, authLoading, user, navigate, logout]);


  if (authLoading) {
    return <div className="loading-container">Loading authentication...</div>;
  }
  if (!isAuthenticated || !user) {
    return <div className="loading-container">Not authenticated. Redirecting...</div>;
  }
  if (user.user_type !== 'transcriber') {
      return <div className="loading-container">Unauthorized access. Redirecting...</div>;
  }

  if (loading) {
    return <div className="loading-container">Loading status...</div>;
  }


  return (
    <div className="waiting-container">
      <header className="waiting-header">
        <div className="header-content">
          <h1>TypeMyworDz</h1>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="waiting-main">
        <div className="waiting-content">
          <div className="status-card">
            <div className="status-icon">
              <div className="hourglass">⏳</div>
            </div>

            <h2>Test Submitted Successfully!</h2>
            <p className="status-message">
              Thank you for completing the transcriber assessment test.
              Your submission is currently being reviewed by our team.
            </p>

            <div className="info-section">
              <h3>What happens next?</h3>
              <ul>
                <li>Our team will review your grammar test results</li>
                <li>We'll evaluate your transcription quality and accuracy</li>
                <li>You'll receive an email notification with the results</li>
                <li>If approved, you'll gain access to the transcriber dashboard</li>
              </ul>
            </div>

            <div className="timeline-section">
              <h3>Expected Timeline</h3>
              <p>
                <strong>Assessment Time:</strong> 12-24 hours<br/>
                <strong>Notification:</strong> Via email to {user.email}
              </p>
            </div>

            <div className="contact-section">
              <h3>Questions?</h3>
              <p>
                If you have any questions about your application status,
                please contact us at <strong>support@typemywordz.com</strong>
              </p>
            </div>

            <div className="action-buttons">
              <Link to="/" className="home-btn">
                Return to Homepage
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TranscriberWaiting;
