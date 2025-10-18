// frontend/client/src/UserChat.js - UPDATED for robust timestamp handling and consistent formatting

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Toast from './Toast';
import './ClientDashboard.css'; 
import { connectSocket, disconnectSocket, sendMessage, uploadChatAttachment } from './ChatService';

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const MAX_CHAT_FILE_SIZE_MB = 500; 

// Helper function to format timestamp robustly for display
const formatDisplayTimestamp = (isoTimestamp) => {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        if (isNaN(date.getTime())) {
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


const UserChat = () => {
    const { chatId } = useParams();
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });
    const [chatPartner, setChatPartner] = useState(null);

    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null); 
    const audioRef = useRef(null); 

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    useEffect(() => {
        console.log('UserChat: Auth check useEffect. isAuthReady:', isAuthReady, 'user:', user);

        if (!isAuthReady || !user || !user.id || !user.user_type) {
            if (isAuthReady && !user) {
                 console.log("UserChat: Auth ready but no user. Redirecting to login.");
                 navigate('/login');
            }
            return;
        }
    }, [isAuthReady, user, navigate]);


    useEffect(() => {
        let isMounted = true;
        const fetchDetails = async () => {
            if (!isAuthReady || !user || !user.id || !user.user_type) return;

            const token = localStorage.getItem('token');
            if (!token) { logout(); return; }

            console.log('UserChat: Fetching chat partner details for chatId:', chatId);
            try {
                const response = await fetch(`${BACKEND_API_URL}/api/users/${chatId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (isMounted) {
                    if (response.ok && data.user) {
                        setChatPartner(data.user);
                    } else {
                        showToast(data.error || 'Chat partner not found.', 'error');
                        navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard');
                    }
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Error fetching chat partner details:', error);
                    showToast('Network error fetching chat partner details.', 'error');
                    navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard');
                }
            }
        };
        fetchDetails();
        return () => { isMounted = false; };
    }, [isAuthReady, user, chatId, navigate, logout, showToast]);


    const fetchChatHistory = useCallback(async () => {
        if (!user || !chatPartner) {
            console.warn('UserChat: fetchChatHistory called before user or chatPartner are available.');
            setLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log('UserChat: Fetching historical chat messages.');
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/user/chat/messages/${chatId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: msg.sender_id === user.id ? user.full_name : chatPartner.full_name || 'Admin',
                    text: msg.content,
                    // Format timestamp immediately upon fetching
                    timestamp: formatDisplayTimestamp(msg.timestamp), 
                    file_url: msg.file_url, 
                    file_name: msg.file_name 
                }));
                setMessages(formattedMessages);
            } else {
                showToast(data.error || 'Failed to fetch chat messages.', 'error');
            }
        } catch (error) {
            console.error('Error fetching chat messages:', error);
            showToast('Network error fetching chat messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [chatId, logout, showToast, user, chatPartner]);


    const handleNewChatMessage = useCallback((msg) => {
        if (!user || !chatPartner) {
            console.warn('UserChat: handleNewChatMessage called before user or chatPartner are available. Ignoring message.');
            return;
        }

        setMessages((prevMessages) => {
            const currentLoggedInUser = user;
            const currentChatPartner = chatPartner;

            const isRelevant = (msg.sender_id === chatId && msg.receiver_id === currentLoggedInUser.id) ||
                               (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === chatId);

            if (!isRelevant) {
                console.log('UserChat: Received irrelevant message, ignoring. ', msg);
                return prevMessages;
            }

            // Deduplicate: Check if a message with the same ID already exists
            if (prevMessages.some(m => m.id === msg.id)) {
                console.log('UserChat: Received duplicate message, ignoring. ', msg);
                return prevMessages;
            }

            // Check if there's an optimistic message that this server message should replace
            const updatedMessages = prevMessages.map(m =>
                m.isOptimistic && m.sender_id === msg.sender_id && m.content === msg.content &&
                m.receiver_id === msg.receiver_id && (m.file_url === msg.file_url || (!m.file_url && !msg.file_url))
                    ? { ...msg, isOptimistic: false, timestamp: formatDisplayTimestamp(msg.timestamp) } // Replace optimistic with real message, format timestamp
                    : m
            );

            // If no optimistic message was replaced, or if it's a new message entirely
            if (!updatedMessages.some(m => m.id === msg.id && !m.isOptimistic)) {
                if (msg.sender_id !== currentLoggedInUser.id) {
                    playNotificationSound();
                }
                const newMessageObj = {
                    id: msg.id,
                    sender_id: msg.sender_id,
                    receiver_id: msg.receiver_id,
                    content: msg.content,
                    text: msg.content, 
                    // Format timestamp immediately upon receiving
                    timestamp: formatDisplayTimestamp(msg.timestamp), 
                    sender_name: (msg.sender_id === currentLoggedInUser.id) ? currentLoggedInUser.full_name : currentChatPartner?.full_name || 'Admin',
                    file_url: msg.file_url,
                    file_name: msg.file_name
                };
                console.log('UserChat: Adding new message to chat: ', newMessageObj);
                return [...updatedMessages, newMessageObj];
            }
            return updatedMessages; 
        });
    }, [chatId, user, chatPartner, playNotificationSound]);


    useEffect(() => {
        let isMounted = true;

        if (!isAuthReady || !user || !user.id || !user.user_type || !chatPartner) {
            console.log('UserChat: Socket useEffect gated. isAuthReady:', isAuthReady, 'user:', user?.id, 'chatPartner:', chatPartner?.id);
            return;
        }

        console.log('UserChat: Socket useEffect running. Attempting to connect/join.');

        const socket = connectSocket(user.id); 

        const handleSocketConnect = () => {
            if (!isMounted) return;
            console.log('UserChat: Socket connected, joining user room.');
            socket.emit('joinUserRoom', user.id);
            socket.emit('joinUserRoom', chatId); 
            fetchChatHistory(); 
        };

        if (socket.connected) {
            handleSocketConnect();
        } else {
            socket.on('connect', handleSocketConnect);
        }

        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            if (isMounted) {
                console.log('UserChat: Cleaning up socket listeners on unmount.');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect);
                disconnectSocket(); 
            }
        };
    }, [isAuthReady, user, chatPartner, chatId, fetchChatHistory, handleNewChatMessage]);


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
            console.error('UserChat: Attempted to send message before user object is available.');
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
                console.error('UserChat: Error uploading file:', error);
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
                receiver_id: chatId,
                content: messageToSend,
                text: messageToSend, 
                // Format timestamp immediately upon creation for optimistic message
                timestamp: formatDisplayTimestamp(new Date().toISOString()),
                sender_name: user.full_name,
                file_url: fileUrl, 
                file_name: fileName,
                isOptimistic: true, 
            };
            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

            await sendMessage({
                senderId: user.id,
                receiverId: chatId,
                negotiationId: null,
                messageText: messageToSend,
                timestamp: new Date().toISOString(), // Still send ISO string to backend
                senderUserType: user.user_type,
                fileUrl: fileUrl,
                fileName: fileName,
            });

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            console.log('UserChat: Message sent successfully via ChatService.');

        } catch (error) {
            console.error('UserChat: Error sending message:', error);
            showToast(error.message || 'Network error sending message.', 'error');
            if (tempMessageId) {
                setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
            }
        }
    }, [newMessage, selectedFile, user, chatId, showToast]);


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


    if (loading) {
        return (
            <div className="client-dashboard-container">
                <div className="loading-spinner">Loading chat...</div>
            </div>
        );
    }

    if (!chatPartner) {
        return (
            <div className="client-dashboard-container">
                <p className="no-data-message">Chat partner not found.</p>
                <Link to={user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard'} className="back-link">← Back to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="client-dashboard-container">
            <header className="client-dashboard-header">
                <div className="header-content">
                    <h1>Chat with {chatPartner.full_name}</h1>
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'User'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="client-dashboard-main">
                <div className="back-link-container">
                    <Link to={user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard'} className="back-link">← Back to Dashboard</Link>
                </div>

                <div className="dashboard-content">
                    <h2>Conversation with {chatPartner.full_name}</h2>
                    <div className="chat-window">
                        <div className="messages-display">
                            {messages.length === 0 ? (
                                <p className="no-data-message">Start chat by typing a message below!</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.sender_id === user.id ? 'my-message' : 'partner-message'}`}>
                                        <div className="message-header">
                                            <strong>{msg.sender_id === user.id ? 'Me' : chatPartner.full_name}</strong>
                                            <span>
                                                {msg.timestamp} {/* Use the pre-formatted timestamp directly */}
                                            </span> 
                                        </div>
                                        {msg.content && <p>{msg.content}</p>}
                                        {msg.file_url && renderFileAttachment(msg.file_url, msg.file_name)}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="message-input-area">
                            <div className="input-controls">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    placeholder="Type your message..."
                                    rows="3"
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

export default UserChat;
