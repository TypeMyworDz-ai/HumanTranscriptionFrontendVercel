import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleWorkerRegister = () => {
    navigate('/worker-register');
  };

  const handleClientRegister = () => {
    navigate('/client-register');
  };

  // Handler for Trainee Registration
  const handleTraineeRegister = () => {
    navigate('/trainee-register');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <div className="landing-page">
      {/* Top Navigation Bar with Logo and Login */}
      <div className="top-bar-wrapper">
        <div className="top-nav">
          <div className="logo-section" onClick={handleLogoClick}>
            <img src="/logo192.png" alt="TypeMyworDz Logo" className="header-logo" />
            <span className="logo-text">TypeMyworDz</span>
          </div>
          
          <a href="https://typemywordz.ai" target="_blank" rel="noopener noreferrer" className="ai-link">
            Looking for AI transcripts, <span className="highlight">click here</span>
          </a>
          
          <button onClick={handleLogin} className="login-btn">
            Login
          </button>
        </div>
      </div>
      
      {/* Main Header Section */}
      <header className="landing-header">
        <img src="/an african transcribing.jpg" alt="Professional Transcriber" className="transcriber-image" />
        <div className="hero-content">
          <h1>TypeMyworDz Human Transcription</h1>
          <p>Your Marketplace for Quality Transcription Services in Kenya</p>
        </div>
      </header>

      {/* Rest of your component remains unchanged */}
      {/* Main Action Section */}
      <section className="action-section">
        <h2>I want to:</h2>
        
        <div className="action-cards">
          <div className="action-card trainee-card">
            <h3>Train</h3>
            <p>Become a TypeMyworDz-certified transcriber</p>
            <button onClick={handleTraineeRegister} className="register-btn train-btn">
              Register here
            </button>
          </div>

          <div className="action-card worker-card">
            <h3>Work</h3>
            <p>Join our team of professional transcribers</p>
            <button onClick={handleWorkerRegister} className="register-btn work-btn">
              Register here
            </button>
          </div>

          <div className="action-card client-card">
            <h3>Hire</h3>
            <p>Get your audio files transcribed by professionals</p>
            <button onClick={handleClientRegister} className="register-btn hire-btn">
              Register here
            </button>
          </div>
        </div>
      </section>

      {/* Company Info Section */}
      <section className="company-info">
        <div className="info-content">
          <div className="info-text">
            
            <div className="benefits-and-intro">
                <p className="intro-paragraph">
                  <strong style={{ color: 'red' }}>Why TypeMyworDz?</strong>
 
                </p>
                
                <ul className="benefits-list">
                  <li><span className="checkmark">✅</span> 
                      <div className="benefit-details">
                          <strong>Direct Negotiation</strong>
                          <span>Agree on price and deadline with transcribers.</span>
                      </div>
                  </li>
                  <li><span className="checkmark">✅</span> 
                      <div className="benefit-details">
                          <strong>Quality Vetted Transcribers</strong>
                          <span>Access skilled and tested professionals.</span>
                      </div>
                  </li>
                  <li><span className="checkmark">✅</span> 
                      <div className="benefit-details">
                          <strong>Secure Payments</strong>
                          <span>Funds held securely until job completion.</span>
                      </div>
                  </li>
                  <li><span className="checkmark">✅</span> 
                      <div className="benefit-details">
                          <strong>Transparent Ratings</strong>
                          <span>Hire based on performance and client feedback.</span>
                      </div>
                  </li>
                  <li><span className="checkmark">✅</span> 
                      <div className="benefit-details">
                          <strong>Local Focus</strong>
                          <span>Fair pricing and relevant services for the Kenyan market.</span>
                      </div>
                  </li>
                </ul>
            </div>
          </div>
          <div className="info-visual">
            <div className="visual-placeholder">
              <h3>🤝</h3> 
            </div>
          </div>
        </div>
      </section>

      {/* Footer Links */}
      <footer className="footer-links">
        <div className="links-container">
          <a href="#terms">Terms of Service</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#about">About Us</a>
          <a href="#contact">Contact</a>
          <Link to="/guidelines" target="_blank" rel="noopener noreferrer">Guidelines</Link>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
