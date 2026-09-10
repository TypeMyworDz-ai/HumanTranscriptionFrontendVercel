import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { hasSupabaseConfig, supabase } from './supabaseClient';
import { AuthProvider, useAuth } from './auth';
import { approveHumanOrder, approveHumanSubmission, claimHumanJob, createHumanOrder, listAdminQueue, listClientOrders, listOpenJobs, listSubmittedTranscripts, submitHumanTranscript } from './humanData';
import './App.css';

const jobs = [
  { id: 'TM-2048', title: 'Community health interview', length: '42 min', service: 'Standard', due: 'Tomorrow, 16:00', tags: ['Two speakers', 'Clean audio'] },
  { id: 'TM-2047', title: 'Board meeting recording', length: '68 min', service: 'Rush', due: 'Today, 20:00', tags: ['Four speakers', 'Timestamps'] },
  { id: 'TM-2046', title: 'Research focus group', length: '51 min', service: 'Difficult audio', due: 'Friday, 12:00', tags: ['Six speakers', 'Crosstalk'] },
];

const brand = <span className="brand"><span>Type</span><i>My</i><strong>worDz</strong></span>;

function calculatePreviewQuote({ durationMinutes, rush, difficulty, speakerCount, timestamps, currency }) {
  if (!durationMinutes) return null;
  const base = currency === 'KES' ? (rush ? 260 : 180) : (rush ? 4.5 : 3.25);
  const difficultyAdd = difficulty === 'difficult' ? (currency === 'KES' ? 55 : 0.85) : 0;
  const timestampAdd = timestamps ? (currency === 'KES' ? 25 : 0.4) : 0;
  const speakerAdd = Math.max(0, Number(speakerCount || 1) - 2) * (currency === 'KES' ? 18 : 0.3);
  const amount = durationMinutes * (base + difficultyAdd + timestampAdd + speakerAdd);
  return { amount: Number(amount.toFixed(2)), currency };
}

const demoWorkflowKey = 'tm-human-demo-workflow-v1';
const readDemoWorkflow = () => (typeof window === 'undefined' ? 'draft' : window.localStorage.getItem(demoWorkflowKey) || 'draft');
const writeDemoWorkflow = (status) => { if (typeof window !== 'undefined') window.localStorage.setItem(demoWorkflowKey, status); return status; };

function HumanSystem() {
  const location = useLocation();
  const { session, profile, ready } = useAuth();
  const isDemo = new URLSearchParams(location.search).get('demo') === '1';
  const isPortal = ['/client', '/worker', '/trainee', '/admin'].some((path) => location.pathname.startsWith(path));

  if (hasSupabaseConfig && !ready) return <SessionLoading />;
  if (isPortal && hasSupabaseConfig && !session && !isDemo) return <Login />;
  if (isPortal) return <PortalRouter session={session} profile={profile} demo={isDemo} />;
  return <PublicSite />;
}

function SessionLoading() {
  return <div className="session-loading"><div className="session-mark">T</div><p>Opening your workspace…</p></div>;
}

