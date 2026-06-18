import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './CustomSelect.css'; // Shared CSS file for custom components

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CustomDatePicker({ 
  value, 
  onChange, 
  placeholder = 'Select date...',
  selectsRange = false,
  startDate = null,
  endDate = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('days'); // 'days' or 'years'
  
  const initialDateStr = selectsRange ? (startDate || endDate) : value;
  const currentValDate = initialDateStr ? new Date(initialDateStr + 'T12:00:00') : new Date();
  const [viewDate, setViewDate] = useState(new Date(currentValDate.getFullYear(), currentValDate.getMonth(), 1));
  
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setViewMode('days');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const formatted = localDate.toISOString().split('T')[0];
    
    if (!selectsRange) {
      onChange(formatted);
      setIsOpen(false);
    } else {
      if (!startDate && !endDate) {
        onChange([formatted, null]);
      } else if (startDate && !endDate) {
        // If clicked date is before start date, make it the new start date
        if (new Date(formatted) < new Date(startDate)) {
          onChange([formatted, null]);
        } else {
          onChange([startDate, formatted]);
          setIsOpen(false);
        }
      } else if (startDate && endDate) {
        // Reset and start new range
        onChange([formatted, null]);
      }
    }
  };

  const isDateInRange = (year, month, day) => {
    if (!selectsRange || !startDate || !endDate) return false;
    const d = new Date(year, month, day).getTime();
    const s = new Date(startDate + 'T00:00:00').getTime();
    const e = new Date(endDate + 'T00:00:00').getTime();
    return d > s && d < e;
  };

  const isSameDate = (year, month, day, dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString + 'T12:00:00');
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const blanks = Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} className="dp-day empty"></div>);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      
      let isSelected = false;
      let inRange = false;
      let isStart = false;
      let isEnd = false;

      if (!selectsRange) {
        isSelected = isSameDate(year, month, dayNum, value);
      } else {
        isStart = isSameDate(year, month, dayNum, startDate);
        isEnd = isSameDate(year, month, dayNum, endDate);
        isSelected = isStart || isEnd;
        inRange = isDateInRange(year, month, dayNum);
      }

      const isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === dayNum;
      
      return (
        <div 
          key={dayNum} 
          className={`dp-day ${isSelected ? 'selected' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${inRange ? 'in-range' : ''} ${isToday && !isSelected ? 'today' : ''}`}
          onClick={() => handleDateClick(dayNum)}
        >
          {dayNum}
        </div>
      );
    });

    return [...blanks, ...days];
  };

  const renderYears = () => {
    const currentYear = viewDate.getFullYear();
    const startYear = currentYear - 12;
    const years = Array.from({ length: 25 }, (_, i) => startYear + i);
    
    return years.map(y => (
      <div 
        key={y} 
        className={`dp-year ${y === currentYear ? 'selected' : ''}`}
        onClick={() => {
          setViewDate(new Date(y, viewDate.getMonth(), 1));
          setViewMode('days');
        }}
      >
        {y}
      </div>
    ));
  };

  const formatDisplayDate = (dString) => {
    if (!dString) return '';
    return new Date(dString + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  let displayValue = placeholder;
  if (!selectsRange && value) {
    displayValue = formatDisplayDate(value);
  } else if (selectsRange) {
    if (startDate && endDate) displayValue = `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
    else if (startDate) displayValue = `${formatDisplayDate(startDate)} – ...`;
  }

  const handleClear = (e) => {
    e.stopPropagation();
    if (selectsRange) {
      onChange([null, null]);
    } else {
      onChange('');
    }
    setIsOpen(false);
    setViewMode('days');
  };

  const isStartDatePast = () => {
    if (!selectsRange || !startDate || endDate) return false;
    const sDate = new Date(startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    return sDate < today;
  };

  const handleSetToday = (e) => {
    e.stopPropagation();
    const offset = new Date().getTimezoneOffset();
    const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
    const formattedToday = localDate.toISOString().split('T')[0];
    onChange([startDate, formattedToday]);
    setIsOpen(false);
    setViewMode('days');
  };

  return (
    <div className={`custom-select-container dp-container ${selectsRange ? 'range' : ''}`} ref={containerRef}>
      <button 
        type="button" 
        className={`custom-select-trigger dp-trigger ${isOpen ? 'open' : ''} ${(!value && !startDate) ? 'empty' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setViewMode('days');
        }}
      >
        <span>{displayValue}</span>
        {((selectsRange && (startDate || endDate)) || (!selectsRange && value)) && (
          <span className="dp-clear-icon" onClick={handleClear} title="Clear selection">
            <X size={14} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="custom-select-dropdown dp-popup">
          <div className="dp-header">
            <button className="dp-nav" onClick={handlePrevMonth}><ChevronLeft size={16} /></button>
            <div 
              className="dp-month-year clickable" 
              onClick={() => setViewMode(viewMode === 'days' ? 'years' : 'days')}
              title="Select year"
            >
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button className="dp-nav" onClick={handleNextMonth}><ChevronRight size={16} /></button>
          </div>
          
          {viewMode === 'days' ? (
            <div className="dp-grid">
              {DAYS.map(d => <div key={d} className="dp-day-name">{d}</div>)}
              {renderCalendar()}
            </div>
          ) : (
            <div className="dp-year-grid">
              {renderYears()}
            </div>
          )}

          <div className="dp-footer">
            {isStartDatePast() && (
              <button className="dp-today-btn" onClick={handleSetToday}>Today</button>
            )}
            <button className="dp-clear-btn" onClick={handleClear}>Clear Selection</button>
          </div>
        </div>
      )}
    </div>
  );
}
