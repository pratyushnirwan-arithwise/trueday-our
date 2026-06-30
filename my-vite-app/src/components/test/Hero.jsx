import React, { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import FloatingElements from './FloatingElements';
import './Hero.css';

// Hero section component with parallax scrolling effects
const Hero = () => {
  const heroRef = useRef(null);
  const contentRef = useRef(null);

  // Add scroll effects to hero section
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current || !contentRef.current) return;
      
      const scrollY = window.scrollY;
      const opacity = Math.max(1 - scrollY / 500, 0);
      const translateY = scrollY * 0.5;
      
      // Apply styles based on scroll position
      contentRef.current.style.opacity = opacity;
      contentRef.current.style.transform = `translateY(${translateY}px)`;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="hero" ref={heroRef} id="home">
      <FloatingElements />
      
      <div className="hero-content" ref={contentRef}>
        <h1 className="hero-title">
          Your Central Hub for <span className="text-gradient">Everything</span>
        </h1>
        
        <p className="hero-subtitle">
          A seamless platform that connects all your tools, features, and workflows 
          in one intuitive interface. Discover a new way to manage your digital ecosystem.
        </p>
        
        <div className="hero-cta">
          <a href="#features" className="button-primary">
            Get Started
            <ArrowRight size={18} />
          </a>
        </div>
        
        <div className="hero-image-container">
          <div className="hero-image">
            <span className="hero-image-label">Product interface</span>
            {/* Image would be displayed here in a real implementation */}
            <div className="dashboard-mockup"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;