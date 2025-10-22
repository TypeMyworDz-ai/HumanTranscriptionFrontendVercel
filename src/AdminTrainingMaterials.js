// frontend/client/src/AdminTrainingMaterials.js

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Toast from './Toast';
import Modal from './Modal';
import './AdminManagement.css'; // Reusing the admin management CSS

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminTrainingMaterials = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [materials, setMaterials] = useState([]);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    // State for Create/Edit Modal
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentMaterial, setCurrentMaterial] = useState(null);
    const [materialTitle, setMaterialTitle] = useState('');
    const [materialDescription, setMaterialDescription] = useState('');
    const [materialLink, setMaterialLink] = useState('');
    const [materialOrderIndex, setMaterialOrderIndex] = useState(0);
    const [materialModalLoading, setMaterialModalLoading] = useState(false);

    // State for Delete Confirmation Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [materialToDelete, setMaterialToDelete] = useState(null);
    const [deleteModalLoading, setDeleteModalLoading] = useState(false);


    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const fetchMaterials = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/trainee/materials`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                setMaterials(data.materials || []);
            } else {
                console.error('[AdminTrainingMaterials.js] Error data received from backend:', data);
                showToast(data.error || 'Failed to fetch training materials.', 'error');
            }
        } catch (error) {
            console.error('Error fetching training materials:', error);
            showToast('Network error fetching training materials.', 'error');
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    useEffect(() => {
        if (user?.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            showToast('Access denied. Only admins can manage training materials.', 'error');
            return;
        }
        fetchMaterials();
    }, [user, navigate, fetchMaterials, showToast]);

    // --- Create/Edit Material Handlers ---
    const openCreateMaterialModal = useCallback(() => {
        setIsEditing(false);
        setCurrentMaterial(null);
        setMaterialTitle('');
        setMaterialDescription('');
        setMaterialLink('');
        setMaterialOrderIndex(materials.length > 0 ? Math.max(...materials.map(m => m.order_index)) + 1 : 1); // Suggest next order index
        setShowMaterialModal(true);
    }, [materials]);

    const openEditMaterialModal = useCallback((material) => {
        setIsEditing(true);
        setCurrentMaterial(material);
        setMaterialTitle(material.title);
        setMaterialDescription(material.description || '');
        setMaterialLink(material.link);
        setMaterialOrderIndex(material.order_index || 0);
        setShowMaterialModal(true);
    }, []);

    const closeMaterialModal = useCallback(() => {
        setShowMaterialModal(false);
        setMaterialModalLoading(false);
        setCurrentMaterial(null);
    }, []);

    const handleSubmitMaterial = useCallback(async () => {
        if (!materialTitle || !materialLink) {
            showToast('Title and Link are required.', 'error');
            return;
        }

        setMaterialModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        const payload = {
            title: materialTitle,
            description: materialDescription,
            link: materialLink,
            order_index: materialOrderIndex
        };

        try {
            const method = isEditing ? 'PUT' : 'POST';
            const url = isEditing 
                ? `${BACKEND_API_URL}/api/admin/training-materials/${currentMaterial.id}`
                : `${BACKEND_API_URL}/api/admin/training-materials`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message, 'success');
                closeMaterialModal();
                fetchMaterials(); // Refresh materials list
            } else {
                showToast(data.error || `Failed to ${isEditing ? 'update' : 'create'} material.`, 'error');
            }
        } catch (error) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} training material:`, error);
            showToast('Network error.', 'error');
        } finally {
            setMaterialModalLoading(false);
        }
    }, [materialTitle, materialDescription, materialLink, materialOrderIndex, isEditing, currentMaterial, showToast, logout, closeMaterialModal, fetchMaterials]);

    // --- Delete Material Handlers ---
    const openDeleteModal = useCallback((material) => {
        setMaterialToDelete(material);
        setShowDeleteModal(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setShowDeleteModal(false);
        setMaterialToDelete(null);
        setDeleteModalLoading(false);
    }, []);

    const handleDeleteMaterial = useCallback(async () => {
        if (!materialToDelete?.id) {
            showToast('No material selected for deletion.', 'error');
            return;
        }

        setDeleteModalLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Authentication token missing. Please log in again.', 'error');
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/training-materials/${materialToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Training material deleted successfully.', 'success');
                closeDeleteModal();
                fetchMaterials(); // Refresh materials list
            } else {
                showToast(data.error || 'Failed to delete training material.', 'error');
            }
        } catch (error) {
            console.error('Error deleting training material:', error);
            showToast('Network error.', 'error');
        } finally {
            setDeleteModalLoading(false);
        }
    }, [materialToDelete, showToast, logout, closeDeleteModal, fetchMaterials]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading training materials...</div>
            </div>
        );
    }

    // Redirect if not an admin (should ideally be handled by ProtectedRoute but good to have client-side check too)
    if (user?.user_type !== 'admin') {
        return null; 
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>Manage Knowledge Base</h1>
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
                    <h2>Knowledge Base Cards (Training Materials)</h2>
                    <p>Create, edit, or delete training materials that trainees can access.</p>

                    <div className="action-bar" style={{ marginBottom: '20px' }}>
                        <button onClick={openCreateMaterialModal} className="add-new-btn">
                            + Add New Material
                        </button>
                    </div>

                    {materials.length === 0 ? (
                        <p className="no-data-message">No training materials found. Click "Add New Material" to create one.</p>
                    ) : (
                        <div className="materials-list-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Title</th>
                                        <th>Description</th>
                                        <th>Link</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {materials.map(material => (
                                        <tr key={material.id}>
                                            <td>{material.order_index}</td>
                                            <td>{material.title}</td>
                                            <td>{material.description?.substring(0, 70)}{material.description?.length > 70 ? '...' : ''}</td>
                                            <td><a href={material.link} target="_blank" rel="noopener noreferrer">{material.link?.substring(0, 40)}...</a></td>
                                            <td>
                                                <button 
                                                    onClick={() => openEditMaterialModal(material)} 
                                                    className="edit-btn"
                                                    style={{ backgroundColor: '#007bff', color: 'white', marginRight: '10px' }}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => openDeleteModal(material)} 
                                                    className="delete-btn"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Create/Edit Material Modal */}
            {showMaterialModal && (
                <Modal
                    show={showMaterialModal}
                    title={isEditing ? `Edit Material: ${currentMaterial?.title}` : 'Create New Material'}
                    onClose={closeMaterialModal}
                    onSubmit={handleSubmitMaterial}
                    submitText={isEditing ? 'Update Material' : 'Create Material'}
                    loading={materialModalLoading}
                >
                    <div className="form-group">
                        <label htmlFor="materialTitle">Title:</label>
                        <input
                            id="materialTitle"
                            type="text"
                            value={materialTitle}
                            onChange={(e) => setMaterialTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="materialDescription">Description:</label>
                        <textarea
                            id="materialDescription"
                            value={materialDescription}
                            onChange={(e) => setMaterialDescription(e.target.value)}
                            rows="3"
                        ></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="materialLink">Link (URL):</label>
                        <input
                            id="materialLink"
                            type="url"
                            value={materialLink}
                            onChange={(e) => setMaterialLink(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="materialOrderIndex">Order Index:</label>
                        <input
                            id="materialOrderIndex"
                            type="number"
                            value={materialOrderIndex}
                            onChange={(e) => setMaterialOrderIndex(parseInt(e.target.value, 10))}
                            min="0"
                        />
                    </div>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && materialToDelete && (
                <Modal
                    show={showDeleteModal}
                    title={`Delete Material: "${materialToDelete.title}"?`}
                    onClose={closeDeleteModal}
                    onSubmit={handleDeleteMaterial}
                    submitText="Confirm Delete"
                    loading={deleteModalLoading}
                    submitButtonClass="delete-user-confirm-btn" // Reusing delete button style
                >
                    <p>Are you sure you want to permanently delete the training material "**{materialToDelete.title}**"?</p>
                    <p>**This action cannot be undone.**</p>
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

export default AdminTrainingMaterials;