function PublicSite() {
  return (
    <div className="public-site">
      <header className="public-nav wrap">
        <Link to="/" aria-label="TypeMyworDz home">{brand}<small>HUMAN TRANSCRIPTION</small></Link>
        <nav>
          <a href="#process">How it works</a>
          <a href="#services">Services</a>
          <a href="#standards">Our standards</a>
          <Link to="/login" className="text-link">Sign in</Link>
          <Link to="/client/order" className="button button-dark">Start an order <span>↗</span></Link>
        </nav>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">Human transcription, properly managed</p>
            <h1>Words worth hearing twice, delivered once.</h1>
            <p className="hero-lede">Send us the recording. We manage the brief, the worker, the quality check and the final transcript, so you can get on with the work behind it.</p>
            <div className="hero-actions">
              <Link to="/client/order" className="button button-green">Order a transcript <span>→</span></Link>
              <a href="#process" className="button button-quiet">See the process</a>
            </div>
            <div className="hero-note"><span className="status-dot" /> Admin-reviewed delivery. No client-worker contact.</div>
          </div>
          <div className="hero-ledger" aria-label="Example job progress">
            <div className="ledger-top"><span>LIVE ORDER LEDGER</span><b>Private by design</b></div>
            <div className="ledger-line"><span className="ledger-marker green" /><div><small>01 · ORDER RECEIVED</small><strong>Interview with field team</strong><p>Requirements checked by Admin</p></div><em>09:42</em></div>
            <div className="ledger-line"><span className="ledger-marker purple" /><div><small>02 · OPEN TO WORKERS</small><strong>First eligible worker claims</strong><p>All instructions travel with the job</p></div><em>10:08</em></div>
            <div className="ledger-line muted"><span className="ledger-marker outline" /><div><small>03 · QUALITY REVIEW</small><strong>Admin makes it client-ready</strong><p>Corrections stay inside the workflow</p></div><em>—</em></div>
            <div className="ledger-foot">A controlled hand-off from audio to usable text.</div>
          </div>
        </section>

        <section className="statement wrap">
          <p className="eyebrow">The difference is the workflow</p>
          <h2>A human ear is only the beginning. The real value is what happens around it.</h2>
          <div className="statement-grid"><p>Every order arrives with a clear brief, a visible status and one accountable route to support.</p><p>Workers compete for open jobs, not for client relationships. Admin keeps quality, privacy and fairness in view.</p></div>
        </section>

        <section id="process" className="process-section wrap">
          <div className="section-heading"><p className="eyebrow">How an order moves</p><h2>No negotiation. No loose ends.</h2></div>
          <div className="process-grid">
            <ProcessStep number="01" title="You set the brief" body="Upload audio, choose timing and formatting needs, then review a clear quote before checkout." />
            <ProcessStep number="02" title="We open the job" body="Admin checks the order. Once approved, the complete brief appears to eligible workers." />
            <ProcessStep number="03" title="A worker claims it" body="The first eligible worker to claim the job gets the assignment and its deadline." />
            <ProcessStep number="04" title="Admin signs it off" body="The submission goes through quality review before it reaches your files." />
          </div>
        </section>

        <section id="services" className="services-section wrap">
          <div className="section-heading"><p className="eyebrow">What we handle</p><h2>Useful text from real voices.</h2></div>
          <div className="service-list">
            <Service name="General transcription" copy="Everyday recordings, notes, calls and conversations." />
            <Service name="Legal and compliance" copy="Careful formatting for proceedings, interviews and case work." />
            <Service name="Research and interviews" copy="Focus groups, field interviews and qualitative evidence." />
            <Service name="Meetings and panels" copy="Speaker-aware minutes with timestamps when the brief needs them." />
          </div>
        </section>

        <section id="standards" className="standards wrap">
          <div><p className="eyebrow">Our operating promise</p><h2>Private for clients. Fair for workers. Accountable to Admin.</h2></div>
          <ul><li>One support channel: you speak to TypeMyworDz, not a stranger assigned to your file.</li><li>One quality gate: no transcript becomes client-ready without review.</li><li>One shared editor: the improved TypeMyworDz editor follows the right role across the system.</li></ul>
        </section>
      </main>

      <footer className="public-footer wrap"><div>{brand}<small>HUMAN TRANSCRIPTION</small></div><div><Link to="/login">Sign in</Link><Link to="/client/order">Start an order</Link><a href="mailto:info@typemywordz.ai">Support</a></div><p>© 2026 TypeMyworDz. Human work, clearly managed.</p></footer>
    </div>
  );
}

function ProcessStep({ number, title, body }) { return <article className="process-step"><span>{number}</span><h3>{title}</h3><p>{body}</p></article>; }
function Service({ name, copy }) { return <article className="service-row"><h3>{name}</h3><p>{copy}</p><span>↗</span></article>; }

function PortalRouter({ session, profile, demo }) {
  const location = useLocation();
  const requestedRole = location.pathname.split('/')[1] || 'client';
  const actualRole = profile?.role || requestedRole;

  if (session && !demo && requestedRole !== actualRole) return <Navigate to={`/${actualRole}`} replace />;
  if (requestedRole === 'client') return <ClientPortal session={session} profile={profile} demo={demo} />;
  if (requestedRole === 'worker') return <WorkerPortal session={session} profile={profile} demo={demo} />;
  if (requestedRole === 'trainee') return <TraineePortal session={session} profile={profile} demo={demo} />;
  return <AdminPortal session={session} profile={profile} demo={demo} />;
}

