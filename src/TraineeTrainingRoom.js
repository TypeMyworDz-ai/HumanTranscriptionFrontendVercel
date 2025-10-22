import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import Toast from './Toast';
import { useAuth } from './contexts/AuthContext';
import { connectSocket, disconnectSocket, sendMessage } from './ChatService'; 
import { BACKEND_API_URL } from './config';
import './TraineeTrainingRoom.css';

const MAX_TRAINING_FILE_SIZE_MB = 500; 

// Helper function to format timestamp robustly for display
const formatDisplayTimestamp = (isoTimestamp) => {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        if (isNaN(date.getTime())) { 
            console.warn(`Attempted to format invalid date string: ${isoTimestamp}`);
            return 'Invalid Date';
        }
        return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error(`Error formatting timestamp ${isoTimestamp}:`, e);
        return 'Invalid Date';
    }
};

const TraineeTrainingRoom = () => {
    const { chatId: trainingRoomId } = useParams(); 
    const { user, isAuthenticated, authLoading, isAuthReady, logout } = useAuth();
    const navigate = useNavigate();

    const [trainerUser, setTrainerUser] = useState(null); 
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ isVisible: false, message: '', type: 'success' });
    const [adminId, setAdminId] = useState(null); // NEW: State to store admin ID fetched from backend

    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioRef = useRef(null); 
    const textareaRef = useRef(null); 

    const showToast = useCallback((message, type = 'success') => setToast({ isVisible: true, message, type }), []);
    const hideToast = useCallback(() => setToast((prev) => ({ ...prev, isVisible: false })), []);

    const playNotificationSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [newMessage]); 

    // NEW: Function to fetch the ADMIN_USER_ID from the backend
    const fetchAdminUserId = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn("fetchAdminUserId: Token missing.");
            return null;
        }
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/admin/trainer-id`, { // Assuming this new endpoint exists
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.adminId) {
                setAdminId(data.adminId);
                return data.adminId;
            } else {
                console.error('Failed to fetch admin ID:', data.error);
                showToast(data.error || 'Failed to fetch admin ID for training.', 'error');
                return null;
            }
        } catch (error) {
            console.error('Network error fetching admin ID:', error);
            showToast('Network error while fetching admin ID.', 'error');
            return null;
        }
    }, [showToast]);

    // MODIFIED: fetchTrainerDetails now uses the fetched adminId
    const fetchTrainerDetails = useCallback(async (currentAdminId) => {
        if (!currentAdminId) {
            showToast('Training admin not configured. Please ensure ADMIN_USER_ID is set in backend.', 'error');
            console.error('ADMIN_USER_ID is not configured in environment variables or could not be fetched.');
            navigate('/trainee-dashboard');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${BACKEND_API_URL}/api/admin/users/${currentAdminId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.user) {
                setTrainerUser(data.user);
            } else {
                showToast('Failed to fetch trainer details.', 'error');
                console.error('Failed to fetch trainer details:', data.error);
                navigate('/trainee-dashboard');
            }
        } catch (error) {
            console.error('Network error fetching trainer details:', error);
            showToast('Network error fetching trainer details.', 'error');
            navigate('/trainee-dashboard');
        }
    }, [navigate, showToast]);


    useEffect(() => {
        if (!isAuthReady || authLoading || !user || !user.id) {
            if (isAuthReady && !user) {
                console.log("TraineeTrainingRoom: Auth ready but no user. Redirecting to login.");
                navigate('/login');
            }
            return;
        }

        if (user.user_type !== 'trainee' && user.user_type !== 'admin') {
            console.warn(`TraineeTrainingRoom: Unauthorized access attempt by user_type: ${user.user_type}. Redirecting.`);
            navigate('/');
            return;
        }
        if (user.user_type === 'trainee' && user.transcriber_status !== 'paid_training_fee') {
            console.warn(`TraineeTrainingRoom: Trainee (${user.full_name}) has not paid for training. Redirecting to payment page.`);
            navigate('/training-payment');
            return;
        }

        // Only fetch admin ID if it hasn't been fetched yet
        if (!adminId) {
            fetchAdminUserId().then(fetchedAdminId => {
                if (fetchedAdminId) {
                    fetchTrainerDetails(fetchedAdminId);
                }
            });
        } else {
            fetchTrainerDetails(adminId);
        }

    }, [isAuthReady, user, authLoading, navigate, showToast, trainingRoomId, adminId, fetchAdminUserId, fetchTrainerDetails]);


    const fetchTrainingRoomMessages = useCallback(async () => {
        if (!user || !trainerUser || !trainingRoomId) {
            console.warn('fetchTrainingRoomMessages: User, trainer, or trainingRoomId not available.');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log(`TraineeTrainingRoom: Fetching messages for training room ID: ${trainingRoomId}`);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/trainee/training-room/messages/${trainingRoomId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok && data.messages) {
                const formattedMessages = data.messages.map(msg => ({
                    ...msg,
                    sender_name: (msg.sender_id === user.id) ? user.full_name : trainerUser.full_name || 'Trainer',
                    text: msg.content,
                    timestamp: formatDisplayTimestamp(msg.timestamp),
                }));
                setMessages(formattedMessages);
                console.log(`TraineeTrainingRoom: Successfully fetched ${formattedMessages.length} messages.`);
            } else {
                console.error('TraineeTrainingRoom: Failed to fetch messages:', data.error);
                showToast(data.error || 'Failed to fetch training room messages.', 'error');
            }
        } catch (error) {
            console.error('TraineeTrainingRoom: Network error fetching messages:', error);
            showToast('Network error while fetching training room messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, trainerUser, trainingRoomId, logout, showToast]);


    const handleNewChatMessage = useCallback((msg) => {
        if (!user || !trainerUser || msg.training_room_id !== trainingRoomId) {
            console.log('TraineeTrainingRoom: Received irrelevant message or user/trainer not ready, ignoring.', msg);
            return;
        }

        setMessages((prevMessages) => {
            if (prevMessages.some(m => m.id === msg.id && !m.isOptimistic)) {
                console.log('TraineeTrainingRoom: Received duplicate message, ignoring.', msg);
                return prevMessages;
            }

            const updatedMessages = prevMessages.map(m =>
                m.isOptimistic && m.sender_id === msg.sender_id && m.content === msg.content &&
                m.file_url === msg.file_url && m.training_room_id === msg.training_room_id
                    ? { ...msg, isOptimistic: false, timestamp: formatDisplayTimestamp(msg.timestamp) }
                    : m
            );

            if (!updatedMessages.some(m => m.id === msg.id && !m.isOptimistic)) {
                if (msg.sender_id !== user.id) {
                    playNotificationSound();
                }
                const newMessageObj = {
                    ...msg,
                    sender_name: (msg.sender_id === user.id) ? user.full_name : trainerUser.full_name || 'Trainer',
                    timestamp: formatDisplayTimestamp(msg.timestamp),
                };
                console.log('TraineeTrainingRoom: Adding new message to chat:', newMessageObj);
                return [...updatedMessages, newMessageObj];
            }
            return updatedMessages;
        });
    }, [user, trainerUser, trainingRoomId, playNotificationSound]);


    useEffect(() => {
        let isMounted = true;

        if (!isAuthReady || !user || !user.id || user.user_type === 'client' || !trainerUser || !trainingRoomId) {
            if (isAuthReady && user && user.user_type !== 'client' && !trainerUser) {
                console.log('TraineeTrainingRoom: Waiting for trainerUser details before connecting socket and fetching messages.');
            }
            return;
        }

        console.log(`TraineeTrainingRoom: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        const handleSocketConnect = () => {
            if (!isMounted) return;
            socket.emit('joinUserRoom', user.id);
            if (user.id !== trainerUser.id) { 
                socket.emit('joinUserRoom', trainerUser.id);
            }
            console.log(`TraineeTrainingRoom: Socket connected. Joined rooms for ${user.id} and ${trainerUser.id}. Fetching training room messages.`);
            fetchTrainingRoomMessages();
        };

        if (!socket.connected) {
            socket.on('connect', handleSocketConnect);
        } else {
            handleSocketConnect();
        }

        socket.on('newChatMessage', handleNewChatMessage);

        return () => {
            if (isMounted) {
                console.log('TraineeTrainingRoom: Cleaning up socket listeners on unmount.');
                socket.off('newChatMessage', handleNewChatMessage);
                socket.off('connect', handleSocketConnect);
                disconnectSocket();
            }
        };
    }, [isAuthReady, user, trainerUser, trainingRoomId, fetchTrainingRoomMessages, handleNewChatMessage]);


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

        if (!user || !trainerUser) {
            console.error('TraineeTrainingRoom: Attempted to send message before user or trainer object is available.');
            showToast('Cannot send message: User or trainer not loaded.', 'error');
            return;
        }

        let fileUrl = null;
        let fileName = null;
        let tempMessageId;

        if (file) {
            setIsUploadingFile(true);
            try {
                const formData = new FormData();
                formData.append('trainingRoomAttachment', file);

                const token = localStorage.getItem('token');
                if (!token) {
                    showToast('Authentication token missing. Please log in again.', 'error');
                    setIsUploadingFile(false);
                    return;
                }

                const uploadResponse = await fetch(`${BACKEND_API_URL}/api/trainee/training-room/upload-attachment`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                const uploadData = await uploadResponse.json();

                if (uploadResponse.ok && uploadData.fileUrl) {
                    fileUrl = uploadData.fileUrl;
                    fileName = file.name;
                    showToast('File uploaded successfully!', 'success');
                } else {
                    throw new Error(uploadData.error || 'Failed to upload file to training room.');
                }
            } catch (error) {
                console.error('TraineeTrainingRoom: Error uploading file:', error);
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
                receiver_id: (user.user_type === 'trainee' ? trainerUser.id : trainingRoomId), 
                content: messageToSend,
                timestamp: formatDisplayTimestamp(new Date().toISOString()),
                sender_name: user.full_name,
                file_url: fileUrl ? `${fileUrl}` : null,
                file_name: fileName,
                training_room_id: trainingRoomId,
                isOptimistic: true,
            };
            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

            await sendMessage({
                senderId: user.id,
                receiverId: (user.user_type === 'trainee' ? trainerUser.id : trainingRoomId),
                negotiationId: null,
                trainingRoomId: trainingRoomId, 
                messageText: messageToSend,
                timestamp: new Date().toISOString(),
                senderUserType: user.user_type,
                fileUrl: fileUrl,
                fileName: fileName,
            });

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            console.log('TraineeTrainingRoom: Message sent successfully via ChatService.');

        } catch (error) {
            console.error('TraineeTrainingRoom: Error sending message:', error);
            showToast(error.message || 'Network error sending message.', 'error');
            if (tempMessageId) {
                setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
            }
        }
    }, [newMessage, selectedFile, user, trainerUser, trainingRoomId, showToast]);


    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (file.size > MAX_TRAINING_FILE_SIZE_MB * 1024 * 1024) {
            showToast(`File must be smaller than ${MAX_TRAINING_FILE_SIZE_MB}MB.`, 'error');
            e.target.value = '';
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        if (newMessage.trim() === '') {
            await handleSendMessage(file);
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


    if (loading || authLoading || !isAuthenticated || !user || !trainerUser || user.user_type === 'client' || !adminId) { // MODIFIED: Added adminId to loading condition
        return (
            <div className="training-room-container">
                <div className="loading-spinner">Loading training room...</div>
            </div>
        );
    }

    return (
        <div className="training-room-container">
            <header className="training-room-header">
                <div className="header-content">
                    <h1>Training Room with {trainerUser?.full_name || 'Trainer'}</h1>
                    <div className="user-profile-actions">
                        <span className="welcome-text-badge">Welcome, {user.full_name}!</span>
                        <button onClick={logout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="training-room-main">
                <div className="back-link-container">
                    <Link to="/trainee-dashboard" className="back-link">← Back to Dashboard</Link>
                </div>

                <div className="training-room-content">
                    <div className="chat-window">
                        <div className="messages-display">
                            {messages.length === 0 ? (
                                <p className="no-data-message">Start your training chat! Your trainer will be here to guide you.</p>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`chat-message ${msg.sender_id === user.id ? 'self-message' : 'other-message'}`}>
                                        <div className="message-header">
                                            <strong>{msg.sender_name}</strong>
                                            <span>{msg.timestamp}</span>
                                        </div>
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
                                    ref={textareaRef}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    placeholder="Type your message..."
                                    rows="1"
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

export default TraineeTrainingRoom;
