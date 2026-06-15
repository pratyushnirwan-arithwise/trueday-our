import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaBars } from 'react-icons/fa';
import DashboardSidebar from './components/DashboardSidebar';
import './Timeline.css';

/* ─── helpers ─── */
const STATUS_COLOR = {
  'COMPLETED': '#A8B3C2',
  'DONE': '#A8B3C2',

  'IN PROGRESS': '#7FC8A9',

  'NEW': '#8FB9F3',
  'TO DO': '#8FB9F3',

  'BLOCKED': '#D8A7E3',

  'QA': '#E8C98D',

  'DELETED': '#E7B98E',
  'UAT': '#E7B98E',

  'REVIEW': '#E8D9A8',
};

const STATUS_LABEL_COLOR = {
  'COMPLETED': '#5B6472',
  'DONE': '#5B6472',

  'IN PROGRESS': '#4A7C63',

  'NEW': '#4F78B8',
  'TO DO': '#4F78B8',

  'BLOCKED': '#7D5A87',

  'QA': '#8A6A2C',

  'UAT': '#9A6B42',

  'REVIEW': '#7B7040',
};

const STATUS_BG = {
  'COMPLETED': '#F5F7FA',
  'DONE': '#F5F7FA',

  'IN PROGRESS': '#EEF9F2',

  'NEW': '#EEF5FF',
  'TO DO': '#EEF5FF',

  'BLOCKED': '#F8EFFB',

  'QA': '#FFF7E8',

  'UAT': '#FFF4EC',

  'REVIEW': '#FFFBEF',
};

const PRIORITY_COLOR = {
  'HIGH': '#F4A6A6',
  'MEDIUM': '#F7C98B',
  'LOW': '#9ED8B4',
};

const CLOSED_STATUSES = new Set(['COMPLETED', 'DONE', 'CLOSED', 'DELETED']);

