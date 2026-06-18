import React from "react";
import "./LoadingScreen.css";

const LoadingScreen = ({ continueLoading }) => {
  return (
    <div className="tls-container">
      <div className="tls-gif-wrapper">
        <img src="/check.gif" alt="Loading..." className="tls-gif" />
      </div>
      {continueLoading && (
        <div className="tls-error-text">
          Connecting to secure server... Please check your network connection.
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
