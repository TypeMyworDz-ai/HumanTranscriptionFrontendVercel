import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext'; // Assuming AuthContext is used for user authentication
import { BACKEND_API_URL } from './config'; // Assuming config file for backend URL
import './AdminDirectUploadJobs.css'; // We'll create this CSS file next

const AdminDirectUploadJobs = () => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAllDirectUploadJobs = async () => {
            if (!user || user.userType !== 'admin') {
                setError('Access denied. Only admins can view this page.');
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${BACKEND_API_URL}/api/admin/direct-upload-jobs`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming token is stored in localStorage
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch direct upload jobs.');
                }

                const data = await response.json();
                setJobs(data.jobs); // The backend returns an object with a 'jobs' key
            } catch (err) {
                console.error('Error fetching all direct upload jobs:', err);
                setError(err.message || 'Failed to load direct upload jobs.');
            } finally {
                setLoading(false);
            }
        };

        fetchAllDirectUploadJobs();
    }, [user]);

    if (loading) {
        return <div className="admin-direct-upload-jobs-container">Loading direct upload jobs...</div>;
    }

    if (error) {
        return <div className="admin-direct-upload-jobs-container error-message">{error}</div>;
    }

    return (
        <div className="admin-direct-upload-jobs-container">
            <h2>All Direct Upload Jobs (Admin View)</h2>
            {jobs.length === 0 ? (
                <p>No direct upload jobs found.</p>
            ) : (
                <div className="direct-upload-jobs-table-wrapper">
                    <table className="direct-upload-jobs-table">
                        <thead>
                            <tr>
                                <th>Job ID</th>
                                <th>Client Name</th>
                                <th>Transcriber Name</th>
                                <th>File Name</th>
                                <th>Audio Length (min)</th>
                                <th>Quote Amount (KES)</th>
                                <th>Status</th>
                                <th>Created At</th>
                                <th>Taken At</th>
                                <th>Completed At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <tr key={job.id}>
                                    <td>{job.id}</td>
                                    <td>{job.client?.full_name || 'N/A'}</td>
                                    <td>{job.transcriber?.full_name || 'N/A'}</td>
                                    <td>{job.file_name}</td>
                                    <td>{job.audio_length_minutes ? job.audio_length_minutes.toFixed(2) : 'N/A'}</td>
                                    <td>{job.quote_amount ? job.quote_amount.toFixed(2) : 'N/A'}</td>
                                    <td>{job.status}</td>
                                    <td>{new Date(job.created_at).toLocaleDateString()}</td>
                                    <td>{job.taken_at ? new Date(job.taken_at).toLocaleDateString() : 'N/A'}</td>
                                    <td>{job.completed_at ? new Date(job.completed_at).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminDirectUploadJobs;
