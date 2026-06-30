import React from 'react';
import './AccessDeniedModal.css'; // Will create this CSS file

const AccessDeniedModal = ({ message, onClose }) => {
  return (
    <div className="access-denied-overlay">
      <div className="access-denied-modal">
        <div className="modal-header">
          <h2>Access Denied</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedModal; 