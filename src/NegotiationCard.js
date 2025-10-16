// src/NegotiationCard.js - Part 1 - COMPLETE AND CORRECTED (Final Version)

import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIXED: Import getSocketInstance and sendMessage from ChatService
import { getSocketInstance, sendMessage } from './ChatService'; 

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
  // Client-specific modal handlers (passed from ClientNegotiations)
  openAcceptCounterModal,
  openRejectCounterModal,
  openCounterBackModal,
  // Transcriber-specific modal handlers (passed from TranscriberNegotiations)
  openAcceptModal,
  openCounterModal,
  openRejectModal,
  openCompleteJobModal // Added for transcriber job completion
}) => {
  const negotiationId = negotiation.id;

  const isClientViewing = currentUserType === 'client';
  const otherParty = isClientViewing ? negotiation.users : negotiation.client_info;
  const otherPartyId = otherParty?.id;
  const otherPartyName = otherParty?.full_name || 'Unknown User';

  const [cardMessages, setCardMessages] = useState([]);
  const [cardNewMessage, setCardNewMessage] = useState('');
  const chatWindowRef = useRef(null); // Ref for auto-scrolling chat

  // Handler for receiving messages for this specific negotiation
  const handleReceiveMessageForCard = useCallback((data) => {
    // FIXED: Ensure the message is for *this* negotiation card
    if (data.negotiation_id === negotiationId) { // Check negotiation_id from backend payload
      setCardMessages(prevMessages => [...prevMessages, data]);
      console.log(`NegotiationCard: Message for ${negotiationId} received:`, data);
    }
  }, [negotiationId]);

  // Effect to set up listener for this card's messages
  useEffect(() => {
    // FIXED: Get the global socket instance from ChatService
    const socket = getSocketInstance();

    if (socket) {
      socket.on('receiveMessage', handleReceiveMessageForCard);
      console.log(`NegotiationCard: Attached 'receiveMessage' listener for negotiationId: ${negotiationId}`);
    }

    return () => {
      if (socket) {
        socket.off('receiveMessage', handleReceiveMessageForCard);
        console.log(`NegotiationCard: Detached 'receiveMessage' listener for negotiationId: ${negotiationId}`);
      }
    };
  }, [negotiationId, handleReceiveMessageForCard]); // Dependencies are correct

  // Fetch message history when the card loads
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn("NegotiationCard: Token missing, not fetching messages.");
          return;
        }

        const response = await fetch(`http://localhost:5000/api/messages/${negotiationId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setCardMessages(data.messages || []);
          console.log(`NegotiationCard: Fetched ${data.messages?.length || 0} messages for ${negotiationId}`);
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

  // Auto-scroll chat window to bottom
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [cardMessages]);

  // Handler to send a message from this card's input
  const handleSendMessageForCard = async () => { // Made async
    if (cardNewMessage.trim() && currentUserId && negotiationId && otherPartyId) {
      const messageData = {
        senderId: currentUserId,
        receiverId: otherPartyId,
        negotiationId: negotiationId,
        message: cardNewMessage,
        timestamp: new Date().toISOString()
      };
      
      try {
        await sendMessage(messageData); // Await the HTTP POST
        // On successful send, update local state immediately
        setCardMessages(prevMessages => [...prevMessages, { 
            ...messageData, 
            is_read: false, // Assume unread by receiver
            id: Date.now().toString() // Temporary ID for local display
        }]); 
        setCardNewMessage('');
      } catch (error) {
        showToast(error.message || 'Failed to send message.', 'error');
      }

    } else {
      if (!cardNewMessage.trim()) showToast('Please enter a message.', 'error');
      else showToast('Cannot send message: missing required info (user, negotiation, or recipient).', 'error');
    }
  };

  return (
    <div className="negotiation-card">
      <div className="negotiation-header">
        <div className={`${isClientViewing ? 'transcriber-info' : 'client-info'}`}>
          <div className={`${isClientViewing ? 'transcriber-avatar' : 'client-avatar'}`}>
            {otherPartyName.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className={`${isClientViewing ? 'transcriber-details' : 'client-details'}`}>
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
        <div className={`${isClientViewing ? 'negotiation-status' : 'negotiation-status-badge'}`}>
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
                href={`http://localhost:5000/uploads/negotiation_files/${negotiation.negotiation_files}`}
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
              cardMessages.map((msg, index) => (
                <div key={msg.id || index} className={`message-bubble ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}>
                    <p style={{
                        background: msg.sender_id === currentUserId ? '#dcf8c6' : '#e5e5ea',
                        padding: '8px 12px',
                        borderRadius: '15px',
                        display: 'inline-block',
                        maxWidth: '70%',
                        wordWrap: 'break-word'
                    }}>
                        {msg.content}
                    </p>
                    <div style={{
                        fontSize: '0.65em',
                        color: '#666',
                        marginTop: '2px'
                    }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
              ))
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
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

            {negotiation.status === 'accepted' && (
              <div className="agreed-actions">
                <span className="success-text">✅ Accepted! Ready to proceed.</span>
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
                <span className="info-text">🎉 Transcriber hired! Upload your files.</span>
                <button className="upload-btn">
                  Upload Audio Files
                </button>
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
            {(negotiation.status === 'completed' || negotiation.status === 'rejected' || negotiation.status === 'cancelled') && (
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
                {openCounterModal && <button
                  onClick={() => openCounterModal(negotiation.id)}
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
            {(negotiation.status === 'accepted' || negotiation.status === 'hired') && (
                <div className="transcriber-active-actions">
                    <span className="success-text">✅ Job Active!</span>
                    {openCompleteJobModal && <button onClick={() => openCompleteJobModal(negotiation.id)} className="action-btn complete-job-btn">Mark as Complete</button>}
                </div>
            )}
            {negotiation.status === 'client_counter' && (
                <div className="transcriber-client-countered-actions">
                    <span className="info-text">📝 Client sent a counter-offer!</span>
                    {openAcceptModal && <button onClick={() => openAcceptModal(negotiation.id)} className="action-btn accept-client-counter-btn">Accept Client Counter</button>}
                    {openCounterModal && <button onClick={() => openCounterModal(negotiation.id)} className="action-btn counter-client-counter-btn">Counter Back</button>}
                    {openRejectModal && <button onClick={() => openRejectModal(negotiation.id)} className="action-btn reject-client-counter-btn">Reject Client Counter</button>}
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NegotiationCard;
