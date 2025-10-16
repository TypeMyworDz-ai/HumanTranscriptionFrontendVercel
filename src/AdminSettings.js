// frontend/client/src/AdminSettings.js

import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './AdminManagement.css';

const AdminSettings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Basic role check (ProtectedRoute already handles main access)
    if (user?.user_type !== 'admin') {
        navigate('/admin-dashboard'); // Redirect if not admin
        return null;
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
                    {/* Settings forms/options will go here */}
                    <div className="placeholder-content">
                        &lt;!-- Settings forms --&gt;
                        &lt;p&gt;System settings features coming soon...&lt;/p&gt;
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminSettings;
