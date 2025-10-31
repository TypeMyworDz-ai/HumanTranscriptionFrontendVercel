// src/TranscriberOtherJobs.js

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal'; // Assuming you have a Modal component
import { useAuth } from './contexts/AuthContext';
import { connectSocket } from './ChatService';
import './TranscriberOtherJobs.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberOtherJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [availableJobs, setAvailableJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // State for Modals
    const [showTakeJobModal, setShowTakeJobModal] = useState(false);
    // Removed showCompleteJobModal as it's not used here
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchAvailableJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("TranscriberOtherJobs: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/available`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            // NEW LOG: Log the raw data received from the backend
            console.log("[TranscriberOtherJobs] Raw data from /api/transcriber/direct-jobs/available:", data);

            if (response.ok) {
                setAvailableJobs(data.jobs || []);
                if (data.jobs?.length === 0) {
                    showToast('No direct upload jobs available for you right now.', 'info');
                }
            } else {
                if (response.status === 409) {
                    showToast(data.error || 'You are not eligible to view these jobs due to your current status.', 'error');
                } else if (response.status === 403) {
                    showToast('You must be a 4-star or 5-star transcriber to access these jobs.', 'error');
                } else {
                    showToast(data.error || 'Failed to load available jobs.', 'error');
                }
            }
        } catch (error) {
            console.error('Network error fetching available jobs:', error);
            showToast('Network error while fetching available jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn("TranscriberOtherJobs: Unauthorized access or not a transcriber. Redirecting.");
            navigate('/');
            return;
        }

        fetchAvailableJobs();
    }, [isAuthenticated, authLoading, user, navigate, fetchAvailableJobs]);


    // --- Socket.IO Event Listeners for Real-time Updates ---
    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            return;
        }

        // Connect or get the existing socket instance
        const socket = connectSocket(user.id);
        if (!socket) {
            console.warn("TranscriberOtherJobs: Socket.IO not connected, real-time updates may not work.");
            return;
        }

        const handleNewDirectJobAvailable = (data) => {
            console.log('TranscriberOtherJobs Real-time: New direct job available!', data);
            showToast(data.message || `A new direct upload job is available!`, 'info');
            fetchAvailableJobs(); // Refresh the list
        };

        const handleDirectJobStatusUpdate = (data) => {
            console.log('TranscriberOtherJobs Real-time: Direct job status update! (for OtherJobs)', data); // Clarified log
            showToast(`Direct job ${data.jobId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
            fetchAvailableJobs(); // Refresh the list
        };

        const handleDirectJobTaken = (data) => {
            console.log('TranscriberOtherJobs Real-time: Direct job taken event received!', data);
            showToast(`Direct job ${data.jobId?.substring(0, 8)}... has been taken.`, 'info');
            fetchAvailableJobs(); // Refresh the list to remove the taken job
        };

        socket.on('new_direct_job_available', handleNewDirectJobAvailable);
        socket.on('direct_job_status_update', handleDirectJobStatusUpdate);
        socket.on('direct_upload_job_taken', handleDirectJobTaken);

        return () => {
            socket.off('new_direct_job_available', handleNewDirectJobAvailable);
            socket.off('direct_job_status_update', handleDirectJobStatusUpdate);
            socket.off('direct_upload_job_taken', handleDirectJobTaken);
        };
    }, [user?.id, isAuthenticated, fetchAvailableJobs, showToast]);


    // --- Modal Handlers ---
    const openTakeJobModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowTakeJobModal(true);
    }, []);

    const closeTakeJobModal = useCallback(() => {
        setShowTakeJobModal(false);
        setSelectedJobId(null);
        setModalLoading(false);
    }, []);

    // Removed openCompleteJobModal and closeCompleteJobModal as they are not used here


    // --- API Actions ---
    const confirmTakeJob = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/${selectedJobId}/take`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Job successfully taken! You are now working on this job.', 'success');
                closeTakeJobModal();
                navigate('/transcriber-dashboard'); // Redirect to dashboard to show active job
            } else {
                showToast(data.error || 'Failed to take job. This job might have been taken by another transcriber.', 'error');
                fetchAvailableJobs(); // Refresh the list if taking failed (e.g., job already taken)
            }
        } catch (error) {
            console.error('Error taking job:', error);
            showToast('Network error while taking job.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, logout, navigate, showToast, closeTakeJobModal, fetchAvailableJobs]);

    // Removed confirmCompleteJob as it's not used here

    // Helper function to format status text for display
    const formatStatusText = (status) => {
        if (status === 'available_for_transcriber') {
            return 'Available';
        }
        return status.replace(/_/g, ' ');
    };


    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="transcriber-other-jobs-container">
                <div className="loading-spinner">Loading jobs...</div>
            </div>
        );
    }

    return (
        <div className="transcriber-other-jobs-container">
            <header className="transcriber-other-jobs-header">
                <div className="header-content">
                    <h1>Other Jobs</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="transcriber-other-jobs-main">
                <div className="transcriber-other-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Available Direct Upload Jobs</h2>
                            <p>Browse jobs posted directly by clients and take them if you qualify.</p>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    {availableJobs.length === 0 ? (
                        <p className="no-data-message">No direct upload jobs available for you right now.</p>
                    ) : (
                        <div className="jobs-table-container">
                            <table className="jobs-table">
                                <colgroup>
                                    <col style={{ width: '6%' }} /> {/* Job ID */}
                                    <col style={{ width: '8%' }} /> {/* Client */}
                                    <col style={{ width: '12%' }} /> {/* File Name */}
                                    <col style={{ width: '7%' }} /> {/* Audio Length */}
                                    <col style={{ width: '12%' }} /> {/* Instructions */}
                                    <col style={{ width: '12%' }} /> {/* Additional Files */}
                                    <col style={{ width: '8%' }} /> {/* Your Pay */}
                                    <col style={{ width: '6%' }} /> {/* TAT (hrs) */}
                                    <col style={{ width: '6%' }} /> {/* Quality */}
                                    <col style={{ width: 8 }} /> {/* Requirements */}
                                    <col style={{ width: '10%' }} /> {/* Status */}
                                    <col style={{ width: '10%' }} /> {/* Actions */}
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>Job ID</th>
                                        <th>Client</th>
                                        <th>File Name</th>
                                        <th>Audio Length (mins)</th>
                                        <th>Instructions</th>
                                        <th>Additional Files</th>
                                        <th>Your Pay (USD)</th>
                                        <th>TAT (hrs)</th>
                                        <th>Quality</th>
                                        <th>Requirements</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {availableJobs.map(job => (
                                        <tr key={job.id}>
                                            <td>{job.id.substring(0, 8)}...</td>
                                            <td>{job.client?.full_name || 'N/A'}</td>
                                            <td>
                                                <a href={`${BACKEND_API_URL}/api/direct-jobs/${job.id}/download/${job.file_name}`} target="_blank" rel="noopener noreferrer">
                                                    {job.file_name}
                                                </a>
                                            </td>
                                            <td>{job.audio_length_minutes?.toFixed(1)}</td>
                                            <td>{job.client_instructions || 'N/A'}</td>
                                            <td>
                                                {job.instruction_files && job.instruction_files.length > 0 ? (
                                                    job.instruction_files.split(',').map((file, i) => (
                                                        <a key={i} href={`${BACKEND_API_URL}/api/direct-jobs/${job.id}/download/${file}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                                            {file}
                                                        </a>
                                                    ))
                                                ) : 'N/A'}
                                            </td>
                                            <td>USD {job.transcriber_pay?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td>{job.agreed_deadline_hours}</td>
                                            <td>{job.audio_quality_param}</td>
                                            <td>{job.special_requirements?.length > 0 ? job.special_requirements.join(', ') : 'None'}</td>
                                            <td><span className={`status-badge ${job.status}`}>{formatStatusText(job.status)}</span></td>
                                            <td>
                                                <div className="job-actions">
                                                    {job.status === 'available_for_transcriber' && (
                                                        <button onClick={() => openTakeJobModal(job.id)} className="take-job-btn">Take Job</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Take Job Modal */}
            {showTakeJobModal && (
                <Modal
                    show={showTakeJobModal}
                    title="Confirm Take Job"
                    onClose={closeTakeJobModal}
                    onSubmit={confirmTakeJob}
                    submitText="Confirm Take"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to take this job? Once taken, it will be assigned to you.</p>
                    <p>You will be assigned this job and will not be able to take other jobs until it is completed.</p>
                </Modal>
            )}

            {/* Removed Complete Job Modal as it's not used here */}
            {/* {showCompleteJobModal && (
                <Modal
                    show={showCompleteJobModal}
                    title="Confirm Job Completion"
                    onClose={closeCompleteJobModal}
                    onSubmit={confirmCompleteJob}
                    submitText="Confirm Complete"
                    loading={modalLoading}
                >
                    <p>Are you sure you want to mark this job as complete?</p>
                    <p>The client will be notified, and you will become available for new jobs.</p>
                </Modal>
            )} */}

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

export default TranscriberOtherJobs;
