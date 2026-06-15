import React from 'react';
import './FloatingElements.css';

// Component that renders floating elements for visual interest
const FloatingElements = () => {
  // Generate a random float between min and max
  const randomFloat = (min, max) => {
    return Math.random() * (max - min) + min;
  };

  // Generate bubbles with random properties
  const generateBubbles = (count) => {
    const bubbles = [];
    
    for (let i = 0; i < count; i++) {
      const size = randomFloat(20, 100);
      const left = randomFloat(5, 95);
      const animationDuration = randomFloat(15, 40);
      const delay = randomFloat(0, 20);
      const opacity = randomFloat(0.05, 0.3);
      
      bubbles.push({ size, left, animationDuration, delay, opacity });
    }
    
    return bubbles;
  };

  // Generate 15 bubbles for the background
  const bubbles = generateBubbles(15);

  return (
    <div className="floating-elements">
      {/* Gradient background overlay */}
      <div className="gradient-overlay"></div>
      
      {/* Floating bubbles */}
      {bubbles.map((bubble, index) => (
        <div 
          key={index}
          className="bubble"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.left}%`,
            animationDuration: `${bubble.animationDuration}s`,
            animationDelay: `${bubble.delay}s`,
            opacity: bubble.opacity
          }}
        ></div>
      ))}
      
      {/* Decorative shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>
    </div>
  );
};

export default FloatingElements;