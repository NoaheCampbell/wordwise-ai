# Plotnotes

Plotnotes is an AI-powered writing assistant designed to help you create better content faster. Built with cutting-edge AI technology, Plotnotes provides real-time suggestions for grammar, style, tone, and clarity to enhance your writing workflow.

## Features

### ✍️ AI-Powered Writing Assistant
- **Real-time Grammar & Spelling**: Advanced AI detection and correction of grammatical errors and typos
- **Style Suggestions**: Get recommendations for clarity, conciseness, and tone improvements
- **Tone Rewriting**: Transform your text with different tones (Bold, Witty, Motivational, Direct, Professional, Friendly)
- **Context-Aware Analysis**: Smart suggestions based on content type (subject lines, introductions, CTAs)
- **Passive Voice Detection**: Automatically identify and improve passive voice constructions

### 📝 Enhanced Editor Experience
- **Document Management**: Create, edit, and organize your documents with autosave
- **Suggestion Panel**: Side-by-side AI suggestions with confidence scoring
- **Highlight & Rewrite**: Select text to get instant AI-powered rewrites
- **Undo/Redo Support**: Full history tracking for all changes and AI suggestions
- **Export & Sharing**: Share documents with public links

### 🧠 Content Intelligence
- **Enhanced Idea Generation**: AI-powered content suggestions based on your writing history
- **Research Integration**: Smart research tools to find relevant sources and information
- **Social Media Snippets**: Generate platform-specific social media content
- **Clarity Scoring**: Get objective clarity scores with detailed feedback
- **Topic Analysis**: Track content themes and identify gaps in your writing

### 📊 Writing Analytics
- **Performance Tracking**: Monitor your writing improvement over time
- **Suggestion Statistics**: See which AI recommendations work best for you
- **Content Insights**: Analyze writing patterns and optimization opportunities

## Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), [Framer Motion](https://www.framer.com/motion/)
- **Backend**: [PostgreSQL](https://www.postgresql.org/), [Supabase](https://supabase.com/), [Drizzle ORM](https://orm.drizzle.team/), Server Actions
- **AI**: [OpenAI GPT-4o](https://openai.com/) for analysis and suggestions
- **Authentication**: [Clerk](https://clerk.com/)
- **Payments**: [Stripe](https://stripe.com/) for Pro subscriptions
- **Deployment**: [Vercel](https://vercel.com/)

## Prerequisites

You'll need accounts for these services (all have free tiers):

- [Supabase](https://supabase.com/) - Database and backend services
- [Clerk](https://clerk.com/) - User authentication
- [OpenAI](https://openai.com/) - AI-powered writing assistance
- [Stripe](https://stripe.com/) - Payment processing (optional, for Pro features)
- [Vercel](https://vercel.com/) - Deployment platform

## Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database (Supabase)
DATABASE_URL=your_supabase_database_url

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup

# AI (OpenAI)
OPENAI_API_KEY=your_openai_api_key

# Payments (Stripe) - Optional
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Demo User (Optional)
DEMO_CLERK_USER_ID=your_demo_user_id
```

## Getting Started

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd plotnotes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Fill in your environment variables
   ```

4. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
plotnotes/
├── actions/              # Server actions for data operations
│   ├── ai-analysis-actions.ts    # AI writing analysis
│   ├── research-ideation-actions.ts  # Content research & ideas
│   └── db/              # Database operations
├── app/                 # Next.js app router pages
│   ├── dashboard/       # Main writing interface
│   ├── document/[id]/   # Individual document editor
│   ├── ideas/          # Content idea generation
│   └── settings/       # User preferences & billing
├── components/          # Reusable UI components
│   ├── enhanced-editor.tsx    # Main writing editor
│   ├── ai-suggestions-panel.tsx  # AI suggestions UI
│   └── ui/             # Shadcn UI components
├── db/                 # Database schema and migrations
│   └── schema/         # Drizzle ORM schemas
├── lib/                # Utility functions and configurations
└── types/              # TypeScript type definitions
```

## Key Features Explained

### AI Writing Analysis
Plotnotes uses GPT-4o to analyze your writing in real-time, providing suggestions for:
- Grammar and spelling corrections
- Clarity and conciseness improvements  
- Tone adjustments and style enhancements
- Context-aware recommendations based on content type

### Enhanced Idea Generation
The AI analyzes your past writing to:
- Identify topic patterns and content gaps
- Generate strategic content suggestions
- Provide headlines, topics, and detailed outlines
- Include confidence scoring and reasoning for each suggestion

### Smart Research Tools
Integrated research capabilities help you:
- Find relevant sources and information
- Generate social media content variations
- Create platform-specific snippets (Twitter, LinkedIn, Instagram)
- Analyze and incorporate external content

## Development

### Database Operations
```bash
npm run db:generate    # Generate new migrations
npm run db:migrate     # Apply migrations to database
```

### Code Quality
```bash
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking
npm run format:check  # Check code formatting
npm run format:write  # Fix code formatting
```

## Contributing

This is a private project. If you have access to the repository and want to contribute, please follow the existing code patterns and ensure all tests pass before submitting changes.

## License

Private - All rights reserved
