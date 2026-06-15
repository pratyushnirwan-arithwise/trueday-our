import React from 'react';
import './Footer.css';

// Footer component
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="footer-logo">Trueday</div>
              <p className="footer-tagline">
                Your central hub for everything. Simplify workflows, boost productivity.
              </p>
            </div>
            
            <div className="footer-links">
              <div className="footer-links-column">
                <h3 className="footer-links-title">Product</h3>
                <ul className="footer-links-list">
                  <li><a href="#features">Features</a></li>
                  <li><a href="#how-it-works">How It Works</a></li>
                  <li><a href="#">Pricing</a></li>
                  <li><a href="#">Roadmap</a></li>
                </ul>
              </div>
              
              <div className="footer-links-column">
                <h3 className="footer-links-title">Company</h3>
                <ul className="footer-links-list">
                  <li><a href="#">About Us</a></li>
                  <li><a href="#">Careers</a></li>
                  <li><a href="#">Blog</a></li>
                  <li><a href="#contact">Contact</a></li>
                </ul>
              </div>
              
              <div className="footer-links-column">
                <h3 className="footer-links-title">Resources</h3>
                <ul className="footer-links-list">
                  <li><a href="#">Support</a></li>
                  <li><a href="#">Documentation</a></li>
                  <li><a href="#">Privacy Policy</a></li>
                  <li><a href="#">Terms of Service</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <div className="copyright">
              &copy; {currentYear} Trueday. All rights reserved.
            </div>
            <div className="social-links">
              <a href="#" className="social-link">Twitter</a>
              <a href="#" className="social-link">LinkedIn</a>
              <a href="#" className="social-link">Facebook</a>
              <a href="#" className="social-link">Instagram</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;