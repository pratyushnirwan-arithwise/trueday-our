import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardSidebar from './components/DashboardSidebar';
import CustomSelect from './components/CustomSelect';
import { Search, Check, Save, MessageSquare, FolderOpen, Activity, Users } from "lucide-react";
import { FaBars } from 'react-icons/fa';
import { useUser } from './contexts/UserContext';
import './Progresspulse.css';

const API = '';

const STATUS_COLOR = {
  'NEW': '#2563eb',
  'IN PROGRESS': '#f59e0b',
  'BLOCKED': '#ef4444',
  'COMPLETED': '#10b981',
  'QA': '#8b5cf6',
  'DELETED': '#64748b'
};
const PALETTE = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#2563eb', '#db2777', '#16a34a'];
const avColor = n => PALETTE[(n || 'U').charCodeAt(0) % PALETTE.length];
const avInit = n => (n || 'U').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || 'U';
const fmtDate = dateInput => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const fmtDT = iso => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const dateStr = fmtDate(d);
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr}, ${timeStr}`;
};

export default function ProgressPulse() {
  const { currentUser } = useUser();
  const isAdmin = useMemo(() => {
    const roleFromContext = currentUser?.role;
    const roleFromStorage = localStorage.getItem('userRole');
    const role = (roleFromContext ?? roleFromStorage ?? '').toString().trim().toLowerCase();
    const nameFromContext = currentUser?.username;
    const nameFromStorage = localStorage.getItem('username');
    const username = (nameFromContext ?? nameFromStorage ?? '').toString().trim().toLowerCase();
    return role === 'admin' || username === 'admin';
  }, [currentUser?.role, currentUser?.username]);

  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [fProj, setFProj] = useState('all');
  const [fSt, setFSt] = useState('all');
  const [fUser, setFUser] = useState('all');
  const [fPrio, setFPrio] = useState('all');

  const [draft, setDraft] = useState({ what_did_you_do: '', challenge: '', what_you_learned: '', comments: '' });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [histLoad, setHistLoad] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('log'); // 'log' or 'history'

  const active = tickets.find(t => t.ticket_id === activeId) || {};

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openReviewModal = (entry) => {
    setSelectedEntry(entry);
    setReviewText(entry.review_comment || '');
    setIsModalOpen(true);
  };

  const handleSaveEntryReview = async () => {
    if (!selectedEntry) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/progress-pulse/entry/${selectedEntry.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_comment: reviewText }),
      });
      if (res.ok) {
        alert('Review comment saved successfully!');
        setIsModalOpen(false);
        loadHistory(activeId);
      } else {
        alert('Failed to save review comment.');
      }
    } catch (error) {
      console.error('Error saving review comment:', error);
      alert('Failed to save review comment.');
    }
    setSaving(false);
  };

  // Load tickets + users
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      fetch(`${API}/api/progress-pulse/tickets?user_id=${currentUser.id}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/users`).then(r => r.json()).catch(() => []),
    ]).then(([td, ud]) => {
      if (Array.isArray(td)) {
        setTickets(td);
        if (td.length) setActiveId(td[0].ticket_id);
      }
      if (Array.isArray(ud)) setUsers(ud);
      setLoading(false);
    });
  }, [currentUser]);

  // Load history
  const loadHistory = useCallback((id) => {
    setHistLoad(true);
    fetch(`${API}/api/progress-pulse/history/${id}`)
      .then(r => r.json())
      .then(d => {
        setHistory(Array.isArray(d) ? d : []);
        setHistLoad(false);
      })
      .catch(() => {
        setHistory([]);
        setHistLoad(false);
      });
  }, []);

  // Load ticket details / draft
  useEffect(() => {
    if (!activeId) return;
    setDetailLoading(true);
    fetch(`${API}/api/progress-pulse/ticket/${activeId}`)
      .then(r => r.json())
      .then(data => {
        setDraft({
          what_did_you_do: data.what_did_you_do || '',
          challenge: data.challenge || '',
          what_you_learned: data.what_you_learned || '',
          comments: data.comments || ''
        });
        setDetailLoading(false);
        setMobileMenuOpen(false);
      }).catch(() => setDetailLoading(false));
    loadHistory(activeId);
  }, [activeId, loadHistory]);

  // Save draft
  const handleSaveDraft = async () => {
    if (saving || !activeId) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/progress-pulse/update/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          what_did_you_do: draft.what_did_you_do,
          challenge: draft.challenge,
          what_you_learned: draft.what_you_learned,
          comments: draft.comments
        }),
      });
      alert('Draft saved successfully!');
    } catch (e) {
      console.error('Save draft error', e);
      alert('Failed to save draft.');
    }
    setSaving(false);
  };

  // Submit log
  const handleSubmitLog = async () => {
    if (saving || !activeId) return;
    if (!draft.what_did_you_do?.trim() && !draft.challenge?.trim() && !draft.what_you_learned?.trim()) {
      alert('Please fill at least one field before submitting.');
      return;
    }

    setSaving(true);
    const savedBy = localStorage.getItem('username') || 'User';
    const payload = {
      ticket_id: activeId,
      work_done: draft.what_did_you_do,
      challenge: draft.challenge,
      learning: draft.what_you_learned,
      review_comment: draft.comments,
      created_by: savedBy
    };

    try {
      // 1. Submit progress pulse entry to history table
      await fetch(`${API}/api/progresspulse/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // 2. Clear frontend draft inputs
      setDraft({ what_did_you_do: '', challenge: '', what_you_learned: '', comments: '' });
      // 3. Reload history list
      loadHistory(activeId);
      alert('Work Log submitted successfully!');
    } catch (e) {
      console.error('Submit log error', e);
      alert('Failed to submit Work Log.');
    }
    setSaving(false);
  };

  const PROJS = [...new Set(tickets.map(t => t.project_name).filter(Boolean))];
  const STATS = ['NEW', 'IN PROGRESS', 'BLOCKED', 'COMPLETED', 'QA', 'DELETED'];
  const PRIORITIES = ['High', 'Medium', 'Low'];

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    return (!q || t.title?.toLowerCase().includes(q) || String(t.ticket_id).includes(q))
      && (fProj === 'all' || t.project_name === fProj)
      && (fSt === 'all' || (t.status || '').toUpperCase() === fSt)
      && (fUser === 'all' || t.assignee_id?.toString() === fUser)
      && (fPrio === 'all' || (t.priority || '').toLowerCase() === fPrio.toLowerCase());
  });

  return (
    <div className="pp-root">
      {/* Main Dashboard Navigation Sidebar */}
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={setSidebarCollapsed}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      <div
        className="pp-app-frame"
        style={{
          marginLeft: '50px',
          transition: 'margin-left 0.2s ease-in-out, width 0.2s ease-in-out',
          width: `calc(100vw - ${sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)'})`
        }}
      >

        {/* TICKET LIST SIDEBAR */}
        <div className="pp-ticket-pane">
          <div className="pp-ticket-head">
            <div className="pp-search-container">
              <Search className="pp-search-icon" size={14} />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pp-search-input"
              />
            </div>
          </div>

          <div className="pp-ticket-list pp-scroll">
            {loading ? <p style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Loading...</p> :
              filtered.length === 0 ? <p style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No tickets found</p> :
                filtered.map((item) => {
                  const statusUpper = (item.status || 'NEW').toUpperCase();
                  const displayStatus = item.status || 'NEW';
                  return (
                    <div
                      key={item.ticket_id}
                      onClick={() => setActiveId(item.ticket_id)}
                      className={`pp-ticket-item ${activeId === item.ticket_id ? "active" : ""}`}
                    >
                      <div className="pp-ticket-item-top">
                        <span className="pp-ticket-item-id">#{item.ticket_id}</span>
                        <span className="pp-ticket-item-date">{fmtDate(item.created_at)}</span>
                      </div>

                      <h3 className="pp-ticket-item-title">
                        {item.title}
                      </h3>

                      <div className="pp-ticket-item-bottom-row">
                        <span className={`pp-status-pill status-${statusUpper.replace(' ', '-')}`}>
                          <span className="pp-status-dot"></span>
                          {displayStatus}
                        </span>
                        <div className="pp-ticket-item-avatar" style={{ background: avColor(item.assignee_name) }}>
                          {avInit(item.assignee_name)}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="pp-main-area pp-scroll">

          <div className="pp-main-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="pp-mobile-sidebar-toggle"
                onClick={() => setSidebarOpen(true)}
              >
                <FaBars />
              </button>
              {activeId && (
                <h1 className="pp-active-title">
                  <span className="pp-active-title-id">#{activeId}</span>
                  {' '}{active.title || 'Untitled Ticket'}
                </h1>
              )}
            </div>

            <div className="pp-filter-row">
              <CustomSelect
                options={[
                  { value: 'all', label: 'All Projects', triggerLabel: 'Projects', className: 'is-default' },
                  ...PROJS.map(p => ({ value: p, label: p }))
                ]}
                value={fProj}
                onChange={val => setFProj(val)}
                placeholder="Projects"
                icon={<FolderOpen size={14} />}
                searchable={true}
              />

              <CustomSelect
                options={[
                  { value: 'all', label: 'All Statuses', triggerLabel: 'Status', className: 'is-default' },
                  ...STATS.map(s => ({ value: s, label: s }))
                ]}
                value={fSt}
                onChange={val => setFSt(val)}
                placeholder="Status"
                icon={<Activity size={14} />}
              />

              {isAdmin && (
                <CustomSelect
                  options={[
                    { value: 'all', label: 'All Assignees', triggerLabel: 'Assignees', className: 'is-default' },
                    ...users.map(u => ({ value: String(u.id), label: u.username }))
                  ]}
                  value={fUser}
                  onChange={val => setFUser(val)}
                  placeholder="Assignees"
                  icon={<Users size={14} />}
                  searchable={true}
                />
              )}
            </div>
          </div>

          {!activeId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a ticket from the list to view details
            </div>
          ) : (
            <div className="pp-detail-content">
              {/* HORIZONTAL TABS HEADER */}
              <div className="pp-tabs-header-row">
                <h3 className="pp-log-section-title" style={{ margin: 0 }}>
                  {activeTab === 'log' ? 'Log Entry Details' : 'Previous Entries'}
                </h3>
                <div className="pp-tabs-header">
                  <button
                    className={`pp-tab-link ${activeTab === 'log' ? 'active' : ''}`}
                    onClick={() => setActiveTab('log')}
                  >
                    Daily Work Log ({new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
                  </button>
                  <button
                    className={`pp-tab-link ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                  >
                    Previous Entries
                  </button>
                </div>
              </div>

              {/* TAB BODY */}
              <div className="pp-tabs-body">
                {detailLoading ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '20px 0' }}>Loading...</p>
                ) : activeTab === 'log' ? (
                  <div className="pp-log-tab-content">
                    {history[0]?.review_comment && (
                      <div className="pp-latest-review-box">
                        <div className="pp-latest-review-header">
                          <MessageSquare size={16} style={{ color: 'var(--brand-purple)' }} />
                          <span>Admin Review Comment</span>
                        </div>
                        <div className="pp-latest-review-content">
                          {history[0].review_comment}
                        </div>
                      </div>
                    )}

                    <div className="pp-entry-vertical-list">
                      {[
                        { title: "1. What was accomplished?", value: draft.what_did_you_do, key: "what_did_you_do", placeholder: "List key completed tasks..." },
                        { title: "2. What were the main challenges?", value: draft.challenge, key: "challenge", placeholder: "Describe any roadblocks..." },
                        { title: "3. What did you learn?", value: draft.what_you_learned, key: "what_you_learned", placeholder: "Note key insights..." },
                      ].map((card, index) => (
                        <div key={index} className="pp-entry-field-group">
                          <label className="pp-entry-field-label">{card.title}</label>
                          <textarea
                            rows={4}
                            value={card.value || ''}
                            onChange={(e) => setDraft({ ...draft, [card.key]: e.target.value })}
                            className="pp-entry-field-textarea"
                            placeholder={card.placeholder}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pp-submit-row">
                      <button
                        onClick={handleSaveDraft}
                        disabled={saving}
                        className="pp-draft-btn"
                      >
                        Save Draft
                      </button>
                      <button
                        onClick={handleSubmitLog}
                        disabled={saving}
                        className="pp-submit-btn"
                      >
                        Submit Log
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pp-history-tab-content">

                    <div className="pp-table-container pp-scroll">
                      <table className="pp-table">
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Summary</th>
                            <th>Challenge</th>
                            <th>Learning</th>
                            <th>Review</th>
                            <th>Saved by</th>
                          </tr>
                        </thead>

                        <tbody>
                          {histLoad && history.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</td></tr>
                          ) : history.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No saved data found.</td></tr>
                          ) : (
                            history.map((item, index) => (
                              <tr key={item.id || index}>
                                <td style={{ fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                  {fmtDT(item.created_at)}
                                </td>
                                <td style={{ maxWidth: '180px', whiteSpace: 'pre-wrap' }}>
                                  {item.work_done || '—'}
                                </td>
                                <td style={{ maxWidth: '180px', whiteSpace: 'pre-wrap' }}>
                                  {item.challenge || '—'}
                                </td>
                                <td style={{ maxWidth: '180px', whiteSpace: 'pre-wrap' }}>
                                  {item.learning || '—'}
                                </td>
                                <td>
                                  <button
                                    onClick={() => openReviewModal(item)}
                                    className={`pp-row-review-btn ${item.review_comment ? 'has-review' : ''}`}
                                  >
                                    <MessageSquare size={14} style={{ marginRight: '6px' }} />
                                    {item.review_comment ? 'View Review' : 'Add Review'}
                                  </button>
                                </td>
                                <td>
                                  <div className="pp-table-user-cell">
                                    <div className="pp-table-avatar" style={{ background: avColor(item.created_by) }}>
                                      {avInit(item.created_by)}
                                    </div>
                                    <span className="pp-table-username">{item.created_by || 'Unknown'}</span>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>



            </div>
          )}
        </div>
      </div>

      {/* Modal popup */}
      {isModalOpen && selectedEntry && (
        <div className="pp-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="pp-modal-content" onClick={e => e.stopPropagation()}>
            <div className="pp-modal-header">
              <h2>Review Log Entry</h2>
              <button className="pp-modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="pp-modal-body">
              <div className="pp-modal-info-row">
                <div>
                  <strong>Date:</strong> {fmtDT(selectedEntry.created_at)}
                </div>
                <div>
                  <strong>User:</strong> {selectedEntry.created_by}
                </div>
              </div>
              <div className="pp-modal-section">
                <label>Accomplished:</label>
                <p>{selectedEntry.work_done || '—'}</p>
              </div>
              <div className="pp-modal-section">
                <label>Challenges:</label>
                <p>{selectedEntry.challenge || '—'}</p>
              </div>
              <div className="pp-modal-section">
                <label>Learning:</label>
                <p>{selectedEntry.learning || '—'}</p>
              </div>
              <div className="pp-modal-review-input">
                <label>Admin Review Comment:</label>
                <textarea
                  rows={4}
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Write a review comment..."
                />
              </div>
            </div>
            <div className="pp-modal-footer">
              <button className="pp-modal-btn-close" onClick={() => setIsModalOpen(false)}>Close</button>
              <button className="pp-modal-btn-save" onClick={handleSaveEntryReview} disabled={saving}>
                {saving ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
