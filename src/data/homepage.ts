// Homepage copy, taken word for word from the v1 page (https://tj-digital-preview.pages.dev/v1/).
// Every visible word on the page comes from this file. Do not edit, trim or add words here.

export const meta = {
  title: 'AI SEO Agency for SEO and GEO Campaigns | TJ Digital',
  description:
    'TJ Digital is the AI SEO agency that shows its work. SEO and GEO campaigns from $1,900 a month, AI-native websites, and no long-term contracts.',
};

export const links = {
  contact: 'https://tjrobertson.com/contact/',
  about: 'https://tjrobertson.com/about-us/',
  email: 'tj@tjrobertson.com',
  mailto: 'mailto:tj@tjrobertson.com',
};

// v1's navigation labels. They also serve as the small pill labels above section headings.
export const nav = [
  { label: 'Videos', href: '#videos' },
  { label: 'What we do', href: '#services' },
  { label: 'Results', href: '#results' },
  { label: 'Working with us', href: '#working' },
  { label: 'Questions', href: '#questions' },
];

export const cta = { label: 'Send an inquiry', href: links.contact };

export const hero = {
  // Rendered on two lines, the second in the accent color.
  h1: ['The AI SEO agency', 'that shows its work'],
  lead: "We help small and medium businesses show up in Google and in the answers people get from ChatGPT, Google AI Mode and Perplexity. Claude does most of the hands-on work, people review all of it, and we tell you plainly how it's done.",
  buttons: [
    { label: 'Send an inquiry', href: links.contact, primary: true },
    { label: 'Watch the videos', href: '#videos', primary: false },
  ],
  person: { name: 'TJ Robertson', role: 'Founder and Lead Strategist' },
  // Each item is v1's sentence split into a bold lead and the rest (lead + ' ' + rest = v1's text).
  trust: [
    { text: 'Peec AI Trusted Partner', lead: 'Peec AI Trusted Partner', rest: '', href: 'https://peec.ai/agency-directory/tj-digital' },
    { text: '16 podcast episodes as a guest, as of October 2026', lead: '16 podcast episodes', rest: 'as a guest, as of October 2026' },
  ],
};

