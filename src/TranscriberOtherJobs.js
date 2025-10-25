// src/TranscriberOtherJobs.js

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal'; // Assuming you have a Modal component
import { useAuth } from './contexts/AuthContext';
import { getSocketInstance } from './ChatService'; // Removed disconnectSocket
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
    const [showCompleteJobModal, setShowCompleteJobModal] = useState(false);
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
            // This endpoint should now return jobs with status 'available_for_transcriber'
            // and filter by transcriber rating (4 or 5) on the backend.
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/available`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                setAvailableJobs(data.jobs || []);
                if (data.jobs?.length === 0) {
                    showToast('No direct upload jobs available for you right now.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load available jobs.', 'error');
                if (response.status === 403) { // Specific message for rating below 4-star
                    showToast('You must be a 4-star or 5-star transcriber to access these jobs.', 'error');
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

        const socket = getSocketInstance();
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
            console.log('TranscriberOtherJobs Real-time: Direct job status update!', data);
            showToast(`Direct job ${data.jobId?.substring(0, 8)}... status updated to ${data.newStatus}.`, 'info');
            fetchAvailableJobs(); // Refresh the list
        };

        // NEW: Listener for when a direct upload job is taken by *any* transcriber
        const handleDirectJobTaken = (data) => {
            console.log('TranscriberOtherJobs Real-time: Direct job taken event received!', data);
            showToast(`Direct job ${data.jobId?.substring(0, 8)}... has been taken.`, 'info');
            fetchAvailableJobs(); // Refresh the list to remove the taken job
        };

        socket.on('new_direct_job_available', handleNewDirectJobAvailable);
        socket.on('direct_job_status_update', handleDirectJobStatusUpdate);
        socket.on('direct_upload_job_taken', handleDirectJobTaken); // NEW: Listen for 'direct_upload_job_taken'

        return () => {
            socket.off('new_direct_job_available', handleNewDirectJobAvailable);
            socket.off('direct_job_status_update', handleDirectJobStatusUpdate);
            socket.off('direct_upload_job_taken', handleDirectJobTaken); // Clean up new listener
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

    const openCompleteJobModal = useCallback((jobId) => {
        setSelectedJobId(jobId);
        setShowCompleteJobModal(true);
    }, []);

    const closeCompleteJobModal = useCallback(() => {
        setShowCompleteJobModal(false);
        setSelectedJobId(null);
        setModalLoading(false);
    }, []);


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
                showToast(data.message || 'Job successfully taken!', 'success');
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

    const confirmCompleteJob = useCallback(async () => {
        setModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/${selectedJobId}/complete`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Job marked as complete!', 'success');
                closeCompleteJobModal();
                fetchAvailableJobs(); // Refresh list, this job should disappear
            } else {
                showToast(data.error || 'Failed to mark job as complete.', 'error');
            }
        } catch (error) {
            console.error('Error completing job:', error);
            showToast('Network error while completing job.', 'error');
        } finally {
            setModalLoading(false);
        }
    }, [selectedJobId, logout, showToast, closeCompleteJobModal, fetchAvailableJobs]);


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

                    <div className="jobs-list-grid">
                        {availableJobs.length === 0 ? (
                            <p className="no-data-message">No direct upload jobs available for you right now.</p>
                        ) : (
                            availableJobs.map(job => (
                                <div key={job.id} className="job-card">
                                    <h3>Job ID: {job.id.substring(0, 8)}...</h3>
                                    <p><strong>Client:</strong> {job.client?.full_name || 'Unknown Client'}</p>
                                    <p><strong>File:</strong> <a href={`${BACKEND_API_URL}${job.file_url}`} target="_blank" rel="noopener noreferrer">{job.file_name}</a> ({job.audio_length_minutes?.toFixed(1)} mins)</p>
                                    <p><strong>Instructions:</strong> {job.client_instructions || 'No specific instructions.'}</p>
                                    {job.instruction_files && job.instruction_files.length > 0 && (
                                        <p><strong>Additional Files:</strong> {job.instruction_files.split(',').map((file, i) => (
                                            <a key={i} href={`${BACKEND_API_URL}/uploads/direct_upload_files/${file}`} target="_blank" rel="noopener noreferrer" style={{marginLeft: '5px'}}>{file}</a>
                                        ))}</p>
                                    )}
                                    <p><strong>Quote:</strong> USD {job.quote_amount.toLocaleString()}</p>
                                    <p><strong>Your 80% Pay:</strong> USD {(job.quote_amount * 0.8).toLocaleString()}</p>
                                    <p><strong>Deadline:</strong> {job.agreed_deadline_hours} hours</p>
                                    <p><strong>Quality:</strong> {job.quality_param}</p>
                                    <p><strong>Requirements:</strong> {job.special_requirements?.length > 0 ? job.special_requirements.join(', ') : 'None'}</p>
                                    <p><strong>Status:</strong> <span className={`status-badge ${job.status}`}>{job.status.replace('_', ' ')}</span></p>

                                    <div className="job-actions">
                                        {/* UPDATED: Only show 'Take Job' button if status is 'available_for_transcriber' */}
                                        {job.status === 'available_for_transcriber' && (
                                            <button onClick={() => openTakeJobModal(job.id)} className="take-job-btn">Take Job</button>
                                        )}
                                        {job.status === 'in_progress' && (
                                            <button onClick={() => openCompleteJobModal(job.id)} className="complete-job-btn">Mark as Complete</button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
                    <p>You will be marked as busy and unavailable for other jobs until this one is completed.</p>
                </Modal>
            )}

            {/* Complete Job Modal */}
            {showCompleteJobModal && (
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
            )}

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
