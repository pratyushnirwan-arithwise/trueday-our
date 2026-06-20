import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const highlightMatch = (text, query) => {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase()
          ? <strong key={index} style={{ fontWeight: '700' }}>{part}</strong>
          : part
      )}
    </>
  );
};

export default function CustomSelect({ options, value, onChange, placeholder = 'Select...', searchable = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const lastTypeTimeRef = useRef(0);

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

  const filteredOptions = searchable && searchQuery
    ? options.filter(o => String(o.label).toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  useEffect(() => {
    if (isOpen) {
      if (searchQuery) {
        setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
      } else {
        const selectedIdx = filteredOptions.findIndex(o => o.value === value);
        setActiveIndex(selectedIdx >= 0 ? selectedIdx : -1);
      }
    } else {
      setActiveIndex(-1);
    }
  }, [searchQuery, isOpen, value, options]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

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
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length === 0) return;
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= filteredOptions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredOptions.length === 0) return;
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
    } else if (e.key === 'Backspace') {
      if (searchable) {
        e.preventDefault();
        setSearchQuery((prev) => prev.slice(0, -1));
        lastTypeTimeRef.current = Date.now();
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (searchable) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastTypeTimeRef.current > 1500) {
          setSearchQuery(e.key);
        } else {
          setSearchQuery((prev) => prev + e.key);
        }
        lastTypeTimeRef.current = now;
      }
    }
  };

  const selectedOption = options.find(o => o.value === value) || { label: placeholder, value: '' };

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
                className={`custom-select-option ${opt.value === value ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''} ${i === activeIndex ? 'active' : ''} ${opt.className || ''}`}
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
