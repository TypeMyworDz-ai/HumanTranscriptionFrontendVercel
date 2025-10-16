// src/ClientProfile.js

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import './ClientProfile.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const ClientProfile = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const { clientId: profileId } = useParams(); // Get client ID from URL params

    const [profileData, setProfileData] = useState(null);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

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
            // Fetch client's main user data and profile data
            const userResponse = await fetch(`${BACKEND_API_URL}/api/users/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userData = await userResponse.json();

            if (!userResponse.ok || !userData.user) {
                showToast(userData.error || 'Failed to load client profile.', 'error');
                navigate('/client-dashboard'); // Redirect if profile not found
                return;
            }

            // Fetch client's ratings
            const ratingsResponse = await fetch(`${BACKEND_API_URL}/api/ratings/client/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const ratingsData = await ratingsResponse.json();

            if (ratingsResponse.ok) {
                setProfileData({
                    ...userData.user,
                    average_rating: ratingsData.averageRating || 0, // Use the fetched average rating
                });
                setRatings(ratingsData.ratings || []);
            } else {
                showToast(ratingsData.error || 'Failed to load client ratings.', 'error');
                setProfileData(userData.user); // Still show basic profile if ratings fail
            }

        } catch (error) {
            console.error('Network error fetching client profile/ratings:', error);
            showToast('Network error while fetching profile data.', 'error');
            navigate('/client-dashboard');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, navigate, profileId, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user) {
            console.warn("ClientProfile: Unauthorized access. Redirecting.");
            navigate('/login');
            return;
        }

        // Ensure the current user is authorized to view this profile
        // Admins can view any client profile. Clients can view their own.
        if (user.user_type !== 'admin' && user.id !== profileId) {
            showToast('Access denied. You can only view your own profile.', 'error');
            navigate('/client-dashboard');
            return;
        }
        
        fetchClientProfile();
    }, [isAuthenticated, authLoading, user, navigate, profileId, fetchClientProfile, showToast]);


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
                        <h3>Client Information</h3>
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
                            <span>Client Rating:</span>
                            <div className="rating-display">
                                {'★'.repeat(Math.floor(profileData.average_rating || 0))}
                                {'☆'.repeat(5 - Math.floor(profileData.average_rating || 0))}
                                <span className="rating-number">({(profileData.average_rating || 0).toFixed(1)})</span>
                            </div>
                        </div>
                        {/* Add more client-specific details if available */}
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

export default ClientProfile;
