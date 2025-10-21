import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import NegotiationCard from './NegotiationCard';
import { useAuth } from './contexts/AuthContext';
import { connectSocket } from './ChatService';
import './ClientCompletedJobs.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientCompletedJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [completedJobs, setCompletedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchClientCompletedJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("ClientCompletedJobs: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                const fetchedNegotiations = data.negotiations || [];
                const jobs = fetchedNegotiations.filter(n => n.status === 'completed');
                console.log("ClientCompletedJobs: Filtered Completed Jobs:", jobs.map(j => ({ id: j.id, status: j.status })));
                
                // Use functional update for setCompletedJobs with deep comparison
                setCompletedJobs(prevJobs => {
                    if (JSON.stringify(jobs) !== JSON.stringify(prevJobs)) {
                        console.log("ClientCompletedJobs: Updating completedJobs state. New data differs from previous.");
                        return jobs;
                    }
                    console.log("ClientCompletedJobs: Not updating completedJobs state. Data is identical.");
                    return prevJobs; // No change, return previous state
                });

                if (jobs.length === 0) {
                    showToast('No completed jobs found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load completed jobs.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching client completed jobs:', error);
            showToast('Network error while fetching completed jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);


    const handleJobUpdate = useCallback((data) => {
        console.log('ClientCompletedJobs: Job status update received via Socket. Triggering re-fetch for list cleanup.', data);
        showToast(`Job status updated for ID: ${data.negotiationId}.`, 'info'); // FIX: Changed data.negotiation_id to data.negotiationId
        fetchClientCompletedJobs(); 
    }, [showToast, fetchClientCompletedJobs]);


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientCompletedJobs: Unauthorized access or not a client. Redirecting.");
            navigate('/');
            return;
        }

        fetchClientCompletedJobs();
    }, [isAuthenticated, authLoading, user, navigate, fetchClientCompletedJobs]);


    useEffect(() => {
        if (isAuthenticated && user && user.user_type === 'client' && user.id) {
            const socket = connectSocket(user.id);
            if (socket) {
                socket.on('job_completed', handleJobUpdate);
                console.log('ClientCompletedJobs: Socket listeners attached for completed jobs.');
            }

            return () => {
                if (socket) {
                    console.log(`ClientCompletedJobs: Cleaning up socket listeners for user ID: ${user.id}`);
                    socket.off('job_completed', handleJobUpdate);
                }
            };
        }
    }, [isAuthenticated, user, handleJobUpdate]);


    const getStatusColor = useCallback((status, isClientViewing) => {
        const colors = {
            'pending': '#007bff',
            'transcriber_counter': '#ffc107',
            'accepted_awaiting_payment': '#28a745',
            'rejected': '#dc3545',
            'hired': '#007bff',
            'cancelled': '#dc3545',
            'completed': '#6f42c1'
        };
        return colors[status] || '#6c757d';
    }, []);

    const getStatusText = useCallback((status, isClientViewing) => {
        const texts = {
            'pending': 'Waiting for Transcriber',
            'transcriber_counter': 'Transcriber Countered',
            'client_counter': 'Client Countered',
            'accepted_awaiting_payment': 'Accepted - Awaiting Payment',
            'rejected': 'Rejected',
            'hired': 'Job Active - Paid',
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        };
        return texts[status] || status;
    }, []);

    const handleDeleteNegotiation = useCallback(async (negotiationId) => {
        if (!window.confirm('Are you sure you want to delete this completed job from your list? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                logout();
                return;
            }
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/${negotiationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Completed job deleted successfully!', 'success');
                fetchClientCompletedJobs();
            } else {
                showToast(data.error || 'Failed to delete completed job', 'error');
            }
        } catch (error) {
            showToast('Network error. Please try again.', 'error');
        }
    }, [showToast, logout, fetchClientCompletedJobs]);

    // NEW: Function to handle downloading negotiation files
    const handleDownloadFile = useCallback(async (negotiationId, fileName) => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            // Construct the API endpoint URL
            const downloadUrl = `${BACKEND_API_URL}/api/negotiations/${negotiationId}/download/${fileName}`;
            
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Get the blob from the response
                const blob = await response.blob();
                // Create a temporary URL for the blob
                const url = window.URL.createObjectURL(blob);
                // Create a temporary link element
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName; // Set the download filename
                document.body.appendChild(a);
                a.click(); // Programmatically click the link to trigger download
                a.remove(); // Clean up the link element
                window.URL.revokeObjectURL(url); // Clean up the temporary URL
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


    if (loading) {
        return (
            <div className="client-completed-jobs-container">
                <div className="loading-spinner">Loading completed jobs...</div>
            </div>
        );
    }

    return (
        <div className="client-completed-jobs-container">
            <header className="client-completed-jobs-header">
                <div className="header-content">
                    <h1>My Completed Jobs</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="client-completed-jobs-main">
                <div className="client-completed-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Your Finished Transcription Projects</h2>
                            <p>Review your completed jobs and provide valuable feedback to transcribers.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3>Completed Jobs ({completedJobs.length})</h3>
                    <div className="completed-jobs-list">
                        {completedJobs.length === 0 ? (
                            <p className="no-data-message">You currently have no completed jobs.</p>
                        ) : (
                            completedJobs.map((job) => {
                                console.log(`ClientCompletedJobs: Rendering NegotiationCard for job ID: ${job.id}.`);
                                return (
                                    <NegotiationCard
                                        key={job.id}
                                        negotiation={job}
                                        onDelete={handleDeleteNegotiation}
                                        onPayment={() => showToast('Payment already processed.', 'info')}
                                        onLogout={logout}
                                        getStatusColor={getStatusColor}
                                        getStatusText={getStatusText}
                                        showToast={showToast}
                                        currentUserId={user.id}
                                        currentUserType={user.user_type}
                                        onDownloadFile={handleDownloadFile} // NEW: Pass the download function
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

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

export default ClientCompletedJobs;
