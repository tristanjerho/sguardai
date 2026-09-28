/**
 * Safely parses any date input (Firestore Timestamp, Date, string, number, or { seconds }) into a valid Date object.
 */
function parseDateInput(input) {
  if (!input) return null;
  if (typeof input?.toDate === 'function') {
    return input.toDate();
  }
  if (typeof input === 'object' && typeof input?.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = parseDateInput(dateString);
  if (!date) return typeof dateString === 'string' ? dateString : 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = parseDateInput(dateString);
  if (!date) return typeof dateString === 'string' ? dateString : 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = parseDateInput(dateString);
  if (!date) return '';
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(date);
}

export function getStatusColor(status) {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'READY':
    case 'DELIVERED':
      return {
        badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
        dot: 'bg-emerald-500',
      };
    case 'PENDING':
    case 'ORDERED':
    case 'INITIAL':
      return {
        badge: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
        dot: 'bg-amber-500',
      };
    case 'IN_PROGRESS':
    case 'ALIGNMENT':
    case 'RETENTION':
      return {
        badge: 'bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300 border-teal-200 dark:border-teal-500/25',
        dot: 'bg-teal-500',
      };
    case 'REJECTED':
    case 'CANCELLED':
      return {
        badge: 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300 border-rose-200 dark:border-rose-500/25',
        dot: 'bg-rose-500',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]',
        dot: 'bg-slate-500',
      };
  }
}

/**
 * Formats a Philippine mobile number into standard '+63 9XX XXX XXXX' format.
 * Strictly limited to 12 total digits (63 country code + 10 national digits starting with 9).
 */
export function formatPhPhone(value) {
  if (!value) return '';
  
  // Extract all digits
  let digits = String(value).replace(/\D/g, '');
  
  // Strip leading zero if user entered 09...
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  // Strip country code if present at the beginning
  if (digits.startsWith('63')) {
    digits = digits.slice(2);
  }
  
  // Keep maximum 10 digits (national part of PH mobile number: 9XXXXXXXXX)
  // Total digits with 63 = 12 digits max
  digits = digits.slice(0, 10);
  
  if (digits.length === 0) {
    return '+63 ';
  }
  
  let formatted = '+63 ';
  if (digits.length <= 3) {
    formatted += digits;
  } else if (digits.length <= 6) {
    formatted += `${digits.slice(0, 3)} ${digits.slice(3)}`;
  } else {
    formatted += `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  return formatted;
}

/**
 * Validates whether a phone string represents a valid 12-digit Philippine mobile number.
 * Standard: 63 + 9XXXXXXXXX (12 numeric digits total)
 */
export function isValidPhPhone(value) {
  if (!value) return false;
  const digits = String(value).replace(/\D/g, '');
  
  // Formatted with country code: 639XXXXXXXXX (12 digits)
  if (digits.length === 12 && digits.startsWith('639')) {
    return true;
  }
  
  // Formatted local: 09XXXXXXXXX (11 digits)
  if (digits.length === 11 && digits.startsWith('09')) {
    return true;
  }
  
  // National only: 9XXXXXXXXX (10 digits)
  if (digits.length === 10 && digits.startsWith('9')) {
    return true;
  }
  
  return false;
}