const today = new Date();
today.setHours(0, 0, 0, 0);

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function diffDays(a, b) {
  return Math.round((b - a) / 86400000);
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtShortDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTodayLabel(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function getMonthLabel(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
function avatarColor(name = '') {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

/* ─── build timeline range ─── */
function buildRange(tickets) {
  if (!tickets.length) {
    return { start: addDays(today, -30), end: addDays(today, 90), total: 120 };
  }
  const dates = [];
  tickets.forEach(t => {
    if (t.created_at) dates.push(new Date(t.created_at));
    if (t.due_date) dates.push(new Date(t.due_date));
  });
  let min = dates.reduce((a, b) => a < b ? a : b, today);
  let max = dates.reduce((a, b) => a > b ? a : b, today);
  min = addDays(min, -30);
  max = addDays(max, 90);
  // ensure today is visible
  if (today < min) min = addDays(today, -30);
  if (today > max) max = addDays(today, 90);
  const total = Math.max(diffDays(min, max), 120);
  return { start: min, end: addDays(min, total), total };
}

/* ─── group tickets into projects ─── */
function groupByProject(tickets) {
  const map = {};
  tickets.forEach(t => {
    const pid = t.project_id || 'no-project';
    const pname = t.project_name || 'No Project';
    if (!map[pid]) map[pid] = { project_id: pid, project_name: pname, tickets: [] };
    map[pid].tickets.push(t);
  });
  return Object.values(map);
}

/* ─── month header columns ─── */
function buildMonthCols(start, total) {
  const cols = [];
  let cur = new Date(start);
  cur.setDate(1);
  while (cur <= addDays(start, total)) {
    const monthStart = new Date(cur);
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const visStart = monthStart < start ? start : monthStart;
    const visEnd = monthEnd > addDays(start, total) ? addDays(start, total) : monthEnd;
    const startOff = diffDays(start, visStart);
    const days = diffDays(visStart, visEnd) + 1;
    cols.push({ label: getMonthLabel(cur), startOff, days });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return cols;
}

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */
const Timeline = () => {
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState({});   // project_id → bool
  const [selected, setSelected] = useState(null); // selected ticket
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'day' | 'today'
  const [range, setRange] = useState(null);
  const ganttRef = useRef(null);
  const leftListRef = useRef(null);
  const syncingScrollRef = useRef(false);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Zoom control
  const [pixelsPerDay, setPixelsPerDay] = useState(6);
  const PPD = pixelsPerDay;

  const [toast, setToast] = useState(null); // { msg, type }
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const autoSaveTimerRef = useRef(null);
  const lastSavedTicketsRef = useRef([]);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2400);
  }, []);

  /* fetch employees */
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(d => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => { });
  }, []);

  /* fetch tickets */
  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterStatus !== 'all') p.append('status', filterStatus);
    if (filterEmployee !== 'all') p.append('assignee_id', filterEmployee);
    fetch(`/api/tickets?${p}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setTickets(arr);
        lastSavedTicketsRef.current = JSON.parse(JSON.stringify(arr));
        setProjects(groupByProject(arr));
        setRange(buildRange(arr));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [filterStatus, filterEmployee]);

  useEffect(() => { load(); }, [load]);

  /* Auto-save functionality */
  useEffect(() => {
    if (!tickets.length) {
      lastSavedTicketsRef.current = [];
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Check if there are any unsaved changes
    const hasChanges = tickets.some((ticket, idx) => {
      const lastSaved = lastSavedTicketsRef.current.find(t => t.ticket_id === ticket.ticket_id);
      if (!lastSaved) return true;
      return (
        lastSaved.status !== ticket.status ||
        lastSaved.priority !== ticket.priority ||
        lastSaved.title !== ticket.title ||
        lastSaved.description !== ticket.description
      );
    });

    if (!hasChanges) {
      setAutoSaveStatus('idle');
      return;
    }

    // Debounce auto-save - save after 2 seconds of no changes
    setAutoSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const changedTickets = tickets.filter(ticket => {
          const lastSaved = lastSavedTicketsRef.current.find(t => t.ticket_id === ticket.ticket_id);
          if (!lastSaved) return true;
          return (
            lastSaved.status !== ticket.status ||
            lastSaved.priority !== ticket.priority ||
            lastSaved.title !== ticket.title ||
            lastSaved.description !== ticket.description
          );
        });

        if (changedTickets.length === 0) {
          setAutoSaveStatus('idle');
          return;
        }

        // Save each changed ticket
        for (const ticket of changedTickets) {
          const res = await fetch(`/api/tickets/${ticket.ticket_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: ticket.status,
              priority: ticket.priority,
              title: ticket.title,
              description: ticket.description
            })
          });

          if (!res.ok) {
            throw new Error(`Failed to save ticket ${ticket.ticket_id}`);
          }
        }

        // Update the saved state
        lastSavedTicketsRef.current = JSON.parse(JSON.stringify(tickets));
        setAutoSaveStatus('saved');

        // Reset to idle after 1.5s
        setTimeout(() => setAutoSaveStatus('idle'), 1500);
      } catch (err) {
        console.error('Auto-save error:', err);
        setAutoSaveStatus('error');
        showToast('Failed to auto-save changes', 'error');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [tickets, showToast]);

  /* scroll today into view */
  const scrollToToday = useCallback(() => {
    if (!range || !ganttRef.current || viewMode === 'today') return;
    requestAnimationFrame(() => {
      const el = ganttRef.current;
      if (!el) return;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const exactTodayOff = (now - range.start) / 86400000;
      const todayX = exactTodayOff * PPD;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const target = Math.min(maxScroll, Math.max(0, todayX - el.clientWidth / 2));

      el.scrollTo({ left: target, behavior: 'smooth' });
    });
  }, [range, PPD, viewMode]);

  useEffect(() => {
    scrollToToday();
  }, [range, PPD, scrollToToday]);

  const syncVerticalScroll = useCallback((source) => {
    if (syncingScrollRef.current) return;

    const sourceEl = source === 'left' ? leftListRef.current : ganttRef.current;
    const targetEl = source === 'left' ? ganttRef.current : leftListRef.current;
    if (!sourceEl || !targetEl) return;

    syncingScrollRef.current = true;
    targetEl.scrollTop = sourceEl.scrollTop;
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, []);

  /* toggle project collapse */
  const toggleProject = (pid) =>
    setCollapsed(prev => ({ ...prev, [pid]: !prev[pid] }));

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: 'var(--tl-bg)' }}>
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="tl-page" style={{ flex: 1, marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)', transition: 'margin-left 0.2s ease-in-out, width 0.2s ease-in-out', width: `calc(100vw - ${sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)'})` }}>
        <div className="tl-loading-full">
          <div className="tl-spinner-lg" />
          <p>Loading Timeline…</p>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: 'var(--tl-bg)' }}>
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="tl-page" style={{ flex: 1, marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)', transition: 'margin-left 0.2s ease-in-out, width 0.2s ease-in-out', width: `calc(100vw - ${sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)'})` }}>
        <div className="tl-error-full">
          <span>Warning</span>
          <p>Failed to load: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      </div>
    </div>
  );

  if (!range) return null;

  const isTodayView = viewMode === 'today';
  const todayStart = new Date(today);
  const todayEnd = addDays(todayStart, 1);
  const monthCols = isTodayView ? [] : buildMonthCols(range.start, range.total);
  const totalUnits = isTodayView ? 24 : range.total;
  const totalWidth = totalUnits * PPD;
  const now = new Date();
  const exactTodayOff = isTodayView
    ? (now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600)
    : (now - range.start) / 86400000;

  /* ── bar geometry ── */
  function barGeom(ticket) {
    const start = ticket.created_at ? new Date(ticket.created_at) : today;
    const end = ticket.due_date ? new Date(ticket.due_date) : addDays(start, 14);
    const left = Math.max(0, diffDays(range.start, start)) * PPD;
    const width = Math.max(PPD * 1.5, diffDays(start, end) * PPD);
    const color = STATUS_COLOR[ticket.status?.toUpperCase?.()] || '#94a3b8';
    return { left, width, color };
  }

  /* ── epic bar (spans all its tickets) ── */
  function epicGeom(proj) {
    if (isTodayView) return { left: 0, width: totalWidth };

    const dates = [];
    proj.tickets.forEach(t => {
      if (t.created_at) dates.push(new Date(t.created_at));
      if (t.due_date) dates.push(new Date(t.due_date));
    });
    if (!dates.length) return null;
    const s = dates.reduce((a, b) => a < b ? a : b);
    const e = dates.reduce((a, b) => a > b ? a : b);
    const left = Math.max(0, diffDays(range.start, s)) * PPD;
    const width = Math.max(PPD * 2, diffDays(s, e) * PPD + PPD);
    return { left, width };
  }

  const STATUS_OPTIONS = ['IN PROGRESS', 'COMPLETED', 'NEW', 'BLOCKED', 'QA', 'UAT'];

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: 'var(--tl-bg)' }}>
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={setSidebarCollapsed}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />
      <div
        className="tl-page"
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)',
          transition: 'margin-left 0.2s ease-in-out, width 0.2s ease-in-out',
          width: `calc(100vw - ${sidebarCollapsed ? 'var(--sidebar-collapsed-width, 60px)' : 'var(--sidebar-width, 210px)'})`,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Floating Autosave Indicator */}
        {autoSaveStatus !== 'idle' && (
          <div className={`tl-autosave-indicator ${autoSaveStatus}`}>
            {autoSaveStatus === 'saving' && (
              <>
                <span className="tl-autosave-spinner"></span>
                Saving...
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <span className="tl-autosave-checkmark">✓</span>
                Saved
              </>
            )}
            {autoSaveStatus === 'error' && (
              <>
                <span className="tl-autosave-error">⚠</span>
                Save failed
              </>
            )}
          </div>
        )}

        {/* ── BODY ── */}
        <div className={`tl-body ${selected ? 'has-detail' : ''}`}>

          {/* ── GANTT ── */}
          <div className="tl-gantt-wrapper">
            {/* left fixed column */}
            <div
              className="tl-left-col"
              ref={leftListRef}
              onScroll={() => syncVerticalScroll('left')}
            >
              {/* header row */}
              <div className="tl-left-header">
                {/* Mobile Toggle Button (only visible on mobile layout via CSS) */}
                <button className="tl-mobile-toggle" onClick={() => setSidebarOpen(true)}>
                  <FaBars />
                </button>

                <div className="tl-left-header-controls">
                  <div className="tl-left-header-row">
                    <select
                      className="tl-select"
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      className="tl-select"
                      value={filterEmployee}
                      onChange={e => setFilterEmployee(e.target.value)}
                    >
                      <option value="all">All Assignees</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.username}</option>
                      ))}
                    </select>
                  </div>
                  <div className="tl-left-header-row">
                    <div className="tl-zoom-group">
                      <button
                        className={`tl-zoom-btn tl-goto-today ${viewMode === 'today' ? 'active' : ''}`}
                        onClick={() => { setViewMode('today'); setPixelsPerDay(48); }}
                      >Today</button>
                      <button
                        className={`tl-zoom-btn ${viewMode === 'month' ? 'active' : ''}`}
                        onClick={() => { setViewMode('month'); setPixelsPerDay(6); }}
                      >Month</button>
                      <button
                        className={`tl-zoom-btn ${viewMode === 'day' ? 'active' : ''}`}
                        onClick={() => { setViewMode('day'); setPixelsPerDay(32); }}
                      >Day</button>
                    </div>
                  </div>
                </div>
              </div>
              {/* rows */}
              {projects.map(proj => {
                const isCollapsed = collapsed[proj.project_id];
                return (
                  <React.Fragment key={proj.project_id}>
                    {/* project row */}
                    <div
                      className="tl-row tl-project-row"
                      onClick={() => toggleProject(proj.project_id)}
                    >
                      <div className="tl-issue-cell">
                        <button className={`tl-collapse-btn ${isCollapsed ? 'collapsed' : ''}`}>
                          ▼
                        </button>
                        <span className="tl-project-icon">📁</span>
                        <span className="tl-project-name">{proj.project_name}</span>
                        <span className="tl-count-badge" style={{ marginLeft: 'auto' }}>{proj.tickets.length}</span>
                      </div>
                    </div>
                    {/* ticket rows */}
                    {!isCollapsed && proj.tickets.map(t => (
                      <div
                        key={t.ticket_id}
                        className={`tl-row tl-ticket-row ${selected?.ticket_id === t.ticket_id ? 'selected' : ''}`}
                        onClick={() => setSelected(t)}
                      >
                        <div className="tl-issue-cell">
                          <span className="tl-indent" />
                          <span className="tl-ticket-id">#{t.ticket_id}</span>
                          <span className="tl-ticket-title">{t.title}</span>
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>

            {/* right scrollable gantt */}
            <div
              className="tl-gantt-scroll"
              ref={ganttRef}
              onScroll={() => syncVerticalScroll('right')}
            >
              <div className="tl-gantt-inner" style={{ width: totalWidth }}>

                {/* month header */}
                <div className="tl-month-header">
                  {isTodayView ? (
                    <>
                      <div className="tl-month-cell tl-month-cell-top" style={{ left: 0, width: totalWidth }}>
                        Today - {fmtTodayLabel(todayStart)}
                      </div>
                      {Array.from({ length: 24 }, (_, i) => (
                        <div
                          key={`hour-${i}`}
                          className="tl-day-num-header tl-hour-header"
                          style={{ left: i * PPD, width: PPD }}
                        >
                          {String(i).padStart(2, '0')}:00
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {monthCols.map((m, i) => (
                        <div
                          key={i}
                          className={`tl-month-cell ${viewMode === 'day' ? 'tl-month-cell-top' : ''}`}
                          style={{ left: m.startOff * PPD, width: m.days * PPD }}
                        >
                          {m.label}
                        </div>
                      ))}
                      {viewMode === 'day' && Array.from({ length: range.total }, (_, i) => {
                        const d = addDays(range.start, i);
                        return (
                          <div
                            key={`day-${i}`}
                            className="tl-day-num-header"
                            style={{ left: i * PPD, width: PPD }}
                          >
                            {d.getDate()}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>


                {/* day columns background */}
                <div className="tl-grid-bg" style={{ width: totalWidth }}>
                  {Array.from({ length: totalUnits }, (_, i) => {
                    const d = isTodayView ? todayStart : addDays(range.start, i);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`tl-day-col ${isWeekend && !isTodayView ? 'weekend' : ''}`}
                        style={{ width: PPD }}
                      />
                    );
                  })}
                </div>

                {/* today label */}
                {exactTodayOff >= 0 && exactTodayOff <= totalUnits && (
                  <div
                    className="tl-today-marker-label"
                    style={{ left: exactTodayOff * PPD }}
                  >
                    Today
                  </div>
                )}

                {/* bars */}
                <div className="tl-bars-area">
                  {projects.map(proj => {
                    const isCollapsed = collapsed[proj.project_id];
                    const eg = epicGeom(proj);
                    return (
                      <React.Fragment key={proj.project_id}>
                        {/* project/epic bar */}
                        <div className="tl-bar-row tl-epic-bar-row">
                          {eg && (
                            <div
                              className="tl-bar tl-epic-bar"
                              style={{ left: eg.left, width: eg.width }}
                              title={proj.project_name}
                            >
                              <span className="tl-bar-label">{proj.project_name}</span>
                            </div>
                          )}
                        </div>
                        {/* ticket bars */}
                        {!isCollapsed && proj.tickets.map(t => {
                          return (
                            <TimelineBar
                              key={t.ticket_id}
                              ticket={t}
                              selected={selected?.ticket_id === t.ticket_id}
                              onSelect={setSelected}
                              PPD={PPD}
                              rangeStart={isTodayView ? todayStart : range.start}
                              viewMode={viewMode}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>

          {/* ── DETAIL PANEL ── */}
          {selected && (
            <DetailPanel ticket={selected} onClose={() => setSelected(null)} />
          )}
        </div>
      </div>
      {/* Toast notification */}
      {toast && (
        <div className={`tl-save-toast${toast.type === 'error' ? ' error' : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

/* ════ DETAIL PANEL ════ */
const DetailPanel = ({ ticket: t, onClose }) => {
  const status = t.status?.toUpperCase?.() || 'NEW';
  const priority = t.priority?.toUpperCase?.() || 'MEDIUM';

  // compute progress from status
  const progress = {
    'COMPLETED': 100, 'DONE': 100,
    'QA': 80, 'UAT': 90,
    'IN PROGRESS': 50, 'BLOCKED': 30,
    'NEW': 5, 'TO DO': 5,
  }[status] || 0;

  return (
    <aside className="tl-detail">
      <div className="tl-detail-header">
        <div className="tl-detail-title-row">
          <span className="tl-detail-id">#{t.ticket_id}</span>
          <button className="tl-detail-close" onClick={onClose} title="Close">✕</button>
        </div>
        <h2 className="tl-detail-name">{t.title}</h2>
        <div className="tl-detail-chips">
          <span
            className="tl-chip"
            style={{ background: STATUS_BG[status] || '#f1f5f9', color: STATUS_LABEL_COLOR[status] || '#475569' }}
          >
            {status}
          </span>
          <span
            className="tl-chip"
            style={{ background: '#fff7ed', color: PRIORITY_COLOR[priority] || '#f59e0b' }}
          >
            {priority}
          </span>
        </div>
      </div>

      <div className="tl-detail-body">
        <div className="tl-detail-field">
          <label>Project</label>
          <span>{t.project_name || '—'}</span>
        </div>
        <div className="tl-detail-field">
          <label>Assignee</label>
          <div className="tl-detail-person">
            {t.assignee_name && t.assignee_name !== 'Unassigned' ? (
              <>
                <div className="tl-avatar sm" style={{ background: avatarColor(t.assignee_name) }}>
                  {initials(t.assignee_name)}
                </div>
                <span>{t.assignee_name}</span>
              </>
            ) : <span className="tl-muted">Unassigned</span>}
          </div>
        </div>
        <div className="tl-detail-field">
          <label>Creator</label>
          <div className="tl-detail-person">
            {t.creator_name ? (
              <>
                <div className="tl-avatar sm" style={{ background: avatarColor(t.creator_name) }}>
                  {initials(t.creator_name)}
                </div>
                <span>{t.creator_name}</span>
              </>
            ) : <span className="tl-muted">—</span>}
          </div>
        </div>
        <div className="tl-detail-field">
          <label>Approver</label>
          <div className="tl-detail-person">
            {t.approver_name && t.approver_name !== 'Unassigned' ? (
              <>
                <div className="tl-avatar sm" style={{ background: avatarColor(t.approver_name) }}>
                  {initials(t.approver_name)}
                </div>
                <span>{t.approver_name}</span>
              </>
            ) : <span className="tl-muted">Unassigned</span>}
          </div>
        </div>
        <div className="tl-detail-field">
          <label>Dates</label>
          <span>{fmtDate(t.created_at)} → {fmtDate(t.due_date)}</span>
        </div>
        <div className="tl-detail-field">
          <label>Progress</label>
          <div className="tl-progress-bar">
            <div className="tl-progress-fill" style={{ width: `${progress}%`, background: STATUS_COLOR[status] || '#6366f1' }} />
          </div>
          <span className="tl-progress-pct">{progress}%</span>
        </div>
        {t.priority && (
          <div className="tl-detail-field">
            <label>Priority</label>
            <span style={{ color: PRIORITY_COLOR[priority], fontWeight: 600 }}>{t.priority}</span>
          </div>
        )}
        {t.label_name && (
          <div className="tl-detail-field">
            <label>Label</label>
            <span
              className="tl-chip"
              style={{ background: t.color || '#e0e7ff', color: '#3730a3', fontSize: '0.78rem' }}
            >{t.label_name}</span>
          </div>
        )}
        {t.description && (
          <div className="tl-detail-field column">
            <label>Description</label>
            <p className="tl-desc">{t.description}</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Timeline;

/* ════ TIMELINE BAR ════ */
const TimelineBar = React.memo(({ ticket: t, selected, onSelect, PPD, rangeStart, viewMode }) => {
  const start = t.created_at ? new Date(t.created_at) : today;
  const due = t.due_date ? new Date(t.due_date) : addDays(start, 14);
  const status = t.status?.toUpperCase?.() || 'NEW';
  const isOverdue = due < today && !CLOSED_STATUSES.has(status);
  const isTodayView = viewMode === 'today';
  const now = new Date();
  const visualEnd = isOverdue ? (isTodayView ? now : today) : due;
  const color = STATUS_COLOR[status] || '#94a3b8';

  let left;
  let width;
  let dueWidth;

  if (isTodayView) {
    const dayStart = new Date(rangeStart);
    const dayEnd = addDays(dayStart, 1);
    const clippedStart = start < dayStart ? dayStart : start;
    const clippedEnd = visualEnd > dayEnd ? dayEnd : visualEnd;

    if (clippedEnd <= dayStart || clippedStart >= dayEnd) {
      left = 0;
      width = 0;
      dueWidth = 0;
    } else {
      const hoursFromStart = (clippedStart - dayStart) / 3600000;
      const hoursWide = Math.max(0, (clippedEnd - clippedStart) / 3600000);
      left = Math.max(0, hoursFromStart) * PPD;
      width = Math.max(PPD * 0.75, hoursWide * PPD);
      width = Math.min(width, 24 * PPD - left);

      const clippedDue = due > dayEnd ? dayEnd : due;
      const dueHoursWide = Math.max(0, (clippedDue - clippedStart) / 3600000);
      dueWidth = Math.max(0, dueHoursWide * PPD);
    }
  } else {
    left = Math.max(0, diffDays(rangeStart, start)) * PPD;
    width = Math.max(PPD * 1.5, diffDays(start, visualEnd) * PPD);
    dueWidth = Math.max(PPD * 1.5, diffDays(start, due) * PPD);
  }

  const overdueLeft = Math.min(dueWidth, width);
  const overdueWidth = Math.max(0, width - overdueLeft);

  const barClass = [
    'tl-bar',
    'timeline-bar',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`tl-bar-row ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(t)}
    >
      {width > 0 && (
        <div
          className={barClass}
          style={{ left, width, background: color }}
          title={isOverdue ? `${fmtDate(t.created_at)} to ${fmtDate(t.due_date)} - overdue since ${fmtDate(addDays(due, 1))}` : `${fmtDate(t.created_at)} to ${fmtDate(t.due_date)}`}
        >
          {isOverdue && overdueWidth > 0 && (
            <span
              className="tl-bar-overdue"
              style={{ left: overdueLeft, width: overdueWidth }}
            />
          )}
          <span className="tl-bar-label">{t.title}</span>
        </div>
      )}
    </div>
  );
});
