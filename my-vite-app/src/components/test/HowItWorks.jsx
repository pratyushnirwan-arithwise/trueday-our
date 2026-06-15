import React, { useEffect, useRef } from 'react';
import './HowItWorks.css';

const HowItWorks = () => {
  const sectionRef = useRef(null);
  const stepsRef = useRef([]);

  useEffect(() => {
    stepsRef.current = stepsRef.current.slice(0, 4);
  }, []);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    const handleIntersect = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    
    stepsRef.current.forEach(step => {
      if (step) {
        observer.observe(step);
      }
    });

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      number: '01',
      title: 'Create Tickets',
      description: 'Quickly create and categorize support tickets with our intuitive interface. Set priorities, assign teams, and track progress in real-time.'
    },
    {
      number: '02',
      title: 'Track Progress',
      description: 'Monitor ticket status, response times, and team performance with comprehensive analytics and visual progress indicators.'
    },
    {
      number: '03',
      title: 'Collaborate',
      description: 'Work together seamlessly with integrated team chat, ticket comments, and automated notifications to keep everyone aligned.'
    },
    {
      number: '04',
      title: 'Resolve & Learn',
      description: 'Close tickets efficiently and build a knowledge base from resolved issues to improve future response times.'
    }
  ];

  return (
    <section className="how-it-works-section section" id="how-it-works" ref={sectionRef}>
      <div className="container">
        <div className="how-it-works-header">
          <h2 className="section-title">Simple Yet Powerful Workflow</h2>
          <p className="section-subtitle">
            Our streamlined process helps you manage support tickets efficiently and boost team productivity.
          </p>
        </div>
        
        <div className="steps-container">
          {steps.map((step, index) => (
            <div 
              key={index}
              ref={el => stepsRef.current[index] = el}
              className="step-card"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <div className="step-number">{step.number}</div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            </div>
          ))}
          
          <div className="progress-line"></div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;