function PortalShell({ role, title, subtitle, children, notice, aiCallout = false, session, profile, demo }) {
  const { signOut } = useAuth();
  const displayName = profile?.display_name || session?.user?.email?.split('@')[0] || 'Preview user';
  const nav = role === 'client'
    ? [['/client', 'Overview'], ['/client/order', 'New order'], ['/client/files', 'My files'], ['/client/payments', 'Payments'], ['/client/support', 'Support']]
    : role === 'worker'
      ? [['/worker', 'Work board'], ['/worker/active', 'My active work'], ['/worker/earnings', 'Earnings'], ['/worker/support', 'Admin support']]
      : role === 'trainee'
        ? [['/trainee', 'Training desk'], ['/trainee/practice', 'Practice work'], ['/trainee/progress', 'Progress'], ['/trainee/support', 'Admin support']]
        : [['/admin', 'Control room'], ['/admin/review', 'Quality review'], ['/admin/people', 'People'], ['/admin/support', 'Support desk'], ['/admin/finance', 'Finance']];

  return <div className="portal-shell">
    <aside className="portal-rail">
      <Link to="/" className="rail-brand">{brand}<small>HUMAN DESK</small></Link>
      <div className="rail-role"><span className="role-kicker">SIGNED IN AS</span><strong>{role}</strong><small className="rail-user">{displayName}</small></div>
      <nav className="rail-nav">{nav.map(([href, label]) => <NavLink key={href} to={href} end={href === `/${role}`}>{label}</NavLink>)}</nav>
      {aiCallout && <div className="ai-callout"><span>TypeMyworDz AI</span><strong>Turn your own backlog into a faster workflow.</strong><p>Transcribers can use our automated tools and Ask TypeMyworDz when they need them.</p><Link to="/worker/ai">Explore AI tools →</Link></div>}
      <div className="rail-account"><span>{session ? 'Account' : 'Demo workspace'}</span>{session ? <button type="button" onClick={signOut}>Sign out</button> : <span>Local preview</span>}</div>
      <Link to="/" className="rail-exit">← Public site</Link>
    </aside>
    <main className="portal-main">
      <div className="portal-topbar"><span>{session ? `Signed in as ${profile?.email || session.user?.email || displayName}` : 'Preview foundation · demo workspace'}</span><span className="topbar-status"><i /> {hasSupabaseConfig ? 'Database connected' : 'Database configuration pending'}</span></div>
      <section className="portal-heading"><div><p className="eyebrow">{role} workspace</p><h1>{title}</h1><p>{subtitle}</p></div><div className="portal-actions">{notice || <span className="quiet-chip">Admin-reviewed workflow</span>}</div></section>
      {children}
    </main>
  </div>;
}

