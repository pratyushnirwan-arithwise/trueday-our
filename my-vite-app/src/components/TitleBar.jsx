import React from 'react';
import '../styles/TitleBar.css';

const TitleBar = () => {
  const handleMinimize = () => {
    window.electron.minimize();
  };

  const handleMaximize = () => {
    window.electron.maximize();
  };

  const handleClose = () => {
    window.electron.close();
  };

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region"></div>
      <div className="title-bar-controls">
        <button className="title-bar-button" onClick={handleMinimize}>
          <span>─</span>
        </button>
        <button className="title-bar-button" onClick={handleMaximize}>
          <span>□</span>
        </button>
        <button className="title-bar-button close" onClick={handleClose}>
          <span>×</span>
        </button>
      </div>
    </div>
  );
};

export default TitleBar; 