import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSocketInstance, sendMessage, uploadChatAttachment } from './ChatService';
import Modal from './Modal';
import { useAuth } from './contexts/AuthContext'; // NEW: Import useAuth

const BACKEND_API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const STATIC_FILES_URL = BACKEND_API_URL; // Base URL for static files

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

const NegotiationCard = ({
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
  openCounterBackModal, // This prop is used to open the modal in ClientNegotiations.js
  openAcceptModal,
  onOpenCounterModal, // RENAMED: This is the function to open the counter modal
  openRejectModal,
  openCompleteJobModal,
  canCounter // NEW: Boolean prop to control if counter is allowed
}) => {
  const { user } = useAuth(); // NEW: Access user from AuthContext
  const negotiationId = negotiation.id;

  const isClientViewing = currentUserType === 'client';
  const otherParty = isClientViewing ? negotiation.users : negotiation.client_info;
  const otherPartyId = otherParty?.id;
  const otherPartyName = otherParty?.full_name || 'Unknown User';

  const [cardMessages, setCardMessages] = useState([]);
  const [cardNewMessage, setCardNewMessage] = useState('');
  const [isSendingFile, setIsSendingFile] = useState(false);
  const fileInputRef = useRef(null);
  const chatWindowRef = useRef(null);

  const [showRateTranscriberModal, setShowRateTranscriberModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingModalLoading, setRatingModalLoading] = useState(false);

  const handleReceiveMessageForCard = useCallback((data) => {
    // CRITICAL: Check if the message is for *this specific negotiation card*
    // And also ensure it's a negotiation message, not a direct message being caught by this listener
    if (data.negotiation_id === negotiationId && data.negotiation_id !== null) {
      setCardMessages(prevMessages => {
        // Deduplication: Prevent adding the same message multiple times
        // Also check if there's an optimistic message that this server message should replace
        const updatedMessages = prevMessages.map(m =>
            m.isOptimistic && m.sender_id === data.sender_id && m.content === data.content &&
            m.receiver_id === data.receiver_id && (m.file_url === data.file_url || (!m.file_url && !data.file_url))
                ? { ...data, isOptimistic: false, timestamp: formatDisplayTimestamp(data.timestamp) } // Format timestamp
                : m
        );

        if (!updatedMessages.some(m => m.id === data.id && !m.isOptimistic)) {
            const formattedData = {
              ...data,
              timestamp: formatDisplayTimestamp(data.timestamp) // Format timestamp
            };
            return [...updatedMessages, formattedData];
        }
        return updatedMessages;
      });
      console.log(`NegotiationCard: Message for ${negotiationId} received:`, data);
    } else {
        // Log if message is not for this card, or is a direct message being caught by a negotiation card listener
        console.log(`NegotiationCard: Received message not for this card (${negotiationId}) or is a direct message. Data:`, data);
    }
  }, [negotiationId]);

  useEffect(() => {
    const socket = getSocketInstance();

    if (socket) {
      // Attach the listener
      socket.on('newChatMessage', handleReceiveMessageForCard); // Listen for newChatMessage
      console.log(`NegotiationCard: Attached 'newChatMessage' listener for negotiationId: ${negotiationId}`);
    }

    return () => {
      // Detach the listener when the component unmounts
      if (socket) {
        socket.off('newChatMessage', handleReceiveMessageForCard);
        console.log(`NegotiationCard: Detached 'newChatMessage' listener for negotiationId: ${negotiationId}`);
      }
    };
  }, [negotiationId, handleReceiveMessageForCard]); // Dependencies for useEffect

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn("NegotiationCard: Token missing, not fetching messages.");
          return;
        }

        const response = await fetch(`${BACKEND_API_URL}/api/messages/${negotiationId}`, {
          method: 'GET', // Explicitly set method for clarity
          headers: {
            'Authorization': `Bearer ${token}` 
          }
        });
        const data = await response.json();
        if (response.ok) {
          const formattedMessages = (data.messages || []).map(msg => ({
            ...msg,
            timestamp: formatDisplayTimestamp(msg.timestamp) // Format timestamp
          }));
          setCardMessages(formattedMessages);
          console.log(`NegotiationCard: Fetched ${formattedMessages.length} messages for ${negotiationId}`);
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
  }, [negotiationId, showToast]);

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
    if (!currentUserId || !negotiationId || !otherPartyId) {
      showToast('Cannot send message: missing required info (user, negotiation, or recipient).', 'error');
      return;
    }

    const messageData = {
      senderId: currentUserId,
      receiverId: otherPartyId,
      negotiationId: negotiationId, // Ensure negotiationId is always present for negotiation chat
      messageText: cardNewMessage,
      timestamp: new Date().toISOString(),
      senderUserType: currentUserType
    };

    try {
      // Optimistic update
      const tempMessageId = `temp-${Date.now()}`;
      const optimisticMessage = {
          id: tempMessageId,
          sender_id: currentUserId,
          receiver_id: otherPartyId,
          negotiation_id: negotiationId,
          content: cardNewMessage,
          timestamp: formatDisplayTimestamp(new Date().toISOString()), // Format timestamp
          sender_name: currentUserType === 'client' ? user.full_name : otherPartyName, // Use user.full_name for client
          isOptimistic: true,
      };
      setCardMessages(prevMessages => [...prevMessages, optimisticMessage]);


      // Send message via HTTP POST
      const response = await sendMessage(messageData);
      
      // No need for separate optimistic update logic here, as handleNewChatMessage will deduplicate
      setCardNewMessage(''); // Clear input field
    } catch (error) {
      showToast(error.message || 'Failed to send message.', 'error');
      // If send fails, remove the optimistic message
      setCardMessages(prevMessages => prevMessages.filter(msg => !msg.isOptimistic || msg.id !== tempMessageId));
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsSendingFile(true);
    showToast('Uploading file...', 'info');

    try {
      const uploadResponse = await uploadChatAttachment(file);
      if (uploadResponse.fileUrl) {
        const messageData = {
          senderId: currentUserId,
          receiverId: otherPartyId,
          negotiationId: negotiationId,
          messageText: `Attached file: ${uploadResponse.fileName}`,
          fileUrl: uploadResponse.fileUrl,
          fileName: uploadResponse.fileName,
          timestamp: new Date().toISOString(),
          senderUserType: currentUserType
        };

        // Optimistic update for file attachments
        const tempMessageId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempMessageId,
            sender_id: currentUserId,
            receiver_id: otherPartyId,
            negotiation_id: negotiationId,
            content: messageData.messageText,
            timestamp: formatDisplayTimestamp(new Date().toISOString()), // Format timestamp
            sender_name: currentUserType === 'client' ? user.full_name : otherPartyName, // Use user.full_name for client
            file_url: messageData.fileUrl,
            file_name: messageData.fileName,
            isOptimistic: true,
        };
        setCardMessages(prevMessages => [...prevMessages, optimisticMessage]);

        // Send message via HTTP POST
        const response = await sendMessage(messageData);

        // No need for separate optimistic update logic here, as handleNewChatMessage will deduplicate
        showToast('File sent successfully!', 'success');
      } else {
        showToast('File upload failed: No URL returned.', 'error');
      }
    } catch (error) {
      console.error('Error uploading or sending file:', error);
      showToast(error.message || 'Failed to upload and send file.', 'error');
      // If send fails, remove the optimistic message
      setCardMessages(prevMessages => prevMessages.filter(msg => !msg.isOptimistic || msg.id !== tempMessageId));
    } finally {
      setIsSendingFile(false);
      event.target.value = null; // Clear file input
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const openRateTranscriberModal = useCallback(() => {
      setShowRateTranscriberModal(true);
      setRatingScore(5);
      setRatingComment('');
  }, []);

  const closeRateTranscriberModal = useCallback(() => {
      setShowRateTranscriberModal(false);
      setRatingModalLoading(false);
  }, []);

  const handleRatingChange = useCallback((e) => {
      setRatingScore(parseInt(e.target.value, 10));
  }, []);

  const handleCommentChange = useCallback((e) => {
      setRatingComment(e.target.value);
  }, []);

  const submitTranscriberRating = useCallback(async () => {
      setRatingModalLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
          showToast('Authentication token missing. Please log in again.', 'error');
          onLogout();
          return;
      }

      try {
          const response = await fetch(`${BACKEND_API_URL}/api/ratings/transcriber`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  negotiationId: negotiationId,
                  score: ratingScore,
                  comment: ratingComment
              })
          });
          const data = await response.json();

          if (response.ok) {
              showToast(data.message || 'Transcriber rated successfully!', 'success');
              closeRateTranscriberModal();
          } else {
              showToast(data.error || 'Failed to submit rating.', 'error');
          }
      } catch (error) {
          console.error('Error submitting transcriber rating:', error);
          showToast('Network error while submitting rating.', 'error');
      } finally {
          setRatingModalLoading(false);
      }
  }, [negotiationId, ratingScore, ratingComment, showToast, onLogout, closeRateTranscriberModal]);


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
          <div className={`
            ${isClientViewing ? 'transcriber-details' : 'client-details'}
          `}>
            <h3>{otherPartyName}</h3>
            {isClientViewing ? (
              <div className="transcriber-stats">
                <span className="rating">
                  {'★'.repeat(Math.floor(otherParty?.average_rating || 0))}
                  ({(otherParty?.average_rating || 0).toFixed(1)})
                </span>
                <span className="completed">{otherParty?.completed_jobs || 0} jobs</span>
              </div>
            ) : (
              <div className="client-stats">
                <span className="client-rating-stars">
                  {'★'.repeat(Math.floor(otherParty?.client_rating || 5.0))}
                  {'☆'.repeat(5 - Math.floor(otherParty?.client_rating || 5.0))}
                  <span className="rating-number">({(otherParty?.client_rating || 5.0).toFixed(1)})</span>
                </span>
                <span className="rating-label">Client Rating</span>
              </div>
            )}
          </div>
        </div>
        <div className={`
          ${isClientViewing ? 'negotiation-status' : 'negotiation-status-badge'}
        `}>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(negotiation.status, isClientViewing) }}
          >
            {getStatusText(negotiation.status, isClientViewing)}
          </span>
        </div>
      </div>

      <div className="negotiation-details">
        <div className="detail-row">
          <span className="label">Project Requirements:</span>
          <span className="value">{negotiation.requirements}</span>
        </div>
        {negotiation.negotiation_files && (
          <div className="detail-row">
            <span className="label">Attached File:</span>
            <span className="value">
              <a
                href={`${STATIC_FILES_URL}/uploads/negotiation_files/${negotiation.negotiation_files}`}
                target="_blank"
                rel="noopener noreferrer"
                className="file-link"
              >
                📄 {negotiation.negotiation_files}
              </a>
            </span>
          </div>
        )}
        <div className="detail-row">
          <span className="label">Agreed Price:</span>
          <span className="value price">KES {negotiation.agreed_price_kes?.toLocaleString()}</span>
        </div>
        <div className="detail-row">
          <span className="label">Deadline:</span>
          <span className="value">{negotiation.deadline_hours} hours</span>
        </div>
        <div className="detail-row">
          <span className="label">Requested:</span>
          <span className="value">{new Date(negotiation.created_at).toLocaleDateString()}</span>
        </div>
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
      <div className="chat-section" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        <h4>Chat with {otherPartyName}</h4>
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
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/jpg,image/png,image/gif"
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
                title="Attach File (Docs, PDFs, Images)"
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

      {/* Action Buttons (Conditional rendering based on user type and status) */}
      <div className="negotiation-actions">
        {isClientViewing ? (
          <>
            {/* Client Actions */}
            {negotiation.status === 'pending' && (
              <div className="pending-actions">
                <span className="waiting-text">⏳ Waiting for transcriber response...</span>
                {onDelete && <button
                  onClick={() => onDelete(negotiation.id)}
                  className="cancel-negotiation-btn"
                >
                  Cancel Negotiation
                </button>}
              </div>
            )}

            {negotiation.status === 'transcriber_counter' && (
              <div className="countered-actions">
                  <span className="info-text">📝 Transcriber sent a counter-offer!</span>
                  {openAcceptCounterModal && <button onClick={() => openAcceptCounterModal(negotiation.id)} className="action-btn accept-counter-btn">Accept Counter</button>}
                  {openCounterBackModal && <button onClick={() => openCounterBackModal(negotiation.id)} className="action-btn counter-back-btn">Counter Back</button>}
                  {openRejectCounterModal && <button onClick={() => openRejectCounterModal(negotiation.id)} className="action-btn reject-counter-btn">Reject Counter</button>}
              </div>
            )}

            {negotiation.status === 'accepted_awaiting_payment' && (
              <div className="agreed-actions">
                <span className="success-text">✅ Accepted! Proceed to Payment.</span>
                {onPayment && <button
                  onClick={() => onPayment(negotiation)}
                  className="payment-btn"
                >
                  Proceed to Payment
                </button>}
              </div>
            )}

            {negotiation.status === 'hired' && (
              <div className="hired-actions">
                <span className="info-text">🎉 Job Active! Transcriber hired.</span>
                <button className="upload-btn">
                  Upload Audio Files
                </button>
              </div>
            )}

            {negotiation.status === 'completed' && (
              <div className="completed-actions">
                  <span className="success-text">🎉 Job Completed!</span>
                  <button onClick={openRateTranscriberModal} className="action-btn rate-transcriber-btn">Rate Transcriber</button>
              </div>
            )}

            {negotiation.status === 'rejected' && (
              <div className="rejected-actions">
                <span className="error-text">❌ Negotiation was rejected.</span>
              </div>
            )}

            {negotiation.status === 'cancelled' && (
              <div className="cancelled-actions">
                <span className="error-text">❌ Negotiation was cancelled.</span>
              </div>
            )}
            {(negotiation.status === 'rejected' || negotiation.status === 'cancelled') && (
                <div className="closed-actions">
                    {onDelete && <button
                        onClick={() => onDelete(negotiation.id)}
                        className="action-btn delete-closed-btn"
                    >
                        Delete from List
                    </button>}
                </div>
            )}
          </>
        ) : (
          <>
            {/* Transcriber Actions */}
            {negotiation.status === 'pending' && (
              <div className="transcriber-pending-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                {openAcceptModal && <button
                  onClick={() => openAcceptModal(negotiation.id)}
                  className="action-btn accept-btn"
                >
                  Accept
                </button>}
                {canCounter && onOpenCounterModal && <button // Use canCounter to enable/disable
                  onClick={() => onOpenCounterModal(negotiation.id)} // Renamed prop
                  className="action-btn counter-btn"
                >
                  Counter
                </button>}
                {openRejectModal && <button
                  onClick={() => openRejectModal(negotiation.id)}
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
            {negotiation.status === 'hired' && (
                <div className="transcriber-active-actions">
                    <span className="success-text">✅ Job Active!</span>
                    {openCompleteJobModal && <button onClick={() => openCompleteJobModal(negotiation.id)} className="action-btn complete-job-btn">Mark as Complete</button>}
                </div>
            )}
            {negotiation.status === 'client_counter' && (
                <div className="transcriber-client-countered-actions">
                    <span className="info-text">📝 Client sent a counter-offer!</span>
                    {openAcceptModal && <button onClick={() => openAcceptModal(negotiation.id)} className="action-btn accept-client-counter-btn">Accept Client Counter</button>}
                    {canCounter && onOpenCounterModal && <button // Use canCounter to enable/disable
                      onClick={() => onOpenCounterModal(negotiation.id)} // Renamed prop
                      className="action-btn counter-client-counter-btn"
                    >
                      Counter Back
                    </button>}
                    {openRejectModal && <button onClick={() => openRejectModal(negotiation.id)} className="action-btn reject-client-counter-btn">Reject Client Counter</button>}
                </div>
            )}
            {(negotiation.status === 'rejected' || negotiation.status === 'cancelled' || negotiation.status === 'completed') && (
                <div className="transcriber-closed-actions">
                    <span className="info-text">Negotiation {negotiation.status}.</span>
                </div>
            )}
          </>
        )}
      </div>

      {showRateTranscriberModal && (
          <Modal
              show={showRateTranscriberModal}
              title={`Rate ${otherPartyName}`}
              onClose={closeRateTranscriberModal}
              onSubmit={submitTranscriberRating}
              submitText="Submit Rating"
              loading={ratingModalLoading}
          >
              <p>How would you rate the transcriber's performance for this job?</p>
              <div className="form-group">
                  <label htmlFor="ratingScore">Score (1-5 Stars):</label>
                  <select
                      id="ratingScore"
                      name="ratingScore"
                      value={ratingScore}
                      onChange={handleRatingChange}
                      required
                  >
                      <option value="5">5 Stars - Excellent</option>
                      <option value="4">4 Stars - Very Good</option>
                      <option value="3">3 Stars - Good</option>
                      <option value="2">2 Stars - Fair</option>
                      <option value="1">1 Star - Poor</option>
                  </select>
              </div>
              <div className="form-group">
                  <label htmlFor="ratingComment">Comments (Optional):</label>
                  <textarea
                      id="ratingComment"
                      name="ratingComment"
                      value={ratingComment}
                      onChange={handleCommentChange}
                      placeholder="Share your feedback..."
                      rows="3"
                  ></textarea>
              </div>
          </Modal>
      )}
    </div>
  );
};

export default NegotiationCard;
