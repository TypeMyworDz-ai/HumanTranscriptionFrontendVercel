// src/ClientPaymentHistory.js - UPDATED to display only two summary cards
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast'; 
import { useAuth } from './contexts/AuthContext';
import './ClientPaymentHistory.css'; 

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientPaymentHistory = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();

    // Removed 'payments' state as the detailed table is no longer needed
    const [totalPayments, setTotalPayments] = useState(0); // State for Total Payments card
    const [thisMonthsPayments, setThisMonthsPayments] = useState(0); // State for This Month's Payments card
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchPaymentHistory = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("ClientPaymentHistory: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/client/payments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                // Set summary values directly for the cards
                setTotalPayments(data.summary?.totalPayments || 0);
                setThisMonthsPayments(data.summary?.thisMonthsPayments || 0); // Corrected to thisMonthsPayments
                if (data.summary?.totalPayments === 0 && data.summary?.thisMonthsPayments === 0) {
                    showToast('No payment history found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to load payment history.', 'error');
            }
        } catch (error) {
            console.error('Network error fetching client payment history:', error);
            showToast('Network error while fetching payment history.', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user || user.user_type !== 'client') {
            console.warn("ClientPaymentHistory: Unauthorized access or not a client. Redirecting.");
            navigate('/'); 
            return;
        }

        fetchPaymentHistory();
    }, [isAuthenticated, authLoading, user, navigate, fetchPaymentHistory]);

    if (authLoading || !isAuthenticated || !user || loading) {
        return (
            <div className="payment-history-container">
                <div className="loading-spinner">Loading payment history...</div>
            </div>
        );
    }

    return (
        <div className="payment-history-container">
            <header className="payment-history-header">
                <div className="header-content">
                    <h1>Your Payment History</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="payment-history-main">
                <div className="payment-history-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Overview of Your Payments</h2>
                            <p>Track all your payments made on the platform.</p>
                        </div>
                        <Link to="/client-dashboard" className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <div className="summary-cards-grid">
                        <div className="summary-card">
                            <h3>Total Payments</h3>
                            <p className="summary-value">USD {totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="summary-card">
                            <h3>This Month's Payments</h3>
                            <p className="summary-value">USD {thisMonthsPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* REMOVED: All table rendering logic */}
                    {/* The detailed table is removed as per requirement */}
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

export default ClientPaymentHistory;
