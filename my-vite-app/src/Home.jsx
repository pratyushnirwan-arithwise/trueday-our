import React, { useEffect, useRef, useState } from 'react';
import { Mail, Send, LayoutDashboard, Users, Phone,MapPin ,Ticket, BarChart3, Calendar, MessageSquare, FileText, Settings, Menu, X, Github, Twitter, Linkedin, Instagram } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import { motion } from "framer-motion";


const Home = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const contactRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrame = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      
      const elements = [heroRef, featuresRef, contactRef];
      elements.forEach(ref => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.75) {
            ref.current.classList.add('visible');
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    initCanvas();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = Array.from({ length: 100 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: Math.random() * 1 - 0.5,
        speedY: Math.random() * 1 - 0.5,
        opacity: Math.random() * 0.5 + 0.3
      }));
    };

    const drawParticle = (particle) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(247, 170, 77, ${particle.opacity})`;
      ctx.fill();
    };

    const drawConnections = (particle, particles) => {
      particles.forEach(otherParticle => {
        const dx = particle.x - otherParticle.x;
        const dy = particle.y - otherParticle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 150) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(247, 170, 77, ${0.15 * (1 - distance / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(otherParticle.x, otherParticle.y);
          ctx.stroke();
        }
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(particle => {
        // Update particle position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Wrap particles around screen edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
        
        // Draw connections first (behind particles)
        drawConnections(particle, particles);
      });

      // Draw particles on top of connections
      particles.forEach(particle => {
        drawParticle(particle);
      });
      
      animationFrame.current = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    animate();

    return () => window.removeEventListener('resize', resize);
  };

  const features = [
    {
      icon: <LayoutDashboard size={28} />,
      title: "Dashboard",
      description: "Get a bird's-eye view of your entire operation with customizable widgets and real-time data visualization."
    },
    {
      icon: <Ticket size={28} />,
      title: "Ticketing System",
      description: "Streamline support with our advanced ticketing system featuring automated routing and priority management."
    },
    {
      icon: <BarChart3 size={28} />,
      title: "Analytics",
      description: "Make data-driven decisions with powerful analytics tools that transform complex data into actionable insights."
    },
    {
      icon: <Calendar size={28} />,
      title: "Scheduling",
      description: "Plan and organize with our intuitive calendar interface featuring drag-and-drop functionality and team sync."
    },
    {
      icon: <MessageSquare size={28} />,
      title: "Messaging",
      description: "Collaborate effectively with integrated messaging that keeps all communications in one searchable place."
    },
    {
      icon: <Settings size={28} />,
      title: "Settings",
      description: "Tailor the platform to your needs with extensive customization options and integration capabilities."
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setTimeout(() => {
      setFormSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
    }, 600);
  };

  const handleGetStarted = () => {
    const params = new URLSearchParams(window.location.search);
    const sessionid = params.get('sessionid');
    if (sessionid) {
      navigate(`/dashboard?sessionid=${sessionid}`);
    } else {
      navigate('/dashboard');
    }
  };


  const cardVariants = {
    offscreen: (index) => ({
      opacity: 0,
      x: index % 2 === 0 ? -50 : 50, // Alternate directions
    }),
    onscreen: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        bounce: 0.4,
        duration: 0.8
      }
    }
  };


  // Text to animate
  const descriptionText = "A seamless platform that connects all your tools, features, and workflows in one interface. Discover a new way to manage your digital ecosystem.";
  const letters = Array.from(descriptionText);
  

  return (
    <div className={styles.landingPage}>
      <canvas ref={canvasRef} className={styles.backgroundCanvas} />
      
      <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.headerContainer}>
  <div className={styles.logoTitleContainer}>
    {/* <h1>TrueDay</h1> */}
          <nav className={`${styles.navMenu} ${isMobileMenuOpen ? styles.open : ''}`}>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#contact">Contact Us</a></li>
              {/* <li><a href="/login" className={styles.signInBtn}>Sign In</a></li> */}
            </ul>
          </nav>
          <button className={styles.mobileMenuToggle} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        </div>
      </header>

      <main>
        {/* <section className={`${styles.hero} ${styles.visible}`} ref={heroRef}>
        <motion.div
    className={styles.heroContent}
    initial={{ opacity: 0, y: -100 }}  // Starts hidden above
    whileInView={{ opacity: 1, y: 0 }} // Animates when in viewport
    viewport={{ once: false }} // Triggers every time element enters view
    transition={{ 
      type: "spring",
      damping: 10,
      stiffness: 100,
      delay: 0.2
    }}
  >
    <h2>Your Central Hub for Everything</h2>
  <p>A seamless platform that connects all your tools, features, and workflows in one intuitive interface. Discover a new way to manage your digital ecosystem.</p>
            <button className={styles.ctaButton} onClick={handleGetStarted}>Get Started</button> */}<section className={`${styles.hero} ${styles.visible}`} ref={heroRef}>
      <motion.div
        className={styles.heroContent}
        initial={{ opacity: 0, y: -100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false }}
        transition={{ 
          type: "spring",
          damping: 10,
          stiffness: 100,
          delay: 0.2
        }}
      >
        <h2>Your Central Hub for Everything</h2>
        
        <motion.p
          className={styles.heroDescription}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-20% 0px -20% 0px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { 
                staggerChildren: 0.03,
                delayChildren: 0.2
              }
            }
          }}
        >
          {letters.map((letter, index) => (
            <motion.span 
              key={index}
              variants={{
                hidden: {
                  opacity: 0,
                  x: Math.random() > 0.5 ? -20 : 20,
                  y: Math.random() > 0.5 ? -10 : 10
                },
                visible: {
                  opacity: 1,
                  x: 0,
                  y: 0,
                  transition: {
                    type: "spring",
                    damping: 12,
                    stiffness: 100
                  }
                }
              }}
              style={{ display: 'inline-block' }}
            >
              {letter === " " ? "\u00A0" : letter}
            </motion.span>
          ))}
        </motion.p>
        
        <motion.button
          className={styles.ctaButton}
          onClick={handleGetStarted}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false }}
          transition={{ 
            delay: 0.5,
            type: "spring",
            stiffness: 200
          }}
        >
          Get Started
        </motion.button>
          </motion.div>
        </section>

        <section className={`${styles.features} ${styles.visible}`} id="features" ref={featuresRef}>
          <h2>Everything You Need in One Place</h2>
          <p>Our platform seamlessly connects all your essential tools and features, creating a unified experience that boosts productivity and simplifies workflows.</p>
          
          <div  className={styles.featuresGrid}>
      {features.map((feature, index) => (
        <motion.div
          key={index}
          className={styles.featureCard}
          data-testid="feature-card"
          custom={index}
          initial="offscreen"
          whileInView="onscreen"
          viewport={{ 
            once: false, // Changed to false to trigger every time
            margin: "-50px",
            amount: 0.2 // Trigger when 20% of element is visible
          }}
          variants={cardVariants}
        >
          <div className={styles.featureIcon}>{feature.icon}</div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </motion.div>
      ))}
          </div>
        </section>

        <section className={`${styles.contact} ${styles.visible}`} id="contact" ref={contactRef}>
  <div className={styles.contactContainer}>
    {/* Left side - Get in Touch content */}
    <div className={styles.contactContent}>
      <div className={styles.contactIcon}>
        <Mail size={36} />
      </div>
      <h2>Get in Touch</h2>
      <p>Have questions or want to learn more? We'd love to hear from you. Reach out and our team will respond as soon as possible.</p>
    </div>
    
    {/* Right side - Form container */}
    <div className={styles.contactFormContainer}>
      {formSubmitted ? (
        <div className={styles.formSuccess}>
          <h3>Thank you for your message!</h3>
          <p>We'll get back to you shortly.</p>
          <button onClick={() => setFormSubmitted(false)}>Send another message</button>
        </div>
      ) : (
        <form className={styles.contactForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Name</label>
            <input 
              type="text" 
              id="name" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required 
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required 
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="message">Message</label>
            <textarea 
              id="message" 
              rows="5"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              required
            ></textarea>
          </div>
          
          <button type="submit" className={styles.submitBtn}>
            <span>Send Message</span>
            <Send size={18} />
          </button>
        </form>
      )}
    </div>
  </div>
</section>
      </main>

      <footer className={styles.footer}>
  <div className={styles.footerContent}>
    <div className={styles.footerLogo}>
      <h2>TrueDay</h2>
      <p>Empowering businesses with efficient solutions</p>
    </div>
    
    <div className={styles.footerLinks}>
      <div className={styles.footerColumn}>
        <h3>Quick Links</h3>
        <ul>
        <li><a href="#features">Features</a></li>
        <li><a href="#contact">Contact Us</a></li>
         
        </ul>
      </div>
      
      <div className={styles.footerColumn}>
        <h3>Contact Us</h3>
        <div className={styles.contactDetails}>
          <div className={styles.contactItem}>
            <Mail className={styles.contactIcon} />
            <div>
              <a href="mailto:info@arithwise.com">info@arithwise.com</a><br />
              <a href="mailto:career@arithwise.com">career@arithwise.com</a>
            </div>
          </div>
          <div className={styles.contactItem}>
            <Phone className={styles.contactIcon} />
            <a href="tel:+919987020905">+91-9987020905</a>
          </div>
          <div className={styles.contactItem}>
            <MapPin className={styles.contactIcon} />
            <a 
              href="https://maps.google.com/?q=ArithWise+Solutions+Pvt+Ltd,+Plexwork,+N+B+Tower,+Jai+Hind+Society,+Manish+Nagar,+NAGPUR+-+440015" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              1st floor, 'Plexwork', N B Tower,<br />
              Jai Hind Society, Manish Nagar,<br />
              NAGPUR - 440015
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div className={styles.footerBottom}>
    <p>&copy; {new Date().getFullYear()} TrueDay. All rights reserved.</p>
    <p>A product of ArithWise Solutions Pvt Ltd</p>
  </div>
</footer>
    </div>
  );
};

export default Home;


