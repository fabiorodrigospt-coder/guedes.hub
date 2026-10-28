import { handle } from './handler.js';
Deno.serve((req: Request) => handle(req, {
 SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
 SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
