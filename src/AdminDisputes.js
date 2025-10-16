// frontend/client/src/AdminDisputes.js - COMPLETE AND UPDATED with functionality

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Import Toast component
import './AdminManagement.css';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminDisputes = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [disputes, setDisputes] = useState([]); // State to store fetched disputes
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Function to fetch all disputes for admin
    const fetchAllDisputes = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/disputes/all`, { // NEW: Admin API endpoint for all disputes
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.disputes) {
                setDisputes(data.disputes);
            } else {
                showToast(data.error || 'Failed to fetch disputes.', 'error');
            }
        } catch (error) {
            console.error('Error fetching disputes:', error);
            showToast('Network error fetching disputes.', 'error');
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
        fetchAllDisputes();
    }, [user, navigate, fetchAllDisputes]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading disputes...</div>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Dispute Resolution</h1>
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
                    <h2>Open Disputes</h2>
                    <p>Mediate and resolve disputes between clients and transcribers.</p>
                    
                    {disputes.length === 0 ? (
                        <p className="no-data-message">No disputes found.</p>
                    ) : (
                        <div className="disputes-list-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Client</th>
                                        <th>Transcriber</th>
                                        <th>Negotiation ID</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Opened On</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {disputes.map(dispute => (
                                        <tr key={dispute.id}>
                                            <td>{dispute.id.substring(0, 8)}...</td>
                                            <td>{dispute.client?.full_name || 'N/A'}</td>
                                            <td>{dispute.transcriber?.full_name || 'N/A'}</td>
                                            <td>{dispute.negotiation_id.substring(0, 8)}...</td>
                                            <td>{dispute.reason}</td>
                                            <td><span className={`status-badge ${dispute.status}`}>{dispute.status.replace('_', ' ')}</span></td>
                                            <td>{new Date(dispute.created_at).toLocaleDateString()}</td>
                                            <td>
                                                {/* Add action buttons here, e.g., View Details, Resolve */}
                                                <button className="action-btn view-details-btn">View Details</button>
                                            </td>
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

export default AdminDisputes;
