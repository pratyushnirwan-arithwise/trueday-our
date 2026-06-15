
import React, { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { Upload, Paperclip, History, X, FileText } from "lucide-react"
import "./EditTicket.css"
import { FaPaperPlane } from "react-icons/fa"
import { useUser } from "./contexts/UserContext"
import UnsupportedFileModal from "./components/UnsupportedFileModal"

const API_BASE_URL = ""

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      )
    }

    return this.props.children
  }
}

const EditTicket = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, loading: userLoading, error: userError, refreshUser } = useUser()
  const [ticket, setTicket] = useState(location.state?.ticket || null)
  const [attachments, setAttachments] = useState([])
  const [showAttachments, setShowAttachments] = useState(false)
  const [showUploads, setShowUploads] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(!location.state?.ticket)
  const [showUnsupportedFileModal, setShowUnsupportedFileModal] = useState(false)
  const [unsupportedFileMessage, setUnsupportedFileMessage] = useState("")
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [error, setError] = useState(null)
  const [titleError, setTitleError] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [sendingComment, setSendingComment] = useState(false)

  // Activity (ticket_history)
  const [activity, setActivity] = useState([])
  const [activeTab, setActiveTab] = useState("comments") // "comments" | "activity"

  // Edit comment state
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState("")

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  // ─── Fetch ticket ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTicket = async () => {
      if (!id) { setError("No ticket ID provided"); setLoading(false); return }
      try {
        setLoading(true)
        setError(null)
        if (location.state?.ticket) {
          setTicket(location.state.ticket)
          setLoading(false)
          return
        }
        const response = await fetch(`/tickets/${id}`, {
          method: "GET",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "include",
        })
        if (!response.ok) throw new Error(`Failed to fetch ticket: ${response.statusText}`)
        const data = await response.json()
        setTicket(data)
      } catch (error) {
        console.error("Error fetching ticket:", error)
        setError(error.message || "Failed to load ticket data")
      } finally {
        setLoading(false)
      }
    }
    fetchTicket()
  }, [id, location.state])

  // ─── Fetch messages ───────────────────────────────────────────────────────────
  const fetchMessages = async () => {
    if (!id) return
    try {
      const response = await fetch(`/get_ticket_messages/${id}`, {
        method: "GET",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
        mode: "cors",
      })
      if (response.ok) {
        const data = await response.json()
        setMessages(Array.isArray(data) ? data : [])
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
      setMessages([])
    }
  }

  // ─── Fetch activity (ticket_history) ─────────────────────────────────────────
  const fetchActivity = async () => {
    if (!id) return
    try {
      const response = await fetch(`/api/ticket-history/${id}`, {
        method: "GET",
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setActivity(Array.isArray(data) ? data : [])
      } else {
        setActivity([])
      }
    } catch (error) {
      console.error("Error fetching activity:", error)
      setActivity([])
    }
  }

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/get_ticket_attachments/${id}`, {
        method: "GET",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
        mode: "cors",
      })
      if (!response.ok) throw new Error("Failed to fetch attachments")
      const attachmentsData = await response.json()
      setAttachments(attachmentsData)
    } catch (error) {
      console.error("Error fetching attachments:", error)
      setError(error.message)
    }
  }

  useEffect(() => {
    if (id) {
      fetchMessages()
      fetchActivity()
      fetchAttachments()
    }
  }, [id])

  // ─── File upload ──────────────────────────────────────────────────────────────
  const handleFileUpload = async (event) => {
    try {
      const files = Array.from(event.target.files)
      if (files.length === 0) return
      const allowedTypes = [
        "image/jpeg", "image/png", "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      const invalidFiles = files.filter((file) => !allowedTypes.includes(file.type))
      if (invalidFiles.length > 0) {
        setUnsupportedFileMessage("Only JPEG, PNG, PDF, and Word files (.doc, .docx) are allowed.")
        setShowUnsupportedFileModal(true)
        return
      }
      const formData = new FormData()
      files.forEach((file) => formData.append("file", file))
      formData.append("ticket_id", id)
      formData.append("user_id", currentUser.id)
      const response = await fetch("/upload_attachment", {
        method: "POST", body: formData, credentials: "include", mode: "cors",
      })
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || errorData.message || `Failed to upload files: ${response.statusText}`
        if (errorMessage.includes("File type not allowed") || errorMessage.includes("not allowed")) {
          setUnsupportedFileMessage(errorMessage)
          setShowUnsupportedFileModal(true)
          return
        }
        throw new Error(errorMessage)
      }
      await fetchAttachments()
    } catch (error) {
      console.error("Error uploading file:", error)
      setError(error.message)
    }
  }

  const toggleAttachments = () => { setShowAttachments(!showAttachments); setShowUploads(false); setShowHistory(false) }
  const toggleUploads = () => { setShowUploads(!showUploads); setShowAttachments(false); setShowHistory(false) }
  const toggleHistory = () => { setShowHistory(!showHistory); setShowAttachments(false); setShowUploads(false) }

  // ─── Send comment ─────────────────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!newMessage.trim()) return
    if (!currentUser || !currentUser.id) { setError("You must be logged in to send messages"); return }

    const userId = Number.parseInt(currentUser.id, 10)
    if (isNaN(userId)) { setError("Invalid user session. Please log in again."); return }

    try {
      setSendingComment(true)
      const response = await fetch(`/add_ticket_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticket_id: Number.parseInt(id, 10),
          message: newMessage,
          user_id: userId,
          timestamp: new Date().toISOString(),
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send message")
      }
      const data = await response.json()

      // Immediately add the new message to state (optimistic)
      setMessages((prev) => [
        ...prev,
        {
          id: data.id || data.message_id,
          message: newMessage,
          created_at: data.timestamp || new Date().toISOString(),
          user_id: userId,
          username: currentUser.username,
        },
      ])
      setNewMessage("")
      setError("")

      // Refresh from server to get accurate data + activity
      await fetchMessages()
      await fetchActivity()

      // Switch to comments tab so user sees the new comment
      setActiveTab("comments")
    } catch (err) {
      console.error("Error sending message:", err)
      setError(err.message || "Failed to send message")
    } finally {
      setSendingComment(false)
    }
  }

  // ─── Edit comment ─────────────────────────────────────────────────────────────
  const handleStartEdit = (msg) => {
    setEditingId(msg.id)
    setEditText(msg.message || "")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText("")
  }

  const handleSaveEdit = async (msgId) => {
    if (!editText.trim()) return
    try {
      const response = await fetch(`/update_ticket_message/${msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: editText.trim(),
          user_id: currentUser?.id,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to update comment")
      }
      setEditingId(null)
      setEditText("")
      await fetchMessages()
      await fetchActivity()
    } catch (err) {
      console.error("Error editing comment:", err)
      alert(err.message || "Failed to update comment")
    }
  }

  // ─── Save ticket ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const trimmedTitle = ticket?.title?.trim()
    if (!trimmedTitle) {
      setTitleError(true)
      alert("Title cannot be empty or contain only spaces, tabs, or line breaks. Please enter a valid title.")
      return
    }
    setTitleError(false)
    const creationDate = new Date(ticket?.start_date || ticket?.created_at)
    const dueDate = new Date(ticket?.due_date)
    const daysDifference = Math.ceil((dueDate - creationDate) / (1000 * 60 * 60 * 24))
    if (daysDifference > 30) { alert("Due date cannot be more than 30 days from the creation date."); return }
    try {
      const ticketDataToSave = { ...ticket, title: trimmedTitle }
      const response = await fetch(`/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(ticketDataToSave),
      })
      if (!response.ok) throw new Error("Failed to save ticket")
      setShowSuccessPopup(true)
      setTimeout(() => { setShowSuccessPopup(false); navigate("/dashboard") }, 3000)
    } catch (error) {
      console.error("Error saving ticket:", error)
      alert("Failed to save ticket. Please try again.")
    }
  }

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this ticket?")) {
      try {
        const response = await fetch(`/tickets/${id}`, { method: "DELETE", credentials: "include" })
        if (!response.ok) throw new Error("Failed to delete ticket")
        navigate("/tickets")
      } catch (error) {
        console.error("Error deleting ticket:", error)
        alert("Failed to delete ticket. Please try again.")
      }
    }
  }

  const handleCancel = () => navigate("/tickets")

  const handleDeleteAttachment = async (attachmentId) => {
    if (window.confirm("Are you sure you want to delete this attachment?")) {
      try {
        const response = await fetch(`/delete_attachment/${attachmentId}`, { method: "DELETE", credentials: "include" })
        if (!response.ok) throw new Error("Failed to delete attachment")
        await fetchAttachments()
      } catch (error) {
        console.error("Error deleting attachment:", error)
        alert("Failed to delete attachment. Please try again.")
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return ""
    try { return new Date(dateStr).toLocaleString() } catch { return dateStr }
  }

  const getInitials = (name) => {
    if (!name) return "?"
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
  }

  const activityIcon = (changeType) => {
    if (!changeType) return "📝"
    const ct = changeType.toLowerCase()
    if (ct === "comment") return "💬"
    if (ct === "comment_edit") return "✏️"
    if (ct === "status") return "🔄"
    if (ct === "priority") return "⚡"
    if (ct === "assignee") return "👤"
    return "📝"
  }

  // ─── Guards ───────────────────────────────────────────────────────────────────
  if (userLoading) return <div className="loading">Loading user data...</div>
  if (userError) return (
    <div className="error-container">
      <h2>Authentication Error</h2><p>{userError}</p>
      <button onClick={() => navigate("/login")}>Go to Login</button>
    </div>
  )
  if (!currentUser) return (
    <div className="error-container">
      <h2>Authentication Required</h2>
      <p>You must be logged in to view this ticket.</p>
      <button onClick={() => navigate("/login")}>Go to Login</button>
    </div>
  )
  if (error) return (
    <div className="error-container">
      <h2>Error Loading Ticket</h2><p>{error}</p>
      <button onClick={() => navigate("/tickets")}>Back to Tickets</button>
    </div>
  )
  if (loading) return <div className="loading">Loading ticket data...</div>
  if (!ticket) return (
    <div className="error-container">
      <h2>Ticket Not Found</h2>
      <p>The requested ticket could not be found.</p>
      <button onClick={() => navigate("/tickets")}>Back to Tickets</button>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="edit-ticket-page">
        {/* ── Ticket Header ── */}
        <div className="card ticket-header-card">
          <div className="ticket-title-section">
            <label className="title-label">Ticket Title</label>
            <input
              type="text"
              value={ticket?.title || ""}
              onChange={(e) => {
                setTicket({ ...ticket, title: e.target.value })
                setTitleError(!e.target.value.trim())
              }}
              placeholder="Enter ticket title..."
              className={`title-input ${titleError ? "error" : ""}`}
              title="Title cannot be empty or contain only whitespace"
            />
          </div>
          <div className="ticket-top-bar">
            <div className="ticket-id-block">
              <span className="ticket-id-label">Ticket ID:</span>
              <span className="ticket-id-value">{ticket?.ticket_id}</span>
            </div>
            <div className="meta-group">
              <label>Status</label>
              <select value={ticket?.status || ""} onChange={(e) => setTicket({ ...ticket, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="meta-group">
              <label>Priority</label>
              <select value={ticket?.priority || ""} onChange={(e) => setTicket({ ...ticket, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="meta-group">
              <label>Due Date</label>
              <input
                type="date"
                value={ticket?.due_date || ""}
                onChange={(e) => setTicket({ ...ticket, due_date: e.target.value })}
                max={(() => {
                  const maxDate = new Date(ticket?.start_date || ticket?.created_at)
                  maxDate.setDate(maxDate.getDate() + 30)
                  return maxDate.toISOString().split("T")[0]
                })()}
              />
              <small style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px" }}>Max: 30 days from creation date</small>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <div className="card description-card">
          <div className="description-header"><h2>Description</h2></div>
          <textarea
            className="description-input"
            value={ticket?.description || ""}
            onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
            placeholder="Enter ticket description..."
          />
        </div>

        {/* ── Add Comment ── */}
        <div className="card add-comment-card">
          <h3>Add a comment</h3>
          <div className="add-comment-area">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your comment here..."
              className="message-input"
              disabled={sendingComment}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
            />
            <button
              className={`add-comment-btn${newMessage.trim() ? " active" : ""}`}
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendingComment}
            >
              {sendingComment ? "Sending…" : "Add Comment"}
            </button>
          </div>
        </div>

        {/* ── Activity Section (Comments + History tabs) ── */}
        <div className="card comments-list-card">
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px" }}>
            <button
              onClick={() => setActiveTab("comments")}
              style={{
                background: "none", border: "none", cursor: "pointer", fontWeight: activeTab === "comments" ? 700 : 400,
                color: activeTab === "comments" ? "#7c3aed" : "#6b7280",
                borderBottom: activeTab === "comments" ? "2px solid #7c3aed" : "2px solid transparent",
                paddingBottom: "4px", fontSize: "14px",
              }}
            >
              💬 Comments ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              style={{
                background: "none", border: "none", cursor: "pointer", fontWeight: activeTab === "activity" ? 700 : 400,
                color: activeTab === "activity" ? "#7c3aed" : "#6b7280",
                borderBottom: activeTab === "activity" ? "2px solid #7c3aed" : "2px solid transparent",
                paddingBottom: "4px", fontSize: "14px",
              }}
            >
              🕒 Activity ({activity.length})
            </button>
          </div>

          {/* ── Comments tab ── */}
          {activeTab === "comments" && (
            <div className="comments-list">
              {messages.length === 0 ? (
                <div className="no-messages"><p>No comments yet. Start the discussion!</p></div>
              ) : (
                messages.map((msg) => {
                  const isMine = currentUser && (String(msg.user_id) === String(currentUser.id))
                  const isEditing = editingId === msg.id
                  return (
                    <div key={msg.id || msg.message_id} className="comment-item" style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{
                          width: "34px", height: "34px", borderRadius: "50%",
                          background: "#7c3aed", color: "#fff", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: "13px", flexShrink: 0,
                        }}>
                          {getInitials(msg.username)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="comment-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="comment-author">{msg.username || "Unknown User"}</span>
                            <span className="comment-timestamp">{formatDate(msg.created_at || msg.timestamp)}</span>
                          </div>

                          {isEditing ? (
                            <div style={{ marginTop: "8px" }}>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                style={{
                                  width: "100%", minHeight: "80px", padding: "8px",
                                  borderRadius: "8px", border: "1.5px solid #7c3aed",
                                  fontSize: "14px", resize: "vertical",
                                }}
                                autoFocus
                              />
                              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                                <button
                                  onClick={() => handleSaveEdit(msg.id)}
                                  disabled={!editText.trim()}
                                  style={{
                                    padding: "5px 14px", background: "#7c3aed", color: "#fff",
                                    border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                                  }}
                                >Save</button>
                                <button
                                  onClick={handleCancelEdit}
                                  style={{
                                    padding: "5px 14px", background: "#f3f4f6", color: "#374151",
                                    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
                                  }}
                                >Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="comment-content" style={{ marginTop: "4px" }}
                              dangerouslySetInnerHTML={{ __html: msg.message?.replace(/\n/g, "<br/>") || "" }}
                            />
                          )}

                          {isMine && !isEditing && (
                            <div style={{ marginTop: "6px" }}>
                              <button
                                onClick={() => handleStartEdit(msg)}
                                style={{
                                  background: "none", border: "none", color: "#7c3aed",
                                  cursor: "pointer", fontSize: "12px", padding: "2px 6px",
                                  borderRadius: "4px", fontWeight: 500,
                                }}
                                title="Edit comment"
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ── Activity tab ── */}
          {activeTab === "activity" && (
            <div className="comments-list">
              {activity.length === 0 ? (
                <div className="no-messages"><p>No activity yet.</p></div>
              ) : (
                [...activity].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at)).map((item) => (
                  <div key={item.id} className="comment-item" style={{ borderLeft: "3px solid #e5e7eb", paddingLeft: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "16px", marginRight: "6px" }}>{activityIcon(item.change_type)}</span>
                        <span style={{ fontWeight: 600, fontSize: "13px", color: "#374151" }}>
                          {item.changed_by || "System"}
                        </span>
                        <span style={{ fontSize: "13px", color: "#6b7280", marginLeft: "6px" }}>
                          {item.change_type === "comment" && "added a comment"}
                          {item.change_type === "comment_edit" && "edited a comment"}
                          {item.change_type === "status" && "changed status"}
                          {item.change_type === "priority" && "changed priority"}
                          {item.change_type === "assignee" && "changed assignee"}
                          {!["comment", "comment_edit", "status", "priority", "assignee"].includes(item.change_type) && `updated ${item.change_type || "field"}`}
                        </span>
                      </div>
                      <span className="comment-timestamp">{formatDate(item.changed_at)}</span>
                    </div>
                    {item.change_type !== "comment" && item.old_value && item.new_value && (
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "#6b7280", paddingLeft: "26px" }}>
                        <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: "4px", padding: "1px 5px", marginRight: "6px" }}>
                          {item.old_value}
                        </span>
                        →
                        <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: "4px", padding: "1px 5px", marginLeft: "6px" }}>
                          {item.new_value}
                        </span>
                      </div>
                    )}
                    {(item.change_type === "comment" || item.change_type === "comment_edit") && item.new_value && (
                      <div style={{
                        marginTop: "8px", paddingLeft: "26px", fontSize: "13px", color: "#374151",
                        background: "#f9fafb", borderRadius: "6px", padding: "8px 10px",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {item.new_value.replace(/<[^>]+>/g, "").substring(0, 200)}
                        {item.new_value.length > 200 ? "…" : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Ticket Actions ── */}
        <div className="ticket-actions">
          <button className="save-btn" onClick={handleSave}>Save Changes</button>
          <button className="cancel-btn" onClick={handleCancel}>Cancel</button>
          <button className="delete-btn" onClick={handleDelete}>Delete Ticket</button>
        </div>

        {showSuccessPopup && (
          <div className="success-popup">
            <div className="popup-content">
              <h3>Success!</h3>
              <p>Changes have been saved successfully.</p>
            </div>
          </div>
        )}

        {showUnsupportedFileModal && (
          <UnsupportedFileModal
            message={unsupportedFileMessage}
            onClose={() => { setShowUnsupportedFileModal(false); setUnsupportedFileMessage("") }}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default EditTicket
