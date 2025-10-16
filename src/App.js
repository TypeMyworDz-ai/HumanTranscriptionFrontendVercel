// frontend/client/src/App.js

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom'; // Import Router here
import './App.css'; // Keep your global App styles

// Import the centralized AppRoutes component
import AppRoutes from './routes/AppRoutes';
// Import the AuthProvider from your new contexts folder
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <div className="App">
      {/* IMPORTANT: Router now wraps AuthProvider */}
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
