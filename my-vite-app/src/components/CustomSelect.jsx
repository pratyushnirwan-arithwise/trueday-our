import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css'; // We'll add this next, or add to Reports.css

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...', searchable = false, hAlign = 'left', vAlign = 'bottom', icon = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

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

  const selectedOption = options.find(o => o.value === value) || { label: placeholder, value: '' };

  const filteredOptions = searchable && searchQuery
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button 
        type="button" 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
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
          <div className="custom-select-options-list">
            {filteredOptions.length > 0 ? filteredOptions.map((opt, i) => (
              <div 
                key={`${opt.value}-${i}`} 
                className={`custom-select-option ${opt.value === value ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
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
