import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "./contexts/UserContext";
import "./CreateTicket.css";

const CreateTicket = ({ onClose, isModal, onTicketCreated, projects: propProjects }) => {
  const navigate = useNavigate();
  const { currentUser, loading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [users, setUsers] = useState([]);
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'NEW',
    assignee: '',
    assignee_id: null,
    collaborator: '',
    collaborator_id: null,
    tag: 'Tasks',
    start_date: today,
    due_date: '',
    approver: '',
    approver_id: null
  });
  const [assigneeInput, setAssigneeInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectUsers, setProjectUsers] = useState([]);

  // Use the same project ID memo as Dashboard for consistency
  const assignedProjectIds = useMemo(() => {
    const ids = currentUser?.assigned_projects || [];
    return Array.isArray(ids) ? ids.map(id => String(id).trim()) : [];
  }, [currentUser?.assigned_projects]);

  // Scoped users for when no project is selected yet
  const scopedUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    if (currentUser?.role?.toLowerCase() === 'admin') return users;

    return users.filter(u => {
      const uProjectIds = Array.isArray(u.project_ids)
        ? u.project_ids.map(pid => String(pid))
        : [];
      return uProjectIds.some(pid => assignedProjectIds.includes(pid));
    });
  }, [users, assignedProjectIds, currentUser]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [projects, setProjects] = useState(propProjects || []);
  const [projectInput, setProjectInput] = useState("");
  const [allLabels, setAllLabels] = useState([]);
  const [filteredLabels, setFilteredLabels] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState([]);
  const [showCollaboratorSuggestions, setShowCollaboratorSuggestions] = useState(false);


  useEffect(() => {
    fetchUsers();
    fetchStatuses();
    if (!propProjects || propProjects.length === 0) {
      fetchProjects();
    }
    fetchLabels();
  }, [propProjects, currentUser]);

  // Fetch users for selected project
  useEffect(() => {
    if (selectedProjectId) {
      const fetchProjectUsers = async () => {
        try {
          const response = await fetch(`/api/project/${selectedProjectId}/users`);
          if (response.ok) {
            const users = await response.json();
            console.log('Project users fetched:', users);
            setProjectUsers(Array.isArray(users) ? users : []);
          } else {
            setProjectUsers([]);
          }
        } catch (error) {
          console.error('Error fetching project users:', error);
          setProjectUsers([]);
        }
      };
      fetchProjectUsers();
    } else {
      setProjectUsers([]);
    }
  }, [selectedProjectId]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      setError('Failed to fetch users. Please make sure the backend server is running.');
    }
  };

  const fetchStatuses = async () => {
    setIsLoadingStatuses(true);
    setStatusError("");
    try {
      const response = await fetch("/api/status");
      if (!response.ok) throw new Error("Failed to fetch statuses");
      const data = await response.json();
      const normalizedStatuses = data.map(status => ({
        ...status,
        name: String(status.name || status.status_name || '').trim()
      }));
      setStatuses(normalizedStatuses);
      setFormData(prev => {
        const exactMatch = normalizedStatuses.find(s => s.name === prev.status);
        if (exactMatch) return prev;
        const caseInsensitiveMatch = normalizedStatuses.find(s => s.name.toLowerCase() === (prev.status || '').toLowerCase());
        return caseInsensitiveMatch ? { ...prev, status: caseInsensitiveMatch.name } : prev;
      });
    } catch (err) {
      setStatusError("Failed to load statuses");
    } finally {
      setIsLoadingStatuses(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        let filteredData = data;
        if (currentUser && currentUser.role?.toLowerCase() !== 'admin') {
          const assignedIds = currentUser.assigned_projects || [];
          filteredData = data.filter(p => assignedIds.includes(String(p.id)));
        }
        setProjects(filteredData);
      }
    } catch (error) {
      setError('Failed to fetch projects. Please make sure the backend server is running.');
    }
  };

  const fetchLabels = async () => {
    try {
      const response = await fetch('/api/labels');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setAllLabels(data);
        setFilteredLabels(data);
      }
    } catch (error) {
      setError('Failed to fetch labels. Please make sure the backend server is running.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate title - check if it's empty, contains only whitespace, or invalid characters
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      setError('Title cannot be empty or contain only spaces, tabs, or line breaks. Please enter a valid title.');
      setTitleError(true);
      setIsSubmitting(false);
      return;
    }

    // Check for invalid characters (quotes, slashes, etc.)
    const invalidChars = /[""'`\\\/]/;
    if (invalidChars.test(trimmedTitle)) {
      setError('Title cannot contain quotes, slashes, or backslashes. Please enter a valid title.');
      setTitleError(true);
      setIsSubmitting(false);
      return;
    }

    // Check if title contains only special characters or symbols
    const onlySpecialChars = /^[^a-zA-Z0-9\s]+$/;
    if (onlySpecialChars.test(trimmedTitle)) {
      setError('Title must contain at least one letter or number. Please enter a meaningful title.');
      setTitleError(true);
      setIsSubmitting(false);
      return;
    }

    setTitleError(false);

    // Validate due date - check if it's more than 365 days from creation date
    const creationDate = new Date(formData.start_date);
    const dueDate = new Date(formData.due_date);
    const daysDifference = Math.ceil((dueDate - creationDate) / (1000 * 60 * 60 * 24));

    if (daysDifference > 365) {
      setError('Due date cannot be more than 365 days from the creation date.');
      setIsSubmitting(false);
      return;
    }

    if (loading) {
      setError('Still initializing user profile. Please wait a moment...');
      setIsSubmitting(false);
      return;
    }

    try {
      // Auth Debugging
      const storageUserId = localStorage.getItem('userId');
      const contextUserId = currentUser?.id;
      const creator_id = storageUserId || contextUserId;
      const trimmedTitle = formData.title.trim();

      if (!trimmedTitle) {
        setError('Ticket title is required');
        setTitleError(true);
        setIsSubmitting(false);
        return;
      }

      console.log('CreateTicket Submission - Auth State:', {
        storageUserId,
        contextUserId,
        creator_id,
        currentUser: currentUser ? { id: currentUser.id, username: currentUser.username, role: currentUser.role } : null,
        loading
      });

      if (!creator_id) {
        setError('User not logged in (Session expired). Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/create_ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: trimmedTitle,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          tag: formData.tag,
          start_date: formData.start_date,
          due_date: formData.due_date,
          creator_id: creator_id,
          project_name: projectInput.trim() || null,
          label_id: selectedLabel || null,
          approver_id: formData.approver_id || null,
          collaborator_id: formData.collaborator_id || null,
          assignee_id: formData.assignee_id || null
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ticket');
      }
      const newTicket = await response.json();
      if (typeof onTicketCreated === 'function') {
        onTicketCreated(newTicket);
      }

      if (isModal && onClose) {
        // Modal mode: just close the popup — dashboard is already rendered behind it
        onClose();
      } else {
        // Standalone page mode: navigate to dashboard
        console.log('Ticket created successfully, redirecting to dashboard...');
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while creating the ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Real-time title validation
    if (name === 'title') {
      const trimmedValue = value.trim();

      // Check for empty or whitespace-only title
      if (!trimmedValue) {
        setTitleError(true);
        setError('Title cannot be empty or contain only spaces, tabs, or line breaks.');
        return;
      }

      // Check for invalid characters (quotes, slashes, etc.)
      const invalidChars = /[""'`\\\/]/;
      if (invalidChars.test(trimmedValue)) {
        setTitleError(true);
        setError('Title cannot contain quotes, slashes, or backslashes.');
        return;
      }

      // Check if title contains only special characters or symbols
      const onlySpecialChars = /^[^a-zA-Z0-9\s]+$/;
      if (onlySpecialChars.test(trimmedValue)) {
        setTitleError(true);
        setError('Title must contain at least one letter or number.');
        return;
      }

      // Clear error if title is valid
      setTitleError(false);
      setError('');
    }
  };

  const handleCancel = () => {
    if (isModal && onClose) onClose();
    if (!isModal) navigate('/dashboard');
  };

  const handleAssigneeInput = (e) => {
    const value = e.target.value;
    setAssigneeInput(value);
    let match = null;
    // Use projectUsers if a project is selected, otherwise use all users
    const usersToSearch = selectedProjectId ? projectUsers : users;

    if (value.startsWith('@')) {
      const search = value.slice(1).toLowerCase();
      if (search === "") {
        setFilteredUsers(usersToSearch);
        setShowSuggestions(usersToSearch.length > 0);
      } else {
        match = usersToSearch.find(user => (user.name || user.username).toLowerCase() === search);
        const matches = usersToSearch.filter(user => (user.name || user.username).toLowerCase().includes(search));
        setFilteredUsers(matches);
        setShowSuggestions(matches.length > 0);
      }
    } else {
      match = usersToSearch.find(user => (user.name || user.username).toLowerCase() === value.toLowerCase());
      setShowSuggestions(false);
    }
    if (match) {
      setFormData(prev => ({ ...prev, assignee: match.name || match.username, assignee_id: match.id }));
    } else {
      setFormData(prev => ({ ...prev, assignee: value, assignee_id: null }));
    }
  };

  const handleSelectAssignee = (user) => {
    setAssigneeInput('@' + (user.name || user.username));
    setFormData(prev => ({ ...prev, assignee: user.name || user.username, assignee_id: user.id }));
    setShowSuggestions(false);
  };

  const handleProjectChange = (e) => {
    const selectedProjectName = e.target.value;
    setProjectInput(selectedProjectName);
    setSelectedLabel('');
    setFormData(prev => ({ ...prev, label_id: '' }));
    const selectedProject = projects.find(p => p.name === selectedProjectName);
    if (selectedProject) {
      setSelectedProjectId(selectedProject.id || selectedProject.project_id);
      const projectLabels = allLabels.filter(label => label.project_id === selectedProject.id || label.project_id === selectedProject.project_id);
      setFilteredLabels(projectLabels);
    } else {
      setSelectedProjectId(null);
      setFilteredLabels(allLabels);
    }
  };

  const handleSelectProject = (project) => {
    setProjectInput(project.name);
    setSelectedProjectId(project.id || project.project_id);
    setShowProjectSuggestions(false);
  };

  const handleCollaboratorInput = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, collaborator: value }));
    // Use projectUsers if a project is selected, otherwise use all users
    const usersToSearch = selectedProjectId ? projectUsers : users;

    if (value.startsWith('@')) {
      const search = value.slice(1).toLowerCase();
      if (search === "") {
        setCollaboratorSuggestions(usersToSearch);
        setShowCollaboratorSuggestions(usersToSearch.length > 0);
      } else {
        match = usersToSearch.find(user => (user.name || user.username).toLowerCase() === search);
        const matches = usersToSearch.filter(user => (user.name || user.username).toLowerCase().includes(search));
        setCollaboratorSuggestions(matches);
        setShowCollaboratorSuggestions(matches.length > 0);
      }
    } else {
      match = usersToSearch.find(user => (user.name || user.username).toLowerCase() === value.toLowerCase());
      setShowCollaboratorSuggestions(false);
    }
    if (match) {
      setFormData(prev => ({ ...prev, collaborator: match.name || match.username, collaborator_id: match.id }));
    } else {
      setFormData(prev => ({ ...prev, collaborator: value, collaborator_id: null }));
    }
  };

  const handleSelectCollaborator = (user) => {
    setFormData(prev => ({ ...prev, collaborator: user.name || user.username, collaborator_id: user.id }));
    setShowCollaboratorSuggestions(false);
  };

  const content = (
    <div className="jira-create-ticket-card single-card-centered">
      {isModal && (
        <button className="close-btn" onClick={onClose} title="Close">×</button>
      )}
      <div className="jira-create-main">
        <div className="jira-form-header">
          <h2>Create Ticket</h2>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="jira-create-form jira-create-form-grid">
          <div className="jira-form-col">
            <div className="jira-form-group">
              <label htmlFor="title">Title <span className="required">*</span></label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className={`jira-form-input ${titleError ? 'error' : ''}`}
                placeholder="Enter Ticket Title"
                title="Title cannot be empty or contain only whitespace"
              />
            </div>
            <div className="jira-form-group">
              <label htmlFor="priority" style={{ width: '150px' }}>Priority</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="jira-form-select"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="jira-form-row-flex">
              <div className="jira-form-group flex-half">
                <label htmlFor="project">Project</label>
                <select
                  id="project"
                  name="project"
                  value={projectInput}
                  onChange={handleProjectChange}
                  className="jira-form-select"
                >
                  <option value="">Select Project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.name}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div className="jira-form-group flex-half">
                <label htmlFor="label_id">Label</label>
                <select
                  id="label_id"
                  name="label_id"
                  value={selectedLabel}
                  onChange={e => { setSelectedLabel(e.target.value); setFormData(prev => ({ ...prev, label_id: e.target.value })); }}
                  className="jira-form-select"
                  disabled={!projectInput}
                >
                  <option value="">Select Label</option>
                  {projectInput && filteredLabels.map(label => (
                    <option key={label.label_id} value={label.label_id}>{label.label_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="jira-form-row-flex">
              <div className="jira-form-group flex-half">
                <label htmlFor="assignee">Assignee</label>
                <select
                  id="assignee"
                  name="assignee"
                  value={formData.assignee_id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const userList = selectedProjectId ? projectUsers : scopedUsers;
                    const user = userList.find(u => String(u.id) === String(id));
                    setFormData(prev => ({
                      ...prev,
                      assignee_id: id || null,
                      assignee: user ? user.username : ''
                    }));
                  }}
                  className="jira-form-select"
                >
                  <option value="">Select Assignee</option>
                  {(selectedProjectId ? projectUsers : scopedUsers).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="jira-form-group flex-half">
                <label htmlFor="due_date">Due Date <span className="required">*</span></label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (selectedDate >= today) {
                      handleChange(e);
                    }
                  }}
                  className="jira-form-input"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  max={(() => {
                    const maxDate = new Date(formData.start_date);
                    maxDate.setDate(maxDate.getDate() + 365);
                    return maxDate.toISOString().split('T')[0];
                  })()}
                  onKeyDown={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            </div>

            <div className="jira-form-row-flex">
              <div className="jira-form-group flex-half">
                <label htmlFor="collaborator">Collaborator</label>
                <select
                  id="collaborator"
                  name="collaborator"
                  value={formData.collaborator_id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const userList = selectedProjectId ? projectUsers : scopedUsers;
                    const user = userList.find(u => String(u.id) === String(id));
                    setFormData(prev => ({
                      ...prev,
                      collaborator_id: id || null,
                      collaborator: user ? user.username : ''
                    }));
                  }}
                  className="jira-form-select"
                >
                  <option value="">Select Collaborator</option>
                  {(selectedProjectId ? projectUsers : scopedUsers).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="jira-form-group flex-half">
                <label htmlFor="approver">Approver</label>
                <select
                  id="approver"
                  name="approver"
                  value={formData.approver_id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const userList = selectedProjectId ? projectUsers : scopedUsers;
                    const user = userList.find(u => String(u.id) === String(id));
                    setFormData(prev => ({
                      ...prev,
                      approver_id: id || null,
                      approver: user ? user.username : ''
                    }));
                  }}
                  className="jira-form-select"
                >
                  <option value="">Select Approver</option>
                  {(selectedProjectId ? projectUsers : scopedUsers).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="jira-form-col">
            <div className="jira-form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows={8}
                value={formData.description}
                onChange={handleChange}
                className="jira-form-textarea"
                placeholder="Enter Ticket Description"
              />
            </div>
            <div className="jira-form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="jira-form-select"
                disabled={isLoadingStatuses}
              >
                {isLoadingStatuses ? (
                  <option>Loading...</option>
                ) : statusError ? (
                  <option>Error loading statuses</option>
                ) : (
                  statuses.map(status => (
                    <option key={status.name} value={status.name}>{status.name}</option>
                  ))
                )}
              </select>
            </div>
            <div className="jira-form-group flex-half">
              <label htmlFor="tag">Tag</label>
              <select
                id="tag"
                name="tag"
                value={formData.tag}
                onChange={e => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                className="jira-form-select"
                required
              >
                <option value="Tasks">Tasks</option>
                <option value="Bug">Bug</option>
                <option value="Research">Research</option>
              </select>
            </div>
          </div>
          <div className="jira-form-actions jira-form-actions-row">
            <button
              type="button"
              onClick={handleCancel}
              className="jira-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="jira-submit-btn"
            >
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (isModal) {
    return content;
  }
  return <div className="create-ticket-outer">{content}</div>;
};

export default CreateTicket;