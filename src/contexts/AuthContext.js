// frontend/client/src/contexts/AuthContext.js

import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';

const AuthContext = createContext(null);

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
            currentUser = parsedUser;
            currentIsAuthenticated = true;
            console.log('checkAuth: Found valid user data. User=', parsedUser);
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

  useEffect(() => {
    console.log('AuthContext: Primary useEffect triggered.');
    checkAuth();

    const handleStorageChange = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        console.warn('AuthContext: localStorage change detected for key:', event.key, '-> RE-RUNNING checkAuth');
        // CRITICAL FIX: Always re-run checkAuth on storage change, regardless of mounted status
        checkAuth();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('AuthContext: Primary useEffect cleanup - Component unmounting or dependencies changed.');
      isMounted.current = false; // Set to false for future reference
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkAuth]);

  useEffect(() => {
    console.log('AuthContext: State Change Detected - user:', user?.full_name || 'null', 'isAuthenticated:', isAuthenticated, 'authLoading:', authLoading, 'isAuthReady:', isAuthReady);
  }, [user, isAuthenticated, authLoading, isAuthReady]);


  const login = useCallback((token, userData) => {
    console.groupCollapsed('AuthContext: login triggered (START)');
    console.log('login: Received token and user data for:', userData?.full_name);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    console.log('login: localStorage updated immediately.');

    checkAuth(); // Trigger a re-check to update React state consistently
    console.log('login: Triggered checkAuth to update React state. (END)');
    console.groupEnd();
  }, [checkAuth]);

  const logout = useCallback(() => {
    console.groupCollapsed('AuthContext: logout triggered (START)');
    console.log('logout: Clearing authentication data.');

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('logout: localStorage cleared immediately.');

    checkAuth(); // Trigger a re-check to update React state consistently
    console.log('logout: Triggered checkAuth to update React state. (END)');
    console.groupEnd();
  }, [checkAuth]);

  const authContextValue = {
    user,
    isAuthenticated,
    authLoading,
    isAuthReady,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
