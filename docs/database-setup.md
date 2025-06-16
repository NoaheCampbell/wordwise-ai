# Database Setup Guide

## Connecting Your Postgres Database to Supabase and Next.js

### Option 1: Use Supabase Managed Postgres (Recommended)

#### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization and set project details:
   - **Name**: wordwise-ai
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier

#### Step 2: Get Connection Details
After project creation (takes ~2 minutes):

1. Go to **Settings** → **Database**
2. Copy your connection details:
   - **Host**: `db.xxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: Your chosen password

3. Go to **Settings** → **API**
4. Copy these keys:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJ...`
   - **service_role secret key**: `eyJ...` (keep this secure!)

#### Step 3: Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
# Database Connection
DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]"

# Clerk Authentication (you'll set these up later)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

#### Step 4: Generate and Run Migrations

```bash
# Generate migration files from your schemas
npm run db:generate

# Apply migrations to Supabase
npm run db:migrate
```

#### Step 5: Set Up Row Level Security (RLS)

In Supabase Dashboard → **SQL Editor**, run these scripts:

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Documents policies
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid()::text = user_id);

-- Suggestions policies
CREATE POLICY "Users can view own suggestions" ON public.suggestions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own suggestions" ON public.suggestions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own suggestions" ON public.suggestions
  FOR UPDATE USING (auth.uid()::text = user_id);

-- User preferences policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid()::text = user_id);
```

---

### Option 2: Connect Existing Postgres Database

If you have an existing Postgres database you want to connect:

#### Step 1: Create Supabase Project (without database)
1. Follow steps from Option 1 to create project
2. We'll use Supabase's features but connect to your existing DB

#### Step 2: Configure Connection
Update your `.env.local`:

```bash
# Your existing database
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]"

# Supabase (for auth and other features)
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]"
```

#### Step 3: Run Migrations on Your Database
```bash
npm run db:generate
npm run db:migrate
```

---

### Testing the Connection

Create a simple test script to verify everything works:

```bash
# Test database connection
npm run dev
```

Then visit your app and check the console for any connection errors.

### Next Steps

1. **Set up Clerk Authentication** (covered in auth setup)
2. **Create your first document** using the schemas we've set up
3. **Test CRUD operations** with the database actions
4. **Set up the AI integration** for writing suggestions

### Troubleshooting

**Connection Issues:**
- Verify your DATABASE_URL is correct
- Check if your IP is allowed (Supabase allows all by default)
- Ensure your database password doesn't contain special characters that need URL encoding

**Migration Issues:**
- Make sure all schema files are properly exported in `db/schema/index.ts`
- Check that enum types don't already exist if re-running migrations

**RLS Issues:**
- Ensure you're passing the correct user_id from your auth system
- Test policies with the Supabase dashboard's RLS debugger 