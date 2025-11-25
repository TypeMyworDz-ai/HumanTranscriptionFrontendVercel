// frontend/client/src/contexts/AuthContext.js

import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';

const AuthContext = createContext(null);
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isMounted = useRef(true); // Still useful for general cleanup

  // CRITICAL FIX: Use refs for setters to bypass stale closure/unmounted component issues for checkAuth
  const setUserRef = useRef(setUser);
  const setIsAuthenticatedRef = useRef(setIsAuthenticated);
  const setAuthLoadingRef = useRef(setAuthLoading);
  const setIsAuthReadyRef = useRef(setIsAuthReady);

  // Update refs when setters change (which they won't, but good practice)
  useEffect(() => {
    setUserRef.current = setUser;
    setIsAuthenticatedRef.current = setIsAuthenticated;
    setAuthLoadingRef.current = setAuthLoading;
    setIsAuthReadyRef.current = setIsAuthReady;
  }, [setUser, setIsAuthenticated, setAuthLoading, setIsAuthReady]);


  const checkAuth = useCallback(async () => {
    console.groupCollapsed('AuthContext: checkAuth triggered (START)');
    console.log('Timestamp:', new Date().toLocaleTimeString());
    console.log('checkAuth: isMounted.current (start):', isMounted.current);

    // Always set loading/ready states, even if component might be unmounting,
    // so that dependent components (like ProtectedRoute) get a consistent signal.
    console.log('checkAuth: Setting authLoading=TRUE, isAuthReady=FALSE');
    setAuthLoadingRef.current(true);
    setIsAuthReadyRef.current(false);

    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    console.log('checkAuth: localStorage token found?', !!token);
    console.log('checkAuth: localStorage userData found?', !!userData);

    let currentUser = null;
    let currentIsAuthenticated = false;

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.id && parsedUser.user_type) {
            // CRITICAL FIX: Filter out 'is_available' here as well, if it exists in localStorage
            // Also, ensure the user object in localStorage is kept clean of transient states
            const { is_available, ...userWithoutTransientStates } = parsedUser;
            currentUser = userWithoutTransientStates;
            currentIsAuthenticated = true;
            console.log('checkAuth: Found valid user data. User=', currentUser); // Log the filtered user
        } else {
          console.warn('checkAuth: Invalid user data in localStorage. Clearing.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('checkAuth: Error parsing user data from localStorage:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    // CRITICAL FIX: Use refs to update state.
    // This ensures state is updated even if the component is in a transient unmounted state.
    // For checkAuth, we *must* propagate the result to the context consumers.
    setUserRef.current(currentUser);
    setIsAuthenticatedRef.current(currentIsAuthenticated);
    setAuthLoadingRef.current(false);
    setIsAuthReadyRef.current(true);
    console.log('checkAuth: State updated via refs. isAuthenticated=', currentIsAuthenticated, 'isAuthReady=TRUE (END)');

    console.groupEnd();
  }, []);

  // RENAMED & REFINED: updateUser function to fetch the latest user data from the server
  // This function now also directly updates the context's user state.
  const updateUser = useCallback(async (newUserData = null) => { // Added newUserData parameter
    console.groupCollapsed('AuthContext: updateUser triggered (START)');
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('updateUser: No token found, cannot refresh user data');
      console.groupEnd();
      return;
    }

    let fetchedUser = null;
    if (newUserData) { // If newUserData is provided, use it directly
        console.log('updateUser: Using provided newUserData:', newUserData);
        fetchedUser = newUserData;
    } else { // Otherwise, fetch fresh data from the server
        try {
            console.log('updateUser: Fetching fresh user data from server');
            // Ensure user?.id is available before making the request
            if (!user?.id) {
                console.warn('updateUser: User ID is not available in context. Cannot fetch fresh data.');
                console.groupEnd();
                return;
            }
            const response = await fetch(`${BACKEND_API_URL}/api/users/${user.id}`, { // Use current user ID if available
                method: 'GET',
                headers: {
                'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const userData = await response.json();
            console.log('updateUser: Received fresh user data:', userData);
            fetchedUser = userData.user;
            
        } catch (error) {
            console.error('updateUser: Error fetching user data:', error);
        }
    }

    if (fetchedUser) {
        // CRITICAL FIX: Filter out 'is_available' before setting user state
        // The is_online status will be explicitly managed by setTranscriberOnlineStatusBackend
        const { is_available, ...userWithoutTransientStates } = fetchedUser;
        localStorage.setItem('user', JSON.stringify(userWithoutTransientStates));
        setUserRef.current(userWithoutTransientStates);
        console.log('updateUser: Updated user state with fresh data. New transcriber_status =', userWithoutTransientStates.transcriber_status, 'is_online =', userWithoutTransientStates.is_online);
    } else {
        console.warn('updateUser: No user data available to update.');
    }
    
    console.groupEnd();
  }, [user?.id]); // Dependency on user.id to refetch if the user changes

  // NEW HELPER: Function to call the backend to set transcriber online status
  const callSetTranscriberOnlineStatusBackend = useCallback(async (isOnlineStatus) => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id || user?.user_type !== 'transcriber') {
        console.log(`callSetTranscriberOnlineStatusBackend: Not a transcriber, no token, or no user ID. Skipping status update to backend.`);
        return;
    }

    try {
        console.log(`callSetTranscriberOnlineStatusBackend: Attempting to set transcriber ${user.id} to is_online: ${isOnlineStatus}`);
        const response = await fetch(`${BACKEND_API_URL}/api/transcriber/set-online-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isOnline: isOnlineStatus })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`callSetTranscriberOnlineStatusBackend: Backend responded: ${data.message}`);
            // If the backend forces offline (e.g., due to active job), update frontend user state
            if (data.isOnline !== isOnlineStatus) {
                console.warn(`callSetTranscriberOnlineStatusBackend: Backend set status to ${data.isOnline} (expected ${isOnlineStatus}). Refreshing user data.`);
                await updateUser(); // Force a refresh to get the actual status from DB
            } else {
                // If backend confirms the requested status, update local user state
                setUserRef.current(prevUser => ({ ...prevUser, is_online: data.isOnline }));
            }
        } else {
            console.error(`callSetTranscriberOnlineStatusBackend: Failed to update online status: ${data.error}`);
            // Even if failed, try to update local user state to reflect potential backend change
            await updateUser();
        }
    } catch (error) {
        console.error('callSetTranscriberOnlineStatusBackend: Network error or unexpected error:', error);
    }
  }, [user, updateUser]); // Added updateUser to dependencies


  useEffect(() => {
    console.log('AuthContext: Primary useEffect triggered. Loading initial auth state.');
    checkAuth();

    const handleStorageChange = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        console.warn('AuthContext: localStorage change detected for key:', event.key, '-> RE-RUNNING checkAuth');
        checkAuth();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('AuthContext: Primary useEffect cleanup - Component unmounting or dependencies changed.');
      isMounted.current = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkAuth]);

  useEffect(() => {
    console.log('AuthContext: State Change Detected - user:', user?.full_name || 'null', 'isAuthenticated:', isAuthenticated, 'authLoading:', authLoading, 'isAuthReady:', isAuthReady);
  }, [user, isAuthenticated, authLoading, isAuthReady]);


  const login = useCallback(async (token, userData) => { // Made async to await updateUser
    console.groupCollapsed('AuthContext: login triggered (START)');
    console.log('login: Received token and user data for:', userData?.full_name);

    localStorage.setItem('token', token);
    // CRITICAL FIX: Filter out 'is_available' before storing in localStorage during login
    // The is_online status will be explicitly managed by setTranscriberOnlineStatusBackend
    const { is_available, ...userWithoutTransientStates } = userData;
    localStorage.setItem('user', JSON.stringify(userWithoutTransientStates));
    console.log('login: localStorage updated immediately with filtered user data.');

    await updateUser(userWithoutTransientStates); // Update user state directly with filtered data
    setIsAuthenticatedRef.current(true); // Explicitly set isAuthenticated to true
    setAuthLoadingRef.current(false); // Explicitly set authLoading to false
    setIsAuthReadyRef.current(true); // Explicitly set isAuthReady to true

    // NEW: If the user is a transcriber, explicitly set them online via backend
    if (userWithoutTransientStates.user_type === 'transcriber') {
        await callSetTranscriberOnlineStatusBackend(true);
    }

    console.log('login: User state updated and authentication flags set. (END)');
    console.groupEnd();
  }, [updateUser, callSetTranscriberOnlineStatusBackend]); // Added callSetTranscriberOnlineStatusBackend to dependencies

  const logout = useCallback(async () => { // Made async to await backend call
    console.groupCollapsed('AuthContext: logout triggered (START)');
    console.log('logout: Clearing authentication data. User:', user?.full_name);

    // NEW: If the user was a transcriber, explicitly set them offline via backend
    if (user?.user_type === 'transcriber') {
        await callSetTranscriberOnlineStatusBackend(false);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('logout: localStorage cleared immediately.');

    // CRITICAL FIX: Reset user state and auth flags immediately on logout
    setUserRef.current(null);
    setIsAuthenticatedRef.current(false);
    setAuthLoadingRef.current(false); // Should be false after logout
    setIsAuthReadyRef.current(true); // Should be ready after logout process

    console.log('logout: User state reset and authentication flags set. (END)');
    console.groupEnd();
  }, [user, callSetTranscriberOnlineStatusBackend]); // Added user and callSetTranscriberOnlineStatusBackend to dependency


  const authContextValue = {
    user,
    isAuthenticated,
    authLoading,
    isAuthReady,
    login,
    logout,
    checkAuth,
    updateUser // Expose updateUser (which replaces refreshUserData)
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
