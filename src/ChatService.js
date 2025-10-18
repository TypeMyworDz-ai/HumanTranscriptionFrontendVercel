import io from 'socket.io-client';

// Use environment variable for backend URL, fallback to localhost:5000
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Initialize Socket.IO client, but don't connect automatically
// We will now pass the userId in the query during connect()
let globalSocketInstance = null; // Initialize as null, will be created in connectSocket

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
  // If globalSocketInstance is not yet created, create it
  if (!globalSocketInstance) {
    globalSocketInstance = io(BACKEND_API_URL, {
      autoConnect: false,
      // Pass userId in the query during the initial handshake
      query: { userId: userId }
    });
  }

  // Update the query parameter if userId has changed or it's a new connection
  if (globalSocketInstance.io.opts.query.userId !== userId) {
    globalSocketInstance.io.opts.query.userId = userId;
  }

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
      // The backend will now automatically join the user to their room based on the query parameter.
      // We no longer need to emit 'joinUserRoom' explicitly from here after connect.
      // The backend server.js 'connection' event handler will handle joining the room.
      console.log(`ChatService: Socket connected for userId: ${activeSocketState.userId}. Room joining handled by backend.`);
    });

    globalSocketInstance.on('disconnect', (reason) => {
      console.log('ChatService: Disconnected from WebSocket server:', reason);
      // Attempt to reconnect if disconnection was server-initiated
      if (reason === 'io server disconnect') {
        globalSocketInstance.connect(); // This will trigger a new connection with the updated userId in query
      }
      activeSocketState.userId = null; // Clear userId on disconnect
    });

    globalSocketInstance.on('reconnect', (attempt) => {
      console.log('ChatService: Reconnected to WebSocket server after attempt:', attempt);
      // No need to emit 'joinUserRoom' explicitly here either, backend handles it.
      console.log(`ChatService: Reconnected for userId: ${activeSocketState.userId}. Room joining handled by backend.`);
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
    console.error('ChatService: Network error sending message via HTTP POST:','', error);
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
  if (globalSocketInstance && globalSocketInstance.connected) { // Check if instance exists before calling connected
    globalSocketInstance.disconnect();
    console.log('ChatService: Socket disconnected.');
  }
  activeSocketState.userId = null; // Clear the active user ID
  globalSocketInstance = null; // Clear the instance on disconnect
};

// Returns the current Socket.IO instance
export const getSocketInstance = () => globalSocketInstance;
