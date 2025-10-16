// frontend/client/src/AdminSettings.js - COMPLETE AND UPDATED with functionality

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Import Toast component
import './AdminManagement.css';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminSettings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [settings, setSettings] = useState({
        default_price_per_minute: 0,
        default_deadline_hours: 0,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Function to fetch settings from the backend
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.settings) {
                setSettings({
                    default_price_per_minute: data.settings.default_price_per_minute || 0,
                    default_deadline_hours: data.settings.default_deadline_hours || 0,
                });
            } else {
                showToast(data.error || 'Failed to fetch settings.', 'error');
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            showToast('Network error fetching settings.', 'error');
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    // Function to save settings to the backend
    const saveSettings = useCallback(async (e) => {
        e.preventDefault();
        setSaving(true);
        hideToast();
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(settings)
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Settings saved successfully!', 'success');
            } else {
                showToast(data.error || 'Failed to save settings.', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Network error saving settings.', 'error');
        } finally {
            setSaving(false);
        }
    }, [settings, logout, hideToast, showToast]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0 // Ensure numerical value
        }));
    }, []);

    useEffect(() => {
        // Basic role check (ProtectedRoute already handles main access)
        if (!user || user.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            return;
        }
        fetchSettings();
    }, [user, navigate, fetchSettings]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>System Settings</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin-dashboard" className="back-link">← Back to Admin Dashboard</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Platform Configurations</h2>
                    <p>Adjust core settings for your transcription platform.</p>
                    
                    <form onSubmit={saveSettings} className="settings-form">
                        <div className="form-group">
                            <label htmlFor="default_price_per_minute">Default Price Per Minute (KES):</label>
                            <input
                                id="default_price_per_minute"
                                type="number"
                                name="default_price_per_minute"
                                value={settings.default_price_per_minute}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="default_deadline_hours">Default Deadline (Hours):</label>
                            <input
                                id="default_deadline_hours"
                                type="number"
                                name="default_deadline_hours"
                                value={settings.default_deadline_hours}
                                onChange={handleChange}
                                min="0"
                                required
                            />
                        </div>
                        <button type="submit" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </form>
                </div>
            </main>
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
                duration={toast.type === 'error' ? 4000 : 3000}
            />
        </div>
    );
};

export default AdminSettings;
