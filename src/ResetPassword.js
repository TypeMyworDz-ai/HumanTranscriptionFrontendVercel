// frontend/client/src/ResetPassword.js - COMPLETE FILE

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Toast from './Toast';
import './Register.css'; // Re-using styling from register/login

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const [token, setToken] = useState(null);
  const [isValidToken, setIsValidToken] = useState(false); // State to check if token is valid
  const navigate = useNavigate();
  const location = useLocation(); // To get URL parameters

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

  // Effect to extract token from URL on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const resetToken = queryParams.get('token');
    if (resetToken) {
      setToken(resetToken);
      setIsValidToken(true); // Assume valid until backend says otherwise
    } else {
      showToast('Password reset token is missing.', 'error');
      setTimeout(() => navigate('/login'), 3000);
    }
  }, [location.search, navigate, showToast]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    hideToast();

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      setLoading(false);
      return;
    }

    if (!token) {
      showToast('No reset token found. Please request a new link.', 'error');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();
      if (response.ok) {
        showToast(data.message || 'Password has been reset successfully!', 'success');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        showToast(data.error || 'Failed to reset password. Token might be invalid or expired.', 'error');
      }
    } catch (error) {
      console.error('Network or parsing error during password reset:', error);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [password, confirmPassword, token, navigate, showToast, hideToast]);

  if (!token || !isValidToken) {
    // Render nothing or a minimal message while token is being checked/redirecting
    return (
      <div className="register-container">
        <p style={{ textAlign: 'center' }}>{token ? 'Verifying token...' : 'Redirecting...'}</p>
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
          duration={toast.type === 'success' ? 2000 : 4000}
        />
      </div>
    );
  }

  return (
    <div className="register-container">
      <Link to="/" className="back-link">← Back to Home</Link>
      <h2>Reset Your Password</h2>
      <p>Enter your new password below.</p>

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-group">
          <label>New Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
          />
        </div>

        <div className="form-group">
          <label>Confirm New Password:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength="6"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

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

export default ResetPassword;
