import React, { useEffect, useRef } from 'react';
import { TicketIcon, BarChart3Icon, CalendarIcon, MessageSquareIcon } from 'lucide-react';
import './Features.css';

const Features = () => {
  const featuresRef = useRef(null);
  const featureItems = useRef([]);

  useEffect(() => {
    featureItems.current = featureItems.current.slice(0, 4);
  }, []);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
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
    
    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }
    
    featureItems.current.forEach(item => {
      if (item) {
        observer.observe(item);
      }
    });

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: TicketIcon,
      title: 'Smart Ticketing System',
      description: 'Streamline your support workflow with AI-powered ticket routing, priority management, and automated responses.'
    },
    {
      icon: BarChart3Icon,
      title: 'Progress Analytics',
      description: 'Track team performance, ticket resolution times, and customer satisfaction with real-time dashboards.'
    },
    {
      icon: CalendarIcon,
      title: 'Task Scheduling',
      description: 'Efficiently manage workload with smart task distribution and deadline tracking features.'
    },
    {
      icon: MessageSquareIcon,
      title: 'Team Collaboration',
      description: 'Keep everyone in sync with integrated messaging, ticket comments, and status updates.'
    }
  ];

  return (
    <section className="features-section section" id="features" ref={featuresRef}>
      <div className="container">
        <div className="features-header">
          <h2 className="section-title">Powerful Features for Your Team</h2>
          <p className="section-subtitle">
            Transform your customer support and team productivity with our comprehensive ticketing solution.
          </p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div 
              key={index}
              ref={el => featureItems.current[index] = el}
              className="feature-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="feature-icon">
                <feature.icon size={24} />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;