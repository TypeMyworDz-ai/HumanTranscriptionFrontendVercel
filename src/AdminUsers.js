// frontend/client/src/AdminUsers.js - COMPLETE AND UPDATED for Vercel deployment and Admin Client Rating

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal'; // NEW: Import Modal for rating
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

    // NEW: State for Client Rating Modal
    const [showRateClientModal, setShowRateClientModal] = useState(false);
    const [selectedClientForRating, setSelectedClientForRating] = useState(null);
    const [ratingScore, setRatingScore] = useState(5); // Default to 5 stars
    const [ratingComment, setRatingComment] = useState('');
    const [ratingModalLoading, setRatingModalLoading] = useState(false);


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
            const response = await fetch(`${BACKEND_API_URL}/api/admin/users?search=${encodeURIComponent(currentSearchTerm)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                // Map the users to include client_rating if available
                const formattedUsers = data.users.map(u => ({
                    ...u,
                    client_rating: u.clients?.[0]?.average_rating || 0 // Safely get average_rating from client profile
                }));
                setUsers(formattedUsers);
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

    // NEW: Rating Modal Handlers
    const openRateClientModal = useCallback((clientUser) => {
        setSelectedClientForRating(clientUser);
        setRatingScore(clientUser.client_rating || 5); // Pre-fill with current rating or default
        setRatingComment(''); // Clear comment
        setShowRateClientModal(true);
    }, []);

    const closeRateClientModal = useCallback(() => {
        setShowRateClientModal(false);
        setSelectedClientForRating(null);
        setRatingModalLoading(false);
    }, []);

    const handleRatingChange = useCallback((e) => {
        setRatingScore(parseInt(e.target.value, 10));
    }, []);

    const handleCommentChange = useCallback((e) => {
        setRatingComment(e.target.value);
    }, []);

    const submitClientRating = useCallback(async () => {
        if (!selectedClientForRating?.id || !ratingScore) {
            showToast('Missing client or rating score.', 'error');
            return;
        }

        setRatingModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/ratings/client`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientId: selectedClientForRating.id,
                    score: ratingScore,
                    comment: ratingComment
                })
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Client rated successfully!', 'success');
                closeRateClientModal();
                fetchUsers(searchTerm); // Refresh user list to show updated rating
            } else {
                showToast(data.error || 'Failed to submit rating.', 'error');
            }
        } catch (error) {
            console.error('Error submitting client rating:', error);
            showToast('Network error while submitting rating.', 'error');
        } finally {
            setRatingModalLoading(false);
        }
    }, [selectedClientForRating, ratingScore, ratingComment, showToast, logout, closeRateClientModal, fetchUsers, searchTerm]);


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
                    <p>View, search, or initiate chats with platform users. Admins can also rate clients here.</p>

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
                                        <th>Rating</th> {/* NEW: Rating column */}
                                        <th>Joined On</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                {u.user_type === 'client' ? (
                                                    <Link to={`/client-profile/${u.id}`}>{u.full_name}</Link>
                                                ) : u.user_type === 'transcriber' ? (
                                                    <Link to={`/transcriber-profile/${u.id}`}>{u.full_name}</Link>
                                                ) : (
                                                    u.full_name
                                                )}
                                            </td>
                                            <td>{u.email}</td>
                                            <td><span className={`status-badge ${u.user_type}`}>{u.user_type.replace('_', ' ')}</span></td>
                                            <td>
                                                {u.user_type === 'client' ? (
                                                    <div className="rating-display">
                                                        {'★'.repeat(Math.floor(u.client_rating || 0))}
                                                        {'☆'.repeat(5 - Math.floor(u.client_rating || 0))}
                                                        <span className="rating-number">({(u.client_rating || 0).toFixed(1)})</span>
                                                    </div>
                                                ) : u.user_type === 'transcriber' ? (
                                                    <div className="rating-display">
                                                        {'★'.repeat(Math.floor(u.transcribers?.[0]?.average_rating || 0))}
                                                        {'☆'.repeat(5 - Math.floor(u.transcribers?.[0]?.average_rating || 0))}
                                                        <span className="rating-number">({(u.transcribers?.[0]?.average_rating || 0).toFixed(1)})</span>
                                                    </div>
                                                ) : 'N/A'}
                                            </td> {/* NEW: Display Rating */}
                                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    onClick={() => handleChatWithUser(u.id, u.full_name)}
                                                    className="chat-btn"
                                                >
                                                    Chat
                                                </button>
                                                {u.user_type === 'client' && ( // NEW: Rate Client button
                                                    <button
                                                        onClick={() => openRateClientModal(u)}
                                                        className="rate-btn"
                                                        style={{ marginLeft: '10px' }}
                                                    >
                                                        Rate Client
                                                    </button>
                                                )}
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

            {/* NEW: Rate Client Modal */}
            {showRateClientModal && selectedClientForRating && (
                <Modal
                    show={showRateClientModal}
                    title={`Rate ${selectedClientForRating.full_name}`}
                    onClose={closeRateClientModal}
                    onSubmit={submitClientRating}
                    submitText="Submit Rating"
                    loading={ratingModalLoading}
                >
                    <p>How would you rate this client's reliability and cooperation?</p>
                    <div className="form-group">
                        <label htmlFor="ratingScore">Score (1-5 Stars):</label>
                        <select
                            id="ratingScore"
                            name="ratingScore"
                            value={ratingScore}
                            onChange={handleRatingChange}
                            required
                        >
                            <option value="5">5 Stars - Excellent</option>
                            <option value="4">4 Stars - Very Good</option>
                            <option value="3">3 Stars - Good</option>
                            <option value="2">2 Stars - Fair</option>
                            <option value="1">1 Star - Poor</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ratingComment">Comments (Optional):</label>
                        <textarea
                            id="ratingComment"
                            name="ratingComment"
                            value={ratingComment}
                            onChange={handleCommentChange}
                            placeholder="e.g., 'Always pays on time', 'Clear communication.'"
                            rows="3"
                        ></textarea>
                    </div>
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

export default AdminUsers;
