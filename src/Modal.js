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
            // Log for debugging (can be removed once fixed)
            console.log(`Modal '${title}': Global event listener triggered. Event type: ${event.type}. Target:`, event.target);

            // If the modal is shown and the click is outside of its content
            if (show && modalContentRef.current && !modalContentRef.current.contains(event.target)) {
                console.log(`Modal '${title}': Click detected OUTSIDE modal content. Closing.`);
                onClose();
            } else if (show) {
                console.log(`Modal '${title}': Click detected INSIDE modal content. Not closing.`);
            }
        };

        // Attach the event listener when the modal is shown
        if (show) {
            // Change to 'click' instead of 'mouseup' to require a complete click action
            document.addEventListener('click', handleClickOutside);
            console.log(`Modal '${title}': Click listener attached.`);
        }

        // Clean up the event listener
        return () => {
            document.removeEventListener('click', handleClickOutside);
            console.log(`Modal '${title}': Click listener detached.`);
        };
    }, [show, onClose, title]); // Dependencies: show, onClose (stable ref), title for logging

    if (!show) {
        return null;
    }

    return (
        // The overlay applies the 'show' class based on the prop for CSS transitions
        <div className={`modal-overlay ${show ? 'show' : ''}`}>
            {/* Attach the ref to the modal-content div */}
            <div ref={modalContentRef} className={`modal-content ${type}`}>
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