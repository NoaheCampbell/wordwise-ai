––––––––––––––––––––––––––––––––––
	1.	Design Goals
• Context-aware (recognises tone, audience, section type).
• Reproducible (same text ⇒ same score, small temperature).
• Explainable (tells the writer why points were lost).
• Fast (< 2 s latency for real-time use).

––––––––––––––––––––––––––––––––––
2. Score Rubric (0-100)
90-100  Crystal clear – concise, no ambiguity, smooth flow.
75-89   Quite clear – minor verbosity or jargon.
60-74   Mixed clarity – several long/complex sentences, vague phrases.
40-59   Hard to follow – frequent wordiness, passive overload, shifting focus.
0-39    Very unclear – dense, confusing, or poorly structured.

––––––––––––––––––––––––––––––––––
3. Prompt Template (for GPT-4o)

System: You are a writing coach.
User: Evaluate the clarity of the following newsletter passage for an educated, non-specialist audience.

TASKS
	1.	Give a clarity score from 0-100 using the rubric below.
	2.	Briefly explain the main reasons for the score (≤ 40 words).
	3.	List up to 3 sentences or phrases that reduce clarity.

RUBRIC
(Insert the five-band rubric above.)

TEXT
<<< {excerpt_or_full_text} >>>

Settings: temperature 0.2, max tokens ≈ 250.

––––––––––––––––––––––––––––––––––
4. Expected JSON Output

{
    "score": 82,
    "explanation": "Mostly concise with logical flow, but two long sentences contain vague phrasing.",
    "highlights": [
        "We’re making some progress, but there’s still a long way to go.",
        "In terms of actionable strategy, this is what we’re looking at…"
    ]
}

––––––––––––––––––––––––––––––––––
5. Implementation Flow
	1.	User stops typing → debounce 700 ms.
	2.	Hash the excerpt (SHA-256).
• If hash found in cache → return stored score.
• If miss → send prompt to GPT-4o.
	3.	Parse JSON, persist to clarity_scores table (doc_id, hash, score, json, timestamp).
	4.	Render badge and inline highlight tooltips.

––––––––––––––––––––––––––––––––––
6. Calibration Steps

• Collect 50 passages ranging from crystal clear to unclear.
• Have 2-3 editors score them using the rubric.
• Compare GPT scores to human mean; adjust prompt until RMSE < 8 points.

––––––––––––––––––––––––––––––––––
7. UI Guidelines

• Sidebar widget: large number + coloured ring (green 90+, amber 60-89, red <60).
• Hover highlight: shows the unclear sentence and a one-click “Make clearer” action.
• Quick-fix button: runs “Rewrite for clarity” on the individual sentence.

––––––––––––––––––––––––––––––––––
8. Cost & Performance Tips

• Score paragraph-sized excerpts (≤ 1200 chars) to cut tokens.
• Batch paragraphs on document open.
• Fallback: if excerpt < 25 words, display “Need more text to score.”

––––––––––––––––––––––––––––––––––
9. Edge-Case Guards

• Very short input → no score.
• Model failure/JSON error → show “Unscored” badge, log for retry.
• Profanity/PII safe: analysis only, no exposure.

––––––––––––––––––––––––––––––––––