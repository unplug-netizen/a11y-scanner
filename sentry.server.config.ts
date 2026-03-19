// Sentry server configuration
import { init } from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  init({
    dsn: SENTRY_DSN,
    
    // Adjust this value in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Debug mode in development
    debug: process.env.NODE_ENV === 'development',
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    
    // Server-side integrations
    integrations: [],
  });
}
