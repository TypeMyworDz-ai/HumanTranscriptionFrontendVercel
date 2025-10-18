import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import './Register.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const WorkerRegister = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '', // Phone is now optional
    user_type: 'transcriber'
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

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    hideToast();

    console.log('WorkerRegister: Attempting to submit registration with data:', formData);

    try {
      const response = await fetch(`${BACKEND_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('WorkerRegister: Received response from backend:', response);
      const data = await response.json();
      console.log('WorkerRegister: Parsed response data:', data);

      if (response.ok) {
        showToast('Registration successful! Redirecting to login...', 'success');
        setFormData({ email: '', password: '', full_name: '', phone: '', user_type: 'transcriber' });

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('WorkerRegister: Network error during worker registration:', error);
      showToast('Network error. Please try again. If this persists, check your network connection or try again later.', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, hideToast, navigate, showToast]);

  return (
    <div className="register-container">
      <Link to="/" className="back-link">← Back to Home</Link>
      <h2>Register as Transcriber</h2>
      <p>Join our team of professional transcribers</p>

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
          <label>Phone (Optional):</label> {/* UPDATED: Phone is now optional */}
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            // removed 'required' attribute
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
          {loading ? 'Creating Account...' : 'Join Our Team'}
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

export default WorkerRegister;
