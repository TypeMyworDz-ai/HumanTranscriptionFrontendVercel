// src/ChatService.js - COMPLETE AND UPDATED for Vercel deployment

import io from 'socket.io-client';

// IMPORTANT: This URL will now come from a Vercel environment variable
// During local development, it will fall back to localhost
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Define the Socket.IO client instance globally but do not autoConnect
const globalSocketInstance = io(BACKEND_API_URL, { autoConnect: false });

// Use an object to store the userId associated with the global socket instance
let activeSocketState = {
  userId: null,
};

/**
 * Establishes a WebSocket connection to the server.
 * This function now returns the globalSocketInstance directly.
 * @param {string} userId - The ID of the currently logged-in user.
 * @returns {SocketIOClient.Socket} The connected socket instance.
 */
export const connectSocket = (userId) => {
  // If the global socket is already connected for this user, reuse it.
  if (globalSocketInstance.connected && activeSocketState.userId === userId) {
    console.log(`ChatService: Socket already connected for userId: ${userId}. Reusing existing connection.`);
    return globalSocketInstance;
  }

  // If connected for a different user or disconnected, clean up previous state.
  if (globalSocketInstance.connected && activeSocketState.userId !== userId) {
    console.log(`ChatService: Disconnecting old socket for userId: ${activeSocketState.userId || 'unknown'} before connecting new one for userId: ${userId}`);
    globalSocketInstance.disconnect(); // Disconnect the old connection
  }

  // Update activeSocketState with the new userId
  activeSocketState.userId = userId;

  // Set up event listeners only once to prevent duplicates
  if (!globalSocketInstance._hasListenersSetup) {
    globalSocketInstance.on('connect', () => {
      console.log('ChatService: Connected to WebSocket server');
      if (activeSocketState.userId) {
        globalSocketInstance.emit('joinUserRoom', activeSocketState.userId); // Event name 'joinUserRoom'
        console.log(`ChatService: Sent joinUserRoom event for userId: ${activeSocketState.userId}`);
      } else {
        console.warn('ChatService: userId not provided in activeSocketState, cannot join user room.');
      }
    });

    globalSocketInstance.on('disconnect', (reason) => {
      console.log('ChatService: Disconnected from WebSocket server:', reason);
      if (reason === 'io server disconnect') {
        globalSocketInstance.connect(); // Attempt to reconnect if server-initiated disconnect
      }
      activeSocketState.userId = null; // Clear userId on disconnect
    });

    globalSocketInstance.on('reconnect', (attempt) => {
      console.log('ChatService: Reconnected to WebSocket server after attempt: ', attempt);
      if (activeSocketState.userId) { // Re-join room on reconnect
        globalSocketInstance.emit('joinUserRoom', activeSocketState.userId); // Event name 'joinUserRoom'
      }
    });

    globalSocketInstance.on('messageError', (errorData) => {
      console.error('ChatService: Message error received via WebSocket:', errorData);
      // Placeholder for toast notification integration
    });

    globalSocketInstance._hasListenersSetup = true;
  }

  // If not connected, attempt to connect
  if (!globalSocketInstance.connected) {
    console.log('ChatService: Socket not connected, attempting to connect...');
    globalSocketInstance.connect();
  }

  return globalSocketInstance;
};

/**
 * Sends a message to the server via HTTP POST.
 * Dynamically chooses between negotiation-specific, user direct, or admin direct message endpoints.
 * @param {object} messageData - The message object.
 *   Expected format: { senderId: string, receiverId: string, messageText: string, negotiationId: string (optional), senderUserType: string (optional) }
 */
export const sendMessage = async (messageData) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('ChatService: No token found. Cannot send message via HTTP.');
    throw new Error('Authentication token missing.');
  }

  let endpoint = '';
  let payload = {};

  if (messageData.negotiationId) {
    // Use the negotiation-specific endpoint if negotiationId is provided
    endpoint = `${BACKEND_API_URL}/api/messages/negotiation/send`;
    payload = {
      senderId: messageData.senderId,
      receiverId: messageData.receiverId,
      negotiationId: messageData.negotiationId,
      messageText: messageData.messageText,
      timestamp: messageData.timestamp
    };
  } else if (messageData.senderUserType === 'admin') { // FIXED: Check for admin user type for direct messages
    // Use the dedicated admin direct message endpoint
    endpoint = `${BACKEND_API_URL}/api/admin/chat/send-message`; // ASSUMED ADMIN DIRECT MESSAGE ROUTE
    payload = {
      receiverId: messageData.receiverId,
      messageText: messageData.messageText,
      timestamp: messageData.timestamp
    };
    // senderId is typically inferred from the token for admin messages
  }
  else {
    // Use the general user direct message endpoint if no negotiationId and not an admin
    endpoint = `${BACKEND_API_URL}/api/user/chat/send-message`;
    payload = {
      receiverId: messageData.receiverId,
      messageText: messageData.messageText,
      timestamp: messageData.timestamp
    };
    // senderId is typically inferred from the token for direct messages
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('ChatService: Failed to send message via HTTP:', data.error || 'Unknown error');
      throw new Error(data.error || 'Failed to send message.');
    }
    console.log('ChatService: Message sent successfully via HTTP POST: ', data);
    return data;
  } catch (error) {
    console.error('ChatService: Network error sending message via HTTP POST:', error);
    throw error;
  }
};

/**
 * Disconnects the WebSocket connection.
 */
export const disconnectSocket = () => {
  if (globalSocketInstance.connected) {
    globalSocketInstance.disconnect();
    console.log('ChatService: Socket disconnected.');
  }
  activeSocketState.userId = null; // Clear userId
};

// Export the global socket instance directly for components to attach/detach listeners
export const getSocketInstance = () => globalSocketInstance;
