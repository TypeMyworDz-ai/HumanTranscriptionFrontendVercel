// frontend/client/src/UserChat.js - UPDATED for robust timestamp handling and consistent formatting

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'; // NEW: Import useLocation
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
    // UPDATED: Destructure jobId directly if it's a direct-upload chat
    const { chatId, jobId: paramJobId } = useParams(); // Rename jobId to paramJobId to avoid conflict
    const location = useLocation(); // NEW: Use useLocation to determine chat type
    const { user, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });
    const [chatPartner, setChatPartner] = useState(null);
    const [jobDetails, setJobDetails] = useState(null); // NEW: State for job details if it's a job chat

    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null); 
    const audioRef = useRef(null); 

    // NEW: Determine if it's a job-specific chat
    const isJobChat = location.pathname.includes('/chat/direct-upload/');
    // UPDATED: currentChatIdentifier is now paramJobId if it's a job chat
    const currentChatIdentifier = isJobChat ? paramJobId : chatId; // This will be the ID for fetching messages

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


    // UPDATED: Fetch chat partner details OR job details
    useEffect(() => {
        let isMounted = true;
        const fetchDetails = async () => {
            // Ensure currentChatIdentifier is available for fetching details
            if (!isAuthReady || !user || !user.id || !user.user_type || !currentChatIdentifier) {
                console.warn('UserChat: Gated fetchDetails: Missing auth, user, or currentChatIdentifier. currentChatIdentifier:', currentChatIdentifier);
                if (isAuthReady && user) { // If authenticated but no identifier, it's an invalid chat URL
                    showToast('Invalid chat URL. Please go back.ᐟ', 'error');
                    navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard');
                }
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) { logout(); return; }

            console.log('UserChat: Fetching details for chat identifier:', currentChatIdentifier, 'isJobChat:', isJobChat);
            try {
                let response;
                let data;

                if (isJobChat) {
                    // UPDATED: Use the new non-admin endpoint to fetch job details
                    const endpoint = `${BACKEND_API_URL}/api/direct-jobs/${currentChatIdentifier}`;

                    response = await fetch(endpoint, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    data = await response.json();

                    if (!isMounted) return; // NEW: Check isMounted immediately after async operation

                    if (response.ok && data.job) { // Ensure data.job matches backend response structure
                        setJobDetails(data.job);
                        // Determine chat partner from job details
                        if (user.user_type === 'client') {
                            setChatPartner(data.job.transcriber); // Client chats with transcriber
                        } else if (user.user_type === 'transcriber') {
                            setChatPartner(data.job.client); // Transcriber chats with client
                        }
                    } else {
                        console.error(`UserChat: Failed to fetch job details for chat. Response OK: ${response.ok}, Data: `, data);
                        showToast(data.error || 'Job details not found for chat or access denied.ᐟ', 'error');
                        navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard');
                    }
                } else {
                    // Direct message chat, fetch partner details
                    response = await fetch(`${BACKEND_API_URL}/api/users/${currentChatIdentifier}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    data = await response.json();

                    if (!isMounted) return; // NEW: Check isMounted immediately after async operation

                    if (response.ok && data.user) {
                        setChatPartner(data.user);
                    } else {
                        showToast(data.error || 'Chat partner not found.ᐟ', 'error');
                        navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard');
                    }
                }
            } catch (error) {
                if (!isMounted) return; // NEW: Check isMounted in catch block too
                console.error('Error fetching chat partner/job details:ᐟ', error);
                showToast('Network error fetching chat details.ᐟ', 'error');
                navigate(user.user_type === 'client' ? '/client-dashboard' : '/transcriber-dashboard');
            } finally {
                if (isMounted) {
                    setLoading(false); // Set loading to false after fetching details
                }
            }
        };
        fetchDetails();
        return () => { isMounted = false; };
    }, [isAuthReady, user, currentChatIdentifier, isJobChat, navigate, logout, showToast]);


    // UPDATED: Fetch chat history based on chat type
    const fetchChatHistory = useCallback(async () => {
        if (!user || !currentChatIdentifier || (!chatPartner && !jobDetails)) { // Ensure relevant details are loaded
            console.warn('UserChat: fetchChatHistory called before user, chatPartner, or jobDetails are available.ᐟ');
            setLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log('UserChat: Fetching historical chat messages. Chat Identifier:', currentChatIdentifier, 'isJobChat:', isJobChat);
        try {
            let response;
            if (isJobChat) {
                // For job chats, use the /api/messages/:jobId endpoint
                response = await fetch(`${BACKEND_API_URL}/api/messages/${currentChatIdentifier}`, { 
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                // For direct user chats, use the /api/user/chat/messages/:chatId endpoint
                response = await fetch(`${BACKEND_API_URL}/api/user/chat/messages/${currentChatIdentifier}`, { 
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            
            const data = await response.json();

            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: msg.sender_id === user.id ? user.full_name : chatPartner?.full_name || jobDetails?.client?.full_name || jobDetails?.transcriber?.full_name || 'Admin', // Dynamic sender name
                    text: msg.content,
                    // Format timestamp immediately upon fetching
                    timestamp: formatDisplayTimestamp(msg.timestamp), 
                    file_url: msg.file_url, 
                    file_name: msg.file_name 
                }));
                setMessages(formattedMessages);
            } else {
                showToast(data.error || 'Failed to fetch chat messages.ᐟ', 'error');
            }
        } catch (error) {
            console.error('Error fetching chat messages:ᐟ', error);
            showToast('Network error fetching chat messages.ᐟ', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, currentChatIdentifier, isJobChat, chatPartner, jobDetails, logout, showToast]);


    const handleNewChatMessage = useCallback((msg) => {
        if (!user || !currentChatIdentifier || (!chatPartner && !jobDetails)) {
            console.warn('UserChat: handleNewChatMessage called before user, chatPartner, or jobDetails are available. Ignoring message.ᐟ');
            return;
        }

        setMessages((prevMessages) => {
            const currentLoggedInUser = user;
            // Determine the expected sender/receiver IDs for this chat type
            // For job chats, a message is relevant if its direct_upload_job_id matches the currentChatIdentifier
            // And its sender/receiver are the client/transcriber of this job.
            const isRelevant = (isJobChat && msg.direct_upload_job_id === currentChatIdentifier && 
                               ((msg.sender_id === jobDetails?.client_id && msg.receiver_id === jobDetails?.transcriber_id) ||
                                (msg.sender_id === jobDetails?.transcriber_id && msg.receiver_id === jobDetails?.client_id) ||
                                (msg.sender_id === currentLoggedInUser.id && (msg.receiver_id === jobDetails?.client_id || msg.receiver_id === jobDetails?.transcriber_id)) || // Sent by current user to either client/transcriber
                                (msg.receiver_id === currentLoggedInUser.id && (msg.sender_id === jobDetails?.client_id || msg.sender_id === jobDetails?.transcriber_id)))) // Received by current user from either client/transcriber
                               ||
                               (!isJobChat && 
                               ((msg.sender_id === currentChatIdentifier && msg.receiver_id === currentLoggedInUser.id) ||
                                (msg.sender_id === currentLoggedInUser.id && msg.receiver_id === currentChatIdentifier)));

            if (!isRelevant) {
                console.log('UserChat: Received irrelevant message, ignoring.ᐟ ', msg);
                return prevMessages;
            }

            // Deduplicate: Check if a message with the same ID already exists
            if (prevMessages.some(m => m.id === msg.id)) {
                console.log('UserChat: Received duplicate message, ignoring.ᐟ ', msg);
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
                    sender_name: (msg.sender_id === currentLoggedInUser.id) ? currentLoggedInUser.full_name : (chatPartner?.full_name || jobDetails?.client?.full_name || jobDetails?.transcriber?.full_name || 'Admin'),
                    file_url: msg.file_url,
                    file_name: msg.file_name
                };
                console.log('UserChat: Adding new message to chat:ᐟ ', newMessageObj);
                return [...updatedMessages, newMessageObj];
            }
            return updatedMessages; 
        });
    }, [user, currentChatIdentifier, isJobChat, chatPartner, jobDetails, playNotificationSound]);


    useEffect(() => {
        let isMounted = true;

        // UPDATED: Ensure chatPartner or jobDetails are loaded before connecting socket
        if (!isAuthReady || !user || !user.id || !user.user_type || (!chatPartner && !jobDetails)) {
            console.log('UserChat: Socket useEffect gated. isAuthReady:', isAuthReady, 'user:', user?.id, 'chatPartner:', chatPartner?.id, 'jobDetails:', jobDetails?.id);
            return;
        }

        console.log('UserChat: Socket useEffect running. Attempting to connect/join.ᐟ');

        const socket = connectSocket(user.id); 

        const handleSocketConnect = () => {
            if (!isMounted) return;
            console.log('UserChat: Socket connected, joining user room.ᐟ');
            socket.emit('joinUserRoom', user.id);
            // UPDATED: Join job room if it's a job chat
            if (isJobChat && currentChatIdentifier) {
                socket.emit('joinJobRoom', currentChatIdentifier); // Assuming a 'joinJobRoom' event in ChatService/backend
                console.log(`UserChat: Socket joined job room ${currentChatIdentifier}.`);
            } else if (currentChatIdentifier) { // For direct user chats
                socket.emit('joinUserRoom', currentChatIdentifier);
                console.log(`UserChat: Socket joined user room ${currentChatIdentifier}.`);
            }
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
                console.log('UserChat: Cleaning up socket listeners on unmount.ᐟ');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect);
                disconnectSocket(); 
            }
        };
    }, [isAuthReady, user, chatPartner, jobDetails, currentChatIdentifier, isJobChat, fetchChatHistory, handleNewChatMessage]); // Added jobDetails to dependencies


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const triggerFileInput = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // UPDATED: sendMessage now handles job-specific chats
    const handleSendMessage = useCallback(async (fileToUpload = null) => {
        const messageToSend = newMessage.trim();
        const file = fileToUpload || selectedFile;

        if (messageToSend === '' && !file) return;

        if (!user || (!chatPartner && !jobDetails)) {
            console.error('UserChat: Attempted to send message before user, chatPartner or jobDetails are available.ᐟ');
            showToast('Cannot send message: User not logged in or chat context not loaded.ᐟ', 'error');
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
                showToast('File uploaded successfully!ᐟ', 'success');
            } catch (error) {
                console.error('UserChat: Error uploading file:ᐟ', error);
                showToast(`Failed to upload file: ${error.message || 'Network error.'}ᐟ`, 'error');
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
                receiver_id: isJobChat ? (user.user_type === 'client' ? jobDetails.transcriber_id : jobDetails.client_id) : currentChatIdentifier, // Dynamic receiver for job chat
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
                receiverId: isJobChat ? (user.user_type === 'client' ? jobDetails.transcriber_id : jobDetails.client_id) : currentChatIdentifier, // Dynamic receiver
                negotiationId: null, // Direct Upload doesn't use negotiationId
                directUploadJobId: isJobChat ? currentChatIdentifier : null, // Pass jobId for direct upload chats
                messageText: messageToSend,
                timestamp: new Date().toISOString(), // Still send ISO string to backend
                senderUserType: user.user_type,
                fileUrl: fileUrl,
                fileName: fileName,
            });

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            console.log('UserChat: Message sent successfully via ChatService.ᐟ');

        } catch (error) {
            console.error('UserChat: Error sending message:ᐟ', error);
            showToast(error.message || 'Network error sending message.ᐟ', 'error');
            if (tempMessageId) {
                setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
            }
        }
    }, [newMessage, selectedFile, user, currentChatIdentifier, isJobChat, chatPartner, jobDetails, showToast]); // Added jobDetails to dependencies


    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (file.size > MAX_CHAT_FILE_SIZE_MB * 1024 * 1024) {
            showToast(`File must be smaller than ${MAX_CHAT_FILE_SIZE_MB}MB.ᐟ`, 'error');
            e.target.value = '';
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        if (newMessage.trim() === '') {
            handleSendMessage(file);
        } else {
            showToast(`File selected: ${file.name}. Click send to attach with your message.ᐟ`, 'info');
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

    // UPDATED: Dynamic back link and title
    const backLinkPath = user.user_type === 'client' ? '/client-jobs' : '/transcriber-direct-upload-jobs'; // Corrected path for transcriber
    const chatTitle = isJobChat ? `Chat for Direct Upload Job #${jobDetails?.id?.substring(0, 8)}...` : `Chat with ${chatPartner?.full_name || 'Partner'}`;


    return (
        <div className="client-dashboard-container">
            <header className="client-dashboard-header">
                <div className="header-content">
                    <h1>{chatTitle}</h1> {/* UPDATED: Dynamic title */}
                    <div className="user-info">
                        <span>Welcome, {user?.full_name || 'User'}!</span>
                        <button onClick={logout} className="logout-btn">Logout</button>
                    </div>
                </div>
            </header>
            <main className="client-dashboard-main">
                <div className="back-link-container">
                    <Link to={backLinkPath} className="back-link">← Back to Job List</Link> {/* UPDATED: Back link text */}
                </div>

                <div className="dashboard-content">
                    <h2>{chatTitle}</h2> {/* UPDATED: Dynamic title */}
                    <div className="chat-window">
                        <div className="messages-display">
                            {messages.length === 0 ? (
                                <p className="no-data-message">Start chat by typing a message below!ᐟ</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.sender_id === user.id ? 'my-message' : 'partner-message'}`}>
                                        <div className="message-header">
                                            <strong>{msg.sender_id === user.id ? 'Me' : (chatPartner?.full_name || jobDetails?.client?.full_name || jobDetails?.transcriber?.full_name || 'Admin')}</strong> {/* UPDATED: Dynamic sender name */}
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
                                    placeholder="Type your message...ᐟ"
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
                                        {isUploadingFile ? 'Uploading...ᐟ' : 'Send'}
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
