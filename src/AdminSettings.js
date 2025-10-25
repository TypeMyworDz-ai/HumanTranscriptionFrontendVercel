// frontend/client/src/AdminSettings.js - COMPLETE AND UPDATED with dynamic pricing rules display and USD currency

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Toast from './Toast'; // Import Toast component
import './AdminManagement.css'; // Assuming common admin styles

// Define the backend URL constant for API calls within this component
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const AdminSettings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [settingsId, setSettingsId] = useState(null); // To store the ID of the settings row for updates
    const [pricingRules, setPricingRules] = useState([]); // Array to store dynamic pricing rules
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    // Function to fetch settings from the backend
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.settings) {
                setSettingsId(data.settings.id); // Store the ID
                // Ensure pricing_rules is an array, default to empty if null/undefined
                // Also ensure each rule has special_requirements as an array
                setPricingRules(data.settings.pricing_rules?.map(rule => ({
                    ...rule,
                    special_requirements: rule.special_requirements || [] // Default to empty array
                })) || []); 
                console.log("Fetched Pricing Rules:", data.settings.pricing_rules || []); // Debugging log
            } else {
                showToast(data.error || 'Failed to fetch settings.', 'error');
                setPricingRules([]); // Default to empty array on error
            }
        } catch (error) {
            console.error('Error fetching settings: ', error);
            showToast('Network error fetching settings.', 'error');
            setPricingRules([]); // Default to empty array on error
        } finally {
            setLoading(false);
        }
    }, [logout, showToast]);

    // Function to save settings to the backend
    const saveSettings = useCallback(async (e) => {
        e.preventDefault();
        setSaving(true);
        hideToast();
        const token = localStorage.getItem('token');
        if (!token) {
            logout();
            return;
        }

        try {
            const payload = {
                id: settingsId, // Include ID if updating an existing row
                pricing_rules: pricingRules,
            };

            const response = await fetch(`${BACKEND_API_URL}/api/admin/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok) {
                showToast(data.message || 'Settings saved successfully!', 'success');
                setSettingsId(data.settings.id); // Ensure ID is updated if it was an insert
                fetchSettings(); // CRITICAL FIX: Re-fetch settings to update UI with latest saved data
            } else {
                showToast(data.error || 'Failed to save settings.', 'error');
            }
        } catch (error) {
            console.error('Error saving settings: ', error);
            showToast('Network error saving settings.', 'error');
        } finally {
            setSaving(false);
        }
    }, [settingsId, pricingRules, logout, hideToast, showToast, fetchSettings]); // Added fetchSettings to dependencies

    // Handler for changes within a specific pricing rule
    const handleRuleChange = useCallback((index, field, value) => {
        const updatedRules = [...pricingRules];
        updatedRules[index] = { ...updatedRules[index], [field]: value };
        setPricingRules(updatedRules);
    }, [pricingRules]);

    // Handler for special requirements checkbox changes within a rule
    const handleRuleSpecialRequirementsChange = useCallback((index, value, checked) => {
        const updatedRules = [...pricingRules];
        const currentRequirements = updatedRules[index].special_requirements || [];
        if (checked) {
            updatedRules[index].special_requirements = [...currentRequirements, value];
        } else {
            updatedRules[index].special_requirements = currentRequirements.filter(req => req !== value);
        }
        setPricingRules(updatedRules);
    }, [pricingRules]);

    // Handler to add a new pricing rule
    const addRule = useCallback(() => {
        setPricingRules(prevRules => [
            ...prevRules,
            {
                id: Date.now().toString(), // Simple unique ID for frontend management
                name: '',
                audio_quality: 'standard', // UPDATED: Changed to audio_quality
                deadline_type: 'standard', 
                special_requirements: [], // NEW: Initialize as an empty array
                price_per_minute_usd: 0.00,
                min_duration_minutes: 0, 
                max_duration_minutes: null, 
                is_active: true,
            }
        ]);
    }, []);

    // Handler to remove a pricing rule
    const removeRule = useCallback((idToRemove) => {
        setPricingRules(prevRules => prevRules.filter(rule => rule.id !== idToRemove));
    }, []);


    useEffect(() => {
        // Basic role check (ProtectedRoute already handles main access)
        if (!user || user.user_type !== 'admin') {
            navigate('/admin-dashboard'); // Redirect if not admin
            return;
        }
        fetchSettings();
    }, [user, navigate, fetchSettings]);


    if (loading) {
        return (
            <div className="admin-management-container">
                <div className="loading-spinner">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="admin-management-container">
            <header className="admin-management-header">
                <div className="header-content">
                    <h1>System Settings</h1>
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
                    <h2>Platform Configurations</h2>
                    <p>Adjust core settings for your transcription platform, including dynamic pricing rules.</p>
                    
                    <form onSubmit={saveSettings} className="settings-form">
                        <h3>Dynamic Pricing Rules (USD)</h3>
                        <p>Define different prices per minute based on audio quality, deadline type, and job duration.</p>

                        {/* Display existing rules */}
                        {pricingRules.length === 0 && (
                            <p className="no-data-message">No pricing rules defined yet. Click "Add Rule" to start.</p>
                        )}

                        {pricingRules.map((rule, index) => (
                            <div key={rule.id} className="pricing-rule-card">
                                <h4>Rule: {rule.name || `New Rule ${index + 1}`}</h4>
                                <div className="form-group">
                                    <label>Rule Name:</label>
                                    <input
                                        type="text"
                                        value={rule.name}
                                        onChange={(e) => handleRuleChange(index, 'name', e.target.value)}
                                        placeholder="e.g., Standard Audio, Urgent Deadline"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Audio Quality:</label> {/* UPDATED: Label changed */}
                                    <select
                                        value={rule.audio_quality} // UPDATED: Changed to audio_quality
                                        onChange={(e) => handleRuleChange(index, 'audio_quality', e.target.value)} // UPDATED: Changed to audio_quality
                                    >
                                        <option value="excellent">Excellent</option>
                                        <option value="good">Good</option>
                                        <option value="standard">Standard</option>
                                        <option value="difficult">Difficult</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Deadline Type:</label>
                                    <select
                                        value={rule.deadline_type}
                                        onChange={(e) => handleRuleChange(index, 'deadline_type', e.target.value)}
                                    >
                                        <option value="flexible">Flexible</option>
                                        <option value="standard">Standard</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                {/* NEW: Special Requirements Selection */}
                                <div className="form-group special-requirements-group">
                                    <label>Special Requirements (for this rule):</label>
                                    <div className="checkbox-group">
                                        <label>
                                            <input type="checkbox" name="timestamps" value="timestamps" checked={rule.special_requirements?.includes('timestamps')} onChange={(e) => handleRuleSpecialRequirementsChange(index, 'timestamps', e.target.checked)} />
                                            Timestamps
                                        </label>
                                        <label>
                                            <input type="checkbox" name="full_verbatim" value="full_verbatim" checked={rule.special_requirements?.includes('full_verbatim')} onChange={(e) => handleRuleSpecialRequirementsChange(index, 'full_verbatim', e.target.checked)} />
                                            Full Verbatim
                                        </label>
                                        <label>
                                            <input type="checkbox" name="speaker_identification" value="speaker_identification" checked={rule.special_requirements?.includes('speaker_identification')} onChange={(e) => handleRuleSpecialRequirementsChange(index, 'speaker_identification', e.target.checked)} />
                                            Speaker Identification
                                        </label>
                                        <label>
                                            <input type="checkbox" name="clean_verbatim" value="clean_verbatim" checked={rule.special_requirements?.includes('clean_verbatim')} onChange={(e) => handleRuleSpecialRequirementsChange(index, 'clean_verbatim', e.target.checked)} />
                                            Clean Verbatim
                                        </label>
                                    </div>
                                    <small className="help-text">Select requirements that this pricing rule applies to. Leave unchecked for rules that apply regardless of these options.</small>
                                </div>
                                <div className="form-group">
                                    <label>Price Per Minute (USD):</label>
                                    <input
                                        type="number"
                                        value={rule.price_per_minute_usd}
                                        onChange={(e) => handleRuleChange(index, 'price_per_minute_usd', parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Min Duration (Minutes):</label>
                                    <input
                                        type="number"
                                        value={rule.min_duration_minutes}
                                        onChange={(e) => handleRuleChange(index, 'min_duration_minutes', parseInt(e.target.value, 10) || 0)}
                                        min="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Max Duration (Minutes, optional):</label>
                                    <input
                                        type="number"
                                        value={rule.max_duration_minutes || ''} // Display empty string for null
                                        onChange={(e) => handleRuleChange(index, 'max_duration_minutes', e.target.value ? parseInt(e.target.value, 10) : null)}
                                        min="0"
                                        placeholder="No max"
                                    />
                                </div>
                                <div className="form-group checkbox-group">
                                    <input
                                        id={`rule-active-${rule.id}`}
                                        type="checkbox"
                                        checked={rule.is_active}
                                        onChange={(e) => handleRuleChange(index, 'is_active', e.target.checked)}
                                    />
                                    <label htmlFor={`rule-active-${rule.id}`}>Is Active</label>
                                </div>
                                <button type="button" onClick={() => removeRule(rule.id)} className="remove-rule-btn">
                                    Remove Rule
                                </button>
                            </div>
                        ))}

                        <button type="button" onClick={addRule} className="add-rule-btn">
                            + Add New Pricing Rule
                        </button>
                        
                        <button type="submit" disabled={saving || pricingRules.length === 0} className="save-settings-btn">
                            {saving ? 'Saving...' : 'Save All Settings'}
                        </button>
                    </form>
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

export default AdminSettings;
