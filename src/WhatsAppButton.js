// src/WhatsAppButton.js
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext'; // Assuming you use this for user type checks
import './WhatsAppButton.css';

const WhatsAppButton = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth(); // Get user and authentication status

  // Define the paths where the WhatsApp button should be visible
  const allowedPaths = [
    '/', // Landing Page
    '/client-dashboard', // Client Dashboard
    '/transcriber-dashboard' // Transcriber Dashboard
  ];

  // Check if the current path is one of the allowed paths
  const isAllowedPath = allowedPaths.includes(location.pathname);

  // Determine if the button should be shown
  // It should appear on allowedPaths, and if authenticated, only for client/transcriber dashboards
  // If not authenticated, it should only appear on the landing page
  const shouldShowButton = isAllowedPath && (
    (location.pathname === '/' && !isAuthenticated) || // Landing page for unauthenticated users
    (location.pathname === '/client-dashboard' && isAuthenticated && user?.user_type === 'client') ||
    (location.pathname === '/transcriber-dashboard' && isAuthenticated && user?.user_type === 'transcriber')
  );

  if (!shouldShowButton) {
    return null; // Don't render the button if not on an allowed path or conditions not met
  }

  return (
    <a 
      href="https://wa.me/254703443002" 
      className="whatsapp-float" 
      target="_blank" 
      rel="noopener noreferrer" 
      aria-label="Chat on WhatsApp" 
      title="Chat with us on WhatsApp"
    >
      <i className="fab fa-whatsapp whatsapp-icon"></i>
      <span className="whatsapp-text">Chat</span>
    </a>
  );
};

export default WhatsAppButton;
