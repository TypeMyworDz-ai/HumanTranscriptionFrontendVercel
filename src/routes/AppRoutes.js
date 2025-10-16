// frontend/client/src/routes/AppRoutes.js - COMPLETE AND UPDATED with ResetPassword Route

import React from 'react';
import { Routes, Route } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';

// Import your existing page components
import LandingPage from '..//LandingPage';
import Login from '..//Login';
import ClientRegister from '..//ClientRegister';
import WorkerRegister from '..//WorkerRegister';
import ClientDashboard from '..//ClientDashboard';
import ClientNegotiations from '..//ClientNegotiations';
import TranscriberDashboard from '..//TranscriberDashboard';
import TranscriberNegotiations from '..//TranscriberNegotiations';
import TranscriberPool from '..//TranscriberPool';
import TranscriberTest from '..//TranscriberTest';
import TranscriberWaiting from '..//TranscriberWaiting';
import AdminDashboard from '..//AdminDashboard';
import AdminTranscriberTests from '..//AdminTranscriberTests.js';
import AdminUsers from '..//AdminUsers.js';
import AdminJobs from '..//AdminJobs';
import AdminDisputes from '..//AdminDisputes';
import AdminSettings from '..//AdminSettings';
import AdminTranscriberTestDetails from '..//AdminTranscriberTestDetails.js';
import AdminChat from '..//AdminChat.js';
import UserChat from '..//UserChat.js';
import AdminMessageList from '..//AdminMessageList.js';

// NEW: Import the ResetPassword component
import ResetPassword from '..//ResetPassword.js';


const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/client-register" element={<ClientRegister />} />
            <Route path="/worker-register" element={<WorkerRegister />} />
            {/* NEW: Public Route for Reset Password */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes (Authenticated Users) */}
            <Route element={<ProtectedRoute />}>

                {/* Client Routes */}
                <Route path="/client-dashboard" element={<ClientDashboard />} />
                <Route path="/client-negotiations" element={<ClientNegotiations />} />
                <Route path="/transcriber-pool" element={<TranscriberPool />} />
                <Route path="/client/chat/:chatId" element={<UserChat />} />


                {/* Transcriber Routes */}
                <Route path="/transcriber-dashboard" element={<TranscriberDashboard />} />
                <Route path="/transcriber-negotiations" element={<TranscriberNegotiations />} />
                <Route path="/transcriber-test" element={<TranscriberTest />} />
                <Route path="/transcriber-waiting" element={<TranscriberWaiting />} />
                <Route path="/transcriber/chat/:chatId" element={<UserChat />} />


                {/* Admin Routes */}
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
                {/* Admin Management Sub-Routes */}
                <Route path="/admin/transcriber-tests" element={<AdminTranscriberTests />} />
                <Route path="/admin/transcriber-tests/:submissionId" element={<AdminTranscriberTestDetails />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/jobs" element={<AdminJobs />} />
                <Route path="/admin/disputes" element={<AdminDisputes />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                {/* Admin Chat Routes */}
                <Route path="/admin/chat" element={<AdminMessageList />} />
                <Route path="/admin/chat/:userId" element={<AdminChat />} />


            </Route>

            {/* Catch-all route for any undefined paths */}
            <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
    );
};

export default AppRoutes;
