import React, { useState, useEffect, useMemo, useRef } from 'react';
import './DashBoard.css';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaPaperclip, FaHistory, FaFile, FaDownload, FaUpload, FaEye, FaTrash, FaTimes, FaUserPlus, FaExchangeAlt, FaComment, FaCircle, FaPaperPlane, FaPlus, FaEllipsisV, FaEdit, FaLock, FaUnlock, FaSearch, FaFilter, FaList, FaExclamationCircle, FaUser, FaTag, FaFolderOpen, FaTrashAlt, FaSignOutAlt, FaBars, FaTimes as FaTimesIcon, FaTh, FaTicketAlt, FaChartBar, FaChartLine, FaClipboardList, FaTrophy, FaUserCheck, FaCheck, FaCog } from 'react-icons/fa';
import { useUser } from './contexts/UserContext';
import EditTicket from './EditTicket';
import CreateTicket from './CreateTicket';
import DashboardSidebar from './components/DashboardSidebar';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import CustomSelect from './components/CustomSelect';

// Define API URL
const API_BASE_URL = '/api';

// Define fixed statuses that cannot be modified
const FIXED_STATUSES = ['NEW', 'IN PROGRESS', 'BLOCKED', 'QA', 'COMPLETED'];
const DELETED_STATUS = 'DELETED';
const MANDATORY_STATUSES = ['new', 'in progress', 'qa', 'blocked', 'completed'];

