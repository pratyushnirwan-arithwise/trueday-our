import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css'; // We'll add this next, or add to Reports.css

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...', searchable = false }) {
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
      >
        <span>{selectedOption.label}</span>
        <span className="custom-select-arrow">▾</span>
      </button>

      {isOpen && (
        <div className="custom-select-dropdown">
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
              >
                {opt.label}
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
