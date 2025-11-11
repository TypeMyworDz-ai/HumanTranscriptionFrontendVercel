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

// Custom comparison function for React.memo - now assumes only negotiation jobs
const arePropsEqual = (prevProps, nextProps) => {
    if (JSON.stringify(prevProps.job) !== JSON.stringify(nextProps.job)) {
        console.log(`NegotiationCard: Props changed - job. Prev:`, prevProps.job, `Next:`, nextProps.job);
        return false;
    }
    // Removed jobType comparison as it's now implicitly 'negotiation'

    if (prevProps.onDelete !== nextProps.onDelete) return false;
    if (prevProps.onPayment !== nextProps.onPayment) return false;
    if (prevProps.onLogout !== nextProps.onLogout) return false;
    if (prevProps.getStatusColor !== nextProps.getStatusColor) return false;
    if (prevProps.getStatusText !== nextProps.getStatusText) return false;
    if (prevProps.showToast !== nextProps.showToast) return false;
    if (prevProps.currentUserId !== nextProps.currentUserId) return false;
    if (prevProps.currentUserType !== nextProps.currentUserType) return false;
    if (prevProps.openAcceptCounterModal !== nextProps.openAcceptCounterModal) return false;
    if (prevProps.openRejectCounterModal !== nextProps.openRejectCounterModal) return false;
    if (prevProps.openCounterBackModal !== nextProps.openCounterBackModal) return false;
    if (prevProps.openAcceptModal !== nextProps.openAcceptModal) return false;
    if (prevProps.onOpenCounterModal !== nextProps.onOpenCounterModal) return false;
    if (prevProps.openRejectModal !== nextProps.openRejectModal) return false;
    if (prevProps.openCompleteJobModal !== nextProps.openCompleteJobModal) return false; 
    if (prevProps.canCounter !== nextProps.canCounter) return false;
    if (prevProps.onDownloadFile !== nextProps.onDownloadFile) return false;
    if (prevProps.clientCompletedJobs !== nextProps.clientCompletedJobs) return false;
    if (prevProps.clientAverageRating !== nextProps.clientAverageRating) return false;
    // Removed direct upload specific props from comparison

    return true;
};


