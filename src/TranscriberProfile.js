// src/TranscriberProfile.js

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import './TranscriberProfile.css'; // You'll need to create this CSS file

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const TranscriberProfile = () => {
    const { user, isAuthenticated, authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const { transcriberId: profileId } = useParams(); // Get transcriber ID from URL params

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
                });
                setRatings(ratingsData.ratings || []);
            } else {
                showToast(ratingsData.error || 'Failed to load transcriber ratings.', 'error');
                setProfileData(userData.user); // Still show basic profile if ratings fail
            }

        } catch (error) {
            console.error('Network error fetching transcriber profile/ratings:', error);
            showToast('Network error while fetching profile data.', 'error');
            navigate('/transcriber-dashboard');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout, navigate, profileId, showToast]);

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user) {
            console.warn("TranscriberProfile: Unauthorized access. Redirecting.");
            navigate('/login');
            return;
        }

        // Ensure the current user is authorized to view this profile
        // Clients can view any transcriber profile. Transcribers can view their own. Admins can view any.
        // For simplicity, allow any authenticated user to view transcriber profiles for browsing.
        // More granular control can be added with RLS on backend.
        
        fetchTranscriberProfile();
    }, [isAuthenticated, authLoading, user, navigate, profileId, fetchTranscriberProfile, showToast]);


    if (authLoading || !isAuthenticated || !user || loading || !profileData) {
        return (
            <div className="transcriber-profile-container">
                <div className="loading-spinner">Loading transcriber profile...</div>
            </div>
        );
    }

    // Safely access nested transcriber profile details
    const transcriberDetails = profileData.transcribers?.[0] || {};

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
                        <h3>Transcriber Information</h3>
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
                            <strong>{transcriberDetails.status || 'N/A'}</strong>
                        </div>
                        <div className="detail-row">
                            <span>User Level:</span>
                            <strong>{transcriberDetails.user_level || 'N/A'}</strong>
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
                            <strong>{transcriberDetails.completed_jobs || 0}</strong>
                        </div>
                        {transcriberDetails.badges && transcriberDetails.badges.length > 0 && (
                            <div className="detail-row">
                                <span>Badges:</span>
                                <div className="badges-list">
                                    {transcriberDetails.badges.split(',').map(badge => (
                                        <span key={badge} className="badge">{badge.replace('_', ' ')}</span>
                                    ))}
                                </div>
                            </div>
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
