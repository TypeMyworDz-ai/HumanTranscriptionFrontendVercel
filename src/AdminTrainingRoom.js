// frontend/client/src/AdminTrainingRoom.js

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import './AdminManagement.css'; // Reusing the admin management CSS

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminTrainingRoom = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [trainees, setTrainees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchTrainees = useCallback(async (currentSearchTerm) => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            // We'll reuse the getAllUsersForAdmin endpoint and filter for trainees
            const response = await fetch(`${BACKEND_API_URL}/api/admin/users?search=${encodeURIComponent(currentSearchTerm)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                // Filter for users with user_type 'trainee'
                const filteredTrainees = data.users.filter(u => u.user_type === 'trainee');
                setTrainees(filteredTrainees);
            } else {
                console.error('[AdminTrainingRoom.js] Error data received from backend:', data);
                showToast(data.error || 'Failed to fetch trainees.', 'error');
            }
        } catch (error) {
            console.error('Error fetching trainees:', error);
            showToast('Network error fetching trainees.', 'error');
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    useEffect(() => {
        if (user?.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            showToast('Access denied. Only admins can manage training rooms.', 'error');
            return;
        }
        const handler = setTimeout(() => {
            fetchTrainees(searchTerm);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [user, navigate, fetchTrainees, searchTerm, showToast]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleViewTrainingRoom = (traineeId, traineeName) => {
        console.log(`Admin wants to view training room for: ${traineeName} (ID: ${traineeId})`);
        // Navigate to the existing TraineeTrainingRoom component, passing the traineeId as chatId
        navigate(`/admin/training-room/${traineeId}`);
        showToast(`Opening training room for ${traineeName}...`, 'info');
    };

    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading trainees...</div>
            </div>
        );
    }

    // Redirect if not an admin (should ideally be handled by ProtectedRoute but good to have client-side check too)
    if (user?.user_type !== 'admin') {
        return null; 
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Training Rooms</h1>
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
                    <h2>Active Trainee Training Rooms</h2>
                    <p>View and participate in individual training room chats with trainees.</p>

                    <div className="search-bar">
                        <input
                            type="text"
                            placeholder="Search trainees by name or email..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>

                    {trainees.length === 0 ? (
                        <p className="no-data-message">No trainees found or no active training rooms.</p>
                    ) : (
                        <div className="users-list-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Joined On</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainees.map(t => (
                                        <tr key={t.id}>
                                            <td>{t.full_name}</td>
                                            <td>{t.email}</td>
                                            <td>
                                                <span className={`status-badge ${t.transcriber_status || 'unknown'}`}>
                                                    {t.transcriber_status?.replace('_', ' ') || 'N/A'}
                                                </span>
                                            </td>
                                            <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    onClick={() => handleViewTrainingRoom(t.id, t.full_name)}
                                                    className="chat-btn"
                                                >
                                                    View Room
                                                </button>
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

export default AdminTrainingRoom;
