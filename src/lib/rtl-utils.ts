/**
 * RTL Utilities and Guidelines
 * 
 * This file provides documentation and utilities for RTL-safe CSS in the application.
 * 
 * CRITICAL RULES:
 * 1. NEVER use directional properties: ml-*, mr-*, pl-*, pr-*, left-*, right-*, text-left, text-right
 * 2. ALWAYS use logical properties: ms-*, me-*, ps-*, pe-*, start-*, end-*, text-start, text-end
 * 3. For absolute positioning close buttons: use "rtl:left-4 ltr:right-4" pattern
 * 
 * TAILWIND LOGICAL PROPERTIES CHEAT SHEET:
 * ==========================================
 * 
 * Margins:
 *   ml-* → ms-* (margin-start)
 *   mr-* → me-* (margin-end)
 * 
 * Padding:
 *   pl-* → ps-* (padding-start)
 *   pr-* → pe-* (padding-end)
 * 
 * Positioning:
 *   left-* → start-* (inset-inline-start)
 *   right-* → end-* (inset-inline-end)
 * 
 * Text Alignment:
 *   text-left → text-start
 *   text-right → text-end
 * 
 * Borders:
 *   border-l-* → border-s-* (border-start)
 *   border-r-* → border-e-* (border-end)
 *   rounded-l-* → rounded-s-* (rounded-start)
 *   rounded-r-* → rounded-e-* (rounded-end)
 * 
 * Flex Direction (for icon + text):
 *   Use: gap-2 rtl:flex-row-reverse (when icon should flip sides)
 * 
 * Space:
 *   space-x-* → Consider using gap-* instead (direction-agnostic)
 * 
 * COMMON PATTERNS:
 * ================
 * 
 * Close button in dialog/modal:
 *   className="absolute rtl:left-4 ltr:right-4 top-4"
 * 
 * Back button with arrow:
 *   const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
 *   // For "back" action, swap the arrows since direction is reversed
 * 
 * Text with icon:
 *   className="flex items-center gap-2 rtl:flex-row-reverse"
 * 
 * Sidebar or navigation item:
 *   Use ms-* and me-* for indentation
 *   Use text-start for alignment
 * 
 * Form labels:
 *   Use text-start (not text-left)
 * 
 * TESTING:
 * ========
 * Always test RTL by switching to Arabic in the language selector.
 * Check that:
 * 1. Close buttons appear in the correct corner
 * 2. Text flows right-to-left
 * 3. Icons are positioned correctly
 * 4. Navigation items are properly aligned
 * 5. Form fields and labels are properly aligned
 */

// Direction type for type-safe direction handling
export type Direction = 'ltr' | 'rtl';

/**
 * Get the opposite direction
 */
export function getOppositeDirection(dir: Direction): Direction {
  return dir === 'rtl' ? 'ltr' : 'rtl';
}

/**
 * Get the correct arrow icon component for a "forward" action
 * In RTL, "forward" means left; in LTR, "forward" means right
 */
export function getForwardArrowDirection(dir: Direction): 'left' | 'right' {
  return dir === 'rtl' ? 'left' : 'right';
}

/**
 * Get the correct arrow icon component for a "back" action
 * In RTL, "back" means right; in LTR, "back" means left
 */
export function getBackArrowDirection(dir: Direction): 'left' | 'right' {
  return dir === 'rtl' ? 'right' : 'left';
}

/**
 * Common RTL-aware class mappings for reference
 * Use these as a guide when writing Tailwind classes
 */
export const rtlClassMap = {
  // Margins
  'ml-': 'ms-',
  'mr-': 'me-',
  
  // Padding
  'pl-': 'ps-',
  'pr-': 'pe-',
  
  // Position
  'left-': 'start-',
  'right-': 'end-',
  
  // Text
  'text-left': 'text-start',
  'text-right': 'text-end',
  
  // Borders
  'border-l-': 'border-s-',
  'border-r-': 'border-e-',
  'rounded-l-': 'rounded-s-',
  'rounded-r-': 'rounded-e-',
} as const;
