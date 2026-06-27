import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import DashboardSidebar from './components/DashboardSidebar';
import CustomSelect from './components/CustomSelect';
import CustomDatePicker from './components/CustomDatePicker';
import { Calendar, ClipboardList, CheckCircle2, Clock, BellRing, Download } from 'lucide-react';
import { useUser } from './contexts/UserContext';
import './Reports.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const badgeClass = p => {
  const v = (p || '').toLowerCase();
  if (v === 'high') return 'badge badge-high';
  if (v === 'medium') return 'badge badge-medium';
  if (v === 'low') return 'badge badge-low';
  return 'badge badge-default';
};

const PRIORITY_STYLES = {
  high: {
    background: () => document.body.classList.contains('dark') ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
    color: () => document.body.classList.contains('dark') ? '#fca5a5' : '#B91C1C',
    dotColor: '#EF4444'
  },
  medium: {
    background: () => document.body.classList.contains('dark') ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
    color: () => document.body.classList.contains('dark') ? '#fde047' : '#92400E',
    dotColor: '#F59E0B'
  },
  low: {
    background: () => document.body.classList.contains('dark') ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
    color: () => document.body.classList.contains('dark') ? '#86efac' : '#065F46',
    dotColor: '#10B981'
  },
  default: {
    background: () => document.body.classList.contains('dark') ? '#2e2e2e' : '#F1F5F9',
    color: () => document.body.classList.contains('dark') ? '#909090' : '#64748B',
    dotColor: '#94A3B8'
  },
};

const PriorityBadge = ({ priority }) => {
  const key = (priority || '').toLowerCase();
  const s = PRIORITY_STYLES[key] || PRIORITY_STYLES.default;
  const bg = typeof s.background === 'function' ? s.background() : s.background;
  const color = typeof s.color === 'function' ? s.color() : s.color;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap',
      background: bg, color: color,
      width: 'fit-content',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dotColor, flexShrink: 0 }} />
      {priority || 'N/A'}
    </span>
  );
};

const AVATAR_COLORS = ['#5b5cf6', '#7c3aed', '#000000ff', '#059669', '#d97706', '#dc2626', '#db2777'];
const avatarColor = name => AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
const initials = name => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

/* ── Count-up hook ── */
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

/* ── KPI Card ── */
function KpiCard({ kpi }) {
  const count = useCountUp(kpi.value);
  return (
    <div className={`rpt-kpi ${kpi.iconCls}`}>
      <div className="rpt-kpi-body" style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '6px', margin: '0 auto' }}>
        <span className="rpt-kpi-number">{count.toLocaleString()}</span>
        <span className="rpt-kpi-label" style={{ textTransform: 'uppercase' }}>{kpi.label}</span>
      </div>
    </div>
  );
}

