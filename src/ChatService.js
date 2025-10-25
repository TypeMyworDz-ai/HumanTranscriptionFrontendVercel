import io from 'socket.io-client';

// Use environment variable for backend URL, fallback to localhost:5000
const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

let globalSocketInstance = null; // Initialize as null, will be created in connectSocket
let activeSocketState = {
  userId: null,
};

/**
 * Connects to the WebSocket server if not already connected for the given userId.
 * Reuses existing connection if already connected for the same user.
 * If connecting for a different user, it disconnects the old one and establishes a new connection.
 * Sets up listeners only once per socket instance creation.
 * @param {string} userId - The ID of the user to connect for.
 * @returns {SocketIOClient.Socket} The Socket.IO instance.
 */
export const connectSocket = (userId) => {
  // If no instance exists, or if the existing instance is for a different user, create/recreate it
  if (!globalSocketInstance || activeSocketState.userId !== userId) {
    // If an existing instance is connected for a different user, disconnect it first
    if (globalSocketInstance && globalSocketInstance.connected) {
      console.log(`ChatService: Disconnecting old socket for userId: ${activeSocketState.userId || 'unknown'} before connecting new one for userId: ${userId}`);
      globalSocketInstance.disconnect();
    }
    // If an instance exists but is disconnected, and it's for the same user, just connect it.
    // If it's for a different user, it will be recreated.
    if (globalSocketInstance && !globalSocketInstance.connected && activeSocketState.userId === userId) {
        console.log(`ChatService: Reusing existing disconnected socket for userId: ${userId}.`);
        globalSocketInstance.connect(); // Just connect the existing instance
        activeSocketState.userId = userId; // Ensure state is updated
        return globalSocketInstance;
    }


    // Create a new socket instance
    globalSocketInstance = io(BACKEND_API_URL, {
      autoConnect: false, // Do not connect automatically
      query: { userId: userId } // Pass userId in the query during the initial handshake
    });

    // Set up event listeners for this new socket instance
    globalSocketInstance.on('connect', () => {
      console.log('ChatService: Connected to WebSocket server');
      // The backend should automatically join the user to their room based on the query parameter.
      console.log(`ChatService: Socket connected for userId: ${userId}. Room joining handled by backend.`);
    });

    globalSocketInstance.on('disconnect', (reason) => {
      console.log('ChatService: Disconnected from WebSocket server:', reason);
      if (reason === 'io server disconnect') {
        // Attempt to reconnect if server-initiated disconnect
        console.log('ChatService: Server-initiated disconnect, attempting to reconnect...');
        globalSocketInstance.connect(); // This will trigger a new connection with the updated userId in query
      }
      // Note: activeSocketState.userId is not cleared here, as reconnect logic might need it.
      // It's cleared only on explicit disconnectSocket() call.
    });

    globalSocketInstance.on('reconnect', (attempt) => {
      console.log('ChatService: Reconnected to WebSocket server after attempt:', attempt);
      console.log(`ChatService: Reconnected for userId: ${userId}. Room joining handled by backend.`);
    });

    globalSocketInstance.on('messageError', (errorData) => {
      console.error('ChatService: Message error received via WebSocket:', errorData);
    });
  }

  // Update the active user ID regardless, as this is the intended user for this socket
  activeSocketState.userId = userId;

  // Connect the socket if it's not already connected
  if (!globalSocketInstance.connected) {
    console.log(`ChatService: Socket not connected for userId: ${userId}, attempting to connect...`);
    globalSocketInstance.connect();
  } else {
    console.log(`ChatService: Socket already connected for userId: ${userId}. Reusing existing connection.`);
  }

  return globalSocketInstance; // Return the socket instance
};

/**
 * Sends a message (text or file attachment) to the server via HTTP POST.
 * Handles different endpoints based on message type (negotiation vs. direct chat).
 * @param {object} messageData - The message object.
 *   Expected format: { senderId: string, receiverId: string, messageText?: string, negotiationId?: string, directUploadJobId?: string, trainingRoomId?: string, senderUserType?: string, fileUrl?: string, fileName?: string, timestamp: string }
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
    fileUrl: messageData.fileUrl,
    fileName: messageData.fileName,
    timestamp: messageData.timestamp // Include timestamp if provided
  };

  // Determine the correct backend endpoint and payload structure
  if (messageData.negotiationId || messageData.directUploadJobId) { // Handles both negotiation and direct upload jobs
    endpoint = `${BACKEND_API_URL}/api/messages/job/send`; // Use the new generic job message endpoint
    payload = {
      ...payload, // Spread base payload
      receiverId: messageData.receiverId,
      jobId: messageData.negotiationId || messageData.directUploadJobId, // Pass the relevant job ID
    };
  } else if (messageData.trainingRoomId) { // NEW: Handle training room messages
    // Both admin and trainee use the generic send-message endpoints for training room
    // The backend will differentiate based on senderUserType and trainingRoomId
    if (messageData.senderUserType === 'admin') {
      endpoint = `${BACKEND_API_URL}/api/admin/chat/send-message`;
    } else {
      endpoint = `${BACKEND_API_URL}/api/user/chat/send-message`;
    }
    payload = {
      ...payload,
      receiverId: messageData.receiverId,
      trainingRoomId: messageData.trainingRoomId, // NEW: Include trainingRoomId
    };
  }
  else if (messageData.senderUserType === 'admin') { // Direct chat for admin
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
    console.error('ChatService: Network error sending message via HTTP POST:', '', error);
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

/**
 * Disconnects the Socket.IO client.
 */
export const disconnectSocket = () => {
  if (globalSocketInstance && globalSocketInstance.connected) {
    console.log('ChatService: Explicitly disconnecting socket.');
    globalSocketInstance.disconnect();
  }
  // IMPORTANT: Do NOT set globalSocketInstance = null here.
  // We want to retain the instance so connectSocket can reuse it if needed.
  activeSocketState.userId = null; // Only clear the active user ID
};

/**
 * Returns the current Socket.IO instance.
 * @returns {SocketIOClient.Socket | null} The Socket.IO instance or null if not connected.
 */
export const getSocketInstance = () => globalSocketInstance;
