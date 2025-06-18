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

## Phase 2 – Rewrite & Tone Suggestion UI
### 2.1  Tone-Rewrite Dropdown  
- [ ] Build dropdown UI (Bold, Witty, Motivational, Direct…)  
- [ ] Enable highlight-to-rewrite interaction  
- [ ] Replace text with GPT output + *Undo* support  

### 2.2  Intelligent Rewrite Controls  
- [ ] Add “Rewrite” button to inline AI flags  
- [ ] Enforce full-sentence boundaries on selection  
- [ ] Block rewrites on broken / partial sentences  

---

## Phase 3 – Contextual Feedback System
### 3.1  Context-Aware Suggestions  
- [ ] Detect region (subject, intro, CTA)  
- [ ] Adjust prompts per region  
- [ ] Trigger on typing-pause **or** manual “Check”  

### 3.2  Inferred Improvements (Auto)  
- [ ] Auto-offer clarity / CTA / hook rewrites  
- [ ] Tag suggestions by type  
- [ ] Show rationale (“Make this CTA more actionable”)  
- [ ] Smooth accept / reject UI  

---

## Phase 4 – Feedback, Metrics & Safety
### 4.1  Suggestion Tracking & Analytics  
- [ ] Log accept / reject events  
- [ ] Compute per-document stats:  
  - suggestions made, acceptance %, top categories  
- [ ] Persist per-user history  

### 4.2  Additional Safety Controls  
- [ ] Token-limit & repetition guardrails  
- [ ] Detect and stop runaway generation loops  
- [ ] Disable AI suggestions on repeated failures  

---

## Phase 5 – Style & Clarity Analysis
### 5.1  GPT-Driven Clarity Scoring  
- [ ] Create clarity-score prompt (0-100 + reasoning)  
- [ ] Return: score, 1-2 sentence explanation, highlights  
- [ ] Display in sidebar/dashboard  

### 5.2  Tone Evaluation (Optional Stretch)  
- [ ] Detect actual tone via GPT  
- [ ] Compare with target tone  
- [ ] Flag mismatches with revision tips  

---

## Phase 6 – QA, Polish & Demo
### 6.1  Quality Assurance  
- [ ] Stress-test multi-paragraph rewrites  
- [ ] Validate truncation & caching paths  
- [ ] Handle offline / GPT-failure gracefully  

### 6.2  Final Demo & Deployment  
- [ ] Record demo (tone rewrite, context suggestions, clarity score)  
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
- ≥ 80 % of beta users rate suggestions “useful” or higher  
- Average suggestion latency < 2 s  
- ≥ 3 tone types live with rewrite support  
- Zero runaway or infinite-loop generation incidents  

---

*Document version 1.0 — last updated 2025-06-18*