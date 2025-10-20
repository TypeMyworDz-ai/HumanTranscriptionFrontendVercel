// src/Modal.js

import React, { useEffect } from 'react';
import './Modal.css';

const Modal = ({ 
    show, 
    title, 
    children, 
    onClose, 
    onSubmit, 
    submitText = 'Submit', 
    showCancel = true, 
    loading = false,
    type = 'info' // New prop for modal type (info, success, error)
}) => {
    // Use an effect to handle body scroll lock when the modal is open
    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        // Cleanup function to ensure scroll is restored when component unmounts
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [show]);

    // Stops the click event from bubbling up to the modal-overlay
    const handleContentClick = (e) => {
        e.stopPropagation();
    };

    // Handle overlay click, ensuring it only closes if the overlay itself was clicked
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) { // Ensure click was directly on the overlay
            onClose();
        }
    };

    if (!show) {
        return null;
    }

    return (
        // The overlay applies the 'show' class based on the prop for CSS transitions
        <div className={`modal-overlay ${show ? 'show' : ''}`} onClick={handleOverlayClick}>
            {/* The content area uses the handleContentClick to stop closure when clicking inside */}
            <div className={`modal-content ${type}`} onClick={handleContentClick}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    {showCancel && (
                        <button className="modal-cancel-btn" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                    )}
                    {onSubmit && (
                        <button 
                            type="button" 
                            className="modal-submit-btn" 
                            onClick={onSubmit} 
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : submitText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Modal;
