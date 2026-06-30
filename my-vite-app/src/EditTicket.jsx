import React from "react"
import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { useUser } from "./contexts/UserContext"
import {
  getTicketById,
  updateTicket,
  getUsers,
  getProjects,
  getTicketMessages,
  addMessage,
  moveTicketToDeleted,
  getTicketComments,
  addTicketComment,
} from "./services/api"
import UnsupportedFileModal from "./components/UnsupportedFileModal"
import CustomSelect from "./components/CustomSelect"
import CustomDatePicker from "./components/CustomDatePicker"
import "./EditTicket.css"

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red" }}>
          <h2>Something went wrong in EditTicket</h2>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const formatDateObj = (dateObj) => {
  if (!dateObj) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EditTicket = ({ isModal = false, ticketId, onClose, onSave: onSaveProp, initialTicketData = null }) => {
  const params = useParams()
  const id = ticketId || params.id
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useUser()

  // Ticket data state
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Form state
  const [ticketTitle, setTicketTitle] = useState("")
  const [description, setDescription] = useState("")
  const [newComment, setNewComment] = useState("")
  const [comments, setComments] = useState([])
  const [activityComments, setActivityComments] = useState([]);
  const [collaborator, setCollaborator] = useState("")
  const [approver, setApprover] = useState("")
  const [project, setProject] = useState("")
  const [status, setStatus] = useState("Open")
  const [priority, setPriority] = useState("Medium")
  const [dueDate, setDueDate] = useState("")
  const [assignee, setAssignee] = useState("")

  // Dropdown data
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [projectUsers, setProjectUsers] = useState([])

  // Loading states
  const [saving, setSaving] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingMessageHtml, setEditingMessageHtml] = useState("")
  const editInputRef = useRef(null)
  const editInitialHtmlRef = useRef("")
  const editLiveHtmlRef = useRef("")
  const [replyingToMessageId, setReplyingToMessageId] = useState(null)
  const [replyText, setReplyText] = useState("")
  const replyTextareaRef = useRef(null)

  // Focus textarea when reply state changes
  useEffect(() => {
    if (replyingToMessageId && replyTextareaRef.current) {
      replyTextareaRef.current.focus()
    }
  }, [replyingToMessageId])

  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewImage, setPreviewImage] = useState("")
  const [imageScale, setImageScale] = useState(1)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false)
  const [previewFromAttachments, setPreviewFromAttachments] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [history, setHistory] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false)
  const [pastingImage, setPastingImage] = useState(false)
  const [showUnsupportedFileModal, setShowUnsupportedFileModal] = useState(false)
  const [unsupportedFileMessage, setUnsupportedFileMessage] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  // UI only: collapsible sections and tabs
  const [isDescOpen, setIsDescOpen] = useState(true)
  const [isDescEditing, setIsDescEditing] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(true)
  const [activeActivityTab, setActiveActivityTab] = useState("all")

  // UI only: inline edit toggles on right panel
  const [editingField, setEditingField] = useState(null)

  // UI only: speech-to-text for comment box
  const [isRecording, setIsRecording] = useState(false)

  // Mentions (compact dropdown above input)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionResults, setMentionResults] = useState([])
  const [mentionDropdownPos, setMentionDropdownPos] = useState({ top: 0, left: 0 })
  const [statuses, setStatuses] = useState([])
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false)
  const [statusError, setStatusError] = useState("")

  // Toolbar state
  const [isBoldActive, setIsBoldActive] = useState(false)
  const [isItalicActive, setIsItalicActive] = useState(false)
  const [isUnderlineActive, setIsUnderlineActive] = useState(false)
  const [isBulletActive, setIsBulletActive] = useState(false)
  const [isNumberActive, setIsNumberActive] = useState(false)

  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  const [unifiedActivity, setUnifiedActivity] = useState([])
  const [resolutionDays, setResolutionDays] = useState(null)
  const [progressDays, setProgressDays] = useState(null)
  const [startDate, setStartDate] = useState("")
  const [showRepliesMap, setShowRepliesMap] = useState({})

  // Work log state
  const [workLogs, setWorkLogs] = useState([])
  const [showLogTimeModal, setShowLogTimeModal] = useState(false)
  const [logTimeSpent, setLogTimeSpent] = useState("")
  const [logTimeRemaining, setLogTimeRemaining] = useState("")
  const [logDateStarted, setLogDateStarted] = useState("")
  const [logTimeStarted, setLogTimeStarted] = useState("")
  const [logWorkDescription, setLogWorkDescription] = useState("")
  const [editingWorkLogId, setEditingWorkLogId] = useState(null)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const getInitials = (name) => {
    if (!name) return ""
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
  }

  const stringToColor = (str) => {
    if (!str) return "#6b7280"
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const color =
      "#" +
      ((hash >> 24) & 0xff).toString(16).padStart(2, "0") +
      ((hash >> 16) & 0xff).toString(16).padStart(2, "0") +
      ((hash >> 8) & 0xff).toString(16).padStart(2, "0")
    return color.slice(0, 7)
  }

  const getDisplayName = (userId) => {
    const user = users.find((u) => u.id === Number.parseInt(userId))
    return user ? user.username : ""
  }

  // Fetch ticket data
  const fetchTicketData = async () => {
    if (!id) {
      setError("No ticket ID provided")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (initialTicketData) {
        const ticketData = initialTicketData
        setTicket(ticketData)
        setTicketTitle(ticketData.title || "")
        setDescription(ticketData.description || "")
        setAssignee(ticketData.assignee_id?.toString() || "")
        setCollaborator(ticketData.collaborator_id?.toString() || "")
        setApprover(ticketData.approver_id?.toString() || "")
        setProject(ticketData.project_id?.toString() || "")
        setStatus(ticketData.status || "Open")
        setPriority(ticketData.priority || "Medium")
        setDueDate(ticketData.due_date || "")
        setLoading(false)
        return
      }

      if (location.state?.ticket) {
        const ticketData = location.state.ticket
        setTicket(ticketData)
        setTicketTitle(ticketData.title || "")
        setDescription(ticketData.description || "")
        setAssignee(ticketData.assignee_id?.toString() || "")
        setCollaborator(ticketData.collaborator_id?.toString() || "")
        setApprover(ticketData.approver_id?.toString() || "")
        setProject(ticketData.project_id?.toString() || "")
        setStatus(ticketData.status || "Open")
        setPriority(ticketData.priority || "Medium")
        setDueDate(ticketData.due_date || "")
        setLoading(false)
        return
      }

      const ticketData = await getTicketById(id)
      setTicket(ticketData)
      setTicketTitle(ticketData.title || "")
      setDescription(ticketData.description || "")
      setAssignee(ticketData.assignee_id?.toString() || "")
      setCollaborator(ticketData.collaborator_id?.toString() || "")
      setApprover(ticketData.approver_id?.toString() || "")
      setProject(ticketData.project_id?.toString() || "")
      setStatus(ticketData.status || "Open")
      setPriority(ticketData.priority || "Medium")
      setDueDate(ticketData.due_date || "")
    } catch (error) {
      console.error("Error fetching ticket:", error)
      setError(error.response?.data?.error || error.message || "Failed to load ticket data")
    } finally {
      setLoading(false)
    }
  }

  // Fetch users for dropdowns
  const fetchUsers = async () => {
    try {
      const usersData = await getUsers()
      setUsers(usersData.users || usersData || [])
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  // Fetch comments/messages
  const fetchComments = async () => {
    try {
      const messagesData = await getTicketMessages(id)
      if (!Array.isArray(messagesData)) {
        console.error("Expected array for messages, got:", typeof messagesData)
        setComments([])
        return
      }
      const threadedComments = organizeCommentsIntoThreads(messagesData)
      setComments(threadedComments)
    } catch (error) {
      console.error("Error fetching comments:", error)
      setComments([])
    }
  }

  // Fetch activity comments (for Activity Feed)
  const fetchActivityComments = async () => {
    try {
      const commentsData = await getTicketComments(id)
      if (!Array.isArray(commentsData)) {
        console.error("Expected array for activity comments, got:", typeof commentsData)
        setActivityComments([])
        return
      }
      setActivityComments(commentsData)
    } catch (error) {
      console.error("Error fetching activity comments:", error)
      setActivityComments([])
    }
  }

  // Organize comments into threaded structure
  const organizeCommentsIntoThreads = (comments) => {
    const commentMap = new Map()
    const rootComments = []

    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    comments.forEach((comment) => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id)
        if (parent) {
          parent.replies.push(commentMap.get(comment.id))
        }
      } else {
        rootComments.push(commentMap.get(comment.id))
      }
    })

    rootComments.sort((a, b) => {
      const dateA = new Date(a.created_at || a.timestamp || 0)
      const dateB = new Date(b.created_at || b.timestamp || 0)
      return dateB - dateA
    })

    const sortReplies = (comment) => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.sort((a, b) => {
          const dateA = new Date(a.created_at || a.timestamp || 0)
          const dateB = new Date(b.created_at || b.timestamp || 0)
          return dateB - dateA
        })
        comment.replies.forEach(sortReplies)
      }
    }

    rootComments.forEach(sortReplies)
    return rootComments
  }

  // Fetch projects
  const fetchProjects = async () => {
    try {
      const projectsData = await getProjects()
      let data = projectsData || []

      if (currentUser && currentUser.role?.toLowerCase() !== 'admin') {
        const assignedIds = currentUser.assigned_projects || []
        data = data.filter(p => assignedIds.includes(String(p.id)))
      }

      setProjects(data)
    } catch (error) {
      console.error("Error fetching projects:", error)
      setProjects([])
    }
  }

  const createUnifiedActivityTimeline = () => {
    const timeline = []

      // Add only ROOT comments (from messages table) so replies are rendered once inside the thread
      // (previously we flattened replies as separate items causing duplicates)
      ; (comments || []).forEach((root) => {
        timeline.push({
          type: "comment",
          id: `msg-${root.id}`,
          timestamp: root.created_at || root.timestamp,
          data: root,
        })
      })

      // Add activity comments from trueday.comments table
      // Normalize fields so CommentThread can render them uniformly
      ; (activityComments || []).forEach((ac) => {
        // Avoid duplicating if same comment already came from messages
        timeline.push({
          type: "comment",
          id: `ac-${ac.id}`,
          timestamp: ac.created_at,
          data: {
            id: `ac-${ac.id}`,
            comment: ac.comment,
            message: ac.comment,           // CommentThread reads message || comment
            username: ac.created_by || ac.user_name,       // CommentThread reads username
            user_name: ac.created_by || ac.user_name,
            user_id: ac.user_id,
            created_at: ac.created_at,
            replies: [],
            _source: "comments",
          },
        })
      })

    // Add history items
    history.forEach((item) => {
      timeline.push({
        type: "history",
        id: `hist-${item.id}`,
        timestamp: item.changed_at,
        data: item,
      })
    })

    // Sort by timestamp descending (newest first)
    timeline.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0)
      const dateB = new Date(b.timestamp || 0)
      return dateB - dateA
    })

    // Filter based on active tab
    if (activeActivityTab === "comments") {
      return timeline.filter((item) => item.type === "comment")
    } else if (activeActivityTab === "history") {
      return timeline.filter((item) => item.type === "history")
    } else if (activeActivityTab === "all") {
      // In "all" tab: show both comments (root only, no replies) and history
      return timeline.filter((item) => item.type === "comment" || item.type === "history")
    } else if (activeActivityTab === "worklog") {
      return [] // Work log will be implemented separately
    }

    return timeline
  }

  useEffect(() => {
    const timeline = createUnifiedActivityTimeline()
    setUnifiedActivity(timeline)
  }, [comments, history, activeActivityTab, activityComments])

  useEffect(() => {
    // Calculate start date: when ticket goes from NEW to IN PROGRESS
    // OR if ticket was created directly with status IN PROGRESS
    try {
      const hist = Array.isArray(history) ? history : []

      // Check if ticket was created directly with IN PROGRESS status
      const currentStatus = String(ticket?.status || "").toUpperCase()
      if (currentStatus === "IN PROGRESS" && (!hist.length || hist.length === 0)) {
        // Ticket created with IN PROGRESS status, use creation date
        if (ticket?.created_at) {
          const date = new Date(ticket.created_at)
          setStartDate(date.toISOString().split('T')[0])
          return
        }
      }

      // Check if initial status was IN PROGRESS (no status change history but status is IN PROGRESS)
      if (currentStatus === "IN PROGRESS") {
        const hasStatusChange = hist.some(h => String(h.change_type || "").toUpperCase() === "STATUS")
        if (!hasStatusChange && ticket?.created_at) {
          // Ticket was created with IN PROGRESS status, use creation date
          const date = new Date(ticket.created_at)
          setStartDate(date.toISOString().split('T')[0])
          return
        }
      }

      // Find the first transition from NEW to IN PROGRESS
      const newToInProgress = hist.find(h => {
        const changeType = String(h.change_type || "").toUpperCase()
        const oldValue = String(h.old_value || "").toUpperCase()
        const newValue = String(h.new_value || "").toUpperCase()
        return changeType === "STATUS" && oldValue === "NEW" && newValue === "IN PROGRESS"
      })

      if (newToInProgress) {
        const date = new Date(newToInProgress.changed_at)
        setStartDate(date.toISOString().split('T')[0])
      } else if (ticket?.created_at) {
        const date = new Date(ticket.created_at)
        setStartDate(date.toISOString().split('T')[0])
      } else {
        setStartDate("")
      }
    } catch (_) {
      setStartDate("")
    }
  }, [history, ticket])

  useEffect(() => {
    // compute resolution days based on history 'COMPLETED' or now
    try {
      // Find first time status became IN PROGRESS and then first time became QA
      const hist = Array.isArray(history) ? history : []
      const inProgress = hist.find(h => String(h.change_type || "").toUpperCase() === "STATUS" && String(h.new_value || "").toUpperCase() === "IN PROGRESS")
      const qa = hist.find(h => String(h.change_type || "").toUpperCase() === "STATUS" && String(h.new_value || "").toUpperCase() === "QA")
      if (!inProgress) { setResolutionDays(null); return }
      const start = new Date(inProgress.changed_at || ticket?.created_at)
      const end = qa ? new Date(qa.changed_at) : new Date()
      const ms = end - start
      const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
      setResolutionDays(days)
    } catch (_) { }
  }, [ticket, history])

  useEffect(() => {
    // compute progress days from first IN PROGRESS to QA/COMPLETED or now
    try {
      const hist = history || []
      const firstInProgress = hist.find((h) => String(h.new_value || h.status || "").toUpperCase() === "IN PROGRESS")
      if (!firstInProgress) { setProgressDays(null); return }
      const start = new Date(firstInProgress.changed_at)
      const endItem = hist.find((h) => {
        const v = String(h.new_value || h.status || "").toUpperCase()
        return v === "QA" || v === "COMPLETED"
      })
      const end = endItem?.changed_at ? new Date(endItem.changed_at) : new Date()
      const ms = end - start
      const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
      setProgressDays(days)
    } catch (_) { setProgressDays(null) }
  }, [history])

  // Load all data on component mount
  useEffect(() => {
    fetchTicketData()
    fetchUsers()
    fetchComments()
    fetchActivityComments()
    fetchProjects()
    fetchWorkLogs()
  }, [id, currentUser])

  useEffect(() => {
    if (activeActivityTab === "worklog") {
      fetchWorkLogs()
    }
  }, [activeActivityTab])

  useEffect(() => {
    if (showAttachmentsModal) {
      fetchAttachments()
    }
  }, [showAttachmentsModal])

  useEffect(() => {
    if (id) {
      fetchAttachments()
    }
  }, [id])

  useEffect(() => {
    if (showHistoryModal) {
      fetchHistory()
      const interval = setInterval(fetchHistory, 5009)
      return () => clearInterval(interval)
    }
  }, [showHistoryModal])

  useEffect(() => {
    fetchStatuses()
  }, [])

  useEffect(() => {
    if (ticket && showHistoryModal) {
      fetchHistory()
    }
  }, [ticket, showHistoryModal])

  useEffect(() => {
    const handleFocus = () => {
      if (showHistoryModal) {
        fetchHistory()
      }
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [showHistoryModal])

  useEffect(() => {
    if (ticketTitle) {
      const textarea = document.querySelector(".ET-ticket-title")
      if (textarea) {
        textarea.style.height = "auto"
        textarea.style.height = textarea.scrollHeight + "px"
      }
    }
  }, [ticketTitle])

  useEffect(() => {
    if (activeActivityTab === "all" || activeActivityTab === "history") {
      fetchHistory()
    }
  }, [activeActivityTab])

  useEffect(() => {
    const textarea = document.querySelector(".ET-description-box textarea")
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = Math.max(40, textarea.scrollHeight) + "px"
    }
  }, [description, isDescEditing])

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return

    try {
      setSendingComment(true)
      const messageData = {
        ticket_id: Number.parseInt(id),
        user_id: currentUser?.id || currentUser?.user_id || localStorage.getItem("userId"),
        message: newComment.trim(),
        timestamp: new Date().toISOString(),
      }

      await addMessage(messageData)
      setNewComment("")
      const commentInput = document.getElementById("comment-input")
      if (commentInput) {
        commentInput.innerHTML = ""
      }
      await fetchComments()
      await fetchHistory()
    } catch (error) {
      console.error("Error adding comment:", error)
      setError("Failed to add comment")
    } finally {
      setSendingComment(false)
    }
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files[0]
    if (!file || !currentUser) return

    if (!file.type.startsWith("image/")) {
      setUnsupportedFileMessage("Please select an image file (JPEG, PNG, GIF)")
      setShowUnsupportedFileModal(true)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB")
      return
    }

    try {
      setSendingComment(true)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("ticket_id", id)

      const userId = currentUser?.id || currentUser?.user_id || localStorage.getItem("userId")
      if (userId && userId !== "undefined" && userId !== "null") {
        formData.append("user_id", userId)
      } else {
        formData.append("user_id", "")
      }

      const response = await fetch("/upload_attachment", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || "Failed to upload image"

        if (errorMessage.includes("File type not allowed") || errorMessage.includes("not allowed")) {
          setUnsupportedFileMessage(errorMessage)
          setShowUnsupportedFileModal(true)
        } else {
          setError(errorMessage)
        }
        return
      }

      const result = await response.json()

      const messageData = {
        ticket_id: Number.parseInt(id),
        user_id: userId,
        message: `[Image uploaded: ${file.name}]`,
        attachment_id: result.id || result.attachment_id,
        timestamp: new Date().toISOString(),
      }

      await addMessage(messageData)
      await fetchComments()
      await fetchHistory()
      event.target.value = ""
    } catch (error) {
      console.error("Error uploading image:", error)
      setError("Failed to upload image")
    } finally {
      setSendingComment(false)
    }
  }

  const handleImageClick = (imageSrc) => {
    setPreviewImage(imageSrc)
    setShowImagePreview(true)
    setImageScale(1)
  }

  const closeImagePreview = () => {
    setShowImagePreview(false)
    setPreviewImage("")
    setImageScale(1)
    if (previewFromAttachments) {
      setShowAttachmentsModal(true)
      setPreviewFromAttachments(false)
    }
  }

  const handleImageZoom = (delta) => {
    setImageScale((prev) => Math.max(0.5, Math.min(3, prev + delta)))
  }

  const handleStartEditMessage = (msg) => {
    setActiveActivityTab("comments")
    setEditingMessageId(msg.id)
    const htmlContent = msg.message || msg.comment || ""
    setEditingMessageHtml(htmlContent)
    editInitialHtmlRef.current = htmlContent
    editLiveHtmlRef.current = htmlContent
    setNewComment(htmlContent)
    setTimeout(() => {
      const input = document.getElementById("comment-input")
      if (input) {
        input.innerHTML = htmlContent
        input.focus()
        try {
          const range = document.createRange()
          range.selectNodeContents(input)
          range.collapse(false)
          const sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(range)
        } catch (_) { }
      }
    }, 0)
  }

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      const content = editingMessageHtml || editInitialHtmlRef.current || ""
      editInputRef.current.innerHTML = content
    }
  }, [editingMessageId])

  useEffect(() => {
    if (editingMessageId && editInputRef.current && editInputRef.current.innerHTML === "") {
      const restore = editLiveHtmlRef.current || editingMessageHtml || editInitialHtmlRef.current || ""
      if (restore) {
        editInputRef.current.innerHTML = restore
      }
    }
  })

  const handleCancelEditMessage = () => {
    setEditingMessageId(null)
    setEditingMessageHtml("")
    setNewComment("")
    const input = document.getElementById("comment-input")
    if (input) {
      input.innerHTML = ""
    }
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageFile = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (!imageFile) return;

    // Prevent default pasting behavior of images
    e.preventDefault();

    if (imageFile.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      return;
    }

    try {
      setPastingImage(true);
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("ticket_id", id);
      formData.append("user_id", currentUser?.id || currentUser?.user_id || localStorage.getItem("userId"));

      const response = await fetch("/upload_attachment", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload pasted image");
      }

      const result = await response.json();
      const attachmentUrl = `/attachments/${result.attachment_id || result.file_path}`;

      const imgHtml = `<img src="${attachmentUrl}" alt="Pasted Image" class="comment-image" style="max-width: 100%; max-height: 180px; object-fit: contain; border-radius: 8px; margin-top: 8px; display: block;" />`;

      const inputEl = document.getElementById("comment-input");
      if (inputEl) {
        inputEl.focus();

        // Use Selection/Range API to insert HTML at cursor position if possible
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();

          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = imgHtml;
          const frag = document.createDocumentFragment();
          let node;
          while ((node = tempDiv.firstChild)) {
            frag.appendChild(node);
          }
          range.insertNode(frag);

          // Move cursor after the inserted image
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // fallback
          inputEl.innerHTML += imgHtml;
        }

        setNewComment(inputEl.innerHTML);
      }
    } catch (err) {
      console.error("Error pasting image:", err);
      setError(err.message || "Failed to upload pasted image");
    } finally {
      setPastingImage(false);
    }
  };

  const handleStartReply = (comment) => {
    setReplyingToMessageId(comment.id)
    setReplyText("")
  }

  const handleCancelReply = () => {
    setReplyingToMessageId(null)
    setReplyText("")
  }

  const handleSendReply = async (messageText = replyText) => {
    if (!messageText.trim() || !replyingToMessageId) return

    try {
      setSendingComment(true)

      const response = await fetch("/add_ticket_message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ticket_id: Number.parseInt(id),
          message: messageText.trim(),
          user_id: currentUser?.id || localStorage.getItem("userId"),
          parent_id: replyingToMessageId,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send reply")
      }

      setReplyText("")
      setReplyingToMessageId(null)
      await fetchComments()
      await fetchHistory()
    } catch (error) {
      console.error("Error sending reply:", error)
      alert("Failed to send reply. Please try again.")
    } finally {
      setSendingComment(false)
    }
  }

  const ReplyInput = ({ comment, onSend, onCancel, sendingComment }) => {
    const editorRef = useRef(null)
    const [localReplyHtml, setLocalReplyHtml] = useState("")

    useEffect(() => {
      if (editorRef.current) editorRef.current.focus()
    }, [])

    const exec = (command) => {
      try {
        if (editorRef.current) {
          editorRef.current.focus()
          document.execCommand(command, false, null)
          setLocalReplyHtml(editorRef.current.innerHTML)
        }
      } catch (_) { }
    }

    const handleSend = () => {
      const html = (editorRef.current?.innerHTML || localReplyHtml || "").trim()
      if (!html) return
      onSend(html)
      setLocalReplyHtml("")
      if (editorRef.current) editorRef.current.innerHTML = ""
    }

    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    return (
      <div className="ET-reply-input">
        <div style={{ fontSize: "14px", color: "#6b7280", margin: "12px 16px 6px 16px", fontWeight: 500 }}>
          Replying to {comment.username || comment.user_name}
        </div>
        <div className="ET-formatting-toolbar">
          <button className="ET-toolbar-btn" type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} title="Bold"><strong>B</strong></button>
          <button className="ET-toolbar-btn" type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} title="Italic"><em>I</em></button>
          <button className="ET-toolbar-btn" type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} title="Underline"><u>U</u></button>
          <button className="ET-toolbar-btn" type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} title="Bullet">•</button>
          <button className="ET-toolbar-btn" type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }} title="Numbered">1.</button>
        </div>
        <div
          ref={editorRef}
          className="ET-comment-edit-input"
          contentEditable={!sendingComment}
          suppressContentEditableWarning={true}
          onInput={() => setLocalReplyHtml(editorRef.current?.innerHTML || "")}
          onKeyDown={handleKeyDown}
          data-placeholder="Write a reply..."
          style={{ minHeight: 120 }}
        />
        <div className="ET-reply-actions">
          <button className="ET-send-reply-btn" onClick={handleSend} disabled={sendingComment || !(localReplyHtml || "").trim()}>
            Send Reply
          </button>
          <button className="ET-cancel-reply-btn" onClick={onCancel} disabled={sendingComment}>Cancel</button>
        </div>
      </div>
    )
  }

  const CommentThread = ({ comment, depth = 0, hideActions = false, isRoot = false }) => {
    const isEditing = editingMessageId === comment.id
    const mine = canModifyMessage(comment)
    const isReplying = replyingToMessageId === comment.id
    const maxDepth = 3

    // In comments tab, hide replies after first one unless "show replies" is clicked
    // In "all" tab, hide ALL replies (no replies should be visible)
    const hasReplies = comment.replies && comment.replies.length > 0
    const showReplies = showRepliesMap[comment.id] || false

    // Only show replies in comments tab, not in "all" tab
    // In comments tab: show first reply automatically, hide others unless showReplies is true
    // In "all" tab: hideActions is true, so shouldShowAllReplies should be false to hide all replies
    const shouldShowAllReplies = !hideActions && showReplies

    // Only render replies in comments tab (not in "all" tab)
    const shouldRenderReplies = isRoot && activeActivityTab === "comments" && hasReplies

    return (
      <div className={`ET-comment-thread ${depth > 0 ? "ET-reply" : ""} ${isEditing ? "editing" : ""}`} style={{ marginLeft: depth * 20 }}>
        <div className="ET-history-item ET-comment-card">
          <div className="ET-history-icon" style={{ background: "transparent", border: "none", width: "28px", height: "28px", padding: 0, margin: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              className="ET-user-avatar"
              style={{ backgroundColor: stringToColor(comment.username || comment.user_name), width: "28px", height: "28px", fontSize: "11px", margin: 0, padding: 0 }}
            >
              {getInitials(comment.username || comment.user_name)}
            </div>
          </div>
          <div className="ET-history-content">
            <div className="ET-history-action" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>
                {comment.username || comment.user_name}
                {isEditing && <span style={{ marginLeft: "8px", color: "#78176b", fontWeight: 500, fontSize: "12px" }}>(editing...)</span>}
              </span>
              {!isEditing && !hideActions && mine && (
                <button className="ET-icon-only-btn" onClick={() => handleStartEditMessage(comment)} title="Edit" style={{ padding: "2px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              )}
            </div>
            <div className="ET-history-details" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {comment.message && comment.message.includes("<img") ? (
                <div
                  className="ET-comment-content-html"
                  dangerouslySetInnerHTML={{ __html: formatCommentContent(comment.message) }}
                />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: formatCommentContent(comment.message || comment.comment) }} />
              )}
              {comment.attachment_id && (
                <div className="ET-comment-attachment">
                  <img
                    src={`/attachments/${comment.attachment_id}`}
                    alt="Attachment"
                    onClick={() => handleImageClick(`/attachments/${comment.attachment_id}`)}
                    onError={(e) => {
                      e.target.style.display = "none"
                      e.target.nextSibling.style.display = "block"
                    }}
                  />
                  <div className="ET-attachment-error" style={{ display: "none" }}>
                    [Image not available]
                  </div>
                </div>
              )}
            </div>
            <div className="ET-history-time">
              {formatHistoryTime(comment.created_at || comment.timestamp)}
            </div>
          </div>
        </div>

        {isReplying && (
          <ReplyInput
            comment={comment}
            onSend={handleSendReply}
            onCancel={handleCancelReply}
            sendingComment={sendingComment}
          />
        )}

        {shouldRenderReplies && (
          <div className="ET-replies">
            {comment.replies.map((reply, index) => {
              // In comments tab: show first reply automatically, hide others unless showReplies is true
              // Index 0 is first reply - show it by default
              // Index > 0 are additional replies - only show if shouldShowAllReplies is true
              if (index === 0) {
                // Always show first reply in comments tab
                return (
                  <CommentThread key={reply.id} comment={reply} depth={depth + 1} hideActions={hideActions} />
                )
              } else if (shouldShowAllReplies) {
                // Show additional replies if "show replies" was clicked
                return (
                  <CommentThread key={reply.id} comment={reply} depth={depth + 1} hideActions={hideActions} />
                )
              }
              // Hide additional replies
              return null
            })}
            {isRoot && hasReplies && comment.replies.length > 1 && (
              <>
                {!shouldShowAllReplies && (
                  <div className="ET-comment-actions-inline" style={{ marginTop: "8px", marginLeft: "44px" }}>
                    <button
                      onClick={() => setShowRepliesMap(prev => ({ ...prev, [comment.id]: true }))}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: "12px",
                        textDecoration: "underline",
                        padding: "4px 0",
                      }}
                    >
                      Show {comment.replies.length - 1} more {comment.replies.length === 2 ? "reply" : "replies"}
                    </button>
                  </div>
                )}
                {shouldShowAllReplies && (
                  <div className="ET-comment-actions-inline" style={{ marginTop: "8px", marginLeft: "44px" }}>
                    <button
                      onClick={() => setShowRepliesMap(prev => ({ ...prev, [comment.id]: false }))}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#6b7280",
                        cursor: "pointer",
                        fontSize: "12px",
                        textDecoration: "underline",
                        padding: "4px 0",
                      }}
                    >
                      Hide replies
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleSaveEditMessage = async () => {
    if (!editingMessageId) return

    const isActivityComment = typeof editingMessageId === 'string' && editingMessageId.startsWith('ac-');
    const numericId = isActivityComment ? parseInt(editingMessageId.substring(3)) : editingMessageId;

    // Find the exact user_id of the message to pass backend authorization
    let msgUserId = null;
    if (isActivityComment) {
      const foundAc = activityComments.find(ac => ac.id === numericId);
      if (foundAc) {
        msgUserId = foundAc.user_id;
      }
    } else {
      const findMessageUserId = (commentsList) => {
        for (const comment of commentsList) {
          if (comment.id === editingMessageId) return comment.user_id;
          if (comment.replies && comment.replies.length > 0) {
            const found = findMessageUserId(comment.replies);
            if (found) return found;
          }
        }
        return null;
      };
      msgUserId = findMessageUserId(comments);
    }

    try {
      const commentInput = document.getElementById("comment-input")
      const currentHtml = commentInput ? commentInput.innerHTML : newComment
      const cleanMessage = currentHtml.trim()

      if (!cleanMessage) {
        setError("Comment cannot be empty")
        return
      }

      const requestBody = {
        message: cleanMessage,
        user_id: msgUserId || currentUser?.id || currentUser?.user_id || localStorage.getItem("userId"),
      }

      const endpoint = isActivityComment
        ? `/api/update_ticket_comment/${numericId}`
        : `/api/update_ticket_message/${numericId}`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        mode: "cors",
        body: JSON.stringify(requestBody),
      })

      if (response.status === 405 || response.status === 404) {
        const retry = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          mode: "cors",
          body: JSON.stringify(requestBody),
        })

        if (!retry.ok) {
          const errorText = await retry.text()
          const err = await retry.json().catch(() => ({ error: errorText }))
          throw new Error(err.error || "Failed to update comment")
        }

        await fetchComments()
        await fetchActivityComments()
        await fetchHistory()
        setEditingMessageId(null)
        setEditingMessageHtml("")
        setNewComment("")
        if (commentInput) {
          commentInput.innerHTML = ""
        }
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        const err = await response.json().catch(() => ({ error: errorText }))
        throw new Error(err.error || "Failed to update comment")
      }

      await fetchComments()
      await fetchActivityComments()
      await fetchHistory()
      setEditingMessageId(null)
      setEditingMessageHtml("")
      setNewComment("")
      if (commentInput) {
        commentInput.innerHTML = ""
      }
    } catch (error) {
      console.error("Error updating comment:", error)
      setError("Failed to update comment")
    }
  }

  const canModifyMessage = (msg) => {
    if (!msg || !currentUser) return false
    try {
      return String(msg.user_id) === String(currentUser.id) || String(msg.user_id) === String(currentUser.user_id)
    } catch (_) {
      return false
    }
  }

  // Deleted: comment deletion feature removed per requirement

  const toggleUploadModal = () => setShowUploadModal((prev) => !prev)
  const toggleAttachmentsModal = () => setShowAttachmentsModal((prev) => !prev)
  const toggleHistoryModal = () => setShowHistoryModal((prev) => !prev)

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/get_ticket_attachments/${id}`, {
        method: "GET",
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setAttachments(data || [])
      } else {
        setAttachments([])
      }
    } catch (error) {
      console.error("Error fetching attachments:", error)
      setAttachments([])
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/ticket-history/${id}`, {
        method: "GET",
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setHistory(Array.isArray(data) ? data : [])
      } else {
        setHistory([])
      }
    } catch (error) {
      console.error("Error fetching history:", error)
      setHistory([])
    }
  }

  const fetchWorkLogs = async () => {
    try {
      const response = await fetch(`/api/worklogs/${id}`, {
        method: "GET",
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setWorkLogs(data || [])
      } else {
        setWorkLogs([])
      }
    } catch (error) {
      console.error("Error fetching work logs:", error)
      setWorkLogs([])
    }
  }

  // Fetch users for selected project
  useEffect(() => {
    if (project) {
      const fetchProjectUsers = async () => {
        try {
          const response = await fetch(`/api/project/${project}/users`)
          if (response.ok) {
            const data = await response.json()
            setProjectUsers(Array.isArray(data) ? data : [])
          } else {
            setProjectUsers([])
          }
        } catch (error) {
          console.error("Error fetching project users:", error)
          setProjectUsers([])
        }
      }
      fetchProjectUsers()
    } else {
      setProjectUsers([])
    }
  }, [project])

  // Parse time string (e.g., "2w 4d 6h 45m") to minutes
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || !timeStr.trim()) return 0
    const parts = timeStr.trim().toLowerCase().match(/(\d+)\s*(w|d|h|m)/g) || []
    let totalMinutes = 0
    parts.forEach((part) => {
      const match = part.match(/(\d+)\s*(w|d|h|m)/)
      if (match) {
        const value = Number.parseInt(match[1])
        const unit = match[2]
        if (unit === "w") totalMinutes += value * 7 * 24 * 60
        else if (unit === "d") totalMinutes += value * 24 * 60
        else if (unit === "h") totalMinutes += value * 60
        else if (unit === "m") totalMinutes += value
      }
    })
    return totalMinutes
  }

  // Format minutes to time string (e.g., "2d 4h 30m")
  const formatMinutesToTime = (minutes) => {
    if (!minutes || minutes === 0) return ""
    const weeks = Math.floor(minutes / (7 * 24 * 60))
    const days = Math.floor((minutes % (7 * 24 * 60)) / (24 * 60))
    const hours = Math.floor((minutes % (24 * 60)) / 60)
    const mins = minutes % 60
    const parts = []
    if (weeks > 0) parts.push(`${weeks}w`)
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (mins > 0) parts.push(`${mins}m`)
    return parts.join(" ")
  }

  // Get suggestion for time input (e.g., "2" -> "2d")
  // Only show suggestion if input doesn't already contain a time unit
  const getTimeSuggestion = (value) => {
    if (!value || value.trim() === "") return ""
    // Check if value already contains a time unit (w, d, h, m)
    if (/[wdhm]\s*$/i.test(value.trim())) return ""
    const num = Number.parseInt(value)
    if (isNaN(num)) return ""
    if (num < 24) return `${num}h`
    if (num < 168) return `${Math.floor(num / 24)}d`
    return `${Math.floor(num / 168)}w`
  }

  const handleOpenLogTime = (workLog = null) => {
    if (workLog) {
      setEditingWorkLogId(workLog.id)
      setLogTimeSpent(workLog.time_spent || "")
      setLogTimeRemaining(workLog.time_remaining || "")
      setLogDateStarted(workLog.date_started || "")
      setLogTimeStarted(workLog.time_started || "")
      setLogWorkDescription(workLog.work_description || "")
      setTimeout(() => {
        const input = document.getElementById("worklog-description-input")
        if (input) input.innerHTML = workLog.work_description || ""
      }, 0)
    } else {
      setEditingWorkLogId(null)
      const now = new Date()
      setLogTimeSpent("")
      setLogTimeRemaining("")
      setLogDateStarted(now.toISOString().split("T")[0])
      setLogTimeStarted(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
      setLogWorkDescription("")
      setTimeout(() => {
        const input = document.getElementById("worklog-description-input")
        if (input) input.innerHTML = ""
      }, 0)
    }
    setShowLogTimeModal(true)
  }

  const handleCloseLogTime = () => {
    setShowLogTimeModal(false)
    setEditingWorkLogId(null)
    setLogTimeSpent("")
    setLogTimeRemaining("")
    setLogDateStarted("")
    setLogTimeStarted("")
    setLogWorkDescription("")
    setShowTimePicker(false)
    setShowDatePicker(false)
  }

  const handleSaveWorkLog = async () => {
    if (!logTimeSpent.trim() && !logTimeRemaining.trim()) {
      setError("Please enter at least time spent or time remaining")
      return
    }

    try {
      const workLogData = {
        ticket_id: Number.parseInt(id),
        user_id: currentUser?.id || currentUser?.user_id || localStorage.getItem("userId"),
        time_spent: logTimeSpent.trim(),
        time_remaining: logTimeRemaining.trim(),
        date_started: logDateStarted,
        time_started: logTimeStarted,
        work_description: logWorkDescription.trim(),
      }

      const url = editingWorkLogId ? `/api/worklogs/${editingWorkLogId}` : `/api/worklogs`
      const method = editingWorkLogId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(workLogData),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        let errorData = {}
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          // Not JSON, use as text
        }
        console.error("Work log save error:", errorData, errorText)
        throw new Error(errorData.error || errorText || "Failed to save work log")
      }

      // Try to parse response, but don't fail if it's empty
      const responseText = await response.text().catch(() => "")
      if (responseText) {
        try {
          const result = JSON.parse(responseText)
          console.log("Work log saved successfully:", result)
        } catch (e) {
          console.log("Work log saved successfully")
        }
      } else {
        console.log("Work log saved successfully")
      }

      // Refresh work logs and close modal
      await fetchWorkLogs()
      handleCloseLogTime()
      setError(null)
    } catch (error) {
      console.error("Error saving work log:", error)
      setError(error.message || "Failed to save work log")
    }
  }

  const handleDeleteWorkLog = async (workLogId) => {
    if (!window.confirm("Are you sure you want to delete this work log entry?")) return

    try {
      const response = await fetch(`/api/worklogs/${workLogId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to delete work log")
      }

      await fetchWorkLogs()
    } catch (error) {
      console.error("Error deleting work log:", error)
      setError("Failed to delete work log")
    }
  }

  // Calculate total time spent and remaining
  const calculateWorkLogTotals = () => {
    let totalSpent = 0
    let totalRemaining = 0
    workLogs.forEach((log) => {
      totalSpent += parseTimeToMinutes(log.time_spent || "")
      totalRemaining += parseTimeToMinutes(log.time_remaining || "")
    })
    return { totalSpent, totalRemaining }
  }

  const formatWorkDescription = (formatType) => {
    const input = document.getElementById("worklog-description-input")
    if (!input) return
    input.focus()

    const commandMap = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      bullet: "insertUnorderedList",
      number: "insertOrderedList",
    }

    const command = commandMap[formatType]
    if (command) {
      try {
        document.execCommand(command, false, null)
        setLogWorkDescription(input.innerHTML)
      } catch (_) { }
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    try {
      setUploadingFile(true)
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("ticket_id", id)

      const userId = currentUser?.id || currentUser?.user_id || localStorage.getItem("userId")
      if (userId && userId !== "undefined" && userId !== "null") {
        formData.append("user_id", userId)
      } else {
        formData.append("user_id", "")
      }

      const response = await fetch("/upload_attachment", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (response.ok) {
        setSelectedFile(null)
        setShowUploadModal(false)
        await fetchAttachments()
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || "Upload failed"

        if (errorMessage.includes("File type not allowed") || errorMessage.includes("not allowed")) {
          setUnsupportedFileMessage(errorMessage)
          setShowUnsupportedFileModal(true)
        } else {
          setError(errorMessage)
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      setError("Failed to upload file. Please try again.")
    } finally {
      setUploadingFile(false)
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  useEffect(() => {
    if (!showUploadModal) return

    const handlePaste = (e) => {
      // Don't intercept paste if user is typing in an input field elsewhere (though modal overlay usually blocks this)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedFile(e.clipboardData.files[0])
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [showUploadModal])

  const handleFileDownload = async (filePath, fileName) => {
    try {
      const response = await fetch(`/attachments/${filePath}`, {
        method: "GET",
        credentials: "include",
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        throw new Error("Download failed")
      }
    } catch (error) {
      console.error("Error downloading file:", error)
      setError("Failed to download file. Please try again.")
    }
  }

  const handleFilePreview = (attachment) => {
    const fileType = attachment.file_type?.toLowerCase() || ""

    if (fileType.startsWith("image/")) {
      setPreviewFromAttachments(showAttachmentsModal)
      setShowAttachmentsModal(false)
      setPreviewImage(`/attachments/${attachment.file_path}`)
      setShowImagePreview(true)
      setImageScale(1)
    } else {
      window.open(`/attachments/${attachment.file_path}`, "_blank")
    }
  }

  const handleFileDelete = async (attachmentId) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return

    try {
      const response = await fetch(`/delete_attachment/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        await fetchAttachments()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error deleting file:", error)
      setError("Failed to delete file. Please try again.")
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatHistoryTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch (error) {
      return dateString || "Unknown time"
    }
  }

  const handleCommentKeyDown = (e) => {
    const div = e.target

    if (e.key === "Enter" && !e.shiftKey) {
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let listItem = range.startContainer
        while (listItem && listItem.nodeType === Node.TEXT_NODE) {
          listItem = listItem.parentElement
        }

        if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
          const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")
          e.preventDefault()

          const list = actualListItem.closest("UL, OL")
          if (list) {
            const currentContent = actualListItem.textContent.trim()
            if (currentContent === "") {
              actualListItem.remove()

              const newP = document.createElement("P")
              newP.innerHTML = "<br>"

              if (list.nextSibling) {
                list.parentNode.insertBefore(newP, list.nextSibling)
              } else {
                list.parentNode.appendChild(newP)
              }

              const newRange = document.createRange()
              newRange.setStart(newP, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setNewComment(div.innerHTML)
              return
            } else {
              const newLi = document.createElement("LI")
              newLi.innerHTML = "<br>"

              if (actualListItem.nextSibling) {
                list.insertBefore(newLi, actualListItem.nextSibling)
              } else {
                list.appendChild(newLi)
              }

              const newRange = document.createRange()
              newRange.setStart(newLi, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setNewComment(div.innerHTML)
              return
            }
          }
        }
      }

      e.preventDefault()
      if (newComment.trim()) {
        if (editingMessageId) {
          handleSaveEditMessage()
        } else {
          handleAddActivityComment()
        }
      }
      return
    }

    if (e.key === "Enter" && e.shiftKey) {
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let listItem = range.startContainer
        while (listItem && listItem.nodeType === Node.TEXT_NODE) {
          listItem = listItem.parentElement
        }

        if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
          const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")
          e.preventDefault()

          const list = actualListItem.closest("UL, OL")
          if (list) {
            const newLi = document.createElement("LI")
            newLi.innerHTML = "<br>"

            if (actualListItem.nextSibling) {
              list.insertBefore(newLi, actualListItem.nextSibling)
            } else {
              list.appendChild(newLi)
            }

            const newRange = document.createRange()
            newRange.setStart(newLi, 0)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)

            setNewComment(div.innerHTML)
            return
          }
        }
      }

      return
    }

    if (e.key === "Backspace") {
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let listItem = range.startContainer
        while (listItem && listItem.nodeType === Node.TEXT_NODE) {
          listItem = listItem.parentElement
        }

        if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
          const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")
          const list = actualListItem.closest("UL, OL")
          if (list && range.startOffset === 0) {
            e.preventDefault()

            const prevLi = actualListItem.previousElementSibling
            if (prevLi && prevLi.tagName === "LI") {
              prevLi.innerHTML += actualListItem.innerHTML
              actualListItem.remove()

              const newRange = document.createRange()
              newRange.setStart(prevLi, prevLi.childNodes.length)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setNewComment(div.innerHTML)
              return
            } else {
              actualListItem.remove()

              const newP = document.createElement("P")
              newP.innerHTML = "<br>"

              if (list.previousSibling) {
                list.parentNode.insertBefore(newP, list)
              } else {
                list.parentNode.insertBefore(newP, list)
              }

              const newRange = document.createRange()
              newRange.setStart(newP, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setNewComment(div.innerHTML)
              return
            }
          }
        }
      }
    }

    if (e.key !== "Enter" && e.key !== "Backspace") {
      setTimeout(ensureListContinuation, 0)
    }
  }

  const handleEditKeyDown = (e) => {
    const div = e.target

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()

      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let listItem = range.startContainer
        while (listItem && listItem.nodeType === Node.TEXT_NODE) {
          listItem = listItem.parentElement
        }

        if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
          const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")

          const list = actualListItem.closest("UL, OL")
          if (list) {
            const currentContent = actualListItem.textContent.trim()
            if (currentContent === "") {
              actualListItem.remove()

              const newP = document.createElement("P")
              newP.innerHTML = "<br>"

              if (list.nextSibling) {
                list.parentNode.insertBefore(newP, list.nextSibling)
              } else {
                list.parentNode.appendChild(newP)
              }

              const newRange = document.createRange()
              newRange.setStart(newP, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setEditingMessageHtml(div.innerHTML)
              return
            } else {
              const newLi = document.createElement("LI")
              newLi.innerHTML = "<br>"

              if (actualListItem.nextSibling) {
                list.insertBefore(newLi, actualListItem.nextSibling)
              } else {
                list.appendChild(newLi)
              }

              const newRange = document.createRange()
              newRange.setStart(newLi, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setEditingMessageHtml(div.innerHTML)
              return
            }
          }
        }
      }

      document.execCommand("insertLineBreak")
      return
    }

    if (e.key === "Enter" && e.shiftKey) {
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let listItem = range.startContainer
        while (listItem && listItem.nodeType === Node.TEXT_NODE) {
          listItem = listItem.parentElement
        }

        if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
          const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")

          const list = actualListItem.closest("UL, OL")
          if (list) {
            const newLi = document.createElement("LI")
            newLi.innerHTML = "<br>"

            if (actualListItem.nextSibling) {
              list.insertBefore(newLi, actualListItem.nextSibling)
            } else {
              list.appendChild(newLi)
            }

            const newRange = document.createRange()
            newRange.setStart(newLi, 0)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)

            setEditingMessageHtml(div.innerHTML)
            return
          }
        }
      }

      return
    }

    if (e.key === "Backspace") {
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let listItem = range.startContainer
        while (listItem && listItem.nodeType === Node.TEXT_NODE) {
          listItem = listItem.parentElement
        }

        if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
          const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")
          const list = actualListItem.closest("UL, OL")
          if (list && range.startOffset === 0) {
            e.preventDefault()

            const prevLi = actualListItem.previousElementSibling
            if (prevLi && prevLi.tagName === "LI") {
              prevLi.innerHTML += actualListItem.innerHTML
              actualListItem.remove()

              const newRange = document.createRange()
              newRange.setStart(prevLi, prevLi.childNodes.length)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setEditingMessageHtml(div.innerHTML)
              return
            } else {
              actualListItem.remove()

              const newP = document.createElement("P")
              newP.innerHTML = "<br>"

              if (list.previousSibling) {
                list.parentNode.insertBefore(newP, list)
              } else {
                list.parentNode.insertBefore(newP, list)
              }

              const newRange = document.createRange()
              newRange.setStart(newP, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              setEditingMessageHtml(div.innerHTML)
              return
            }
          }
        }
      }
    }

    if (e.key !== "Enter" && e.key !== "Backspace") {
      setTimeout(() => {
        const selection = window.getSelection()
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          let listItem = range.startContainer
          while (listItem && listItem.nodeType === Node.TEXT_NODE) {
            listItem = listItem.parentElement
          }

          if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
            const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")
            const list = actualListItem.closest("UL, OL")

            if (list) {
              if (range.startOffset === range.startContainer.length) {
                const newRange = document.createRange()
                newRange.setStart(range.startContainer, range.startOffset)
                newRange.collapse(true)
                selection.removeAllRanges()
                selection.addRange(newRange)
              }
            }
          }
        }
      }, 0)
    }
  }

  const handleAddActivityComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSendingComment(true);

      const commentData = {
        comment: newComment.trim(),
        created_by:
          currentUser?.username ||
          currentUser?.name ||
          "Anonymous",
        user_id: currentUser?.id || currentUser?.user_id || localStorage.getItem('userId'),
      };

      // Save comment to trueday.comments table via /api/tickets/:id/comments
      await addTicketComment(id, commentData);

      // Clear editor
      setNewComment("");

      const commentInput =
        document.getElementById("comment-input");

      if (commentInput) {
        commentInput.innerHTML = "";
      }

      // Refresh comments from DB so the activity section shows the latest
      await fetchActivityComments();
      await fetchHistory();

    } catch (error) {
      console.error(
        "❌ Error saving comment:",
        error
      );
    } finally {
      setSendingComment(false);
    }
  };

  const ensureListContinuation = () => {
    const input = document.getElementById("comment-input")
    if (!input) return

    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      let listItem = range.startContainer
      while (listItem && listItem.nodeType === Node.TEXT_NODE) {
        listItem = listItem.parentElement
      }

      if (listItem && (listItem.tagName === "LI" || listItem.closest("LI"))) {
        const actualListItem = listItem.tagName === "LI" ? listItem : listItem.closest("LI")
        const list = actualListItem.closest("UL, OL")

        if (list) {
          if (range.startOffset === range.startContainer.length) {
            const newRange = document.createRange()
            newRange.setStart(range.startContainer, range.startOffset)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
          }
        }
      }
    }
  }

  const formatText = (formatType) => {
    const input = document.getElementById("comment-input")
    if (!input) return
    input.focus()

    const commandMap = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      bullet: "insertUnorderedList",
      number: "insertOrderedList",
    }

    const command = commandMap[formatType]
    if (command) {
      try {
        document.execCommand(command, false, null)
      } catch (_) { }
      setNewComment(input.innerHTML)
      updateToolbarStates()
    }
  }

  const formatEditText = (formatType) => {
    const input = document.getElementById("edit-comment-input")
    if (!input) return
    input.focus()

    const commandMap = {
      bold: "bold",
      italic: "italic",
      underline: "underline",
      bullet: "insertUnorderedList",
      number: "insertOrderedList",
    }

    const command = commandMap[formatType]
    if (command) {
      try {
        document.execCommand(command, false, null)
      } catch (_) { }
      setEditingMessageHtml(input.innerHTML)
      updateToolbarStates()
    }
  }

  const updateToolbarStates = () => {
    try {
      const commentInput = document.getElementById("comment-input")
      const editInput = document.getElementById("edit-comment-input")

      const sel = document.getSelection()
      if (!sel || !sel.anchorNode) return

      let activeInput = null
      if (commentInput && (commentInput.contains(sel.anchorNode) || commentInput === sel.anchorNode)) {
        activeInput = commentInput
      } else if (editInput && (editInput.contains(sel.anchorNode) || editInput === sel.anchorNode)) {
        activeInput = editInput
      }

      if (!activeInput) return

      setIsBoldActive(document.queryCommandState("bold"))
      setIsItalicActive(document.queryCommandState("italic"))
      setIsUnderlineActive(document.queryCommandState("underline"))
      setIsBulletActive(document.queryCommandState("insertUnorderedList"))
      setIsNumberActive(document.queryCommandState("insertOrderedList"))
    } catch (_) { }
  }

  useEffect(() => {
    const handler = () => updateToolbarStates()
    document.addEventListener("selectionchange", handler)
    return () => document.removeEventListener("selectionchange", handler)
  }, [])

  const fetchStatuses = async () => {
    setIsLoadingStatuses(true)
    setStatusError("")
    try {
      const response = await fetch("/api/status")
      if (!response.ok) throw new Error("Failed to fetch statuses")
      const data = await response.json()
      setStatuses(Array.isArray(data) ? data : [])
    } catch (err) {
      setStatusError("Failed to load statuses")
    } finally {
      setIsLoadingStatuses(false)
    }
  }

  const formatChangeDetails = (details, changeType) => {
    if (!details) return ""

    const ct = String(changeType || "").toLowerCase()
    if (ct === "created" || ct.includes("attachment")) {
      return ""
    }
    if (ct === "comment" || ct === "comment_edit") {
      return ""
    }

    const detStr = typeof details === "string" ? details : JSON.stringify(details)
    if (detStr.includes("attachment_id") || detStr.includes("file_path")) {
      return ""
    }

    if (typeof details === "string") {
      return details
    }

    if (typeof details === "object") {
      try {
        if (typeof details === "string") {
          const parsed = JSON.parse(details)
          return Object.entries(parsed)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ")
        }

        return Object.entries(details)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")
      } catch (error) {
        return JSON.stringify(details)
      }
    }

    return String(details)
  }

  const formatChangeTypeLabel = (type) => {
    if (!type) return "Update"
    if (String(type).toLowerCase().includes("attachment")) return "Attachment added"
    const spaced = String(type).replace(/_/g, " ")
    return spaced.replace(/\b\w/g, (m) => m.toUpperCase())
  }

  const truncateText = (text, limit = 200) => {
    if (!text) return ""
    const cleaned = typeof text === "string" ? text : String(text)
    const normalized = cleaned.replace(/\s+/g, " ").trim()
    return normalized.length > limit ? normalized.slice(0, limit) + "…" : normalized
  }

  const cleanTextContent = (text) => {
    if (!text) return ""
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  const canCompleteTicket = () => {
    if (!currentUser || !ticket) return false

    if (!approver || !ticket.approver_id) return true

    return currentUser.id === Number.parseInt(approver) || currentUser.id === ticket.approver_id
  }

  const canChangeToCompleted = () => {
    if (!currentUser || !ticket) return false

    if (!ticket.approver_id) return true

    return String(currentUser.id) === String(ticket.approver_id)
  }

  const handleMinimize = () => {
    if (!isModal) {
      navigate('/dashboard', { state: { returnToTicket: { ...(ticket || {}), id: id, ticket_id: id } } });
    }
  };

  const getCompleterName = () => {
    if (!ticket?.approver_id) {
      return "Anyone"
    }

    const approverUser = users.find((user) => String(user.id) === String(ticket.approver_id))

    return approverUser ? approverUser.name || approverUser.username : "Assigned Approver"
  }

  useEffect(() => {
    const handleCommentImageClick = (e) => {
      if (e.target && e.target.tagName === "IMG" && e.target.closest(".ET-comment-text")) {
        handleImageClick(e.target.src)
      }
    }

    document.addEventListener("click", handleCommentImageClick)
    return () => {
      document.removeEventListener("click", handleCommentImageClick)
    }
  }, [])

  const formatCommentContent = (text) => {
    if (!text) return ""

    let formatted = text.replace(/\n/g, "<br />")

    formatted = formatted.replace(
      /<img[^>]+src="(?!\s*)([^"]+)"[^>]*>/g,
      (match, src) => `<img src="${src}" class="comment-image" />`,
    )

    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi
    formatted = formatted.replace(urlRegex, (url) => {
      let fullUrl = url
      if (url.toLowerCase().startsWith("www.")) {
        fullUrl = "https://" + url
      }

      try {
        new URL(fullUrl)
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="comment-link" style="color: #3b82f6; text-decoration: underline; cursor: pointer; word-break: break-all;">${url}</a>`
      } catch (e) {
        return url
      }
    })

    const mentionRegex = /@([A-Za-z]+\s+[A-Za-z]+)(?=\s|$|\.|,|;|:|!|\?|<\/)/g
    formatted = formatted.replace(mentionRegex, '@<span style="color: #78176b; font-weight: 500;">$1</span>')

    return formatted
  }

  const recognitionRef = useRef(null)

  const startVoiceToText = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.")
        return
      }

      if (isRecording) {
        if (recognitionRef.current) {
          recognitionRef.current.stop()
        }
        setIsRecording(false)
        return
      }

      // Stop any existing recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }

      const input = document.getElementById("comment-input")
      // Clean up any old interim span if left
      const initialText = input ? input.innerHTML.replace(/<span class="ET-voice-interim"[^>]*>.*?<\/span>/g, "") : ""

      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"
      setIsRecording(true)

      recognition.onresult = (event) => {
        let finalTranscript = ""
        let interimTranscript = ""
        for (let i = 0; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += trans
          } else {
            interimTranscript += trans
          }
        }

        const inputEl = document.getElementById("comment-input")
        if (inputEl) {
          if (interimTranscript) {
            inputEl.innerHTML = initialText + finalTranscript + ` <span class="ET-voice-interim" style="color: #6b7280; font-style: italic; opacity: 0.8;">${interimTranscript}</span>`
          } else {
            inputEl.innerHTML = initialText + finalTranscript
          }
          setNewComment(inputEl.innerHTML)

          // Keep cursor at the end
          try {
            const range = document.createRange()
            const sel = window.getSelection()
            range.selectNodeContents(inputEl)
            range.collapse(false)
            sel.removeAllRanges()
            sel.addRange(range)
            inputEl.focus()
          } catch (_) { }
        }
      }

      const cleanupInterim = () => {
        const inputEl = document.getElementById("comment-input")
        if (inputEl) {
          const spans = inputEl.querySelectorAll(".ET-voice-interim")
          spans.forEach(s => s.remove())
          setNewComment(inputEl.innerHTML)
        }
      }

      recognition.onerror = () => {
        cleanupInterim()
        setIsRecording(false)
        recognitionRef.current = null
      }

      recognition.onend = () => {
        cleanupInterim()
        setIsRecording(false)
        recognitionRef.current = null
      }

      recognition.start()
    } catch (_) { }
  }

  const validateWorkflowTransition = (currentStatus, newStatus) => {
    const statusFlow = {
      NEW: ["IN PROGRESS"],
      "IN PROGRESS": ["BLOCKED", "QA", "COMPLETED"],
      BLOCKED: ["IN PROGRESS"],
      QA: ["IN PROGRESS", "COMPLETED"],
    }

    const currentStatusUpper = currentStatus?.toUpperCase()
    const newStatusUpper = newStatus?.toUpperCase()

    if (currentStatusUpper === newStatusUpper) {
      return { valid: true }
    }

    const allowedTransitions = statusFlow[currentStatusUpper]
    if (!allowedTransitions) {
      return { valid: false, message: `Invalid current status: ${currentStatus}` }
    }

    if (!allowedTransitions.includes(newStatusUpper)) {
      const allowedStatuses = allowedTransitions.join(", ")
      return {
        valid: false,
        message: `Invalid status transition. From "${currentStatus}" you can only move to: ${allowedStatuses}`,
      }
    }

    return { valid: true }
  }

  const triggerAutoSave = async (fieldUpdates = {}) => {
    if (!ticket || !id) return;
    try {
      const storedUserData = localStorage.getItem("user");
      const storedUser = storedUserData ? JSON.parse(storedUserData) : null;
      const currentUserId = storedUser?.id || localStorage.getItem("userId") || 1;
      const currentUsername = storedUser?.username || localStorage.getItem("username") || "Unknown User";

      const updateData = {
        title: ticketTitle?.trim() || ticket?.title || "",
        description: description,
        priority: fieldUpdates.priority !== undefined ? fieldUpdates.priority : priority,
        status: fieldUpdates.status !== undefined ? fieldUpdates.status : status,
        due_date: fieldUpdates.due_date !== undefined ? fieldUpdates.due_date : dueDate,
        assignee_id: fieldUpdates.assignee !== undefined ? (fieldUpdates.assignee ? Number.parseInt(fieldUpdates.assignee) : null) : (assignee ? Number.parseInt(assignee) : null),
        collaborator_id: fieldUpdates.collaborator !== undefined ? (fieldUpdates.collaborator ? Number.parseInt(fieldUpdates.collaborator) : null) : (collaborator ? Number.parseInt(collaborator) : null),
        approver_id: fieldUpdates.approver !== undefined ? (fieldUpdates.approver ? Number.parseInt(fieldUpdates.approver) : null) : (approver ? Number.parseInt(approver) : null),
        project_id: fieldUpdates.project !== undefined ? (fieldUpdates.project ? Number.parseInt(fieldUpdates.project) : null) : (project ? Number.parseInt(project) : null),
        creator_id: currentUserId,
        user_id: currentUserId,
        username: currentUsername,
      };
      await updateTicket(id, updateData);
      if (isModal && onSaveProp) {
        onSaveProp(false);
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    }
  };

  const handleSave = async () => {
    if (!ticket) return

    const trimmedTitle = ticketTitle?.trim()
    if (!trimmedTitle) {
      setError("Title cannot be empty or contain only spaces, tabs, or line breaks. Please enter a valid title.")
      return
    }

    setError(null)

    if (dueDate) {
      const creationDate = new Date(ticket?.created_at)
      const selectedDueDate = new Date(dueDate)
      const daysDifference = Math.ceil((selectedDueDate - creationDate) / (1000 * 60 * 60 * 24))

      if (daysDifference > 365) {
        setError("Due date cannot be more than 365 days from the creation date.")
        return
      }
    }

    if (status && ticket?.status) {
      const workflowValidation = validateWorkflowTransition(ticket.status, status)
      if (!workflowValidation.valid) {
        setError(workflowValidation.message)
        return
      }
    }

    if (status && (status.toLowerCase() === "completed" || status.toLowerCase() === "complete")) {
      if (!canChangeToCompleted()) {
        const approverName = getCompleterName()
        setError(`Only ${approverName} can mark this ticket as completed. Please contact the assigned approver.`)
        return
      }
    }

    try {
      setSaving(true)
      const userId = currentUser?.id || localStorage.getItem("userId")
      const username = currentUser?.username || localStorage.getItem("username") || "Unknown User"

      const updateData = {
        title: trimmedTitle,
        description: description,
        priority: priority,
        status: status,
        due_date: dueDate,
        assignee_id: assignee ? Number.parseInt(assignee) : null,
        collaborator_id: collaborator ? Number.parseInt(collaborator) : null,
        approver_id: approver ? Number.parseInt(approver) : null,
        project_id: project ? Number.parseInt(project) : null,
        creator_id: userId,
        user_id: userId,
        username: username,
      }

      await updateTicket(id, updateData)
      setIsDescEditing(false)
      if (isModal && onSaveProp) {
        onSaveProp(false);
      } else {
        navigate("/dashboard")
      }
    } catch (error) {
      console.error("Error saving ticket:", error)
      setError(error.response?.data?.error || "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (isModal && onClose) {
      onClose();
    } else {
      navigate(-1)
    }
  }

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to move this ticket to Deleted Tickets?")) {
      try {
        await moveTicketToDeleted(id)
        if (isModal && onClose) {
          if (onSaveProp) onSaveProp();
          onClose();
        } else {
          navigate("/dashboard")
        }
      } catch (error) {
        console.error("Error moving ticket to deleted:", error)
        setError("Failed to move ticket to Deleted Tickets")
      }
    }
  }

  const handleSectionToggle = (setter) => {
    setter((v) => !v)
  }



  if (error && !ticket) {
    return (
      <div className="ET-edit-ticket-container">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
          }}
        >
          <div>Error: {error}</div>
          <button onClick={handleBack} style={{ marginTop: "20px", padding: "10px 20px" }}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const content = (
    <div className={`ET-edit-ticket-container ET-jira${isModal ? ' ET-modal-mode' : ''}`}>
      {error && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            padding: "12px 16px",
            margin: "16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          {error}
        </div>
      )}

      <div className="ET-header-section ET-jira-header">
        <div className="ET-ticket-info">
          <textarea
            className="ET-ticket-title"
            value={ticketTitle}
            readOnly={!isDescEditing}
            onChange={(e) => {
              setTicketTitle(e.target.value)
              e.target.style.height = "auto"
              e.target.style.height = e.target.scrollHeight + "px"
            }}
            placeholder="Enter ticket title"
            rows={1}
            style={{
              minHeight: "28px",
              maxHeight: "200px",
              overflowY: "hidden",
              cursor: !isDescEditing ? "default" : "text",
            }}
          />
        </div>
        <div className="ET-header-actions">
          <button
            className="ET-btn-compact ET-btn-primary"
            title={isDescEditing ? "Save Title & Description" : "Edit Title & Description"}
            onClick={isDescEditing ? handleSave : () => setIsDescEditing(true)}
            disabled={saving}
            style={{ padding: "8px" }}
          >
            {saving ? (
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid white", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
            ) : isDescEditing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>
          <button className="ET-btn-compact ET-btn-danger" title="Delete" onClick={handleDelete} style={{ padding: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
        <div className="ET-header-icons">
          <div
            className="ET-icon-button"
            title="Attachments"
            onClick={toggleAttachmentsModal}
            style={{ position: "relative" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
            {attachments && attachments.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  background: "#402b3c",
                  color: "#fff",
                  borderRadius: "9999px",
                  padding: "0 6px",
                  height: "18px",
                  lineHeight: "18px",
                  fontSize: "11px",
                  fontWeight: 500,
                  boxShadow: "0 0 0 2px #fff",
                }}
              >
                {attachments.length}
              </span>
            )}
          </div>
          <div className="ET-icon-button" title="Upload Attachment" onClick={toggleUploadModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          {isModal && (
            <div className="ET-icon-button" title="Open Full Screen" onClick={() => {
              if (onClose) onClose();
              navigate(`/edit-ticket/${id}`);
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </div>
          )}
          {!isModal && (
            <div className="ET-icon-button" title="Minimize to Popup" onClick={handleMinimize}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            </div>
          )}
          <div className="ET-icon-button" title="Close" onClick={handleBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>
      </div>

      <div className="ET-main-body ET-jira-body">
        <div className="ET-left-section ET-jira-left">
          <div className="ET-description-section">
            <div className="ET-section-toggle ET-section-toggle-no-hover" style={{ cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Description</span>
              </div>
            </div>
            <div className="ET-description-box">
              {isDescEditing ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter ticket description..."
                  autoFocus
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    border: "none",
                    background: "transparent",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    lineHeight: "1.7",
                    color: "inherit",
                    outline: "none",
                  }}
                />
              ) : (
                <div className="ET-description-read">
                  {description ? (
                    description.split(/(?=\s*\b\d+\.\s+|\s*\b\d+\)\s+|\s*(?:\u2705|\u274C|\uD83D\uDD04)\s*|\s*\b\d+\s+[A-Z])/).map((part, i) => (
                      <span key={i} style={{ display: 'block', marginBottom: part.match(/^\s*(?:\u2705|\u274C|\uD83D\uDD04)/) ? '8px' : '2px', marginTop: part.match(/^\s*(?:\u2705|\u274C|\uD83D\uDD04)/) ? '12px' : '0' }}>
                        {part.trim()}
                      </span>
                    ))
                  ) : <span style={{ color: '#9e9890', fontStyle: 'italic' }}>No description added yet. Click Edit to add one.</span>}
                </div>
              )}
            </div>
          </div>

          <div className="ET-discussion-section">
            <div
              className="ET-section-toggle ET-section-toggle-no-hover"
              style={{
                cursor: 'default',
                borderBottom: 'none',
                padding: '10px 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'nowrap',
                gap: '16px',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>Activity</span>
              </div>
              <div
                className="ET-activity-tabs"
                style={{
                  '--active-index':
                    activeActivityTab === 'all' ? 0 :
                      activeActivityTab === 'comments' ? 1 :
                        activeActivityTab === 'history' ? 2 :
                          activeActivityTab === 'worklog' ? 3 : 0
                }}
              >
                <button
                  className={`ET-activity-tab ${activeActivityTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveActivityTab("all")}
                >
                  All
                </button>
                <button
                  className={`ET-activity-tab ${activeActivityTab === "comments" ? "active" : ""}`}
                  onClick={() => setActiveActivityTab("comments")}
                >
                  Comments
                </button>
                <button
                  className={`ET-activity-tab ${activeActivityTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveActivityTab("history")}
                >
                  History
                </button>
                <button
                  className={`ET-activity-tab ${activeActivityTab === "worklog" ? "active" : ""}`}
                  onClick={() => setActiveActivityTab("worklog")}
                >
                  Work Log
                </button>
              </div>
            </div>
            <div className="ET-activity-body-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

              {(activeActivityTab === "all" ||
                activeActivityTab === "comments" ||
                activeActivityTab === "history") && (
                  <div className="ET-unified-activity-area">
                    {unifiedActivity.length === 0 ? (
                      <div className="ET-no-activity">
                        <p>No activity yet</p>
                      </div>
                    ) : (
                      unifiedActivity.map((item) => {
                        if (item.type === "comment") {
                          return (
                            <CommentThread
                              key={item.id || item.data.timestamp || item.data.username}
                              comment={item.data}
                              hideActions={activeActivityTab === "all"}
                              isRoot={true}
                            />
                          )
                        } else if (item.type === "history") {
                          const historyItem = item.data
                          return (
                            <div key={historyItem.id} className="ET-history-item">
                              <div className="ET-history-icon">
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12,6 12,12 16,14" />
                                </svg>
                              </div>
                              <div className="ET-history-content">
                                <div className="ET-history-action">
                                  {formatChangeTypeLabel(historyItem.change_type)}
                                </div>
                                <div className="ET-history-details">
                                  {historyItem.change_type === "comment" ||
                                    historyItem.change_type === "comment_edit" ? (
                                    historyItem.new_value ? (
                                      <span className="ET-history-snippet" title={historyItem.new_value}>
                                        {truncateText(historyItem.new_value, 240)}
                                      </span>
                                    ) : null
                                  ) : (
                                    <>
                                      {historyItem.change_details &&
                                        (() => {
                                          const full = formatChangeDetails(
                                            historyItem.change_details,
                                            historyItem.change_type,
                                          )
                                          const short = truncateText(full, 240)
                                          return full ? (
                                            <span className="ET-history-snippet" title={full}>
                                              {short}
                                            </span>
                                          ) : null
                                        })()}
                                      {(historyItem.old_value || historyItem.new_value) &&
                                        (() => {
                                          const oldShort = truncateText(historyItem.old_value, 160)
                                          const newShort = truncateText(historyItem.new_value, 160)
                                          const fullTitle =
                                            `${historyItem.old_value || ""}${historyItem.old_value && historyItem.new_value ? " → " : ""}${historyItem.new_value || ""}`.trim()
                                          return (
                                            <span className="ET-history-snippet" title={fullTitle}>
                                              {historyItem.old_value ? oldShort : ""}
                                              {historyItem.old_value && historyItem.new_value ? " → " : ""}
                                              {historyItem.new_value ? newShort : ""}
                                            </span>
                                          )
                                        })()}
                                    </>
                                  )}
                                  {historyItem.changed_by && <span>by {historyItem.changed_by}</span>}
                                </div>
                                <div className="ET-history-time">{formatHistoryTime(historyItem.changed_at)}</div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      })
                    )}
                  </div>
                )}

              {activeActivityTab === "comments" && (
                <div className="ET-comment-wrapper">
                  <div className="ET-comment-input-container">

                    {/* Edit Indicator */}
                    {editingMessageId && (
                      <div className="ET-comment-suggestions">
                        <div className="ET-edit-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                          <span style={{ color: '#78176b', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                            Editing Comment
                          </span>
                          <button
                            type="button"
                            className="ET-chip ET-cancel-edit-chip-btn"
                            onClick={handleCancelEditMessage}
                            style={{
                              background: '#f5f3f0',
                              border: '1px solid #d4cfc9',
                              borderRadius: '16px',
                              padding: '4px 12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              color: '#c62828',
                              fontWeight: 500,
                              transition: 'all 0.15s ease',
                              flex: 'initial',
                              width: 'auto'
                            }}
                          >
                            Cancel Edit
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Editable Comment Area */}
                    <div style={{ position: "relative", display: "flex", flex: 1, flexDirection: "column" }}>
                      <div
                        id="comment-input"
                        className="ET-comment-input"
                        contentEditable={!sendingComment && !pastingImage}
                        onPaste={handlePaste}
                        onInput={(e) => {
                          const html = e.currentTarget.innerHTML
                          const plainText = e.currentTarget.innerText

                          setNewComment(html)
                          const tmp = document.createElement("div")
                          tmp.innerHTML = html
                          const mentionText = (tmp.textContent || "").toString()
                          const lastAt = mentionText.lastIndexOf("@")
                          if (lastAt !== -1) {
                            const after = mentionText.substring(lastAt + 1)
                            const words = after.trim().split(/\s+/)
                            const q = words.length >= 2 ? words.slice(0, 2).join(" ") : words[0] || ""
                            const qLower = (q || "").toLowerCase()
                            const results = (users || []).filter(
                              (u) =>
                                (u.username || "").toLowerCase().includes(qLower) ||
                                (u.name || "").toLowerCase().includes(qLower),
                            )
                            const el = document.getElementById("comment-input")
                            if (el) {
                              const rect = el.getBoundingClientRect()
                              setMentionDropdownPos({ top: rect.top - 8, left: rect.left })
                            }
                            setMentionQuery(q)
                            setMentionResults(results)
                            setShowMentionDropdown(results.length > 0)
                            return
                          }
                          setShowMentionDropdown(false)
                          setMentionQuery("")
                          setMentionResults([])
                        }}


                        data-placeholder={pastingImage ? "Processing image..." : (editingMessageId ? "Edit comment..." : "Add a comment...")}
                        suppressContentEditableWarning={true}
                      />

                    </div>

                    {showMentionDropdown && mentionResults.length > 0 && (
                      <ul
                        style={{
                          position: "fixed",
                          top: mentionDropdownPos.top,
                          left: mentionDropdownPos.left,
                          transform: "translateY(-100%)",
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 4,
                          minWidth: 200,
                          maxWidth: 300,
                          maxHeight: 160,
                          overflowY: "auto",
                          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                          zIndex: 1000,
                        }}
                      >
                        {mentionResults.map((u) => (
                          <li
                            key={u.id}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              const input = document.getElementById("comment-input")
                              if (!input) return
                              const current = input.innerHTML
                              const newContent = current.replace(/(@[^\s]*)$/, `@${u.username || u.name} `)
                              input.innerHTML = newContent
                              setNewComment(input.innerHTML)
                              setTimeout(() => {
                                const range = document.createRange()
                                const sel = window.getSelection()
                                range.selectNodeContents(input)
                                range.collapse(false)
                                sel.removeAllRanges()
                                sel.addRange(range)
                                input.focus()
                              }, 0)
                              setShowMentionDropdown(false)
                              setMentionResults([])
                              setMentionQuery("")
                            }}
                            style={{
                              listStyle: "none",
                              padding: "6px 8px",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 12,
                              color: "inherit",
                            }}
                          >
                            @{u.username || u.name}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Send Button and Toolbar */}
                    <div className="ET-comment-toolbar">
                      <div className="ET-formatting-toolbar">
                        <button type="button" className="ET-toolbar-btn" style={{ fontWeight: 500 }} onMouseDown={(e) => { e.preventDefault(); const el = document.getElementById('comment-input'); if (el) { el.focus(); document.execCommand('bold', false, null); setNewComment(el.innerHTML); } }}>B</button>
                        <button type="button" className="ET-toolbar-btn" style={{ fontStyle: 'italic' }} onMouseDown={(e) => { e.preventDefault(); const el = document.getElementById('comment-input'); if (el) { el.focus(); document.execCommand('italic', false, null); setNewComment(el.innerHTML); } }}>I</button>
                        <button type="button" className="ET-toolbar-btn" style={{ textDecoration: 'underline' }} onMouseDown={(e) => { e.preventDefault(); const el = document.getElementById('comment-input'); if (el) { el.focus(); document.execCommand('underline', false, null); setNewComment(el.innerHTML); } }}>U</button>
                        <button type="button" className="ET-toolbar-btn" onMouseDown={(e) => { e.preventDefault(); const el = document.getElementById('comment-input'); if (el) { el.focus(); document.execCommand('insertUnorderedList', false, null); setNewComment(el.innerHTML); } }}>•</button>
                        <button type="button" className="ET-toolbar-btn" onMouseDown={(e) => { e.preventDefault(); const el = document.getElementById('comment-input'); if (el) { el.focus(); document.execCommand('insertOrderedList', false, null); setNewComment(el.innerHTML); } }}>1.</button>
                        <button
                          type="button"
                          className="ET-toolbar-btn"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            startVoiceToText();
                          }}
                          style={isRecording ? { color: "#dc2626", backgroundColor: "#fee2e2" } : {}}
                          title="Voice to text"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        className="ET-send-btn"
                        onClick={
                          editingMessageId
                            ? handleSaveEditMessage
                            : handleAddActivityComment
                        }
                        disabled={
                          !newComment.replace(/<[^>]*>?/gm, '').trim() ||
                          sendingComment ||
                          pastingImage
                        }
                      >
                        {pastingImage ? "⏳" : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)', marginLeft: '-2px', pointerEvents: 'none' }}>
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {activeActivityTab === "worklog" && (
                <div className="ET-worklog-container">
                  {workLogs.length === 0 ? (
                    <div className="ET-worklog-empty">
                      <div className="ET-worklog-clock">
                        <svg
                          width="64"
                          height="64"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#5e0954ff"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 15.5 14" />
                        </svg>
                      </div>
                      <div className="ET-worklog-empty-text">
                        <div style={{ fontSize: "16px", fontWeight: 500, color: "inherit", marginBottom: "8px" }}>
                          No time was logged for this Story yet.
                        </div>
                        <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
                          Logging time lets you track and report on the time spent on the work.
                        </div>
                        <button className="ET-worklog-log-time-btn" onClick={() => handleOpenLogTime()}>
                          Log time
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ET-worklog-list">
                      {workLogs.map((log) => {
                        const user = users.find((u) => u.id === log.user_id)
                        const canEdit = currentUser && (currentUser.id === log.user_id || String(currentUser.id) === String(log.user_id))
                        return (
                          <div key={log.id} className="ET-worklog-entry">
                            <div className="ET-worklog-entry-header">
                              <div className="ET-worklog-user-info">
                                <div
                                  className="ET-user-avatar ET-small"
                                  style={{ backgroundColor: stringToColor(user?.username || log.username || "") }}
                                >
                                  {getInitials(user?.username || log.username || "")}
                                </div>
                                <div>
                                  <div className="ET-worklog-username">{user?.username || log.username || "Unknown"}</div>
                                  <div className="ET-worklog-time-info">
                                    logged {log.time_spent || "0m"}
                                    {log.time_remaining && ` • ${log.time_remaining} remaining`}
                                  </div>
                                  <div className="ET-worklog-timestamp">
                                    {log.created_at
                                      ? new Date(log.created_at).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                      })
                                      : ""}
                                    {(() => {
                                      const created = log.created_at ? new Date(log.created_at) : null
                                      if (!created) return ""
                                      const now = new Date()
                                      const diffMs = now - created
                                      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                                      if (diffDays === 0) return " (today)"
                                      if (diffDays === 1) return " (1 day ago)"
                                      if (diffDays < 7) return ` (${diffDays} days ago)`
                                      return ""
                                    })()}
                                  </div>
                                </div>
                              </div>
                              {canEdit && (
                                <div className="ET-worklog-actions">
                                  <button
                                    className="ET-worklog-action-btn"
                                    onClick={() => handleOpenLogTime(log)}
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="ET-worklog-action-btn ET-worklog-delete-btn"
                                    onClick={() => handleDeleteWorkLog(log.id)}
                                    title="Delete"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                            {log.work_description && (
                              <div className="ET-worklog-description">{log.work_description}</div>
                            )}
                          </div>
                        )
                      })}
                      <button className="ET-worklog-log-time-btn" onClick={() => handleOpenLogTime()} style={{ marginTop: "16px" }}>
                        Log time
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ET-right-section ET-jira-right">
          <div className="ET-section-header">
            Details
            <div className="ET-ticket-id" style={{ marginLeft: 'auto' }}>#{id}</div>
          </div>
          <div className="ET-form-fields-block">
            <div className="ET-form-field ET-readlike" style={{ cursor: "default" }}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <label>Creator</label>
              {ticket?.creator_name ? (
                <>
                  <div className="ET-detail-avatar" style={{ backgroundColor: stringToColor(ticket.creator_name) }}>
                    {getInitials(ticket.creator_name)}
                  </div>
                  <div style={{ paddingLeft: "36px", color: "inherit", fontSize: "12.48px", fontWeight: 400, height: "32px", display: "flex", alignItems: "center" }}>
                    {ticket.creator_name}
                  </div>
                </>
              ) : (
                <div style={{ color: "#6b7280", fontSize: "12.48px", height: "32px", display: "flex", alignItems: "center" }}>Unknown</div>
              )}
            </div>

            <div className="ET-form-field ET-readlike" onClick={() => setEditingField("assignee")}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <label>Assignee</label>
              {assignee && getDisplayName(assignee) && (
                <div className="ET-detail-avatar" style={{ backgroundColor: stringToColor(getDisplayName(assignee)) }}>
                  {getInitials(getDisplayName(assignee))}
                </div>
              )}
              <CustomSelect
                options={[
                  { label: "No Assignee", value: "", className: "is-default" },
                  ...(project && projectUsers.length > 0 ? projectUsers : users).map((user) => ({
                    label: user.username,
                    value: user.id.toString(),
                  })),
                ]}
                value={assignee}
                onChange={(val) => {
                  setAssignee(val)
                  setEditingField(null)
                  triggerAutoSave({ assignee: val })
                }}
                searchable={true}
                placeholder="Select Assignee"
              />
            </div>

            <div className="ET-form-field ET-readlike" onClick={() => setEditingField("collaborator")}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <label>Collaborator</label>
              {collaborator && getDisplayName(collaborator) && (
                <div className="ET-detail-avatar" style={{ backgroundColor: stringToColor(getDisplayName(collaborator)) }}>
                  {getInitials(getDisplayName(collaborator))}
                </div>
              )}
              <CustomSelect
                options={[
                  { label: "No Collaborator", value: "", className: "is-default" },
                  ...(project && projectUsers.length > 0 ? projectUsers : users).map((user) => ({
                    label: user.username,
                    value: user.id.toString(),
                  })),
                ]}
                value={collaborator}
                onChange={async (val) => {
                  const newId = val
                  setCollaborator(newId)
                  setEditingField(null)
                  triggerAutoSave({ collaborator: newId })
                  try {
                    if (newId) {
                      await fetch("/api/notify-assignment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ ticket_id: id, user_id: Number.parseInt(newId), role: "collaborator" }),
                      })
                    }
                  } catch (_) { }
                }}
                searchable={true}
                placeholder="Select Collaborator"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9e9890" strokeWidth="2" style={{ flexShrink: 0 }}>

              </svg>
            </div>

            <div className="ET-form-field ET-readlike" onClick={() => setEditingField("approver")}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />

              </svg>
              <label>Approver</label>
              {approver && getDisplayName(approver) && (
                <div className="ET-detail-avatar" style={{ backgroundColor: stringToColor(getDisplayName(approver)) }}>
                  {getInitials(getDisplayName(approver))}
                </div>
              )}
              <CustomSelect
                options={[
                  { label: "No Approver", value: "", className: "is-default" },
                  ...(project && projectUsers.length > 0 ? projectUsers : users).map((user) => ({
                    label: user.username,
                    value: user.id.toString(),
                  })),
                ]}
                value={approver}
                onChange={async (val) => {
                  const newId = val
                  setApprover(newId)
                  setEditingField(null)
                  triggerAutoSave({ approver: newId })
                  try {
                    if (newId) {
                      await fetch("/api/notify-assignment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ ticket_id: id, user_id: Number.parseInt(newId), role: "approver" }),
                      })
                    }
                  } catch (_) { }
                }}
                searchable={true}
                placeholder="Select Approver"
              />
            </div>

            <div className="ET-form-field ET-readlike" onClick={() => setEditingField("project")}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <label>Project</label>
              <CustomSelect
                options={[
                  { label: "No Project", value: "", className: "is-default" },
                  ...projects.map((proj) => ({
                    label: proj.name || proj.project_name,
                    value: (proj.id || proj.project_id).toString(),
                  })),
                ]}
                value={project}
                onChange={(val) => {
                  setProject(val)
                  setEditingField(null)
                  triggerAutoSave({ project: val })
                }}
                searchable={true}
                placeholder="Select Project"
              />
            </div>


            <div className="ET-form-field ET-readlike" onClick={() => setEditingField("priority")}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              <label>Priority</label>
              <CustomSelect
                options={[
                  { label: "No Priority", value: "", className: "is-default" },
                  { label: "Low", value: "Low", color: "#22c55e", className: "ET-prio-low" },
                  { label: "Medium", value: "Medium", color: "#eab308", className: "ET-prio-medium" },
                  { label: "High", value: "High", color: "#ef4444", className: "ET-prio-high" },
                ]}
                value={priority}
                onChange={(val) => {
                  setPriority(val)
                  setEditingField(null)
                  triggerAutoSave({ priority: val })
                }}
                searchable={false}
                placeholder="Select Priority"
              />
            </div>

            <div className="ET-form-field ET-readlike">
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <label>Date Range</label>
              <CustomDatePicker
                vAlign="top"
                selectsRange={true}
                startDate={startDate}
                endDate={dueDate}
                onChange={([newStart, newEnd]) => {
                  setStartDate(newStart || "")
                  setDueDate(newEnd || "")
                  setEditingField(null)
                  if (newEnd) {
                    triggerAutoSave({ start_date: newStart || "", due_date: newEnd || "" })
                  }
                }}
                placeholder="Select date range"
              />
            </div>

            <div className="ET-form-field ET-readlike" onClick={() => setEditingField("status")}>
              <svg className="ET-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <label>Status</label>
              <CustomSelect
                vAlign="top"
                options={[
                  { label: "Select Status", value: "", disabled: true },
                  ...(isLoadingStatuses
                    ? [{ label: "Loading statuses...", value: "loading", disabled: true }]
                    : statusError
                      ? [{ label: "Error loading statuses", value: "error", disabled: true }]
                      : statuses.map((statusItem) => {
                        const statusName = statusItem.name || statusItem.status
                        const isCompletedStatus =
                          (statusName || "").toLowerCase() === "completed" ||
                          (statusName || "").toLowerCase() === "complete"
                        const canSelectCompleted = !isCompletedStatus || canChangeToCompleted()
                        const workflowValidation = ticket?.status
                          ? validateWorkflowTransition(ticket.status, statusName)
                          : { valid: true }
                        const isWorkflowValid = workflowValidation.valid
                        const disabled = !canSelectCompleted || !isWorkflowValid
                        const formattedLabel = statusName ? statusName.toString().toLowerCase().replace(/^\w/, c => c.toUpperCase()) : ""
                        return {
                          label: formattedLabel,
                          value: statusName,
                          disabled: disabled,
                        }
                      })),
                ]}
                value={status}
                onChange={(val) => {
                  const newStatus = val

                  if (newStatus && ticket?.status) {
                    const workflowValidation = validateWorkflowTransition(ticket.status, newStatus)
                    if (!workflowValidation.valid) {
                      setError(workflowValidation.message)
                      return
                    }
                  }

                  if (
                    newStatus &&
                    (newStatus.toLowerCase() === "completed" || newStatus.toLowerCase() === "complete")
                  ) {
                    if (ticket?.approver_id && String(currentUser?.id) !== String(ticket.approver_id)) {
                      const approverName = getCompleterName()
                      setError(
                        `Only ${approverName} can mark this ticket as completed. Please contact the assigned approver.`,
                      )
                      return
                    } else {
                      setError(null)
                    }
                  }

                  setStatus(newStatus)
                  setError(null)
                  setEditingField(null)
                  triggerAutoSave({ status: newStatus })
                }}
                searchable={false}
                placeholder="Select Status"
              />
            </div>
          </div>
        </div>
      </div>

      {showImagePreview && (
        <div className="ET-image-preview-modal" onClick={closeImagePreview} style={{ zIndex: 2000 }}>
          <div className="ET-image-preview-content" onClick={(e) => e.stopPropagation()}>
            {/* Floating × close button — top right corner */}
            <button className="ET-preview-close-float" onClick={closeImagePreview} title="Close preview">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="ET-image-preview-header">
              <div className="ET-image-preview-controls">
                <button className="ET-zoom-btn" onClick={() => handleImageZoom(0.2)} title="Zoom In">
                  ➕
                </button>
                <button className="ET-zoom-btn" onClick={() => handleImageZoom(-0.2)} title="Zoom Out">
                  ➖
                </button>
                <button className="ET-reset-zoom-btn" onClick={() => setImageScale(1)} title="Reset Zoom">
                  Reset
                </button>
              </div>
            </div>
            <div className="ET-image-preview-body">
              <img
                src={previewImage || "/placeholder.svg"}
                alt="Preview"
                style={{ transform: `scale(${imageScale})` }}
                className="ET-preview-image"
              />
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="ET-modal-overlay" onClick={toggleUploadModal}>
          <div className="ET-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ET-modal-header">
              <h3>Upload File</h3>
              <button className="ET-modal-close-btn" onClick={toggleUploadModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ET-modal-body">
              <div
                className={`ET-upload-area ${isDragging ? "dragging" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input type="file" id="file-upload" onChange={handleFileSelect} style={{ display: "none" }} />
                <label htmlFor="file-upload" className="ET-file-upload-label">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Click to select a file</span>
                  <span className="ET-upload-hint">or drag and drop</span>
                </label>
                {selectedFile && (
                  <div className="ET-selected-file">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Selected: {selectedFile.name}</span>
                      <span className="ET-file-size">({formatFileSize(selectedFile.size)})</span>
                    </div>
                    <button
                      className="ET-remove-file-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setSelectedFile(null);
                        const fileInput = document.getElementById('file-upload');
                        if (fileInput) fileInput.value = '';
                      }}
                      title="Remove file"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="ET-modal-actions">
                <button className="ET-btn-secondary" onClick={toggleUploadModal} disabled={uploadingFile}>
                  Cancel
                </button>
                <button className="ET-btn-primary" onClick={handleFileUpload} disabled={!selectedFile || uploadingFile}>
                  {uploadingFile ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAttachmentsModal && (
        <div className="ET-modal-overlay" onClick={toggleAttachmentsModal}>
          <div className="ET-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ET-modal-header">
              <h3>Attachments</h3>
              <button className="ET-modal-close-btn" onClick={toggleAttachmentsModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ET-modal-body">
              <div className="ET-attachments-list">
                {attachments.length === 0 ? (
                  <div className="ET-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21,15 16,10 5,21" />
                    </svg>
                    <span>No attachments found</span>
                  </div>
                ) : (
                  attachments.map((attachment) => (
                    <div key={attachment.id} className="ET-attachment-item">
                      <div className="ET-attachment-thumbnail-wrapper">
                        {attachment.file_type && attachment.file_type.startsWith('image/') ? (
                          <img
                            src={`/attachments/${attachment.file_path}`}
                            alt={attachment.file_name}
                            className="ET-attachment-thumbnail"
                          />
                        ) : (
                          <div className="ET-attachment-icon-placeholder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                              <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="ET-attachment-info">
                        <div className="ET-attachment-name" title={attachment.file_name}>
                          {attachment.file_name}
                        </div>
                        <div className="ET-attachment-meta">
                          <span>{formatHistoryTime(attachment.uploaded_at)}</span>
                          {attachment.uploaded_by && (
                            <>
                              <span>•</span>
                              <span>by {attachment.uploaded_by}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ET-attachment-actions">
                        <button
                          className="ET-att-icon-btn ET-att-preview"
                          onClick={() => handleFilePreview(attachment)}
                          title="Preview"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          className="ET-att-icon-btn ET-att-download"
                          onClick={() => handleFileDownload(attachment.file_path, attachment.file_name)}
                          title="Download"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                        <button
                          className="ET-att-icon-btn ET-att-delete"
                          onClick={() => handleFileDelete(attachment.id)}
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showUnsupportedFileModal && (
        <UnsupportedFileModal
          message={unsupportedFileMessage}
          onClose={() => {
            setShowUnsupportedFileModal(false)
            setUnsupportedFileMessage("")
          }}
        />
      )}

      {showLogTimeModal && (
        <div className="ET-modal-overlay" onClick={handleCloseLogTime}>
          <div className="ET-worklog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ET-worklog-modal-header">
              <h3>Time tracking</h3>
              <button className="ET-modal-close-btn" onClick={handleCloseLogTime}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="ET-worklog-modal-body">
              {/* Progress bar - only show if time is entered */}
              {(logTimeSpent.trim() || logTimeRemaining.trim()) && (() => {
                const spent = parseTimeToMinutes(logTimeSpent)
                const remaining = parseTimeToMinutes(logTimeRemaining)
                const total = spent + remaining
                const spentPercent = total > 0 ? (spent / total) * 100 : 0
                const spentFormatted = formatMinutesToTime(spent) || "0m"
                const remainingFormatted = formatMinutesToTime(remaining) || "0m"
                return (
                  <div className="ET-worklog-progress-bar-container">
                    <div className="ET-worklog-progress-bar">
                      <div
                        className="ET-worklog-progress-spent"
                        style={{ width: `${spentPercent}%` }}
                      />
                      <div
                        className="ET-worklog-progress-remaining"
                        style={{ width: `${100 - spentPercent}%` }}
                      />
                    </div>
                    <div className="ET-worklog-progress-labels">
                      <span>{spentFormatted} logged</span>
                      {remaining > 0 && <span>{remainingFormatted} remaining</span>}
                    </div>
                  </div>
                )
              })()}

              <div className="ET-worklog-form-row">
                <div className="ET-worklog-form-field">
                  <label>Time spent</label>
                  <div className="ET-worklog-input-wrapper">
                    <input
                      type="text"
                      value={logTimeSpent}
                      onChange={(e) => {
                        setLogTimeSpent(e.target.value)
                      }}
                      placeholder="2w 4d 6h 45m"
                      className="ET-worklog-input"
                    />
                  </div>
                </div>
                <div className="ET-worklog-form-field">
                  <label>
                    Time remaining
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "4px", verticalAlign: "middle" }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </label>
                  <input
                    type="text"
                    value={logTimeRemaining}
                    onChange={(e) => setLogTimeRemaining(e.target.value)}
                    placeholder="2w 4d 6h 45m"
                    className="ET-worklog-input"
                  />
                </div>
              </div>

              <div className="ET-worklog-format-hint">
                Use the format: 2w 4d 6h 45m
                <ul>
                  <li>w = weeks</li>
                  <li>d = days</li>
                  <li>h = hours</li>
                  <li>m = minutes</li>
                </ul>
              </div>

              {/* Date and Time Started - only show if form is expanded */}
              {(logTimeSpent.trim() || logTimeRemaining.trim() || logDateStarted || logTimeStarted) && (
                <div className="ET-worklog-form-row">
                  <div className="ET-worklog-form-field">
                    <label>Date started *</label>
                    <div className="ET-worklog-date-time-wrapper">
                      <input
                        type="date"
                        value={logDateStarted}
                        onChange={(e) => setLogDateStarted(e.target.value)}
                        className="ET-worklog-date-input"
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      />
                      <input
                        type="time"
                        value={logTimeStarted}
                        onChange={(e) => setLogTimeStarted(e.target.value)}
                        className="ET-worklog-time-input"
                      />
                      {logTimeStarted && (
                        <button
                          className="ET-worklog-clear-time"
                          onClick={() => setLogTimeStarted("")}
                          title="Clear time"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Work Description - only show if form is expanded */}
              {(logTimeSpent.trim() || logTimeRemaining.trim() || logWorkDescription.trim()) && (
                <div className="ET-worklog-form-field">
                  <label>Work description</label>
                  <div className="ET-worklog-description-editor">
                    <div className="ET-formatting-toolbar">
                      <button className="ET-toolbar-btn" onClick={() => formatWorkDescription("bold")} title="Bold">
                        <strong>Tt</strong>
                      </button>
                      <button className="ET-toolbar-btn" onClick={() => formatWorkDescription("italic")} title="Italic">
                        <em>I</em>
                      </button>
                      <button className="ET-toolbar-btn" onClick={() => formatWorkDescription("underline")} title="Underline">
                        <u>U</u>
                      </button>
                      <button className="ET-toolbar-btn" onClick={() => formatWorkDescription("bullet")} title="Bullet List">
                        •
                      </button>
                      <button className="ET-toolbar-btn" onClick={() => formatWorkDescription("number")} title="Numbered List">
                        1.
                      </button>
                    </div>
                    <div
                      id="worklog-description-input"
                      className="ET-worklog-description-input"
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={(e) => setLogWorkDescription(e.currentTarget.innerHTML)}
                      data-placeholder="Type /ai for Atlassian Intelligence or @ to mention and notify someone."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="ET-worklog-modal-actions">
              <button
                className="ET-worklog-save-btn"
                onClick={handleSaveWorkLog}
                disabled={!logTimeSpent.trim() && !logTimeRemaining.trim()}
              >
                Save
              </button>
              <button className="ET-worklog-cancel-btn" onClick={handleCloseLogTime}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (isModal) {
    return (
      <div className="ET-modal-overlay" onClick={onClose}>
        <div className="ET-modal-content-wrapper" onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}

const ExportedEditTicket = (props) => (
  <ErrorBoundary>
    <EditTicket {...props} />
  </ErrorBoundary>
)

export default ExportedEditTicket
