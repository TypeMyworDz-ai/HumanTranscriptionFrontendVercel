// src/GuidelinesPage.js - UPDATED for bold/italic formatting, final NOTE section, and clickable link
import React from 'react';
import { Link } from 'react-router-dom';
import './GuidelinesPage.css'; // You'll need to create this CSS file for styling

const GuidelinesPage = () => {
  return (
    <div className="guidelines-page-container">
      <header className="guidelines-header">
        <h1>Transcription Guidelines</h1>
        <Link to="/" className="back-to-home-btn">← Back to Home</Link>
      </header>
      <main className="guidelines-content">
        <section>
          <h2>Transcription Essentials:</h2>
          <ul>
            <li><strong>Listening skills and research:</strong> Cisco vs Sysco.</li>
            <li><strong>Typing:</strong> money volume TAT (Turn Around Time) 10min audio-6hrs</li>
            <li><strong>Grammar;</strong> Their vs there, you’re vs your, is/are, these/this; Never change speaker’s grammar; the people is going to church.</li>
          </ul>
        </section>

        <section>
          <h2>Softwares and Tools;</h2>
          <ul>
            <li><strong>Express scribe;</strong> Playback device or use our simple Editor here <a href="https://typemywordz.ai/transcription-editor" target="_blank" rel="noopener noreferrer">https://typemywordz.ai/transcription-editor</a></li>
            <li><strong>TypeMyworDZ (visit <a href="https://typemywordz.ai" target="_blank" rel="noopener noreferrer">typemywordz.ai</a>):</strong> You can always get a AI transcript and make sure to edit it thoroughly according to client's instructions. <strong>NEVER SUBMIT AN AI TRANSCRIPT.</strong> Read our terms and conditions.</li>
            <li><strong>Search Engine:</strong> I downloaded the software around silicon valley in California (Use Google to be sure of unfamiliar words. E.g. Google can tell you that if you were hearing simicon Valley, confirming you will know that Silicon Valley is the correct Name since it’s known for being the home for giant Softwares and Tech companies.)</li>
            <li><strong>DFX/VoiceMeeter:</strong> Enhances audio (Not a must)</li>
            <li><strong>Grammarly extension.</strong> (Not a must)</li>
            <li><strong>Typing master:</strong> Improves typing speed.</li>
          </ul>
        </section>

        <section>
          <h2>NOTE</h2>
          <ul>
            <li>A client will always indicate what type of transcript they want. Make sure to follow all the client's instructions to the last one. Failure to follow client's instructions leads to poor ratings, which will lead to removal from our platform.</li>
            <li>If a client doesn't explicitly indicate what type of transcript they want, use the chat feature on the platform to ask for me details.</li>
            <li>By default, you should transcribe Clean-Verbatim. Be sure to ask the client what format they prefer during your negotiation process.</li>
          </ul>
        </section>

        <section>
          <h2>Full-Verbatim and Clean-Verbatim transcription</h2>
          <h3>Full verbatim:</h3>
          <p>Transcript where you include everything the speaker saying: Repetitions, stutters, stammers, filler words.</p>
          <h4>Repetitions:</h4>
          <ul>
            <li>I went to Java Café for some-some-some coffee.</li>
            <li>I went to Java Café- Java Café- Java Café for some-some coffee.</li>
          </ul>
          <h4>Stutters:</h4>
          <ul>
            <li>Um, Uh, Er, Hmm, Mm, Uh-uh, Uh-oh. Uh-huh, Mm-hmm (affirmatives), for example, I went, um, to the- to the, er, Java House.</li>
          </ul>
          <h4>Stammers:</h4>
          <ul>
            <li>I went to Java for some co-co-co-coffee.</li>
          </ul>
          <h4>Filler words:</h4>
          <ul>
            <li>You know, like, yeah, then, of course;</li>
          </ul>
          <h4>Unnecessary Affirmatives/Negatives:</h4>
          <p>Lawrence: I was going to the church-</p>
          <p>James: Yes.</p>
          <p>Lawrence: When I heard a loud bang.</p>
        </section>

        <section>
          <h3>Clean-Verbatim</h3>
          <p>Remove stutters, stammers, filler words and repetitions.</p>
          <ul>
            <li>
              For example:
              <br />
              Full Verbatim: I went to Java, um, café for-for some co-co-coffee like yesterday.
              <br />
              Clean Verbatim: I went to java café for some coffee yesterday.
              <br />
              Full Verbatim: I was like ten years old when, um, I graduated from Harvard.
              <br />
              Clean Verbatim: I was like ten years old when I graduated from Harvard.
            </li>
          </ul>
        </section>

        <section>
          <h2>Most common tags:</h2>
          <ul>
            <li><strong>[unintelligible 00:00:00]:</strong> You can clearly hear what the speaker is saying but can’t make out the words he/she is saying. Accent.
              <br />
              Example: I was going to town by noon and I came across <strong>[unintelligible 00:02:12]</strong>.
            </li>
            <li><strong>[inaudible 00:00:00]:</strong> You can’t hear at all maybe because of background noise.</li>
            <li><strong>[pause 00:00:00]:</strong> Must be more than 10 seconds speaker’s pause. Should be in line with speaker's text.
              <br />
              Example:
              <br />
              John: I was going to town by [pause 00:03:00] seven o’clock and I was already tired.
            </li>
            <li>[silence]: (on its own line]</li>
            <li>[laughs]: when one speaker laughs. (On its own line.)
              <br />
              E.g.
              <br />
              John: That must have been the craziest idea ever [laughs].
            </li>
            <li>[laughter]: When more than one speaker laughs. (Must be on its own line]
              <br />
              E.g.
              <br />
              John: That must have been the craziest idea ever.
              <br />
              [laughter]
              <br />
              James: I totally agree with you. It was fun.
            </li>
            <li><strong>[crosstalk]:</strong> When more than one speaker speak at the same time and you cannot make out what one of the speaker is saying, or one speaker interrupts the other before finishes the sentence and you can’t hear their last words. Can be in line with speaker's text or on it's own line depending on the number of speakers crosstalking.
              <br />
              Example 1:
              <br />
              James: Hey, can I go to check [crosstalk] because I didn't see it last time.
              <br />
              John: Okay, I have to go now, I'm late.
              <br />
              Example 2:
              <br />
              <strong>Speaker 1:</strong> I was going to town by--
              <br />
              [crosstalk]
              <br />
              <strong>Speaker 2:</strong> Oh, wow that’s crazy.
            </li>
            <li>[background noise]: Music, conversation that is not relevant to the audio. (On its own line).</li>
            <li>[foreign language]: When a speaker speaks a language other than the one requested by the client.</li>
          </ul>
        </section>

        <section>
          <h2>Timestamping:</h2>
          <ul>
            <li>a. <strong>Change of Speaker:</strong> Timestamp every change of speaker</li>
            <li>b. <strong>Intervals:</strong> Can be in seconds or minutes e.g. Every 30 seconds, every 1 minute, every 2 minutes, et cetera.</li>
          </ul>
        </section>

        {/* NEW: Final NOTE section */}
        <section className="final-note-section">
          <p>
            <strong className="red-note">NOTE:</strong> Client's instructions overrides anything covered in the guidelines.
            Always give client's guidelines/instructions priority. In absence of client's instructions, follow the above guidelines. Make sure to ask the client if they want a Full-Verbatim or a Clean-Verbatim transcript.
          </p>
        </section>
      </main>
    </div>
  );
};

export default GuidelinesPage;
