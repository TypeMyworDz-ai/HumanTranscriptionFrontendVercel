import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import { useAuth } from './contexts/AuthContext'; // Only for login context, not for registerUser function
import { BACKEND_API_URL } from './config'; // Assuming you have a config for backend URL
import './Register.css'; // Re-using existing register/login styling

const TraineeRegister = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const navigate = useNavigate();
  const { login } = useAuth(); // Get the login function from AuthContext to log in after registration

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

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    hideToast(); // Clear any previous toasts

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          user_type: 'trainee', // Specify user_type as 'trainee'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // If registration is successful, automatically log the user in
        // The backend returns a token and user object on successful registration
        login(data.token, data.user); 
        showToast('Registration successful! Redirecting to payment for training access...', 'success');
        setTimeout(() => {
          navigate('/training-payment');
        }, 2000);
      } else {
        // Handle registration failure from the backend (e.g., user already exists)
        showToast(data.error || 'Registration failed. Please try again.', 'error');
      }

    } catch (error) {
      console.error('Trainee registration error:', error);
      showToast(error.message || 'Network error during registration. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [email, password, fullName, confirmPassword, navigate, login, showToast, hideToast]); // Added login to dependencies

  return (
    <div className="register-container">
      <Link to="/" className="back-link">← Back to Home</Link>
      <h2>Register as a Trainee</h2>
      <p>Start your journey to become a top-tier transcriber.</p>

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-group">
          <label htmlFor="fullName">Full Name:</label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your Full Name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@example.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            required
            minLength="6"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
            minLength="6"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register as Trainee'}
        </button>
      </form>

      <div className="login-prompt">
        Already have an account? <Link to="/login">Login here</Link>
      </div>

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

export default TraineeRegister;
