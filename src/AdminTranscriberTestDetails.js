// frontend/client/src/AdminTranscriberTestDetails.js

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminManagement.css'; // Assuming common admin styling

// Helper function to convert simple markdown to HTML (bold and italics)
const formatTranscriptionText = (text) => {
    if (!text) return '';
    // Replace **bold** with <strong>bold</strong>
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace *italic* with <em>italic</em>
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Convert newlines to <br> for proper display in HTML
    formattedText = formattedText.replace(/\n/g, '<br />');
    return formattedText;
};


const AdminTranscriberTestDetails = () => {
    const { submissionId } = useParams();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [submissionDetails, setSubmissionDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchSubmissionDetails = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout(); // Should be caught by ProtectedRoute, but defensive
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/admin/transcriber-tests/${submissionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setSubmissionDetails(data.submission);
            } else {
                showToast(data.error || 'Failed to fetch submission details.', 'error');
                // Optionally redirect back to the list if details can't be fetched
                navigate('/admin/transcriber-tests');
            }
        } catch (error) {
            console.error('Error fetching submission details:', error);
            showToast('Network error fetching submission details.', 'error');
            navigate('/admin/transcriber-tests');
        } finally {
            setLoading(false);
        }
    }, [submissionId, logout, navigate, showToast]);

    useEffect(() => {
        // Ensure user is admin before fetching details, though ProtectedRoute should handle this
        if (!user || user.user_type !== 'admin') {
            navigate('/login'); // Redirect if not admin
            return;
        }
        fetchSubmissionDetails();
    }, [user, fetchSubmissionDetails, navigate]);

    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading submission details...</div>
            </div>
        );
    }

    if (!submissionDetails) {
        return (
            <div className="admin-management-container">
                <p className="no-data-message">Submission details not found.</p>
                <Link to="/admin/transcriber-tests" className="back-link">← Back to Submissions</Link>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Transcriber Test Details</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-management-main">
                <div className="back-link-container">
                    <Link to="/admin/transcriber-tests" className="back-link">← Back to Submissions</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Submission for {submissionDetails.users?.full_name || 'Unknown User'}</h2>
                    <p><strong>Email:</strong> {submissionDetails.users?.email}</p>
                    <p><strong>Grammar Score:</strong> {submissionDetails.grammar_score.toFixed(2)}%</p>
                    <p><strong>Status:</strong> <span className={`status-badge ${submissionDetails.status}`}>{submissionDetails.status.replace('_', ' ')}</span></p>
                    <p><strong>Submitted On:</strong> {new Date(submissionDetails.created_at).toLocaleString()}</p>
                    {submissionDetails.status === 'rejected' && submissionDetails.rejection_reason && (
                        <p><strong>Rejection Reason:</strong> {submissionDetails.rejection_reason}</p>
                    )}

                    <h3>Transcription Text:</h3>
                    <div className="transcription-display">
                        {/* Render formatted text using dangerouslySetInnerHTML */}
                        <div dangerouslySetInnerHTML={{ __html: formatTranscriptionText(submissionDetails.transcription_text) }} />
                    </div>

                    {/* Add Approve/Reject buttons here if you want to manage from this page too */}
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

export default AdminTranscriberTestDetails;
