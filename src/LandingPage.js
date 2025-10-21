import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleWorkerRegister = () => {
    navigate('/worker-register');
  };

  const handleClientRegister = () => {
    navigate('/client-register');
  };

  // NEW: Handler for Trainee Registration
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
            <img src="/logo192.png" alt="TypeMyworDz Logo" className="header-logo" /> {/* Use the big logo */}
            <span className="logo-text">TypeMyworDz</span>
          </div>
          <button onClick={handleLogin} className="login-btn">
            Login
          </button>
        </div>
      </div>
      
      {/* Main Header Section */}
      <header className="landing-header">
        <h1>TypeMyworDz Human Transcription</h1>
        <p>Your Marketplace for Quality Transcription Services in Kenya</p>
      </header>

      {/* Main Action Section - UPDATED for three registration options */}
      <section className="action-section">
        <h2>I want to:</h2>
        
        <div className="action-cards">
          {/* NEW: Trainee Registration Card */}
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

      {/* Company Info Section - Updated Content and Structure */}
      <section className="company-info">
        <div className="info-content">
          <div className="info-text">
            {/* The main section title is here */}
            <h2 className="section-title">Why Choose TypeMyworDz Marketplace?</h2>
            
            {/* New section for the benefits list and the intro text below the main heading */}
            <div className="benefits-and-intro">
                <p className="intro-paragraph">
                  We connect clients with a diverse pool of vetted Kenyan transcribers, 
                  offering transparent negotiation, fair pricing, and reliable service. 
                  Experience high-quality transcription tailored to your needs.
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
              {/* Replaced SVG with emoji for simplicity */}
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
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
