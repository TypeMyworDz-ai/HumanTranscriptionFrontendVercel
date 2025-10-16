// frontend/client/src/AdminJobs.js

import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './AdminManagement.css';

const AdminJobs = () => {
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
                    <h1>Manage All Jobs</h1>
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
                    <h2>Ongoing & Completed Jobs</h2>
                    <p>Monitor all transcription jobs across the platform.</p>
                    {/* Job listing and management UI will go here */}
                    <div className="placeholder-content">
                        &lt;!-- Job list table/cards --&gt;
                        &lt;p&gt;Job management features coming soon...&lt;/p&gt;
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminJobs;
