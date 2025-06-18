/**
 * AI Prompt Templates for WordWise AI
 * Organized by content type and use case
 */

export interface PromptTemplate {
  name: string
  description: string
  template: string
  variables: string[]
}

/**
 * Subject Line Prompt Templates
 */
export const SUBJECT_LINE_TEMPLATES: Record<string, PromptTemplate> = {
  improve: {
    name: "Subject Line Improvement",
    description: "Improves email subject lines for better open rates",
    template: `You are an expert email marketing specialist. Improve this email subject line to increase open rates.

Focus on:
- Creating urgency or curiosity
- Using power words
- Keeping it under 50 characters
- Making it actionable

Original subject line: "{text}"

Return only the improved subject line without explanations.`,
    variables: ["text"]
  },

  ab_test: {
    name: "Subject Line A/B Test Variations",
    description: "Creates multiple subject line variations for testing",
    template: `You are an expert email marketing specialist. Create 3 variations of this email subject line for A/B testing.

Each should have a different approach:
1. Urgency-based
2. Curiosity-based  
3. Benefit-focused

Original subject line: "{text}"

Return only the 3 variations, each on a new line, without explanations.`,
    variables: ["text"]
  },

  audience_specific: {
    name: "Audience-Specific Subject Line",
    description: "Tailors subject lines for specific audiences",
    template: `You are an expert email marketing specialist. Rewrite this subject line for a {audience_type} audience.

Consider their interests, pain points, and communication style.

Original subject line: "{text}"

Return only the rewritten subject line without explanations.`,
    variables: ["text", "audience_type"]
  },

  seasonal: {
    name: "Seasonal Subject Line",
    description: "Adapts subject lines for seasonal campaigns",
    template: `You are an expert email marketing specialist. Adapt this subject line for {season} season marketing.

Incorporate seasonal themes, holidays, and relevant timing without being overly promotional.

Original subject line: "{text}"

Return only the seasonal adaptation without explanations.`,
    variables: ["text", "season"]
  }
}

/**
 * Call-to-Action (CTA) Prompt Templates
 */
export const CTA_TEMPLATES: Record<string, PromptTemplate> = {
  improve: {
    name: "CTA Improvement",
    description: "Improves call-to-action effectiveness",
    template: `You are a conversion optimization expert. Improve this call-to-action to increase click-through rates.

Focus on:
- Using action verbs
- Creating urgency
- Being specific about the benefit
- Removing friction

Original CTA: "{text}"

Return only the improved CTA without explanations.`,
    variables: ["text"]
  },

  variations: {
    name: "CTA Variations",
    description: "Creates multiple CTA variations using different psychological triggers",
    template: `You are a conversion optimization expert. Create 5 variations of this call-to-action button text.

Each should use different psychological triggers:
1. Urgency
2. Benefit-focused
3. Risk-free
4. Exclusive
5. Simple/Direct

Original CTA: "{text}"

Return only the 5 variations, each on a new line, without explanations.`,
    variables: ["text"]
  },

  platform_specific: {
    name: "Platform-Specific CTA",
    description: "Adapts CTAs for specific platforms",
    template: `You are a conversion optimization expert. Adapt this call-to-action for {platform} platform.

Consider the platform's user behavior and conventions.

Original CTA: "{text}"

Return only the adapted CTA without explanations.`,
    variables: ["text", "platform"]
  },

  funnel_stage: {
    name: "Funnel Stage CTA",
    description: "Optimizes CTAs for specific marketing funnel stages",
    template: `You are a conversion optimization expert. Optimize this call-to-action for users in the {funnel_stage} stage of the marketing funnel.

Consider the user's mindset and readiness level at this stage.

Original CTA: "{text}"

Return only the optimized CTA without explanations.`,
    variables: ["text", "funnel_stage"]
  }
}

/**
 * Body Content Prompt Templates
 */
export const BODY_CONTENT_TEMPLATES: Record<string, PromptTemplate> = {
  improve_engagement: {
    name: "Engagement Improvement",
    description: "Rewrites content to be more engaging",
    template: `You are a content strategist specializing in engagement. Rewrite this content to be more engaging.

Focus on:
- Using active voice
- Adding emotional hooks
- Including specific examples
- Making it scannable

Original content: "{text}"

Return only the improved content without explanations.`,
    variables: ["text"]
  },

  shorten: {
    name: "Content Shortening",
    description: "Makes content more concise while preserving key information",
    template: `You are an expert editor. Make this content more concise while preserving all key information.

Focus on:
- Removing unnecessary words
- Combining similar ideas
- Using stronger verbs
- Maintaining clarity

Original content: "{text}"

Return only the shortened content without explanations.`,
    variables: ["text"]
  },

  tone_adjustment: {
    name: "Tone Adjustment",
    description: "Adjusts content tone while maintaining information",
    template: `You are a professional copywriter. Adjust the tone of this content to be more {tone}.

Maintain all key information while changing the voice and style.

Original content: "{text}"

Return only the tone-adjusted content without explanations.`,
    variables: ["text", "tone"]
  },

  structure: {
    name: "Content Restructuring",
    description: "Restructures content for better flow and readability",
    template: `You are a content strategist. Restructure this content for better flow and readability.

Focus on:
- Logical information hierarchy
- Smooth transitions
- Clear paragraphs
- Compelling opening and closing

Original content: "{text}"

Return only the restructured content without explanations.`,
    variables: ["text"]
  },

  storytelling: {
    name: "Storytelling Enhancement",
    description: "Adds storytelling elements to make content more compelling",
    template: `You are a storytelling expert. Rewrite this content to include storytelling elements that make it more compelling.

Focus on:
- Adding narrative structure
- Including relatable scenarios
- Creating emotional connection
- Using vivid imagery

Original content: "{text}"

Return only the story-enhanced content without explanations.`,
    variables: ["text"]
  },

  personalization: {
    name: "Content Personalization",
    description: "Personalizes content for specific audience segments",
    template: `You are a personalization expert. Rewrite this content to be more relevant for {audience_segment}.

Consider their specific needs, challenges, and interests.

Original content: "{text}"

Return only the personalized content without explanations.`,
    variables: ["text", "audience_segment"]
  }
}

