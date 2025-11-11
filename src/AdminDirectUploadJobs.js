// src/AdminDirectUploadJobs.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config';
import './AdminDirectUploadJobs.css';
import { Link } from 'react-router-dom';

// Helper function to format timestamp robustly for display (ensuring consistency across components)
const formatDisplayTimestamp = (isoTimestamp) => {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error(`Error formatting timestamp ${isoTimestamp}:`, e);
        return 'Invalid Date';
    }
};

const AdminDirectUploadJobs = () => {
    const { user, logout } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllDirectUploadJobs = useCallback(async () => {
        if (!user || user.user_type !== 'admin') {
            setError('Access denied. Only admins can view this page.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/direct-upload-jobs`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch direct upload jobs.');
            }

            const data = await response.json();
            setJobs(data.jobs);
        } catch (err) {
            console.error('Error fetching all direct upload jobs:', err);
            setError(err.message || 'Failed to load direct upload jobs.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAllDirectUploadJobs();
    }, [fetchAllDirectUploadJobs]);

    if (loading) {
        return <div className="admin-direct-upload-jobs-container">Loading direct upload jobs...</div>;
    }

    if (error) {
        return <div className="admin-direct-upload-jobs-container error-message">{error}</div>;
    }

    return (
        <div className="admin-direct-upload-jobs-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Direct Upload Jobs</h1>
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
                    <h2>All Direct Upload Jobs (Admin View)</h2>
                    {jobs.length === 0 ? (
                        <p className="no-data-message">No direct upload jobs found.</p>
                    ) : (
                        <div className="direct-upload-jobs-table-wrapper">
                            <table className="direct-upload-jobs-table">
                                <thead>
                                    <tr>
                                        <th>Job ID</th>
                                        <th>Client Name</th>
                                        <th>Transcriber Name</th>
                                        <th>File Name</th>
                                        <th>Audio Length (min)</th>
                                        <th>Quote Amount (USD)</th>
                                        <th>Status</th>
                                        <th>Created At</th>
                                        <th>Taken At</th>
                                        <th>Completed At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map((job) => (
                                        <tr key={job.id}>
                                            <td>{job.id.substring(0, 8)}...</td>
                                            <td>{job.client?.full_name || 'N/A'}</td>
                                            <td>{job.transcriber?.full_name || 'N/A'}</td>
                                            <td>{job.file_name || 'N/A'}</td>
                                            <td>{job.audio_length_minutes ? job.audio_length_minutes.toFixed(2) : 'N/A'}</td>
                                            <td>USD {job.quote_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</td>
                                            <td><span className={`status-badge ${job.status}`}>{job.status.replace('_', ' ')}</span></td>
                                            <td>{formatDisplayTimestamp(job.created_at)}</td>
                                            <td>{job.taken_at ? formatDisplayTimestamp(job.taken_at) : 'N/A'}</td>
                                            <td>{job.completed_at ? formatDisplayTimestamp(job.completed_at) : 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDirectUploadJobs;
