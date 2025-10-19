// src/ClientJobs.js

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; // Assuming you have a Toast component
import NegotiationCard from './NegotiationCard'; // To display individual job details
import { useAuth } from './contexts/AuthContext';
import './ClientJobs.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientJobs = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    const [activeJobs, setActiveJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchClientJobs = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("ClientJobs: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Reusing the getClientNegotiations endpoint and filtering on frontend
            const response = await fetch(`${BACKEND_API_URL}/api/negotiations/client`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                const fetchedNegotiations = data.negotiations || [];
                // Updated to filter for 'accepted_awaiting_payment' instead of 'accepted'
                const jobs = fetchedNegotiations.filter(n => n.status === 'accepted_awaiting_payment' || n.status === 'hired');
                console.log("Filtered Jobs:", jobs.map(j => ({ id: j.id, status: j.status }))); // Log for debugging
                setActiveJobs(jobs);
                if (jobs.length === 0) {
                    showToast('No active jobs found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load active jobs.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching client jobs:', error);
            showToast('Network error while fetching active jobs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientJobs: Unauthorized access or not a client. Redirecting.");
            navigate('/'); // Redirect to home or login
            return;
        }

        fetchClientJobs();
    }, [isAuthenticated, authLoading, user, navigate, fetchClientJobs]);

    // Utility functions for NegotiationCard (can be shared or defined here)
    const getStatusColor = useCallback((status, isClientViewing) => {
        const colors = {
            'pending': '#007bff',
            'transcriber_counter': '#ffc107',
            'accepted_awaiting_payment': '#28a745', // Updated status color
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
            'accepted_awaiting_payment': 'Accepted - Awaiting Payment', // Updated status text
            'rejected': 'Rejected',
            'hired': 'Job Active - Paid',
            'cancelled': 'Cancelled',
            'completed': 'Completed'
        };
        return texts[status] || status;
    }, []);

    // Placeholder for delete negotiation (if clients can cancel active jobs directly from here)
    const handleDeleteNegotiation = useCallback(async (negotiationId) => {
        // Implement deletion logic if needed
        showToast('Deletion not implemented for active jobs in this view.', 'info');
    }, [showToast]);

    // Placeholder for payment (should already be handled in ClientNegotiations)
    const handleProceedToPayment = useCallback((negotiation) => {
        // Check if the negotiation is in 'accepted_awaiting_payment' status
        if (negotiation.status === 'accepted_awaiting_payment') {
            // Redirect to payment flow or show payment modal
            if (!user?.email || !negotiation?.id || !negotiation?.agreed_price_kes) {
                showToast('Missing client email or negotiation details for payment.', 'error');
                return;
            }
            
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Authentication token missing. Please log in again.', 'error');
                logout();
                return;
            }

            setLoading(true);
            
            fetch(`${BACKEND_API_URL}/api/payment/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    negotiationId: negotiation.id,
                    amount: negotiation.agreed_price_kes,
                    email: user.email
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.data && data.data.authorization_url) {
                    showToast('Redirecting to payment gateway...', 'info');
                    window.location.href = data.data.authorization_url;
                } else {
                    showToast(data.error || 'Failed to initiate payment.', 'error');
                    setLoading(false);
                }
            })
            .catch(error => {
                console.error('Error initiating payment:', error);
                showToast('Network error while initiating payment. Please try again.', 'error');
                setLoading(false);
            });
        } else {
            showToast('Payment already processed for active jobs.', 'info');
        }
    }, [showToast, user, logout]);

    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="client-jobs-container">
                <div className="loading-spinner">Loading active jobs...</div>
            </div>
        );
    }

    return (
        <div className="client-jobs-container">
            <header className="client-jobs-header">
                <div className="header-content">
                    <h1>My Active Jobs</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="client-jobs-main">
                <div className="client-jobs-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Your Current Transcription Projects</h2>
                            <p>Track the progress of your jobs and communicate with your transcribers.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h3>Active Jobs ({activeJobs.length})</h3>
                    <div className="active-jobs-list">
                        {activeJobs.length === 0 ? (
                            <p className="no-data-message">You currently have no active jobs.</p>
                        ) : (
                            activeJobs.map((job) => (
                                <NegotiationCard
                                    key={job.id}
                                    negotiation={job}
                                    onDelete={handleDeleteNegotiation} // Pass placeholder
                                    onPayment={handleProceedToPayment} // Updated to handle payment for 'accepted_awaiting_payment'
                                    onLogout={logout}
                                    getStatusColor={getStatusColor}
                                    getStatusText={getStatusText}
                                    showToast={showToast}
                                    currentUserId={user.id}
                                    currentUserType={user.user_type}
                                    // No modals needed here for active jobs typically
                                />
                            ))
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

export default ClientJobs;