const formatStatusDisplay = (status) => {
  if (!status) return '';
  if (status.toUpperCase() === 'QA') return 'QA';
  return status.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const AddStatusModal = ({ onClose, setCustomStatuses, setAllStatuses }) => {
  const [newStatus, setNewStatus] = useState('');
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!newStatus.trim()) {
      setError('Status name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/statuses/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus.trim().toUpperCase() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add status');
      }

      // Update the statuses list
      setCustomStatuses(prev => [...prev, data.status.name]);
      setAllStatuses(prev => [...prev, data.status.name]);
      onClose();
      setNewStatus('');
      setToastMessage('Status added successfully!');
    } catch (error) {
      console.error('Error adding status:', error);
      setError(error.message || 'Failed to add status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="jira-create-ticket-card single-card-centered" style={{ maxWidth: '500px', minHeight: 'auto', maxHeight: 'none' }}>
        <button className="close-btn" onClick={onClose} title="Close">×</button>
        <div className="jira-create-main" style={{ width: '100%' }}>
          <div className="jira-form-header">
            <div className="header-icon-box"><FaList /></div>
            <div>
              <h2>Add Bucket</h2>
              <p className="form-subtitle">Create a new bucket (status column) for the board.</p>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="jira-form-group">
              <label htmlFor="statusName">Status Name <span className="required">*</span></label>
              <input
                type="text"
                id="statusName"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                placeholder="Enter status name"
                className={`jira-form-input ${error ? 'error' : ''}`}
                required
              />
            </div>
            <div className="jira-form-actions jira-form-actions-row" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="submit" className="jira-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Status'}
              </button>
              <button type="button" className="jira-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const AddProjectModal = ({ onClose, onProjectCreated, onViewProjects, onAddLabel }) => {
  const [projectName, setProjectName] = useState('');
  const [color, setColor] = useState('#5e145e');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!projectName.trim()) {
      setError('Project name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/projects/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          project_name: projectName.trim(),
          color: color
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Log all project information after creation
      console.log('Project created successfully:', {
        project_id: data.project_id,
        project_name: data.project_name,
        color: data.color
      });

      setToastMessage('Project created successfully!');
      setToastType('success');
      setShowToast(true);

      setTimeout(() => {
        if (onProjectCreated) {
          onProjectCreated(data);
        }
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error creating project:', error);
      setError(error.message || 'Failed to create project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="jira-create-ticket-card single-card-centered" style={{ maxWidth: '500px', minHeight: 'auto', maxHeight: 'none' }}>
        <button className="close-btn" onClick={onClose} title="Close">×</button>
        <div className="jira-create-main" style={{ width: '100%' }}>
          <div className="jira-form-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="header-icon-box"><FaFolderOpen /></div>
              <div>
                <h2>Add Project</h2>
                <p className="form-subtitle">Create a new project workspace.</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '28px' }}>
              <button
                type="button"
                className="jira-cancel-btn"
                onClick={onAddLabel}
                style={{ width: 'auto', minWidth: 'auto', height: '30px', padding: '0 12px', fontSize: '11px', marginTop: 0 }}
              >
                Add Label
              </button>
              <button
                type="button"
                className="jira-cancel-btn"
                onClick={onViewProjects}
                style={{ width: 'auto', minWidth: 'auto', height: '30px', padding: '0 12px', fontSize: '11px', marginTop: 0 }}
              >
                View
              </button>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="jira-form-group">
              <label htmlFor="projectName">Project Name <span className="required">*</span></label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className={`jira-form-input ${error && !projectName ? 'error' : ''}`}
                required
              />
            </div>

            <div className="jira-form-group">
              <label htmlFor="projectColor">Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  id="projectColor"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '60px',
                    height: '36px',
                    cursor: 'pointer',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '2px',
                    background: '#fff'
                  }}
                />
                <span style={{ fontSize: '0.9rem', color: '#4b5563', fontFamily: 'monospace' }}>{color}</span>
              </div>
            </div>

            <div className="jira-form-actions jira-form-actions-row" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="submit" className="jira-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </button>
              <button type="button" className="jira-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        {showToast && (
          <div className={`toast-notification ${toastType}`}>
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};

const AddLabelModal = ({ onClose, projects, labels, onLabelsCreated }) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [labelColor, setLabelColor] = useState('#5e145e');
  const [labelsToAdd, setLabelsToAdd] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [showExistingLabels, setShowExistingLabels] = useState(false);

  const handleAddLabelItem = () => {
    setError('');
    if (!labelInput.trim()) {
      setError('Label name is required');
      return;
    }
    const trimmedLabel = labelInput.trim();
    if (labelsToAdd.some(label => label.label_name.toLowerCase() === trimmedLabel.toLowerCase())) {
      setError('This label is already queued');
      return;
    }
    setLabelsToAdd(prev => [...prev, { label_name: trimmedLabel, color: labelColor }]);
    setLabelInput('');
  };

  const handleRemoveLabelItem = (index) => {
    setLabelsToAdd(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedProject) {
      setError('Please select a project');
      return;
    }
    if (labelsToAdd.length === 0) {
      setError('Add at least one label to create');
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/labels/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          project_id: selectedProject,
          labels: labelsToAdd,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create labels');
      }

      setToastMessage('Labels created successfully!');
      setToastType('success');
      setShowToast(true);
      setLabelsToAdd([]);
      setLabelInput('');

      setTimeout(() => {
        if (onLabelsCreated) {
          onLabelsCreated();
        }
        onClose();
      }, 1400);
    } catch (submitError) {
      console.error('Error creating labels:', submitError);
      setError(submitError.message || 'Failed to create labels. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectNameLookup = projects.reduce((map, project) => {
    const name = project.project_name || project.name || project.project_name || project.name;
    return { ...map, [String(project.id)]: name };
  }, {});

  const filteredLabels = selectedProject
    ? (labels || []).filter(label => String(label.project_id) === String(selectedProject))
    : [];

  return (
    <div className="modal-overlay">
      <div className="jira-create-ticket-card single-card-centered" style={{ maxWidth: '600px', minHeight: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="close-btn" onClick={onClose} title="Close">×</button>
        <div className="jira-create-main" style={{ width: '100%' }}>
          <div className="jira-form-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="header-icon-box"><FaTag /></div>
              <div>
                <h2>Add Labels</h2>
                <p className="form-subtitle">Create and manage labels for projects.</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '28px' }}>
              <button
                type="button"
                className="jira-cancel-btn"
                onClick={() => setShowExistingLabels(prev => !prev)}
                style={{ width: 'auto', minWidth: 'auto', height: '30px', padding: '0 12px', fontSize: '11px', marginTop: 0 }}
              >
                {showExistingLabels ? 'Hide Labels' : 'View Labels'}
              </button>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="jira-form-group">
              <label htmlFor="projectSelectForLabels">Project <span className="required">*</span></label>
              <CustomSelect
                options={(projects || []).map(project => ({
                  label: project.project_name || project.name || '',
                  value: String(project.id)
                }))}
                value={selectedProject}
                onChange={(val) => setSelectedProject(val)}
                placeholder="Select a Project"
                searchable={true}
                icon={<FaFolderOpen />}
              />
            </div>

            <div className="jira-form-group">
              <label htmlFor="labelName">Label Name <span className="required">*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                <input
                  type="text"
                  id="labelName"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabelItem();
                    }
                  }}
                  placeholder="Type a label name"
                  className={`jira-form-input ${error && !labelInput ? 'error' : ''}`}
                  style={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={labelColor}
                  onChange={(e) => setLabelColor(e.target.value)}
                  style={{
                    width: '44px',
                    height: '36px',
                    cursor: 'pointer',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '2px',
                    background: '#fff',
                    flexShrink: 0
                  }}
                />
                <button
                  type="button"
                  className="jira-cancel-btn"
                  onClick={handleAddLabelItem}
                  style={{ width: 'auto', minWidth: 'auto', height: '36px', padding: '0 16px', marginTop: 0, flexShrink: 0 }}
                >
                  Add to list
                </button>
              </div>
              <p className="form-subtitle" style={{ marginTop: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                You can add multiple label names for the selected project.
              </p>
            </div>

            {labelsToAdd.length > 0 && (
              <div className="jira-form-group">
                <label>Labels to Create</label>
                <div className="label-preview-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                  {labelsToAdd.map((item, index) => (
                    <div
                      key={`${item.label_name}-${index}`}
                      className="label-preview-pill"
                      style={{
                        background: item.color || '#e2e8f0',
                        color: '#fff',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      <span>{item.label_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLabelItem(index)}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '10px',
                          padding: 0
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showExistingLabels && (
              <div className="jira-form-group" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <label>Existing Labels</label>
                {!selectedProject ? (
                  <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '12px 0' }}>
                    Select a project to view labels.
                  </div>
                ) : filteredLabels.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '12px 0' }}>
                    No labels found for this project.
                  </div>
                ) : (
                  <div className="existing-labels-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', marginTop: '6px', paddingRight: '4px' }}>
                    {filteredLabels.map((label) => (
                      <div
                        key={label.label_id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: '#f9fafb',
                          border: '1px solid #f3f4f6',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: label.color || '#cbd5e1'
                            }}
                          />
                          <span style={{ fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>{label.label_name}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {projectNameLookup[String(label.project_id)] || `Project ${label.project_id}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="jira-form-actions jira-form-actions-row" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="submit" className="jira-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Create Labels'}
              </button>
              <button type="button" className="jira-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        {showToast && (
          <div className={`toast-notification ${toastType}`}>
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};

// Add Users to Project Modal
const AddUsersToProjectModal = ({ onClose, onUserAdded }) => {
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const { currentUser } = useUser();
  const isAdmin = useMemo(() => {
    const roleFromContext = currentUser?.role;
    const roleFromStorage = localStorage.getItem('userRole');
    const role = (roleFromContext ?? roleFromStorage ?? '').toString().trim().toLowerCase();
    return role === 'admin';
  }, [currentUser?.role]);

  const allowedProjectsForManagement = useMemo(() => {
    if (isAdmin) return allProjects;
    const projectRoles = currentUser?.project_roles || {};
    return allProjects.filter(project => projectRoles[String(project.id)] === 'Superuser');
  }, [allProjects, isAdmin, currentUser?.project_roles]);
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => (
      prev.includes(String(userId))
        ? prev.filter((id) => id !== String(userId))
        : [...prev, String(userId)]
    ));
  };

  // Fetch projects and users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects
        const projectResponse = await fetch(`${API_BASE_URL}/projects`);
        if (projectResponse.ok) {
          const projects = await projectResponse.json();
          console.log('Projects fetched:', projects);
          // The endpoint returns array directly with id and name properties
          setAllProjects(Array.isArray(projects) ? projects : projects.projects || projects.data || []);
        }

        // Fetch users
        const userResponse = await fetch(`${API_BASE_URL}/users`);
        if (userResponse.ok) {
          const users = await userResponse.json();
          console.log('Users fetched:', users);
          setAllUsers(Array.isArray(users) ? users : users.users || users.data || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load projects or users');
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!selectedProject) {
      setError('Please select a project');
      setIsSubmitting(false);
      return;
    }

    if (!selectedUsers.length) {
      setError('Please select at least one user');
      setIsSubmitting(false);
      return;
    }

    try {
      const results = await Promise.all(
        selectedUsers.map(async (userId) => {
          const response = await fetch(`${API_BASE_URL}/project-users/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              project_id: selectedProject,
              user_id: userId,
              role: 'User'
            })
          });

          const data = await response.json().catch(() => ({}));
          return {
            ok: response.ok,
            userId,
            error: data.error || 'Failed to add user to project'
          };
        })
      );

      const successCount = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      if (!successCount) {
        throw new Error(failed[0]?.error || 'Failed to add users to project');
      }

      if (failed.length) {
        setToastMessage(`${successCount} user(s) added. ${failed.length} failed.`);
        setToastType('error');
      } else {
        setToastMessage(`${successCount} user(s) added to project successfully!`);
        setToastType('success');
      }
      setShowToast(true);

      setTimeout(() => {
        if (onUserAdded) {
          onUserAdded({ project_id: selectedProject, user_ids: selectedUsers });
        }
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error adding user to project:', error);
      setError(error.message || 'Failed to add user to project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="jira-create-ticket-card single-card-centered" style={{ maxWidth: '600px', minHeight: 'auto', maxHeight: 'none' }}>
        <button className="close-btn" onClick={onClose} title="Close">×</button>
        <div className="jira-create-main" style={{ width: '100%' }}>
          <div className="jira-form-header">
            <div className="header-icon-box"><FaUserPlus /></div>
            <div>
              <h2>Add Users to Project</h2>
              <p className="form-subtitle">Assign users to project workspaces.</p>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="jira-form-group">
              <label htmlFor="projectSelect">Project <span className="required">*</span></label>
              <CustomSelect
                options={allowedProjectsForManagement.map(project => ({ label: project.name, value: String(project.id) }))}
                value={selectedProject}
                onChange={(val) => setSelectedProject(val)}
                placeholder="Select a Project"
                searchable={true}
                icon={<FaFolderOpen />}
              />
            </div>

            <div className="jira-form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Users <span className="required">*</span></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="jira-cancel-btn"
                    onClick={() => setSelectedUsers(allUsers.map((user) => String(user.id)))}
                    style={{ width: 'auto', minWidth: 'auto', height: '28px', padding: '0 10px', fontSize: '11px', marginTop: 0 }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="jira-cancel-btn"
                    onClick={() => setSelectedUsers([])}
                    style={{ width: 'auto', minWidth: 'auto', height: '28px', padding: '0 10px', fontSize: '11px', marginTop: 0 }}
                  >
                    Clear
                  </button>
                </div>
              </label>
              <div
                className={`user-checkbox-list ${error && !selectedUsers.length ? 'error' : ''}`}
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  marginTop: '8px',
                  border: isDark ? '1px solid #3e3e3e' : '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: isDark ? '#1a1a1a' : '#ffffff',
                  boxShadow: isDark ? 'inset 0 1px 2px rgba(0,0,0,0.2)' : 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                {allUsers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>No users found</div>
                ) : (
                  allUsers.map((user) => {
                    const userId = String(user.id);
                    const isChecked = selectedUsers.includes(userId);
                    return (
                      <label
                        key={user.id}
                        className={`user-checkbox-item ${isChecked ? 'checked' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 16px',
                          borderBottom: isDark ? '1px solid #2e2e2e' : '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: isChecked
                            ? (isDark ? 'rgba(94, 20, 94, 0.25)' : '#f5f3ff')
                            : (isDark ? '#1a1a1a' : '#fff'),
                          gap: '12px',
                          height: '42px',
                          minHeight: '42px',
                          boxSizing: 'border-box',
                          width: '100%',
                          transition: 'none',
                          transform: 'none',
                          fontSize: '0.9rem',
                          color: isDark ? '#f0f0f0' : '#374151'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleUserSelection(userId)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#5e145e',
                            margin: 0,
                            flexShrink: 0,
                            transition: 'none',
                            transform: 'none'
                          }}
                        />
                        <span
                          className="user-checkbox-name"
                          style={{
                            fontSize: '0.9rem',
                            color: isDark ? '#f0f0f0' : '#374151',
                            userSelect: 'none',
                            marginLeft: '4px',
                            transition: 'none',
                            transform: 'none'
                          }}
                        >
                          {user.username || user.display_name || user.email}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="jira-form-actions jira-form-actions-row" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="submit" className="jira-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : `Add User${selectedUsers.length > 1 ? 's' : ''}`}
              </button>
              <button type="button" className="jira-cancel-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
        {showToast && (
          <div className={`toast-notification ${toastType}`}>
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to format text with clickable links (copy from EditTicket.jsx)
function formatTextWithLinks(text) {
  if (!text) return '';
  // Convert URLs to clickable links, opening in a new tab
  let formatted = text.replace(/(https?:\/\/[^\s<]+)/g, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" class="comment-link">${url}</a>`
  );
  return formatted;
}

const TicketCard = ({ ticket, onEdit, onDelete, projects, canMoveTickets, labels }) => {
  const handleDragStart = (e) => {
    if (!canMoveTickets) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(ticket));
  };
  const getInitials = (name) => {
    if (!name) return '';
    return name.split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = '#' + ((hash >> 24) & 0xFF).toString(16).padStart(2, '0') +
      ((hash >> 16) & 0xFF).toString(16).padStart(2, '0') +
      ((hash >> 8) & 0xFF).toString(16).padStart(2, '0');
    return color.slice(0, 7);
  };

  // Helper function to capitalize priority
  const capitalizePriority = (priority) => {
    if (!priority) return '';
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  };

  // Overdue logic
  const isOverdue = (() => {
    if (!ticket.due_date || ticket.status === 'COMPLETED' || ticket.status === 'DELETED') return false;
    // if (!ticket.due_date || ticket.status === 'DELETED') return false;
    const due = new Date(ticket.due_date);
    const now = new Date();
    return due < now;
  })();

  // Prefer project_name from ticket, fallback to lookup
  const projectName = ticket.project_name || (projects && ticket.project_id
    ? (projects.find(p => String(p.id) === String(ticket.project_id))?.name || 'No Project')
    : '');

  // Use the label name and color directly from the ticket object.
  // The 'labels' prop is no longer needed for this, but kept for potential other uses.
  const labelName = ticket.label_name;
  const labelColor = ticket.color || '#e0e7ff'; // Use ticket.color with a fallback

  return (
    <div className={`ticket-card${isOverdue ? ' overdue' : ''}`} draggable={canMoveTickets} onDragStart={handleDragStart} onClick={() => onEdit(ticket)} data-priority={ticket.priority}>
      {/* Header row with ID and Tag */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px'
      }}>
        <div className="ticket-project-id-group" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>#{ticket.ticket_id}</span>
        </div>
        {/* Tag badge */}
        {ticket.tag && (
          <div className="ticket-tag-badge" data-tag={ticket.tag} style={{ position: 'relative', top: 'auto', right: 'auto' }}>
            {ticket.tag}
          </div>
        )}
      </div>
      {/* Title at the top with proper spacing for top elements */}
      <div className="ticket-title jira-title-multiline">{ticket.title}</div>
      {/* Show creator name below title, keep all other UI unchanged */}
      <div className="jira-assignee-name">{ticket.creator_name || 'Unknown'}</div>
      {/* Group due date, created date and priority together for minimal gap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
          {ticket.created_at && (
            <span className="ticket-created-date">
              Created: {new Date(ticket.created_at).toLocaleDateString()}
            </span>
          )}
          {ticket.due_date && (
            <span className={`ticket-due-date ${isOverdue ? 'overdue' : ''}`}>
              Due: {new Date(ticket.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', width: '100%' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            backgroundColor: ticket.priority === 'High' ? '#fee2e2' : ticket.priority === 'Medium' ? '#fef3c7' : '#dcfce7',
            borderRadius: '12px'
          }}>
            <span style={{ color: ticket.priority === 'High' ? '#ef4444' : ticket.priority === 'Medium' ? '#f59e0b' : '#22c55e', fontSize: '10px' }}>●</span>
            <span style={{ fontWeight: 600, color: ticket.priority === 'High' ? '#b91c1c' : ticket.priority === 'Medium' ? '#b45309' : '#15803d', fontSize: '0.75rem' }}>{ticket.priority}</span>
          </div>
          <div className="avatar-container" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Assignee Avatar */}
            <div
              className="assignee-avatar"
              style={{ backgroundColor: stringToColor(ticket.assignee_name) }}
              title={`Assignee: ${ticket.assignee_name}`}
            >
              {getInitials(ticket.assignee_name)}
            </div>
            {/* Collaborator Avatar - show if collaborator exists */}
            {ticket.collaborator_name && (
              <div
                className="assignee-avatar"
                style={{
                  backgroundColor: stringToColor(ticket.collaborator_name),
                  fontSize: '0.7rem',
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                }}
                title={`Collaborator: ${ticket.collaborator_name}`}
              >
                {getInitials(ticket.collaborator_name)}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Project name band at the bottom */}
      {projectName && (
        <div className="ticket-project-band">
          {projectName}
        </div>
      )}
    </div>
  );
};


const StatusColumn = ({ status, tickets, onEdit, onDelete, onDrop, onDeleteStatus, projects, canMoveTickets, labels, currentUser }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    if (!canMoveTickets) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    if (!canMoveTickets) return;
    e.preventDefault();
    setIsDragOver(false);
    try {
      const ticketData = JSON.parse(e.dataTransfer.getData('application/json'));

      // Check approval workflow for completed status
      if (status && (status.toLowerCase() === 'completed' || status.toLowerCase() === 'complete')) {
        if (ticketData.approver_id && String(ticketData.approver_id) !== String(currentUser?.id)) {
          alert(`Only ${ticketData.approver_name || 'the assigned approver'} can mark this ticket as completed.`);
          return;
        }
      }

      onDrop(ticketData, status);
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const isFixedStatus = FIXED_STATUSES.includes(status);
  const isDeletedStatus = status === DELETED_STATUS;

  return (
    <Droppable droppableId={status} type="ticket" isDropDisabled={canMoveTickets ? false : true}>
      {(provided) => (
        <div
          className={`status-column ${isDragOver ? 'drag-over' : ''} ${status.toLowerCase().replace(' ', '-')}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-status={status}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          <div className="status-header" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span className="status-title">
              {formatStatusDisplay(status)}
              {/* Only show bin icon for non-mandatory statuses (case-insensitive) and admin users */}
              {MANDATORY_STATUSES.indexOf(status.trim().toLowerCase()) === -1 && canAccessRestrictedFeatures && (
                <button
                  className="delete-status-btn"
                  title="Delete this status"
                  onClick={() => onDeleteStatus(status)}
                >
                  <FaTrashAlt />
                </button>
              )}
            </span>
            <span className="status-count">{tickets.length}</span>
          </div>
          <div className="board-content">
            <div className="board-tickets">
              {tickets.map((ticket, index) => (
                <Draggable key={ticket.id} draggableId={ticket.id} index={index} isDragDisabled={canMoveTickets ? false : true}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <TicketCard
                        ticket={ticket}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        projects={projects}
                        canMoveTickets={canMoveTickets}
                        labels={labels}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          </div>
        </div>
      )}
    </Droppable>
  );
};

const ProjectListDrawer = ({ isOpen, onClose, onProjectUpdated }) => {
  const [projects, setProjects] = useState([]);
  const [editingProject, setEditingProject] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewingUsersForProject, setViewingUsersForProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [roleChanges, setRoleChanges] = useState({});
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (viewingUsersForProject) {
        handleViewUsers(viewingUsersForProject);
      } else {
        fetchProjects();
      }
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project.id);
    setEditName(project.name);
    setEditColor(project.color);
  };

  const handleSave = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: editName, color: editColor })
      });
      if (response.ok) {
        setEditingProject(null);
        fetchProjects();
        if (onProjectUpdated) onProjectUpdated();
      }
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project? This will fail if tickets are assigned to it.')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/projects/delete/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchProjects();
        if (onProjectUpdated) onProjectUpdated();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleViewUsers = async (project) => {
    setViewingUsersForProject(project);
    setIsUsersLoading(true);
    setRoleChanges({});
    try {
      const response = await fetch(`${API_BASE_URL}/project/${project.id}/users`);
      if (response.ok) {
        const data = await response.json();
        setProjectMembers(data);
        const roles = {};
        data.forEach(m => {
          roles[m.id] = m.role || 'User';
        });
        setRoleChanges(roles);
      }
    } catch (err) {
      console.error('Error fetching project users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const handleRoleToggle = (userId, newRole) => {
    setRoleChanges(prev => ({ ...prev, [userId]: newRole }));
  };

  const handleApplyRoles = async () => {
    setIsApplying(true);
    try {
      const updates = Object.entries(roleChanges).map(([userId, role]) => {
        return fetch(`${API_BASE_URL}/project-users/update-role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: viewingUsersForProject.id,
            user_id: parseInt(userId),
            role: role
          })
        });
      });

      const results = await Promise.all(updates);
      const failed = results.filter(r => !r.ok);
      if (failed.length === 0) {
        alert('Roles updated successfully');
        handleViewUsers(viewingUsersForProject);
      } else {
        alert('Failed to update some roles');
      }
    } catch (err) {
      console.error('Error applying roles:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this user from the project?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/project-users/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: viewingUsersForProject.id, user_id: userId })
      });
      if (response.ok) {
        setProjectMembers(projectMembers.filter(m => m.id !== userId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove user');
      }
    } catch (err) {
      console.error('Error removing user from project:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`project-drawer-overlay ${isOpen ? 'show' : ''}`} onClick={onClose}>
      <div className={`project-drawer ${isOpen ? 'show' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>{viewingUsersForProject ? `Users in ${viewingUsersForProject.name}` : 'All Projects'}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {viewingUsersForProject && (
              <button
                className="drawer-back-btn"
                onClick={() => setViewingUsersForProject(null)}
                title="Back to projects"
              >
                <FaExchangeAlt style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}
            <button className="drawer-close" onClick={onClose}><FaTimes /></button>
          </div>
        </div>
        <div className="drawer-content">
          {viewingUsersForProject ? (
            <div className="project-members-list">
              {isUsersLoading ? (
                <div className="loading-members">Loading members...</div>
              ) : projectMembers.length === 0 ? (
                <div className="no-projects">No users assigned to this project.</div>
              ) : (
                projectMembers.map(member => (
                  <div key={member.id} className="project-item member-item">
                    <div className="project-info">
                      <div className="user-avatar-small" style={{ backgroundColor: viewingUsersForProject.color }}>
                        {member.display_name?.charAt(0).toUpperCase() || member.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="member-details">
                        <span className="member-name">{member.display_name || member.username}</span>
                        <div className="member-role-select">
                          <label className="role-radio-label">
                            <input
                              type="radio"
                              name={`role-${member.id}`}
                              checked={roleChanges[member.id] === 'User'}
                              onChange={() => handleRoleToggle(member.id, 'User')}
                            />
                            User
                          </label>
                          <label className="role-radio-label">
                            <input
                              type="radio"
                              name={`role-${member.id}`}
                              checked={roleChanges[member.id] === 'Superuser'}
                              onChange={() => handleRoleToggle(member.id, 'Superuser')}
                            />
                            Superuser
                          </label>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveUser(member.id)}
                      className="project-delete-btn"
                      title="Remove from project"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : projects.length === 0 ? (
            <div className="no-projects">No projects found.</div>
          ) : (
            projects.map(project => (
              <div key={project.id} className="project-item">
                {editingProject === project.id ? (
                  <div className="project-edit-form">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="edit-name-input"
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      className="edit-color-input"
                    />
                    <div className="edit-actions">
                      <button onClick={() => handleSave(project.id)} className="save-icon-btn" title="Save"><FaCheck /></button>
                      <button onClick={() => setEditingProject(null)} className="cancel-icon-btn" title="Cancel"><FaTimes /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="project-info">
                      <div className="project-dot" style={{ backgroundColor: project.color }}></div>
                      <span className="project-name-text">{project.name}</span>
                    </div>
                    <div className="project-actions">
                      <button onClick={() => handleViewUsers(project)} className="project-users-btn" title="View Project Users"><FaUser /></button>
                      <button onClick={() => handleEdit(project)} className="project-edit-btn" title="Edit"><FaEdit /></button>
                      <button onClick={() => handleDelete(project.id)} className="project-delete-btn" title="Delete"><FaTrash /></button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        {viewingUsersForProject && projectMembers.length > 0 && (
          <div className="drawer-footer">
            <button
              className="apply-roles-btn"
              onClick={handleApplyRoles}
              disabled={isApplying}
            >
              {isApplying ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const DashBoard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [editingTicket, setEditingTicket] = useState(location.state?.returnToTicket || null);
  const { username } = useParams();
  const { currentUser, forceRefreshUser } = useUser();
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || localStorage.getItem('dashboardSearchTerm') || '';
  });
  const [searchInputVal, setSearchInputVal] = useState(searchTerm);

  useEffect(() => {
    setSearchInputVal(searchTerm);
  }, [searchTerm]);

  const [filters, setFilters] = useState({
    priority: '',
    assignee: '',
    label_name: '',
    project_id: 'all',
    tag: '', // Added tag filter
    requestor: '', // Added requestor filter
    approver: '' // Added approver filter
  });
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    urgent: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [showProjectDrawer, setShowProjectDrawer] = useState(false);
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [customStatuses, setCustomStatuses] = useState([]);
  const [allStatuses, setAllStatuses] = useState([...FIXED_STATUSES]);
  const [showDeletedTickets, setShowDeletedTickets] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [creators, setCreators] = useState([]); // Add creators state for requestor filter
  const [approvers, setApprovers] = useState([]); // Add approvers state for approver filter
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [projects, setProjects] = useState([]);
  const [projectUsers, setProjectUsers] = useState([]); // Users for selected project
  const [usernameFromSession, setUsernameFromSession] = useState('');
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [labels, setLabels] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only execute this keyboard shortcut when on the dashboard route
      if (!location.pathname.startsWith('/dashboard')) return;

      // Handle Escape key to close any active modal
      if (e.key === 'Escape') {
        let modalClosed = false;
        if (isModalOpen) {
          setIsModalOpen(false);
          setSelectedTicket(null);
          modalClosed = true;
        }
        if (editingTicket) {
          setEditingTicket(null);
          modalClosed = true;
        }
        if (showCreateTicketModal) {
          setShowCreateTicketModal(false);
          modalClosed = true;
        }
        if (showAddStatusModal) {
          setShowAddStatusModal(false);
          modalClosed = true;
        }
        if (showAddProjectModal) {
          setShowAddProjectModal(false);
          modalClosed = true;
        }
        if (showAddLabelModal) {
          setShowAddLabelModal(false);
          modalClosed = true;
        }
        if (showAddUsersModal) {
          setShowAddUsersModal(false);
          modalClosed = true;
        }

        if (modalClosed) {
          e.preventDefault();
        }
        return;
      }

      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.classList.contains('custom-select-trigger'));

      if (isTyping) return;

      if (
        isModalOpen ||
        showCreateTicketModal ||
        showAddStatusModal ||
        showAddProjectModal ||
        showAddLabelModal ||
        showAddUsersModal ||
        editingTicket
      ) {
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowCreateTicketModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    location.pathname,
    isModalOpen,
    showCreateTicketModal,
    showAddStatusModal,
    showAddProjectModal,
    showAddLabelModal,
    showAddUsersModal,
    editingTicket
  ]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (currentUser && currentUser.username) {
      return currentUser.username.split(' ').map(name => name[0]).join('').toUpperCase().substring(0, 2);
    }
    // Fallback to localStorage if context doesn't have data
    const username = localStorage.getItem('username');
    if (username) {
      return username.split(' ').map(name => name[0]).join('').toUpperCase().substring(0, 2);
    }
    return 'PA';
  };

  const handleHeaderLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('jwt_token');
    window.location.href = 'https://www.ariths.com/tools';
  };

  // Get display name (first name only)
  const getDisplayName = () => {
    if (currentUser && currentUser.username) {
      return currentUser.username.split(' ')[0]; // Return only first name
    }
    // Fallback to localStorage if context doesn't have data
    const username = localStorage.getItem('username');
    if (username) {
      return username.split(' ')[0]; // Return only first name
    }
    return 'User';
  };

  // Allowed session IDs for restricted features
  const ALLOWED_SESSION_IDS = useMemo(() => ['1', '2', '3', '7', '8'], []);

  const canAccessRestrictedFeatures = true;

  const isAdmin = useMemo(() => {
    const roleFromContext = currentUser?.role;
    const roleFromStorage = localStorage.getItem('userRole');
    const role = (roleFromContext ?? roleFromStorage ?? '').toString().trim().toLowerCase();
    return role === 'admin';
  }, [currentUser?.role]);

  const isSuperuser = useMemo(() => {
    if (isAdmin) return true;

    const projectRoles = currentUser?.project_roles || {};
    const selectedProjectId = filters.project_id;

    if (selectedProjectId === 'all') {
      // In "All Projects" view, you're a Superuser if you have the role in ANY project
      return Object.values(projectRoles).some(role => role === 'Superuser');
    } else {
      // In specific project view, check your role for that project
      return projectRoles[selectedProjectId] === 'Superuser';
    }
  }, [currentUser?.project_roles, isAdmin, filters.project_id]);

  const assignedProjectIds = useMemo(() => {
    const ids = currentUser?.assigned_projects || [];
    // Ensure all IDs are strings and trimmed to prevent any matching issues
    return Array.isArray(ids) ? ids.map(id => String(id).trim()) : [];
  }, [currentUser?.assigned_projects]);

  const visibleProjects = useMemo(() => {
    if (isAdmin) return projects;
    return projects.filter(p => assignedProjectIds.includes(String(p.id)));
  }, [isAdmin, projects, assignedProjectIds]);




  // Load tickets and statuses when component mounts
  useEffect(() => {
    loadTickets();
    loadStatuses();
    loadAssignees();
    loadCreators(); // Add loadCreators
    loadApprovers(); // Add loadApprovers
    fetchStats();
    loadProjects();
    loadLabels();

    // Force refresh user data to ensure role is loaded
    if (currentUser && !currentUser.role) {
      forceRefreshUser();
    }
  }, []);

  // Force refresh user data on mount to ensure role is loaded
  useEffect(() => {
    let shouldNavigate = false;
    let navOptions = { replace: true };
    let targetUrl = location.pathname + location.search;

    if (location.state?.returnToTicket) {
      // Clear the state so it doesn't reopen on refresh
      const newState = { ...location.state };
      delete newState.returnToTicket;
      navOptions.state = newState;
      shouldNavigate = true;
    }

    const params = new URLSearchParams(location.search);
    if (!params.toString() && localStorage.getItem('dashboardFilters')) {
      const storedFilters = JSON.parse(localStorage.getItem('dashboardFilters'));
      const storedSearch = localStorage.getItem('dashboardSearchTerm') || '';
      const urlParams = new URLSearchParams({ ...storedFilters, search: storedSearch }).toString();
      targetUrl = `/dashboard?${urlParams}`;
      shouldNavigate = true;
    }

    if (shouldNavigate) {
      navigate(targetUrl, navOptions);
    }

    const userId = localStorage.getItem('userId');
    if (userId && (!currentUser || !currentUser.role)) {
      forceRefreshUser();
    }
  }, [currentUser, forceRefreshUser, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const priority = params.get('priority') || '';
    let assignee = params.get('assignee') || '';
    const label_name = params.get('label_name') || '';
    const project_id = params.get('project_id') || 'all';
    const tag = params.get('tag') || ''; // Get tag from URL params
    const requestor = params.get('requestor') || ''; // Get requestor from URL params
    const approver = params.get('approver') || ''; // Get approver from URL params
    const searchParam = params.get('search') || '';

    // Clear assignee filter if it's not a valid ID (contains non-numeric characters)
    if (assignee && !/^\d+$/.test(assignee)) {
      console.log('⚠️ Invalid assignee ID in URL, clearing filter:', assignee);
      assignee = '';
    }

    console.log('🔗 URL params loaded:', { priority, assignee, label_name, project_id, tag, requestor, approver, search: searchParam });

    setFilters({ priority, assignee, label_name, project_id, tag, requestor, approver });

    setSearchTerm(prev => {
      if (prev.toLowerCase() !== searchParam.toLowerCase()) {
        return searchParam;
      }
      return prev;
    });
  }, [location.search]);

  useEffect(() => {
    localStorage.setItem('dashboardFilters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('dashboardSearchTerm', searchTerm);
  }, [searchTerm]);

  // Sync URL search parameter with searchTerm
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentSearch = params.get('search') || '';
    if (currentSearch.toLowerCase() !== searchTerm.toLowerCase()) {
      if (searchTerm) {
        params.set('search', searchTerm);
      } else {
        params.delete('search');
      }
      navigate(`/dashboard?${params.toString()}`, { replace: true });
    }
  }, [searchTerm, navigate]);

  // Load tickets automatically whenever filters or search term changes
  useEffect(() => {
    loadTickets();
  }, [filters, searchTerm]);

  // Fetch project users when project filter changes
  useEffect(() => {
    const fetchProjectUsers = async () => {
      if (filters.project_id && filters.project_id !== 'all') {
        try {
          const response = await fetch(`${API_BASE_URL}/project/${filters.project_id}/users`);
          if (response.ok) {
            const users = await response.json();
            setProjectUsers(Array.isArray(users) ? users : []);
          } else {
            setProjectUsers([]);
          }
        } catch (error) {
          console.error('Error fetching project users:', error);
          setProjectUsers([]);
        }
      } else {
        setProjectUsers([]);
      }
    };
    fetchProjectUsers();
  }, [filters.project_id]);
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Dashboard focused, refreshing tickets...');
      loadTickets();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadTickets = async () => {
    try {
      setIsLoading(true);

      // Build query params from filters
      const params = new URLSearchParams();
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.assignee) {
        console.log('🔍 Filtering by assignee ID:', filters.assignee);
        params.append('assignee_id', filters.assignee);
      }
      if (filters.label_name) params.append('label_name', filters.label_name);
      if (filters.project_id !== 'all') params.append('project_id', filters.project_id);
      if (filters.tag) params.append('tag', filters.tag); // Append tag to params
      if (filters.requestor) params.append('requestor_id', filters.requestor); // Append requestor to params
      if (filters.approver) {
        // Send approver_name to match with the backend filtering
        params.append('approver_name', filters.approver);
      }
      if (searchTerm) params.append('search', searchTerm);

      console.log('📤 Fetching tickets with params:', params.toString());

      const response = await fetch(`${API_BASE_URL}/tickets?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to fetch tickets:', response.status, errorData);
        throw new Error(`Failed to fetch tickets: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('📥 Received tickets data:', data);
      console.log('🔍 Sample ticket with collaborator:', data.find(t => t.collaborator_name));

      const transformedTickets = data.map(ticket => ({
        id: ticket.ticket_id,
        ticket_id: ticket.ticket_id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        assignee_id: ticket.assignee_id,
        assignee_name: ticket.assignee_name,
        collaborator_id: ticket.collaborator_id, // Add collaborator_id
        collaborator_name: ticket.collaborator_name, // Add collaborator_name
        creator_id: ticket.creator_id,
        creator_name: ticket.creator_name,
        approver_id: ticket.approver_id, // Add approver_id
        approver_name: ticket.approver_name, // Add approver_name
        due_date: ticket.due_date,
        created_at: ticket.created_at,
        deleted_at: ticket.deleted_at,
        tag: ticket.tag || 'No tag',
        project_id: ticket.project_id,
        project_name: ticket.project_name,
        label_id: ticket.label_id,
        label_name: ticket.label_name,
        color: ticket.color
      }));

      setTickets(transformedTickets);
      console.log('🔄 Transformed tickets with collaborators:', transformedTickets.filter(t => t.collaborator_name));
      setError(null);
      // Update creators list after loading tickets
      loadCreators();
    } catch (error) {
      console.error('Error loading tickets:', error);
      setError('Failed to load tickets. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/status`);
      const data = await response.json();

      // Map backend status_name to name for consistency and ensure uppercase
      const mappedStatuses = data.map(status => ({
        ...status,
        name: (status.name || status.status_name).toUpperCase() // ensure uppercase
      }));

      // Get deleted statuses from localStorage (persisted)
      const deletedStatuses = JSON.parse(localStorage.getItem('deletedStatuses') || '[]');

      // Filter out fixed statuses, deleted status, and any status in deletedStatuses
      const filteredStatuses = mappedStatuses
        .filter(status =>
          !FIXED_STATUSES.includes(status.name) &&
          status.name !== DELETED_STATUS &&
          status.name !== 'QA' &&
          status.name !== 'UAT' &&
          !deletedStatuses.includes(status.name)
        );

      setCustomStatuses(filteredStatuses.map(status => status.name));
      setAllStatuses([
        ...FIXED_STATUSES,
        ...filteredStatuses.map(status => status.name)
      ]);
    } catch (error) {
      console.error('Error loading statuses:', error);
      // Fallback to just fixed statuses if API fails
      setCustomStatuses([]);
      setAllStatuses([...FIXED_STATUSES]);
    }
  };

  const loadAssignees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      const data = await response.json();
      let users = Array.isArray(data) ? data : data.users || data.data || [];

      // Store users with all necessary fields for filtering
      const enrichedUsers = users.map(user => ({
        id: String(user.id),
        username: user.username,
        name: user.name || user.username || user.email || "Unknown User",
        project_ids: Array.isArray(user.project_ids) ? user.project_ids.map(pid => String(pid)) : []
      })).filter(user => user.name !== "Unknown User");

      enrichedUsers.sort((a, b) => a.name.localeCompare(b.name));

      setAssignees(enrichedUsers);
      setCreators(enrichedUsers); // Requestors and Assignees are the same set of users
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadApprovers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/approvers`);
      if (response.ok) {
        const data = await response.json();
        const approversWithProjects = data.map(user => ({
          id: String(user.id),
          username: user.username,
          name: user.name || user.username,
          project_ids: Array.isArray(user.project_ids) ? user.project_ids.map(pid => String(pid)) : []
        }));
        setApprovers(approversWithProjects);
      }
    } catch (error) {
      console.error('Error loading approvers:', error);
    }
  };

  const loadCreators = async () => {
    // Already handled in loadAssignees for efficiency, 
    // but keep as a stub if needed elsewhere
  };



  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/ticket-stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    const params = new URLSearchParams({ ...newFilters, search: searchTerm }).toString();
    navigate(`/dashboard?${params}`);
  };

  const handleClearFilters = () => {
    const defaultFilters = {
      priority: '',
      assignee: '',
      label_name: '',
      project_id: 'all',
      tag: '',
      requestor: '',
      approver: ''
    };
    setFilters(defaultFilters);
    setSearchTerm('');
    setSearchInputVal('');
    localStorage.removeItem('dashboardFilters');
    localStorage.removeItem('dashboardSearchTerm');
    navigate('/dashboard', { replace: true });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.priority !== '' ||
      filters.assignee !== '' ||
      filters.label_name !== '' ||
      filters.project_id !== 'all' ||
      filters.tag !== '' ||
      filters.requestor !== '' ||
      filters.approver !== '' ||
      searchTerm !== ''
    );
  }, [filters, searchTerm]);


  // If user already selected an assignee but switches project, clear assignee
  // when that assignee is not part of the chosen project's team.
  useEffect(() => {
    const isProjectScoped = filters.project_id && filters.project_id !== 'all';
    if (!isProjectScoped) return;
    if (!filters.assignee) return;
    if (!projectUsers || projectUsers.length === 0) return;

    const assigneeStillValid = projectUsers.some(
      (u) => String(u.id) === String(filters.assignee)
    );

    if (!assigneeStillValid) {
      handleFilterChange({ ...filters, assignee: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.project_id, projectUsers, filters.assignee]);

  const handleSearch = (e) => {
    setSearchInputVal(e.target.value);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setSearchTerm(searchInputVal.trim().toLowerCase());
    }
  };

  const filterTickets = useMemo(() => {
    const filtered = tickets.filter(ticket => {
      // If showing deleted tickets, only show those with Deleted status
      if (showDeletedTickets) {
        return ticket.status === DELETED_STATUS;
      }

      // Skip deleted tickets in normal view
      if (ticket.status === DELETED_STATUS) {
        return false;
      }

      // Search term filter
      const matchesSearch = searchTerm === '' ||
        (ticket.title && ticket.title.toLowerCase().includes(searchTerm)) ||
        (ticket.description && ticket.description.toLowerCase().includes(searchTerm)) ||
        (ticket.assignee_name && ticket.assignee_name.toLowerCase().includes(searchTerm)) ||
        (ticket.collaborator_name && ticket.collaborator_name.toLowerCase().includes(searchTerm)) ||
        (ticket.ticket_id && ticket.ticket_id.toString().toLowerCase().includes(searchTerm));

      // Priority filter
      const matchesPriority = !filters.priority || ticket.priority === filters.priority;

      // Assignee filter - include both assignee and collaborator matches
      const matchesAssignee = !filters.assignee ||
        (ticket.assignee_id && ticket.assignee_id.toString() === filters.assignee.toString()) ||
        (ticket.collaborator_id && ticket.collaborator_id.toString() === filters.assignee.toString());

      // Tag filter
      const matchesTag = !filters.label_name || ticket.label_name === filters.label_name;

      // Project filter
      let matchesProject = false;

      if (isAdmin) {
        // Admins see everything when "all" is selected, or the specific project
        matchesProject = filters.project_id === 'all' || String(ticket.project_id) === String(filters.project_id);
      } else if (assignedProjectIds.length === 0) {
        // No project assignments configured (project_users table empty) —
        // treat as "no restrictions" so the user can see all tickets.
        matchesProject = filters.project_id === 'all' || String(ticket.project_id) === String(filters.project_id);
      } else {
        // Regular users with project assignments
        if (filters.project_id === 'all') {
          // Robust comparison: convert ticket project ID to trimmed string
          const ticketProjectIdStr = String(ticket.project_id).trim();
          matchesProject = assignedProjectIds.includes(ticketProjectIdStr);

          // Fallback: If the ticket has NO project assigned, allow it if the user is the creator or assignee
          if (!matchesProject && (ticket.project_id === null || ticket.project_id === 0)) {
            const currentUserIdStr = String(currentUser?.id);
            if (String(ticket.creator_id) === currentUserIdStr || String(ticket.assignee_id) === currentUserIdStr) {
              matchesProject = true;
            }
          }
        } else {
          // Show only the specific project if they are assigned to it
          matchesProject = String(ticket.project_id) === String(filters.project_id) &&
            assignedProjectIds.includes(String(filters.project_id));
        }
      }

      // Tag filter
      const matchesTicketTag = !filters.tag || ticket.tag === filters.tag;

      // Requestor filter
      const matchesRequestor = !filters.requestor || ticket.creator_name === filters.requestor;

      // Approver filter - handle both approver_id and approver_name
      const matchesApprover = !filters.approver ||
        (ticket.approver_name && ticket.approver_name === filters.approver) ||
        (ticket.approver_id && ticket.approver_id.toString() === filters.approver) ||
        (ticket.approver_name && ticket.approver_name.toLowerCase() === filters.approver.toLowerCase());

      return matchesSearch && matchesPriority && matchesAssignee && matchesTag && matchesProject && matchesTicketTag && matchesRequestor && matchesApprover;
    });

    return filtered;
  }, [tickets, searchTerm, filters, showDeletedTickets, isAdmin, assignedProjectIds, currentUser?.id]);

  const ticketsByStatus = useMemo(() => {
    const groupedTickets = {};
    // Initialize all statuses with empty arrays
    allStatuses.forEach(status => {
      groupedTickets[status] = [];
    });
    // Group tickets by their status
    filterTickets.forEach(ticket => {
      if (groupedTickets[ticket.status]) {
        groupedTickets[ticket.status].push(ticket);
      }
    });
    // Sort each status bucket by ticket_id descending (latest/highest on top)
    Object.keys(groupedTickets).forEach(status => {
      groupedTickets[status].sort((a, b) => Number(b.ticket_id) - Number(a.ticket_id));
    });
    return groupedTickets;
  }, [filterTickets, allStatuses]);

  const handleEditTicket = (ticket) => {
    if (!ticket || !ticket.id) {
      console.error('Ticket ID is missing');
      return;
    }

    setIsModalOpen(false);
    setEditingTicket(ticket);
  };

  const handleDeleteTicket = async (ticketId) => {
    try {
      // First update the ticket status to DELETED
      const updateResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          status: 'DELETED'
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to update ticket status');
      }

      // Then perform the soft delete
      const deleteResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || 'Failed to delete ticket');
      }

      // Update the tickets state to reflect the deletion
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === ticketId
            ? { ...ticket, status: 'DELETED', deleted_at: new Date().toISOString() }
            : ticket
        )
      );

      setToastMessage('Ticket moved to deleted tickets!');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      setIsModalOpen(false);

      // Reload tickets to ensure we have the latest data
      await loadTickets();
      navigate('/dashboard' + location.search);
    } catch (error) {
      console.error('Error deleting ticket:', error);

      setToastMessage(error.message || 'Failed to delete ticket. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleDrop = async (ticketData, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketData.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          user_id: currentUser?.id || localStorage.getItem('userId'),
          username: currentUser?.username || localStorage.getItem('username')
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update ticket status');
      }

      const updatedTicket = await response.json();

      // Update the tickets state with the new status
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === ticketData.id
            ? { ...ticket, status: newStatus }
            : ticket
        )
      );

      setToastMessage('Ticket status updated successfully!');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (error) {
      console.error('Error updating ticket status:', error);

      // Revert the ticket to its original status in the UI
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === ticketData.id
            ? { ...ticket, status: ticketData.status }
            : ticket
        )
      );

      setToastMessage(error.message || 'Failed to update ticket status. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleDeleteStatus = async (statusToDelete) => {
    try {
      // Call backend to delete the status (which also moves tickets to DELETED and removes the status from DB)
      await fetch(`/api/statuses/${encodeURIComponent(statusToDelete)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      // Remove the status from the list and ensure it is not re-added after refresh
      setAllStatuses(prev => prev.filter(s => s !== statusToDelete));
      setCustomStatuses(prev => prev.filter(s => s !== statusToDelete));
      // Persist the deleted statuses in localStorage (avoid duplicates)
      const deletedStatuses = JSON.parse(localStorage.getItem('deletedStatuses') || '[]');
      if (!deletedStatuses.includes(statusToDelete)) {
        localStorage.setItem('deletedStatuses', JSON.stringify([...deletedStatuses, statusToDelete]));
      }
      setTickets(prev => prev.map(t =>
        t.status === statusToDelete ? { ...t, status: 'Deleted' } : t
      ));
      // Reload statuses from backend to ensure deleted status never comes back
      await loadStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
    }
  };

  const handleAddStatus = async (newStatus) => {
    if (!newStatus.trim()) {
      setToastMessage('Please enter a status name');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    try {
      // Remove the status from deletedStatuses if it exists (in case user re-adds a previously deleted status)
      const deletedStatuses = JSON.parse(localStorage.getItem('deletedStatuses') || '[]');
      const cleanedDeletedStatuses = deletedStatuses.filter(s => s !== newStatus.trim().toUpperCase());
      localStorage.setItem('deletedStatuses', JSON.stringify(cleanedDeletedStatuses));

      const response = await fetch(`${API_BASE_URL}/statuses/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add status');
      }

      const data = await response.json();
      await loadStatuses();
      setShowAddStatusModal(false);
      setNewStatus('');
      setToastMessage('Status added successfully!');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error adding status:', error);
      setToastMessage(error.message || 'Failed to add status. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const renderAssigneeDropdown = () => {
    const isProjectScoped = filters.project_id && filters.project_id !== 'all';
    let scopedAssignees = [];

    if (isAdmin && !isProjectScoped) {
      scopedAssignees = assignees;
    } else {
      // Filter by the specific project or all assigned projects
      scopedAssignees = assignees.filter(a => {
        if (!a.project_ids || a.project_ids.length === 0) return false;
        if (isProjectScoped) {
          return a.project_ids.includes(String(filters.project_id));
        } else {
          return a.project_ids.some(pid => assignedProjectIds.includes(String(pid)));
        }
      });

      // Fallback: if list is empty but tickets exist, show users present in those tickets
      if (scopedAssignees.length === 0 && tickets.length > 0) {
        const ticketUserIds = new Set(tickets.map(t => String(t.assignee_id)));
        scopedAssignees = assignees.filter(a => ticketUserIds.has(String(a.id)));
      }
    }

    const assigneeOptions = [
      { value: '', label: 'All Assignees', triggerLabel: 'Assignees', className: 'is-default' },
      ...scopedAssignees.map(assignee => ({ value: String(assignee.id), label: assignee.name }))
    ];

    return (
      <CustomSelect
        options={assigneeOptions}
        value={filters.assignee}
        onChange={(val) => handleFilterChange({ ...filters, assignee: val })}
        placeholder="Assignees"
        icon={<FaUser />}
        searchable={true}
      />
    );
  };

  const restoreTicket = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/restore`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'NEW' })
      });
      if (!response.ok) {
        throw new Error('Failed to restore ticket');
      }
      await loadTickets();
      setShowDeletedTickets(false);
      navigate('/dashboard' + location.search);
    } catch (error) {
      console.error('Error restoring ticket:', error);
      alert('Failed to restore ticket. Please try again.');
    }
  };

  const deleteTicketPermanently = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/permanently_delete_ticket/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert('Backend error: ' + (errorData.error || 'Unknown error'));
        throw new Error(errorData.error || 'Failed to delete ticket permanently');
      }
      await loadTickets();
      navigate('/dashboard' + location.search);
    } catch (error) {
      console.error('Error deleting ticket permanently:', error);
      alert(error.message || 'Failed to delete ticket permanently. Please try again.');
    }
  };

  const handleTicketCreated = (newTicket) => {
    console.log('🎉 handleTicketCreated received:', newTicket);
    try {
      if (!newTicket) {
        console.warn('handleTicketCreated received null/undefined ticket');
        loadTickets();
        return;
      }

      // Support both {ticket: {...}} and {...} formats
      const ticketObj = newTicket.ticket || newTicket;

      if (!ticketObj || !ticketObj.ticket_id) {
        console.warn('handleTicketCreated: Malformed ticket object, refreshing list instead');
        loadTickets();
        return;
      }

      const transformedTicket = {
        id: ticketObj.ticket_id,
        ticket_id: ticketObj.ticket_id,
        title: ticketObj.title || 'Untitled Ticket',
        description: ticketObj.description || '',
        status: ticketObj.status || 'NEW',
        priority: ticketObj.priority || 'Medium',
        assignee_id: ticketObj.assignee_id,
        assignee_name: ticketObj.assignee_name,
        creator_id: ticketObj.creator_id,
        creator_name: ticketObj.creator_name,
        approver_id: ticketObj.approver_id,
        approver_name: ticketObj.approver_name,
        due_date: ticketObj.due_date,
        created_at: ticketObj.created_at || new Date().toISOString(),
        tag: ticketObj.tag || 'Tasks',
        project_id: ticketObj.project_id,
        project_name: ticketObj.project_name,
        label_id: ticketObj.label_id,
        label_name: ticketObj.label_name,
        color: ticketObj.color
      };

      console.log('✅ Transformed ticket for local state update:', transformedTicket);

      // Rely on server refresh to ensure full consistency and prevent missing data crashes
      // setTickets(prev => [transformedTicket, ...prev]);

      // Also refresh from server to ensure full consistency
      loadTickets();

      // Show toast
      if (typeof showToastMessage === 'function') {
        showToastMessage('Ticket created successfully!', 'success');
      }
    } catch (err) {
      console.error('❌ Error in handleTicketCreated:', err);
      loadTickets(); // Fallback to full refresh
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadLabels = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/labels`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch labels: ${response.status}`);
      }
      const data = await response.json();
      setLabels(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading labels:', error);
      setLabels([]);
    }
  };

  // Workflow validation function (same as in EditTicket.jsx)
  const validateWorkflowTransition = (currentStatus, newStatus) => {
    const statusFlow = {
      'NEW': ['IN PROGRESS'],
      'IN PROGRESS': ['BLOCKED', 'QA', 'COMPLETED'],
      'BLOCKED': ['IN PROGRESS'],
      'QA': ['IN PROGRESS', 'COMPLETED']
    };

    const currentStatusUpper = currentStatus?.toUpperCase();
    const newStatusUpper = newStatus?.toUpperCase();

    // If no status change, allow it
    if (currentStatusUpper === newStatusUpper) {
      return { valid: true };
    }

    // Check if the transition is allowed
    const allowedTransitions = statusFlow[currentStatusUpper];
    if (!allowedTransitions) {
      return { valid: false, message: `Invalid current status: ${currentStatus}` };
    }

    if (!allowedTransitions.includes(newStatusUpper)) {
      const allowedStatuses = allowedTransitions.join(', ');
      return {
        valid: false,
        message: `Invalid status transition. From "${currentStatus}" you can only move to: ${allowedStatuses}`
      };
    }

    return { valid: true };
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (destination) {
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      // Find the ticket
      const ticketId = draggableId.replace('ticket-', '');
      const newStatus = destination.droppableId;
      const ticket = tickets.find(t => t.id === Number(ticketId));

      if (!ticket) {
        console.error('Ticket not found:', ticketId);
        return;
      }

      // Check move permissions: only associated users or superusers/admins can move the ticket
      const isUserProjectSuperuser = currentUser?.project_roles?.[String(ticket.project_id)] === 'Superuser';
      const isAssociated =
        (ticket.assignee_id && String(ticket.assignee_id) === String(currentUser?.id)) ||
        (ticket.creator_id && String(ticket.creator_id) === String(currentUser?.id)) ||
        (ticket.approver_id && String(ticket.approver_id) === String(currentUser?.id)) ||
        (ticket.collaborator_id && String(ticket.collaborator_id) === String(currentUser?.id));

      if (!isAdmin && !isUserProjectSuperuser && !isAssociated) {
        alert('You do not have permission to move this ticket. Only associated users can move it.');
        return;
      }

      // Validate workflow transition (allow QA -> COMPLETED)
      const workflowValidation = validateWorkflowTransition(ticket.status, newStatus);
      if (!workflowValidation.valid) {
        alert(workflowValidation.message);
        return;
      }

      // Check approval workflow for completed status
      if (newStatus && (newStatus.toLowerCase() === 'completed' || newStatus.toLowerCase() === 'complete')) {
        // If there is an approver, only that approver can move to completed
        if (ticket.approver_id && String(ticket.approver_id) !== String(currentUser?.id)) {
          alert(`Only ${ticket.approver_name || 'the assigned approver'} can mark this ticket as completed.`);
          return;
        }
      }

      // Update ticket status in backend
      try {
        const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            status: newStatus,
            user_id: currentUser?.id || localStorage.getItem('userId'),
            username: currentUser?.username || localStorage.getItem('username')
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          alert(errorData.error || 'Failed to update ticket status');
          return;
        }

        // Update tickets in frontend
        setTickets(prev => prev.map(t => t.id === Number(ticketId) ? { ...t, status: newStatus } : t));
      } catch (error) {
        console.error('Error updating ticket status:', error);
        alert('Failed to update ticket status. Please try again.');
      }
    } else {
      // Column drag
      if (source.droppableId !== destination.droppableId) {
        const items = Array.from(allStatuses);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        setAllStatuses(items);
        try {
          await fetch(`${API_BASE_URL}/statuses/reorder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ statusOrders: items }),
          });
        } catch (error) { }
      }
    }
  };

  const renderStatusColumns = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="status-columns" direction="horizontal" type="COLUMN">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="status-columns-container"
          >
            {allStatuses.map((status, colIndex) => (
              <Draggable key={status} draggableId={status} index={colIndex}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <Droppable droppableId={status} type="TICKET">
                      {(ticketDropProvided) => (
                        <div
                          ref={ticketDropProvided.innerRef}
                          {...ticketDropProvided.droppableProps}
                          className="status-column"
                        >
                          <div className="status-header" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <span className="status-title">
                              {formatStatusDisplay(status)}
                              {/* Only show bin icon for non-mandatory statuses (case-insensitive) and admin users */}
                              {MANDATORY_STATUSES.indexOf(status.trim().toLowerCase()) === -1 && canAccessRestrictedFeatures && (
                                <button
                                  className="delete-status-btn"
                                  title="Delete this status"
                                  onClick={() => handleDeleteStatus(status)}
                                >
                                  <FaTrashAlt />
                                </button>
                              )}
                            </span>
                            <span className="status-count">{ticketsByStatus[status]?.length || 0}</span>
                          </div>
                          <div className="board-tickets">
                            {(ticketsByStatus[status] || []).map((ticket, ticketIdx) => {
                              const isUserProjectSuperuser = currentUser?.project_roles?.[String(ticket.project_id)] === 'Superuser';
                              const isAssociated =
                                (ticket.assignee_id && String(ticket.assignee_id) === String(currentUser?.id)) ||
                                (ticket.creator_id && String(ticket.creator_id) === String(currentUser?.id)) ||
                                (ticket.approver_id && String(ticket.approver_id) === String(currentUser?.id)) ||
                                (ticket.collaborator_id && String(ticket.collaborator_id) === String(currentUser?.id));
                              const userCanMove = isAdmin || isUserProjectSuperuser || isAssociated;
                              return (
                                <Draggable key={ticket.id} draggableId={`ticket-${ticket.id}`} index={ticketIdx} isDragDisabled={userCanMove ? false : true}>
                                  {(ticketProvided) => (
                                    <div
                                      ref={ticketProvided.innerRef}
                                      {...ticketProvided.draggableProps}
                                      {...ticketProvided.dragHandleProps}
                                    >
                                      <TicketCard
                                        ticket={ticket}
                                        onEdit={handleEditTicket}
                                        onDelete={handleDeleteTicket}
                                        projects={projects}
                                        canMoveTickets={userCanMove}
                                        labels={labels}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              )
                            })}
                            {ticketDropProvided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  const handleAddUser = () => {
    // TODO: Implement add user functionality (e.g., open modal or navigate)
    alert('Add User clicked!');
  };

  const uniqueLabelNames = useMemo(() => {
    if (!labels) return [];

    // If a specific project is selected, filter labels by that project_id
    const isProjectScoped = filters.project_id && filters.project_id !== 'all';
    const filteredLabels = isProjectScoped
      ? labels.filter(l => String(l.project_id) === String(filters.project_id))
      : (isAdmin ? labels : labels.filter(l => assignedProjectIds.includes(String(l.project_id))));

    return Array.from(new Set(filteredLabels.map(l => l.label_name).filter(Boolean)));
  }, [labels, filters.project_id, assignedProjectIds, isAdmin]);

  const adminOptions = useMemo(() => {
    const opts = [];
    if (isAdmin) {
      opts.push({ value: 'add_bucket', label: 'Add Bucket' });
      opts.push({ value: 'add_project', label: 'Add Project' });
    }
    if (isAdmin || isSuperuser) {
      opts.push({ value: 'add_users', label: 'Add Users' });
    }
    if (isAdmin) {
      opts.push({
        value: 'deleted_tickets',
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', fontStyle: 'normal' }}>
            {showDeletedTickets && <FaCheck style={{ fontSize: '0.85em', color: '#5e145e', flexShrink: 0 }} />}
            {showDeletedTickets ? 'Hide Deleted' : 'Deleted Tickets'}
          </span>
        )
      });
    }
    return opts;
  }, [isAdmin, isSuperuser, showDeletedTickets]);

  const handleAdminActionChange = (action) => {
    if (action === 'add_bucket') {
      setShowAddStatusModal(true);
    } else if (action === 'add_project') {
      setShowAddProjectModal(true);
    } else if (action === 'add_users') {
      setShowAddUsersModal(true);
    } else if (action === 'deleted_tickets') {
      setShowDeletedTickets(!showDeletedTickets);
    }
  };

  return (
    <div className="dashboard-container">
      <DashboardSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div className="dashboard-layout">
        <main className="dashboard-main">
          {/* Mobile header with sidebar toggle */}
          <div className="mobile-header">
            <button
              className="mobile-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FaBars />
            </button>
          </div>

          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
            </div>
          )}

          {error && (
            <></>
          )}

          <div className="dashboard-content">
            <div className="fixed-section">
              <div className="main-header">
                {/* Header and Filters Combined */}
                <div className="main-header-row">
                  <div className="header-actions" style={{ order: 2, marginLeft: '20px' }}>
                    <div className="search-wrapper">
                      <FaSearch
                        className="search-icon"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSearchTerm(searchInputVal.trim().toLowerCase())}
                      />
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Search Tickets"
                        value={searchInputVal}
                        onChange={handleSearch}
                        onKeyDown={handleSearchKeyDown}
                      />
                    </div>

                    <button
                      className="create-ticket-btn dashboard-action-btn"
                      onClick={() => setShowCreateTicketModal(true)}
                    >
                      Create Ticket
                    </button>
                    {(isAdmin || isSuperuser) && (
                      <CustomSelect
                        options={adminOptions}
                        value=""
                        onChange={handleAdminActionChange}
                        placeholder="Admin Panel"
                        icon={<FaCog />}
                        hAlign="right"
                      />
                    )}
                  </div>
                  <div className="filter-group" style={{ order: 1 }}>
                    {/* Projects Filter */}
                    <CustomSelect
                      options={[
                        { value: 'all', label: 'All Projects', triggerLabel: 'Projects', className: 'is-default' },
                        ...visibleProjects.map(project => ({ value: String(project.id), label: project.name }))
                      ]}
                      value={filters.project_id}
                      onChange={(val) => handleFilterChange({ ...filters, project_id: val })}
                      placeholder="Projects"
                      icon={<FaFolderOpen />}
                      searchable={true}
                    />

                    {/* Assignee Filter */}
                    {renderAssigneeDropdown()}

                    {/* Requestors Filter */}
                    {(() => {
                      const isProjectScoped = filters.project_id && filters.project_id !== 'all';
                      let scopedCreators = [];

                      if (isAdmin && !isProjectScoped) {
                        scopedCreators = creators;
                      } else {
                        scopedCreators = creators.filter(c => {
                          if (!c.project_ids || c.project_ids.length === 0) return false;
                          if (isProjectScoped) {
                            return c.project_ids.includes(String(filters.project_id));
                          } else {
                            return c.project_ids.some(pid => assignedProjectIds.includes(String(pid)));
                          }
                        });

                        if (scopedCreators.length === 0 && tickets.length > 0) {
                          const ticketCreatorNames = new Set(tickets.map(t => t.creator_name));
                          scopedCreators = creators.filter(c => ticketCreatorNames.has(c.name));
                        }
                      }

                      const requestorOptions = [
                        { value: '', label: 'All Requestors', triggerLabel: 'Requestors', className: 'is-default' },
                        ...(scopedCreators || []).map(creator => ({ value: String(creator.id), label: creator.name }))
                      ];

                      return (
                        <CustomSelect
                          options={requestorOptions}
                          value={filters.requestor}
                          onChange={(val) => handleFilterChange({ ...filters, requestor: val })}
                          placeholder="Requestors"
                          icon={<FaUser />}
                          searchable={true}
                        />
                      );
                    })()}

                    {/* Approver Filter */}
                    {(() => {
                      const isProjectScoped = filters.project_id && filters.project_id !== 'all';
                      let scopedApprovers = [];

                      if (isAdmin && !isProjectScoped) {
                        scopedApprovers = approvers;
                      } else {
                        scopedApprovers = approvers.filter(a => {
                          if (!a.project_ids || a.project_ids.length === 0) return false;
                          if (isProjectScoped) {
                            return a.project_ids.includes(String(filters.project_id));
                          } else {
                            return a.project_ids.some(pid => assignedProjectIds.includes(String(pid)));
                          }
                        });
                      }

                      const approverOptions = [
                        { value: '', label: 'All Approvers', triggerLabel: 'Approvers', className: 'is-default' },
                        ...scopedApprovers.map(a => ({ value: a.username, label: a.username }))
                      ];

                      return (
                        <CustomSelect
                          options={approverOptions}
                          value={filters.approver}
                          onChange={(val) => handleFilterChange({ ...filters, approver: val })}
                          placeholder="Approvers"
                          icon={<FaUserCheck />}
                          searchable={true}
                        />
                      );
                    })()}

                    {/* Priority Filter */}
                    <CustomSelect
                      options={[
                        { value: '', label: 'All Priorities', triggerLabel: 'Priority', className: 'is-default' },
                        { value: 'High', label: 'High' },
                        { value: 'Medium', label: 'Medium' },
                        { value: 'Low', label: 'Low' }
                      ]}
                      value={filters.priority}
                      onChange={(val) => handleFilterChange({ ...filters, priority: val })}
                      placeholder="Priority"
                      icon={<FaExclamationCircle />}
                    />

                    {/* Tags Filter */}
                    <CustomSelect
                      options={[
                        { value: '', label: 'All Tags', triggerLabel: 'Tags', className: 'is-default' },
                        { value: 'Tasks', label: 'Tasks' },
                        { value: 'Bug', label: 'Bug' },
                        { value: 'Research', label: 'Research' }
                      ]}
                      value={filters.tag || ''}
                      onChange={(val) => handleFilterChange({ ...filters, tag: val })}
                      placeholder="Tags"
                      icon={<FaTag />}
                    />

                    {/* Labels Filter */}
                    <CustomSelect
                      options={[
                        { value: '', label: 'All Labels', triggerLabel: 'Labels', className: 'is-default' },
                        ...uniqueLabelNames.map(labelName => ({ value: labelName, label: labelName }))
                      ]}
                      value={filters.label_name}
                      onChange={(val) => handleFilterChange({ ...filters, label_name: val })}
                      placeholder="Labels"
                      icon={<FaTag />}
                    />

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                      <button
                        className="clear-filters-btn"
                        onClick={handleClearFilters}
                        title="Clear all active filters and search"
                        style={{
                          backgroundColor: '#fef2f2',
                          color: '#ef4444',
                          border: 'none',
                          outline: 'none',
                          boxShadow: 'none'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = '#ef4444';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                      >
                        <FaTimes /> Clear All
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="scrollable-section">
              {showDeletedTickets ? (
                <div className="modal-overlay">
                  <div className="jira-create-ticket-card single-card-centered" style={{ maxWidth: '800px', minHeight: '400px', maxHeight: '80vh' }}>
                    <button className="close-btn" onClick={() => setShowDeletedTickets(false)} title="Close">×</button>
                    <div className="jira-create-main" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                      <div className="jira-form-header">
                        <div className="header-icon-box" style={{ backgroundColor: '#ffe4e6', color: '#ef4444' }}><FaTrashAlt /></div>
                        <div>
                          <h2>Deleted Tickets</h2>
                          <p className="form-subtitle">Manage recently deleted tickets. You can restore them or permanently delete them.</p>
                        </div>
                      </div>
                      <div className="deleted-tickets-list-modal" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginTop: '1rem' }}>
                        {tickets
                          .filter(ticket => ticket.status === DELETED_STATUS)
                          .map(ticket => (
                            <div
                              key={ticket.ticket_id}
                              className="deleted-ticket-item-modal"
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                background: '#f8fafc'
                              }}
                            >
                              <div className="deleted-ticket-info-modal">
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>{ticket.title}</h3>
                                <div className="deleted-ticket-meta-modal" style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#64748b' }}>
                                  <span>Priority: {ticket.priority}</span>
                                  <span>
                                    Deleted on: {ticket.deleted_at
                                      ? (isNaN(Date.parse(ticket.deleted_at))
                                        ? ticket.deleted_at
                                        : new Date(ticket.deleted_at).toLocaleString())
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <div className="deleted-ticket-actions-modal" style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="jira-submit-btn"
                                  onClick={() => restoreTicket(ticket.ticket_id)}
                                  style={{ height: '32px', minWidth: '90px', maxWidth: '100px', fontSize: '12px' }}
                                >
                                  Restore
                                </button>
                                <button
                                  className="jira-cancel-btn"
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to permanently delete this ticket? This action cannot be undone.')) {
                                      deleteTicketPermanently(ticket.ticket_id);
                                    }
                                  }}
                                  style={{
                                    height: '32px',
                                    minWidth: '130px',
                                    maxWidth: '140px',
                                    fontSize: '12px',
                                    color: '#ef4444',
                                    borderColor: '#fca5a5',
                                    backgroundColor: '#fff',
                                    marginTop: 0
                                  }}
                                >
                                  Delete Permanently
                                </button>
                              </div>
                            </div>
                          ))}
                        {tickets.filter(ticket => ticket.status === DELETED_STATUS).length === 0 && (
                          <div className="no-deleted-tickets-modal" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                            No deleted tickets found
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="kanban-board-row">
                  {/* Kanban Board */}
                  <div className="kanban-board-main" style={{ minWidth: 0 }}>
                    {renderStatusColumns()}
                  </div>

                  {/* Project Team panel removed from UI */}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Ticket #{selectedTicket.ticket_id}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <h3>{selectedTicket.title}</h3>
              <p>{selectedTicket.description}</p>
            </div>
            <div className="modal-footer">
              <button className="edit-btn" onClick={() => handleEditTicket(selectedTicket)}>
                <FaEdit /> Edit
              </button>
              <button className="delete-btn" onClick={() => handleDeleteTicket(selectedTicket.id)}>
                <FaTrash /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTicket && (
        <EditTicket
          isModal={true}
          ticketId={editingTicket.id}
          initialTicketData={editingTicket}
          onClose={() => setEditingTicket(null)}
          onSave={async (closeModal = true) => {
            await loadTickets();
            if (closeModal) setEditingTicket(null);
          }}
        />
      )}

      {showAddStatusModal && (
        <AddStatusModal
          onClose={() => setShowAddStatusModal(false)}
          setCustomStatuses={setCustomStatuses}
          setAllStatuses={setAllStatuses}
        />
      )}

      {showAddProjectModal && (
        <AddProjectModal
          onClose={() => setShowAddProjectModal(false)}
          onProjectCreated={() => {
            loadProjects();
          }}
          onViewProjects={() => {
            setShowAddProjectModal(false);
            setShowProjectDrawer(true);
          }}
          onAddLabel={() => {
            setShowAddProjectModal(false);
            setShowAddLabelModal(true);
          }}
        />
      )}

      {showAddLabelModal && (
        <AddLabelModal
          onClose={() => setShowAddLabelModal(false)}
          projects={projects}
          labels={labels}
          onLabelsCreated={() => {
            loadLabels();
          }}
        />
      )}

      <ProjectListDrawer
        isOpen={showProjectDrawer}
        onClose={() => setShowProjectDrawer(false)}
        onProjectUpdated={loadProjects}
      />

      {showAddUsersModal && (
        <AddUsersToProjectModal
          onClose={() => setShowAddUsersModal(false)}
          onUserAdded={() => {
            // Optional: Reload projects after user assignment
            loadProjects();
          }}
        />
      )}

      {showCreateTicketModal && (
        <div className="modal-overlay">
          <CreateTicket
            onClose={() => setShowCreateTicketModal(false)}
            isModal={true}
            onTicketCreated={handleTicketCreated}
            projects={visibleProjects}
          />
        </div>
      )}

      {showToast && (
        <div
          className={`toast-notification ${toastType}`}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 24px',
            borderRadius: '4px',
            backgroundColor: '#fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '300px',
            animation: 'slideIn 0.3s ease-out',
            borderLeft: toastType === 'success' ? '4px solid #4CAF50' : '4px solid #f44336',
            color: toastType === 'success' ? '#4CAF50' : '#f44336'
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
export default DashBoard;
