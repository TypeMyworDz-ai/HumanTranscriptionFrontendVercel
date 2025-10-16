// frontend/client/src/AdminJobs.js - COMPLETE AND UPDATED with functionality

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Import Toast component
import './AdminManagement.css';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminJobs = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]); // State to store fetched jobs (negotiations)
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Function to fetch all jobs (negotiations) for admin
    const fetchAllJobs = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/jobs`, { // NEW: Admin API endpoint for all jobs
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.jobs) {
                setJobs(data.jobs);
            } else {
                showToast(data.error || 'Failed to fetch jobs.', 'error');
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
            showToast('Network error fetching jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    useEffect(() => {
        // Basic role check (ProtectedRoute already handles main access)
        if (!user || user.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            return;
        }
        fetchAllJobs();
    }, [user, navigate, fetchAllJobs]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading jobs...</div>
            </div>
        );
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
                    
                    {jobs.length === 0 ? (
                        <p className="no-data-message">No jobs found.</p>
                    ) : (
                        <div className="jobs-list-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Client</th>
                                        <th>Transcriber</th>
                                        <th>Price</th>
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Requested On</th>
                                        {/* Add more columns as needed */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map(job => (
                                        <tr key={job.id}>
                                            <td>{job.id.substring(0, 8)}...</td>
                                            <td>{job.client?.full_name || 'N/A'}</td>
                                            <td>{job.transcriber?.full_name || 'N/A'}</td>
                                            <td>KES {job.agreed_price_kes?.toLocaleString() || '0.00'}</td>
                                            <td>{job.deadline_hours} hrs</td>
                                            <td><span className={`status-badge ${job.status}`}>{job.status.replace('_', ' ')}</span></td>
                                            <td>{new Date(job.created_at).toLocaleDateString()}</td>
                                            {/* Add more cells for other job details */}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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

export default AdminJobs;
