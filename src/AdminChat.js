// frontend/client/src/AdminChat.js - COMPLETE AND UPDATED for UI/UX improvements

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './AdminChat.css'; // Ensure this CSS file exists and is correctly linked
import { connectSocket, disconnectSocket, sendMessage, uploadChatAttachment } from './ChatService';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const MAX_CHAT_FILE_SIZE_MB = 500; // Max file size for chat attachments

// Helper function to format timestamp robustly for display
const formatDisplayTimestamp = (isoTimestamp) => {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        if (isNaN(date.getTime())) { // Check if the date is invalid
            console.warn(`Attempted to format invalid date string: ${isoTimestamp}`);
            return 'Invalid Date';
        }
        // Use a consistent format for all displays: date and time
        return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error(`Error formatting timestamp ${isoTimestamp}:`, e);
        return 'Invalid Date';
    }
};

const AdminChat = () => {
    const { userId } = useParams();
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [targetUser, setTargetUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true); // eslint-disable-line no-unused-vars
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });

    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioRef = useRef(null);
    const textareaRef = useRef(null); // Ref for the textarea to manage height

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);

    // Effect for auto-resizing textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [newMessage]); // Rerun when newMessage changes


    useEffect(() => {
        if (isAuthReady && (!user || !user.id || user.user_type !== 'admin')) {
            navigate('/login');
        }
    }, [isAuthReady, user, navigate]);

    useEffect(() => {
        let isMounted = true;
        const fetchDetails = async () => {
            if (!isAuthReady || !user || !user.id || user.user_type !== 'admin') {
                console.warn('AdminChat: Not authorized or user not ready for fetching target user details. Skipping fetchDetails.');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) { logout(); return; }

            console.log(`AdminChat: Attempting to fetch details for target user ID: ${userId}`);
            try {
                const response = await fetch(`${BACKEND_API_URL}/api/admin/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (isMounted) {
                    if (response.ok && data.user) {
                        setTargetUser(data.user);
                        console.log(`AdminChat: Successfully fetched details for user ${userId}.`, data.user);
                    } else {
                        console.error(`AdminChat: Failed to fetch user details for ${userId}. Response not OK or missing user data.`, data);
                        showToast(data.error || 'Failed to fetch user details for chat.', 'error');
                        navigate('/admin/users');
                    }
                }
            } catch (error) {
                if (isMounted) {
                    console.error('AdminChat: Network error fetching target user details:', error);
                    showToast('Network error fetching user details for chat.', 'error');
                    navigate('/admin/users');
                }
            }
        };
        fetchDetails();
        return () => { isMounted = false; };
    }, [isAuthReady, user, userId, navigate, logout, showToast]);


    const fetchChatMessages = useCallback(async () => {
        if (!user || !targetUser) {
            console.warn('AdminChat: fetchChatMessages called before user or targetUser are available.');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log(`AdminChat: Fetching chat messages for admin ${user.id} and user ${targetUser.id}.`);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/chat/messages/${targetUser.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: (msg.sender_id === user.id) ? user.full_name : targetUser.full_name || 'User',
                    text: msg.content,
                    timestamp: formatDisplayTimestamp(msg.timestamp),
                    file_url: msg.file_url,
                    file_name: msg.file_name
                }));
                setMessages(formattedMessages);
                console.log(`AdminChat: Successfully fetched ${formattedMessages.length} messages.`);
            } else {
                console.error('AdminChat: Failed to fetch chat messages. Response not OK or missing messages data.', data);
                showToast(data.error || 'Failed to fetch chat messages.', 'error');
            }
        } catch (error) {
            console.error('AdminChat: Network error fetching chat messages:', error);
            showToast('Network error fetching chat messages.', 'error');
        }
    }, [logout, showToast, user, targetUser]);


    const handleNewChatMessage = useCallback((msg) => {
        if (!user || !targetUser) {
            console.warn('AdminChat: handleNewChatMessage called before user or targetUser are available. Ignoring message.');
            return;
        }

        setMessages((prevMessages) => {
            const currentLoggedInUser = user;

            const isRelevant = (msg.sender_id === userId && msg.receiver_id === currentLoggedInUser.id) ||
                               (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === userId);

            if (!isRelevant) {
                console.log('AdminChat: Received irrelevant message, ignoring. ', msg);
                return prevMessages;
            }

            if (prevMessages.some(m => m.id === msg.id)) {
                console.log('AdminChat: Received duplicate message, ignoring. ', msg);
                return prevMessages;
            }
            const updatedMessages = prevMessages.map(m =>
                m.isOptimistic && m.sender_id === msg.sender_id && m.content === msg.content &&
                m.receiver_id === msg.receiver_id && (m.file_url === msg.file_url || (!m.file_url && !msg.file_url))
                    ? { ...msg, isOptimistic: false, timestamp: formatDisplayTimestamp(msg.timestamp) }
                    : m
            );

            if (!updatedMessages.some(m => m.id === msg.id && !m.isOptimistic)) {
                if (msg.sender_id !== currentLoggedInUser.id) {
                    playNotificationSound();
                }
                const newMessageObj = {
                    id: msg.id,
                    sender_id: msg.sender_id,
                    receiver_id: msg.receiver_id,
                    content: msg.content,
                    timestamp: formatDisplayTimestamp(msg.timestamp),
                    file_url: msg.file_url,
                    file_name: msg.file_name,
                    sender_name: (msg.sender_id === currentLoggedInUser.id) ? currentLoggedInUser.full_name : targetUser?.full_name || 'User',
                };
                console.log('AdminChat: Adding new message to chat: ', newMessageObj);
                return [...updatedMessages, newMessageObj];
            }
            return updatedMessages;
        });
    }, [userId, user, targetUser, playNotificationSound]);


    useEffect(() => {
        let isMounted = true;

        if (!isAuthReady || !user || !user.id || user.user_type !== 'admin' || !targetUser) {
            if (isAuthReady && user && user.user_type === 'admin' && !targetUser) {
                console.log('AdminChat: Waiting for targetUser details before connecting socket and fetching messages.');
            }
            return;
        }

        console.log(`AdminChat: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        const handleSocketConnect = () => {
            if (!isMounted) return;
            socket.emit('joinUserRoom', user.id);
            socket.emit('joinUserRoom', userId);
            console.log(`AdminChat: Socket connected. Joined rooms for ${user.id} and ${userId}. Fetching chat messages.`);
            fetchChatMessages();
        };

        if (!socket.connected) {
            socket.on('connect', handleSocketConnect);
        } else {
            handleSocketConnect();
        }

        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            if (isMounted) {
                console.log('AdminChat: Cleaning up socket listeners on unmount.');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect);
                disconnectSocket();
            }
        };
    }, [isAuthReady, user, targetUser, userId, fetchChatMessages, handleNewChatMessage]);


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleSendMessage = useCallback(async (fileToUpload = null) => {
        const messageToSend = newMessage.trim();
        const file = fileToUpload || selectedFile;

        if (messageToSend === '' && !file) return;

        if (!user) {
            console.error('AdminChat: Attempted to send message before user object is available.');
            showToast('Cannot send message: User not logged in or not loaded.', 'error');
            return;
        }

        let fileUrl = null;
        let fileName = null;
        let tempMessageId;

        if (file) {
            setIsUploadingFile(true);
            try {
                const uploadResponse = await uploadChatAttachment(file, user.id);
                fileUrl = uploadResponse.fileUrl;
                fileName = file.name;
                showToast('File uploaded successfully!', 'success');
            } catch (error) {
                console.error('AdminChat: Error uploading file:', error);
                showToast(`Failed to upload file: ${error.message || 'Network error.'}`, 'error');
                setIsUploadingFile(false);
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            } finally {
                setIsUploadingFile(false);
            }
        }

        try {
            tempMessageId = `temp-${Date.now()}`;
            const optimisticMessage = {
                id: tempMessageId,
                sender_id: user.id,
                receiver_id: userId,
                content: messageToSend,
                timestamp: formatDisplayTimestamp(new Date().toISOString()), // Format optimistic message timestamp
                sender_name: user.full_name,
                file_url: fileUrl ? `${fileUrl}` : null,
                file_name: fileName,
                isOptimistic: true,
            };
            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);


            await sendMessage({
                senderId: user.id,
                receiverId: userId,
                negotiationId: null,
                messageText: messageToSend,
                timestamp: new Date().toISOString(), // Send ISO string to backend
                senderUserType: user.user_type,
                fileUrl: fileUrl,
                fileName: fileName,
            });

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            console.log('AdminChat: Message sent successfully via ChatService.');

        } catch (error) {
            console.error('AdminChat: Error sending message:', error);
            showToast(error.message || 'Network error sending message.', 'error');
            if (tempMessageId) {
                setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
            }
        }
    }, [newMessage, selectedFile, user, userId, showToast]);


    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (file.size > MAX_CHAT_FILE_SIZE_MB * 1024 * 1024) {
            showToast(`File must be smaller than ${MAX_CHAT_FILE_SIZE_MB}MB.`, 'error');
            e.target.value = '';
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        if (newMessage.trim() === '') {
            handleSendMessage(file);
        } else {
            showToast(`File selected: ${file.name}. Click send to attach with your message.`, 'info');
        }
    }, [newMessage, showToast, handleSendMessage]);

    const handleRemoveFile = useCallback(() => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);


    const renderFileAttachment = (fileUrl, fileName) => {
        if (!fileUrl) return null;
        const fullFileUrl = `${BACKEND_API_URL}${fileUrl}`;
        const fileExtension = fileName ? fileName.split('.').pop().toLowerCase() : '';

        if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
            return <p><a href={fullFileUrl} target="_blank" rel="noopener noreferrer"><img src={fullFileUrl} alt={fileName} className="chat-image-attachment" /></a></p>;
        } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
            return <p><a href={fullFileUrl} target="_blank" rel="noopener noreferrer">🎵 {fileName}</a><audio controls src={fullFileUrl} className="chat-audio-attachment"></audio></p>;
        } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
            return <p><a href={fullFileUrl} target="_blank" rel="noopener noreferrer">🎥 {fileName}</a><video controls src={fullFileUrl} className="chat-video-attachment"></video></p>;
        } else {
            return <p><a href={fullFileUrl} target="_blank" rel="noopener noreferrer">📎 {fileName || 'Attached File'}</a></p>;
        }
    };


    return (
        <div className="admin-chat-container">
            <header className="admin-chat-header">
                <div className="header-content">
                    <h1>Chat with {targetUser?.full_name}</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'Admin'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="admin-chat-main">
                <div className="back-link-container">
                    <Link to="/admin/users" className="back-link">← Back to Manage Users</Link>
                </div>

                <div className="admin-content-section">
                    <h2>Conversation with {targetUser?.full_name} ({targetUser?.email})</h2>
                    <div className="chat-window">
                        <div className="messages-display">
                            {messages.length === 0 ? (
                                <p className="no-data-message">Start chat by typing a message below!</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.sender_id === user.id ? 'admin-message' : 'user-message'}`}>
                                        <div className="message-header">
                                            <strong>{msg.sender_id === user.id ? 'Admin' : targetUser?.full_name}</strong>
                                            <span>{formatDisplayTimestamp(msg.timestamp)}</span> {/* Use pre-formatted timestamp */}
                                        </div>
                                        {/* Adjusted message content rendering for block format */}
                                        {msg.content && <p className="message-content-text">{msg.content}</p>}
                                        {msg.file_url && renderFileAttachment(msg.file_url, msg.file_name)}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="message-input-area">
                            <div className="input-controls">
                                <textarea
                                    ref={textareaRef} // Attach ref to textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    placeholder="Type your message..."
                                    rows="1" // Start with 1 row, let CSS handle expandability
                                    disabled={isUploadingFile}
                                ></textarea>
                                <div className="message-actions">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileChange}
                                        accept="audio/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
                                    />
                                    <button
                                        onClick={triggerFileInput}
                                        className="attach-file-btn"
                                        disabled={isUploadingFile}
                                        title="Attach File"
                                    >
                                        📎
                                    </button>
                                    {selectedFile && (
                                        <div className="selected-file-info">
                                            <span>{selectedFile.name}</span>
                                            <button onClick={handleRemoveFile} className="remove-file-btn">✕</button>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleSendMessage()}
                                        className="send-message-btn"
                                        disabled={isUploadingFile || (newMessage.trim() === '' && !selectedFile)}
                                    >
                                        {isUploadingFile ? 'Uploading...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
                duration={toast.type === 'error' ? 4000 : 3000}
            />
            <audio ref={audioRef} src="/audio/notification-sound.mp3" preload="auto" />
        </div>
    );
};

export default AdminChat;
