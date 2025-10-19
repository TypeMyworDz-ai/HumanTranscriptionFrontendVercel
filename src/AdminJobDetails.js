// frontend/client/src/AdminJobDetails.js

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminManagement.css'; // Assuming common admin styles

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminJobDetails = () => {
    const { jobId } = useParams();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [jobData, setJobData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchJobDetails = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/jobs/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && data) {
                setJobData(data);
            } else {
                showToast(data.error || 'Failed to fetch job details.', 'error');
                navigate('/admin/jobs'); // Redirect back to all jobs if not found or error
            }
        } catch (error) {
            console.error('Error fetching job details:', error);
            showToast('Network error fetching job details.', 'error');
            navigate('/admin/jobs'); // Redirect back to all jobs on network error
        } finally {
            setLoading(false);
        }
    }, [jobId, logout, navigate, showToast]);

    useEffect(() => {
        // Basic role check (ProtectedRoute already handles main access)
        if (!user || user.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            return;
        }
        fetchJobDetails();
    }, [user, navigate, fetchJobDetails]);

    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading job details...</div>
            </div>
        );
    }

    if (!jobData) {
        return (
            <div className="admin-management-container">
                <p className="no-data-message">Job details not found.</p>
                <Link to="/admin/jobs" className="back-link">← Back to Manage All Jobs</Link>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Job Details: {jobData.id?.substring(0, 8)}...</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin/jobs" className="back-link">← Back to Manage All Jobs</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Job Negotiation Details</h2>
                    <p>Comprehensive overview of negotiation ID: {jobData.id}</p>
                    
                    <div className="job-detail-card">
                        <h3>Overview</h3>
                        <div className="detail-row">
                            <span>Status:</span>
                            <strong><span className={`status-badge ${jobData.status}`}>{jobData.status.replace('_', ' ')}</span></strong>
                        </div>
                        <div className="detail-row">
                            <span>Requested On:</span>
                            <strong>{new Date(jobData.created_at).toLocaleString()}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Agreed Price:</span>
                            <strong>KES {jobData.agreed_price_kes?.toLocaleString() || '0.00'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Deadline:</span>
                            <strong>{jobData.deadline_hours} hours</strong>
                        </div>
                        <div className="detail-row">
                            <span>Requirements:</span>
                            <strong>{jobData.requirements}</strong>
                        </div>
                        {jobData.negotiation_files && (
                            <div className="detail-row">
                                <span>Attached File:</span>
                                <strong>
                                    <a
                                        href={`${BACKEND_API_URL}/uploads/negotiation_files/${jobData.negotiation_files}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="file-link"
                                    >
                                        📄 {jobData.negotiation_files}
                                    </a>
                                </strong>
                            </div>
                        )}
                    </div>

                    <div className="job-detail-card">
                        <h3>Client Information</h3>
                        <div className="detail-row">
                            <span>Name:</span>
                            <strong>{jobData.client?.full_name || 'Unknown Client'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Email:</span>
                            <strong>{jobData.client?.email || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Client ID:</span>
                            <strong>{jobData.client?.id || 'N/A'}</strong>
                        </div>
                    </div>

                    <div className="job-detail-card">
                        <h3>Transcriber Information</h3>
                        <div className="detail-row">
                            <span>Name:</span>
                            <strong>{jobData.transcriber?.full_name || 'Unassigned'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Email:</span>
                            <strong>{jobData.transcriber?.email || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Transcriber ID:</span>
                            <strong>{jobData.transcriber?.id || 'N/A'}</strong>
                        </div>
                    </div>

                    {jobData.client_message && (
                        <div className="job-detail-card">
                            <h3>Client's Message</h3>
                            <p>{jobData.client_message}</p>
                        </div>
                    )}

                    {jobData.transcriber_response && (
                        <div className="job-detail-card">
                            <h3>Transcriber's Response</h3>
                            <p>{jobData.transcriber_response}</p>
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

export default AdminJobDetails;
