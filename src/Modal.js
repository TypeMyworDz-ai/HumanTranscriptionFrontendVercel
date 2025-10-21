import React, { useEffect, useRef } from 'react';
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
    const modalContentRef = useRef(null); // Create a ref for the modal content

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

    // Effect for handling click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            // If the modal is shown and the click is outside of its content
            // We ensure modalContentRef.current exists before checking contains()
            if (show && modalContentRef.current && !modalContentRef.current.contains(event.target)) {
                onClose(); // Close the modal if click is outside its content
            }
        };

        // Attach the event listener when the modal is shown
        if (show) {
            // Using 'mousedown' is often preferred for click-outside as it fires before 'click'
            document.addEventListener('mousedown', handleClickOutside);
        }

        // Clean up the event listener
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [show, onClose]); // Dependencies: show, onClose

    if (!show) {
        return null;
    }

    return (
        // The modal-overlay is the full-screen backdrop
        <div className={`modal-overlay ${show ? 'show' : ''}`}>
            {/* Attach the ref to the modal-content div */}
            <div ref={modalContentRef} className={`modal-content ${type}`}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    {/* FIX: Add e.stopPropagation() to prevent clicks from bubbling up */}
                    <button className="modal-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close modal">
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    {showCancel && (
                        // FIX: Add e.stopPropagation() to prevent clicks from bubbling up
                        <button className="modal-cancel-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} disabled={loading}>
                            Cancel
                        </button>
                    )}
                    {onSubmit && (
                        // FIX: Add e.stopPropagation() to prevent clicks from bubbling up
                        <button
                            type="button"
                            className="modal-submit-btn"
                            onClick={(e) => { e.stopPropagation(); onSubmit(); }}
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
