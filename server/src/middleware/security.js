import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

// rateLimiter: basic request rate-limiting middleware
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Arabic error message for rate-limit breaches
  message: {
    error: 'لقد تجاوزت الحد الأقصى من الطلبات المسموح بها. يرجى المحاولة مرة أخرى لاحقاً.',
    code: 'TOO_MANY_REQUESTS',
  },
  statusCode: 429,
  skip: (req) => req.path === '/auth/login',
});

export const loginRateLimiter = rateLimit({
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'محاولات تسجيل الدخول كثيرة جداً. يرجى المحاولة لاحقاً.',
    code: 'LOGIN_RATE_LIMITED',
  },
});

// helmet: secure HTTP headers
export const helmetSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
});

// corsMiddleware: CORS security filters based on environment configurations
export const customCorsOptions = {
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposedHeaders: [
    'Idempotency-Replayed',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
  ],
  credentials: true,
};
