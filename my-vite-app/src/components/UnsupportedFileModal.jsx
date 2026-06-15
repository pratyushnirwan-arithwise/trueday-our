import React from 'react';
import './UnsupportedFileModal.css';

const UnsupportedFileModal = ({ message, onClose }) => {
  return (
    <div className="unsupported-file-overlay">
      <div className="unsupported-file-modal">
        <div className="modal-header">
          <h2>Unsupported File Type</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p>{message}</p>
          <div className="supported-files">
            <p><strong>Supported file types:</strong></p>
            <p>Images: JPEG, PNG, GIF</p>
            <p>Documents: PDF, DOC, DOCX</p>
            <p>Spreadsheets: XLS, XLSX</p>
            <p>Text files: TXT</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default UnsupportedFileModal;
