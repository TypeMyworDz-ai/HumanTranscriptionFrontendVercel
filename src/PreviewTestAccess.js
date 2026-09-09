import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './PreviewTestAccess.css';

const DEMO_USERS = {
  admin: {
    id: 'preview-admin',
    email: 'admin-preview@typemywordz.ai',
    full_name: 'Preview Administrator',
    user_type: 'admin'
  },
  client: {
    id: 'preview-client',
    email: 'client-preview@typemywordz.ai',
    full_name: 'Preview Client',
    user_type: 'client',
    client_average_rating: 5
  },
  worker: {
    id: 'preview-worker',
    email: 'worker-preview@typemywordz.ai',
    full_name: 'Preview Worker',
    user_type: 'transcriber',
    transcriber_status: 'active_transcriber',
    transcriber_user_level: 'proofreader',
    transcriber_average_rating: 5
  },
  trainee: {
    id: 'preview-trainee',
    email: 'trainee-preview@typemywordz.ai',
    full_name: 'Preview Trainee',
    user_type: 'trainee',
    transcriber_status: 'paid_training_fee'
  }
};

const PreviewTestAccess = () => {
  const navigate = useNavigate();

  const enterDemo = useCallback((role) => {
    localStorage.setItem('token', `preview-demo-token-${role}`);
    localStorage.setItem('user', JSON.stringify(DEMO_USERS[role]));
    const routes = {
      admin: '/admin-dashboard',
      client: '/client-dashboard',
      worker: '/transcriber-dashboard',
      trainee: '/trainee-dashboard'
    };
    navigate(routes[role], { replace: true });
    window.location.reload();
  }, [navigate]);

  if (process.env.REACT_APP_PREVIEW_DEMO_MODE !== 'true') {
    return <div className="tm-preview-disabled"><Link to="/">Back to home</Link></div>;
  }

  return (
    <div className="tm-preview-access">
      <header className="tm-preview-access-header">
        <Link to="/" className="tm-preview-brand"><b className="tm-brand-purple">Type</b><b className="tm-brand-green">My</b><b className="tm-brand-purple">worDz</b><small>Preview access</small></Link>
        <Link to="/" className="tm-preview-back">Back to landing page</Link>
      </header>
      <main className="tm-preview-access-main">
        <span className="tm-suite-eyebrow">PRIVATE PREVIEW</span>
        <h1>Test each workspace.</h1>
        <p>These buttons use preview-only identities so you can review the layouts without creating live accounts or changing production data.</p>
        <div className="tm-preview-role-grid">
          <button onClick={() => enterDemo('admin')}><span>ADMIN</span><strong>Open admin console <b>→</b></strong><small>Platform overview, queues and management tools.</small></button>
          <button onClick={() => enterDemo('client')}><span>CLIENT</span><strong>Open client workspace <b>→</b></strong><small>Projects, quotes, jobs, messages and payments.</small></button>
          <button onClick={() => enterDemo('worker')}><span>WORKER</span><strong>Open worker workspace <b>→</b></strong><small>Offers, active work, earnings and profile.</small></button>
          <button onClick={() => enterDemo('trainee')}><span>TRAINEE</span><strong>Open training workspace <b>→</b></strong><small>Training room, materials and progress status.</small></button>
        </div>
        <div className="tm-preview-safety-note"><strong>Preview only.</strong> API-backed counts may show as empty because these identities are not real users. The purpose is to review the navigation, layout and responsive design safely.</div>
      </main>
    </div>
  );
};

export default PreviewTestAccess;
