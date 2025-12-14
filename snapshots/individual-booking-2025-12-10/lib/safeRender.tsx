// =============================================================================
// Safe Rendering Utilities
// Prevents React "Objects are not valid as a React child" errors
// =============================================================================

import React from "react";

/**
 * Safely convert any value to a string for rendering
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message;
  }
  // For objects/arrays, stringify
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[Object]";
  }
}

/**
 * Safe error display component
 * Handles string, object, Error, or any other type safely
 */
export function SafeError({ 
  value, 
  className = "text-red-400 text-sm" 
}: { 
  value: unknown; 
  className?: string;
}) {
  if (!value) return null;

  const content = safeString(value);
  
  // If it's a multi-line JSON object, render in a pre tag
  if (content.includes("\n") || content.startsWith("{") || content.startsWith("[")) {
    return (
      <pre className={`${className} whitespace-pre-wrap font-mono text-xs`}>
        {content}
      </pre>
    );
  }

  return <span className={className}>{content}</span>;
}

/**
 * Safe message display component
 * Similar to SafeError but with default success styling
 */
export function SafeMessage({ 
  value, 
  className = "text-emerald-400 text-sm" 
}: { 
  value: unknown; 
  className?: string;
}) {
  if (!value) return null;

  const content = safeString(value);
  
  if (content.includes("\n") || content.startsWith("{") || content.startsWith("[")) {
    return (
      <pre className={`${className} whitespace-pre-wrap font-mono text-xs`}>
        {content}
      </pre>
    );
  }

  return <span className={className}>{content}</span>;
}

/**
 * Safe inline rendering - returns string or React element
 * Use in JSX: {safeRender(error)}
 */
export function safeRender(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message;
  }
  // For objects, render formatted JSON
  try {
    const json = JSON.stringify(value, null, 2);
    return (
      <pre className="whitespace-pre-wrap font-mono text-xs">
        {json}
      </pre>
    );
  } catch {
    return "[Object]";
  }
}









