import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Send, Menu, X, MessageSquare } from "lucide-react";
import "./Contact.css";

const Contact = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [id]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/contact/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }
  
      const data = await response.json();
      alert("Message sent successfully!");
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('Error details:', error);
      alert(error.message || "Failed to send message. Please try again.");
    }
  };
  
  return (
    <div className="contact-container">
      {/* Background Elements */}
      <div className="contact-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="grid-overlay"></div>
      </div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <span className="brand-name" onClick={() => navigate('/')}>TrueDay</span>
        </div>
        
        <div className={`nav-center ${isMenuOpen ? 'active' : ''}`}>
          <a href="/features">Features</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </div>

        <div 
          className={`hamburger ${isMenuOpen ? 'active' : ''}`} 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </div>
      </nav>

      {/* Main Content */}
      <div className="contact-wrapper">
        <div className="contact-header">
          <h1 className="contact-title">Contact Us</h1>
          <div className="title-decoration"></div>
        </div>
        
        <div className="contact-content">
          {/* Contact Information */}
          <div className="contact-info">
            <div className="section-header">
              <MessageSquare className="section-icon" />
              <h2 className="contact-subtitle">Get in Touch</h2>
            </div>
            <p className="contact-description">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
            
            <div className="contact-details">
              <div className="contact-item">
                <Mail className="contact-icon" />
                <span>support@arthiwise.com</span>
              </div>
              <div className="contact-item">
                <Phone className="contact-icon" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="contact-item">
                <MapPin className="contact-icon" />
                <span>Plexwork Space, Manish Nagar, Nagpur, Maharashtra</span>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input 
                type="text" 
                id="name"
                placeholder="Your Name" 
                required 
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input 
                type="email" 
                id="email"
                placeholder="Your Email" 
                required 
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <input 
                type="text" 
                id="subject"
                placeholder="Subject" 
                required 
                value={formData.subject}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea 
                id="message"
                placeholder="Your Message" 
                rows="5" 
                required
                value={formData.message}
                onChange={handleChange}
              ></textarea>
            </div>
            <button type="submit" className="submit-btn">
              <Send className="send-icon" />
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;