import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle, Menu, X } from "lucide-react";
import "./About.css";

const About = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleGetStarted = () => {
    navigate('/DashBoard');
  };

  return (
    <div className="about-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <span className="brand-name" onClick={() => navigate('/')}>TrueDay</span>
        </div>
        
        <div className={`nav-center ${isMenuOpen ? 'active' : ''}`}>
          <Link to="/features" className="nav-link">Features</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </div>

        {/* <div className="nav-right">
          <button className="nav-login-btn" onClick={() => navigate('/login')}>
            Login
          </button>
        </div> */}

        <div 
          className={`hamburger ${isMenuOpen ? 'active' : ''}`} 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </div>
      </nav>

      {/* Main Content */}
      <div className="about-wrapper">
        <h1 className="about-title">About TrueDay</h1>
        
        <p className="about-description">
          TrueDay is a comprehensive ticket management system designed to streamline 
          your customer support and team collaboration processes.
        </p>

        <div className="about-section">
          <h2 className="about-subtitle">Our Mission</h2>
          <p className="about-description">
            To provide businesses with powerful, intuitive tools that transform 
            their customer support operations and enhance team productivity.
          </p>
        </div>

        <div className="about-section">
          <h2 className="about-subtitle">Why Choose Us</h2>
          <ul className="about-list">
            <li className="about-list-item">
              <CheckCircle className="about-icon" />
              <span>Streamlined ticket management process</span>
            </li>
            <li className="about-list-item">
              <CheckCircle className="about-icon" />
              <span>Real-time collaboration features</span>
            </li>
            <li className="about-list-item">
              <CheckCircle className="about-icon" />
              <span>Comprehensive analytics and reporting</span>
            </li>
            <li className="about-list-item">
              <CheckCircle className="about-icon" />
              <span>Customizable workflows and automation</span>
            </li>
          </ul>
        </div>

        <div className="about-section">
          <h2 className="about-subtitle">Our Values</h2>
          <div className="about-grid">
            <div className="about-card">
              <h3>Innovation</h3>
              <p>Continuously evolving our solutions to meet modern challenges</p>
            </div>
            <div className="about-card">
              <h3>Reliability</h3>
              <p>Providing stable and secure services you can count on</p>
            </div>
            <div className="about-card">
              <h3>Customer Focus</h3>
              <p>Putting our customers' needs at the heart of everything we do</p>
            </div>
            <div className="about-card">
              <h3>Excellence</h3>
              <p>Striving for the highest quality in all our services</p>
            </div>
          </div>
        </div>

        <div className="about-section">
          <h2 className="about-subtitle">Our Team</h2>
          <p className="about-description">
            We are a dedicated team of professionals committed to delivering 
            exceptional service and innovative solutions to our clients.
          </p>
        </div>

        {/* Footer */}
        <footer className="about-footer">
          <div className="footer-content">
            <p>&copy; 2024 TrueDay. All rights reserved.</p>
            <div className="footer-links">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default About;