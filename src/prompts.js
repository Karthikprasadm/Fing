// prompts.js — Feature definitions with interview-category-aware system prompts.
// ctx = { transcript, userText }
// System prompt receives the interview context block prepended by main.js,
// then optionally the user's AI rules appended at the end.

const { appendAiRules } = require('./profile-context');

function formatTranscript(turns, limit) {
  const recent = limit ? turns.slice(-limit) : turns;
  return recent.map((t) => (t.channel === 'them' ? 'Them: ' : 'You: ') + t.text).join('\n');
}

function buildSystem(base, contextBlock) {
  if (!contextBlock) return base;
  return contextBlock + '\n\n' + base;
}

// Apply AI rules to a system prompt if the mode wants them. LeetCode returns
// the prompt unchanged — code answers should stay strict regardless of how the
// user wants the AI to chat.
function applyRules(prompt, aiRules, mode) {
  if (mode === 'leetcode') return prompt;
  return appendAiRules(prompt, aiRules);
}

const BASE_RULES =
  'Always respond in clear, natural English. Never switch to Hindi or any other language unless the user explicitly asks for it. ';

const MODES = {

  // ── Assist: screen analysis and instant solution ─────────────────────────
  assist: {
    needsScreen: true,
    userBubble: 'Screen Analysis',
    small: false,
    resumeMode: 'assist',
    buildSystem(contextBlock, aiRules) {
      return applyRules(buildSystem(
        'You are cue, an expert real-time AI copilot with vision of the user\'s screen. ' +
        BASE_RULES +
        'Your goal is to inspect the attached screenshot of the user\'s screen (and any conversation), understand what is currently displayed, and provide the exact answer, code, or response needed right now.\n\n' +
        'Action Instructions based on what is shown on screen:\n' +
        '• CODING / LEETCODE / TERMINAL / IDE: Identify the problem, function, bug, or question on screen. Write the clean, optimal code solution directly with a 1-2 sentence explanation.\n' +
        '• MULTIPLE CHOICE / ONLINE ASSESSMENT / QUIZ: Identify the active question and choices on screen. State the correct answer clearly.\n' +
        '• INTERVIEW / VIDEO CALL: If an interviewer or question prompt is on screen, provide the natural first-person answer to say out loud.\n' +
        '• SLIDES / DIAGRAMS / DOCS / EMAILS: Explain what is being presented or drafted and what response is expected.\n\n' +
        'Write in first person as appropriate. Deliver the answer directly with no preamble, no greeting, and no quotes. Just the solution/answer.',
        contextBlock
      ), aiRules, 'assist');
    },
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 14);
      let prompt = 'Carefully inspect the user\'s screen in the attached screenshot.\n';
      if (t) {
        prompt += 'Recent conversation audio:\n' + t + '\n\n';
      }
      prompt += 'What is on the screen right now? Solve the problem, answer the question, or provide the exact response to what is currently happening or shown on the screen.';
      return prompt;
    }
  },

  // ── Say: what to say next ──────────────────────────────────────────────────
  say: {
    needsScreen: false,
    userBubble: 'What should I say?',
    small: false,
    resumeMode: 'say',
    buildSystem(contextBlock, aiRules) {
      return applyRules(buildSystem(
        'You are cue, whispering the perfect reply to the candidate during a live interview. ' +
        BASE_RULES +
        '"Them" is the interviewer; "You" is the candidate.\n\n' +
        'Draft ONE natural, confident reply the candidate can say out loud, in first person.\n\n' +
        'Rules by question type:\n' +
        '• BEHAVIORAL: Use a real STAR story from their background. Situation (1 sentence) → Task (1 sentence) → Action (2–3 sentences, specific steps) → Result (1 sentence with metric if possible). Never generic.\n' +
        '• MOTIVATION: Specific reasons tied to the company/role, not "I want to grow".\n' +
        '• SITUATIONAL: Show structured thinking — "I\'d first X, then Y, because Z".\n' +
        '• EXPERIENCE: Reference the specific role/project from their resume.\n' +
        '• COMPENSATION: State the target range confidently without over-explaining.\n' +
        '• TECHNICAL: Give a clear, confident explanation. Use analogies for non-technical interviewers.\n\n' +
        'No quotes, no preamble. Write the actual words to say. 2–5 sentences.',
        contextBlock
      ), aiRules, 'say');
    },
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 16);
      return 'Interview conversation so far:\n' + (t || '(listening not started yet)') +
        '\n\nWhat should I say next?';
    }
  },

  // ── Follow-up questions ────────────────────────────────────────────────────
  followup: {
    needsScreen: false,
    userBubble: 'Follow-up questions',
    small: true,
    resumeMode: 'followup',
    buildSystem(contextBlock, aiRules) {
      return applyRules(buildSystem(
        'You are cue. Suggest 2–4 sharp follow-up questions the candidate could ask the interviewer.\n' +
        'Base them on what was discussed and the candidate\'s background/target role.\n' +
        'Good follow-ups: show genuine curiosity, demonstrate research, highlight the candidate\'s strengths, or uncover role details.\n' +
        'Return as a bullet list only. No preamble.',
        contextBlock
      ), aiRules, 'followup');
    },
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 20);
      return 'Conversation so far:\n' + (t || '(none)') + '\n\nSuggest follow-up questions for the interviewer.';
    }
  },

  // ── Recap ──────────────────────────────────────────────────────────────────
  recap: {
    needsScreen: false,
    userBubble: 'Recap',
    small: true,
    resumeMode: 'recap',
    buildSystem(contextBlock, aiRules) {
      return applyRules(buildSystem(
        'You are cue. Summarize the interview so far:\n' +
        '• Topics covered\n• Questions asked\n• Key answers given\n• Any red flags or areas to strengthen\n' +
        'Use short bullets under bold headers. Be concise.',
        contextBlock
      ), aiRules, 'recap');
    },
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 0);
      return 'Full interview transcript:\n' + (t || '(nothing captured yet)') + '\n\nRecap this interview.';
    }
  },

  // ── Ask: free-form question ────────────────────────────────────────────────
  ask: {
    needsScreen: true,
    userBubble: null,
    small: false,
    resumeMode: 'ask',
    buildSystem(contextBlock, aiRules, extra) {
      const hasScreen = !extra || extra.hasScreen !== false;
      if (hasScreen) {
        return applyRules(buildSystem(
          'You are cue, an expert real-time AI copilot with direct vision of the user\'s screen. ' +
          BASE_RULES +
          'Carefully analyze the attached screenshot of the user\'s screen to answer the user\'s question or request.\n' +
          'If the user is asking about code, a problem, text, a quiz, an interface, or anything on their screen, read it directly from the screenshot and solve or answer it completely.\n' +
          'Direct, concise, actionable response with no preamble.',
          contextBlock
        ), aiRules, 'ask');
      }
      return applyRules(buildSystem(
        'You are cue, an expert AI copilot. ' +
        BASE_RULES +
        'Answer the user\'s question or request clearly, accurately, and directly based only on what they asked, without referencing any screen or background windows.\n' +
        'Deliver the answer directly with no preamble, no greeting, and no quotes.',
        contextBlock
      ), aiRules, 'ask');
    },
    build(ctx, extra) {
      const hasScreen = !extra || extra.hasScreen !== false;
      const t = formatTranscript(ctx.transcript, 12);
      let prompt = '';
      if (hasScreen) {
        prompt = 'Carefully inspect the user\'s screen in the attached screenshot to answer their request:\n\n';
      }
      prompt += 'User Request: ' + (ctx.userText || 'Analyze what is on my screen and provide the answer/solution.');
      if (t) {
        prompt += '\n\nRecent conversation:\n' + t;
      }
      return prompt;
    }
  },

  // ── Answer This: answer one specific transcript question ─────────────────
  answerThis: {
    needsScreen: false,
    userBubble: null,   // bubble set dynamically from the question text
    small: false,
    resumeMode: 'say',  // same context budget as 'say'
    buildSystem(contextBlock, aiRules) {
      return applyRules(buildSystem(
        'You are cue, whispering a direct answer to the candidate for ONE specific question. ' +
        BASE_RULES +
        'The interviewer\'s exact question is provided below. Focus ONLY on answering that question — ignore any other conversation context.\n\n' +
        'Rules:\n' +
        '• BEHAVIORAL ("tell me about a time…"): STAR format using real stories from the candidate\'s background. Situation → Task → Action → Result. Include metrics if available.\n' +
        '• MOTIVATION ("why this company/role"): Specific, genuine reasons from their stated preferences.\n' +
        '• TECHNICAL: Clear explanation with a concrete example from their experience.\n' +
        '• EXPERIENCE: Reference specific roles/projects from their resume.\n' +
        '• COMPENSATION: State the salary target confidently in one sentence.\n' +
        '• SITUATIONAL: Structured thinking — "First I would X, then Y, because Z."\n\n' +
        'Write in first person, as the candidate speaking. No preamble. 2–5 sentences.',
        contextBlock
      ), aiRules, 'answerThis');
    },
    build(ctx) {
      // Only pass the specific question — not the full transcript history
      return 'Answer this specific interview question:\n\n"' + (ctx.userText || '(no question provided)') + '"\n\nGive the full answer the candidate should say out loud.';
    }
  },

  // ── LeetCode: pure coding solver — no personal context, no AI rules ─────
  leetcode: {
    needsScreen: true,
    userBubble: 'Solve what\'s on screen',
    small: false,
    resumeMode: 'leetcode',
    buildSystem(_contextBlock, _aiRules) {
      // Context block AND aiRules intentionally ignored — code answers must
      // stay strict regardless of personal style or context.
      return 'You are an expert competitive programmer. The screenshot contains a coding problem. ' +
        'Respond with: (1) a one-line restatement, (2) a short approach, (3) a clean, correct, idiomatic solution in a fenced code block ' +
        '(use the language shown on screen, else Python), (4) time and space complexity. Keep prose tight.';
    },
    build() { return 'Solve the coding problem shown in the screenshot.'; }
  }
};

module.exports = { MODES, formatTranscript };