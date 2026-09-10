import React, { useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { hasSupabaseConfig } from './supabaseClient';
import './App.css';

const jobs = [
  { id: 'TM-2048', title: 'Community health interview', length: '42 min', service: 'Standard', due: 'Tomorrow, 16:00', tags: ['Two speakers', 'Clean audio'] },
  { id: 'TM-2047', title: 'Board meeting recording', length: '68 min', service: 'Rush', due: 'Today, 20:00', tags: ['Four speakers', 'Timestamps'] },
  { id: 'TM-2046', title: 'Research focus group', length: '51 min', service: 'Difficult audio', due: 'Friday, 12:00', tags: ['Six speakers', 'Crosstalk'] },
];

const brand = <span className="brand"><span>Type</span><i>My</i><strong>worDz</strong></span>;

function HumanSystem() {
  const location = useLocation();
  const isPortal = ['/client', '/worker', '/trainee', '/admin'].some((path) => location.pathname.startsWith(path));

  if (isPortal) return <PortalRouter />;
  return <PublicSite />;
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

function PortalRouter() {
  const location = useLocation();
  if (location.pathname.startsWith('/client')) return <ClientPortal />;
  if (location.pathname.startsWith('/worker')) return <WorkerPortal />;
  if (location.pathname.startsWith('/trainee')) return <TraineePortal />;
  return <AdminPortal />;
}

function PortalShell({ role, title, subtitle, children, notice, aiCallout = false }) {
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
      <div className="rail-role"><span className="role-kicker">SIGNED IN AS</span><strong>{role}</strong></div>
      <nav className="rail-nav">{nav.map(([href, label]) => <NavLink key={href} to={href} end={href === `/${role}`}>{label}</NavLink>)}</nav>
      {aiCallout && <div className="ai-callout"><span>TypeMyworDz AI</span><strong>Turn your own backlog into a faster workflow.</strong><p>Transcribers can use our automated tools and Ask TypeMyworDz when they need them.</p><Link to="/worker/ai">Explore AI tools →</Link></div>}
      <Link to="/" className="rail-exit">← Public site</Link>
    </aside>
    <main className="portal-main">
      <div className="portal-topbar"><span>Preview foundation · no live orders or payments</span><span className="topbar-status"><i /> {hasSupabaseConfig ? 'Database connected' : 'Database configuration pending'}</span></div>
      <section className="portal-heading"><div><p className="eyebrow">{role} workspace</p><h1>{title}</h1><p>{subtitle}</p></div><div className="portal-actions">{notice || <span className="quiet-chip">Admin-reviewed workflow</span>}</div></section>
      {children}
    </main>
  </div>;
}

function ClientPortal() {
  const location = useLocation();
  const [fileName, setFileName] = useState('');
  const [rush, setRush] = useState(false);
  const isOrder = location.pathname.includes('/order');
  return <PortalShell role="client" title={isOrder ? 'Start a human transcript' : 'Your work, in one place'} subtitle={isOrder ? 'Tell us what good looks like. We will manage the rest.' : 'Orders, files, payments and support without a maze of hand-offs.'} notice={<Link to="/client/order" className="button button-green small">New order +</Link>}>
    {isOrder ? <section className="workspace-grid order-grid"><div className="form-card"><p className="eyebrow">01 · The recording</p><h2>Give the job a clear starting point.</h2><label className="upload-zone"><input type="file" accept="audio/*,video/*" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} /><span className="upload-symbol">+</span><strong>{fileName || 'Choose an audio or video file'}</strong><small>{fileName ? 'Ready for quote calculation' : 'MP3, WAV, M4A, MP4 and common formats'}</small></label><div className="form-row"><label>Speakers<select defaultValue="1"><option>1 speaker</option><option>2 speakers</option><option>3–5 speakers</option><option>6+ speakers</option></select></label><label>Delivery<select defaultValue="standard"><option value="standard">Standard</option><option value="rush">Rush</option></select></label></div><label className="check-row"><input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} /> I need priority handling for a time-sensitive job</label><button className="button button-dark full" type="button">Calculate my quote <span>→</span></button><p className="form-footnote">Your order will be reviewed by Admin before it is made available to workers. No payment is taken in this foundation preview.</p></div><QuoteCard rush={rush} /></section>
      : <section className="dashboard-grid"><Metric label="Open orders" value="02" note="One awaiting review" /><Metric label="Ready files" value="07" note="Last delivered yesterday" /><Metric label="Support" value="01" note="Admin replied 12 min ago" /><div className="panel wide-panel"><PanelTitle title="Recent work" action="View all files" /><div className="table-list"><Row title="Community health interview" meta="TM-2041 · Admin review" status="In review" tone="purple" /><Row title="Quarterly board meeting" meta="TM-2038 · Delivered" status="Ready to download" tone="green" /><Row title="Field notes" meta="TM-2034 · Delivered" status="Ready to download" tone="green" /></div></div></section>}
  </PortalShell>;
}

