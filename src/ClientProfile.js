// src/ClientProfile.js - UPDATED for Phone Number Reflection Fix and correct Client Rating display

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import { useAuth } from './contexts/AuthContext';
import './ClientProfile.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientProfile = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const { clientId: profileId } = useParams();

    const [profileData, setProfileData] = useState(null);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editFullName, setEditFullName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editModalLoading, setEditModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchClientProfile = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("ClientProfile: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const userResponse = await fetch(`${BACKEND_API_URL}/api/users/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userData = await userResponse.json();

            if (!userResponse.ok || !userData.user) {
                showToast(userData.error || 'Failed to load client profile.', 'error');
                navigate('/client-dashboard');
                return;
            }

            const ratingsResponse = await fetch(`${BACKEND_API_URL}/api/ratings/client/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const ratingsData = await ratingsResponse.json();

            if (ratingsResponse.ok) {
                setProfileData({
                    ...userData.user,
                    // Use the averageRating fetched from the ratings API directly for the profile's main display
                    client_profile: {
                        ...userData.user.client_profile,
                        average_rating: ratingsData.averageRating || 5.0, // Default to 5.0 if no rating
                    }
                });
                setRatings(ratingsData.ratings || []);
                
                // Pre-fill edit states if this is the current user's profile
                if (user?.id === profileId) {
                    setEditFullName(userData.user.full_name || '');
                    // CORRECTED: Access phone from client_profile
                    setEditPhone(userData.user.client_profile?.phone || '');
                }
            } else {
                showToast(ratingsData.error || 'Failed to load client ratings.', 'error');
                // Even if ratings fail, set basic profile data
                setProfileData({
                    ...userData.user,
                    client_profile: {
                        ...userData.user.client_profile,
                        average_rating: 5.0, // Default to 5.0 if ratings cannot be fetched
                    }
                });
            }

        } catch (error) {
            console.error('Network error fetching client profile/ratings:', error);
            showToast('Network error while fetching profile data.', 'error');
            navigate('/client-dashboard');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, navigate, profileId, showToast, user?.id]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user) {
            console.warn("ClientProfile: Unauthorized access. Redirecting.");
            navigate('/login');
            return;
        }

        if (user.user_type !== 'admin' && user.id !== profileId) {
            showToast('Access denied. You can only view your own profile.', 'error');
            navigate('/client-dashboard');
            return;
        }
        
        fetchClientProfile();
    }, [isAuthenticated, authLoading, user, navigate, profileId, fetchClientProfile, showToast]);


    const openEditProfileModal = useCallback(() => {
        if (user?.id === profileId) {
            setShowEditProfileModal(true);
            setEditFullName(profileData.full_name || '');
            // CORRECTED: Access phone from client_profile for pre-fill
            setEditPhone(profileData.client_profile?.phone || '');
        } else {
            showToast('You are not authorized to edit this profile.', 'error');
        }
    }, [user, profileId, profileData, showToast]);

    const closeEditProfileModal = useCallback(() => {
        setShowEditProfileModal(false);
        setEditModalLoading(false);
    }, []);

    const handleEditFormChange = useCallback((e) => {
        const { name, value } = e.target;
        if (name === 'full_name') {
            setEditFullName(value);
        } else if (name === 'phone') {
            setEditPhone(value);
        }
    }, []);

    const submitEditProfile = useCallback(async () => {
        setEditModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/client-profile/${profileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: editFullName,
                    phone: editPhone
                })
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Profile updated successfully!', 'success');
                closeEditProfileModal();
                // After successful update, re-fetch profile data to ensure UI reflects latest changes
                fetchClientProfile(); 
            } else {
                showToast(data.error || 'Failed to update profile.', 'error');
            }
        } catch (error) {
            console.error('Error submitting profile update:', error);
            showToast('Network error while updating profile.', 'error');
        } finally {
            setEditModalLoading(false);
        }
    }, [profileId, editFullName, editPhone, showToast, logout, closeEditProfileModal, fetchClientProfile]); // Removed user?.id from dependencies


    if (authLoading || !isAuthenticated || !user || loading || !profileData) {
        return (
            <div className="client-profile-container">
                <div className="loading-spinner">Loading client profile...</div>
            </div>
        );
    }

    return (
        <div className="client-profile-container">
            <header className="client-profile-header">
                <div className="header-content">
                    <h1>Client Profile</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="client-profile-main">
                <div className="client-profile-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>{profileData.full_name}'s Profile</h2>
                            <p>Details and ratings for this client.</p>
                        </div>
                        <Link to={user.user_type === 'admin' ? '/admin/users' : '/client-dashboard'} className="back-to-dashboard-btn">
                            ← Back to {user.user_type === 'admin' ? 'Manage Users' : 'Dashboard'}
                        </Link>
                    </div>

                    <div className="profile-details-card">
                        <div className="card-header-with-button">
                        <h3>Client Information</h3>
                        {user?.id === profileId && (
                            <button onClick={openEditProfileModal} className="edit-profile-btn">Edit Profile</button>
                        )}
                        </div>

                        <div className="detail-row">
                            <span>Full Name:</span>
                            <strong>{profileData.full_name}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Email:</span>
                            <strong>{profileData.email}</strong>
                        </div>
                        <div className="detail-row">
                            <span>User Type:</span>
                            <strong>{profileData.user_type}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Phone:</span>
                            {/* CORRECTED: Access phone from client_profile */}
                            <strong>{profileData.client_profile?.phone || 'Not provided'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Client Rating:</span>
                            <div className="rating-display">
                                {/* Use profileData.client_profile.average_rating for display */}
                                {'★'.repeat(Math.floor(profileData.client_profile?.average_rating || 0))}
                                {'☆'.repeat(5 - Math.floor(profileData.client_profile?.average_rating || 0))}
                                <span className="rating-number">({(profileData.client_profile?.average_rating || 0).toFixed(1)})</span>
                            </div>
                        </div>
                    </div>

                    <h3>Admin Ratings & Comments ({ratings.length})</h3>
                    {ratings.length === 0 ? (
                        <p className="no-data-message">No ratings available for this client yet.</p>
                    ) : (
                        <div className="ratings-list">
                            {ratings.map((rating) => (
                                <div key={rating.id} className="rating-item">
                                    <div className="rating-score">
                                        {'★'.repeat(Math.floor(rating.score))} ({rating.score.toFixed(1)})
                                    </div>
                                    <p className="rating-comment">{rating.comment || 'No comment provided.'}</p>
                                    <small className="rating-meta">
                                        Rated by {rating.rater_name} on {new Date(rating.created_at).toLocaleDateString()}
                                    </small>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {showEditProfileModal && (
                <Modal
                    show={showEditProfileModal}
                    title="Edit Profile Details"
                    onClose={closeEditProfileModal}
                    onSubmit={submitEditProfile}
                    submitText="Save Changes"
                    loading={editModalLoading}
                >
                    <p>Update your profile information.</p>
                    <div className="form-group">
                        <label htmlFor="full_name">Full Name:</label>
                        <input
                            type="text"
                            id="full_name"
                            name="full_name"
                            value={editFullName}
                            onChange={handleEditFormChange}
                            placeholder="Your Full Name"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">Phone Number (Optional):</label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={editPhone}
                            onChange={handleEditFormChange}
                            placeholder="e.g., 07XXXXXXXX"
                        />
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

export default ClientProfile;
