// frontend/client/src/routes/AppRoutes.js - COMPLETE AND UPDATED with Client Payment History, Client Jobs, Profile Routes, and Direct Upload Routes

import React from 'react';
import { Routes, Route } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';

// Import your existing page components
import LandingPage from '../LandingPage';
import Login from '../Login';
import ClientRegister from '../ClientRegister';
import WorkerRegister from '../WorkerRegister'; 
import ClientDashboard from '../ClientDashboard';
import ClientNegotiations from '../ClientNegotiations';
import TranscriberDashboard from '../TranscriberDashboard';
import TranscriberNegotiations from '../TranscriberNegotiations';
import TranscriberPool from '../TranscriberPool';
import TranscriberTest from '../TranscriberTest';
import TranscriberWaiting from '../TranscriberWaiting';
import AdminDashboard from '../AdminDashboard';
import AdminTranscriberTests from '../AdminTranscriberTests.js';
import AdminUsers from '../AdminUsers.js';
import AdminJobs from '../AdminJobs';
import AdminDisputes from '../AdminDisputes';
import AdminSettings from '../AdminSettings';
import AdminTranscriberTestDetails from '../AdminTranscriberTestDetails.js';
import AdminChat from '../AdminChat.js';
import UserChat from '../UserChat.js';
import AdminMessageList from '../AdminMessageList.js';

// NEW: Import the ResetPassword component
import ResetPassword from '../ResetPassword.js';
// NEW: Import Payment-related components
import TranscriberPaymentHistory from '../TranscriberPaymentHistory';
import PaymentCallback from '../PaymentCallback';
// NEW: Import Client-specific components
import ClientPaymentHistory from '../ClientPaymentHistory';
import ClientJobs from '../ClientJobs';
// NEW: Import ClientCompletedJobs
import ClientCompletedJobs from '../ClientCompletedJobs'; 
// REMOVED: Import ClientRateTranscriberPage
// import ClientRateTranscriberPage from '../ClientRateTranscriberPage'; 
// NEW: Import Profile-related components
import ClientProfile from '../ClientProfile';
import TranscriberProfile from '../TranscriberProfile';
// NEW: Import Direct Upload-related components
import ClientDirectUpload from '../ClientDirectUpload'; // CORRECTED PATH
import TranscriberOtherJobs from '../TranscriberOtherJobs'; 
import TranscriberJobs from '../TranscriberJobs'; 

// NEW: Import Admin Oversight components
import AdminPaymentHistory from '../AdminPaymentHistory'; 
import AdminDirectUploadJobs from '../AdminDirectUploadJobs'; 
import AdminJobDetails from '../AdminJobDetails'; 

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
            {/* NEW: Public Route for Paystack Payment Callback */}
            <Route path="/payment-callback" element={<PaymentCallback />} />


            {/* Protected Routes (Authenticated Users) */}
            <Route element={<ProtectedRoute />}>

                {/* Client Routes */}
                <Route path="/client-dashboard" element={<ClientDashboard />} />
                <Route path="/client-negotiations" element={<ClientNegotiations />} />
                <Route path="/transcriber-pool" element={<TranscriberPool />} />
                <Route path="/client/chat/:chatId" element={<UserChat />} />
                <Route path="/client-payments" element={<ClientPaymentHistory />} />
                <Route path="/client-jobs" element={<ClientJobs />} />
                <Route path="/client-completed-jobs" element={<ClientCompletedJobs />} /> 
                {/* REMOVED: Client Rate Transcriber Page Route */}
                {/* <Route path="/client-rate-transcriber/:negotiationId" element={<ClientRateTranscriberPage />} /> */}
                <Route path="/client-profile/:clientId" element={<ClientProfile />} />
                <Route path="/client-direct-upload" element={<ClientDirectUpload />} /> 


                {/* Transcriber Routes */}
                <Route path="/transcriber-dashboard" element={<TranscriberDashboard />} />
                <Route path="/transcriber-negotiations" element={<TranscriberNegotiations />} />
                <Route path="/transcriber-test" element={<TranscriberTest />} />
                <Route path="/transcriber-waiting" element={<TranscriberWaiting />} />
                <Route path="/transcriber/chat/:chatId" element={<UserChat />} />
                <Route path="/transcriber-payments" element={<TranscriberPaymentHistory />} />
                <Route path="/transcriber-profile/:transcriberId" element={<TranscriberProfile />} />
                <Route path="/transcriber-other-jobs" element={<TranscriberOtherJobs />} /> 
                <Route path="/transcriber-jobs" element={<TranscriberJobs />} /> 


                {/* Admin Routes */}
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
                {/* Admin Management Sub-Routes */}
                <Route path="/admin/transcriber-tests" element={<AdminTranscriberTests />} />
                <Route path="/admin/transcriber-tests/:submissionId" element={<AdminTranscriberTestDetails />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/jobs" element={<AdminJobs />} />
                <Route path="/admin/jobs/:jobId" element={<AdminJobDetails />} /> 
                <Route path="/admin/disputes" element={<AdminDisputes />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                {/* Admin Chat Routes */}
                <Route path="/admin/chat" element={<AdminMessageList />} />
                <Route path="/admin/chat/:userId" element={<AdminChat />} />
                {/* NEW: Admin Oversight Routes */}
                <Route path="/admin/payments" element={<AdminPaymentHistory />} /> 
                <Route path="/admin/direct-upload-jobs" element={<AdminDirectUploadJobs />} /> 


            </Route>

            {/* Catch-all route for any undefined paths */}
            <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
    );
};

export default AppRoutes;