/* ── Sparkline SVG ── */
const Sparkline = ({ data = [], color = '#5b5cf6', width = 64, height = 28 }) => {
  if (data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data, 1), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const id = `sp${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="rpt-kpi-sparkline">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={[...pts, `${width},${height}`, `0,${height}`].join(' ')} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
};

const Spinner = () => <div className="rpt-loading"><div className="rpt-spinner" /><span>Loading…</span></div>;

const FONT = { family: 'Inter', size: 11 };
const TOOLTIP = {
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  titleFont: { ...FONT, weight: '400' },
  bodyFont: FONT,
  padding: 10,
  cornerRadius: 8,
};
const getThemeColors = () => {
  const isDark = document.body.classList.contains('dark');
  return {
    gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    tickColor: isDark ? '#9ca3af' : '#64748b',
    textColor: isDark ? '#f0f0f0' : '#0f172a',
  };
};

const baseOpts = (showLegend = false) => {
  const colors = getThemeColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    plugins: {
      legend: showLegend
        ? { position: 'bottom', align: 'center', labels: { boxWidth: 8, padding: 24, font: { ...FONT, size: 9 }, usePointStyle: true, pointStyle: 'circle', color: colors.tickColor } }
        : { display: false },
      tooltip: TOOLTIP,
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: FONT, color: colors.tickColor, maxRotation: 90, minRotation: 90 } },
      y: { beginAtZero: true, grid: { color: colors.gridColor }, border: { display: false }, ticks: { font: FONT, color: colors.tickColor, callback: v => Number.isInteger(v) ? v : null } },
    },
  };
};

const STATUS_TICK_FONT = { family: 'Inter', size: 9 };

const barGradientPlugin = {
  id: 'barGradientPlugin',
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.type !== 'bar' || !meta.visible) return;
      meta.data.forEach((bar, j) => {
        const { y, base } = bar.getProps(['y', 'base'], true);
        const rawColor = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[j] : ds.backgroundColor;
        if (!rawColor || base <= y) return;
        const grad = ctx.createLinearGradient(0, y, 0, base);
        grad.addColorStop(0, rawColor);
        let transparentColor = 'rgba(0, 0, 0, 0)';
        if (typeof rawColor === 'string') {
          const trimmed = rawColor.trim();
          if (trimmed.startsWith('#')) {
            transparentColor = trimmed.length === 9 ? trimmed.slice(0, 7) + '00' : trimmed + '00';
          } else if (trimmed.startsWith('rgba')) {
            transparentColor = trimmed.replace(/,([^,]+)\s*\)$/, ', 0)');
          } else if (trimmed.startsWith('rgb')) {
            transparentColor = trimmed.replace('rgb', 'rgba').replace(')', ', 0)');
          }
        }
        grad.addColorStop(1, transparentColor);
        bar.options.backgroundColor = grad;
      });
    });
  }
};

const statusFillPlugin = {
  id: 'statusFillPlugin',
  beforeDatasetsDraw(chart) {
    const { ctx, data } = chart;
    // find first bar dataset meta
    let barMeta = null;
    for (let i = 0; i < data.datasets.length; i++) {
      const m = chart.getDatasetMeta(i);
      if (m.type === 'bar' && m.data.length) { barMeta = m; break; }
    }
    if (!barMeta || barMeta.data.length < 2) return;
    const bars = barMeta.data;
    const base = bars[0].base;
    const hw = bars[0].width / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bars[0].x - hw, base);
    bars.forEach((bar, i) => {
      if (i === 0) { ctx.lineTo(bar.x, bar.y); return; }
      const prev = bars[i - 1];
      const cpx = (prev.x + bar.x) / 2;
      ctx.bezierCurveTo(cpx, prev.y, cpx, bar.y, bar.x, bar.y);
    });
    ctx.lineTo(bars[bars.length - 1].x + hw, base);
    ctx.closePath();
    ctx.fillStyle = document.body.classList.contains('dark') ? 'rgba(255, 255, 255, 0.05)' : 'rgba(150, 150, 150, 0.13)';
    ctx.fill();
    ctx.restore();
  }
};

const getStatusChartOpts = () => {
  const colors = getThemeColors();
  return {
    ...baseOpts(false),
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: STATUS_TICK_FONT, color: colors.tickColor, maxRotation: 0, minRotation: 0 } },
      y: { beginAtZero: true, grid: { color: colors.gridColor }, border: { display: false }, ticks: { font: STATUS_TICK_FONT, color: colors.tickColor, callback: v => Number.isInteger(v) ? v : null } },
    },
  };
};

const getDoughnutOpts = () => {
  const colors = getThemeColors();
  return {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: 30 },
    cutout: '76%',
    animation: { duration: 500 },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, padding: 20, font: { ...FONT, size: 12 }, usePointStyle: true, pointStyle: 'circle', color: colors.tickColor } },
      tooltip: {
        ...TOOLTIP,
        xAlign: (ctx) => {
          const tooltip = ctx.tooltip;
          if (!tooltip || !tooltip.dataPoints || !tooltip.dataPoints.length) return 'center';

          const chart = tooltip.chart;
          if (!chart || !chart.chartArea) return 'center';

          const chartCenter = (chart.chartArea.left + chart.chartArea.right) / 2;
          const elementX = tooltip.dataPoints[0].element.tooltipPosition().x;

          // If slice is on the left half, point arrow rightwards (box goes left)
          // If slice is on the right half, point arrow leftwards (box goes right)
          return elementX < chartCenter ? 'right' : 'left';
        },
        callbacks: { label: ctx => { const t = ctx.dataset.data.reduce((a, b) => a + b, 0); return ` ${ctx.label.split(' ')[0]}: ${ctx.raw} (${t > 0 ? ((ctx.raw / t) * 100).toFixed(1) : 0}%)`; } }
      },
    },
  };
};

const dotEndpointPlugin = {
  id: 'dotEndpointPlugin',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    const dataset = data.datasets[0];
    if (!dataset) return;

    ctx.save();
    chart.getDatasetMeta(0).data.forEach((bar, index) => {
      const rawColor = dataset.dotColors?.[index] || dataset.backgroundColor?.[index] || '#6366F1';
      const value = Array.isArray(dataset.data[index]) ? dataset.data[index][1] : dataset.data[index];

      // Draw dot at the tip (bar.x = rightmost point)
      ctx.beginPath();
      ctx.arc(bar.x, bar.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = rawColor;
      ctx.fill();

      // Draw value label
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = document.body.classList.contains('dark') ? '#f0f0f0' : '#1e293b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(value?.toString() ?? '', bar.x + 8, bar.y);
    });
    ctx.restore();
  }
};

const yAxisAvatarPlugin = {
  id: 'yAxisAvatarPlugin',
  afterDraw(chart) {
    if (chart.config.options.scales.y.ticks.display !== false) return;
    const { ctx, chartArea, data } = chart;
    const dataset = data.datasets[0];
    const labels = data.labels;
    if (!dataset || !labels || !chartArea) return;

    ctx.save();
    ctx.textBaseline = 'middle';

    chart.getDatasetMeta(0).data.forEach((bar, index) => {
      const label = labels[index] || '';
      const parts = label.trim().split(' ').filter(Boolean);
      let initials = '';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1) {
        initials = parts[0].substring(0, 2).toUpperCase();
      }
      const rawColor = dataset.dotColors?.[index] || dataset.backgroundColor?.[index] || '#6366F1';

      const cy = bar.y;
      const startX = chartArea.left - 200; // increased from 180 to 200 to give space for ranking number

      // Ranking Number
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = document.body.classList.contains('dark') ? '#888888' : '#94a3b8'; // Slate-400 color for subtle ranking number
      ctx.textAlign = 'right';
      ctx.fillText(`${index + 1}.`, startX + 6, cy);

      // Avatar Circle background
      ctx.beginPath();
      ctx.arc(startX + 24, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = rawColor + '20'; // 20 hex is ~12% opacity
      ctx.fill();

      // Initials
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.fillStyle = rawColor;
      ctx.textAlign = 'center';
      ctx.fillText(initials, startX + 24, cy + 1); // +1px vertical tweak for some fonts

      // Employee Name
      ctx.font = '500 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = document.body.classList.contains('dark') ? '#f0f0f0' : '#334155';
      ctx.textAlign = 'left';
      ctx.fillText(label, startX + 48, cy);
    });
    ctx.restore();
  }
};

const doughnutCenterPlugin = {
  id: 'doughnutCenterPlugin',
  afterDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;
    const cx = meta.data[0].x;
    const cy = meta.data[0].y;
    const total = chart.data.datasets[0]?.data?.reduce((a, b) => a + b, 0) ?? 0;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillStyle = document.body.classList.contains('dark') ? '#f0f0f0' : '#0f172a';
    ctx.fillText(total.toLocaleString(), cx, cy - 4);
    ctx.font = '400 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = document.body.classList.contains('dark') ? '#9ca3af' : '#94a3b8';
    ctx.fillText('TOTAL', cx, cy + 16);
    ctx.restore();
  }
};


const HORIZONTAL_BAR_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  animation: {
    duration: 800,
    easing: 'easeOutQuart'
  },
  layout: {
    padding: { right: 36, left: 210, top: 2, bottom: 2 } // Increased left padding from 190 to 210
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...TOOLTIP,
      callbacks: {
        label: ctx => ` ${ctx.raw} tickets`
      }
    },
  },
  scales: {
    x: {
      display: false,
      beginAtZero: true,
    },
    y: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        display: false
      }
    }
  }
};

/* ═══════ MAIN ═══════ */
export default function Reports() {
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const { currentUser } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showExport, setShowExport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [metrics, setMetrics] = useState({ totalTasks: 0, completedTasks: 0, pendingTasks: 0, overdueTasks: 0 });
  const [taskStatusData, setTaskStatusData] = useState({ labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: [], borderWidth: 2 }] });
  const [priorityData, setPriorityData] = useState({ labels: [], datasets: [{ data: [] }] });
  const [companyLineData, setCompanyLineData] = useState({ labels: [], datasets: [] });
  const [creationFreqData, setCreationFreqData] = useState({ labels: [], datasets: [] });
  const [inProgressTickets, setInProgressTickets] = useState([]);
  const [inProgressLoading, setInProgressLoading] = useState(false);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [globalStartDate, setGlobalStartDate] = useState('');
  const [globalEndDate, setGlobalEndDate] = useState('');

  useEffect(() => {
    const h = e => { if (!e.target.closest('.export-wrapper')) setShowExport(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    setIsLoadingEmployees(true);
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(setEmployees).catch(() => { }).finally(() => setIsLoadingEmployees(false));
  }, []);

  useEffect(() => {
    setIsLoadingStatus(true);
    fetch('/api/status').then(r => r.ok ? r.json() : Promise.reject()).then(d => setStatuses(d.map(s => (s.name || s.status_name).toUpperCase()))).catch(e => setStatusError(String(e))).finally(() => setIsLoadingStatus(false));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setInProgressLoading(true);
    const p = new URLSearchParams();
    if (currentUser.role !== 'Admin') {
      p.append('project_ids', (currentUser.assigned_projects || []).join(','));
    }
    fetch(`/api/recent-inprogress-tickets?${p}`).then(r => r.ok ? r.json() : {}).then(d => setInProgressTickets(d.tickets || [])).catch(() => { }).finally(() => setInProgressLoading(false));
  }, [currentUser]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    const targetEmployee = (currentUser && currentUser.role !== 'Admin') ? currentUser.id : selectedEmployee;
    if (targetEmployee !== 'all') p.append('employee', targetEmployee);
    if (selectedPriority !== 'all') p.append('priority', selectedPriority);
    if (selectedStatus !== 'all') p.append('status', selectedStatus);

    if (currentUser && currentUser.role !== 'Admin') {
      p.append('project_ids', (currentUser.assigned_projects || []).join(','));
    }

    const formatDt = d => {
      if (!d) return '';
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    if (globalStartDate) p.append('start_date', formatDt(globalStartDate));
    if (globalEndDate) p.append('end_date', formatDt(globalEndDate));
    return p;
  }, [selectedEmployee, selectedPriority, selectedStatus, globalStartDate, globalEndDate, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const params = buildParams();
    setIsLoading(true);
    Promise.allSettled([
      fetch(`/api/task-status-distribution?${params}`).then(r => r.json()).then(setTaskStatusData),
      fetch(`/api/priority-distribution?${params}`).then(r => r.json()).then(setPriorityData),
      fetch(`/api/metricscards?${params}`).then(r => r.json()).then(setMetrics),
      fetch(`/api/ticket-creation-frequency?${params}`).then(r => r.json()).then(setCreationFreqData).catch(() => null),
    ]).finally(() => setIsLoading(false));
  }, [buildParams, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const p = new URLSearchParams();
    const targetEmployee = currentUser.role !== 'Admin' ? currentUser.id : selectedEmployee;
    if (targetEmployee !== 'all') p.append('employee', targetEmployee);
    if (selectedPriority !== 'all') p.append('priority', selectedPriority);

    if (currentUser.role !== 'Admin') {
      p.append('project_ids', (currentUser.assigned_projects || []).join(','));
    }

    const formatDt = d => {
      if (!d) return '';
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    if (globalStartDate) p.append('start_date', formatDt(globalStartDate));
    if (globalEndDate) p.append('end_date', formatDt(globalEndDate));

    fetch(`/api/company-performance-line?${p}`).then(r => r.json()).then(setCompanyLineData).catch(() => { });
  }, [selectedEmployee, selectedPriority, globalStartDate, globalEndDate, currentUser]);

  /* derived data */
  const mergedPriority = (() => {
    const c = { High: 0, Medium: 0, Low: 0 };
    priorityData?.labels?.forEach((l, i) => {
      const k = l.trim().toLowerCase();
      if (k === 'high') c.High += priorityData.datasets[0].data[i] || 0;
      if (k === 'medium') c.Medium += priorityData.datasets[0].data[i] || 0;
      if (k === 'low') c.Low += priorityData.datasets[0].data[i] || 0;
    });
    const total = c.High + c.Medium + c.Low;
    const pct = v => total > 0 ? Math.round((v / total) * 100) + '%' : '0%';
    return {
      labels: [`High  ${pct(c.High)}`, `Medium  ${pct(c.Medium)}`, `Low  ${pct(c.Low)}`],
      datasets: [{
        data: [c.High, c.Medium, c.Low],
        backgroundColor: ['#86efac', '#fde047', '#fca5a5'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  })();

  const filteredStatus = (() => {
    if (!taskStatusData?.labels?.length) return { labels: [], datasets: [] };
    const idxs = taskStatusData.labels.map((l, i) => ({ l, i })).filter(({ l }) => !['unassigned', 'not set'].includes(l.trim().toLowerCase())).map(({ i }) => i);
    return { ...taskStatusData, labels: idxs.map(i => taskStatusData.labels[i]), datasets: taskStatusData.datasets.map(ds => ({ ...ds, data: idxs.map(i => ds.data[i]), backgroundColor: ds.backgroundColor ? idxs.map(i => ds.backgroundColor[i]) : undefined, borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 }, borderSkipped: 'bottom' })) };
  })();

  // no line dataset — fill drawn by statusFillPlugin via canvas
  const mixedStatusData = filteredStatus;


  const palette = ['#5b5cf6', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  const styledLine = (raw, fill = false) => raw?.datasets ? {
    ...raw,
    datasets: raw.datasets.map((ds, i) => ({ ...ds, borderColor: palette[i % palette.length], backgroundColor: fill ? `${palette[i % palette.length]}18` : 'transparent', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.4, fill }))
  } : raw;

  const DARK_PALETTE = ['#4f46e5', '#0e7490', '#047857', '#b45309', '#b91c1c', '#7c3aed', '#be185d', '#0369a1', '#15803d', '#92400e'];

  const rankedEmployeeData = (() => {
    if (!creationFreqData?.datasets?.length) return { labels: [], datasets: [] };
    const employees = creationFreqData.datasets.map((ds, i) => {
      const total = ds.data.reduce((a, b) => a + b, 0);
      return { name: (ds.label || '').trim(), total, color: DARK_PALETTE[i % DARK_PALETTE.length] };
    });
    employees.sort((a, b) => b.total - a.total);
    return {
      labels: employees.map(e => e.name),
      datasets: [{
        label: 'Tickets Created',
        data: employees.map(e => e.total),
        backgroundColor: employees.map(e => e.color),
        dotColors: employees.map(e => e.color),
        borderWidth: 0,
        borderRadius: 0,
        barThickness: 2,
      }]
    };
  })();

  const rankingChartHeight = Math.max(120, (rankedEmployeeData.labels?.length || 0) * 36);

  const exportCSV = () => {
    setShowExport(false);
    const rows = [['Metric', 'Value'], ['Total Tasks', metrics.totalTasks], ['Completed', metrics.completedTasks], ['Pending', metrics.pendingTasks], ['Overdue', metrics.overdueTasks], [], ['Ticket ID', 'Title', 'Created By', 'Priority', 'In-Progress Since'], ...inProgressTickets.map(t => [t.ticket_id, t.title, t.creator, t.priority, t.moved_at])];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `report-${new Date().toISOString().split('T')[0]}.csv` }).click();
  };
  const exportPDF = () => { setShowExport(false); setTimeout(() => window.print(), 80); };

  /* sparkline seeds */
  const sparks = {
    total: [10, 15, 12, 20, 18, 24, 22, metrics.totalTasks || 24],
    completed: [6, 9, 8, 13, 11, 17, 15, metrics.completedTasks || 17],
    pending: [3, 5, 7, 4, 8, 6, 9, metrics.pendingTasks || 9],
    overdue: [1, 2, 1, 3, 2, 4, 3, metrics.overdueTasks || 3],
  };

  const KPIs = [
    { key: 'total', Icon: ClipboardList, iconCls: 'indigo', label: 'Total Tasks', value: metrics.totalTasks, spark: sparks.total, color: '#5b5cf6', delta: 12 },
    { key: 'completed', Icon: CheckCircle2, iconCls: 'green', label: 'Completed', value: metrics.completedTasks, spark: sparks.completed, color: '#10b981', delta: 18 },
    { key: 'pending', Icon: Clock, iconCls: 'amber', label: 'Pending', value: metrics.pendingTasks, spark: sparks.pending, color: '#f59e0b', delta: -8 },
    { key: 'overdue', Icon: BellRing, iconCls: 'red', label: 'Overdue', value: metrics.overdueTasks, spark: sparks.overdue, color: '#ef4444', delta: 5 },
  ];

  const filteredEmployees = (() => {
    if (!currentUser || currentUser.role === 'Admin') return employees;
    const userProjectIds = (currentUser.assigned_projects || []).map(id => String(id));
    return employees.filter(e => {
      return (e.project_ids || []).some(pid => userProjectIds.includes(String(pid)));
    });
  })();

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  return (
    <div className="rpt-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="rpt-main">

        {/* HEADER */}
        <header className="rpt-header">

          {/* ── KPI STRIP ── */}
          <div className="rpt-metrics">
            {KPIs.map(kpi => <KpiCard key={kpi.key} kpi={kpi} />)}
          </div>

          <div className="rpt-header-right">



            {/* Employee */}
            {currentUser && currentUser.role === 'Admin' && (
              <CustomSelect
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                searchable={true}
                options={[
                  { value: 'all', label: 'Employees' },
                  ...filteredEmployees.map(e => ({ value: e.id, label: e.username }))
                ]}
              />
            )}

            {/* Priority */}
            <CustomSelect
              value={selectedPriority}
              onChange={setSelectedPriority}
              options={[
                { value: 'all', label: 'Priorities' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' }
              ]}
            />

            {/* Status */}
            <CustomSelect
              value={selectedStatus}
              onChange={val => setSelectedStatus(val === 'All' ? 'all' : val)}
              options={
                isLoadingStatus ? [{ value: 'loading', label: 'Loading…' }]
                  : statusError ? [{ value: 'error', label: 'Error' }]
                    : [{ value: 'all', label: 'Statuses' }, ...statuses.map(s => ({ value: s, label: s }))]
              }
            />

            {/* Date range */}
            <div className="rpt-date-range" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
              <CustomDatePicker
                selectsRange={true}
                startDate={globalStartDate}
                endDate={globalEndDate}
                onChange={([start, end]) => {
                  setGlobalStartDate(start);
                  setGlobalEndDate(end);
                }}
                placeholder="Select Date Range"
              />
            </div>

            {/* Export */}
            <div className="export-wrapper">
              <button id="btn-export" className="btn-export" onClick={() => setShowExport(v => !v)}>
                <Download size={16} strokeWidth={2} /> Export
              </button>
              {showExport && (
                <div className="export-menu">
                  <button className="export-menu-item" onClick={exportCSV}>Export as CSV</button>
                  <button className="export-menu-item" onClick={exportPDF}>Print / Save PDF</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="rpt-content">

          {/* ── 3 CHARTS ── */}
          <div className="rpt-charts-3">

            {/* Tasks by Status */}
            <div className="rpt-chart-card">
              <div className="rpt-chart-header">
                <div>
                  <div className="rpt-chart-title-row">
                    <span className="rpt-chart-dot indigo" />
                    <span className="rpt-chart-name">Tasks by Status</span>
                  </div>

                </div>
              </div>
              <div className="rpt-chart-body">
                {isLoading ? <Spinner /> : <Bar data={mixedStatusData} options={getStatusChartOpts()} plugins={[statusFillPlugin, barGradientPlugin]} />}
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="rpt-chart-card">
              <div className="rpt-chart-header">
                <div>
                  <div className="rpt-chart-title-row">
                    <span className="rpt-chart-dot amber" />
                    <span className="rpt-chart-name">Priority Distribution</span>
                  </div>

                </div>
              </div>
              <div className="rpt-chart-body">
                {isLoading ? <Spinner /> : <Doughnut data={mergedPriority} options={getDoughnutOpts()} plugins={[doughnutCenterPlugin]} />}
              </div>
            </div>

            {/* Company Performance */}
            <div className="rpt-chart-card">
              <div className="rpt-chart-header">
                <div>
                  <div className="rpt-chart-title-row">
                    <span className="rpt-chart-dot green" />
                    <span className="rpt-chart-name">Company Performance</span>
                  </div>

                </div>
              </div>
              <div className="rpt-chart-body">
                {isLoading ? <Spinner /> : <Line data={styledLine(companyLineData, false)} options={baseOpts(true)} />}
              </div>
            </div>
          </div>

          {/* ── BOTTOM ROW ── */}
          <div className="rpt-bottom-row">

            {/* Employee Contribution Ranking */}
            <div className="rpt-chart-card">
              <div className="rpt-chart-header">
                <div>
                  <div className="rpt-chart-title-row">
                    <span className="rpt-chart-dot indigo" />
                    <span className="rpt-chart-name">Employee Ticket Ranking</span>
                  </div>

                </div>
              </div>
              <div className="rpt-chart-body-lg rpt-ranking-chart-body">
                {!creationFreqData?.datasets?.length
                  ? <div className="rpt-empty">No data for selected filters</div>
                  : (
                    <div className="rpt-ranking-chart-canvas" style={{ height: `${rankingChartHeight}px` }}>
                      <Bar data={rankedEmployeeData} options={HORIZONTAL_BAR_OPTS} plugins={[dotEndpointPlugin, yAxisAvatarPlugin]} />
                    </div>
                  )
                }
              </div>
            </div>

            {/* In-Progress Tickets */}
            <div className="rpt-chart-card">
              <div className="rpt-chart-header">
                <div>
                  <div className="rpt-chart-title-row">
                    <span className="rpt-chart-dot green" />
                    <span className="rpt-chart-name">Recent In-Progress Tickets</span>
                  </div>

                </div>
              </div>

              {inProgressLoading ? <Spinner /> : inProgressTickets.length === 0
                ? <div className="rpt-empty">No in-progress tickets</div>
                : (
                  <div className="rpt-table-outer">
                    <div className="rpt-tbl-head">
                      <span className="rpt-tbl-hcell">ID</span>
                      <span className="rpt-tbl-hcell">Title</span>
                      <span className="rpt-tbl-hcell">Created By</span>
                      <span className="rpt-tbl-hcell" style={{ textAlign: 'center' }}>Priority</span>
                      <span className="rpt-tbl-hcell">In-Progress Since</span>
                    </div>
                    <div className="rpt-tbl-body">
                      {inProgressTickets.map(t => (
                        <div key={t.ticket_id} className="rpt-tbl-row">
                          <span className="rpt-ticket-id">#{t.ticket_id}</span>
                          <div className="rpt-cell-title">
                            <div className="rpt-avatar" style={{ background: avatarColor(t.creator) }}>{initials(t.creator)}</div>
                            <span className="rpt-ticket-title">{t.title}</span>
                          </div>
                          <span className="rpt-cell-text">{t.creator}</span>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <PriorityBadge priority={t.priority} />
                          </div>
                          <span className="rpt-cell-date">{t.moved_at}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
