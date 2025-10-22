// frontend/client/src/AdminUsers.js - COMPLETE AND UPDATED for Vercel deployment and Admin Client Rating

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal'; // Import Modal component for rating
import './AdminManagement.css'; // Reusing the admin management CSS

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminUsers = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // UPDATED: State for Generic User Rating Modal
    const [showRateUserModal, setShowRateUserModal] = useState(false);
    const [selectedUserForRating, setSelectedUserForRating] = useState(null);
    const [ratingScore, setRatingScore] = useState(5); // Default to 5 stars
    const [ratingComment, setRatingComment] = useState('');
    const [ratingModalLoading, setRatingModalLoading] = useState(false);

    // NEW: State for Complete Training Modal
    const [showCompleteTrainingModal, setShowCompleteTrainingModal] = useState(false);
    const [selectedTrainee, setSelectedTrainee] = useState(null);
    const [completeTrainingModalLoading, setCompleteTrainingModalLoading] = useState(false);

    // NEW: State for Delete User Modal
    const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
    const [selectedUserForDeletion, setSelectedUserForDeletion] = useState(null);
    const [deleteUserModalLoading, setDeleteUserModalLoading] = useState(false);


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
                // The backend now sends 'average_rating' directly on the user object
                setUsers(data.users); 
                // NEW LOG: Check what data is received by the frontend
                console.log('[AdminUsers.js] Users data received from backend:', data.users.map(u => ({ id: u.id, name: u.full_name, type: u.user_type, rating: u.average_rating })));
            } else {
                // NEW LOG: Log error data if response is not ok
                console.error('[AdminUsers.js] Error data received from backend:', data);
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

    // UPDATED: Generic Rating Modal Handlers
    const openRateUserModal = useCallback((userToRate) => {
        setSelectedUserForRating(userToRate);
        setRatingScore(userToRate.average_rating || 5); // Pre-fill with current rating or default
        setRatingComment(''); // Clear comment
        setShowRateUserModal(true);
    }, []);

    const closeRateUserModal = useCallback(() => {
        setShowRateUserModal(false);
        setSelectedUserForRating(null);
        setRatingModalLoading(false);
    }, []);

    const handleRatingChange = useCallback((e) => {
        setRatingScore(parseInt(e.target.value, 10));
    }, []);

    const handleCommentChange = useCallback((e) => {
        setRatingComment(e.target.value);
    }, []);

    const submitUserRating = useCallback(async () => {
        if (!selectedUserForRating?.id || !selectedUserForRating?.user_type || !ratingScore) {
            showToast('Missing user information or rating score.', 'error');
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
            const response = await fetch(`${BACKEND_API_URL}/api/admin/ratings`, { // UPDATED: New generic admin rating endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ratedUserId: selectedUserForRating.id, // Use generic ratedUserId
                    ratedUserType: selectedUserForRating.user_type, // Send user type
                    score: ratingScore,
                    comment: ratingComment
                })
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || `${selectedUserForRating.user_type} rated successfully!`, 'success');
                closeRateUserModal();
                fetchUsers(searchTerm); // Refresh user list to show updated rating
            } else {
                showToast(data.error || 'Failed to submit rating.', 'error');
            }
        } catch (error) {
            console.error('Error submitting user rating:', error);
            showToast('Network error while submitting rating.', 'error');
        } finally {
            setRatingModalLoading(false);
        }
    }, [selectedUserForRating, ratingScore, ratingComment, showToast, logout, closeRateUserModal, fetchUsers, searchTerm]);

    // NEW: Complete Training Modal Handlers
    const openCompleteTrainingModal = useCallback((traineeToComplete) => {
        setSelectedTrainee(traineeToComplete);
        setShowCompleteTrainingModal(true);
    }, []);

    const closeCompleteTrainingModal = useCallback(() => {
        setShowCompleteTrainingModal(false);
        setSelectedTrainee(null);
        setCompleteTrainingModalLoading(false);
    }, []);

    const submitCompleteTraining = useCallback(async () => {
        if (!selectedTrainee?.id) {
            showToast('No trainee selected for completing training.', 'error');
            return;
        }

        setCompleteTrainingModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/trainee/${selectedTrainee.id}/complete-training`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || `${selectedTrainee.full_name} successfully transitioned to an active transcriber.`, 'success');
                closeCompleteTrainingModal();
                fetchUsers(searchTerm); // Refresh user list to show updated status
            } else {
                showToast(data.error || 'Failed to complete training.', 'error');
            }
        } catch (error) {
            console.error('Error completing training for trainee:', error);
            showToast('Network error while completing training.', 'error');
        } finally {
            setCompleteTrainingModalLoading(false);
        }
    }, [selectedTrainee, showToast, logout, closeCompleteTrainingModal, fetchUsers, searchTerm]);

    // NEW: Delete User Modal Handlers
    const openDeleteUserModal = useCallback((userToDelete) => {
        setSelectedUserForDeletion(userToDelete);
        setShowDeleteUserModal(true);
    }, []);

    const closeDeleteUserModal = useCallback(() => {
        setShowDeleteUserModal(false);
        setSelectedUserForDeletion(null);
        setDeleteUserModalLoading(false);
    }, []);

    const submitDeleteUser = useCallback(async () => {
        if (!selectedUserForDeletion?.id) {
            showToast('No user selected for deletion.', 'error');
            return;
        }

        setDeleteUserModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/users/${selectedUserForDeletion.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || `User '${selectedUserForDeletion.full_name}' deleted successfully!`, 'success');
                closeDeleteUserModal();
                fetchUsers(searchTerm); // Refresh user list
            } else {
                showToast(data.error || 'Failed to delete user.', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('Network error while deleting user.', 'error');
        } finally {
            setDeleteUserModalLoading(false);
        }
    }, [selectedUserForDeletion, showToast, logout, closeDeleteUserModal, fetchUsers, searchTerm]);


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
                    <h2>All Clients, Transcribers & Trainees</h2> {/* UPDATED: Title to include Trainees */}
                    <p>View, search, or initiate chats with platform users. Admins can also rate clients and transcribers, and manage trainee statuses here.</p> {/* UPDATED text */}

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
                                        <th>Status</th> {/* NEW: Status column for trainees */}
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
                                                {/* NEW: Display specific status for trainees */}
                                                {u.user_type === 'trainee' ? (
                                                    <span className={`status-badge ${u.transcriber_status || 'unknown'}`}>{u.transcriber_status?.replace('_', ' ') || 'N/A'}</span>
                                                ) : 'N/A'}
                                            </td>
                                            <td>
                                                {/* UPDATED: Display Rating for both client and transcriber */}
                                                {(u.user_type === 'client' || u.user_type === 'transcriber') && (
                                                    <div className="rating-display">
                                                        {'★'.repeat(Math.floor(u.average_rating || 0))}
                                                        {'☆'.repeat(5 - Math.floor(u.average_rating || 0))}
                                                        <span className="rating-number">({(u.average_rating || 0).toFixed(1)})</span>
                                                    </div>
                                                )}
                                                {/* FIXED: Clarify order of operations for || and && */}
                                                {(u.user_type === 'admin' || u.user_type === 'trainee') && 'N/A'} {/* Trainees don't have a rating yet */}
                                            </td> {/* NEW: Display Rating */}
                                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    onClick={() => handleChatWithUser(u.id, u.full_name)}
                                                    className="chat-btn"
                                                >
                                                    Chat
                                                </button>
                                                {(u.user_type === 'client' || u.user_type === 'transcriber') && ( // NEW: Rate button for both clients and transcribers
                                                    <button
                                                        onClick={(e) => { // Added e.stopPropagation()
                                                            e.stopPropagation();
                                                            openRateUserModal(u);
                                                        }} 
                                                        className="rate-btn"
                                                        style={{ marginLeft: '10px' }}
                                                    >
                                                        Rate {u.user_type === 'client' ? 'Client' : 'Transcriber'}
                                                    </button>
                                                )}
                                                {/* NEW: Complete Training button for trainees */}
                                                {u.user_type === 'trainee' && u.transcriber_status === 'paid_training_fee' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openCompleteTrainingModal(u);
                                                        }}
                                                        className="complete-training-btn"
                                                        style={{ marginLeft: '10px', backgroundColor: '#28a745' }}
                                                    >
                                                        Complete Training
                                                    </button>
                                                )}
                                                {/* NEW: Delete User button */}
                                                {user?.id !== u.id && ( // Prevent admin from deleting themselves
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDeleteUserModal(u);
                                                        }}
                                                        className="delete-btn"
                                                        style={{ marginLeft: '10px', backgroundColor: '#dc3545' }}
                                                    >
                                                        Delete User
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* UPDATED: Generic Rate User Modal */}
            {showRateUserModal && selectedUserForRating && (
                <Modal
                    show={showRateUserModal}
                    title={`Rate ${selectedUserForRating.full_name} (${selectedUserForRating.user_type})`} // Dynamic title
                    onClose={closeRateUserModal}
                    onSubmit={submitUserRating}
                    submitText="Submit Rating"
                    loading={ratingModalLoading}
                >
                    <p>How would you rate this {selectedUserForRating.user_type}'s performance and reliability?</p> {/* Dynamic text */}
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
                            placeholder={`e.g., 'Always pays on time', 'Clear communication.' (for client) or 'Delivered high-quality transcript.' (for transcriber)`}
                            rows="3"
                        ></textarea>
                    </div>
                </Modal>
            )}

            {/* NEW: Complete Training Confirmation Modal */}
            {showCompleteTrainingModal && selectedTrainee && (
                <Modal
                    show={showCompleteTrainingModal}
                    title={`Complete Training for ${selectedTrainee.full_name}?`}
                    onClose={closeCompleteTrainingModal}
                    onSubmit={submitCompleteTraining}
                    submitText="Confirm & Complete Training"
                    loading={completeTrainingModalLoading}
                    submitButtonClass="complete-training-confirm-btn"
                >
                    <p>Are you sure you want to transition **{selectedTrainee.full_name}** from a `trainee` to an `active_transcriber`?</p>
                    <p>This action will update their user type and status, making them eligible for transcription jobs.</p>
                </Modal>
            )}

            {/* NEW: Delete User Confirmation Modal */}
            {showDeleteUserModal && selectedUserForDeletion && (
                <Modal
                    show={showDeleteUserModal}
                    title={`Delete User: ${selectedUserForDeletion.full_name}?`}
                    onClose={closeDeleteUserModal}
                    onSubmit={submitDeleteUser}
                    submitText="Confirm Delete User"
                    loading={deleteUserModalLoading}
                    submitButtonClass="delete-user-confirm-btn"
                >
                    <p>You are about to permanently delete the user **{selectedUserForDeletion.full_name}** ({selectedUserForDeletion.email}).</p>
                    <p>**This action cannot be undone.** All associated data (jobs, messages, tests, ratings, etc.) will also be permanently removed if your database is configured with `ON DELETE CASCADE` foreign key constraints.</p>
                    <p>Are you absolutely sure you want to proceed?</p>
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
