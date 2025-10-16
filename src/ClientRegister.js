import React, { useState, useCallback } from 'react'; // Added useCallback
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import './Register.css';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientRegister = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    user_type: 'client'
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const navigate = useNavigate();

  const handleChange = useCallback((e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }, []); // setFormData is stable, so empty dependency array is fine

  const showToast = useCallback((message, type = 'success') => {
    setToast({
      isVisible: true,
      message,
      type
    });
  }, []); // Empty dependency array for stable function

  const hideToast = useCallback(() => {
    setToast((prev) => ({
      ...prev,
      isVisible: false
    }));
  }, []); // Empty dependency array for stable function

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    hideToast(); // Clear any previous toast

    try {
      // FIXED: Use BACKEND_API_URL constant for the API call
      const response = await fetch(`${BACKEND_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Registration successful! Redirecting to login...', 'success');
        setFormData({ email: '', password: '', full_name: '', phone: '', user_type: 'client' });

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Network error during client registration:', error); // Added more specific log
      showToast('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, hideToast, navigate, showToast]); // Added dependencies

  return (
    <div className="register-container">
      <Link to="/" className="back-link">← Back to Home</Link>
      <h2>Register as Client</h2>
      <p>Get your audio files transcribed by professionals</p>

      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-group">
          <label>Full Name:</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
        </div>

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
          <label>Phone (Optional):</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
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
          {loading ? 'Creating Account...' : 'Create Client Account'}
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

export default ClientRegister;
