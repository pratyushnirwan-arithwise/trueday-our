import React, { useState, useEffect, useRef, useCallback } from 'react';
import DashboardSidebar from './components/DashboardSidebar';
import './Timeline.css';

/* ─── helpers ─── */
const STATUS_COLOR = {
  'COMPLETED': '#22c55e',
  'DONE': '#22c55e',
  'IN PROGRESS': '#6366f1',
  'NEW': '#94a3b8',
  'TO DO': '#94a3b8',
  'BLOCKED': '#ef4444',
  'QA': '#f59e0b',
  'UAT': '#f97316',
  'REVIEW': '#eab308',
};
const STATUS_LABEL_COLOR = {
  'COMPLETED': '#166534', 'DONE': '#166534',
  'IN PROGRESS': '#3730a3',
  'NEW': '#475569', 'TO DO': '#475569',
  'BLOCKED': '#991b1b', 'QA': '#92400e',
  'UAT': '#9a3412', 'REVIEW': '#713f12',
};
const STATUS_BG = {
  'COMPLETED': '#dcfce7', 'DONE': '#dcfce7',
  'IN PROGRESS': '#e0e7ff',
  'NEW': '#f1f5f9', 'TO DO': '#f1f5f9',
  'BLOCKED': '#fee2e2', 'QA': '#fef3c7',
  'UAT': '#fff7ed', 'REVIEW': '#fefce8',
};

