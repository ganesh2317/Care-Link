import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public card endpoint.
 * 60 requests per 5 minutes per IP — protects against ID brute-forcing
 * without blocking legitimate rapid re-scans.
 */
export const publicCardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  },
});