function QuoteCard({ rush }) { return <aside className="quote-card"><p className="eyebrow">Quote preview</p><h3>Your final price stays clear.</h3><div className="quote-line"><span>Audio length</span><strong>Calculated after upload</strong></div><div className="quote-line"><span>Service</span><strong>{rush ? 'Priority handling' : 'Standard delivery'}</strong></div><div className="quote-total"><span>Estimated total</span><strong>—</strong></div><p>Regional and international pricing will be shown before checkout. Payment is handled by a provider selected for this service, not by the AI subscription system.</p></aside>; }
function Metric({ label, value, note }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function PanelTitle({ title, action }) { return <div className="panel-title"><h2>{title}</h2>{action && <span>{action} ↗</span>}</div>; }
function Row({ title, meta, status, tone }) { return <div className="table-row"><div><strong>{title}</strong><small>{meta}</small></div><span className={`status-pill ${tone}`}>{status}</span></div>; }

function WorkerPortal() {
  const [claimed, setClaimed] = useState(null);
  return <PortalShell role="worker" title={claimed ? `Working on ${claimed.title}` : 'The work board'} subtitle={claimed ? 'The complete brief stays with the assignment. Submit when your transcript is ready for Admin review.' : 'Open jobs are visible to eligible workers. The first person to claim one owns the deadline.'} aiCallout>
    {claimed ? <section className="editor-layout"><SharedEditor job={claimed} /><aside className="editor-side"><div className="brief-card"><p className="eyebrow">Assignment brief</p><h3>{claimed.title}</h3><div className="brief-meta"><span>{claimed.length}</span><span>{claimed.service}</span><span>Due {claimed.due}</span></div><ul>{claimed.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul><button className="button button-green full" type="button">Submit for Admin review</button><button className="text-button" type="button" onClick={() => setClaimed(null)}>Return to work board</button></div></aside></section> : <section className="dashboard-grid"><div className="board-intro wide-panel"><div><p className="eyebrow">First-come-first-served</p><h2>Claim the work you can finish well.</h2><p>Each open job includes the audio requirements, formatting brief and deadline before you claim it. There is no client contact and no hidden negotiation.</p></div><div className="board-rule"><span>OPEN BOARD</span><strong>03</strong><small>eligible jobs</small></div></div><div className="jobs-list wide-panel">{jobs.map((job) => <article className="job-card" key={job.id}><div className="job-card-main"><span className="job-id">{job.id}</span><h3>{job.title}</h3><div className="job-facts"><span>{job.length}</span><span>{job.service}</span><span>Due {job.due}</span></div><div className="tag-list">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><button className="button button-dark" type="button" onClick={() => setClaimed(job)}>Claim job <span>→</span></button></article>)}</div></section>}
  </PortalShell>;
}

function SharedEditor({ job }) { return <div className="shared-editor"><div className="editor-header"><div><span className="eyebrow">Shared TypeMyworDz editor</span><h2>{job.title}</h2></div><span className="editor-save">Saved locally · 00:42</span></div><div className="editor-toolbar"><button type="button">▶ Listen</button><button type="button">＋ Timestamp</button><button type="button">Speaker labels</button><span /><button type="button">Find</button></div><div className="editor-body"><div className="transcript-lines"><p><b>00:00</b><span><strong>Speaker 1:</strong> Good morning. Thank you for making time for this interview.</span></p><p><b>00:08</b><span><strong>Speaker 2:</strong> Of course. I wanted to start with the work your team has been doing in the community.</span></p><p><b>00:17</b><span className="editable-line">We have seen a real difference in how people access support, especially when the process is explained clearly.</span></p><p><b>00:29</b><span><strong>Speaker 2:</strong> That clarity is exactly what we hope the final report will preserve.</span></p></div><aside className="ask-panel"><div className="ask-mark">AI</div><p className="eyebrow">Ask TypeMyworDz</p><h3>Need help with this job?</h3><p>Summarise a section, check consistency or ask about the transcript while you work.</p><button className="button button-purple full" type="button">Open assistant →</button><div className="ai-promo"><span>For transcribers</span><strong>Have your own backlog?</strong><p>TypeMyworDz AI can handle automated first drafts, leaving you more time for the work that needs a human ear.</p><Link to="/worker/ai">See the AI workflow ↗</Link></div></aside></div></div>; }

function TraineePortal() { return <PortalShell role="trainee" title="Training desk" subtitle="Learn the TypeMyworDz standard before you take on live work."><section className="dashboard-grid"><div className="training-progress wide-panel"><div><p className="eyebrow">Your route to approved work</p><h2>Two modules left before your next review.</h2><p>Complete the lesson, submit the practice audio and receive Admin feedback in one place.</p></div><div className="progress-ring"><strong>68%</strong><span>complete</span></div></div><div className="module-list wide-panel"><Module number="01" title="Clean verbatim and speaker changes" status="Complete" /><Module number="02" title="Timestamps that follow the audio" status="Complete" /><Module number="03" title="Difficult audio and crosstalk" status="In progress" active /><Module number="04" title="Final quality checklist" status="Locked" /></div></section></PortalShell>; }
function Module({ number, title, status, active }) { return <div className={`module-row ${active ? 'active' : ''}`}><span>{number}</span><div><strong>{title}</strong><small>{active ? 'Continue lesson →' : status}</small></div><em>{status}</em></div>; }

function AdminPortal() { return <PortalShell role="admin" title="Control room" subtitle="One view of orders, people, quality and the conversations that keep the marketplace healthy."><section className="dashboard-grid"><Metric label="Awaiting review" value="08" note="3 new client orders" /><Metric label="Open worker jobs" value="14" note="First-come-first-served" /><Metric label="Submitted today" value="06" note="2 need correction" /><Metric label="Support threads" value="04" note="No overdue replies" /><div className="panel wide-panel"><PanelTitle title="Today’s operating queue" action="Open full queue" /><div className="table-list"><Row title="Research focus group" meta="Client order · Requirements ready" status="Approve order" tone="purple" /><Row title="Board meeting recording" meta="Worker submission · 68 minutes" status="Quality review" tone="amber" /><Row title="Community health interview" meta="Client support · Revision requested" status="Needs attention" tone="red" /></div></div><div className="panel"><PanelTitle title="Marketplace rules" /><ul className="plain-list"><li>Workers claim open jobs themselves.</li><li>Clients only communicate with Admin.</li><li>Only approved work becomes client-ready.</li></ul></div><div className="panel"><PanelTitle title="Financial snapshot" /><div className="finance-number">KES 84,600<small>pending worker earnings</small></div><span className="muted-note">Provider adapter ready for Kora or another approved rail.</span></div></section></PortalShell>; }

function Login() { return <div className="login-page"><Link to="/" className="login-back">← Back to TypeMyworDz</Link><div className="login-card">{brand}<p className="eyebrow">Human transcription workspace</p><h1>Choose a preview workspace.</h1><p>This foundation preview uses local demo access only. No accounts, payments or live jobs are created.</p><div className="login-links"><Link to="/client" className="button button-dark full">Open client workspace</Link><Link to="/worker" className="button button-green full">Open worker workspace</Link><Link to="/trainee" className="button button-quiet full">Open trainee workspace</Link><Link to="/admin" className="text-link centered">Open Admin control room</Link></div></div></div>; }

export default function RootApp() {
  return <BrowserRouter><Routes><Route path="/login" element={<Login />} /><Route path="*" element={<HumanSystem />} /></Routes></BrowserRouter>;
}
