import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import './Navbar.css';

// Navigation component with scroll behavior
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll effect for navbar background
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled]);

  // Smooth scroll to section when clicking on nav links
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: 'smooth'
      });
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-logo">
          <span className="logo-text">Trueday</span>
        </div>
        
        {/* Desktop navigation links */}
        <div className="navbar-links">
          <a onClick={() => scrollToSection('features')} className="nav-link">
            Features
          </a>
          <a onClick={() => scrollToSection('how-it-works')} className="nav-link">
            How it Works
          </a>
          <a onClick={() => scrollToSection('contact')} className="nav-link">
            Contact Us
          </a>
        </div>
        
        <div className="navbar-actions">
          <a href="#" className="nav-link sign-in">
            Sign In
          </a>
          <a href="#" className="button-primary">
            Get Started
            <ArrowRight size={16} />
          </a>
        </div>

        {/* Mobile menu toggle */}
        <div 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <div className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'active' : ''}`}>
        <a onClick={() => scrollToSection('features')} className="mobile-link">
          Features
        </a>
        <a onClick={() => scrollToSection('how-it-works')} className="mobile-link">
          How it Works
        </a>
        <a onClick={() => scrollToSection('contact')} className="mobile-link">
          Contact Us
        </a>
        <a href="#" className="mobile-link">
          Sign In
        </a>
        <a href="#" className="button-primary mobile-button">
          Get Started
          <ArrowRight size={16} />
        </a>
      </div>
    </nav>
  );
};

export default Navbar;