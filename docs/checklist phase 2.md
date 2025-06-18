# WordWise AI – Phase 2 Development Checklist  
*(AI Enhancement: Days 4 – 7)*  

This document breaks the Phase 2 roadmap into clear **Phases → Features → Sub-features** so any newcomer can follow development step-by-step.

---

## Phase 1 – AI Suggestion Engine Foundation ✅ COMPLETED
### 1.1  GPT Infrastructure  
- [x] **Design prompt templates**  
  - [x] Subject-line prompts (improve, ab_test, audience_specific, seasonal)
  - [x] CTA prompts (improve, variations, platform_specific, funnel_stage)
  - [x] Body-content prompts (improve_engagement, shorten, tone_adjustment, structure, storytelling, personalization)
- [x] **Centralize GPT API handler**  
  - [x] Modes: *rewrite*, *suggest*, *extend* (all implemented with safety guards)
  - [x] Robust error / rate-limit handling (60 requests/hour per user)
- [x] **Implement caching layer**  
  - [x] Hash of (text + mode) → cached response (SHA-256 based)
  - [x] Retrieval before new GPT call (30-minute cache for enhancements, 15-minute for grammar)
  - [x] Grammar suggestions now cached with rate limiting (120/hour)
  - [x] Persistent suggestion storage in database (survives page refresh)
  - [x] Auto-restore cached suggestions on document load
- [x] **Safety guards**  
  - [x] Max-token cut-off & sentence-boundary stop (2000 tokens max, sentence boundary enforcement)
  - [x] Validate input length / unsafe content rejection (10-50k character limits, content filtering)  

---

## Phase 2 – Rewrite & Tone Suggestion UI ✅ COMPLETED
### 2.1  Tone-Rewrite Dropdown  
- [x] **Build dropdown UI (Bold, Witty, Motivational, Direct…)**  
  - [x] Enhanced "Quick Tone" dropdown with Phase 2 tone collection
  - [x] Comprehensive tone options: Bold, Witty, Motivational, Direct, Professional, Friendly
  - [x] Visual emoji indicators for each tone type
- [x] **Enable highlight-to-rewrite interaction**  
  - [x] Text selection triggers rewrite options
  - [x] Preserved selection during dropdown interactions
  - [x] Seamless text replacement workflow
- [x] **Replace text with GPT output + *Undo* support**  
  - [x] History-based undo system for all rewrites
  - [x] Intelligent text replacement with proper positioning
  - [x] Clear success feedback for completed rewrites

### 2.2  Intelligent Rewrite Controls  
- [x] **Add "Rewrite" button to inline AI flags**  
  - [x] Rewrite options added to suggestion popup dialogs
  - [x] 6 tone options directly accessible from suggestions
  - [x] Loading states and progress indicators
- [x] **Enforce full-sentence boundaries on selection**  
  - [x] Enhanced sentence boundary detection (includes colons, semicolons)
  - [x] Automatic extension to complete sentences when needed
  - [x] Frontend and backend validation alignment
- [x] **Block rewrites on broken / partial sentences**  
  - [x] Comprehensive text validation before rewrite attempts
  - [x] Detection of sentence fragments and incomplete thoughts
  - [x] Clear error messages for invalid selections
  - [x] Minimum length requirements (5+ characters)
  - [x] Conjunction and capitalization validation

---

## Phase 3 – Contextual Feedback System
### 3.1 Context-Aware Suggestions  
- [ ] Detect region (subject, intro, CTA)  
- [ ] Adjust prompts per region  
- [ ] Trigger on typing-pause **or** manual “Check”  

### 3.2 Inferred Improvements (Auto)  
- [ ] Auto-offer clarity / CTA / hook rewrites  
- [ ] Tag suggestions by type  
- [ ] Show rationale (“Make this CTA more actionable”)  
- [ ] Smooth accept / reject UI  

---

