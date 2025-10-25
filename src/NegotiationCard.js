import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSocketInstance, sendMessage, uploadChatAttachment } from './ChatService';
import { useAuth } from './contexts/AuthContext'; 

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const STATIC_FILES_URL = BACKEND_API_URL; // Base URL for static files

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

// Custom comparison function for React.memo
const arePropsEqual = (prevProps, nextProps) => {
    // Compare negotiation prop deeply
    if (JSON.stringify(prevProps.negotiation) !== JSON.stringify(nextProps.negotiation)) {
        console.log(`NegotiationCard: Props changed - negotiation. Prev:`, prevProps.negotiation, `Next:`, nextProps.negotiation);
        return false;
    }

    // Compare simple props
    if (prevProps.onDelete !== nextProps.onDelete) {
        console.log(`NegotiationCard: Props changed - onDelete.`);
        return false;
    }
    if (prevProps.onPayment !== nextProps.onPayment) {
        console.log(`NegotiationCard: Props changed - onPayment.`);
        return false;
    }
    if (prevProps.onLogout !== nextProps.onLogout) {
        console.log(`NegotiationCard: Props changed - onLogout.`);
        return false;
    }
    if (prevProps.getStatusColor !== nextProps.getStatusColor) {
        console.log(`NegotiationCard: Props changed - getStatusColor.`);
        return false;
    }
    if (prevProps.getStatusText !== nextProps.getStatusText) {
        console.log(`NegotiationCard: Props changed - getStatusText.`);
        return false;
    }
    if (prevProps.showToast !== nextProps.showToast) {
        console.log(`NegotiationCard: Props changed - showToast.`);
        return false;
    }
    if (prevProps.currentUserId !== nextProps.currentUserId) {
        console.log(`NegotiationCard: Props changed - currentUserId.`);
        return false;
    }
    if (prevProps.currentUserType !== nextProps.currentUserType) {
        console.log(`NegotiationCard: Props changed - currentUserType.`);
        return false;
    }
    if (prevProps.openAcceptCounterModal !== nextProps.openAcceptCounterModal) {
        console.log(`NegotiationCard: Props changed - openAcceptCounterModal.`);
        return false;
    }
    if (prevProps.openRejectCounterModal !== nextProps.openRejectCounterModal) {
        console.log(`NegotiationCard: Props changed - openRejectCounterModal.`);
        return false;
    }
    if (prevProps.openCounterBackModal !== nextProps.openCounterBackModal) {
        console.log(`NegotiationCard: Props changed - openCounterBackModal.`);
        return false;
    }
    if (prevProps.openAcceptModal !== nextProps.openAcceptModal) {
        console.log(`NegotiationCard: Props changed - openAcceptModal.`);
        return false;
    }
    if (prevProps.onOpenCounterModal !== nextProps.onOpenCounterModal) {
        console.log(`NegotiationCard: Props changed - onOpenCounterModal.`);
        return false;
    }
    if (prevProps.openRejectModal !== nextProps.openRejectModal) {
        console.log(`NegotiationCard: Props changed - openRejectModal.`);
        return false;
    }
    if (prevProps.openCompleteJobModal !== nextProps.openCompleteJobModal) {
        console.log(`NegotiationCard: Props changed - openCompleteJobModal.`);
        return false;
    }
    if (prevProps.canCounter !== nextProps.canCounter) {
        console.log(`NegotiationCard: Props changed - canCounter.`);
        return false;
    }
    if (prevProps.onDownloadFile !== nextProps.onDownloadFile) {
        console.log(`NegotiationCard: Props changed - onDownloadFile.`);
        return false;
    }
    if (prevProps.clientCompletedJobs !== nextProps.clientCompletedJobs) {
        console.log(`NegotiationCard: Props changed - clientCompletedJobs.`);
        return false;
    }
    // NEW: Compare clientAverageRating prop
    if (prevProps.clientAverageRating !== nextProps.clientAverageRating) {
        console.log(`NegotiationCard: Props changed - clientAverageRating.`);
        return false;
    }

    // If all checked props are equal, prevent re-render
    return true;
};


