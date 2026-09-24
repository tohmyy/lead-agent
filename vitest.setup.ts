// Fake-but-well-formed values so modules that validate env shape (without
// actually calling out to any provider) don't fail construction in unit
// tests. No real secret ever lives here.
process.env.ANTHROPIC_API_KEY ??= "test-anthropic-key";
process.env.APIFY_API_TOKEN ??= "test-apify-token";
process.env.FIRECRAWL_API_KEY ??= "test-firecrawl-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
