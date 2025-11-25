import React from 'react';
import './DirectUploadJobCard.css';

// Helper function to format timestamp robustly for display (copied from TranscriberDirectUploadJobs.js for consistency)
const formatDisplayTimestamp = (isoTimestamp) => {
    if (!isoTimestamp) return 'N/A';
    try {
        const date = new Date(isoTimestamp);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error(`Error formatting timestamp ${isoTimestamp}:`, e);
        return 'Invalid Date';
    }
};

const DirectUploadJobCard = ({
  job,
  onDelete,
  onPayment,
  onLogout, // Not directly used in the card, but passed down
  getStatusColor,
  getStatusText,
  showToast,
  currentUserId,
  currentUserType,
  openSubmitDirectJobModal, // Specific to transcriber submitting a direct job
  canSubmitDirectJob, // Specific to transcriber submitting a direct job
  openCancelJobModal, // NEW: Specific to transcriber cancelling a direct job
  canCancelDirectJob, // NEW: Specific to transcriber cancelling a direct job
  openCompleteJobModal, // Specific to client marking a direct job complete
  onDownloadFile,
  clientAverageRating, // Client's own average rating (for client view)
  clientCompletedJobs // Client's own completed jobs (for client view)
}) => {
  // Destructure job properties here, accounting for potential naming differences
  // from different API endpoints (e.g., quote_amount vs. agreed_price_usd)
  const {
    id,
    status,
    file_name,
    duration, // May be missing from client view if not directly returned
    quote_amount, // For client view
    agreed_price_usd, // For transcriber view, mapped from quote_amount
    created_at,
    transcriber_id,
    transcriber, // Full transcriber object
    client, // Full client object (for transcriber view)
    client_name, // For transcriber view
    client_average_rating: jobClientAverageRating, // For transcriber view
    agreed_deadline_hours, // For client view
    deadline_hours, // For transcriber view
    completed_on, // When transcriber completed it (for transcriber view)
    transcriber_comment, // Transcriber's comment on completion
    client_feedback_comment, // Client's feedback comment
    client_feedback_rating, // Client's feedback rating
    last_message_text,
    last_message_timestamp
  } = job;

  // Determine the price to display
  const displayPrice = agreed_price_usd || quote_amount;
  const displayDeadline = deadline_hours || agreed_deadline_hours;

  // Determine transcriber info (for client view)
  const assignedTranscriberName = transcriber?.full_name;
  const assignedTranscriberRating = transcriber?.transcriber_average_rating;
  const assignedTranscriberCompletedJobs = transcriber?.transcriber_completed_jobs; // Now used below

  // Determine client info (for transcriber view)
  const currentClientName = client_name || client?.full_name;
  const currentClientRating = jobClientAverageRating || client?.client_average_rating;


  const isTranscriber = currentUserType === 'transcriber';
  const isClient = currentUserType === 'client';

  const canChat = (isClient && transcriber_id) || (isTranscriber && status !== 'available_for_transcriber');

  const handleChatClick = () => {
    if (!canChat) {
      showToast('Chat is not available for this job yet.', 'info');
      return;
    }
    // Navigate to chat, assuming a route like /chat/direct-upload/:jobId
    window.location.href = `/chat/direct-upload/${id}`;
  };

  return (
    <div className="direct-upload-job-card">
      <div className="job-card-header">
        <h3>Direct Upload Job #{id?.substring(0, 8)}</h3>
        <span className="status-badge" style={{ backgroundColor: getStatusColor(status) }}>
          {getStatusText(status)}
        </span>
      </div>

      <div className="job-card-body">
        <p><strong>File:</strong> {file_name || 'N/A'}</p>
        {isClient && (
          <p>
            <strong>Transcriber:</strong> {assignedTranscriberName || 'Awaiting Assignment'}
            {assignedTranscriberName && assignedTranscriberCompletedJobs > 0 && (
                <span style={{ marginLeft: '5px', fontSize: '0.9em', color: '#555' }}>
                    ({assignedTranscriberCompletedJobs} jobs)
                </span>
            )}
          </p>
        )}
        {isTranscriber && (
          <p><strong>Client:</strong> {currentClientName || 'N/A'}</p>
        )}
        {displayPrice && <p><strong>Quote Amount:</strong> USD {displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
        {displayDeadline && <p><strong>Deadline:</strong> {displayDeadline} hours</p>}
        {duration && <p><strong>Audio Duration:</strong> {duration} minutes</p>}
        <p><strong>Created:</strong> {formatDisplayTimestamp(created_at)}</p>

        {isClient && assignedTranscriberName && assignedTranscriberRating > 0 && (
          <p><strong>Transcriber Rating:</strong> {'★'.repeat(Math.floor(assignedTranscriberRating))} ({assignedTranscriberRating.toFixed(1)})</p>
        )}
        {isTranscriber && currentClientRating > 0 && (
          <p><strong>Client Rating:</strong> {'★'.repeat(Math.floor(currentClientRating))} ({currentClientRating.toFixed(1)})</p>
        )}

        {status === 'completed' && isTranscriber && (
          <>
            <p><strong>Submitted On:</strong> {formatDisplayTimestamp(completed_on)}</p>
            <p><strong>Your Comment:</strong> {transcriber_comment || 'N/A'}</p>
          </>
        )}

        {status === 'client_completed' && (isTranscriber || isClient) && (
          <>
            <p><strong>Completed On:</strong> {formatDisplayTimestamp(completed_on)}</p>
            <p><strong>Client Feedback:</strong> {client_feedback_comment || 'N/A'}</p>
            {client_feedback_rating > 0 && (
              <p><strong>Client Rating:</strong> {'★'.repeat(client_feedback_rating)}</p>
            )}
          </>
        )}

        {last_message_text && (
            <p className="last-message-preview">
                <strong>Last Message:</strong> {last_message_text} <br />
                <small>{formatDisplayTimestamp(last_message_timestamp)}</small>
            </p>
        )}
      </div>

      <div className="job-actions">
        {/* Chat Button (Conditional) */}
        {canChat && (
          <button onClick={handleChatClick} className="action-btn chat-btn">
            Chat
          </button>
        )}

        {/* Client Actions */}
        {isClient && job.status === 'available_for_transcriber' && (
          <button
            onClick={() => onDelete(id, 'direct_upload')}
            className="action-btn delete-btn"
            title="Cancel Job"
          >
            Cancel
          </button>
        )}

        {isClient && (job.status === 'completed') && (
            <button
                onClick={() => openCompleteJobModal(job)}
                className="action-btn complete-btn"
            >
                Mark as Complete
            </button>
        )}

        {isClient && (job.status === 'taken' || job.status === 'in_progress' || job.status === 'available_for_transcriber') && (
            <button
                onClick={() => onDownloadFile(id, file_name, 'direct_upload')}
                className="action-btn download-btn"
                title="Download File"
            >
                Download File
            </button>
        )}

        {/* Transcriber Actions */}
        {isTranscriber && job.status === 'available_for_transcriber' && (
          <button
            onClick={() => onPayment(job)} // In this context, 'onPayment' might be 'take job' for direct upload
            className="action-btn accept-btn"
          >
            Take Job
          </button>
        )}

        {isTranscriber && (job.status === 'taken' || job.status === 'in_progress') && canSubmitDirectJob && (
          <button
            onClick={() => openSubmitDirectJobModal(id)}
            className="action-btn submit-btn"
          >
            Submit Work
          </button>
        )}

        {/* NEW: Transcriber Cancel Job Button */}
        {isTranscriber && (job.status === 'taken' || job.status === 'in_progress') && canCancelDirectJob && (
          <button
            onClick={() => openCancelJobModal(id)}
            className="action-btn cancel-btn"
            title="Cancel Job"
          >
            Cancel Job
          </button>
        )}

        {isTranscriber && (job.status === 'taken' || job.status === 'in_progress' || job.status === 'completed') && (
            <button
                onClick={() => onDownloadFile(id, file_name, 'direct_upload')}
                className="action-btn download-btn"
                title="Download File"
            >
                Download File
            </button>
        )}
        
        {isTranscriber && (job.status === 'completed' || job.status === 'client_completed') && (
            <button
                onClick={() => onDelete(id, 'direct_upload')}
                className="action-btn delete-btn"
                title="Delete from list"
            >
                Delete
            </button>
        )}
      </div>
    </div>
  );
};

export default DirectUploadJobCard;