const NegotiationCard = React.memo(({ 
  job, 
  // Removed jobType prop as this component now only handles negotiation jobs
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
  openCompleteJobModal, // For client to mark negotiation job complete (passed from ClientJobs)
  canCounter,
  onDownloadFile,
  clientCompletedJobs,
  clientAverageRating,
  // Removed direct upload specific props
}) => { 
  const { user } = useAuth(); 
  const jobId = job.id; 

  // Removed isDirectUploadJob as this component now only handles negotiation jobs.
  const isClientViewing = currentUserType === 'client';
  
  let otherPartyId;
  let otherPartyName;
  let otherPartyDetails; 

  if (isClientViewing) {
      otherPartyId = job.transcriber_id;
      otherPartyDetails = job.transcriber_info; 
      otherPartyName = otherPartyDetails?.full_name || 'Unknown Transcriber';
  } else { // Transcriber viewing
      otherPartyId = job.client_id;
      otherPartyDetails = job.client_info; 
      otherPartyName = otherPartyDetails?.full_name || 'Unknown Client';
  }

  const [cardMessages, setCardMessages] = useState([]);
  const [cardNewMessage, setCardNewMessage] = useState('');
  const [isSendingFile, setIsSendingFile] = useState(false);
  const fileInputRef = useRef(null);
  const chatWindowRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(null); 

  const calculateTimeLeft = useCallback(() => {
    console.log(`[NegotiationCard: ${jobId}] calculateTimeLeft triggered.`);
    console.log(`[NegotiationCard: ${jobId}] Raw due_date:`, job.due_date);

    const deadlineTimestamp = job.due_date; 

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

    const difference = dueDate.getTime() - now.getTime(); 
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
  }, [job.due_date, jobId]);


  const isOverdue = (job.status !== 'completed' && job.status !== 'client_completed' && job.status !== 'rejected' && job.status !== 'cancelled') && (
    job.due_date && new Date(job.due_date) < new Date() 
  );


  useEffect(() => {
    console.log(`[NegotiationCard: ${jobId}] useEffect for deadline counter triggered.`);
    console.log(`[NegotiationCard: ${jobId}] Current job status: ${job.status}`);
    console.log(`[NegotiationCard: ${jobId}] Has deadline: ${!!(job.due_date)}`);


    if (!(job.due_date) || job.status === 'completed' || job.status === 'client_completed' || job.status === 'rejected' || job.status === 'cancelled') {
        console.log(`[NegotiationCard: ${jobId}] Stopping deadline counter. Status: ${job.status}, Deadline present: ${!!(job.due_date)}`);
        setTimeLeft(null);
        return;
    }

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => {
        console.log(`[NegotiationCard: ${jobId}] Clearing deadline counter interval.`);
        clearInterval(timer);
    }
  }, [job.due_date, job.status, calculateTimeLeft, jobId]);


  const handleReceiveMessageForCard = useCallback((data) => {
    const isMessageForThisJob = (data.negotiation_id === jobId); 

    if (isMessageForThisJob) {
      setCardMessages(prevMessages => {
        const updatedMessages = prevMessages.map(m =>
            m.isOptimistic && m.sender_id === data.sender_id && m.content === data.content &&
            m.receiver_id === data.receiver_id && (m.file_url === data.file_url || (!m.file_url && !data.file_url))
                ? { ...data, isOptimistic: false, timestamp: formatDisplayTimestamp(data.timestamp) }
                : m
        );

        if (!updatedMessages.some(m => m.id === data.id && !m.isOptimistic)) {
            const formattedData = {
                ...data,
                timestamp: formatDisplayTimestamp(data.timestamp)
            };
            if (!prevMessages.find(m => m.id === data.id && !m.isOptimistic)) {
                 return [...updatedMessages, formattedData];
            }
        }
        return updatedMessages;
      });
      console.log(`NegotiationCard: Message for ${jobId} received:`, data);
    } else {
        console.log(`NegotiationCard: Received message not for this card (${jobId}) or is a direct message. Data:`, data);
    }
  }, [jobId]);

  useEffect(() => {
    const socket = getSocketInstance();

    if (socket) {
      socket.on('newChatMessage', handleReceiveMessageForCard);
      console.log(`NegotiationCard: Attached 'newChatMessage' listener for jobId: ${jobId}`);
    }

    return () => {
      if (socket) {
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
          console.log(`NegotiationCard: Fetched ${formattedMessages.length} messages for ${jobId}`);
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
  }, [jobId, showToast]);

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
      console.error('Missing info for sending message:', { currentUserId, jobId, otherPartyId });
      return;
    }

    const messageData = {
      senderId: currentUserId,
      receiverId: otherPartyId,
      messageText: cardNewMessage,
      timestamp: new Date().toISOString(),
      senderUserType: currentUserType
    };

    messageData.negotiationId = jobId; 

    let tempMessageId; 
    try {
      tempMessageId = `temp-${Date.now()}`;
      const optimisticMessage = {
          id: tempMessageId,
          sender_id: currentUserId,
          receiver_id: otherPartyId,
          negotiation_id: jobId, 
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
    showToast('Uploading file...! Attention: Only send transcription files here.', 'info');

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

        messageData.negotiationId = jobId; 

        tempMessageId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempMessageId,
            sender_id: currentUserId,
            receiver_id: otherPartyId,
            negotiation_id: jobId, 
            content: messageData.messageText,
            timestamp: formatDisplayTimestamp(new Date().toISOString()),
            sender_name: currentUserType === 'client' ? user.full_name : otherPartyName,
            file_url: messageData.fileUrl,
            file_name: messageData.fileName,
            isOptimistic: true,
        };
        setCardMessages(prevMessages => [...prevMessages, optimisticMessage]);

        await sendMessage(messageData); 

        showToast('File sent successfully! Transcriber will review.', 'success');
      } else {
        showToast('File upload failed: No URL returned.','error');
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

  // Condition for displaying chat - Only for negotiation jobs
  const shouldDisplayChat = (
    (currentUserType === 'client' && (job.status === 'hired' || job.status === 'in_progress' || job.status === 'completed')) ||
    (currentUserType === 'transcriber' && (job.status === 'hired' || job.status === 'in_progress')) // Removed 'taken' as it's not a negotiation status for chat
  );


  return (
    <div className="negotiation-card">
      <div className="negotiation-header">
        <div className={
          `${isClientViewing ? 'transcriber-info' : 'client-info'}`
        }>
          <div className={
            `${isClientViewing ? 'transcriber-avatar' : 'client-avatar'}`
          }>
            {otherPartyName.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="client-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3>{otherPartyName}</h3>
            </div>
            {isClientViewing ? (
              <div className="transcriber-stats">
                <span className="rating">
                  {'★'.repeat(Math.floor(otherPartyDetails?.transcriber_average_rating || 0))}
                  ({(otherPartyDetails?.transcriber_average_rating || 0).toFixed(1)})
                </span>
                <span className="completed">{otherPartyDetails?.transcriber_completed_jobs || 0} jobs</span>
              </div>
            ) : (
              <div className="client-stats">
                {clientAverageRating > 0 ? (
                  <span className="client-rating-stars">
                    {'★'.repeat(Math.floor(clientAverageRating))}
                    {'☆'.repeat(5 - Math.floor(clientAverageRating))}
                    <span className="rating-number">({clientAverageRating.toFixed(1)})</span>
                    <span className="rating-label" style={{ marginLeft: '5px' }}>Client Rating</span>
                  </span>
                ) : (
                  <span className="rating-label">No rating yet</span>
                )}
                {clientCompletedJobs !== undefined && ( 
                    <span className="completed-jobs-count" style={{ marginLeft: '10px' }}>
                        ({clientCompletedJobs} jobs completed)
                    </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={
          `${isClientViewing ? 'negotiation-status' : 'negotiation-status-badge'}`
        }>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(job.status, isClientViewing) }}
          >
            {getStatusText(job.status, isClientViewing)}
          </span>
        </div>
      </div>

      <div className="negotiation-details">
        <div className="detail-row">
          <span className="label">Project Requirements:</span>
          <span className="value">{job.requirements}</span> 
        </div>
        {job.negotiation_files && ( 
          <div className="detail-row">
            <span className="label">Attached File:</span>
            <span className="value">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDownloadFile(jobId, job.negotiation_files, 'negotiation'); // Explicitly pass 'negotiation' jobType
                }}
                className="file-link-button"
                type="button"
              >
                📄 {job.negotiation_files}
              </button>
            </span>
          </div>
        )}
        <div className="detail-row">
          {/* UPDATED: Label for price is now always 'Agreed Price' */}
          <span className="label">Agreed Price:</span>
          <span className="value price">USD {job.agreed_price_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> 
        </div>
        <div className="detail-row">
          <span className="label">Deadline:</span>
          <span className="value">
            {job.deadline_hours} hours 
            {/* Dynamic deadline counter display */}
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
          <span className="value">{new Date(job.created_at).toLocaleDateString()}</span>
        </div>
        {(job.status === 'completed' || job.status === 'client_completed') && job.completed_at && ( 
            <div className="detail-row">
                <span className="label">Completed At:</span>
                <span className="value">{formatDisplayTimestamp(job.completed_at)}</span> 
            </div>
        )}
        {(job.status === 'completed' || job.status === 'client_completed') && (job.client_feedback_comment || job.client_feedback_rating) && (
            <div className="detail-row client-feedback-section">
                <span className="label">Client Feedback:</span>
                <span className="value">
                    {job.client_feedback_rating && (
                        <div className="rating-display" style={{ marginBottom: '5px' }}>
                            {'★'.repeat(job.client_feedback_rating)}
                            {'☆'.repeat(5 - job.client_feedback_rating)}
                            <span className="rating-number">({job.client_feedback_rating.toFixed(1)})</span>
                        </div>
                    )}
                    {job.client_feedback_comment && (
                        <p style={{ margin: 0, fontStyle: 'italic', color: '#555' }}>"{job.client_feedback_comment}"</p>
                    )}
                    {!job.client_feedback_comment && !job.client_feedback_rating && <p>No feedback provided.</p>}
                </span>
            </div>
        )}
      </div>

      {job.transcriber_response && job.status !== 'pending' && (
        <div className="transcriber-response">
          <h4>Transcriber Response:</h4>
          <p>{job.transcriber_response}</p>
        </div>
      )}
      {job.client_response && job.status === 'transcriber_counter' && (
        <div className="client-response">
          <h4>Client Response to Counter:</h4>
          <p>{job.client_response}</p>
        </div>
      )}

      {/* --- CHAT INTEGRATION FOR THIS CARD --- */}
      {shouldDisplayChat && ( 
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
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/jpg,image/png,image/gif,audio/*,video/*"
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
                title="Attach File (Docs, PDFs, Images, Audio, Video)"
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
            {job.status === 'pending' && (
              <div className="pending-actions">
                <span className="waiting-text">⏳ Waiting for transcriber response...</span>
                {onDelete && <button
                  onClick={() => onDelete(jobId, 'negotiation')} // Explicitly pass 'negotiation' jobType
                  className="cancel-negotiation-btn"
                >
                  Cancel Negotiation
                </button>}
              </div>
            )}

            {job.status === 'transcriber_counter' && (
              <div className="countered-actions">
                  <span className="info-text">📝 Transcriber sent a counter-offer!</span>
                  {openAcceptCounterModal && <button onClick={(e) => { e.stopPropagation(); openAcceptCounterModal(jobId); }} className="action-btn accept-counter-btn">Accept Counter</button>}
                  {openCounterBackModal && <button onClick={(e) => { e.stopPropagation(); openCounterBackModal(jobId); }} className="action-btn counter-back-btn">Counter Back</button>}
                  {openRejectCounterModal && <button onClick={(e) => { e.stopPropagation(); openRejectCounterModal(jobId); }} className="action-btn reject-counter-btn">Reject Counter</button>}
              </div>
            )}

            {job.status === 'accepted_awaiting_payment' && (
              <div className="agreed-actions">
                <span className="success-text">✅ Accepted! Proceed to Payment.</span>
                {onPayment && <button
                  onClick={(e) => { e.stopPropagation(); onPayment(job); }}
                  className="payment-btn"
                >
                  Proceed to Payment
                </button>}
              </div>
            )}

            {/* Client can mark negotiation jobs complete if transcriber has completed it */}
            {(job.status === 'hired' || job.status === 'in_progress' || job.status === 'completed') && openCompleteJobModal && (
                <div className="hired-actions">
                    <span className="info-text">🎉 Job Active! Transcriber hired.</span> 
                    <button onClick={(e) => { e.stopPropagation(); openCompleteJobModal(job); }} className="action-btn complete-job-btn">Mark as Complete</button>
                </div>
            )}

            {(job.status === 'completed' || job.status === 'client_completed') && (
              <div className="completed-status-message">
                  <span className="success-text">🎉 Job Completed!</span>
              </div>
            )}

            {job.status === 'rejected' && (
              <div className="rejected-actions">
                <span className="error-text">❌ Negotiation was rejected.</span>
              </div>
            )}

            {job.status === 'cancelled' && (
              <div className="cancelled-actions">
                <span className="error-text">❌ Job was cancelled.</span>
              </div>
            )}
            {(job.status === 'rejected' || job.status === 'cancelled' || job.status === 'client_completed') && (
                <div className="closed-actions">
                    {onDelete && <button
                        onClick={(e) => { e.stopPropagation(); onDelete(jobId, 'negotiation'); }} // Explicitly pass 'negotiation' jobType
                        className="action-btn delete-closed-btn"
                    >
                        Delete from List
                    </button>}
                </div>
            )}
          </div>
        ) : (
          <>
            {/* Transcriber Actions */}
            {job.status === 'pending' && (
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
            {job.status === 'accepted_awaiting_payment' && (
                <div className="transcriber-awaiting-payment-actions">
                    <span className="info-text">⏳ Awaiting Client Payment...</span>
                </div>
            )}
            {(job.status === 'hired' || job.status === 'in_progress') && ( 
                <div className="transcriber-active-actions">
                    <span className="success-text">✅ Job Active!</span>
                    {(job.status === 'hired' || job.status === 'in_progress') && openCompleteJobModal && (
                        <button onClick={(e) => { e.stopPropagation(); openCompleteJobModal(jobId); }} className="action-btn submit-job-btn">
                            Mark as Complete
                        </button>
                    )}
                </div>
            )}
            {job.status === 'client_counter' && (
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
            {(job.status === 'rejected' || job.status === 'cancelled' || job.status === 'completed' || job.status === 'client_completed') && (
                <div className="transcriber-closed-actions">
                    <span className="info-text">Job {getStatusText(job.status)}.</span>
                </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}, arePropsEqual);

export default NegotiationCard;