function ClientPortal({ session, profile, demo }) {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [rush, setRush] = useState(false);
  const [serviceType, setServiceType] = useState('general');
  const [difficulty, setDifficulty] = useState('standard');
  const [speakerCount, setSpeakerCount] = useState(1);
  const [timestamps, setTimestamps] = useState(false);
  const [formattingNotes, setFormattingNotes] = useState('');
  const [saveState, setSaveState] = useState('');
  const [saving, setSaving] = useState(false);
  const [demoStatus, setDemoStatus] = useState(readDemoWorkflow);
  const [realOrders, setRealOrders] = useState([]);
  const [dataError, setDataError] = useState('');
  const isOrder = location.pathname.includes('/order');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const currency = profile?.country_code === 'KE' || !profile?.country_code || timeZone.startsWith('Africa/') ? 'KES' : 'USD';
  const quote = calculatePreviewQuote({ durationMinutes, rush, difficulty, speakerCount, timestamps, currency });

  useEffect(() => {
    if (demo || isOrder || !session || !profile) return;
    listClientOrders(profile.id).then(({ data, error }) => { if (error) setDataError(error.message); else setRealOrders(data || []); });
  }, [demo, isOrder, session, profile]);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    setFile(selected || null);
    setSaveState('');
    if (!selected) { setDurationMinutes(0); return; }
    const media = document.createElement(selected.type.startsWith('video/') ? 'video' : 'audio');
    media.preload = 'metadata';
    media.onloadedmetadata = () => { window.URL.revokeObjectURL(media.src); setDurationMinutes(Number.isFinite(media.duration) ? media.duration / 60 : 0); };
    media.onerror = () => setDurationMinutes(0);
    media.src = window.URL.createObjectURL(selected);
  };

  const saveDraft = async () => {
    if (!quote) { setSaveState('Choose a recording first so we can calculate an estimate.'); return; }
    if (!session || !profile || !supabase) {
      if (demo) setDemoStatus(writeDemoWorkflow('pending_admin_review'));
      setSaveState('Preview only: the order brief is ready and is now waiting for Admin review.');
      return;
    }
    setSaving(true); setSaveState(''); setDataError('');
    try {
      await createHumanOrder({ clientId: profile.id, file, durationMinutes, serviceType, rush, difficulty, speakerCount, timestamps, formattingNotes, quote });
      setSaveState('Order submitted to Admin review. No payment was taken in this preview release.');
      const refreshed = await listClientOrders(profile.id);
      setRealOrders(refreshed.data || []);
    } catch (error) { setSaveState(`Could not submit the order: ${error.message}`); }
    finally { setSaving(false); }
  };

  const realRows = realOrders.length ? realOrders.map((order) => <Row key={order.id} title={order.service_type.replace(/_/g, ' ')} meta={`${order.status.replace(/_/g, ' ')} · ${order.quote_currency} ${order.quote_amount || '—'}`} status={order.status.replace(/_/g, ' ')} tone={order.status === 'client_ready' || order.status === 'delivered' ? 'green' : 'purple'} />) : null;
  return <PortalShell role="client" title={isOrder ? 'Start a human transcript' : 'Your work, in one place'} subtitle={isOrder ? 'Tell us what good looks like. We will manage the rest.' : 'Orders, files, payments and support without a maze of hand-offs.'} notice={<Link to="/client/order" className="button button-green small">New order +</Link>} session={session} profile={profile} demo={demo}>
    {isOrder ? <section className="workspace-grid order-grid"><div className="form-card"><p className="eyebrow">01 · The recording</p><h2>Give the job a clear starting point.</h2><label className="upload-zone"><input type="file" accept="audio/*,video/*" onChange={handleFileChange} /><span className="upload-symbol">+</span><strong>{file?.name || 'Choose an audio or video file'}</strong><small>{file ? (durationMinutes ? `${durationMinutes.toFixed(1)} minutes detected · ready for estimate` : 'File selected · duration still loading') : 'MP3, WAV, M4A, MP4 and common formats'}</small></label><div className="form-row"><label>Service<select value={serviceType} onChange={(e) => setServiceType(e.target.value)}><option value="general">General transcription</option><option value="legal">Legal and compliance</option><option value="research">Research and interviews</option><option value="meeting">Meetings and panels</option></select></label><label>Speakers<select value={speakerCount} onChange={(e) => setSpeakerCount(e.target.value)}><option value="1">1 speaker</option><option value="2">2 speakers</option><option value="4">3–5 speakers</option><option value="6">6+ speakers</option></select></label></div><div className="form-row"><label>Audio difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="standard">Clear / standard</option><option value="difficult">Difficult audio</option></select></label><label>Delivery<select value={rush ? 'rush' : 'standard'} onChange={(e) => setRush(e.target.value === 'rush')}><option value="standard">Standard</option><option value="rush">Rush</option></select></label></div><label className="check-row"><input type="checkbox" checked={timestamps} onChange={(e) => setTimestamps(e.target.checked)} /> Include timestamps in the finished transcript</label><label className="notes-field">Formatting or context notes<textarea value={formattingNotes} onChange={(e) => setFormattingNotes(e.target.value)} placeholder="Tell Admin anything that will help us prepare the job." rows="4" /></label><button className="button button-dark full" type="button" onClick={saveDraft} disabled={saving}>{saving ? 'Submitting brief…' : demo ? 'Review estimate' : 'Submit for Admin review'} <span>→</span></button>{saveState && <p className={`form-status ${saveState.startsWith('Could not') ? 'error' : 'success'}`}>{saveState}</p>}<p className="form-footnote">Admin reviews every order before it reaches workers. Payment is deliberately not connected in this preview release.</p></div><QuoteCard quote={quote} currency={currency} rush={rush} difficulty={difficulty} timestamps={timestamps} durationMinutes={durationMinutes} /></section>
      : <section className="dashboard-grid"><Metric label="Open orders" value={demo ? (demoStatus === 'pending_admin_review' ? '01' : '02') : String(realOrders.filter((order) => !['client_ready', 'delivered'].includes(order.status)).length).padStart(2, '0')} note={demo ? (demoStatus === 'pending_admin_review' ? 'Preview order awaiting review' : 'One awaiting review') : 'Live preview database'} /><Metric label="Ready files" value={demo ? (demoStatus === 'client_ready' ? '08' : '07') : String(realOrders.filter((order) => ['client_ready', 'delivered'].includes(order.status)).length).padStart(2, '0')} note={demo ? (demoStatus === 'client_ready' ? 'Preview delivery is ready' : 'Last delivered yesterday') : 'Approved client files'} /><Metric label="Support" value="01" note="Admin communication" /><div className="panel wide-panel"><PanelTitle title="Recent work" action="View all files" /><div className="table-list">{dataError && <p className="form-status error">{dataError}</p>}{realRows || <><Row title="Community health interview" meta="TM-2041 · Admin review" status="In review" tone="purple" /><Row title="Quarterly board meeting" meta="TM-2038 · Delivered" status="Ready to download" tone="green" /><Row title="Field notes" meta="TM-2034 · Delivered" status="Ready to download" tone="green" /></>}</div></div></section>}
  </PortalShell>;
}

