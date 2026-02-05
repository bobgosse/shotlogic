/**
 * Server-side logger utility.
 * Structured logging with prefixed tags for easier filtering.
 */

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  log: (tag: string, ...args: unknown[]) => {
    if (!isProduction) console.log(`[${tag}]`, ...args);
  },
  warn: (tag: string, ...args: unknown[]) => {
    console.warn(`[${tag}]`, ...args);
  },
  error: (tag: string, ...args: unknown[]) => {
    console.error(`[${tag}]`, ...args);
  },
  debug: (tag: string, ...args: unknown[]) => {
    if (!isProduction) console.log(`[${tag}:DEBUG]`, ...args);
  },
};
