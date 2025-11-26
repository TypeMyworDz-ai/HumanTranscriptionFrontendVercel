// src/TranscriberCompletedDirectUploadJobs.js - Handles ONLY Completed Direct Upload Jobs for Transcribers
import React, { useState, useEffect, useCallback } from 'react'; // Removed Fragment from import
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
// Removed: import './TranscriberDirectUploadJobs.css'; // Reusing the CSS for consistency, but not directly importing here if it's generic
// Removed: import DirectUploadJobCard from './DirectUploadJobCard'; // No longer using card component

import { connectSocket, disconnectSocket } from './ChatService';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config';

// Helper function to format timestamp robustly for display
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

// Helper function for star rating display
const getStarRating = (rating) => {
    if (typeof rating !== 'number' || isNaN(rating)) return 'N/A';
    const fullStars = '⭐'.repeat(Math.floor(rating));
    const emptyStars = '☆'.repeat(5 - Math.floor(rating));
    return `${fullStars}${emptyStars} (${rating.toFixed(1)})`;
};

// --- Component Definition ---
const TranscriberCompletedDirectUploadJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [completedDirectUploadJobs, setCompletedDirectUploadJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({
        isVisible: false,
        message: '',
        type: 'success'
    });

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

    // Fetch ALL direct upload jobs for the current transcriber and filter for completed
    const fetchCompletedDirectUploadJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            if (isAuthenticated) {
                console.warn("TranscriberCompletedDirectUploadJobs: Token or userId missing for API call despite authenticated state. Forcing logout.");
                logout();
            }
            return Promise.reject(new Error('Authentication token or userId missing.'));
        }

        setLoading(true);
        try {
            // Call the history endpoint to get all direct upload jobs
            const directUploadResponse = await fetch(`${BACKEND_API_URL}/api/transcriber/direct-jobs/history`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            let directUploadData = { jobs: [] };
            if (directUploadResponse.ok) {
                directUploadData = await directUploadResponse.json();
            }

            const fetchedAllDirectUploadJobs = directUploadData.jobs || [];
            
            // Filter for completed or client_completed jobs
            const completedJobs = fetchedAllDirectUploadJobs.filter(job => 
                job.status === 'completed' || job.status === 'client_completed'
            );
            
            const typedCompletedJobs = completedJobs.map(job => {
                const transcriberEarning = parseFloat(job.transcriber_earning) || 0; 
                return {
                    ...job,
                    jobType: 'direct_upload',
                    client_name: job.client?.full_name || 'Unknown Client',
                    client_average_rating: job.client?.client_average_rating || 0, 
                    // Removed: agreed_price_usd mapping from quote_amount as per request
                    deadline_hours: job.agreed_deadline_hours,
                    file_name: job.file_name,
                    completed_on: job.completed_at || job.client_completed_at, 
                    transcriber_comment: job.transcriber_comment, 
                    client_feedback_comment: job.client_feedback_comment,
                    client_feedback_rating: job.client_feedback_rating,
                    transcriber_earning: transcriberEarning 
                };
            });

            setCompletedDirectUploadJobs(typedCompletedJobs); 

            if (typedCompletedJobs.length === 0) {
                showToast('No completed direct upload jobs found.', 'info');
            }
        } catch (error) {
            console.error("Network error while fetching completed direct upload jobs:", error);
            showToast('Network error while fetching completed direct upload jobs.ᐟ', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast, user?.id]); 


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'transcriber') {
            console.warn(`TranscriberCompletedDirectUploadJobs: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            logout();
            return;
        }

        const transcriberStatus = user.transcriber_status || '';
        const transcriberUserLevel = user.transcriber_user_level || '';
        const isTranscriber = user.user_type === 'transcriber';

        const hasActiveTranscriberStatus = isTranscriber && (transcriberStatus === 'active_transcriber' || transcriberUserLevel === 'proofreader');

        if (!isTranscriber || !hasActiveTranscriberStatus) {
            console.warn(`TranscriberCompletedDirectUploadJobs: Unauthorized access attempt by user_type: ${user.user_type}, status: ${transcriberStatus}, level: ${transcriberUserLevel}. Redirecting.`);
            navigate('/');
            return;
        }

        fetchCompletedDirectUploadJobs(); 
    }, [isAuthenticated, authLoading, user, navigate, fetchCompletedDirectUploadJobs, logout]);

    const handleJobUpdate = useCallback((data) => {
        console.log('TranscriberCompletedDirectUploadJobs Real-time: Job update received! Triggering re-fetch for list cleanup.', data);
        const jobId = data.jobId; 
        showToast(data.message || `Direct upload job status updated for ID: ${jobId?.substring(0, 8)}.`, 'info');
        fetchCompletedDirectUploadJobs(); // Re-fetch to update the list
    }, [showToast, fetchCompletedDirectUploadJobs]);

    const handleNewChatMessageForDirectUploadJobs = useCallback((data) => {
        console.log('TranscriberCompletedDirectUploadJobs Real-time: New chat message received!', data);
        const relatedJobId = data.direct_upload_job_id;
        
        setCompletedDirectUploadJobs(prevJobs => {
            const isForCompletedJob = prevJobs.some(job => job.id === relatedJobId);

            if (!isForCompletedJob) return prevJobs; 

            return prevJobs.map(job => {
                if (job.id === relatedJobId) {
                    return {
                        ...job,
                        last_message_text: data.message || 'New Message, Check.',
                        last_message_timestamp: new Date().toISOString(),
                    };
                }
                return job;
            });
        });

        showToast(`New message for completed job ${relatedJobId?.substring(0, 8)} from ${data.sender_name || 'Client'}!`, 'info');
    }, [showToast]);

    useEffect(() => {
        if (!user?.id || !isAuthenticated) {
            console.log("TranscriberCompletedDirectUploadJobs: User ID or authentication status not ready for socket connection.");
            return;
        }

        console.log(`TranscriberCompletedDirectUploadJobs: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        if (socket) {
            socket.on('direct_job_completed', handleJobUpdate); 
            socket.on('direct_job_client_completed', handleJobUpdate);
            socket.on('direct_job_completed_transcriber_side', handleJobUpdate); 
            socket.on('newChatMessage', handleNewChatMessageForDirectUploadJobs);

            console.log('TranscriberCompletedDirectUploadJobs: Socket listeners attached.');
        }

        return () => {
            if (socket) {
                console.log(`TranscriberCompletedDirectUploadJobs: Cleaning up socket listeners and disconnecting via ChatService for user ID: ${user.id}`);
                socket.off('direct_job_completed', handleJobUpdate);
                socket.off('direct_job_client_completed', handleJobUpdate);
                socket.off('direct_job_completed_transcriber_side', handleJobUpdate); 
                socket.off('newChatMessage', handleNewChatMessageForDirectUploadJobs);
                disconnectSocket();
            }
        };
    }, [user?.id, isAuthenticated, handleJobUpdate, handleNewChatMessageForDirectUploadJobs]);

    // Utility functions (can be shared or defined here)
    const getStatusColor = useCallback((status) => { 
        const colors = {
            'completed': '#6f42c1', 
            'client_completed': '#6f42c1',
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status) => { 
        const texts = {
            'completed': 'Submitted for Review', 
            'client_completed': 'Completed by Client', 
        };
        return texts[status] || status;
    }, []);

    const handleDownloadFile = useCallback(async (jobId, fileName, jobType) => { 
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }
        // Direct Upload jobs will have jobType 'direct_upload'
        if (jobType !== 'direct_upload') { 
            showToast('Only direct upload job files can be downloaded from this view.', 'error');
            return;
        }

        try {
            const downloadUrl = `${BACKEND_API_URL}/api/direct-jobs/${jobId}/download/${fileName}`;
            
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showToast(`Downloading ${fileName}...`, 'success');
            } else {
                const errorData = await response.json();
                showToast(errorData.error || `Failed to download ${fileName}.`, 'error');
            }
        } catch (error) {
            console.error('Network error during file download:', error);
            showToast('Network error during file download. Please try again.', 'error');
        }
    }, [showToast, logout]);


    if (authLoading || !isAuthenticated || !user) {
        return <div className="loading-container">Loading authentication...</div>;
    }

    if (loading) {
        return (
            <div className="loading-container">Loading completed jobs...</div>
        );
    }

    const pageTitle = "My Completed DU Jobs";
    const pageDescription = "View your finished direct upload transcription projects and their feedback.";
    const listSubtitle = "Completed Direct Upload Jobs";
    const emptyMessage = "No completed direct upload jobs found.";

    return (
        <div className="transcriber-direct-upload-jobs-container">
            <header className="transcriber-direct-upload-jobs-header">
                <div className="header-content">
                    <h1>{pageTitle}</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, <strong>{user.full_name}</strong>!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="transcriber-direct-upload-jobs-main">
                <div className="transcriber-direct-upload-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2 dangerouslySetInnerHTML={{ __html: pageTitle }}></h2>
                            <p>{pageDescription}</p>
                        </div>
                        <Link to="/transcriber-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3 className="direct-upload-jobs-subtitle">{listSubtitle}</h3>
                    <div className="completed-jobs-list-table"> {/* Using a generic table container class */}
                        {completedDirectUploadJobs.length === 0 ? (
                            <p className="no-data-message">{emptyMessage}</p>
                        ) : (
                            <table className="completed-jobs-table"> {/* Using a generic table class */}
                                <thead>
                                    <tr>
                                        <th>Job ID</th>
                                        <th>Client</th>
                                        <th>Your Pay (USD)</th> 
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Completed On</th>
                                        <th>Your Comment</th>
                                        <th>Client Feedback</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedDirectUploadJobs.map(job => (
                                        <tr key={job.id}>
                                            <td>{job.id?.substring(0, 8)}...</td>
                                            <td>
                                                {job.client_name || 'N/A'}
                                                {job.client_average_rating > 0 && (
                                                    <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                                                        ({'★'.repeat(Math.floor(job.client_average_rating))} {(job.client_average_rating).toFixed(1)})
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {job.transcriber_earning !== undefined && job.transcriber_earning !== null
                                                    ? `USD ${job.transcriber_earning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : 'N/A'}
                                            </td>
                                            <td>{job.deadline_hours ? `${job.deadline_hours} hours` : 'N/A'}</td>
                                            <td>
                                                <span className="status-badge" style={{ backgroundColor: getStatusColor(job.status) }}>
                                                    {getStatusText(job.status)}
                                                </span>
                                            </td>
                                            <td>{formatDisplayTimestamp(job.completed_on)}</td>
                                            <td>{job.transcriber_comment || 'N/A'}</td>
                                            <td>
                                                {job.client_feedback_comment || 'N/A'}
                                                {job.client_feedback_rating > 0 && (
                                                    <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                                                        ({getStarRating(job.client_feedback_rating)})
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {job.file_name && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadFile(job.id, job.file_name, job.jobType);
                                                        }}
                                                        className="action-btn download-btn"
                                                        title="Download File"
                                                    >
                                                        ⬇️
                                                    </button>
                                                )}
                                                {/* No delete button for completed Direct Upload jobs from transcriber side */}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
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

export default TranscriberCompletedDirectUploadJobs;