function QuoteCard({ quote, currency, rush, difficulty, timestamps, durationMinutes }) { return <aside className="quote-card"><p className="eyebrow">Preview estimate</p><h3>A clear quote before checkout.</h3><div className="quote-line"><span>Audio length</span><strong>{durationMinutes ? `${durationMinutes.toFixed(1)} min` : 'Calculated after upload'}</strong></div><div className="quote-line"><span>Delivery</span><strong>{rush ? 'Priority handling' : 'Standard delivery'}</strong></div><div className="quote-line"><span>Options</span><strong>{difficulty === 'difficult' ? 'Difficult audio' : 'Standard audio'}{timestamps ? ' · Timestamps' : ''}</strong></div><div className="quote-total"><span>Estimated total</span><strong>{quote ? `${currency === 'KES' ? 'KES ' : '$'}${quote.amount.toFixed(2)}` : '—'}</strong></div><p>Preview pricing is indicative. The final checkout will use the approved regional payment route: Kora for African clients and Paystack for international clients. Paddle is not part of this system.</p></aside>; }
function Metric({ label, value, note }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function PanelTitle({ title, action }) { return <div className="panel-title"><h2>{title}</h2>{action && <span>{action} ↗</span>}</div>; }
function Row({ title, meta, status, tone }) { return <div className="table-row"><div><strong>{title}</strong><small>{meta}</small></div><span className={`status-pill ${tone}`}>{status}</span></div>; }

function WorkerPortal({ session, profile, demo }) {
  const [claimed, setClaimed] = useState(null);
  const [demoStatus, setDemoStatus] = useState(readDemoWorkflow);
  const [workerNotice, setWorkerNotice] = useState('');
  const [realJobs, setRealJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(!demo);
  const previewJob = { id: 'TM-DEMO', title: 'Preview field interview', length: '0.1 min', service: 'General transcription', due: 'Preview deadline', tags: ['Foundation order', 'Admin brief'] };
  useEffect(() => {
    if (demo || !session) return;
    listOpenJobs().then(({ data }) => { setRealJobs(data || []); setLoadingJobs(false); });
  }, [demo, session]);
  const toJob = (order) => ({ ...order, id: order.id, title: `${order.service_type.replace(/_/g, ' ')} order`, length: order.audio_asset_id ? 'Audio attached' : 'Audio pending', service: order.difficulty === 'difficult' ? 'Difficult audio' : 'Standard', due: order.due_at ? new Date(order.due_at).toLocaleString() : 'Admin deadline pending', tags: [order.turnaround === 'rush' ? 'Rush' : 'Standard', order.timestamps_requested ? 'Timestamps' : 'No timestamps'] });
  const availableJobs = demo ? (demoStatus === 'approved_open' ? [previewJob, jobs[0], jobs[1]] : jobs) : realJobs.map(toJob);
  const claimJob = async (job) => {
    if (demo) { setClaimed(job); return; }
    try { await claimHumanJob(job.id); setClaimed(job); setRealJobs((current) => current.filter((item) => item.id !== job.id)); } catch (error) { setWorkerNotice(`Could not claim the job: ${error.message}`); }
  };
  const submitJob = async () => {
    if (demo && claimed?.id === 'TM-DEMO') { setDemoStatus(writeDemoWorkflow('submitted')); setClaimed(null); setWorkerNotice('Preview submission sent to Admin quality review.'); return; }
    if (!claimed) return;
    try { await submitHumanTranscript(claimed.id, { title: claimed.title, lines: [] }, 'Submitted from the shared preview editor.'); setClaimed(null); setWorkerNotice('Transcript submitted to Admin quality review.'); } catch (error) { setWorkerNotice(`Could not submit the transcript: ${error.message}`); }
  };
  return <PortalShell role="worker" title={claimed ? `Working on ${claimed.title}` : 'The work board'} subtitle={claimed ? 'The complete brief stays with the assignment. Submit when your transcript is ready for Admin review.' : 'Open jobs are visible to eligible workers. The first person to claim one owns the deadline.'} aiCallout session={session} profile={profile} demo={demo}>
    {workerNotice && <p className="form-status success" style={{ margin: '0 52px 20px' }}>{workerNotice}</p>}
    {claimed ? <section className="editor-layout"><SharedEditor job={claimed} /><aside className="editor-side"><div className="brief-card"><p className="eyebrow">Assignment brief</p><h3>{claimed.title}</h3><div className="brief-meta"><span>{claimed.length}</span><span>{claimed.service}</span><span>Due {claimed.due}</span></div><ul>{claimed.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul><button className="button button-green full" type="button" onClick={submitJob}>Submit for Admin review</button><button className="text-button" type="button" onClick={() => setClaimed(null)}>Return to work board</button></div></aside></section> : <section className="dashboard-grid"><div className="board-intro wide-panel"><div><p className="eyebrow">First-come-first-served</p><h2>Claim the work you can finish well.</h2><p>Each open job includes the audio requirements, formatting brief and deadline before you claim it. There is no client contact and no hidden negotiation.</p></div><div className="board-rule"><span>OPEN BOARD</span><strong>{loadingJobs ? '…' : availableJobs.length}</strong><small>eligible jobs</small></div></div><div className="jobs-list wide-panel">{availableJobs.map((job) => <article className="job-card" key={job.id}><div className="job-card-main"><span className="job-id">{job.id.length > 12 ? job.id.slice(0, 8) : job.id}</span><h3>{job.title}</h3><div className="job-facts"><span>{job.length}</span><span>{job.service}</span><span>Due {job.due}</span></div><div className="tag-list">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><button className="button button-dark" type="button" onClick={() => claimJob(job)}>Claim job <span>→</span></button></article>)}</div></section>}
  </PortalShell>;
}

function SharedEditor({ job }) { return <div className="shared-editor"><div className="editor-header"><div><span className="eyebrow">Shared TypeMyworDz editor</span><h2>{job.title}</h2></div><span className="editor-save">Saved locally · 00:42</span></div><div className="editor-toolbar"><button type="button">▶ Listen</button><button type="button">＋ Timestamp</button><button type="button">Speaker labels</button><span /><button type="button">Find</button></div><div className="editor-body"><div className="transcript-lines"><p><b>00:00</b><span><strong>Speaker 1:</strong> Good morning. Thank you for making time for this interview.</span></p><p><b>00:08</b><span><strong>Speaker 2:</strong> Of course. I wanted to start with the work your team has been doing in the community.</span></p><p><b>00:17</b><span className="editable-line">We have seen a real difference in how people access support, especially when the process is explained clearly.</span></p><p><b>00:29</b><span><strong>Speaker 2:</strong> That clarity is exactly what we hope the final report will preserve.</span></p></div><aside className="ask-panel"><div className="ask-mark">AI</div><p className="eyebrow">Ask TypeMyworDz</p><h3>Need help with this job?</h3><p>Summarise a section, check consistency or ask about the transcript while you work.</p><button className="button button-purple full" type="button">Open assistant →</button><div className="ai-promo"><span>For transcribers</span><strong>Have your own backlog?</strong><p>TypeMyworDz AI can handle automated first drafts, leaving you more time for the work that needs a human ear.</p><Link to="/worker/ai">See the AI workflow ↗</Link></div></aside></div></div>; }

function TraineePortal({ session, profile, demo }) { return <PortalShell role="trainee" session={session} profile={profile} demo={demo} title="Training desk" subtitle="Learn the TypeMyworDz standard before you take on live work."><section className="dashboard-grid"><div className="training-progress wide-panel"><div><p className="eyebrow">Your route to approved work</p><h2>Two modules left before your next review.</h2><p>Complete the lesson, submit the practice audio and receive Admin feedback in one place.</p></div><div className="progress-ring"><strong>68%</strong><span>complete</span></div></div><div className="module-list wide-panel"><Module number="01" title="Clean verbatim and speaker changes" status="Complete" /><Module number="02" title="Timestamps that follow the audio" status="Complete" /><Module number="03" title="Difficult audio and crosstalk" status="In progress" active /><Module number="04" title="Final quality checklist" status="Locked" /></div></section></PortalShell>; }
function Module({ number, title, status, active }) { return <div className={`module-row ${active ? 'active' : ''}`}><span>{number}</span><div><strong>{title}</strong><small>{active ? 'Continue lesson →' : status}</small></div><em>{status}</em></div>; }

function AdminPortal({ session, profile, demo }) {
  const [demoStatus, setDemoStatus] = useState(readDemoWorkflow);
  const [realOrders, setRealOrders] = useState([]);
  const [realSubmissions, setRealSubmissions] = useState([]);
  const [adminNotice, setAdminNotice] = useState('');
  const loadAdminQueue = async () => { if (!session || demo) return; const [orders, submissions] = await Promise.all([listAdminQueue(), listSubmittedTranscripts()]); setRealOrders(orders.data || []); setRealSubmissions(submissions.data || []); };
  // The queue loader is intentionally scoped to this portal instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAdminQueue(); }, [session, demo]);
  const advance = (nextStatus) => setDemoStatus(writeDemoWorkflow(nextStatus));
  const previewAction = demoStatus === 'pending_admin_review' ? <button className="button button-purple small" type="button" onClick={() => advance('approved_open')}>Approve order</button> : demoStatus === 'submitted' ? <button className="button button-green small" type="button" onClick={() => advance('client_ready')}>Approve delivery</button> : <span className={`status-pill ${demoStatus === 'client_ready' ? 'green' : 'purple'}`}>{demoStatus.replace(/_/g, ' ')}</span>;
  const approveOrder = async (id) => { try { await approveHumanOrder(id); setAdminNotice('Order approved and opened to workers.'); await loadAdminQueue(); } catch (error) { setAdminNotice(`Could not approve order: ${error.message}`); } };
  const approveSubmission = async (id) => { try { await approveHumanSubmission(id, 'Approved by Admin after quality review.'); setAdminNotice('Transcript approved for client delivery.'); await loadAdminQueue(); } catch (error) { setAdminNotice(`Could not approve delivery: ${error.message}`); } };
  const realQueue = realOrders.map((order) => <div className="table-row" key={order.id}><div><strong>{order.service_type.replace(/_/g, ' ')} order</strong><small>{order.id.slice(0, 8)} · {order.quote_currency} {order.quote_amount || '—'}</small></div><button className="button button-purple small" type="button" onClick={() => approveOrder(order.id)}>Approve order</button></div>);
  const realReviews = realSubmissions.map((submission) => <div className="table-row" key={submission.id}><div><strong>Transcript submission</strong><small>{submission.order_id.slice(0, 8)} · Worker quality review</small></div><button className="button button-green small" type="button" onClick={() => approveSubmission(submission.id)}>Approve delivery</button></div>);
  return <PortalShell role="admin" session={session} profile={profile} demo={demo} title="Control room" subtitle="One view of orders, people, quality and the conversations that keep the marketplace healthy."><section className="dashboard-grid"><Metric label="Awaiting review" value={demo ? (demoStatus === 'pending_admin_review' ? '01' : '08') : String(realOrders.length).padStart(2, '0')} note={demo ? (demoStatus === 'pending_admin_review' ? 'Preview order ready' : '3 new client orders') : 'Preview database'} /><Metric label="Open worker jobs" value={demo && demoStatus === 'approved_open' ? '15' : '14'} note="First-come-first-served" /><Metric label="Submitted today" value={demo ? (demoStatus === 'submitted' ? '07' : '06') : String(realSubmissions.length).padStart(2, '0')} note="Quality review queue" /><Metric label="Support threads" value="04" note="No overdue replies" /><div className="panel wide-panel"><PanelTitle title="Today’s operating queue" action="Open full queue" /><div className="table-list">{adminNotice && <p className="form-status success">{adminNotice}</p>}{demo && demoStatus !== 'draft' && <div className="table-row"><div><strong>Preview field interview</strong><small>TM-DEMO · Demo workflow</small></div>{previewAction}</div>}{!demo && realQueue}{!demo && realReviews}<Row title="Research focus group" meta="Client order · Requirements ready" status="Approve order" tone="purple" /><Row title="Board meeting recording" meta="Worker submission · 68 minutes" status="Quality review" tone="amber" /><Row title="Community health interview" meta="Client support · Revision requested" status="Needs attention" tone="red" /></div></div><div className="panel"><PanelTitle title="Marketplace rules" /><ul className="plain-list"><li>Workers claim open jobs themselves.</li><li>Clients only communicate with Admin.</li><li>Only approved work becomes client-ready.</li></ul></div><div className="panel"><PanelTitle title="Financial snapshot" /><div className="finance-number">KES 84,600<small>pending worker earnings</small></div><span className="muted-note">Provider adapter ready for Kora or another approved rail.</span></div></section></PortalShell>;
}

function Login() {
  const navigate = useNavigate();
  const { session, profile, signIn, signUp, error, notice, clearMessages } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && profile) navigate(`/${profile.role}`, { replace: true });
  }, [session, profile, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    clearMessages();
    if (mode === 'signin') await signIn(email, password);
    else await signUp(email, password, displayName);
    setBusy(false);
  };

  return <div className="login-page">
    <Link to="/" className="login-back">← Back to TypeMyworDz</Link>
    <div className="login-layout">
      <section className="login-intro"><p className="eyebrow">Human transcription workspace</p><h1>Work moves better when every hand-off is clear.</h1><p>Sign in to place an order, manage a transcript, or continue your Admin-reviewed workflow.</p><div className="login-steps"><span><b>01</b> Your profile sets the right workspace.</span><span><b>02</b> Orders, jobs and support stay in one place.</span><span><b>03</b> Nothing becomes client-ready without review.</span></div></section>
      <section className="login-card">{brand}<div className="auth-heading"><p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Create a client account'}</p><h2>{mode === 'signin' ? 'Sign in to continue.' : 'Start with a clear brief.'}</h2><p>{mode === 'signin' ? 'Use the email and password for your human-transcription account.' : 'New accounts begin as clients. Admin assigns any other workspace role.'}</p></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label>Full name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>}
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength="8" required /></label>
          {error && <p className="auth-message error">{error}</p>}
          {notice && <p className="auth-message success">{notice}</p>}
          <button className="button button-dark full" type="submit" disabled={busy}>{busy ? 'Opening workspace…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); clearMessages(); }}>{mode === 'signin' ? 'New here? Create a client account' : 'Already have an account? Sign in'}</button>
        <div className="demo-divider"><span>Preview only</span></div><p className="demo-copy">No real jobs or payments are connected yet. Use a demo workspace to review the foundation without creating an account.</p><div className="demo-links"><Link to="/client?demo=1">Client</Link><Link to="/worker?demo=1">Worker</Link><Link to="/trainee?demo=1">Trainee</Link><Link to="/admin?demo=1">Admin</Link></div>
      </section>
    </div>
  </div>;
}

// Preview deployment refresh: Vercel Preview variables are intentionally scoped to this branch.
export default function RootApp() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route path="*" element={<HumanSystem />} /></Routes></BrowserRouter></AuthProvider>;
}
