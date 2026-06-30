import React, { useState, useEffect } from 'react';
import './TicketEditModal.css';
import { FaPaperclip, FaRegPaperPlane, FaHistory, FaImage, FaFile, FaDownload, FaTrash, FaPlus, FaClock, FaUser, FaCheck } from 'react-icons/fa';
import { getTicketMessages, getUsers } from '../services/api';

const TicketEditModal = ({ ticket, onClose, onSave }) => {
  const [editedTicket, setEditedTicket] = useState(ticket);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ticketAttachments, setTicketAttachments] = useState([]);
  const [showTicketHistory, setShowTicketHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [saveError, setSaveError] = useState(null);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    // Fetch comments for this ticket
    fetchComments();
    // Fetch registered users for assignee dropdown
    fetchRegisteredUsers();
  }, [ticket.id]);

  const fetchComments = async () => {
    try {
      const data = await getTicketMessages(ticket.id);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchRegisteredUsers = async () => {
    try {
      const data = await getUsers();
      setRegisteredUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedTicket(prev => ({
      ...prev,
      [field]: value
    }));
    setSaveStatus('unsaved');
    
    // Real-time title validation
    if (field === 'title') {
      const trimmedValue = value.trim();
      
      // Check for empty or whitespace-only title
      if (!trimmedValue) {
        setTitleError(true);
        return;
      }
      
      // Check for invalid characters (quotes, slashes, etc.)
      const invalidChars = /[""'`\\\/]/;
      if (invalidChars.test(trimmedValue)) {
        setTitleError(true);
        return;
      }
      
      // Check if title contains only special characters or symbols
      const onlySpecialChars = /^[^a-zA-Z0-9\s]+$/;
      if (onlySpecialChars.test(trimmedValue)) {
        setTitleError(true);
        return;
      }
      
      // Clear error if title is valid
      setTitleError(false);
    }
  };

  const handleSave = async () => {
    // Validate title - check if it's empty, contains only whitespace, or invalid characters
    const trimmedTitle = editedTicket.title.trim();
    if (!trimmedTitle) {
      setTitleError(true);
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'toast-message error';
      errorToast.textContent = 'Title cannot be empty or contain only spaces, tabs, or line breaks. Please enter a valid title.';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
      return;
    }
    
    // Check for invalid characters (quotes, slashes, etc.)
    const invalidChars = /[""'`\\\/]/;
    if (invalidChars.test(trimmedTitle)) {
      setTitleError(true);
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'toast-message error';
      errorToast.textContent = 'Title cannot contain quotes, slashes, or backslashes. Please enter a valid title.';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
      return;
    }
    
    // Check if title contains only special characters or symbols
    const onlySpecialChars = /^[^a-zA-Z0-9\s]+$/;
    if (onlySpecialChars.test(trimmedTitle)) {
      setTitleError(true);
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'toast-message error';
      errorToast.textContent = 'Title must contain at least one letter or number. Please enter a meaningful title.';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
      return;
    }
    
    setTitleError(false);
    
    // Validate due date - check if it's more than 30 days from creation date
    const creationDate = new Date(editedTicket.start_date || editedTicket.created_at);
    const dueDate = new Date(editedTicket.due_date);
    const daysDifference = Math.ceil((dueDate - creationDate) / (1000 * 60 * 60 * 24));
    
    if (daysDifference > 30) {
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'toast-message error';
      errorToast.textContent = 'Due date cannot be more than 30 days from the creation date.';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
      return;
    }
    
    setIsSaving(true);
    try {
      // Use trimmed title in the request
      const ticketDataToSave = {
        ...editedTicket,
        title: trimmedTitle
      };
      
      const response = await fetch(`/update_ticket/${ticket.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketDataToSave),
      });

      if (!response.ok) {
        throw new Error('Failed to save ticket changes');
      }

      const data = await response.json();
      console.log('Ticket updated successfully:', data);
      
      // Show success message
      const successToast = document.createElement('div');
      successToast.className = 'toast-message success';
      successToast.textContent = 'Changes saved successfully!';
      document.body.appendChild(successToast);
      setTimeout(() => successToast.remove(), 3000);

      await onSave(editedTicket);
      onClose();
    } catch (error) {
      console.error('Error saving ticket:', error);
      
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'toast-message error';
      errorToast.textContent = 'Failed to save changes. Please try again.';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommentChange = (e) => {
    setNewComment(e.target.value);
    // You can add debounced auto-save here if needed
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setAttachment(file);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && !attachment) return;

    const formData = new FormData();
    formData.append('comment', newComment);
    formData.append('user', 'current_user_id'); // Replace with actual user ID
    if (attachment) {
      formData.append('attachment', attachment);
    }

    try {
      const response = await fetch(`/add_comment/${ticket.id}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const data = await response.json();
      console.log('Comment added successfully:', data);

      // Clear form and refresh comments
      setNewComment('');
      setAttachment(null);
      await fetchComments();

      // Show success message
      const successToast = document.createElement('div');
      successToast.className = 'toast-message success';
      successToast.textContent = 'Comment added successfully!';
      document.body.appendChild(successToast);
      setTimeout(() => successToast.remove(), 3000);
    } catch (error) {
      console.error('Error adding comment:', error);
      
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'toast-message error';
      errorToast.textContent = 'Failed to add comment. Please try again.';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
    }
  };

  const HistorySection = () => (
    <div className="history-overlay">
      <div className="history-content">
        <div className="history-header">
          <h3>Ticket History</h3>
          <button onClick={() => setShowHistory(false)} className="close-history">&times;</button>
        </div>
        <div className="history-body">
          <div className="history-item">
            <div className="history-date">2024-01-20 10:30 AM</div>
            <div className="history-details">
              <div className="history-action">Status changed from "New" to "In Progress"</div>
              <div className="history-user">by John Doe</div>
            </div>
          </div>
          <div className="history-item">
            <div className="history-date">2024-01-20 10:35 AM</div>
            <div className="history-details">
              <div className="history-action">Attachment added: requirements.pdf</div>
              <div className="attachment-info">
                <FaFile className="file-icon" />
                <a href="#" className="file-link">requirements.pdf</a>
              </div>
              <div className="history-user">by Jane Smith</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-content">
            <div className="ticket-title">
              <h2>Ticket #{ticket.id}</h2>
            </div>
            <div className="ticket-badges">
              <span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>
                {ticket.status}
              </span>
              <span className={`priority-badge ${ticket.priority.toLowerCase()}`}>
                {ticket.priority}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="ticket-container">
            {/* Ticket Details Section */}
            <div className="details-section">
              <div className="section-title">
                <h3>Ticket Details</h3>
                <span className={`save-indicator ${saveStatus}`}>
                  {saveStatus === 'saved' && <FaCheck />}
                  {saveStatus === 'saving' && <div className="loading-spinner" />}
                  {saveStatus === 'error' && 'Error saving'}
                </span>
              </div>
              
              <div className="details-grid">
                <div className="left-column">
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={editedTicket.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className={`form-input ${titleError ? 'error' : ''}`}
                      placeholder="Enter ticket title"
                      title="Title cannot be empty or contain only whitespace"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={editedTicket.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-textarea"
                      placeholder="Enter ticket description"
                      rows="4"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Assigned To</label>
                      <select
                        value={editedTicket.assignee}
                        onChange={(e) => setEditedTicket({...editedTicket, assignee: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Select Assignee</option>
                        {registeredUsers.map(user => (
                          <option key={user.id} value={user.username}>
                            {user.username}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={editedTicket.dueDate}
                        onChange={(e) => setEditedTicket({...editedTicket, dueDate: e.target.value})}
                        className="form-input"
                        min={new Date().toISOString().split('T')[0]}
                        max={(() => {
                          const maxDate = new Date(editedTicket.start_date || editedTicket.created_at);
                          maxDate.setDate(maxDate.getDate() + 30);
                          return maxDate.toISOString().split('T')[0];
                        })()}
                      />
                      <small style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                        Max: 30 days from creation date
                      </small>
                    </div>
                  </div>

                  <div className="ticket-info-section">
                    <div className="info-header">
                      <div className="attachments-section">
                        <h4>Attachments</h4>
                        <div className="attachment-list">
                          {ticketAttachments.map((file, index) => (
                            <div key={index} className="attachment-item">
                              <div className="file-info">
                                <FaFile className="file-icon" />
                                <span className="file-name">{file.name}</span>
                              </div>
                              <div className="file-actions">
                                <button className="file-action-btn" title="Download">
                                  <FaDownload />
                                </button>
                                <button className="file-action-btn" title="Delete">
                                  <FaTrash />
                                </button>
                              </div>
                            </div>
                          ))}
                          <label className="add-attachment-btn">
                            <FaPlus />
                            <span>Add Attachment</span>
                            <input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  setTicketAttachments([...ticketAttachments, file]);
                                }
                              }}
                              hidden
                            />
                          </label>
                        </div>
                      </div>

                      <div className="history-section">
                        <div className="history-header">
                          <h4>Recent Changes</h4>
                          <button 
                            className="view-history-btn"
                            onClick={() => setShowTicketHistory(true)}
                          >
                            <FaHistory />
                            <span>View Full History</span>
                          </button>
                        </div>
                        <div className="recent-changes">
                          <div className="change-item">
                            <div className="change-icon">
                              <FaClock />
                            </div>
                            <div className="change-details">
                              <span className="change-text">Status changed to "In Progress"</span>
                              <span className="change-time">2 hours ago</span>
                            </div>
                          </div>
                          <div className="change-item">
                            <div className="change-icon">
                              <FaUser />
                            </div>
                            <div className="change-details">
                              <span className="change-text">Assigned to John Doe</span>
                              <span className="change-time">3 hours ago</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="right-column">
                  <div className="status-priority-section">
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        value={editedTicket.status}
                        onChange={(e) => setEditedTicket({...editedTicket, status: e.target.value})}
                        className="status-select"
                      >
                        <option value="">Select Status</option>
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Priority</label>
                      <select
                        value={editedTicket.priority}
                        onChange={(e) => setEditedTicket({...editedTicket, priority: e.target.value})}
                        className="priority-select"
                      >
                        <option value="">Select Priority</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="tracking-icons">
                    <button 
                      className="tracking-icon-btn"
                      onClick={() => setShowAttachments(true)}
                      title="View Attachments"
                    >
                      <div className="icon-wrapper">
                        <FaPaperclip className="icon" />
                        <span className="count">3</span>
                      </div>
                      <span className="icon-label">Attachments</span>
                    </button>

                    <button 
                      className="tracking-icon-btn"
                      onClick={() => setShowHistory(true)}
                      title="View History"
                    >
                      <div className="icon-wrapper">
                        <FaHistory className="icon" />
                        <span className="count">5</span>
                      </div>
                      <span className="icon-label">History</span>
                    </button>
                  </div>
                  <div className="discussion-section">
                    <div className="discussion-header">
                      <h3>Discussion</h3>
                      <span className="message-count">{comments.length} messages</span>
                    </div>

                    <div className="messages-container">
                      {comments.map((comment, index) => (
                        <div key={index} className="message-bubble">
                          <div className="message-header">
                            <div className="user-info">
                              <div className="avatar">{comment.user?.charAt(0)?.toUpperCase()}</div>
                              <div className="user-details">
                                <span className="username">{comment.user}</span>
                                <span className="timestamp">
                                  {new Date(comment.timestamp).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="message-content">
                            <p>{comment.comment}</p>
                            {comment.attachment && (
                              <div className="message-attachment">
                                {comment.attachment.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                  <img src={comment.attachment} alt="attachment" />
                                ) : (
                                  <div className="file-attachment">
                                    <FaFile />
                                    <span>{comment.attachmentName}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="message-input-section">
                      <form onSubmit={handleSubmitComment}>
                        <div className="message-input-container">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Type your message here..."
                            className="message-input"
                            rows="3"
                          />
                          <div className="message-actions">
                            <div className="attachment-buttons">
                              <label className="attachment-btn" title="Add image">
                                <FaImage />
                                <input
                                  type="file"
                                  onChange={handleFileChange}
                                  accept="image/*"
                                  hidden
                                />
                              </label>
                              <label className="attachment-btn" title="Add file">
                                <FaFile />
                                <input
                                  type="file"
                                  onChange={handleFileChange}
                                  accept=".pdf,.doc,.docx,.txt"
                                  hidden
                                />
                              </label>
                            </div>
                            <div className="submit-buttons">
                              <button 
                                type="button" 
                                className="discard-btn"
                                onClick={() => setNewComment('')}
                              >
                                Discard
                              </button>
                              <button 
                                type="submit" 
                                className="submit-btn"
                                disabled={!newComment.trim() && !attachment}
                              >
                                Submit
                              </button>
                            </div>
                          </div>
                        </div>
                        {attachment && (
                          <div className="attachment-preview">
                            <div className="file-info">
                              <FaFile />
                              <span>{attachment.name}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setAttachment(null)}
                              className="remove-btn"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="save-status">
            {saveError ? (
              <span className="error-text">{saveError}</span>
            ) : (
              <span className="last-saved">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="footer-buttons">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
      {showHistory && <HistorySection />}
      {showTicketHistory && (
        <div className="history-modal">
          <div className="history-modal-content">
            <div className="history-modal-header">
              <h3>Ticket History</h3>
              <button 
                className="close-history-btn"
                onClick={() => setShowTicketHistory(false)}
              >
                ×
              </button>
            </div>
            <div className="history-modal-body">
              <div className="history-timeline">
                {/* Example history items */}
                <div className="history-item">
                  <div className="history-item-header">
                    <span className="history-date">Today, 2:30 PM</span>
                    <span className="history-user">John Doe</span>
                  </div>
                  <div className="history-item-content">
                    <span className="history-action">Changed status to "In Progress"</span>
                  </div>
                </div>
                <div className="history-item">
                  <div className="history-item-header">
                    <span className="history-date">Today, 1:15 PM</span>
                    <span className="history-user">Jane Smith</span>
                  </div>
                  <div className="history-item-content">
                    <span className="history-action">Added attachment: requirements.pdf</span>
                    <div className="history-attachment">
                      <FaFile />
                      <a href="#">requirements.pdf</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAttachments && (
        <div className="modal-overlay-inner">
          <div className="tracking-modal attachments-modal">
            <div className="modal-header">
              <h3>Ticket Attachments</h3>
              <button className="close-modal" onClick={() => setShowAttachments(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="attachments-list">
                <div className="attachment-item">
                  <div className="attachment-info">
                    <FaFile className="file-icon" />
                    <span className="file-name">requirements.pdf</span>
                    <span className="file-size">2.4 MB</span>
                  </div>
                  <div className="attachment-actions">
                    <button className="action-btn download-btn">
                      <FaDownload />
                    </button>
                    <button className="action-btn delete-btn">
                      <FaTrash />
                    </button>
                  </div>
                </div>
                {/* Add more attachment items as needed */}
              </div>
              <div className="upload-section">
                <label className="upload-btn">
                  <FaPlus />
                  <span>Add New Attachment</span>
                  <input type="file" hidden />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="modal-overlay-inner">
          <div className="tracking-modal history-modal">
            <div className="modal-header">
              <h3>Ticket History</h3>
              <button className="close-modal" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="history-timeline">
                <div className="timeline-item">
                  <div className="timeline-icon">
                    <FaClock />
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="action-time">Today, 2:30 PM</span>
                      <span className="action-user">John Doe</span>
                    </div>
                    <div className="action-details">
                      Changed status from "New" to "In Progress"
                    </div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">
                    <FaFile />
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="action-time">Today, 1:15 PM</span>
                      <span className="action-user">Jane Smith</span>
                    </div>
                    <div className="action-details">
                      Added new attachment: requirements.pdf
                    </div>
                  </div>
                </div>
                {/* Add more timeline items as needed */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketEditModal; 