const PRIORITY_COLOR = {
  'HIGH': '#ef4444', 'MEDIUM': '#f59e0b', 'LOW': '#22c55e',
};

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
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [range, setRange] = useState(null);
  const ganttRef = useRef(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Zoom control
  const [pixelsPerDay, setPixelsPerDay] = useState(6);
  const PPD = pixelsPerDay;

  // Drag and drop state
  const [dragState, setDragState] = useState(null);
  const pixelsToDays = (pixels) => Math.round(pixels / PPD);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = pixelsToDays(deltaX);

      setTickets(prev => {
        const next = prev.map(t => {
          if (t.ticket_id === dragState.ticket.ticket_id) {
            let newStart = new Date(dragState.initialStart);
            let newEnd = new Date(dragState.initialEnd);

            if (dragState.type === 'move') {
              newStart = addDays(newStart, deltaDays);
              newEnd = addDays(newEnd, deltaDays);
            } else if (dragState.type === 'resize-left') {
              newStart = addDays(newStart, deltaDays);
              if (newStart > newEnd) newStart = newEnd;
            } else if (dragState.type === 'resize-right') {
              newEnd = addDays(newEnd, deltaDays);
              if (newEnd < newStart) newEnd = newStart;
            }

            return {
              ...t,
              created_at: newStart.toISOString(),
              due_date: newEnd.toISOString()
            };
          }
          return t;
        });
        setProjects(groupByProject(next));
        return next;
      });
    };

    const handlePointerUp = async (e) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = pixelsToDays(deltaX);
      if (deltaDays === 0 && dragState.type === 'move') {
        setDragState(null);
        return;
      }

      let newStart = new Date(dragState.initialStart);
      let newEnd = new Date(dragState.initialEnd);

      if (dragState.type === 'move') {
        newStart = addDays(newStart, deltaDays);
        newEnd = addDays(newEnd, deltaDays);
      } else if (dragState.type === 'resize-left') {
        newStart = addDays(newStart, deltaDays);
        if (newStart > newEnd) newStart = newEnd;
      } else if (dragState.type === 'resize-right') {
        newEnd = addDays(newEnd, deltaDays);
        if (newEnd < newStart) newEnd = newStart;
      }

      const startStr = newStart.toISOString();
      const endStr = newEnd.toISOString();

      try {
        const res = await fetch(`/api/tickets/${dragState.ticket.ticket_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: startStr,
            end_date: endStr
          })
        });
        if (!res.ok) throw new Error('Failed to save timeline changes');
      } catch (err) {
        console.error(err);
        setTickets(prev => {
          const next = prev.map(t => {
            if (t.ticket_id === dragState.ticket.ticket_id) {
              return {
                ...t,
                created_at: dragState.initialStart.toISOString(),
                due_date: dragState.initialEnd.toISOString()
              };
            }
            return t;
          });
          setProjects(groupByProject(next));
          return next;
        });
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, PPD]);

  const handlePointerDown = (e, t, type) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(t);
    setDragState({
      type,
      ticket: t,
      startX: e.clientX,
      initialStart: t.created_at ? new Date(t.created_at) : today,
      initialEnd: t.due_date ? new Date(t.due_date) : addDays(t.created_at ? new Date(t.created_at) : today, 14)
    });
  };

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
        setProjects(groupByProject(arr));
        setRange(buildRange(arr));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [filterStatus, filterEmployee]);

  useEffect(() => { load(); }, [load]);

  /* scroll today into view */
  const scrollToToday = useCallback(() => {
    if (!range || !ganttRef.current) return;
    const now = new Date();
    const exactTodayOff = (now - range.start) / 86400000;
    ganttRef.current.scrollLeft = Math.max(0, exactTodayOff * PPD - 200);
  }, [range, PPD]);

  useEffect(() => {
    scrollToToday();
  }, [range, PPD, scrollToToday]);

  /* toggle project collapse */
  const toggleProject = (pid) =>
    setCollapsed(prev => ({ ...prev, [pid]: !prev[pid] }));

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f0f2f6' }}>
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="tl-page" style={{ flex: 1, marginLeft: sidebarCollapsed ? '60px' : '210px', transition: 'margin-left 0.35s cubic-bezier(0.4,0,0.2,1)', width: `calc(100vw - ${sidebarCollapsed ? '60px' : '210px'})` }}>
        <div className="tl-loading-full">
          <div className="tl-spinner-lg" />
          <p>Loading Timeline…</p>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f0f2f6' }}>
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="tl-page" style={{ flex: 1, marginLeft: sidebarCollapsed ? '60px' : '210px', transition: 'margin-left 0.35s cubic-bezier(0.4,0,0.2,1)', width: `calc(100vw - ${sidebarCollapsed ? '60px' : '210px'})` }}>
        <div className="tl-error-full">
          <span>Warning</span>
          <p>Failed to load: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      </div>
    </div>
  );

  if (!range) return null;

  const monthCols = buildMonthCols(range.start, range.total);
  const totalWidth = range.total * PPD;
  const now = new Date();
  const exactTodayOff = (now - range.start) / 86400000;

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
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f0f2f6' }}>
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
          marginLeft: sidebarCollapsed ? '60px' : '210px',
          transition: 'margin-left 0.35s cubic-bezier(0.4,0,0.2,1)',
          width: `calc(100vw - ${sidebarCollapsed ? '60px' : '210px'})`,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER ── */}
        <header className="tl-header">
          <div className="tl-header-left">
            <h1>Timeline</h1>
            <span className="tl-badge">{tickets.length} tickets</span>
          </div>
          <div className="tl-header-right">
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
            <div className="tl-zoom-group">
              <button className="tl-zoom-btn tl-goto-today" onClick={scrollToToday}>Today</button>
              <button
                className={`tl-zoom-btn ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => { setViewMode('month'); setPixelsPerDay(6); }}
              >Month</button>
              <button
                className={`tl-zoom-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => { setViewMode('week'); setPixelsPerDay(12); }}
              >Week</button>
              <button
                className={`tl-zoom-btn ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => { setViewMode('day'); setPixelsPerDay(40); }}
              >Day</button>
              <div className="timeline-zoom-control" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff', padding: '0 0.5rem', borderLeft: '1.5px solid var(--tl-border)' }}>
                <button onClick={() => setPixelsPerDay(p => Math.max(2, p - 2))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tl-t2)' }}>-</button>
                <input type="range" min="2" max="100" value={pixelsPerDay} onChange={e => setPixelsPerDay(Number(e.target.value))} style={{ width: '60px' }} />
                <button onClick={() => setPixelsPerDay(p => Math.min(100, p + 2))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tl-t2)' }}>+</button>
              </div>
            </div>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className={`tl-body ${selected ? 'has-detail' : ''}`}>

          {/* ── GANTT ── */}
          <div className="tl-gantt-wrapper">
            {/* left fixed column */}
            <div className="tl-left-col">
              {/* header row */}
              <div className="tl-left-header">
                <span>Issue</span>

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
            <div className="tl-gantt-scroll" ref={ganttRef}>
              <div className="tl-gantt-inner" style={{ width: totalWidth }}>

                {/* month header */}
                <div className="tl-month-header">
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
                </div>

                {/* day columns background */}
                <div className="tl-grid-bg" style={{ width: totalWidth }}>
                  {Array.from({ length: range.total }, (_, i) => {
                    const d = addDays(range.start, i);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`tl-day-col ${isWeekend ? 'weekend' : ''}`}
                        style={{ width: PPD }}
                      />
                    );
                  })}
                </div>

                {/* today line */}
                {exactTodayOff >= 0 && exactTodayOff <= range.total && (
                  <div
                    className="tl-today-line"
                    style={{ left: exactTodayOff * PPD }}
                  >
                    <div className="tl-today-label">Today</div>
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
                          const { left, width, color } = barGeom(t);
                          return (
                            <div
                              key={t.ticket_id}
                              className={`tl-bar-row ${selected?.ticket_id === t.ticket_id ? 'selected' : ''}`}
                              onClick={() => setSelected(t)}
                            >
                              <div
                                className="tl-bar timeline-bar group relative cursor-pointer"
                                style={{ left, width, background: color }}
                                title={`${fmtDate(t.created_at)} to ${fmtDate(t.due_date)}`}
                                onPointerDown={(e) => handlePointerDown(e, t, 'move')}
                              >
                                <div className="resize-left" onPointerDown={(e) => handlePointerDown(e, t, 'resize-left')}></div>
                                <span className="tl-bar-label">{t.title}</span>
                                <div className="resize-right" onPointerDown={(e) => handlePointerDown(e, t, 'resize-right')}></div>
                              </div>
                            </div>
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
