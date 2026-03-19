// Sentry configuration for Next.js
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
    
    // Before send hook to filter sensitive data
    beforeSend(event) {
      // Filter out PII
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Filter URL query parameters that might contain sensitive data
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          // Remove sensitive query params
          ['token', 'key', 'password', 'secret'].forEach(param => {
            url.searchParams.delete(param);
          });
          event.request.url = url.toString();
        } catch {
          // Ignore URL parsing errors
        }
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      /^ResizeObserver loop limit exceeded$/,
      /^Script error\.$/,
      // Network errors
      /^Network request failed$/,
      /^Failed to fetch$/,
      // User aborted
      /^AbortError$/,
      /^The user aborted a request\.$/,
    ],
    
    // Deny URLs from browser extensions
    denyUrls: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
    ],
  });
}
