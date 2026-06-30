import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Code, 
  Link, 
  Palette,
  Quote,
  Heading1,
  Heading2,
  Underline,
  Strikethrough
} from 'lucide-react';
import './RichTextEditor.css';

const RichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = 'Add a comment...',
  onKeyDown,
  className = '',
  style = {}
}) => {
  const editorRef = useRef(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
    '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF', '#000080'
  ];

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleInput = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    const selection = window.getSelection();
    if (selection.toString()) {
      linkText = selection.toString();
    }
    
    if (linkUrl && linkText) {
      execCommand('createLink', linkUrl);
      setIsLinkModalOpen(false);
      setLinkUrl('');
      setLinkText('');
    }
  };

  const insertList = (ordered = false) => {
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    execCommand(command);
  };

  const insertCodeBlock = () => {
    const codeBlock = '<pre><code>Code here</code></pre>';
    execCommand('insertHTML', codeBlock);
  };

  const insertQuote = () => {
    const quoteBlock = '<blockquote>Quote here</blockquote>';
    execCommand('insertHTML', quoteBlock);
  };

  const insertHeading = (level) => {
    const headingTag = `h${level}`;
    execCommand('formatBlock', `<${headingTag}>`);
  };

  const applyColor = (color) => {
    execCommand('foreColor', color);
    setSelectedColor(color);
    setShowColorPicker(false);
  };

  const handleKeyDown = (e) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          return;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          return;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          return;
        case 'k':
          e.preventDefault();
          setIsLinkModalOpen(true);
          return;
        case '1':
          e.preventDefault();
          insertHeading(1);
          return;
        case '2':
          e.preventDefault();
          insertHeading(2);
          return;
        case 'l':
          if (e.shiftKey) {
            e.preventDefault();
            insertList(true); // Ordered list
          } else {
            e.preventDefault();
            insertList(false); // Unordered list
          }
          return;
        case 'q':
          e.preventDefault();
          insertQuote();
          return;
        case '`':
          e.preventDefault();
          insertCodeBlock();
          return;
      }
    }

    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      execCommand('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
      return;
    }

    // Call the original onKeyDown handler
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className={`rich-text-editor ${className}`} style={style}>
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button 
            type="button" 
            onClick={() => execCommand('bold')}
            title="Bold (Ctrl+B)"
            className="toolbar-btn"
          >
            <Bold size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => execCommand('italic')}
            title="Italic (Ctrl+I)"
            className="toolbar-btn"
          >
            <Italic size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => execCommand('underline')}
            title="Underline (Ctrl+U)"
            className="toolbar-btn"
          >
            <Underline size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => execCommand('strikeThrough')}
            title="Strikethrough"
            className="toolbar-btn"
          >
            <Strikethrough size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button 
            type="button" 
            onClick={() => insertHeading(1)}
            title="Heading 1 (Ctrl+1)"
            className="toolbar-btn"
          >
            <Heading1 size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => insertHeading(2)}
            title="Heading 2 (Ctrl+2)"
            className="toolbar-btn"
          >
            <Heading2 size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button 
            type="button" 
            onClick={() => insertList(false)}
            title="Bullet List (Ctrl+L)"
            className="toolbar-btn"
          >
            <List size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => insertList(true)}
            title="Numbered List (Ctrl+Shift+L)"
            className="toolbar-btn"
          >
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button 
            type="button" 
            onClick={() => insertCodeBlock()}
            title="Code Block (Ctrl+`)"
            className="toolbar-btn"
          >
            <Code size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => insertQuote()}
            title="Quote (Ctrl+Q)"
            className="toolbar-btn"
          >
            <Quote size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button 
            type="button" 
            onClick={() => setIsLinkModalOpen(true)}
            title="Insert Link (Ctrl+K)"
            className="toolbar-btn"
          >
            <Link size={16} />
          </button>
          
          <div className="color-picker-container">
            <button 
              type="button" 
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Text Color"
              className="toolbar-btn color-btn"
              style={{ backgroundColor: selectedColor }}
            >
              <Palette size={16} />
            </button>
            {showColorPicker && (
              <div className="color-picker">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="color-option"
                    style={{ backgroundColor: color }}
                    onClick={() => applyColor(color)}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className="editor-content"
        contentEditable
        suppressContentEditableWarning
        placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
      />

      {/* Link Modal */}
      {isLinkModalOpen && (
        <div className="link-modal-overlay" onClick={() => setIsLinkModalOpen(false)}>
          <div className="link-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Insert Link</h3>
            <div className="link-input-group">
              <label>Text:</label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Link text"
              />
            </div>
            <div className="link-input-group">
              <label>URL:</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="link-modal-actions">
              <button onClick={insertLink} className="insert-link-btn">
                Insert Link
              </button>
              <button onClick={() => setIsLinkModalOpen(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
