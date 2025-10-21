// frontend/client/src/routes/ProtectedRoute.js

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute component handles authentication and authorization checks.
 * It renders its children only if the user is authenticated AND authorized.
 */
const ProtectedRoute = () => {
    const { isAuthenticated, user, isAuthReady } = useAuth();
    const location = useLocation();

    // 1. Handle initial loading state while the authentication check is running
    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p className="ml-4 text-gray-600">Checking authorization...</p>
            </div>
        );
    }

    // 2. Authentication Check: If not logged in, redirect to login page
    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // 3. Role-based Redirection/Authorization Checks
    // If the user IS authenticated, now check their specific role and status.

    // CRITICAL FIX: Allow Admin to bypass specific role checks and redirect to admin dashboard
    if (user?.user_type === 'admin') {
        // Allow admin users to access '/admin-dashboard' and any path starting with '/admin/'
        // If an admin is trying to access any non-admin specific route, redirect to admin dashboard
        if (!location.pathname.startsWith('/admin')) {
            console.log(`ProtectedRoute: Admin user (${user.full_name}) detected trying to access non-admin route ${location.pathname}. Redirecting to /admin-dashboard.`);
            return <Navigate to="/admin-dashboard" replace />;
        }
        // If they are on an admin-specific path, proceed to render it.
        return <Outlet />; // Admin has full access to the nested routes
    }

    // NEW: Handle Trainee-specific authorization
    if (user?.user_type === 'trainee') {
        const traineeDashboardPath = '/trainee-dashboard';
        const trainingPaymentPath = '/training-payment';

        // Check if trainee has paid for training
        if (user.transcriber_status !== 'paid_training_fee') {
            // If trainee is trying to access anything other than the payment page, redirect to payment
            if (location.pathname !== trainingPaymentPath) {
                console.log(`ProtectedRoute: Trainee user (${user.full_name}) has not paid for training. Redirecting to ${trainingPaymentPath}.`);
                return <Navigate to={trainingPaymentPath} replace />;
            }
            // If they are on the payment path, allow them to proceed.
            return <Outlet />;
        } else {
            // If trainee has paid, but tries to access the payment page again, redirect to dashboard
            if (location.pathname === trainingPaymentPath) {
                console.log(`ProtectedRoute: Trainee user (${user.full_name}) has paid for training. Redirecting from payment page to ${traineeDashboardPath}.`);
                return <Navigate to={traineeDashboardPath} replace />;
            }
            // If they are on any other trainee-specific path (e.g., /trainee-dashboard, /trainee/materials), allow.
            // If they try to access non-trainee routes, redirect to their dashboard.
            if (!location.pathname.startsWith('/trainee')) {
                 console.log(`ProtectedRoute: Trainee user (${user.full_name}) trying to access non-trainee route ${location.pathname}. Redirecting to ${traineeDashboardPath}.`);
                 return <Navigate to={traineeDashboardPath} replace />;
            }
            return <Outlet />; // Trainee has paid and is on a trainee-specific path, allow.
        }
    }


    // For non-admin, non-trainee users (i.e., 'client' or 'transcriber' in assessment phase), apply existing role-specific checks
    const isTranscriber = user?.user_type === 'transcriber';
    // FIX: Use transcriber_status from the user object
    const isPendingTranscriber = user?.transcriber_status === 'pending_assessment'; 

    if (isTranscriber && isPendingTranscriber) {
        const testPath = '/transcriber-test';
        const waitingPath = '/transcriber-waiting';

        // If a pending transcriber is trying to access any protected route
        // other than the test or waiting page, redirect them to the test.
        // The test/waiting pages themselves will decide if they should be there.
        if (location.pathname !== testPath && location.pathname !== waitingPath) {
            console.log(`ProtectedRoute: Pending transcriber (${user.full_name}) detected. Redirecting to ${testPath}.`);
            return <Navigate to={testPath} replace />;
        }
    }

    // 4. If authenticated and passed all authorization checks, render the child routes
    return <Outlet />;
};

export default ProtectedRoute;
