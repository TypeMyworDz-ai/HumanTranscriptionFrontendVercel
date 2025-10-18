import io from 'socket.io-client';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const globalSocketInstance = io(BACKEND_API_URL, { autoConnect: false });

let activeSocketState = {
  userId: null,
};

export const connectSocket = (userId) => {
  if (globalSocketInstance.connected && activeSocketState.userId === userId) {
    console.log(`ChatService: Socket already connected for userId: ${userId}. Reusing existing connection.`);
    return globalSocketInstance;
  }

  if (globalSocketInstance.connected && activeSocketState.userId !== userId) {
    console.log(`ChatService: Disconnecting old socket for userId: ${activeSocketState.userId || 'unknown'} before connecting new one for userId: ${userId}`);
    globalSocketInstance.disconnect();
  }

  activeSocketState.userId = userId;

  if (!globalSocketInstance._hasListenersSetup) {
    globalSocketInstance.on('connect', () => {
      console.log('ChatService: Connected to WebSocket server');
      if (activeSocketState.userId) {
        globalSocketInstance.emit('joinUserRoom', activeSocketState.userId); // CORRECTED: Removed '='
        console.log(`ChatService: Sent joinUserRoom event for userId: ${activeSocketState.userId}`);
      } else {
        console.warn('ChatService: userId not provided in activeSocketState, cannot join user room.');
      }
    });

    globalSocketInstance.on('disconnect', (reason) => {
      console.log('ChatService: Disconnected from WebSocket server:', reason);
      if (reason === 'io server disconnect') {
        globalSocketInstance.connect();
      }
      activeSocketState.userId = null;
    });

    globalSocketInstance.on('reconnect', (attempt) => { // CORRECTED: Removed '='
      console.log('ChatService: Reconnected to WebSocket server after attempt: ', attempt);
      if (activeSocketState.userId) {
        globalSocketInstance.emit('joinUserRoom', activeSocketState.userId); // CORRECTED: Removed '='
      }
    });

    globalSocketInstance.on('messageError', (errorData) => { // CORRECTED: Removed '='
      console.error('ChatService: Message error received via WebSocket:', errorData);
    });

    globalSocketInstance._hasListenersSetup = true;
  }

  if (!globalSocketInstance.connected) {
    console.log('ChatService: Socket not connected, attempting to connect...');
    globalSocketInstance.connect();
  }

  return globalSocketInstance;
};

/**
 * Sends a message (text or file_url) to the server via HTTP POST.
 * @param {object} messageData - The message object.
 *   Expected format: { senderId: string, receiverId: string, messageText: string (optional), negotiationId: string (optional), senderUserType: string (optional), file_url: string (optional), file_name: string (optional) }
 */
export const sendMessage = async (messageData) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('ChatService: No token found. Cannot send message via HTTP.');
    throw new Error('Authentication token missing.');
  }

  let endpoint = '';
  let payload = {
    messageText: messageData.messageText,
    file_url: messageData.file_url,
    file_name: messageData.file_name
  };

  if (messageData.negotiationId) {
    endpoint = `${BACKEND_API_URL}/api/messages/negotiation/send`;
    payload = {
      ...payload,
      receiverId: messageData.receiverId,
      negotiationId: messageData.negotiationId,
      timestamp: messageData.timestamp
    };
  } else if (messageData.senderUserType === 'admin') {
    endpoint = `${BACKEND_API_URL}/api/admin/chat/send-message`;
    payload = {
      ...payload,
      receiverId: messageData.receiverId,
      timestamp: messageData.timestamp
    };
  } else {
    endpoint = `${BACKEND_API_URL}/api/user/chat/send-message`;
    payload = {
      ...payload,
      receiverId: messageData.receiverId,
      timestamp: messageData.timestamp
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // CORRECTED: Removed '='
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
 * Uploads a file attachment to the server for chat.
 * @param {File} file - The file to upload.
 * @returns {Promise<object>} The response data from the server, including the file URL and name.
 */
export const uploadChatAttachment = async (file) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('ChatService: No token found. Cannot upload attachment.');
    throw new Error('Authentication token missing.');
  }

  const formData = new FormData();
  formData.append('chatAttachment', file); // 'chatAttachment' is the field name expected by multer

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/chat/upload-attachment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData // Browser sets 'Content-Type: multipart/form-data' automatically
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('ChatService: Failed to upload attachment via HTTP:', data.error || 'Unknown error');
      throw new Error(data.error || 'Failed to upload attachment.');
    }
    console.log('ChatService: Attachment uploaded successfully:', data);
    return data;
  } catch (error) {
    console.error('ChatService: Network error uploading attachment:', error);
    throw error;
  }
};


export const disconnectSocket = () => {
  if (globalSocketInstance.connected) {
    globalSocketInstance.disconnect();
    console.log('ChatService: Socket disconnected.');
  }
  activeSocketState.userId = null;
};

export const getSocketInstance = () => globalSocketInstance;
