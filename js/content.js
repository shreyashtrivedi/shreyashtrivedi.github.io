// All the words on the site live here.
window.CONTENT = {
  name: 'Sreyash Trivedi',
  monogram: 'ST',
  maker: 'S · TRIVEDI', // gold lettering on the piano's name board
  email: 'trivedishreyash621@gmail.com',
  resume: '', // the résumé view's "PDF" link: set to 'assets/resume.pdf' once the file is there (it's hidden until then)

  links: [
    { label: 'GitHub', url: 'https://github.com/shreyashtrivedi' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/sreyash-trivedi-3b7053287/' },
    { label: 'LeetCode', url: 'https://leetcode.com/u/Shreyash_trivedi/' },
    { label: 'Codeforces', url: 'https://codeforces.com/profile/trivedishreyash621' },
  ],

  // The entry page.
  intro: {
    kicker: 'Portfolio · 2026',
    lead: 'Final-year computer science student who builds infrastructure, data pipelines and machine-learning systems, and plays the piano.',
  },

  // The slideshow over the keys, one point at a time. `links: true` shows the contact links.
  slides: [
    {
      kicker: 'About',
      title: 'Final-year CSE undergraduate at RGIPT',
      text: 'Comfortable with ambiguous, large-scale data and systems problems.',
      meta: 'B.Tech · 2023 – 2027 · CGPA 9.04 / 10',
    },
    {
      kicker: 'Experience · Accenture',
      title: 'Associate Software Engineering Intern',
      text: 'Production enterprise Linux (RHEL/CentOS): patch management, server operations, incidents and escalations.',
      meta: 'Infrastructure Services · May – Jul 2026',
    },
    {
      kicker: 'Achievement',
      title: 'Top 3% in the Amazon ML Challenge 2026',
      text: 'Ranked ~300 of 10,000+ teams, working in a team of four.',
      meta: 'Macro F0.5 0.9875',
    },
    // Project slides are filled in from `projects` below; clicking one opens its record.
    { project: 'leash' },
    { project: 'rgipt-assistant' },
    { project: 'edify' },
    {
      kicker: 'Skills · AI & Retrieval',
      title: 'LLMs, RAG and AI agents (MCP)',
      text: 'Generative AI and hybrid search: the stack behind Leash, RGIPT Assistant and Edify.',
      meta: 'Hugging Face · ChromaDB',
    },
    {
      kicker: 'Skills · ML & Data',
      title: 'PyTorch, TensorFlow, scikit-learn',
      text: 'Supervised learning and classification, with pandas and NumPy.',
      meta: 'Plus stacked LightGBM in the Amazon ML Challenge',
    },
    {
      kicker: 'Skills · Languages & Backend',
      title: 'Python, C++, TypeScript',
      text: 'Also C, JavaScript, SQL, HTML, CSS and Bash.',
      meta: 'FastAPI · Node.js · REST APIs · React · SQLite · MongoDB',
    },
    {
      kicker: 'Skills · Cloud & Tools',
      title: 'Docker, Kubernetes, AWS',
      text: 'And Linux (RHEL/CentOS), supported in production at Accenture.',
      meta: 'Git · Jupyter Notebooks · VS Code · Agile/Scrum',
    },
    {
      kicker: 'Problem solving',
      title: '500+ algorithmic problems solved',
      text: 'On LeetCode, Codeforces and other platforms.',
      meta: 'DSA · Design & Analysis of Algorithms · Discrete Mathematics',
    },
    {
      kicker: 'Beyond code',
      title: 'Teaching assistant and volunteer',
      text: 'UG Teaching Assistant for Electronics Engineering and Modern Physics, and a volunteer teaching rural children at Gyanarpan. And obviously a pianist :)',
      meta: '',
    },
    {
      kicker: 'Contact',
      title: 'Let’s build something together.',
      text: 'Open to full-time roles in software, AI and ML engineering.',
      meta: 'trivedishreyash621@gmail.com',
      links: true,
    },
  ],

  // The plain résumé view mirrors the PDF résumé: education, coursework, skills, experience,
  // projects (each project's `resume` entry) and achievements.
  about: '', // an optional summary at the top of the résumé view; the PDF has none
  coursework: [
    'Data Structures & Algorithms', 'Design & Analysis of Algorithms', 'Linear Algebra', 'Probability', 'Statistical Methods',
    'Discrete Mathematics', 'Operational Research (Linear Programming)', 'Operating Systems', 'DBMS',
  ],

  education: [
    { school: 'Rajiv Gandhi Institute of Petroleum Technology, Jais, Amethi', degree: 'B.Tech. in Computer Science and Engineering', score: 'CGPA 9.04 / 10', period: '2023 – 2027' },
    { school: 'SJS Public School', degree: 'Senior Secondary (CBSE) 93.4% · Secondary (CBSE) 95.8%', score: '', period: '2020 – 2022' },
  ],

  skills: [
    { group: 'Languages', items: ['Python', 'C++', 'C', 'TypeScript', 'JavaScript', 'SQL', 'HTML', 'CSS', 'Bash'] },
    { group: 'AI & Retrieval', items: ['LLMs', 'Generative AI', 'AI Agents (MCP)', 'RAG', 'Hybrid Search', 'Hugging Face', 'ChromaDB'] },
    { group: 'ML & Data', items: ['Supervised Learning', 'Classification', 'PyTorch', 'TensorFlow', 'scikit-learn', 'pandas', 'NumPy'] },
    { group: 'Backend', items: ['FastAPI', 'Node.js', 'REST APIs', 'React', 'SQLite', 'MongoDB (NoSQL)'] },
    { group: 'Cloud & Tools', items: ['Docker', 'Kubernetes', 'AWS', 'Linux (RHEL/CentOS)', 'Git', 'Jupyter Notebooks', 'VS Code', 'Agile/Scrum'] },
  ],

  experience: [
    {
      role: 'Associate Software Engineering Intern',
      org: 'Accenture · Infrastructure Services',
      period: 'May 2026 – July 2026',
      points: [
        'Supported production Linux (RHEL/CentOS) servers: patching, server architecture, and operations.',
        'Practiced Agile/Scrum methodology while working production support across incidents, service requests, maintenance windows, and escalations.',
        'Applied security, compliance, and automation practices; worked with backup platforms (Nasuni, Cohesity).',
      ],
    },
  ],

  // Each project is presented as a vintage record: its case study opens as a full-screen
  // album page, one "track" per part of the story.
  //
  // id         used in links (#record/<id>); the songs and covers for each record are in js/albums.js under this id
  // genre      the title style: 'indie', 'hand', 'clean', 'jazz', 'psych' (60s pop) or 'blues'
  // label      the kind of project, shown like a music genre
  // stackLine  the stack in one line, for the slide over the keys and the résumé
  // problem    the problem, in a few sentences                   → track "The Problem"
  // build      what you built and how, with `highlights`         → track "The Build" (highlights are résumé bullets too)
  // flow       the architecture as a diagram                      → track "Signal Flow"
  //              rows: [{ note?, nodes: [node, ...] }, ...]  top to bottom; each node wires to the row above
  //                    (one to many, many to one, or side by side); `from: ['id', ...]` wires it to chosen nodes,
  //                    and `end: true` stops a branch
  //              lanes: [{ title, sub, rows }, ...]  instead of rows, for pipelines that run side by side
  //              aside: [node, ...]  parts that sit alongside the main path
  //              node:  { t: title, s: one line, k: kind, key?: true (highlighted), tag?: 'Allow', tone?: 'go'|'wait'|'stop', id? }
  //              kinds: 'user', 'agent', 'code', 'decision', 'ai', 'store', 'ext' (outside service), 'ui'
  // shots      screenshots: { src, w, h, caption }               → track "Liner Photos"
  // metrics    results; tier is 'platinum', 'gold' or 'silver'   → track "Chart Positions"
  // stack      tools, credited like session musicians            → track "Personnel"
  // links      the first link is the main button; `next` closes the story  → track "Encore"
  // period     when it was built, as on the résumé
  // resume     the project as the PDF résumé words it: { title, stack, bullets } → the plain résumé view
  projects: [
    {
      id: 'leash',
      genre: 'indie',
      title: 'Leash',
      label: 'AI agents · Payments',
      year: '2026',
      tagline: 'A payment firewall for AI agents. The AI proposes; the code decides.',
      stackLine: 'TypeScript · MCP · PayPal APIs · SQLite · React',
      problem: 'AI agents are starting to buy things, but a payment credential is all or nothing. Once an agent holds the key, a bad prompt, a looping bug or a poisoned web page can spend whatever that key allows. Writing a spending limit into the prompt isn’t a control, because the model being limited is the one enforcing the limit.',
      build: 'Leash is an MCP server that sits between any AI agent and PayPal. The agent never sees PayPal credentials. It only gets tools, and every call goes through a policy engine written as a pure function: per-payment caps, daily and total budgets, verified vendors, blocked categories, a payments-per-hour limit and a 24-hour limit per recipient. Each payment is allowed, blocked with the exact rule that stopped it, or held as an unsigned cheque on a live dashboard until a human approves. AI only drafts policies from plain English and summarises decisions once they are final; it is never in the decision path. Built for the Build What’s Next with PayPal and AI hackathon, against the PayPal sandbox.',
      highlights: [
        'Agents never hold PayPal credentials: every payment passes 11 deterministic rules before any money moves.',
        'Catches split payments: five $24 payments to one recipient trip the 24-hour per-recipient limit and go to a human.',
        'Race-free budgets: checking and reserving happen in one SQLite transaction, so parallel calls can’t spend the same money twice.',
        'Hash-chained, append-only audit log, 180+ tests, and a script that attacks every rule over real MCP and checks each result with PayPal.',
      ],
      flow: {
        rows: [
          { nodes: [{ k: 'agent', t: 'AI agent', s: 'Claude Desktop, Cursor or your own code' }] },
          { note: 'MCP · holds only a Leash key', nodes: [{ k: 'code', t: 'Leash MCP tools', s: 'pay · refund · create_invoice · check_approval' }] },
          { nodes: [{ k: 'decision', key: true, t: 'Policy engine', s: '11 rules in plain, deterministic code. No LLM.' }] },
          {
            nodes: [
              { id: 'allow', tag: 'Allow', tone: 'go', t: 'Pays at once', s: 'The real PayPal transaction ID goes back to the agent' },
              { id: 'hold', tag: 'Hold', tone: 'wait', t: 'Waits for you', s: 'An unsigned cheque on the dashboard; rules re-checked on approval' },
              { id: 'block', tag: 'Block', tone: 'stop', t: 'Refused', s: 'The agent gets the exact rule that stopped it', end: true },
            ],
          },
          { nodes: [{ k: 'ext', t: 'PayPal sandbox', s: 'Payouts, Payments and Invoicing APIs. Only Leash holds the keys.', from: ['allow', 'hold'] }] },
        ],
        aside: [
          { k: 'store', t: 'Audit trail', s: 'SQLite, hash-chained and append-only' },
          { k: 'ui', t: 'Live dashboard', s: 'React and AG Grid, updated over SSE' },
          { k: 'ai', t: 'Groq · gpt-oss-120b', s: 'Drafts policies and explains decisions; never makes them' },
        ],
      },
      shots: [
        { src: 'assets/shots/leash/overview.jpg', w: 1280, h: 800, caption: 'The live firewall: what was paid, stopped, or is waiting for you' },
        { src: 'assets/shots/leash/audit-log.jpg', w: 1280, h: 800, caption: 'The audit log, with its hash chain checked on every view' },
        { src: 'assets/shots/leash/policy.jpg', w: 1280, h: 800, caption: 'Rules written in plain English, drafted by AI, saved by a human' },
      ],
      metrics: [
        { value: '11', label: 'policy rules, all in plain code', tier: 'platinum' },
        { value: '180+', label: 'automated tests', tier: 'gold' },
        { value: '0', label: 'LLM calls in the decision path', tier: 'silver' },
      ],
      stack: [
        { name: 'Model Context Protocol', role: 'how agents plug in' },
        { name: 'PayPal APIs', role: 'payouts, refunds and invoices' },
        { name: 'TypeScript · Express', role: 'the server and the policy engine' },
        { name: 'SQLite', role: 'budgets and the audit trail' },
        { name: 'React · AG Grid', role: 'the live dashboard' },
        { name: 'Groq', role: 'policy drafts and summaries' },
        { name: 'Vitest · Render', role: 'the tests and the hosted demo' },
      ],
      links: [
        { label: 'Live demo', url: 'https://leash-o4p1.onrender.com' },
        { label: 'View the code', url: 'https://github.com/shreyashtrivedi/Leash' },
      ],
      next: 'The demo runs on a free host that sleeps when idle, so the first visit can take a minute. Next: real user accounts in place of one shared approval password, and a per-recipient limit that follows a recipient across agents.',
      period: 'Nov 2026',
      resume: {
        title: 'Leash: Payment Firewall for AI Agents',
        stack: 'TypeScript, Node.js, MCP, PayPal APIs, React, SQLite, Groq',
        bullets: [
          'Built a TypeScript MCP server letting AI agents pay via PayPal tool calls without holding credentials; a deterministic policy engine (11 rule types) executes, blocks, or escalates each payment for human approval.',
          'Integrated PayPal Payouts, Payments and Invoicing APIs; stopped split-payment and parallel-request overspending with per-recipient 24-hour limits and atomic database transactions.',
          'Shipped a live React dashboard with human approval and a hash-chained audit log, backed by 180+ tests and written documentation; an LLM (Groq) drafts policies for human review but never makes payment decisions.',
        ],
      },
    },
    {
      id: 'rgipt-assistant',
      genre: 'hand',
      title: 'RGIPT Assistant',
      label: 'RAG · Search',
      year: '2026',
      tagline: 'Ask the RGIPT website anything. It answers only from the site’s own pages and PDFs, and shows its sources.',
      stackLine: 'Python · FastAPI · ChromaDB · BM25 · Gemini · Docker',
      problem: 'RGIPT’s website spreads its answers across 600 pages and PDFs: fee structures, admission notices, placement reports. 284 of those PDFs are scanned images that no search box can read. Students and applicants end up digging through notices, and a general chatbot will happily invent a fee or a date.',
      build: 'A retrieval-augmented chatbot with source citations. A crawler collects the site, Gemini OCR recovers the scanned PDFs, and everything becomes 3,587 chunks embedded with BGE. Each question runs two searches, BGE vectors and BM25 keywords, merged with reciprocal rank fusion, and Gemini answers only from the six passages found, citing each one and trusting current pages over old PDFs. A 34-question evaluation set measured every change along the way. For $0 hosting, the vectors later moved from ChromaDB to a NumPy index with identical results, so the whole app runs in about 320 MB, with a 3-model Gemini fallback, an answer cache, rate limits and a one-line embeddable widget.',
      highlights: [
        'Hybrid search, BGE embeddings plus BM25 merged with reciprocal rank fusion, finds the right source for 100% of test questions in the top 6 (MRR 0.836) in about 21 ms.',
        'Raised answer accuracy from 88% to 100% on a 34-question evaluation set built to measure each change.',
        'Ablated a cross-encoder reranker: 0.6–3 s slower per query with no gain in hit rate, so it stays off by default.',
        'Recovered fees and placement data from 284 scanned PDFs with Gemini OCR, in a pipeline that resumes where it stopped.',
      ],
      flow: {
        lanes: [
          {
            title: 'Building the index',
            sub: 'offline, once per crawl',
            rows: [
              { nodes: [{ k: 'ext', t: 'rgipt.ac.in', s: '600 pages and PDFs, crawled politely' }] },
              { nodes: [{ k: 'ai', t: 'Gemini OCR', s: 'Recovers 284 scanned PDFs, tables included' }] },
              { nodes: [{ k: 'code', t: 'Chunker', s: '~300-token chunks; split tables keep their headers' }] },
              { nodes: [{ k: 'ai', t: 'Search questions', s: 'Gemini writes how people would ask, so short pages get found' }] },
              { nodes: [{ k: 'store', key: true, t: 'Index', s: '3,587 chunks with BGE vectors (ChromaDB, now NumPy)' }] },
            ],
          },
          {
            title: 'Answering a question',
            sub: 'live, in under 10 seconds',
            rows: [
              { nodes: [{ k: 'user', t: 'A question', s: 'From the chat page or the one-line website widget' }] },
              {
                nodes: [
                  { k: 'code', t: 'Vector search', s: 'Same meaning, with BGE embeddings' },
                  { k: 'code', t: 'BM25 search', s: 'Same words: names, “JEE”, “M.Tech”' },
                ],
              },
              { nodes: [{ k: 'decision', key: true, t: 'Rank fusion', s: 'RRF keeps the best 6, in about 21 ms' }] },
              { nodes: [{ k: 'ai', t: 'Gemini', s: 'Answers only from those passages, citing each one' }] },
              { nodes: [{ k: 'ui', t: 'Answer + sources', s: 'Cached for repeats; rate-limited per visitor' }] },
            ],
          },
        ],
      },
      shots: [
        { src: 'assets/shots/rgipt-assistant/chat.jpg', w: 1280, h: 800, caption: 'The live chat: answers come only from rgipt.ac.in, with their sources' },
      ],
      metrics: [
        { value: '100%', label: 'right source in the top 6 (MRR 0.836)', tier: 'platinum' },
        { value: '100%', label: 'answer accuracy on 34 questions, up from 88%', tier: 'gold' },
        { value: '~21 ms', label: 'per hybrid search', tier: 'silver' },
        { value: '$0', label: 'to host, with a 3-model Gemini fallback', tier: 'silver' },
      ],
      stack: [
        { name: 'Python · FastAPI', role: 'the crawler, the index and the API' },
        { name: 'Google Gemini', role: 'answers, OCR and search questions' },
        { name: 'BGE embeddings', role: 'semantic search, run through ONNX' },
        { name: 'ChromaDB → NumPy', role: 'the vector index' },
        { name: 'BM25', role: 'keyword search' },
        { name: 'PyMuPDF · BeautifulSoup', role: 'reading pages and PDFs' },
        { name: 'Docker · Render', role: 'packaging and $0 hosting' },
      ],
      links: [
        { label: 'Live demo', url: 'https://rgipt-rag.onrender.com' },
        { label: 'View the code', url: 'https://github.com/shreyashtrivedi/rgipt-rag' },
      ],
      next: 'The demo runs on a free host that sleeps when idle, so the first visit can take a minute. Next: a scheduled re-crawl, so answers stay as current as the website.',
      period: 'Oct 2026',
      resume: {
        title: 'RGIPT Assistant: RAG Chatbot for a College Website',
        stack: 'Python, FastAPI, ChromaDB, BGE embeddings, BM25, Gemini, Docker',
        bullets: [
          'Built a RAG chatbot with source citations over 600 crawled pages and PDFs (3,587 chunks); hybrid search (BGE embeddings in ChromaDB + BM25, RRF) finds the right source for 100% of test questions in the top 6 (MRR 0.836, ~21 ms).',
          'Raised answer accuracy from 88% to 100% on a 34-question evaluation set; ablated a cross-encoder reranker (+0.6–3 s, no hit-rate gain) and left it off by default.',
          'Recovered unstructured data from 284 scanned PDFs (fees, placements) with Gemini OCR in a resumable pipeline.',
          'Deployed on Docker at $0: 3-model Gemini fallback, answer cache, rate limits, one-line embeddable widget.',
        ],
      },
    },
    {
      id: 'edify',
      genre: 'clean',
      title: 'Edify',
      label: 'Generative AI · EdTech',
      year: '2026',
      tagline: 'Type a topic, get a full course: modules, lessons, real videos, quizzes, Hinglish audio and an AI tutor.',
      stackLine: 'React · Node.js · Express · MongoDB · Gemini · Auth0',
      problem: 'Learning a new topic online means stitching together scattered videos, articles and quizzes with no structure. Asking a chatbot instead gets you a wall of text, links that don’t exist and no way to check what you’ve learned.',
      build: 'Edify turns one prompt into a course of 3–6 modules. The outline comes from a single schema-constrained Gemini call, and each lesson is written only when someone first opens it: objectives, explanations, highlighted code, a quiz graded on the server, readings, and a real YouTube video found through the YouTube Data API. Lessons can be exported as searchable PDFs, heard as a one-minute Hinglish summary recorded with Gemini text-to-speech, and questioned with a tutor that streams answers grounded in the lesson. React on Vercel, Express on Render, MongoDB Atlas, Auth0 and per-user rate limits, with CI gating every deploy.',
      highlights: [
        'Two-stage generation: one fast outline call, then each lesson is written on first open, so a 20-lesson course doesn’t cost 20 generations up front.',
        'Reliable AI output: schema-constrained decoding for outlines, and JSON mode with zod validation and repair for large lessons.',
        'No invented links: the AI writes a search query and the server picks a real, embeddable YouTube video, cached to stretch the daily quota.',
        'A streaming tutor grounded in each lesson, which replies in Hinglish when asked in Hinglish; 142 tests and CI on every push.',
      ],
      flow: {
        rows: [
          { nodes: [{ k: 'user', t: 'A topic', s: '“Intro to React Hooks”, at your level' }] },
          { nodes: [{ k: 'ai', t: 'Course outline', s: 'One schema-constrained Gemini call, about 3 s' }] },
          { note: 'when a lesson is first opened', nodes: [{ k: 'ai', key: true, t: 'Lesson writer', s: 'Gemini JSON mode, checked and repaired by zod' }] },
          {
            nodes: [
              { k: 'ext', t: 'YouTube Data API', s: 'Turns the AI’s search into a real video' },
              { id: 'db', k: 'store', t: 'MongoDB Atlas', s: 'Saved once, instant afterwards' },
            ],
          },
          {
            note: 'on demand',
            nodes: [
              { k: 'ai', t: 'Hinglish audio', s: 'Gemini script and voice', from: ['db'] },
              { k: 'ai', t: 'Ask a doubt', s: 'A tutor that streams from the lesson', from: ['db'] },
              { k: 'ui', t: 'PDF export', s: 'Searchable text, made in the browser', from: ['db'] },
            ],
          },
        ],
        aside: [
          { k: 'ext', t: 'Auth0', s: 'Login; every API call carries a verified token' },
          { k: 'code', t: 'React app · Express API', s: 'Hosted on Vercel and Render' },
          { k: 'code', t: 'GitHub Actions', s: '142 tests, then automatic deploys' },
        ],
      },
      shots: [
        { src: 'assets/shots/edify/home.jpg', w: 1280, h: 800, caption: 'Generate a course from any topic, at your level' },
        { src: 'assets/shots/edify/course.jpg', w: 1280, h: 800, caption: 'The course outline, with progress, PDF export and sharing' },
        { src: 'assets/shots/edify/lesson.jpg', w: 1280, h: 900, caption: 'A lesson with a matched video and highlighted code' },
        { src: 'assets/shots/edify/tutor.jpg', w: 1280, h: 900, caption: '“Ask a doubt”: the tutor answers in Hinglish, from the lesson' },
      ],
      metrics: [
        { value: '≈3 s', label: 'from a topic to a full course outline', tier: 'platinum' },
        { value: '142', label: 'automated tests, run on every push', tier: 'gold' },
        { value: '1.4 s', label: 'until the tutor’s first words', tier: 'silver' },
        { value: '0', label: 'accessibility violations, light and dark', tier: 'silver' },
      ],
      stack: [
        { name: 'React · Vite · Tailwind', role: 'the app, in light and dark' },
        { name: 'Node.js · Express', role: 'the API' },
        { name: 'MongoDB Atlas', role: 'courses, progress and chats' },
        { name: 'Google Gemini', role: 'outlines, lessons, the tutor and the voice' },
        { name: 'YouTube Data API', role: 'a real video for every lesson' },
        { name: 'Auth0', role: 'login and private libraries' },
        { name: 'Vitest · GitHub Actions', role: '142 tests on every push' },
        { name: 'Vercel · Render', role: 'hosting, deployed from main' },
      ],
      links: [
        { label: 'Live demo', url: 'https://edify-gold.vercel.app' },
        { label: 'View the code', url: 'https://github.com/shreyashtrivedi/Edify' },
      ],
      next: 'What it taught me: making AI output reliable is mostly engineering. Schemas, validation, retries, and telling people the truth when the model is overloaded.',
      period: 'Oct 2026',
      resume: {
        title: 'Edify: AI-Powered Course Generator',
        stack: 'React, Node.js, Express, MongoDB, Google Gemini, Auth0',
        bullets: [
          'Built and deployed a full-stack app that turns any topic into a complete course (lessons with code examples, quizzes, YouTube videos) via a two-stage Gemini pipeline that writes each lesson on first open, with schema-validated JSON output.',
          'Added a streaming AI tutor, one-minute Hinglish audio summaries (Gemini TTS), PDF export, progress tracking and shareable links, secured with Auth0 and per-user rate limits.',
          'Wrote 142 tests (Vitest, Supertest) with GitHub Actions CI gating Vercel and Render deploys; dark mode, responsive, 0 violations on an axe accessibility audit.',
        ],
      },
    },
  ],

  achievements: [
    'Amazon ML Challenge 2026 (team of 4): ~300 of 10,000+ teams (top 3%), macro F0.5 0.9875; matched 1.7M businesses to ~10M records (blocking: 15× fewer pairs, 98.8% recall), stacked LightGBM, 1:1 matching (OOF F0.5 0.9867).',
    'Problem solving: 500+ algorithmic problems solved on LeetCode, Codeforces, and other platforms.',
    'UG Teaching Assistant (Electronics Engg. & Modern Physics) | Volunteer, Gyanarpan (teaching rural children).',
  ],
};
