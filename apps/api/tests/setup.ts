// Test preload — runs before any test module is evaluated.
// Sets dummy values for env vars whose absence would crash module-load
// (OpenAI throws in its constructor; Upstash Redis logs warnings; Supabase
// throws in supabase.ts unless mocked).
process.env['OPENAI_API_KEY']            ??= 'sk-test-dummy'
process.env['UPSTASH_REDIS_REST_URL']    ??= 'https://test-redis'
process.env['UPSTASH_REDIS_REST_TOKEN']  ??= 'test-token'
process.env['SUPABASE_URL']              ??= 'https://test-supabase'
process.env['SUPABASE_SERVICE_ROLE_KEY'] ??= 'test-service-role-key'
process.env['SUPABASE_JWT_SECRET']       ??= 'test-jwt-secret'
