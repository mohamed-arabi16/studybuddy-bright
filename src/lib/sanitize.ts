/**
 * Input sanitization utilities for XSS protection
 */

/**
 * Sanitize a string by escaping HTML entities
 * Use this for any user input that will be rendered in the UI
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return input.replace(/[&<>"'`=/]/g, (char) => escapeMap[char] || char);
}

/**
 * Sanitize text input by trimming and limiting length
 * Use for general text inputs like topic titles, notes, etc.
 */
export function sanitizeTextInput(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

/**
 * Sanitize syllabus/AI input text
 * Removes potential prompt injection patterns and limits size
 */
export function sanitizeSyllabusInput(input: string, maxLength = 50000): string {
  if (!input || typeof input !== 'string') return '';
  
  // Trim and limit length first
  let sanitized = input.trim().slice(0, maxLength);
  
  // Remove common prompt injection patterns
  const injectionPatterns = [
    /ignore previous instructions/gi,
    /disregard all previous/gi,
    /forget everything/gi,
    /you are now/gi,
    /act as if/gi,
    /pretend to be/gi,
    /system:\s*$/gim,
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
  ];
  
  injectionPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
}

/**
 * Validate and sanitize email input
 */
export function sanitizeEmail(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  const email = input.trim().toLowerCase().slice(0, 255);
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(email) ? email : '';
}

/**
 * Sanitize a URL by validating format
 * Returns empty string if URL is invalid
 */
export function sanitizeUrl(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  try {
    const url = new URL(input.trim());
    // Only allow http and https protocols
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // Invalid URL
  }
  
  return '';
}

/**
 * Sanitize a numeric input
 * Returns the default value if input is not a valid number
 */
export function sanitizeNumber(
  input: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  const num = Number(input);
  
  if (isNaN(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  
  return num;
}

/**
 * Remove script tags and event handlers from HTML
 * For cases where some HTML is needed but scripts should be blocked
 */
export function stripScripts(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs in suspicious contexts
    .replace(/\s*href\s*=\s*["']data:/gi, ' href="')
    .replace(/\s*src\s*=\s*["']data:/gi, ' src="');
}
