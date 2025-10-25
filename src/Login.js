// frontend/client/src/Login.js - COMPLETE AND UPDATED with Forgot Password functionality

import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal'; // Import the Modal component
import './Register.css';
import { useAuth } from './contexts/AuthContext';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const navigate = useNavigate();
  const { login } = useAuth();

  // NEW: State for Forgot Password Modal
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleChange = useCallback((e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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

  const handleTranscriberRedirect = useCallback(async (token, userToRedirect) => {
    try {
      // The transcriber status should already be in the user object from login API response
      // For a more robust check, you might still fetch, but for now, rely on `userToRedirect`
      // FIX: Access snake_case properties
      const user_status = userToRedirect.transcriber_status;
      const user_level = userToRedirect.transcriber_user_level;
      
      console.log('Detected transcriberStatus:', user_status);
      console.log('Detected transcriberUserLevel:', user_level);
      
      // Check for submitted test status (if relevant for non-trainee transcribers)
      // This part might need adjustment if test_submissions are not directly on user object or separate API call needed
      // For simplicity, we'll assume the status from userToRedirect is sufficient for initial redirection.
      
        if (user_status === 'pending_assessment') {
            // This part might need a backend call to check if test is submitted or rejected
            // For now, if 'pending_assessment', assume they need to take/wait for test
            console.log('Redirecting to /transcriber-test (Pending assessment)');
            navigate('/transcriber-test');
        } else if (user_status === 'active_transcriber' || user_level === 'proofreader') {
            console.log('Redirecting to /transcriber-dashboard (Active/Proofreader)');
            navigate('/transcriber-dashboard');
        } else if (user_status === 'rejected') {
            console.log('Redirecting to / (Transcriber application rejected)');
            showToast('Your transcriber application was not approved. Please contact support.', 'error');
            setTimeout(() => navigate('/'), 3000);
        } else {
            console.log('Unknown transcriber status, redirecting to /');
            navigate('/');
        }

    } catch (error) {
      console.error('Status check error:', error);
      showToast('Error during status check. Redirecting to home.', 'error');
      navigate('/');
    }
  }, [navigate, showToast]);

  // NEW: Handle Trainee-specific redirection
  const handleTraineeRedirect = useCallback(async (userToRedirect) => {
      // FIX: Access snake_case properties
      console.log('Detected trainee status:', userToRedirect.transcriber_status);
      console.log('Detected trainee user level:', userToRedirect.transcriber_user_level);

      if (userToRedirect.transcriber_status === 'pending_training_payment') {
          console.log('Redirecting to /training-payment (Trainee needs to pay)');
          navigate('/training-payment');
      } else if (userToRedirect.transcriber_status === 'paid_training_fee') {
          console.log('Redirecting to /trainee-dashboard (Trainee has paid)');
          navigate('/trainee-dashboard');
      } else {
          console.warn('Login.js: Unknown trainee status. Redirecting to /.');
          navigate('/');
      }
  }, [navigate]);


  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    hideToast();

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      console.log('API Response data:', data);
      console.log('Response status OK:', response.ok);

      if (response.ok) {
        login(data.token, data.user);

        showToast('Login successful! Redirecting...', 'success');

        setTimeout(async () => {
          console.log('Login.js: setTimeout executing. User from API response:', data.user);
          if (data.user.user_type === 'client') {
            navigate('/client-dashboard');
          } else if (data.user.user_type === 'transcriber') {
            await handleTranscriberRedirect(data.token, data.user);
          } else if (data.user.user_type === 'admin') {
            console.log('Login.js: Redirecting admin to /admin-dashboard.');
            navigate('/admin-dashboard');
          } else if (data.user.user_type === 'trainee') { // NEW: Handle trainee user type
            await handleTraineeRedirect(data.user);
          } else {
            console.warn('Login.js: Unknown user type from API response. Redirecting to /.');
            navigate('/');
          }
        }, 1000);

      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Network or parsing error during login: ' + error.message, error);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, hideToast, login, navigate, showToast, handleTranscriberRedirect, handleTraineeRedirect]); // Added handleTraineeRedirect to dependencies

  // NEW: Handle Forgot Password Request
  const handleForgotPasswordRequest = useCallback(async (e) => {
    e.preventDefault();
    setResetLoading(true);
    hideToast();

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();
      if (response.ok) {
        showToast(data.message || 'Password reset link sent to your email!', 'success');
        setShowForgotPasswordModal(false);
        setResetEmail('');
      } else {
        showToast(data.error || 'Failed to send password reset link.', 'error');
      }
    } catch (error) {
      console.error('Error requesting password reset:', error);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setResetLoading(false);
    }
  }, [resetEmail, hideToast, showToast]);

  return (
    <div className="register-container">
      <Link to="/" className="back-link">← Back to Home</Link>
      <h2>TypeMyworDz</h2>
      <p>Access your account</p>

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {/* NEW: Forgot Password Link */}
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <button 
          onClick={() => setShowForgotPasswordModal(true)} 
          className="forgot-password-link"
          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Forgot Password?
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p>Don't have an account, register:</p>
        <Link to="/client-register" style={{ marginRight: '10px' }}>As a Client</Link>
        <span>|</span>
        <Link to="/worker-register" style={{ marginLeft: '10px' }} >As a Worker</Link>
        {/* NEW: Link for Trainee Registration */}
        <span style={{ margin: '0 10px' }}>|</span>
        <Link to="/trainee-register">As a Trainee</Link>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={toast.type === 'success' ? 2000 : 4000}
      />

      {/* NEW: Forgot Password Modal */}
      {showForgotPasswordModal && (
        <Modal
          show={showForgotPasswordModal}
          title="Forgot Password"
          onClose={() => setShowForgotPasswordModal(false)}
          onSubmit={handleForgotPasswordRequest}
          submitText={resetLoading ? 'Sending...' : 'Send Reset Link'}
          loading={resetLoading}
        >
          <p>Enter your email address to receive a password reset link.</p>
          <div className="form-group">
            <label htmlFor="resetEmail">Email:</label>
            <input
              id="resetEmail"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              placeholder="your-email@example.com"
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Login;
