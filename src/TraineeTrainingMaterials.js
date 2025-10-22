import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config';
import './TraineeTrainingMaterials.css'; // You'll need to create this CSS file

const TraineeTrainingMaterials = () => {
    const { user, isAuthenticated, authLoading, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();

    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ isVisible: true, message, type });
    }, []);

    const hideToast = useCallback(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    }, []);

    // Function to fetch training materials from the backend
    const fetchTrainingMaterials = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token || !user?.id) {
            console.warn("fetchTrainingMaterials: Token missing or user ID unavailable.");
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/trainee/materials`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                setMaterials(data.materials || []);
                if (data.materials?.length === 0) {
                    showToast('No training materials found yet.', 'info');
                }
            } else {
                showToast(data.error || 'Failed to fetch training materials.', 'error');
                console.error('Failed to fetch training materials:', data.error);
            }
        } catch (error) {
            console.error('Network error fetching training materials:', error);
            showToast('Network error while fetching training materials.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user?.id, showToast]);


    useEffect(() => {
        if (!isAuthReady || authLoading || !user || !user.id) {
            if (isAuthReady && !user) {
                console.log("TraineeTrainingMaterials: Auth ready but no user. Redirecting to login.");
                navigate('/login');
            }
            return;
        }

        // Determine if the user is authorized to view materials
        const isAuthorized = (
            (user.user_type === 'trainee' && user.transcriber_status === 'paid_training_fee') ||
            user.user_type === 'transcriber' ||
            user.user_type === 'admin'
        );

        if (!isAuthorized) {
            console.warn(`TraineeTrainingMaterials: Unauthorized access attempt by user_type: ${user.user_type}, status: ${user.transcriber_status}. Redirecting.`);
            // Redirect to home page if not authorized, as they might be authenticated but lack permission
            navigate('/'); 
            showToast('Access denied. You are not authorized to view this content.', 'error');
            return;
        }

        setLoading(true);
        fetchTrainingMaterials();

    }, [isAuthReady, user, authLoading, navigate, fetchTrainingMaterials, showToast]);


    // Determine the back-to-dashboard link dynamically
    const getBackToDashboardLink = () => {
        if (user?.user_type === 'trainee') {
            return '/trainee-dashboard';
        } else if (user?.user_type === 'transcriber') {
            return '/transcriber-dashboard';
        } else if (user?.user_type === 'admin') {
            return '/admin-dashboard';
        }
        return '/'; // Default to home if user type is unknown or not set
    };

    if (loading || authLoading || !isAuthenticated || !user) {
        return (
            <div className="training-materials-container">
                <div className="loading-spinner">Loading Knowledge Base...</div>
            </div>
        );
    }
    
    // Final check for authorization after loading, to handle initial render or quick state changes
    const isAuthorizedForRender = (
        (user.user_type === 'trainee' && user.transcriber_status === 'paid_training_fee') ||
        user.user_type === 'transcriber' ||
        user.user_type === 'admin'
    );

    if (!isAuthorizedForRender) {
        return null; // Don't render anything if unauthorized, as a redirect has already been initiated
    }


    return (
        <div className="training-materials-container">
            <header className="training-materials-header">
                <div className="header-content">
                    <h1>Knowledge Base</h1> {/* Renamed header */}
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="training-materials-main">
                <div className="training-materials-content">
                    <div className="page-header">
                        <div className="header-text">
                            <h2>Essential Resources for Your Work</h2> {/* Updated text */}
                            <p>Access guides, articles, and tools to enhance your transcription skills.</p>
                        </div>
                        <Link to={getBackToDashboardLink()} className="back-to-dashboard-btn">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <div className="materials-grid">
                        {materials.length === 0 ? (
                            <p className="no-materials-message">No materials available yet. Please check back later!</p>
                        ) : (
                            materials.map(material => (
                                <a 
                                    key={material.id} 
                                    href={material.link || '#'} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="material-card"
                                >
                                    <div className="card-icon">📖</div>
                                    <h3>{material.title}</h3>
                                    <p>{material.description}</p>
                                    {material.link && <span className="view-link">View Resource →</span>}
                                    {material.content && <div className="card-content-preview">{material.content.substring(0, 100)}...</div>}
                                </a>
                            ))
                        )}
                    </div>
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

export default TraineeTrainingMaterials;