/**
 * Content Extension Prompt Templates
 */
export const EXTENSION_TEMPLATES: Record<string, PromptTemplate> = {
  continue: {
    name: "Content Continuation",
    description: "Continues content naturally from where it left off",
    template: `You are a professional copywriter. Continue writing content that would naturally come AFTER this text.

Maintain the same:
- Tone and style
- Subject matter
- Level of detail
- Audience

Text to continue AFTER:
"{text}"

{context_info}

Return only the continuation content without explanations or the original text.`,
    variables: ["text", "context_info"]
  },

  precede: {
    name: "Content Introduction",
    description: "Writes content that would naturally come before the given text",
    template: `You are a professional copywriter. Write content that would naturally come BEFORE this text.

Maintain the same:
- Tone and style
- Subject matter
- Level of detail
- Audience

Text to write BEFORE:
"{text}"

{context_info}

Return only the preceding content without explanations or the original text.`,
    variables: ["text", "context_info"]
  },

  expand_section: {
    name: "Section Expansion",
    description: "Expands a specific section with more detail",
    template: `You are a professional copywriter. Expand this section with more detail and depth while maintaining the same style.

Focus on:
- Adding relevant examples
- Providing more context
- Including supporting details
- Maintaining flow

Section to expand:
"{text}"

{context_info}

Return only the expanded content without explanations.`,
    variables: ["text", "context_info"]
  }
}

/**
 * Analysis and Feedback Prompt Templates
 */
export const ANALYSIS_TEMPLATES: Record<string, PromptTemplate> = {
  clarity_score: {
    name: "Clarity Scoring",
    description: "Provides a clarity score with explanation and suggestions",
    template: `You are a writing analysis expert. Analyze this text for clarity and provide a score from 0-100.

Provide your response in this exact JSON format:
{
  "score": [number 0-100],
  "explanation": "[1-2 sentence explanation of the score]",
  "key_issues": ["issue1", "issue2", "issue3"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

Text to analyze:
"{text}"`,
    variables: ["text"]
  },

  tone_analysis: {
    name: "Tone Analysis",
    description: "Analyzes the tone of content and suggests improvements",
    template: `You are a tone analysis expert. Analyze the tone of this content and compare it to the target tone of "{target_tone}".

Provide your response in this exact JSON format:
{
  "current_tone": "[detected tone]",
  "target_tone": "{target_tone}",
  "alignment_score": [number 0-100],
  "mismatches": ["mismatch1", "mismatch2"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

Content to analyze:
"{text}"`,
    variables: ["text", "target_tone"]
  },

  engagement_analysis: {
    name: "Engagement Analysis",
    description: "Analyzes content for engagement potential",
    template: `You are an engagement analysis expert. Analyze this content for its potential to engage readers.

Provide your response in this exact JSON format:
{
  "engagement_score": [number 0-100],
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "improvement_suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

Content to analyze:
"{text}"`,
    variables: ["text"]
  }
}

/**
 * Utility function to get a template by category and name
 */
export function getTemplate(category: string, name: string): PromptTemplate | null {
  const templates = {
    subject_line: SUBJECT_LINE_TEMPLATES,
    cta: CTA_TEMPLATES,
    body_content: BODY_CONTENT_TEMPLATES,
    extension: EXTENSION_TEMPLATES,
    analysis: ANALYSIS_TEMPLATES
  }

  return templates[category as keyof typeof templates]?.[name] || null
}

/**
 * Utility function to populate a template with variables
 */
export function populateTemplate(template: PromptTemplate, variables: Record<string, string>): string {
  let populatedTemplate = template.template

  for (const variable of template.variables) {
    const value = variables[variable] || ""
    const placeholder = `{${variable}}`
    populatedTemplate = populatedTemplate.replace(new RegExp(placeholder, 'g'), value)
  }

  return populatedTemplate
}

/**
 * Get all available templates by category
 */
export function getAllTemplates(): Record<string, Record<string, PromptTemplate>> {
  return {
    subject_line: SUBJECT_LINE_TEMPLATES,
    cta: CTA_TEMPLATES,
    body_content: BODY_CONTENT_TEMPLATES,
    extension: EXTENSION_TEMPLATES,
    analysis: ANALYSIS_TEMPLATES
  }
} 