## Phase 4 – Feedback, Metrics & Safety
### 4.1 Suggestion Tracking & Analytics  
- [ ] Log accept / reject events  
- [ ] Compute per-document stats (suggestions, acceptance %, top categories)  
- [ ] Persist per-user history  

### 4.2 Additional Safety Controls  
- [ ] Token-limit & repetition guardrails  
- [ ] Detect and stop runaway generation loops  
- [ ] Disable AI suggestions on repeated failures  

---

## Phase 5A – Style & Clarity Analysis
### 5A.1 GPT-Driven Clarity Scoring  
- [ ] Create clarity-score prompt (0-100 + reasoning)  
- [ ] Return score, 1-2 sentence explanation, highlights  
- [ ] Display in sidebar / dashboard  

### 5A.2 Tone Evaluation (Stretch)  
- [ ] Detect actual tone via GPT  
- [ ] Compare with target tone  
- [ ] Flag mismatches with revision tips  

---

## Phase 5B – Research & Ideation Engine
### 5B.1 Smart Source Finder  
- [ ] Embed current draft → extract topical keywords  
- [ ] Query external content API (e.g., NewsAPI / Google CSE)  
- [ ] Return 3-5 links + 1-line summaries + markdown citation snippets 
- [ ] Allows user to allow or disallow certain sources   

### 5B.2 Past-Issue Analyzer  
- [ ] Build vector store of user’s past newsletters (title, tags, embeddings)  
- [ ] Provide semantic search UI (“find issues about deliverability”)  

### 5B.3 Idea Generator  
- [ ] GPT compares current topics vs past coverage  
- [ ] Output 3 headline ideas + short outlines for future issues  
- [ ] “Save Idea” button writes to `ideas` table (Supabase)  

### 5B.4 Research Panel UI  
- [ ] Collapsible sidebar with **Sources** / **Ideas** tabs  
- [ ] “Insert citation” button drops link inline  
- [ ] Mobile-friendly layout, resizable width  

### 5B.5  **Social Snippet Generator** 
- [x] **Select excerpt → “Create Social Post”** action in toolbar  
- [x] GPT prompt variants for:  
  - [x] Tweet (≤280 chars, 1–2 hashtags)  
  - [x] LinkedIn (conv-style, call-to-comment)  
  - [x] Instagram caption (≤2200 chars, emoji + 3–5 hashtags)  
- [x] Option to regenerate / cycle through 3 variations  
- [x] “Copy to clipboard” + toast confirmation  
- [x] Log snippet generation event (`idea_type = 'social'`) in `ideas` table  

*(Effort: ≈0.5 dev-day—reuses existing GPT handler & idea panel UI)*

*(Implementation note: ½ day API integration, ½ day UI & embeddings; can run parallel with 5A tasks.)*

---

## Phase 6 – QA, Polish & Demo
### 6.1 Quality Assurance  
- [ ] Stress-test multi-paragraph rewrites  
- [ ] Validate truncation & caching paths  
- [ ] Handle offline / GPT-failure gracefully  
- [ ] **Undo** functions reliably under network errors  

### 6.2 Final Demo & Deployment  
- [ ] Record demo (tone rewrite, context suggestions, clarity score, research panel)  
- [ ] UI/UX polish pass  
- [ ] Deploy to custom domain & verify prod configs  

---

### Summary Timeline (Days 4 – 7)

| Date (June) | Focus | Key Deliverables |
|-------------|-------|------------------|
| 18 | Phase 1 | GPT handler, prompts, caching |
| 19 | Phase 2 | Tone-rewrite UI & controls |
| 20 | Phase 3 | Context detection, auto suggestions |
| 21 | Phase 4-5 | Metrics, safety, clarity scoring |
| 22 | Phase 6 | QA, polish, demo & deployment |

---

**Success Metrics**  
- ≥ 80 % of beta users rate suggestions "useful" or higher  
- Average suggestion latency < 2 s  
- ≥ 3 tone types live with rewrite support  
- Zero runaway or infinite-loop generation incidents  

---

*Document version 1.0 — last updated 2025-06-18*