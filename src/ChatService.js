import io from 'socket.io-client';

// Use environment variable for backend URL, fallback to localhost:5000
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Initialize Socket.IO client, but don't connect automatically
const globalSocketInstance = io(BACKEND_API_URL, { autoConnect: false });

// State to keep track of the currently connected user ID
let activeSocketState = {
  userId: null,
};

/**
 * Connects to the WebSocket server if not already connected for the given userId.
 * Reuses existing connection if already connected for the same user.
 * Disconnects old connection if connecting for a different user.
 * Sets up listeners only once.
 * @param {string} userId - The ID of the user to connect for.
 * @returns {SocketIOClient.Socket} The Socket.IO instance.
 */
export const connectSocket = (userId) => {
  // Reuse existing connection if already connected for the same user
  if (globalSocketInstance.connected && activeSocketState.userId === userId) {
    console.log(`ChatService: Socket already connected for userId: ${userId}. Reusing existing connection.`);
    return globalSocketInstance;
  }

  // If connected for a different user, disconnect the old one first
  if (globalSocketInstance.connected && activeSocketState.userId !== userId) {
    console.log(`ChatService: Disconnecting old socket for userId: ${activeSocketState.userId || 'unknown'} before connecting new one for userId: ${userId}`);
    globalSocketInstance.disconnect();
  }

  // Update the active user ID
  activeSocketState.userId = userId;

  // Set up event listeners only once to prevent duplicates
  if (!globalSocketInstance._hasListenersSetup) {
    globalSocketInstance.on('connect', () => {
      console.log('ChatService: Connected to WebSocket server');
      // Emit 'joinUserRoom' event once connected if userId is available
      if (activeSocketState.userId) {
        globalSocketInstance.emit('joinUserRoom', activeSocketState.userId);
        console.log(`ChatService: Sent joinUserRoom event for userId: ${activeSocketState.userId}`);
      } else {
        console.warn('ChatService: userId not provided in activeSocketState, cannot join user room.');
      }
    });

    globalSocketInstance.on('disconnect', (reason) => {
      console.log('ChatService: Disconnected from WebSocket server:', reason);
      // Attempt to reconnect if disconnection was server-initiated
      if (reason === 'io server disconnect') {
        globalSocketInstance.connect();
      }
      activeSocketState.userId = null; // Clear userId on disconnect
    });

    globalSocketInstance.on('reconnect', (attempt) => {
      console.log('ChatService: Reconnected to WebSocket server after attempt:', attempt);
      // Re-join room upon successful reconnection
      if (activeSocketState.userId) {
        globalSocketInstance.emit('joinUserRoom', activeSocketState.userId);
      }
    });

    // Handle potential errors received from the server
    globalSocketInstance.on('messageError', (errorData) => {
      console.error('ChatService: Message error received via WebSocket:', errorData);
    });

    globalSocketInstance._hasListenersSetup = true; // Mark listeners as set up
  }

  // Connect the socket if it's not already connected
  if (!globalSocketInstance.connected) {
    console.log('ChatService: Socket not connected, attempting to connect...');
    globalSocketInstance.connect();
  }

  return globalSocketInstance; // Return the socket instance
};

/**
 * Sends a message (text or file attachment) to the server via HTTP POST.
 * Handles different endpoints based on message type (negotiation vs. direct chat).
 * @param {object} messageData - The message object.
 *   Expected format: { senderId: string, receiverId: string, messageText?: string, negotiationId?: string, senderUserType?: string, file_url?: string, file_name?: string, timestamp: string }
 * @returns {Promise<object>} The response data from the server.
 * @throws {Error} If authentication token is missing or network error occurs.
 */
export const sendMessage = async (messageData) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('ChatService: No token found. Cannot send message via HTTP.');
    throw new Error('Authentication token missing.');
  }

  let endpoint = '';
  let payload = { // Base payload structure
    messageText: messageData.messageText,
    file_url: messageData.file_url,
    file_name: messageData.file_name,
    timestamp: messageData.timestamp // Include timestamp if provided
  };

  // Determine the correct backend endpoint and payload structure
  if (messageData.negotiationId) {
    endpoint = `${BACKEND_API_URL}/api/messages/negotiation/send`;
    payload = {
      ...payload, // Spread base payload
      receiverId: messageData.receiverId,
      negotiationId: messageData.negotiationId,
    };
  } else if (messageData.senderUserType === 'admin') {
    endpoint = `${BACKEND_API_URL}/api/admin/chat/send-message`;
    payload = {
      ...payload,
      receiverId: messageData.receiverId,
    };
  } else { // Direct chat for non-admin users
    endpoint = `${BACKEND_API_URL}/api/user/chat/send-message`;
    payload = {
      ...payload,
      receiverId: messageData.receiverId,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Include auth token
      },
      body: JSON.stringify(payload) // Stringify the payload
    });

    const data = await response.json();
    // Handle non-successful HTTP responses
    if (!response.ok) {
      console.error('ChatService: Failed to send message via HTTP:', data.error || 'Unknown error');
      throw new Error(data.error || 'Failed to send message.');
    }
    console.log('ChatService: Message sent successfully via HTTP POST: ', data);
    return data; // Return server response data
  } catch (error) {
    console.error('ChatService: Network error sending message via HTTP POST:', error);
    throw error; // Re-throw error for handling upstream
  }
};

/**
 * Uploads a file attachment to the server for chat.
 * @param {File} file - The file to upload.
 * @returns {Promise<object>} The response data from the server, including file URL and name.
 * @throws {Error} If authentication token is missing or upload fails.
 */
export const uploadChatAttachment = async (file) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('ChatService: No token found. Cannot upload attachment.');
    throw new Error('Authentication token missing.');
  }

  // Prepare FormData to send the file
  const formData = new FormData();
  formData.append('chatAttachment', file); // Append file with the key expected by the backend

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/chat/upload-attachment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}` // Include auth token
      },
      body: formData // Send FormData
    });

    const data = await response.json();
    // Handle non-successful HTTP responses
    if (!response.ok) {
      console.error('ChatService: Failed to upload attachment via HTTP:', data.error || 'Unknown error');
      throw new Error(data.error || 'Failed to upload attachment.');
    }
    console.log('ChatService: Attachment uploaded successfully:', data);
    return data; // Return server response data
  } catch (error) {
    console.error('ChatService: Network error uploading attachment:', error);
    throw error; // Re-throw error for handling upstream
  }
};

// Disconnects the Socket.IO client
export const disconnectSocket = () => {
  if (globalSocketInstance.connected) {
    globalSocketInstance.disconnect();
    console.log('ChatService: Socket disconnected.');
  }
  activeSocketState.userId = null; // Clear the active user ID
};

// Returns the current Socket.IO instance
export const getSocketInstance = () => globalSocketInstance;
