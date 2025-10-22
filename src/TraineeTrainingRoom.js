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

    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [adminId, setAdminId] = useState(null);

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

    const fetchTrainerDetails = useCallback(async (trainerIdToFetch) => {
        if (!trainerIdToFetch) {
            showToast('Trainer ID not available for this training room.', 'error');
            console.error('Trainer ID is not available.');
            navigate('/trainee-dashboard');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${BACKEND_API_URL}/api/users/${trainerIdToFetch}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.user) {
                setTrainerUser(data.user);
                // IMPORTANT: Store the admin/trainer ID for message filtering
                setAdminId(data.user.id);
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

        // Determine trainerId based on user type
        if (user.user_type === 'admin') {
            setTrainerUser(user); // If current user is admin, they are the 'trainer' in this context
            setAdminId(user.id); // IMPORTANT: Store admin ID
        } else if (user.user_type === 'trainee') {
            const fetchTraineeTrainer = async () => {
                const token = localStorage.getItem('token');
                if (!token) { logout(); return; }

                try {
                    const response = await fetch(`${BACKEND_API_URL}/api/trainee/status`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (response.ok && data.trainer_id) { 
                        fetchTrainerDetails(data.trainer_id);
                    } else {
                        console.error('Failed to fetch trainee status or trainer ID:', data.error);
                        showToast(data.error || 'Failed to determine trainer for training room.', 'error');
                        navigate('/trainee-dashboard');
                    }
                } catch (error) {
                    console.error('Network error fetching trainee status:', error);
                    showToast('Network error while determining trainer.', 'error');
                    navigate('/trainee-dashboard');
                }
            };
            fetchTraineeTrainer();
        }

    }, [isAuthReady, user, authLoading, navigate, showToast, trainingRoomId, logout, fetchTrainerDetails]);


    // CRITICAL FIX: Fetch both training room messages AND direct messages between trainee and admin
    const fetchAllRelevantMessages = useCallback(async () => {
        if (!user || !trainingRoomId) {
            console.warn('fetchAllRelevantMessages: User or trainingRoomId not available. Skipping fetch.');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) { logout(); return; }

        console.log(`TraineeTrainingRoom: Fetching all relevant messages for training room ID: ${trainingRoomId}`);
        setLoading(true);
        
        try {
            // 1. First fetch training room messages
            const trainingRoomResponse = await fetch(`${BACKEND_API_URL}/api/trainee/training-room/messages/${trainingRoomId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const trainingRoomData = await trainingRoomResponse.json();
            
            // 2. Then fetch direct messages between user and admin (if we know admin ID)
            let directMessages = [];
            if (adminId) {
                try {
                    const directMessageResponse = await fetch(`${BACKEND_API_URL}/api/user/chat/messages/${adminId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const directMessageData = await directMessageResponse.json();
                    if (directMessageResponse.ok && directMessageData.messages) {
                        directMessages = directMessageData.messages;
                        console.log(`TraineeTrainingRoom: Fetched ${directMessages.length} direct messages with admin`, directMessages);
                    }
                } catch (error) {
                    console.error('Error fetching direct messages with admin:', error);
                }
            }

            // 3. Combine and deduplicate messages
            let allMessages = [];
            
            if (trainingRoomResponse.ok && trainingRoomData.messages) {
                allMessages = [...trainingRoomData.messages];
                console.log(`TraineeTrainingRoom: Fetched ${allMessages.length} training room messages`, allMessages);
            }
            
            // Add direct messages that aren't duplicates
            directMessages.forEach(directMsg => {
                if (!allMessages.some(msg => msg.id === directMsg.id)) {
                    allMessages.push(directMsg);
                }
            });
            
            console.log(`TraineeTrainingRoom: Combined ${allMessages.length} total messages`);
            
            // Process each message to ensure correct display
            const formattedMessages = allMessages.map(msg => {
                // Determine correct sender name
                let senderName;
                if (user.user_type === 'trainee') {
                    senderName = msg.sender_id === user.id ? 'Test Trainee' : 'Admin User';
                } else { // admin
                    senderName = msg.sender_id === user.id ? 'Admin User' : 'Test Trainee';
                }
                
                return {
                    ...msg,
                    sender_name: senderName,
                    text: msg.content,
                    timestamp: formatDisplayTimestamp(msg.timestamp),
                };
            });
            
            // Sort messages by timestamp
            formattedMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
            
            setMessages(formattedMessages);
            console.log(`TraineeTrainingRoom: Successfully processed ${formattedMessages.length} messages`);
            
        } catch (error) {
            console.error('TraineeTrainingRoom: Error fetching messages:', error);
            showToast('Error fetching messages.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, trainingRoomId, adminId, logout, showToast]);


    const handleNewChatMessage = useCallback((msg) => {
        // --- DEBUGGING LOGS ---
        console.log("handleNewChatMessage received msg:", msg);
        console.log("Current user.id:", user?.id);
        console.log("Current adminId:", adminId);
        console.log("Current trainingRoomId (from useParams):", trainingRoomId);
        console.log("msg.sender_id:", msg.sender_id);
        console.log("msg.receiver_id:", msg.receiver_id);
        console.log("msg.training_room_id (from payload):", msg.training_room_id);
        // --- END DEBUGGING LOGS ---

        // CRITICAL FIX: Accept messages between trainee and admin, regardless of training_room_id
        const isDirectMessage = (
            // Admin to trainee
            (msg.sender_id === adminId && msg.receiver_id === user?.id) ||
            // Trainee to admin
            (msg.sender_id === user?.id && msg.receiver_id === adminId)
        );
        
        const isTrainingRoomMessage = msg.training_room_id === trainingRoomId;
        
        if (!user || (!isDirectMessage && !isTrainingRoomMessage)) {
            console.log('TraineeTrainingRoom: Ignoring message. Details:', {
                userExists: !!user,
                isDirectMessage,
                isTrainingRoomMessage,
                msg,
                componentUserId: user?.id,
                adminId,
                componentTrainingRoomId: trainingRoomId
            });
            return;
        }

        setMessages((prevMessages) => {
            // Check for duplicates
            if (prevMessages.some(m => m.id === msg.id && !m.isOptimistic)) {
                console.log('TraineeTrainingRoom: Received duplicate message, ignoring.', msg);
                return prevMessages;
            }

            // Update optimistic messages if they match
            const updatedMessages = prevMessages.map(m =>
                m.isOptimistic && m.sender_id === msg.sender_id && m.content === msg.content
                    ? { ...msg, isOptimistic: false, timestamp: formatDisplayTimestamp(msg.timestamp) }
                    : m
            );

            // Add new message if not already present
            if (!updatedMessages.some(m => m.id === msg.id && !m.isOptimistic)) {
                if (msg.sender_id !== user.id) {
                    playNotificationSound();
                }
                
                // Determine the sender name
                let senderName;
                if (user.user_type === 'trainee') {
                    senderName = msg.sender_id === user.id ? 'Test Trainee' : 'Admin User';
                } else { // admin
                    senderName = msg.sender_id === user.id ? 'Admin User' : 'Test Trainee';
                }
                
                const newMessageObj = {
                    ...msg,
                    sender_name: senderName,
                    text: msg.content,
                    timestamp: formatDisplayTimestamp(msg.timestamp),
                };
                console.log('TraineeTrainingRoom: Adding new message to chat:', newMessageObj);
                return [...updatedMessages, newMessageObj];
            }
            return updatedMessages;
        });
    }, [user, trainingRoomId, adminId, playNotificationSound]);


    useEffect(() => {
        let isMounted = true;

        if (!isAuthReady || !user || !user.id || user.user_type === 'client' || !trainingRoomId) {
            return;
        }

        console.log(`TraineeTrainingRoom: Attempting to connect socket via ChatService for user ID: ${user.id}`);
        const socket = connectSocket(user.id);

        const handleSocketConnect = () => {
            if (!isMounted) return;
            
            // Join own room
            socket.emit('joinUserRoom', user.id);
            
            // Join the training room ID (which is the trainee's ID when viewed by admin)
            socket.emit('joinUserRoom', trainingRoomId);
            
            // Also join admin's room if we know it
            if (adminId && adminId !== user.id) {
                socket.emit('joinUserRoom', adminId);
                console.log(`TraineeTrainingRoom: Joined admin's room: ${adminId}`);
            }
            
            console.log(`TraineeTrainingRoom: Socket connected. Joined rooms. Fetching messages.`);
            fetchAllRelevantMessages(); // Fetch messages once connection is established
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
    }, [isAuthReady, user, adminId, trainingRoomId, fetchAllRelevantMessages, handleNewChatMessage]);


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
            console.error('TraineeTrainingRoom: Attempted to send message before user object is available.');
            showToast('Cannot send message: User not loaded.', 'error');
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
            
            // Determine proper receiver based on user type
            const receiverId = user.user_type === 'trainee' 
                ? (adminId || null) 
                : trainingRoomId;
            
            // Set the correct sender name based on user type
            const senderName = user.user_type === 'trainee' ? 'Test Trainee' : 'Admin User';
            
            const optimisticMessage = {
                id: tempMessageId,
                sender_id: user.id,
                receiver_id: receiverId,
                content: messageToSend,
                timestamp: formatDisplayTimestamp(new Date().toISOString()),
                sender_name: senderName,
                file_url: fileUrl ? `${fileUrl}` : null,
                file_name: fileName,
                training_room_id: user.user_type === 'trainee' ? trainingRoomId : null,
                isOptimistic: true,
            };
            setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

            const messageDataForService = {
                senderId: user.id,
                receiverId: receiverId,
                negotiationId: null,
                trainingRoomId: user.user_type === 'trainee' ? trainingRoomId : null,
                messageText: messageToSend,
                timestamp: new Date().toISOString(),
                senderUserType: user.user_type,
                fileUrl: fileUrl,
                fileName: fileName,
                senderName: senderName
            };

            console.log("[handleSendMessage] Calling ChatService.sendMessage with:", messageDataForService);

            await sendMessage(messageDataForService);

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
    }, [newMessage, selectedFile, user, adminId, trainingRoomId, showToast]);


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


    if (loading || authLoading || !isAuthenticated || !user || user.user_type === 'client') { 
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
