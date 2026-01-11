/**
 * API Client with automatic retry, timeout handling, and user-friendly errors
 */

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  userMessage: string;
  retryable: boolean;
  originalError?: Error;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  timeoutMs: 60000, // 60 seconds
  shouldRetry: (error: Error, attempt: number) => {
    // Retry on network errors, timeouts, and 5xx errors
    if (error.message.includes('timeout') || error.message.includes('network')) return true;
    if ('status' in error && typeof error.status === 'number') {
      return error.status >= 500 || error.status === 429; // Retry server errors and rate limits
    }
    return attempt < 2; // Give at least 2 attempts for unknown errors
  }
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, initialDelay: number, maxDelay: number): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Create a user-friendly error from various error types
 */
function createApiError(
  error: Error | Response,
  context: string,
  retryable: boolean = false
): ApiError {
  const apiError = new Error() as ApiError;

  if (error instanceof Response) {
    // HTTP error response
    apiError.status = error.status;
    apiError.name = 'ApiError';

    switch (error.status) {
      case 400:
        apiError.message = 'Invalid request';
        apiError.userMessage = `${context}: Invalid request. Please check your input and try again.`;
        apiError.retryable = false;
        break;
      case 401:
        apiError.message = 'Unauthorized';
        apiError.userMessage = `${context}: Authentication failed. Please sign in again.`;
        apiError.retryable = false;
        break;
      case 403:
        apiError.message = 'Forbidden';
        apiError.userMessage = `${context}: You don't have permission to perform this action.`;
        apiError.retryable = false;
        break;
      case 404:
        apiError.message = 'Not found';
        apiError.userMessage = `${context}: Resource not found. It may have been deleted.`;
        apiError.retryable = false;
        break;
      case 413:
        apiError.message = 'Request too large';
        apiError.userMessage = `${context}: File or request is too large. Please try with a smaller file.`;
        apiError.retryable = false;
        break;
      case 429:
        apiError.message = 'Rate limit exceeded';
        apiError.userMessage = `${context}: Too many requests. Please wait a moment and try again.`;
        apiError.retryable = true;
        break;
      case 500:
        apiError.message = 'Server error';
        apiError.userMessage = `${context}: Server error occurred. Please try again.`;
        apiError.retryable = true;
        break;
      case 502:
      case 503:
      case 504:
        apiError.message = 'Service unavailable';
        apiError.userMessage = `${context}: Service is temporarily unavailable. Please try again in a few moments.`;
        apiError.retryable = true;
        break;
      default:
        apiError.message = `HTTP ${error.status}`;
        apiError.userMessage = `${context}: Request failed with status ${error.status}. Please try again.`;
        apiError.retryable = error.status >= 500;
    }
  } else {
    // JavaScript error (network, timeout, etc.)
    apiError.name = 'NetworkError';
    apiError.originalError = error;

    if (error.message.includes('timeout') || error.message.includes('aborted')) {
      apiError.message = 'Request timeout';
      apiError.userMessage = `${context}: Request timed out after 2.5 minutes. This scene may be very complex. Try analyzing it again or breaking it into smaller scenes.`;
      apiError.retryable = true;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      apiError.message = 'Network error';
      apiError.userMessage = `${context}: Network error. Please check your internet connection and try again.`;
      apiError.retryable = true;
    } else {
      apiError.message = error.message || 'Unknown error';
      apiError.userMessage = `${context}: ${error.message || 'An unexpected error occurred. Please try again.'}`;
      apiError.retryable = retryable;
    }
  }

  return apiError;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Fetch with automatic retry and timeout
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = {}
): Promise<Response> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | Response | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, finalConfig.timeoutMs);

      // If response is ok, return it
      if (response.ok) {
        return response;
      }

      // Non-ok response - check if we should retry
      lastError = response;

      if (attempt < finalConfig.maxRetries && finalConfig.shouldRetry(lastError as any, attempt)) {
        const delay = getBackoffDelay(attempt, finalConfig.initialDelayMs, finalConfig.maxDelayMs);
        console.warn(`[ApiClient] Request failed (attempt ${attempt + 1}/${finalConfig.maxRetries + 1}), retrying in ${delay}ms...`, {
          url,
          status: response.status
        });
        await sleep(delay);
        continue;
      }

      // Don't retry - throw error
      throw lastError;

    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (attempt < finalConfig.maxRetries && finalConfig.shouldRetry(error, attempt)) {
        const delay = getBackoffDelay(attempt, finalConfig.initialDelayMs, finalConfig.maxDelayMs);
        console.warn(`[ApiClient] Request failed (attempt ${attempt + 1}/${finalConfig.maxRetries + 1}), retrying in ${delay}ms...`, {
          url,
          error: error.message
        });
        await sleep(delay);
        continue;
      }

      // Don't retry - throw error
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after all retries');
}

/**
 * API call wrapper with retry, timeout, and user-friendly errors
 */
export async function apiCall<T = any>(
  url: string,
  options: RequestInit = {},
  config: RetryConfig & { context?: string } = {}
): Promise<T> {
  const context = config.context || 'API request';

  try {
    const response = await fetchWithRetry(url, options, config);

    // Try to parse JSON response
    let data: any;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        throw createApiError(
          new Error('Failed to parse response as JSON'),
          context,
          false
        );
      }
    } else {
      data = await response.text();
    }

    return data;

  } catch (error: any) {
    // If already an ApiError, throw it
    if (error.userMessage) {
      throw error;
    }

    // Create user-friendly error
    const apiError = createApiError(error, context, false);

    // Try to extract more specific error from response body
    if (error instanceof Response) {
      try {
        const errorData = await error.json();
        if (errorData.error || errorData.message || errorData.userMessage) {
          apiError.code = errorData.error || apiError.code;
          apiError.message = errorData.message || apiError.message;
          apiError.userMessage = errorData.userMessage || apiError.userMessage;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    throw apiError;
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(url: string, config?: RetryConfig & { context?: string }) =>
    apiCall<T>(url, { method: 'GET' }, config),

  post: <T = any>(url: string, body?: any, config?: RetryConfig & { context?: string }) =>
    apiCall<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }, config),

  put: <T = any>(url: string, body?: any, config?: RetryConfig & { context?: string }) =>
    apiCall<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }, config),

  delete: <T = any>(url: string, config?: RetryConfig & { context?: string }) =>
    apiCall<T>(url, { method: 'DELETE' }, config),
};
