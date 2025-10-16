// frontend/client/src/AdminUsers.js - COMPLETE AND UPDATED for Vercel deployment

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import './AdminManagement.css';

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminUsers = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchUsers = useCallback(async (currentSearchTerm) => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            // FIXED: Use BACKEND_API_URL constant
            const response = await fetch(`${BACKEND_API_URL}/api/admin/users?search=${encodeURIComponent(currentSearchTerm)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                setUsers(data.users);
            } else {
                showToast(data.error || 'Failed to fetch users.', 'error');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            showToast('Network error fetching users.', 'error');
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchUsers(searchTerm);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm, fetchUsers]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleChatWithUser = (userId, userName) => {
        console.log(`Admin wants to chat with user: ${userName} (ID: ${userId})`);
        navigate(`/admin/chat/${userId}`);
        showToast(`Opening chat with ${userName}...`, 'info');
    };


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading users...</div>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Users</h1>
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
                    <h2>All Clients & Transcribers</h2>
                    <p>View, search, or initiate chats with platform users.</p>

                    <div className="search-bar">
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>

                    {users.length === 0 ? (
                        <p className="no-data-message">No users found matching your criteria.</p>
                    ) : (
                        <div className="users-list-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Type</th>
                                        <th>Joined On</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.full_name}</td>
                                            <td>{u.email}</td>
                                            <td><span className={`status-badge ${u.user_type}`}>{u.user_type.replace('_', ' ')}</span></td>
                                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    onClick={() => handleChatWithUser(u.id, u.full_name)}
                                                    className="chat-btn"
                                                >
                                                    Chat
                                                </button>
                                                {/* Add other actions like Edit/Delete here if needed */}
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

export default AdminUsers;