export const videos = {
  h2: 'You probably know me from my videos',
  lead: 'I post a video every day about AI search and SEO. Each one becomes a blog post on this site, the same content pipeline we run for clients.',
  channels: [
    { name: 'TikTok', icon: 'tiktok', count: '21,100 followers', href: 'https://www.tiktok.com/@tjrobertson52' },
    { name: 'Instagram', icon: 'instagram', count: '10,500 followers', href: 'https://www.instagram.com/tjrobertsondigital/' },
    { name: 'YouTube', icon: 'youtube', count: '3,300 subscribers', href: 'https://www.youtube.com/@TJRobertsonDigital' },
    { name: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com/in/tj-robertson-seo/' },
    { name: 'X', icon: 'x', href: 'https://x.com/SeoRobertson' },
  ],
  channelsNote: 'Follower counts as of October 7, 2026.',
  story: "I'm TJ Robertson. Before TJ Digital, I was director of SEO and strategy at a digital marketing agency. I started TJ Digital on May 1, 2025, because AI had made marketing work better and more efficient, and most agencies were ignoring that or hiding the gains from their clients.",
  storyLink: { label: 'Read more about us', href: links.about },
  articleLabel: 'Read the article',
  latest: [
    { date: 'Oct 14, 2026', title: 'How to Build an AI System for Your Agency (Ours Does 80% ALREADY)', id: 'fTA8vqhIufU' },
    { date: 'Oct 12, 2026', title: "Does Claude's New Usage Policy Ban GEO? Only the SPAMMY Kind", id: 'OuyrM3BWeBE', article: 'https://tjrobertson.com/does-claudes-new-usage-policy-ban-geo/' },
    { date: 'Oct 10, 2026', title: 'Is Google Cracking Down on AI Content? What the Update ACTUALLY Means', id: 'wcL1TQE2EYk', article: 'https://tjrobertson.com/is-google-cracking-down-on-ai-content/' },
    { date: 'Oct 7, 2026', title: 'How to Sell Products in Google AI Mode (Set Up UCP NOW)', id: 'Y4webuYypls', article: 'https://tjrobertson.com/ucp-integration-hub/' },
    { date: 'Oct 6, 2026', title: "How Is SEO Changing With AI? 3 Ways (And What ISN'T Changing)", id: 'ZUsIKGveHio', article: 'https://tjrobertson.com/how-is-seo-changing-with-ai/' },
    { date: 'Sep 30, 2026', title: 'Can AI Do SEO Better Than a Human? Why Most SEOs Get This WRONG', id: 'bBi5CsN84R0' },
  ],
};

export const services = {
  h2: 'What we do',
  demo: {
    h3: 'What AI search changes',
    text: 'When someone asks an AI assistant who to hire or what to buy, it reads a handful of pages and gives one answer. Our work is aimed at getting that answer to name your business, favorably. The end goal is more sales.',
    query: 'Who is the best company for what you sell?',
    linksLabel: 'A page of links',
    links: [
      { site: 'A list article', title: 'The 10 best companies for what you sell', tick: true },
      { site: 'A directory', title: 'Top-rated companies near the buyer' },
      { site: 'A competitor', title: 'Why to choose them' },
      { site: 'A forum thread', title: 'Who did you hire, and were they good?', tick: true },
      { site: 'Your website', title: 'What you do, what it costs and how it works', tick: true },
    ],
    answerLabel: 'One answer',
    answer: { before: "Based on the pages I read, I'd recommend ", name: 'Your business', after: '.' },
    answerWhy: 'It shows its prices, has results that match what you asked for, and is recommended on the list and in the forum thread.',
    sourcesLabel: 'Pages it read',
    sources: ['Your website', 'A list article', 'A forum thread'],
    replay: 'Replay',
  },
  cards: [
    {
      price: 'From $1,900 a month',
      title: 'SEO and GEO campaigns',
      text: 'This is most of what we do. A campaign is a monthly plan of work on your search visibility, in Google and in AI search. Most of the work is content: pages, blog posts and video.',
      // Labels in the card animation: words from the text above.
      outputs: ['pages', 'blog posts', 'video'],
    },
    {
      price: '$3,000 for a custom build',
      title: 'AI-native websites',
      text: 'We build custom websites that Claude builds, updates and maintains. E-commerce businesses get Shopify instead. Either way, the website belongs to you.',
      badge: 'Shopify',
    },
  ],
};

export const results = {
  h2: 'Results from client campaigns',
  lead: "We don't name clients, so each result is described by the kind of business. AI visibility is measured in Peec AI. Results vary, and not every quarter goes like these.",
  before: 'Before',
  after: 'After',
  measured: 'Measured in Peec AI',
  // b and a are the upper figures, used only for bar widths.
  cases: [
    { kind: 'Medical and wellness e-commerce store', figure: '53-58%', metric: 'How often ChatGPT-style tools recommended the brand', before: '14-18%', after: '53-58%', b: 18, a: 58, date: 'November 2025' },
    { kind: 'Sporting goods e-commerce store', figure: '53%', metric: 'Tracked prompts where ChatGPT recommended the brand', before: '34%', after: '53%', b: 34, a: 53, date: 'July 2026' },
    { kind: 'SaaS tools company', figure: '24%', metric: 'AI visibility, in under three months', before: '1%', after: '24%', b: 1, a: 24, date: 'October 2026' },
    { kind: 'Hospitality staffing agency', figure: '15-20%', metric: 'AI visibility', before: '3-7%', after: '15-20%', b: 7, a: 20, date: 'January 2026' },
  ],
  also: [
    { kind: 'B2B telecom monitoring company', date: 'August 2026', text: 'It went from the bottom of its competitor set to the top in AI visibility.' },
    { kind: 'Home remodeler', date: 'August 2026', text: 'AI visibility more than doubled, from the bottom of its competitor set to roughly tied for second.' },
  ],
};

export const podcasts = {
  h2: 'TJ as a podcast guest',
  lead: 'TJ has been a guest on 16 podcast episodes across 13 shows, as of October 2026.',
  items: [
    { show: 'The Edward Show, with David Quaid', date: 'August 2026', title: 'Are Bot-Managed, CMS-Less Websites the Future of SEO?', id: 'mhVbtxiy9qM' },
    { show: 'The Personal Brand Blueprint', date: 'August 2025', title: 'How to Show Up In AI Search Results', id: 'raf1KyxE3qk' },
    { show: 'Digital Marketing Therapy', date: 'August 2025', title: 'How to Use AI to Repurpose your Content', id: 'GUPUbtCMutQ' },
  ],
  peec: {
    h3: 'Peec AI introduces TJ Digital',
    text: 'Peec AI is the tool we use to track AI search visibility. It introduced us on its YouTube channel in April 2026.',
    title: 'Meet TJ Digital: GEO and AI Search Agency',
    id: 'aapPxjhuieI',
  },
};

export const working = {
  h2: 'What working with us is like',
  lead: "Most people find us through TJ's videos. Day to day, you work with one of our account managers.",
  note: "You can follow every task in Notion if you'd like. Email works just as well.",
  h3: 'Your first year with us',
  steps: [
    { when: 'Before you start', title: 'An inquiry, then a short call', text: 'You send an inquiry and TJ replies by email with where plans start and whether it sounds like a fit. If it does, you can book a short discovery call.' },
    { when: 'Day 1', title: 'The onboarding call', text: 'This is one 90-minute call with TJ. We ask for everything we need at once, so we rarely have to come back to you with questions.' },
    { when: 'Weeks 1 and 2', title: 'The strategic assessment', text: 'You review and approve your first quarterly plan at the end of it.' },
    { when: 'Months 1 to 3', title: 'Tuning', text: "The first pieces of content won't be fully right. We're building the system with you, and most of the tuning happens here, from your feedback." },
    { when: 'Months 3 to 6', title: 'A return', text: "For a business of the size we work best with, we're confident of a good return within three to six months." },
    { when: 'Every quarter', title: 'A report and the next plan', text: 'TJ records a video walking you through the results and the next plan, and we offer a 30-minute call with TJ and your account manager.' },
  ],
};

export const faq = {
  h2: 'Questions people ask before they hire us',
  items: [
    { q: 'How much does it cost?', a: 'Campaigns start at $1,900 a month, and the average plan is about $3,000. Every campaign starts with a strategic assessment: $2,000, one time.' },
    { q: 'Is there a contract?', a: "No long-term contract. You can leave whenever you want, with 30 days' notice." },
    { q: 'Who does the work?', a: "Claude does most of the hands-on work, and only on tasks where it does better than a person, not just faster. People review all of it, and when something isn't right we fix the system behind it, so you only tell us once. Every client has an account manager who handles the day to day, and TJ sets the strategy behind your plan." },
    { q: 'How long until I see results?', a: "Most of the tuning happens in the first three months. For a business of the size we work best with, we're confident of a good return within three to six months." },
    { q: 'Do I own the work?', a: "Yes. Your knowledge base and your website are yours. You're never locked into us or into an AI provider." },
  ],
};

export const contact = {
  h2: 'Ask about working with us',
  lead: "Tell us a little about your business and what you're looking for. Your message goes straight to TJ, and he replies by email.",
};

export const social = [
  { label: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com/@TJRobertsonDigital' },
  { label: 'TikTok', icon: 'tiktok', href: 'https://www.tiktok.com/@tjrobertson52' },
  { label: 'Instagram', icon: 'instagram', href: 'https://www.instagram.com/tjrobertsondigital/' },
  { label: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com/in/tj-robertson-seo/' },
  { label: 'X', icon: 'x', href: 'https://x.com/SeoRobertson' },
];

export const footer = {
  company: 'TJ Digital LLC, Henderson, Nevada',
  copyright: '© 2026 TJ Digital',
};

// Brand names from the hero lead, used as labels on the hero's decorative chips.
export const chips = { google: 'Google', ai: 'ChatGPT' };

export const images = {
  logo: { src: '/images/TJDigital_Logo_AllInOne_Large.webp', alt: 'TJ Digital logo' },
  desk: {
    src: '/images/WIN_20250210_18_44_19_Pro-1536x864.webp',
    alt: 'TJ Robertson smiling at his desk in front of bookshelves',
  },
  cutout: {
    src: '/images/TJ-cutout.webp',
    alt: 'TJ Robertson smiling, wearing glasses and a dark shirt',
  },
  skyline: {
    src: '/images/skyline-rising.webp',
    alt: '',
  },
  tavi: { src: '/images/tavi-3d.webp' },
  videoFrame: {
    src: '/images/homepageVideoMessageFrame.webp',
    alt: 'TJ Robertson recording a video at his desk',
  },
};

// YouTube thumbnail for a video id (served by YouTube's image server).
export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
