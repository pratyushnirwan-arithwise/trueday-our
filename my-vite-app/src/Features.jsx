import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle, Menu, X } from "lucide-react";
import "./Features.css";

const features = [
  {
    title: "Task Creation",
    description: "Easily create and assign tasks to team members with due dates and priorities."
  },
  {
    title: "Real-time Tracking",
    description: "Monitor task progress in real-time with status updates and notifications."
  },
  {
    title: "Collaboration Tools",
    description: "Comment on tasks, share files, and communicate seamlessly within the platform."
  },
  {
    title: "Analytics & Reports",
    description: "Generate insightful reports to track productivity and project completion rates."
  },
  {
    title: "Custom Workflows",
    description: "Automate processes with customizable workflows tailored to your team's needs."
  },
  {
    title: "Integration Support",
    description: "Seamlessly connect with popular tools and services for enhanced productivity."
  }
];

const Features = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="features-container">
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
      <div className="features-wrapper">
        <h2 className="features-title">Key Features</h2>
        
        <div className="features-list">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="feature-card"
              style={{ '--order': index }}
            >
              <div className="feature-icon-wrapper">
                <CheckCircle className="feature-icon" />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Features;