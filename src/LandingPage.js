import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const go = (path) => navigate(path);

  return (
    <div className="tm-human-landing">
      <div className="tm-landing-nav-wrap">
        <nav className="tm-landing-nav" aria-label="Main navigation">
          <button className="tm-landing-brand" onClick={() => go('/')} aria-label="TypeMyworDz home">
            <img src="/logo192.png" alt="" />
            <span><b className="tm-brand-purple">Type</b><b className="tm-brand-green">My</b><b className="tm-brand-purple">worDz</b><small>Human transcription</small></span>
          </button>
          <div className="tm-landing-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#why-us">Why TypeMyworDz</a>
            <Link to="/guidelines">Guidelines</Link>
          </div>
          <button onClick={() => go('/login')} className="tm-landing-login">Log in</button>
        </nav>
      </div>

      <main>
        <section className="tm-landing-hero">
          <div className="tm-landing-hero-copy">
            <span className="tm-landing-kicker">A human ear for important words</span>
            <h1>Clear transcripts, made by people who listen.</h1>
            <p>Send your audio to a careful TypeMyworDz transcriber. Get a readable, useful transcript with a clear process from quote to delivery.</p>
            <div className="tm-landing-hero-actions">
              <button onClick={() => go('/client-register')} className="tm-landing-primary">Hire a transcriber <span>→</span></button>
              <button onClick={() => go('/worker-register')} className="tm-landing-secondary">Join as a worker</button>
            </div>
            <div className="tm-landing-proof"><span className="tm-proof-dot" /><span>Vetted people. Clear pricing. Local support.</span></div>
          </div>
          <div className="tm-landing-hero-visual">
            <div className="tm-landing-image-frame"><img src="/an african transcribing.jpg" alt="A TypeMyworDz transcriber working with audio" /></div>
            <div className="tm-landing-note tm-note-top"><strong>01</strong><span>Listen carefully</span></div>
            <div className="tm-landing-note tm-note-bottom"><strong>02</strong><span>Deliver clearly</span></div>
          </div>
        </section>

        <section className="tm-landing-strip" id="how-it-works">
          <div><span>01</span><strong>Choose your path</strong><p>Hire a transcriber, join the worker network or start your training.</p></div>
          <div><span>02</span><strong>Share the work</strong><p>Agree on scope, price and deadline before a job begins.</p></div>
          <div><span>03</span><strong>Receive the words</strong><p>Review your completed transcript and keep your project moving.</p></div>
        </section>

        <section className="tm-landing-services" id="why-us">
          <div className="tm-landing-section-intro"><span className="tm-landing-kicker">BUILT FOR REAL WORK</span><h2>A simpler way to work with transcription.</h2><p>TypeMyworDz keeps the human part visible while making the practical parts easier to manage.</p></div>
          <div className="tm-landing-service-grid">
            <article><span className="tm-service-index">A</span><h3>Vetted transcribers</h3><p>Work with people who have been tested for accuracy, consistency and care.</p></article>
            <article><span className="tm-service-index">B</span><h3>Direct communication</h3><p>Keep questions, deadlines and files close to the job instead of scattered across apps.</p></article>
            <article><span className="tm-service-index">C</span><h3>Made for every brief</h3><p>Legal, interviews, research, meetings and general audio all have a place here.</p></article>
          </div>
        </section>

        <section className="tm-landing-roles">
          <div><span className="tm-landing-kicker">START WHERE YOU ARE</span><h2>One marketplace, three ways forward.</h2><p>Whether you need the words, want to do the work or are preparing to join the network, there is a clear next step.</p></div>
          <div className="tm-role-list">
            <button onClick={() => go('/client-register')}><span>For clients</span><strong>Get audio transcribed <b>→</b></strong></button>
            <button onClick={() => go('/worker-register')}><span>For workers</span><strong>Find meaningful transcription work <b>→</b></strong></button>
            <button onClick={() => go('/trainee-register')}><span>For trainees</span><strong>Learn the TypeMyworDz standard <b>→</b></strong></button>
          </div>
        </section>
      </main>

      <footer className="tm-landing-footer">
        <div><span className="tm-footer-brand"><b className="tm-brand-purple">Type</b><b className="tm-brand-green">My</b><b className="tm-brand-purple">worDz</b></span><p>Human transcription for work that deserves attention.</p></div>
        <div className="tm-footer-links"><Link to="/guidelines">Guidelines</Link><a href="mailto:info@typemywordz.ai">Support</a><button onClick={() => go('/login')}>Log in</button></div>
      </footer>
    </div>
  );
};

export default LandingPage;
