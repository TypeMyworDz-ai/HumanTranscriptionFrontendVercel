// src/TranscriberProfile.js - UPDATED with Edit Profile functionality for Transcribers

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal'; // NEW: Import Modal component for edit form
import { useAuth } from './contexts/AuthContext';
import './TranscriberProfile.css';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberProfile = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const { transcriberId: profileId } = useParams(); // Get transcriber ID from URL params

    const [profileData, setProfileData] = useState(null);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // NEW: State for Edit Profile Modal
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editMpesaNumber, setEditMpesaNumber] = useState('');
    const [editPaypalEmail, setEditPaypalEmail] = useState('');
    const [editModalLoading, setEditModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    const fetchTranscriberProfile = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (isAuthenticated) {
                console.warn("TranscriberProfile: Token missing despite authenticated state. Forcing logout.");
                logout();
            }
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch transcriber's main user data and profile data
            // Ensure mpesa_number and paypal_email are fetched here
            const userResponse = await fetch(`${BACKEND_API_URL}/api/users/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userData = await userResponse.json();

            if (!userResponse.ok || !userData.user) {
                showToast(userData.error || 'Failed to load transcriber profile.', 'error');
                navigate('/transcriber-dashboard'); // Redirect if profile not found
                return;
            }

            // Fetch transcriber's ratings
            const ratingsResponse = await fetch(`${BACKEND_API_URL}/api/ratings/transcriber/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const ratingsData = await ratingsResponse.json();

            if (ratingsResponse.ok) {
                setProfileData({
                    ...userData.user,
                    average_rating: ratingsData.averageRating || 0, // Use the fetched average rating
                    // FIX: Access these directly from userData.user as per new schema
                    transcriber_status: userData.user.transcriber_status || '',
                    transcriber_user_level: userData.user.transcriber_user_level || '',
                    transcriber_completed_jobs: userData.user.transcriber_completed_jobs || 0,
                    transcriber_mpesa_number: userData.user.transcriber_mpesa_number || '',
                    transcriber_paypal_email: userData.user.transcriber_paypal_email || '',
                    badges: userData.user.badges || '' // Assuming badges is a string field
                });
                setRatings(ratingsData.ratings || []);
                // Pre-fill edit states if this is the current user's profile
                if (user?.id === profileId) {
                    // FIX: Access these directly from userData.user as per new schema
                    setEditMpesaNumber(userData.user.transcriber_mpesa_number || '');
                    setEditPaypalEmail(userData.user.transcriber_paypal_email || '');
                }
            } else {
                showToast(ratingsData.error || 'Failed to load transcriber ratings.', 'error');
                // Still show basic profile if ratings fail
                setProfileData({
                    ...userData.user,
                    // FIX: Access these directly from userData.user as per new schema
                    transcriber_status: userData.user.transcriber_status || '',
                    transcriber_user_level: userData.user.transcriber_user_level || '',
                    transcriber_completed_jobs: userData.user.transcriber_completed_jobs || 0,
                    transcriber_mpesa_number: userData.user.transcriber_mpesa_number || '',
                    transcriber_paypal_email: userData.user.transcriber_paypal_email || '',
                    badges: userData.user.badges || ''
                });
            }

        } catch (error) {
            console.error('Network error fetching transcriber profile/ratings:', error);
            showToast('Network error while fetching profile data.', 'error');
            navigate('/transcriber-dashboard');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, navigate, profileId, showToast, user?.id]); // Added user.id to dependencies


    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user) {
            console.warn("TranscriberProfile: Unauthorized access. Redirecting.");
            navigate('/login');
            return;
        }

        // Only the owner of the profile or an admin can view full details (like payment info)
        // For simplicity, allow any authenticated user to view basic profile for browsing.
        // More granular control can be added with RLS on backend.
        
        fetchTranscriberProfile();
    }, [isAuthenticated, authLoading, user, navigate, profileId, fetchTranscriberProfile, showToast]);


    // NEW: Edit Profile Modal Handlers
    const openEditProfileModal = useCallback(() => {
        // Only allow if current user is the profile owner or an admin
        if (user?.id === profileId || user?.user_type === 'admin') {
            setShowEditProfileModal(true);
            // Pre-fill form fields from current profileData
            // FIX: Access these directly from profileData as per new schema
            setEditMpesaNumber(profileData.transcriber_mpesa_number || '');
            setEditPaypalEmail(profileData.transcriber_paypal_email || '');
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
        if (name === 'mpesa_number') {
            setEditMpesaNumber(value);
        } else if (name === 'paypal_email') {
            setEditPaypalEmail(value);
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
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber-profile/${profileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mpesa_number: editMpesaNumber, // FIX: Send as mpesa_number (backend expects this on transcriber-profile update)
                    paypal_email: editPaypalEmail // FIX: Send as paypal_email (backend expects this on transcriber-profile update)
                })
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Profile updated successfully!', 'success');
                closeEditProfileModal();
                fetchTranscriberProfile(); // Re-fetch profile to show updated details
            } else {
                showToast(data.error || 'Failed to update profile.', 'error');
            }
        } catch (error) {
            console.error('Error submitting profile update:', error);
            showToast('Network error while updating profile.', 'error');
        } finally {
            setEditModalLoading(false);
        }
    }, [profileId, editMpesaNumber, editPaypalEmail, showToast, logout, closeEditProfileModal, fetchTranscriberProfile]);


    if (authLoading || !isAuthenticated || !user || loading || !profileData) {
        return (
            <div className="transcriber-profile-container">
                <div className="loading-spinner">Loading transcriber profile...</div>
            </div>
        );
    }

    // Safely access nested transcriber profile details - now directly from profileData
    // Removed transcriberDetails variable as data is now flat
    
    return (
        <div className="transcriber-profile-container">
            <header className="transcriber-profile-header">
                <div className="header-content">
                    <h1>Transcriber Profile</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="transcriber-profile-main">
                <div className="transcriber-profile-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>{profileData.full_name}'s Profile</h2>
                            <p>Details, ratings, and feedback for this transcriber.</p>
                        </div>
                        <Link to={user.user_type === 'client' ? '/transcriber-pool' : '/transcriber-dashboard'} className="back-to-dashboard-btn">
                            ← Back to {user.user_type === 'client' ? 'Transcriber Pool' : 'Dashboard'}
                        </Link>
                    </div>

                    <div className="profile-details-card">
                        <div className="card-header-with-button"> {/* NEW: For title and edit button */}
                           <h3>Transcriber Information</h3>
                           {(user?.id === profileId || user?.user_type === 'admin') && ( // Only show edit button to owner or admin
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
                            <span>Status:</span>
                            {/* FIX: Access directly from profileData */}
                            <strong>{profileData.transcriber_status || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>User Level:</span>
                            {/* FIX: Access directly from profileData */}
                            <strong>{profileData.transcriber_user_level || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Average Rating:</span>
                            <div className="rating-display">
                                {'★'.repeat(Math.floor(profileData.average_rating || 0))}
                                {'☆'.repeat(5 - Math.floor(profileData.average_rating || 0))}
                                <span className="rating-number">({(profileData.average_rating || 0).toFixed(1)})</span>
                            </div>
                        </div>
                        <div className="detail-row">
                            <span>Completed Jobs:</span>
                            {/* FIX: Access directly from profileData */}
                            <strong>{profileData.transcriber_completed_jobs || 0}</strong>
                        </div>
                        {profileData.badges && profileData.badges.length > 0 && ( // FIX: Access directly from profileData
                            <div className="detail-row">
                                <span>Badges:</span>
                                <div className="badges-list">
                                    {profileData.badges.split(',').map(badge => ( // FIX: Access directly from profileData
                                        <span key={badge} className="badge">{badge.replace('_', ' ')}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* NEW: Display Payment Details (only to owner or admin) */}
                        {(user?.id === profileId || user?.user_type === 'admin') && (
                            <>
                                <div className="detail-row">
                                    <span>Mpesa Number:</span>
                                    {/* FIX: Access directly from profileData */}
                                    <strong>{profileData.transcriber_mpesa_number || 'Not provided'}</strong>
                                </div>
                                <div className="detail-row">
                                    <span>PayPal Email:</span>
                                    {/* FIX: Access directly from profileData */}
                                    <strong>{profileData.transcriber_paypal_email || 'Not provided'}</strong>
                                </div>
                            </>
                        )}
                    </div>

                    <h3>Client Reviews ({ratings.length})</h3>
                    {ratings.length === 0 ? (
                        <p className="no-data-message">No reviews available for this transcriber yet.</p>
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

            {/* NEW: Edit Profile Modal */}
            {showEditProfileModal && (
                <Modal
                    show={showEditProfileModal}
                    title="Edit Payment Details"
                    onClose={closeEditProfileModal}
                    onSubmit={submitEditProfile}
                    submitText="Save Changes"
                    loading={editModalLoading}
                >
                    <p>Update your Mpesa number and/or PayPal email for receiving payments.</p>
                    <div className="form-group">
                        <label htmlFor="mpesa_number">Mpesa Number (Optional):</label>
                        <input
                            type="text"
                            id="mpesa_number"
                            name="mpesa_number"
                            value={editMpesaNumber}
                            onChange={handleEditFormChange}
                            placeholder="e.g., 07XXXXXXXX"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="paypal_email">PayPal Email (Optional):</label>
                        <input
                            type="email"
                            id="paypal_email"
                            name="paypal_email"
                            value={editPaypalEmail}
                            onChange={handleEditFormChange}
                            placeholder="e.g., your.email@example.com"
                        />
                    </div>
                </Modal>
            )}

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

export default TranscriberProfile;
