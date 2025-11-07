/**
 * Input sanitization utilities
 * Prevents XSS attacks by sanitizing user input
 */

/**
 * Sanitize HTML content
 * Removes potentially dangerous HTML tags and attributes
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  html = html.replace(/javascript:/gi, '');
  
  // Remove data: URLs that could execute scripts
  html = html.replace(/data:text\/html/gi, '');
  
  // Remove iframe tags (potential XSS vector)
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove object/embed tags
  html = html.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  html = html.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  
  return html;
}

/**
 * Sanitize text content (strip all HTML)
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove all HTML tags
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitize post content
 * Allows basic formatting but removes dangerous elements
 */
function sanitizePostContent(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // For now, just escape HTML (posts are stored as plain text anyway)
  // If you want to allow formatting, use a proper sanitizer like DOMPurify
  return escapeHtml(content);
}

module.exports = {
  sanitizeHtml,
  sanitizeText,
  escapeHtml,
  sanitizePostContent,
};

