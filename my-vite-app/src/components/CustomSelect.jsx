import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css'; // We'll add this next, or add to Reports.css

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...', searchable = false, hAlign = 'left', vAlign = 'bottom', icon = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery, isOpen]);

  const filteredOptions = searchable && searchQuery
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const listElement = listRef.current;
      const activeElement = listElement.children[activeIndex];
      if (activeElement) {
        const listRect = listElement.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();

        if (activeRect.bottom > listRect.bottom) {
          listElement.scrollTop += activeRect.bottom - listRect.bottom;
        } else if (activeRect.top < listRect.top) {
          listElement.scrollTop -= listRect.top - activeRect.top;
        }
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= filteredOptions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredOptions.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        const opt = filteredOptions[activeIndex];
        if (!opt.disabled) {
          onChange(opt.value);
          setIsOpen(false);
          setSearchQuery('');
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const selectedOption = options.find(o => o.value === value) || { label: placeholder, value: '' };

  return (
    <div className="custom-select-container" ref={containerRef} onKeyDown={handleKeyDown}>
      <button 
        type="button" 
        className={`custom-select-trigger ${isOpen ? 'open' : ''} ${selectedOption.color ? 'has-color' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={selectedOption.color ? { backgroundColor: `${selectedOption.color}20`, color: selectedOption.color, borderColor: `${selectedOption.color}40` } : {}}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <span style={{ color: '#000', display: 'flex', alignItems: 'center', fontSize: '1.1em' }}>{icon}</span>}
          {selectedOption.label}
        </span>
        <span className="custom-select-arrow">▾</span>
      </button>

      {isOpen && (
        <div className="custom-select-dropdown" style={{ 
          left: hAlign === 'left' ? 0 : 'auto', 
          right: hAlign === 'right' ? 0 : 'auto',
          top: vAlign === 'bottom' ? 'calc(100% + 4px)' : 'auto',
          bottom: vAlign === 'top' ? 'calc(100% + 4px)' : 'auto'
        }}>
          {searchable && (
            <div className="custom-select-search-wrapper">
              <input
                type="text"
                className="custom-select-search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          )}
          <div className="custom-select-options-list" ref={listRef}>
            {filteredOptions.length > 0 ? filteredOptions.map((opt, i) => (
              <div 
                key={`${opt.value}-${i}`} 
                className={`custom-select-option ${opt.value === value ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''} ${i === activeIndex ? 'active' : ''}`}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={opt.color ? { backgroundColor: `${opt.color}20`, color: opt.color } : {}}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {opt.label}
                </div>
              </div>
            )) : (
              <div className="custom-select-no-results">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