const NegotiationCard = React.memo(({ 
  negotiation,
  onDelete,
  onPayment,
  onLogout,
  getStatusColor,
  getStatusText,
  showToast,
  currentUserId,
  currentUserType,
  openAcceptCounterModal,
  openRejectCounterModal,
  openCounterBackModal, 
  openAcceptModal,
  onOpenCounterModal, 
  openRejectModal,
  openCompleteJobModal, // This prop now opens the modal in ClientJobs.js
  canCounter,
  onDownloadFile, // Destructure onDownloadFile prop
  clientCompletedJobs, // Destructure clientCompletedJobs prop
  clientAverageRating // NEW: Destructure clientAverageRating prop directly
}) => { 
  const { user } = useAuth(); 
  const jobId = negotiation.id; // Generic ID for both negotiation and direct upload jobs

  // Determine job type
  const isDirectUploadJob = !!negotiation.file_url && !negotiation.negotiation_files;
  const jobType = isDirectUploadJob ? 'direct_upload' : 'negotiation';

  const isClientViewing = currentUserType === 'client';
  // Determine if otherParty is transcriber (for client view) or client (for transcriber view)
  const otherParty = isClientViewing ? negotiation.users : negotiation.client_info;
  const otherPartyId = otherParty?.id;
  const otherPartyName = otherParty?.full_name || 'Unknown User';

  const [cardMessages, setCardMessages] = useState([]);
  const [cardNewMessage, setCardNewMessage] = useState('');
  const [isSendingFile, setIsSendingFile] = useState(false);
  const fileInputRef = useRef(null);
  const chatWindowRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(null); // NEW: State for deadline time left

  // Helper to calculate time left
  const calculateTimeLeft = useCallback(() => {
    console.log(`[NegotiationCard: ${jobId}] calculateTimeLeft triggered.`);
    console.log(`[NegotiationCard: ${jobId}] Raw due_date:`, negotiation.due_date || negotiation.agreed_deadline_hours);

    const deadlineTimestamp = isDirectUploadJob 
        ? (negotiation.taken_at ? new Date(new Date(negotiation.taken_at).getTime() + negotiation.agreed_deadline_hours * 3600 * 1000).toISOString() : null)
        : negotiation.due_date;

    if (!deadlineTimestamp) {
        console.log(`[NegotiationCard: ${jobId}] No deadline timestamp found.`);
        return null;
    }

    const now = new Date();
    const dueDate = new Date(deadlineTimestamp);

    console.log(`[NegotiationCard: ${jobId}] Current time (now):`, now.toISOString());
    console.log(`[NegotiationCard: ${jobId}] Due Date object:`, dueDate.toISOString());
    console.log(`[NegotiationCard: ${jobId}] Is dueDate valid?`, !isNaN(dueDate.getTime()));


    if (isNaN(dueDate.getTime())) {
        console.error(`[NegotiationCard: ${jobId}] Invalid dueDate object created from: ${deadlineTimestamp}`);
        return 'Invalid Date';
    }

    const difference = dueDate.getTime() - now.getTime(); // Difference in milliseconds
    console.log(`[NegotiationCard: ${jobId}] Time difference (ms):`, difference);

    if (difference <= 0) {
      console.log(`[NegotiationCard: ${jobId}] Deadline is OVERDUE.`);
      return 'OVERDUE';
    }

    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const result = `${hours}h ${minutes}m ${seconds}s`;
    console.log(`[NegotiationCard: ${jobId}] Time left calculated:`, result);
    return result;
  }, [negotiation.due_date, negotiation.agreed_deadline_hours, negotiation.taken_at, isDirectUploadJob, jobId]);


  // Log the negotiation status for debugging
  useEffect(() => {
    console.log(`NegotiationCard: Rendering job ${jobId} with status: ${negotiation.status}. Due Date: ${negotiation.due_date || negotiation.agreed_deadline_hours}. Type: ${jobType}`);
    // NEW LOG: Log the full otherParty object to inspect ratings and job counts
    console.log(`NegotiationCard: Other Party Data for ${otherPartyName} (ID: ${otherPartyId}):`, otherParty);
  }, [jobId, negotiation.status, negotiation.due_date, negotiation.agreed_deadline_hours, otherParty, otherPartyId, otherPartyName, jobType]);

  // NEW: Calculate and check overdue status
  const isOverdue = (negotiation.due_date || (negotiation.taken_at && negotiation.agreed_deadline_hours && new Date(new Date(negotiation.taken_at).getTime() + negotiation.agreed_deadline_hours * 3600 * 1000))) 
                    && new Date((negotiation.taken_at && negotiation.agreed_deadline_hours) ? new Date(new Date(negotiation.taken_at).getTime() + negotiation.agreed_deadline_hours * 3600 * 1000) : negotiation.due_date) < new Date();

  // NEW: Effect to update the time left every second
  useEffect(() => {
    console.log(`[NegotiationCard: ${jobId}] useEffect for deadline counter triggered.`);
    console.log(`[NegotiationCard: ${jobId}] Current job status: ${negotiation.status}`);
    console.log(`[NegotiationCard: ${jobId}] Has deadline: ${!!(negotiation.due_date || (negotiation.taken_at && negotiation.agreed_deadline_hours))}`);


    if (!(negotiation.due_date || (negotiation.taken_at && negotiation.agreed_deadline_hours)) || negotiation.status === 'completed' || negotiation.status === 'client_completed' || negotiation.status === 'rejected' || negotiation.status === 'cancelled') {
        console.log(`[NegotiationCard: ${jobId}] Stopping deadline counter. Status: ${negotiation.status}, Deadline present: ${!!(negotiation.due_date || (negotiation.taken_at && negotiation.agreed_deadline_hours))}`);
        setTimeLeft(null);
        return;
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft());
    
    // Set up interval for updates
    const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Cleanup on unmount or dependency change
    return () => {
        console.log(`[NegotiationCard: ${jobId}] Clearing deadline counter interval.`);
        clearInterval(timer);
    }
  }, [negotiation.due_date, negotiation.agreed_deadline_hours, negotiation.taken_at, negotiation.status, calculateTimeLeft, jobId]);


  const handleReceiveMessageForCard = useCallback((data) => {
    // Only process the message if it belongs to this job card
    // Check both negotiation_id and direct_upload_job_id
    const isMessageForThisJob = (data.negotiation_id === jobId && !isDirectUploadJob) || 
                                (data.direct_upload_job_id === jobId && isDirectUploadJob);

    if (isMessageForThisJob) {
      setCardMessages(prevMessages => {
        // Attempt to replace an optimistic message
        const updatedMessages = prevMessages.map(m =>
            m.isOptimistic && m.sender_id === data.sender_id && m.content === data.content &&
            m.receiver_id === data.receiver_id && (m.file_url === data.file_url || (!m.file_url && !data.file_url))
                ? { ...data, isOptimistic: false, timestamp: formatDisplayTimestamp(data.timestamp) }
                : m
        );

        // If the message wasn't an optimistic replacement or it's genuinely new, append it
        if (!updatedMessages.some(m => m.id === data.id && !m.isOptimistic)) {
            const formattedData = {
                ...data,
                timestamp: formatDisplayTimestamp(data.timestamp)
            };
            // Ensure no duplicates are added if message IDs are reliable
            if (!prevMessages.find(m => m.id === data.id && !m.isOptimistic)) {
                 return [...updatedMessages, formattedData];
            }
        }
        // If it was already in the list (or replaced), return the updated list
        return updatedMessages;
      });
      console.log(`NegotiationCard: Message for ${jobId} received (Type: ${jobType}):`, data);
    } else {
        console.log(`NegotiationCard: Received message not for this card (${jobId}) or is a direct message. Data:`, data);
    }
  }, [jobId, isDirectUploadJob, jobType]);

  useEffect(() => {
    const socket = getSocketInstance();

    if (socket) {
      // Attach the listener
      socket.on('newChatMessage', handleReceiveMessageForCard);
      console.log(`NegotiationCard: Attached 'newChatMessage' listener for jobId: ${jobId}`);
    }

    return () => {
      if (socket) {
        // Detach the listener when the component unmounts
        socket.off('newChatMessage', handleReceiveMessageForCard);
        console.log(`NegotiationCard: Detached 'newChatMessage' listener for jobId: ${jobId}`);
      }
    };
  }, [jobId, handleReceiveMessageForCard]); 

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn("NegotiationCard: Token missing, not fetching messages.");
          return;
        }

        const response = await fetch(`${BACKEND_API_URL}/api/messages/${jobId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}` 
          }
        });
        const data = await response.json();
        if (response.ok) {
          const formattedMessages = (data.messages || []).map(msg => ({
            ...msg,
            timestamp: formatDisplayTimestamp(msg.timestamp)
          }));
          setCardMessages(formattedMessages);
          console.log(`NegotiationCard: Fetched ${formattedMessages.length} messages for ${jobId} (Type: ${jobType})`);
        } else {
          console.error('Failed to fetch messages:', data.error);
          showToast(data.error || 'Failed to load messages.', 'error');
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        showToast('Network error while fetching messages.', 'error');
      }
    };

    fetchMessages();
  }, [jobId, showToast, jobType]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [cardMessages]);

  const handleSendMessageForCard = async () => {
    if (!cardNewMessage.trim()) {
      showToast('Please enter a message.', 'error');
      return;
    }
    if (!currentUserId || !jobId || !otherPartyId) {
      showToast('Cannot send message: missing required info (user, job, or recipient).', 'error');
      return;
    }

    const messageData = {
      senderId: currentUserId,
      receiverId: otherPartyId,
      messageText: cardNewMessage,
      timestamp: new Date().toISOString(),
      senderUserType: currentUserType
    };

    // Conditionally add negotiation_id or direct_upload_job_id
    if (isDirectUploadJob) {
        messageData.directUploadJobId = jobId;
    } else {
        messageData.negotiationId = jobId;
    }

    let tempMessageId; 
    try {
      tempMessageId = `temp-${Date.now()}`;
      const optimisticMessage = {
          id: tempMessageId,
          sender_id: currentUserId,
          receiver_id: otherPartyId,
          // Use the correct ID field for optimistic message
          [isDirectUploadJob ? 'direct_upload_job_id' : 'negotiation_id']: jobId,
          content: cardNewMessage,
          timestamp: formatDisplayTimestamp(new Date().toISOString()),
          sender_name: currentUserType === 'client' ? user.full_name : otherPartyName,
          isOptimistic: true,
      };
      setCardMessages(prevMessages => [...prevMessages, optimisticMessage]);


      await sendMessage(messageData); 
      
      setCardNewMessage(''); 
    } catch (error) {
      showToast(error.message || 'Failed to send message.', 'error');
      if (tempMessageId) { 
        setCardMessages(prevMessages => prevMessages.filter(msg => !msg.isOptimistic || msg.id !== tempMessageId));
      }
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsSendingFile(true);
    showToast('Uploading file...! Attention: Only send transcription files here.', 'info'); // Updated toast message

    let tempMessageId; 
    try {
      const uploadResponse = await uploadChatAttachment(file);
      if (uploadResponse.fileUrl) {
        const messageData = {
          senderId: currentUserId,
          receiverId: otherPartyId,
          messageText: `Attached file: ${uploadResponse.fileName}`,
          fileUrl: uploadResponse.fileUrl,
          fileName: uploadResponse.fileName,
          timestamp: new Date().toISOString(),
          senderUserType: currentUserType
        };

        // Conditionally add negotiation_id or direct_upload_job_id
        if (isDirectUploadJob) {
            messageData.directUploadJobId = jobId;
        } else {
            messageData.negotiationId = jobId;
        }

        tempMessageId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempMessageId,
            sender_id: currentUserId,
            receiver_id: otherPartyId,
            [isDirectUploadJob ? 'direct_upload_job_id' : 'negotiation_id']: jobId,
            content: messageData.messageText,
            timestamp: formatDisplayTimestamp(new Date().toISOString()),
            sender_name: currentUserType === 'client' ? user.full_name : otherPartyName,
            file_url: messageData.fileUrl,
            file_name: messageData.fileName,
            isOptimistic: true,
        };
        setCardMessages(prevMessages => [...prevMessages, optimisticMessage]);

        await sendMessage(messageData); 

        showToast('File sent successfully! Transcriber will review.', 'success'); // Updated toast message
      } else {
        showToast('File upload failed: No URL returned.', 'error');
      }
    } catch (error) {
      console.error('Error uploading or sending file:', error);
      showToast(error.message || 'Failed to upload and send file.', 'error');
      if (tempMessageId) { 
        setCardMessages(prevMessages => prevMessages.filter(msg => !msg.isOptimistic || msg.id !== tempMessageId));
      }
    } finally {
      setIsSendingFile(false);
      event.target.value = null; 
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="negotiation-card">
      <div className="negotiation-header">
        <div className={`
          ${isClientViewing ? 'transcriber-info' : 'client-info'}
        `}>
          <div className={`
            ${isClientViewing ? 'transcriber-avatar' : 'client-avatar'}
          `}>
            {otherPartyName.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="client-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}> {/* New flex container */}
              <h3>{otherPartyName}</h3>
            </div>
            {isClientViewing ? (
              <div className="transcriber-stats">
                <span className="rating">
                  {'★'.repeat(Math.floor(otherParty?.average_rating || 0))}
                  ({(otherParty?.average_rating || 0).toFixed(1)})
                </span>
                <span className="completed">{otherParty?.completed_jobs || 0} jobs</span>
              </div>
            ) : (
              // FIXED: Display client's completed jobs and rating correctly
              <div className="client-stats">
                <span className="client-rating-stars">
                  {/* Use clientAverageRating for stars */}
                  {'★'.repeat(Math.floor(clientAverageRating))}
                  {'☆'.repeat(5 - Math.floor(clientAverageRating))}
                  {/* Use clientAverageRating for number display */}
                  <span className="rating-number">({clientAverageRating.toFixed(1)})</span>
                </span>
                <span className="rating-label">Client Rating</span>
                {clientCompletedJobs !== undefined && ( // Only display if prop is provided
                    <span className="completed-jobs-count" style={{ marginLeft: '10px' }}>
                        ({clientCompletedJobs} jobs completed)
                    </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={`
          ${isClientViewing ? 'negotiation-status' : 'negotiation-status-badge'}
        `}>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(negotiation.status) }}
          >
            {getStatusText(negotiation.status)}
          </span>
        </div>
      </div>

      <div className="negotiation-details">
        <div className="detail-row">
          <span className="label">Project Requirements:</span>
          <span className="value">{isDirectUploadJob ? negotiation.client_instructions : negotiation.requirements}</span>
        </div>
        {(negotiation.negotiation_files || negotiation.file_name) && ( // Conditionally render attached file for both types
          <div className="detail-row">
            <span className="label">Attached File:</span>
            <span className="value">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDownloadFile(jobId, isDirectUploadJob ? negotiation.file_name : negotiation.negotiation_files, jobType);
                }}
                className="file-link-button"
                type="button"
              >
                📄 {isDirectUploadJob ? negotiation.file_name : negotiation.negotiation_files}
              </button>
            </span>
          </div>
        )}
        <div className="detail-row">
          <span className="label">Agreed Price:</span>
          <span className="value price">USD {isDirectUploadJob ? negotiation.quote_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : negotiation.agreed_price_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="detail-row">
          <span className="label">Deadline:</span>
          <span className="value">
            {isDirectUploadJob ? negotiation.agreed_deadline_hours : negotiation.deadline_hours} hours
            {/* NEW: Dynamic deadline counter display */}
            {timeLeft && timeLeft !== 'OVERDUE' && (
                <span className="time-left-display" style={{ marginLeft: '10px', color: 'green', fontWeight: 'bold' }}>
                    ({timeLeft} left)
                </span>
            )}
            {isOverdue && timeLeft === 'OVERDUE' && (
                <span className="due-date-display" style={{ marginLeft: '10px', color: 'red', fontWeight: 'bold' }}> - OVERDUE</span>
            )}
          </span>
        </div>
        <div className="detail-row">
          <span className="label">Requested:</span>
          <span className="value">{new Date(negotiation.created_at).toLocaleDateString()}</span>
        </div>
        {(negotiation.status === 'completed' || negotiation.status === 'client_completed') && (negotiation.completed_at || negotiation.client_completed_at) && (
            <div className="detail-row">
                <span className="label">Completed At:</span>
                <span className="value">{formatDisplayTimestamp(negotiation.completed_at || negotiation.client_completed_at)}</span>
            </div>
        )}
        {(negotiation.status === 'completed' || negotiation.status === 'client_completed') && (negotiation.client_feedback_comment || negotiation.client_feedback_rating) && (
            <div className="detail-row client-feedback-section">
                <span className="label">Client Feedback:</span>
                <span className="value">
                    {negotiation.client_feedback_rating && (
                        <div className="rating-display" style={{ marginBottom: '5px' }}>
                            {'★'.repeat(negotiation.client_feedback_rating)}
                            {'☆'.repeat(5 - negotiation.client_feedback_rating)}
                            <span className="rating-number">({negotiation.client_feedback_rating.toFixed(1)})</span>
                        </div>
                    )}
                    {negotiation.client_feedback_comment && (
                        <p style={{ margin: 0, fontStyle: 'italic', color: '#555' }}>"{negotiation.client_feedback_comment}"</p>
                    )}
                    {!negotiation.client_feedback_comment && !negotiation.client_feedback_rating && <p>No feedback provided.</p>}
                </span>
            </div>
        )}
      </div>

      {negotiation.transcriber_response && negotiation.status !== 'pending' && (
        <div className="transcriber-response">
          <h4>Transcriber Response:</h4>
          <p>{negotiation.transcriber_response}</p>
        </div>
      )}
      {negotiation.client_response && negotiation.status === 'transcriber_counter' && (
        <div className="client-response">
          <h4>Client Response to Counter:</h4>
          <p>{negotiation.client_response}</p>
        </div>
      )}

      {/* --- CHAT INTEGRATION FOR THIS CARD --- */}
      {negotiation.status !== 'completed' && negotiation.status !== 'client_completed' && (
      <div className="chat-section" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        <h4 style={{ marginBottom: '10px' }}>Chat with {otherPartyName}</h4>
        <div ref={chatWindowRef} className="chat-window-content" style={{
            height: '200px',
            overflowY: 'auto',
            border: '1px solid #e0e0e0',
            marginBottom: '10px',
            padding: '10px',
            backgroundColor: '#f9f9f9',
            borderRadius: '5px'
        }}>
            {cardMessages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999' }}>No messages yet.</p>
            ) : (
              cardMessages.map((msg) => (
                <div key={msg.id} className={`message-bubble ${msg.sender_id === currentUserId ? 'sent' : 'received'}`} style={{
                    display: 'flex',
                    justifyContent: msg.sender_id === currentUserId ? 'flex-end' : 'flex-start',
                    marginBottom: '8px'
                }}>
                    <div style={{
                        background: msg.sender_id === currentUserId ? '#dcf8c6' : '#e5e5ea',
                        padding: '8px 12px',
                        borderRadius: '15px',
                        maxWidth: '70%',
                        wordWrap: 'break-word',
                        position: 'relative'
                    }}>
                        {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                        {msg.file_url && (
                            <div style={{ marginTop: msg.content ? '5px' : '0' }}>
                                <a 
                                    href={`${STATIC_FILES_URL}${msg.file_url}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: '#007bff', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    📄 {msg.file_name || 'Attached File'}
                                </a>
                            </div>
                        )}
                        <div style={{
                            fontSize: '0.65em',
                            color: '#666',
                            marginTop: '2px',
                            textAlign: msg.sender_id === currentUserId ? 'right' : 'left'
                        }}>
                            {msg.timestamp}
                        </div>
                    </div>
                </div>
              ))
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/jpg,image/png,image/gif,audio/*,video/*" // Added audio/video to accepted types
                disabled={isSendingFile}
            />
            <button
                onClick={triggerFileInput}
                style={{
                    padding: '10px 12px',
                    borderRadius: '5px',
                    background: '#6a0dad',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    marginRight: '5px'
                }}
                disabled={isSendingFile}
                title="Attach File (Docs, PDFs, Images, Audio, Video)" // Updated title
            >
                📎
            </button>
            <input
                type="text"
                value={cardNewMessage}
                onChange={(e) => setCardNewMessage(e.target.value)}
                placeholder="Type your message..."
                style={{
                    flexGrow: 1,
                    padding: '10px',
                    marginRight: '5px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '0.9em'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessageForCard()}
                disabled={isSendingFile}
            />
            <button
                onClick={handleSendMessageForCard}
                style={{
                    padding: '10px 15px',
                    borderRadius: '5px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9em'
                }}
                disabled={isSendingFile || !cardNewMessage.trim()}
            >
                Send
            </button>
        </div>
      </div>
      )}

      {/* Action Buttons (Conditional rendering based on user type and status) */}
      <div className="negotiation-actions">
        {isClientViewing ? (
          <div> {/* Wrap client actions in a div */}
            {/* Client Actions */}
            {negotiation.status === 'pending' && (
              <div className="pending-actions">
                <span className="waiting-text">⏳ Waiting for transcriber response...</span>
                {onDelete && <button
                  onClick={() => onDelete(jobId)}
                  className="cancel-negotiation-btn"
                >
                  Cancel Negotiation
                </button>}
              </div>
            )}

            {negotiation.status === 'transcriber_counter' && (
              <div className="countered-actions">
                  <span className="info-text">📝 Transcriber sent a counter-offer!</span>
                  {openAcceptCounterModal && <button onClick={(e) => { e.stopPropagation(); openAcceptCounterModal(jobId); }} className="action-btn accept-counter-btn">Accept Counter</button>}
                  {openCounterBackModal && <button onClick={(e) => { e.stopPropagation(); openCounterBackModal(jobId); }} className="action-btn counter-back-btn">Counter Back</button>}
                  {openRejectCounterModal && <button onClick={(e) => { e.stopPropagation(); openRejectCounterModal(jobId); }} className="action-btn reject-counter-btn">Reject Counter</button>}
              </div>
            )}

            {negotiation.status === 'accepted_awaiting_payment' && (
              <div className="agreed-actions">
                <span className="success-text">✅ Accepted! Proceed to Payment.</span>
                {onPayment && <button
                  onClick={(e) => { e.stopPropagation(); onPayment(negotiation); }} // Pass full job object
                  className="payment-btn"
                >
                  Proceed to Payment
                </button>}
              </div>
            )}
            {/* NEW: Client actions for direct upload jobs before transcriber takes it */}
            {negotiation.status === 'available_for_transcriber' && isDirectUploadJob && (
                <div className="available-direct-upload-actions">
                    <span className="info-text">🔎 Job paid! Waiting for a transcriber to take it.</span>
                </div>
            )}

            {(negotiation.status === 'hired' || negotiation.status === 'taken' || negotiation.status === 'in_progress') && (
              <div className="hired-actions">
                <span className="info-text">🎉 Job Active! {isDirectUploadJob ? 'Transcriber assigned.' : 'Transcriber hired.'}</span>
                {openCompleteJobModal && <button onClick={(e) => { e.stopPropagation(); openCompleteJobModal(negotiation); }} className="action-btn complete-job-btn">Mark as Complete</button>} {/* Pass full job object */}
              </div>
            )}

            {(negotiation.status === 'completed' || negotiation.status === 'client_completed') && (
              <div className="completed-status-message">
                  <span className="success-text">🎉 Job Completed!</span>
              </div>
            )}

            {negotiation.status === 'rejected' && (
              <div className="rejected-actions">
                <span className="error-text">❌ Negotiation was rejected.</span>
              </div>
            )}

            {negotiation.status === 'cancelled' && (
              <div className="cancelled-actions">
                <span className="error-text">❌ Job was cancelled.</span>
              </div>
            )}
            {(negotiation.status === 'rejected' || negotiation.status === 'cancelled' || negotiation.status === 'client_completed') && (
                <div className="closed-actions">
                    {onDelete && <button
                        onClick={(e) => { e.stopPropagation(); onDelete(jobId); }}
                        className="action-btn delete-closed-btn"
                    >
                        Delete from List
                    </button>}
                </div>
            )}
          </div> // Closing div for client actions
        ) : (
          <>
            {/* Transcriber Actions */}
            {negotiation.status === 'pending' && (
              <div className="transcriber-pending-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                {openAcceptModal && <button
                  onClick={(e) => { e.stopPropagation(); openAcceptModal(jobId); }}
                  className="action-btn accept-btn"
                >
                  Accept
                </button>}
                {canCounter && onOpenCounterModal && <button
                  onClick={(e) => { e.stopPropagation(); onOpenCounterModal(jobId); }}
                  className="action-btn counter-btn"
                >
                  Counter
                </button>}
                {openRejectModal && <button
                  onClick={(e) => { e.stopPropagation(); openRejectModal(jobId); }}
                  className="action-btn reject-btn"
                >
                Reject
                </button>}
              </div>
            )}
            {negotiation.status === 'accepted_awaiting_payment' && (
                <div className="transcriber-awaiting-payment-actions">
                    <span className="info-text">⏳ Awaiting Client Payment...</span>
                </div>
            )}
            {/* NEW: Transcriber actions for direct upload job status */}
            {negotiation.status === 'available_for_transcriber' && isDirectUploadJob && (
                <div className="transcriber-available-direct-upload-actions">
                    <span className="info-text">✨ Job available for you to take!</span>
                </div>
            )}
            {(negotiation.status === 'hired' || negotiation.status === 'taken' || negotiation.status === 'in_progress') && (
                <div className="transcriber-active-actions">
                    <span className="success-text">✅ Job Active!</span>
                </div>
            )}
            {negotiation.status === 'client_counter' && (
                <div className="transcriber-client-countered-actions">
                    <span className="info-text">📝 Client sent a counter-offer!</span>
                    {openAcceptModal && <button onClick={(e) => { e.stopPropagation(); openAcceptModal(jobId); }} className="action-btn accept-client-counter-btn">Accept Client Counter</button>}
                    {canCounter && onOpenCounterModal && <button 
                      onClick={(e) => { e.stopPropagation(); onOpenCounterModal(jobId); }} 
                      className="action-btn counter-client-counter-btn"
                    >
                      Counter Back
                    </button>}
                    {openRejectModal && <button onClick={(e) => { e.stopPropagation(); openRejectModal(jobId); }} className="action-btn reject-client-counter-btn">Reject Client Counter</button>}
                </div>
            )}
            {(negotiation.status === 'rejected' || negotiation.status === 'cancelled' || negotiation.status === 'completed' || negotiation.status === 'client_completed') && (
                <div className="transcriber-closed-actions">
                    <span className="info-text">Job {negotiation.status}.</span>
                </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}, arePropsEqual); // Pass the custom comparison function to React.memo

export default NegotiationCard;
