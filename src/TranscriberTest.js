// src/TranscriberTest.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './TranscriberTest.css';
import { useAuth } from './contexts/AuthContext';
import { BACKEND_API_URL } from './config'; // NEW: Import BACKEND_API_URL

const TranscriberTest = () => {
  const { user, isAuthenticated, authLoading, logout } = useAuth();

  const [currentSection, setCurrentSection] = useState('instructions');
  const [testData, setTestData] = useState({
    grammarAnswers: {},
    transcriptionText: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Grammar questions (memoized for performance)
  const grammarQuestions = useMemo(() => [
    { id: 1, question: "Choose the correct sentence.", options: ["Their going to the store", "They're going to the store", "There going to the store"], correct: 1 },
    { id: 2, question: "Which word is spelled correctly?", options: ["Recieve", "Receive", "Receeve"], correct: 1 },
    { id: 3, question: "Choose the correct punctuation.", options: ["Hello, how are you today?", "Hello how are you today.", "Hello; how are you today"], correct: 0 },
    { id: 4, question: "Select the proper capitalization.", options: ["i went to New york last Summer", "I went to new york last summer", "I went to New York last summer"], correct: 2 },
    { id: 5, question: "Choose the correct verb form.", options: ["She don't like coffee", "She doesn't like coffee", "She doesn't likes coffee"], correct: 1 },
    { id: 6, question: "Identify the misspelled word.", options: ["Separate", "Definite", "recieve"], correct: 2 },
    { id: 7, question: "Which sentence uses proper comma placement?", options: ["I like coffee, tea, and juice.", "I like coffee tea, and juice.", "I like coffee, tea and juice."], correct: 0 },
    { id: 8, question: "Choose the word that means 'to affect'.", options: ["Effect", "Affect", "Efect"], correct: 1 },
    { id: 9, question: "Complete the sentence: 'The book is ______ the table.'", options: ["on", "in", "at"], correct: 0 },
    { id: 10, question: "Which sentence is grammatically correct?", options: ["Me and John went to the park.", "John and I went to the park.", "John and me went to the park."], correct: 1 }
  ], []);

  // --- Role Enforcement based on AuthContext state ---
  useEffect(() => {
    console.groupCollapsed('TranscriberTest: useEffect Auth Check (Delayed)');
    if (authLoading) {
        setLoading(true);
        console.log('TranscriberTest: Auth is loading. Deferring role check.');
        console.groupEnd();
        return;
    }

    if (!isAuthenticated || !user) {
        console.log('TranscriberTest: Not authenticated or user missing. Relying on ProtectedRoute.');
        setLoading(false);
        console.groupEnd();
        return;
    }

    if (user.user_type !== 'transcriber') {
        console.warn(`TranscriberTest: Authenticated user is NOT a transcriber (Type: ${user.user_type}). Redirecting.`);
        if (user.user_type === 'client') {
            navigate('/client-dashboard');
        } else {
            navigate('/');
        }
        console.groupEnd();
        return;
    }

    console.log('TranscriberTest: User is an authenticated transcriber. Checking test status...');
    const checkTestStatusAndRedirect = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('TranscriberTest: Token missing for API call despite authenticated state. Forcing logout.');
                logout();
                return;
            }
            // CORRECTED: Use BACKEND_API_URL
            const response = await fetch(`${BACKEND_API_URL}/api/transcriber/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statusData = await response.json();
            console.log('TranscriberTest: API statusData (delayed):', statusData);

            if (response.ok && statusData.has_submitted_test) {
                console.log('TranscriberTest: Test already submitted. Redirecting based on submission status.');
                if (statusData.test_submission?.status === 'pending') {
                    navigate('/transcriber-waiting');
                } else if (statusData.test_submission?.status === 'rejected') {
                    navigate('/transcriber-waiting'); // Or a specific rejection page
                } else if (statusData.user_status === 'active_transcriber' || statusData.user_level === 'proofreader') {
                    navigate('/transcriber-dashboard');
                } else {
                    navigate('/transcriber-dashboard');
                }
                console.groupEnd();
                return;
            }
        } catch (error) {
            console.error('TranscriberTest: Error checking test status:', error);
        } finally {
            setLoading(false);
            console.log('TranscriberTest: Local loading set to FALSE after delayed test status check.');
            console.groupEnd();
        }
    };

    checkTestStatusAndRedirect();

  }, [isAuthenticated, authLoading, user, navigate, logout]);


  const handleGrammarAnswer = useCallback((questionId, answerIndex) => {
    setTestData((prev) => ({
      ...prev,
      grammarAnswers: {
        ...prev.grammarAnswers,
        [questionId]: answerIndex
      }
    }));
  }, []);

  const handleTranscriptionChange = useCallback((e) => {
    setTestData((prev) => ({
      ...prev,
      transcriptionText: e.target.value
    }));
  }, []);

  const calculateGrammarScore = useCallback(() => {
    let correct = 0;
    grammarQuestions.forEach(q => {
      if (testData.grammarAnswers[q.id] === q.correct) {
        correct++;
      }
    });
    return (correct / grammarQuestions.length) * 100;
  }, [testData.grammarAnswers, grammarQuestions]);

  // Renamed handleSubmit to handleTestSubmit to be more specific
  const handleTestSubmit = useCallback(async () => {
    // Check if all grammar questions are answered
    if (Object.keys(testData.grammarAnswers).length < grammarQuestions.length) {
      setMessage('Please answer all grammar questions');
      return;
    }

    // Check if transcription text is provided
    if (!testData.transcriptionText.trim()) {
      setMessage('Please complete the transcription task');
      return;
    }

    setLoading(true);
    setMessage(''); // Clear previous messages

    try {
      const grammarScore = calculateGrammarScore();
      const token = localStorage.getItem('token');

      if (!token) {
        console.error("TranscriberTest: Token missing for submission.");
        logout();
        return;
      }

      // Make the API call to the backend
      // CORRECTED: Use BACKEND_API_URL
      const response = await fetch(`${BACKEND_API_URL}/api/transcriber/submit-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          grammar_score: grammarScore,
          transcription_text: testData.transcriptionText
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Test submitted successfully! Redirecting...');
        // Clear form data after successful submission if needed
        setTestData({ grammarAnswers: {}, transcriptionText: '' });

        setTimeout(() => {
          navigate('/transcriber-waiting');
        }, 2000);
      } else {
        setMessage(data.error || 'Test submission failed');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
      console.error("Test submission network error:", error);
    } finally {
      setLoading(false);
    }
  }, [calculateGrammarScore, grammarQuestions, testData.grammarAnswers, testData.transcriptionText, navigate, logout, setMessage, setLoading]); // Added dependencies

  if (authLoading) {
    return <div className="loading-container">Loading authentication...</div>;
  }
  if (!isAuthenticated || !user) {
    return <div className="loading-container">Not authenticated. Redirecting...</div>;
  }
  if (user.user_type !== 'transcriber') {
      return <div className="loading-container">Unauthorized access. Redirecting...</div>;
  }

  if (loading) {
    return <div className="loading-container">Submitting test...</div>;
  }

  return (
    <div className="test-container">
      <header className="test-header">
        <h1 className="test-title">Transcriber Assessment Test</h1>
        <p className="welcome-message">Welcome {user.full_name}!</p>
      </header>

      <div className="test-content">
        {currentSection === 'instructions' && (
          <div className="instructions-section">
            <h2 className="section-title">Test Instructions</h2>
            <div className="instructions-content">
              <h3 className="sub-section-title">This test consists of two parts:</h3>
              <ol>
                <li><strong>Grammar Test:</strong> 10 multiple choice questions testing basic English grammar</li>
                <li><strong>Transcription Task:</strong> Listen to a short audio and transcribe it following our guidelines</li>
              </ol>

              <br/><br/><br/>
              <h3 className="sub-section-title"><u><strong>GUIDELINES:</strong></u></h3>
              <br/><br/>

              <h3 className="sub-section-title"><u>Transcription Essentials:</u></h3>
              <ul>
                <li>
                  <em><strong>Listening skills:</strong></em> Mishears; pornography instead geography
                </li>
                <li>
                  <em><strong>Typing:</strong></em> money volume TAT (Turn Around Time) 10min audio-6hrs
                </li>
                <li>
                  <em><strong>Grammar:</strong></em> Their vs there, you’re vs your, is/are, these/this; Never change speaker’s grammar; the people is going to church.
                </li>
              </ul>

              <h3 className="sub-section-title"><u>Softwares and Tools:</u></h3>
              <ul>
                <li>
                  <em><strong>Express Scribe:</strong></em> Playback software or use our simple Editor here <a href="https://typemywordz.ai/transcription-editor" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}><strong>https://typemywordz.ai/transcription-editor</strong></a>.
                </li>
                <li>
                  <em><strong>TypeMyworDz 👉 </strong></em><a href="https://typemywordz.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}><strong>typemywordz.ai</strong></a>: You can always get an AI transcript and make sure to edit it thoroughly according to client's instructions. <strong>NEVER SUBMIT AN AI TRANSCRIPT.</strong> Read our {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                        <a href="#" onClick={(e) => e.preventDefault()} role="button" aria-disabled="true" target="_blank" rel="noopener noreferrer">terms and conditions</a>.
                </li>
                <li>
                  <em><strong>Search Engine:</strong></em> I downloaded the software around silicon valley in California (Use Google to be sure of unfamiliar words. E.g. Google can tell you that if you were hearing simicon Valley, confirming you will know that Silicon Valley is the correct Name since it’s known for being the home for giant Softwares and Tech companies.)
                </li>
                <li>
                  <em><strong>DFX/VoiceMeeter:</strong></em> Enhances audio (Not a must)
                </li>
                <li>
                  <em><strong>Grammarly extension:</strong></em> (Not a must)
                </li>
                <li>
                  <em><strong>TypingMaster:</strong></em> Improves typing speed.
                </li>
              </ul>

              <h3 className="sub-section-title"><u>NOTE</u></h3>
              <ul>
                <li>
                  A client will always indicate what type of transcript they want. Make sure to follow all the client's instructions to the last one. Failure to follow client's instructions leads to poor ratings, which will lead to removal from our platform.
                </li>
                <li>
                  If a client doesn't explicitly indicate what type of transcript they want, use the chat feature on the platform to ask for me details.
                </li>
                <li>
                  By default, you should transcribe Clean-Verbatim. Be sure to ask the client what format they prefer during your negotiation process.
                </li>
              </ul>

              <h3 className="sub-section-title"><u>Full-Verbatim and Clean-Verbatim transcription</u></h3>
              <h4 className="sub-sub-section-title"><u>Full verbatim:</u></h4>
              <p>Transcript where you include everything the speaker saying: Repetitions, stutters, stammers, filler words.</p>
              <h4 className="sub-sub-section-title"><u>Repetitions:</u></h4>
              <ul>
                <li>I went to Java Café for some-some-some coffee.</li>
                <li>I went to Java Café- Java Café- Java Café for some-some coffee.</li>
              </ul>
              <h4 className="sub-sub-section-title"><u>Stutters:</u></h4>
              <ul>
                <li>Um, Uh, Er, Hmm, Mm, Uh-uh, Uh-oh. Uh-huh, Mm-hmm (affirmatives), for example, I went, um, to the- to the, er, Java House.</li>
              </ul>
              <h4 className="sub-sub-section-title"><u>Stammers:</u></h4>
              <ul>
                <li>I went to Java for some co-co-co-coffee.</li>
              </ul>
              <h4 className="sub-sub-section-title"><u>Filler words:</u></h4>
              <ul>
                <li>You know, like, yeah, then, of course;</li>
              </ul>
              <h4 className="sub-sub-section-title"><u>Unnecessary Affirmatives/Negatives:</u></h4>
              <p>Lawrence: I was going to the church-</p>
              <p>James: Yes.</p>
              <p>Lawrence: When I heard a loud bang.</p>

              <h4 className="sub-sub-section-title"><u>Clean-Verbatim</u></h4>
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

              <h3 className="sub-section-title"><u>Most common tags:</u></h3>
              <ul>
                <li>
                  <strong>[unintelligible 00:00:00]:</strong> You can clearly hear what the speaker is saying but can’t make out the words he/she is saying. Accent.
                  <br />
                  Example: I was going to town by noon and I came across [unintelligible 00:02:12].
                </li>
                <li>
                  <strong>[inaudible 00:00:00]:</strong> You can’t hear at all maybe because of background noise.
                </li>
                <li>
                  <strong>[pause 00:00:00]:</strong> Must be more than 10 seconds speaker’s pause. Should be in line with speaker's text.
                  <br />
                  Example:
                  <br />
                  John: I was going to town by [pause 00:03:00] seven o’clock and I was already tired.
                </li>
                <li>
                  [silence]: (on its own line]
                </li>
                <li>
                  [laughs]: when one speaker laughs. (On its own line.)
                  <br />
                  E.g.
                  <br />
                  John: That must have been the craziest idea ever [laughs].
                </li>
                <li>
                  [laughter]: When more than one speaker laughs. (Must be on its own line]
                  <br />
                  E.g.
                  <br />
                  John: That must have been the craziest idea ever.
                  <br />
                  [laughter]
                  <br />
                  James: I totally agree with you. It was fun.
                </li>
                <li>
                  <strong>[crosstalk]:</strong> When more than one speaker speak at the same time and you cannot make out what one of the speaker is saying, or one speaker interrupts the other before finishes the sentence and you can’t hear their last words. Can be in line with speaker's text or on it's own line depending on the number of speakers crosstalking.
                  <br />
                  Example 1:
                  <br />
                  James: Hey, can I go to check [crosstalk] because I didn't see it last time.
                  <br />
                  John: Okay, I have to go now, I'm late.
                  <br />
                  Example 2:
                  <br />
                  Speaker 1: I was going to town by--
                  <br />
                  [crosstalk]
                  <br />
                  Speaker 2: Oh, wow that’s crazy.
                </li>
                <li>
                  [background noise]: Music, conversation that is not relevant to the audio. (On its own line).
                </li>
                <li>
                  [foreign language]: When a speaker speaks a language other than the one requested by the client.
                </li>
              </ul>

              <h3 className="sub-section-title">Timestamping:</h3>
              <ul>
                <li>a. Change of Speaker: Timestamp every change of speaker</li>
                <li>b. Intervals: Can be in seconds or minutes e.g. Every 30 seconds, every 1 minute, every 2 minutes, et cetera.</li>
              </ul>

              <p className="note-text"><strong>Note:</strong> Your test will be reviewed by our team. You'll be notified of the results within 24 hours.</p>
            </div>
            <button onClick={() => setCurrentSection('grammar')} className="start-test-btn">
              Start Test
            </button>
          </div>
        )}

        {currentSection === 'grammar' && (
          <div className="grammar-section">
            <h2 className="section-title">Part 1: Grammar Test</h2>
            <div className="questions-container">
              {grammarQuestions.map((q, index) => (
                <div key={q.id} className="question-card">
                  <h3 className="question-number">Question {index + 1}</h3>
                  <p className="question-text">{q.question}</p>
                  <div className="options">
                    {q.options.map((option, optionIndex) => (
                      <label key={optionIndex} className="option-label">
                        <input
                          type="radio"
                          name={`question_${q.id}`}
                          value={optionIndex}
                          onChange={() => handleGrammarAnswer(q.id, optionIndex)}
                          checked={testData.grammarAnswers[q.id] === optionIndex}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setCurrentSection('transcription')} className="next-btn">
              Next: Transcription Task
            </button>
          </div>
        )}

        {currentSection === 'transcription' && (
          <div className="transcription-section">
            <h2 className="section-title">Part 2: Transcription Task</h2>
            <div className="audio-section">
              <p className="audio-instructions"><strong>Instructions:</strong> Listen to the audio below and transcribe exactly what you hear following the guidelines. Use `**text**` for bold and `*text*` for italics.</p>

              {/* NEW: Placeholder for audio element */}
              <div className="audio-player-container">
                <audio controls src="/sample_audio_for_test.mp3"> {/* Placeholder source */}
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div className="transcription-input">
                <label className="transcription-label">Your Transcription:</label>
                <textarea
                  value={testData.transcriptionText}
                  onChange={handleTranscriptionChange}
                  placeholder="Type your transcription here... Use **double asterisks** for bold and *single asterisks* for italics."
                  rows="10"
                />
              </div>
            </div>

            <div className="test-actions">
              <button onClick={() => setCurrentSection('grammar')} className="back-btn">
                Back to Grammar
              </button>
              {/* FIX: Corrected onClick handler to call handleTestSubmit */}
              <button onClick={handleTestSubmit} className="submit-btn" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>
          </div>
        )}

        {message && <p className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>{message}</p>}
      </div>
    </div>
  );
};

export default TranscriberTest;
