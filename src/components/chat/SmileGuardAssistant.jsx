import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Minus,
  RotateCcw,
  Trash2,
  Sparkles,
  Bot,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  AlertOctagon,
  FileText,
  ExternalLink,
  Volume2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ROLES } from '../../lib/roles';
import {
  chatService,
  DEFAULT_SUGGESTED_PROMPTS,
  INITIAL_WELCOME_MESSAGE,
  isEmergencyQuery,
  getRouteSuggestedPrompts,
  generateSoapNote
} from '../../services/chatService';
import { SmileGuardMascot } from '../common/SmileGuardMascot';

/**
 * Format markdown-like text with bolding, lists, code spans, blockquotes,
 * and clickable in-message navigation action links
 */
function FormattedMessage({ content, onNavigate, isPatient = false }) {
  if (!content) return null;

  let sanitized = content;
  if (isPatient) {
    sanitized = sanitized
      // Remove "[Open AI Workstation](...)" along with surrounding bullet/separator
      .replace(/\[Open AI Workstation\]\([^)]+\)\s*[•·-]?\s*/gi, '')
      .replace(/[•·-]?\s*\[Open AI Workstation\]\([^)]+\)/gi, '')
      .replace(/\[Open AI Workstation\]\([^)]+\)/gi, '')
      .replace(/`?\/clinic\/ai-workstation`?/gi, '')
      .replace(/Quick Links:\s*[•·-]\s*/gi, 'Quick Links: ')
      .replace(/Quick Links:\s*(\n|$)/gi, '');
  }

  const lines = sanitized.split('\n');

  return (
    <div className="space-y-2 text-[13.5px] leading-relaxed break-words font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Headers: ### Title or ## Title
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="font-heading font-bold text-sm text-teal-700 dark:text-teal-300 mt-2.5 mb-1"
            >
              {parseInlineFormatting(trimmed.replace(/^###\s+/, ''), onNavigate, isPatient)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="font-heading font-bold text-sm text-ink-primary dark:text-[#F8FAFC] mt-3 mb-1"
            >
              {parseInlineFormatting(trimmed.replace(/^##\s+/, ''), onNavigate, isPatient)}
            </h3>
          );
        }

        // Blockquotes: > Quote / Disclaimer
        if (trimmed.startsWith('> ')) {
          return (
            <div
              key={idx}
              className="p-2.5 my-1.5 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200 text-xs"
            >
              {parseInlineFormatting(trimmed.replace(/^>\s+/, ''), onNavigate, isPatient)}
            </div>
          );
        }

        // Bullet point: - item or * item
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 shrink-0" />
              <span>{parseInlineFormatting(trimmed.replace(/^[-*]\s+/, ''), onNavigate, isPatient)}</span>
            </div>
          );
        }

        // Numbered item: 1. item
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s+(.*)/);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-heading font-semibold text-teal-600 dark:text-teal-400 shrink-0 text-xs mt-0.5">
                {match ? `${match[1]}.` : '•'}
              </span>
              <span>{parseInlineFormatting(match ? match[2] : trimmed, onNavigate, isPatient)}</span>
            </div>
          );
        }

        return <p key={idx}>{parseInlineFormatting(line, onNavigate, isPatient)}</p>;
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), italics (*text*), inline code (`code`),
 * and clickable route links ([Label](/path))
 */
function parseInlineFormatting(text, onNavigate, isPatient = false) {
  if (!text) return null;

  // Regex to match links [label](path), code `code`, bold **bold**, or italic *italic*
  const parts = [];
  const regex = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];

    // Markdown Link: [Label](/route)
    if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, path] = linkMatch;
        // Suppress clinic-only AI Workstation links on the patient page
        if (isPatient && (label.toLowerCase().includes('open ai workstation') || path.includes('/clinic/ai-workstation'))) {
          // Do not render Open AI Workstation for patient
        } else {
          parts.push(
            <button
              key={match.index}
              type="button"
              onClick={() => onNavigate && onNavigate(path)}
              className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold cursor-pointer transition-all active:scale-95"
              title={`Navigate to ${path}`}
            >
              <span>{label}</span>
              <ExternalLink className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            </button>
          );
        }
      } else {
        parts.push(token);
      }
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const codeContent = token.slice(1, -1);
      if (isPatient && codeContent.includes('/clinic/ai-workstation')) {
        // Suppress on patient page
      } else if (codeContent.startsWith('/') && onNavigate) {
        // If code content is an app path like /clinic/ai-workstation, make it clickable!
        parts.push(
          <button
            key={match.index}
            type="button"
            onClick={() => onNavigate(codeContent)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 dark:bg-[#1C3250] text-teal-700 dark:text-teal-300 font-mono text-[11.5px] border border-teal-200 dark:border-[#26415E] hover:bg-teal-100 cursor-pointer"
            title={`Go to ${codeContent}`}
          >
            <code>{codeContent}</code>
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </button>
        );
      } else {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded-md bg-surface-200/80 dark:bg-[#1C3250] text-teal-700 dark:text-teal-300 font-mono text-[11.5px]"
          >
            {codeContent}
          </code>
        );
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-ink-primary dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function SmileGuardAssistant() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState([INITIAL_WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState(DEFAULT_SUGGESTED_PROMPTS);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedSoapId, setCopiedSoapId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // Emergency alert state
  const [hasEmergencyAlert, setHasEmergencyAlert] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const userId = user?.id || user?.uid || (isAuthenticated ? 'auth_user' : 'guest');
  const userRole = user?.role || 'GUEST';

  // Initialize Speech Recognition support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setIsListening(true);
      };

      recognizer.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognizer.onerror = (e) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognizer.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognizer;
    }
  }, []);

  const toggleVoiceDictation = () => {
    if (!speechSupported || !recognitionRef.current) {
      toast.info('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Speech start error:', err);
      }
    }
  };

  // Listen for "Ask About Findings" event dispatched from AI Workstation
  useEffect(() => {
    const handleWorkstationTrigger = (event) => {
      const { query, finding } = event.detail || {};
      setIsOpen(true);
      if (query) {
        handleSendMessage(query);
      }
    };

    window.addEventListener('smileguard-ask-assistant', handleWorkstationTrigger);
    return () => {
      window.removeEventListener('smileguard-ask-assistant', handleWorkstationTrigger);
    };
  }, []);

  // Dynamically adapt suggested prompts to the current route
  useEffect(() => {
    const routePrompts = getRouteSuggestedPrompts(location.pathname, userRole);
    setSuggestedPrompts(routePrompts);
  }, [location.pathname, userRole]);

  // Load conversation history on mount or user change
  useEffect(() => {
    const history = chatService.loadHistory(userId);
    setMessages(history);

    // Check if recent conversation has emergency flags
    const recentContent = history.map((m) => m.content).join(' ');
    setHasEmergencyAlert(isEmergencyQuery(recentContent));
  }, [userId]);

  // Persist history whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      chatService.saveHistory(userId, messages);
    }
  }, [messages, userId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Reset unread count & ensure input is compact when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      if (textareaRef.current) {
        textareaRef.current.style.height = '36px';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [isOpen]);

  // Auto-resize textarea as content expands (hide scrollbar until exceeding max-height)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (!inputText) {
      el.style.height = '36px';
      el.style.overflowY = 'hidden';
      return;
    }
    const scrollH = el.scrollHeight;
    const targetHeight = Math.min(Math.max(scrollH, 36), 120);
    el.style.height = `${targetHeight}px`;
    el.style.overflowY = scrollH > 120 ? 'auto' : 'hidden';
  }, [inputText]);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    // Check emergency trigger on incoming query
    if (isEmergencyQuery(query)) {
      setHasEmergencyAlert(true);
    }

    setErrorMessage(null);
    setInputText('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(newHistory, {
        role: userRole,
        context: {
          currentPath: location.pathname,
          userName: user?.fullName || user?.email || 'User'
        }
      });

      if (response?.success && response.message) {
        const assistantMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message.content,
          timestamp: response.message.timestamp || Date.now(),
          disclaimer: response.disclaimer || null,
          suggestedFollowUps: response.suggestedFollowUps || []
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (response.suggestedFollowUps?.length) {
          setSuggestedPrompts(response.suggestedFollowUps);
        }

        if (!isOpen) {
          setUnreadCount((c) => c + 1);
        }
      } else {
        throw new Error(response?.error || 'Unable to receive response from assistant.');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setErrorMessage(err.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewConversation = () => {
    const welcome = {
      ...INITIAL_WELCOME_MESSAGE,
      id: `welcome-${Date.now()}`,
      timestamp: Date.now()
    };
    setMessages([welcome]);
    setSuggestedPrompts(getRouteSuggestedPrompts(location.pathname, userRole));
    setErrorMessage(null);
    setHasEmergencyAlert(false);
    chatService.saveHistory(userId, [welcome]);
  };

  const handleClearHistory = () => {
    chatService.clearHistory(userId);
    handleNewConversation();
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopySoapNote = (id, content) => {
    const soapNote = generateSoapNote(content, userRole);
    navigator.clipboard.writeText(soapNote);
    setCopiedSoapId(id);
    toast.success('Formatted SOAP clinical note copied to clipboard!', 'SOAP Note Ready');
    setTimeout(() => setCopiedSoapId(null), 2500);
  };

  const handleNavigatePath = (path) => {
    if (!path) return;
    navigate(path);
    toast.info(`Navigated to ${path}`);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleBadge = () => {
    switch (userRole) {
      case ROLES.DENTIST:
        return { label: 'Dentist View', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case ROLES.ADMIN:
      case ROLES.SUPERADMIN:
        return { label: 'Admin View', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      case ROLES.LAB_TECH:
        return { label: 'Lab Tech View', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case ROLES.PATIENT:
        return { label: 'Patient View', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' };
      default:
        return { label: 'Visitor View', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    }
  };

  const roleBadge = getRoleBadge();

  // Floating button bottom offset for mobile when patient BottomTabBar or sticky booking bar is mounted
  const isPatientPortal = location.pathname.startsWith('/patient');
  const isBookingPage = location.pathname === '/patient/book';
  const isPatient = isPatientPortal || userRole === ROLES.PATIENT;

  // On the booking page, elevate launcher higher and keep it compact so it doesn't overlap the sticky booking bar or service cards
  const bottomLauncherClass = isBookingPage
    ? 'bottom-[max(8.5rem,calc(7.5rem+env(safe-area-inset-bottom,0px)))] sm:bottom-6 right-3 sm:right-6'
    : isPatientPortal
      ? 'bottom-28 sm:bottom-6 right-4 sm:right-6'
      : 'bottom-6 right-4 sm:right-6';

  // Dimension classes depending on maximized toggle
  const panelDimensionsClass = isMaximized
    ? 'w-[calc(100vw-1.5rem)] sm:w-[680px] h-[calc(100vh-4rem)] max-h-[720px]'
    : 'w-[calc(100vw-1.5rem)] sm:w-[410px] h-[580px] max-h-[calc(100vh-6.5rem)]';

  return (
    <>
      {/* =========================================================================
          FLOATING LAUNCHER BUTTON
          ========================================================================= */}
      <div className={`fixed z-40 ${bottomLauncherClass} transition-all duration-300`}>
        <motion.button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative group flex items-center justify-center ${isBookingPage
            ? 'w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl shadow-md opacity-90 hover:opacity-100'
            : 'w-14 h-14 rounded-2xl shadow-soft-lg'
            } bg-gradient-to-tr from-teal-600 via-teal-500 to-cyan-500 text-white hover:shadow-teal-600/40 border border-teal-400/30 focus:outline-none focus:ring-4 focus:ring-teal-500/30 transition-all cursor-pointer`}
          aria-label={isOpen ? 'Close Gardy Assistant' : 'Open Gardy Assistant'}
          title="Gardy Assistant"
        >
          {/* Animated pulsing online beacon ring */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-[#0B1B32]" />
          </span>

          {/* Unread badge */}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-xs">
              {unreadCount}
            </span>
          )}

          {isOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6 transition-transform rotate-0 group-hover:rotate-90 duration-200" />
          ) : (
            <div className="flex items-center justify-center">
              <SmileGuardMascot size={isBookingPage ? 24 : 32} tight={true} animated={false} />
            </div>
          )}
        </motion.button>
      </div>

      {/* =========================================================================
          EXPANDABLE CHAT PANEL
          ========================================================================= */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed z-50 right-3 sm:right-6 ${isPatientPortal ? 'bottom-20 sm:bottom-6' : 'bottom-4 sm:bottom-6'
              } ${panelDimensionsClass} rounded-3xl bg-surface-card dark:bg-[#0B1B32] border border-surface-border dark:border-[#26415E]/90 shadow-2xl overflow-hidden flex flex-col font-sans backdrop-blur-xl transition-all duration-300`}
          >
            {/* Header */}
            <header className="px-4 py-3 bg-gradient-to-r from-surface-50 via-teal-50/40 to-surface-card dark:from-[#0B1B32] dark:via-[#11233E] dark:to-[#0B1B32] border-b border-surface-border dark:border-[#26415E]/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                {/* Mascot Avatar with pulsating online badge */}
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500/15 via-cyan-500/10 to-teal-500/20 dark:from-teal-500/25 dark:to-cyan-500/15 flex items-center justify-center shrink-0 border border-teal-500/30 shadow-xs overflow-visible">
                  <SmileGuardMascot size={28} tight={true} animated={false} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-[#0B1B32]" />
                  </span>
                </div>

                {/* Identity Information */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-heading font-bold text-[14.5px] text-ink-primary dark:text-[#F8FAFC] tracking-tight truncate">
                      Gardy Assistant
                    </h3>
                    <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11.5px] font-medium text-ink-muted dark:text-[#83A6CE] truncate">
                      SmileGuard Assistant
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons bar */}
              <div className="flex items-center gap-0.5 shrink-0 bg-surface-100/70 dark:bg-[#122444]/80 p-1 rounded-xl border border-surface-200/80 dark:border-[#26415E]/70 shadow-2xs backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setIsMaximized((prev) => !prev)}
                  className="hidden sm:inline-flex p-1.5 rounded-lg text-ink-secondary dark:text-[#83A6CE] hover:text-teal-600 dark:hover:text-teal-300 hover:bg-white/80 dark:hover:bg-[#1E3756] transition-all cursor-pointer"
                  title={isMaximized ? 'Restore Compact Size' : 'Maximize Panel'}
                  aria-label="Maximize or restore"
                >
                  {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="p-1.5 rounded-lg text-ink-secondary dark:text-[#83A6CE] hover:text-teal-600 dark:hover:text-teal-300 hover:bg-white/80 dark:hover:bg-[#1E3756] transition-all cursor-pointer"
                  title="New Conversation"
                  aria-label="New Conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="p-1.5 rounded-lg text-ink-secondary dark:text-[#83A6CE] hover:text-red-500 dark:hover:text-red-400 hover:bg-white/80 dark:hover:bg-[#1E3756] transition-all cursor-pointer"
                  title="Clear History"
                  aria-label="Clear History"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="w-[1px] h-3.5 bg-surface-200 dark:bg-[#26415E] mx-0.5" />

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-ink-secondary dark:text-[#83A6CE] hover:text-ink-primary dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#1E3756] transition-all cursor-pointer"
                  title="Minimize"
                  aria-label="Minimize"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-ink-secondary dark:text-[#83A6CE] hover:text-red-500 dark:hover:text-red-400 hover:bg-white/80 dark:hover:bg-[#1E3756] transition-all cursor-pointer"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </header>

            {/* Scope Notice Banner */}
            <div className="px-3.5 py-1.5 bg-gradient-to-r from-teal-500/[0.08] via-teal-500/[0.04] to-surface-card dark:from-teal-500/[0.12] dark:via-teal-500/[0.05] dark:to-[#0B1B32] border-b border-teal-500/15 dark:border-teal-500/25 flex items-center justify-between gap-2 shrink-0 text-[11px]">
              <span className="flex items-center gap-1.5 min-w-0 text-teal-800 dark:text-teal-300">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate font-medium">
                  {isPatient
                    ? 'Dental care guidance & appointment support'
                    : 'Dental clinic workflows & radiograph decision support'}
                </span>
              </span>
              <span
                className={`shrink-0 text-[9.5px] px-2 py-0.5 rounded-full font-semibold border shadow-2xs ${roleBadge.color}`}
              >
                {roleBadge.label}
              </span>
            </div>

            {/* Emergency Alert Banner (if high-risk triage triggers) */}
            {hasEmergencyAlert && (
              <div className="p-3 bg-red-500/15 border-b border-red-500/30 text-red-800 dark:text-red-200 text-xs shrink-0 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="font-heading font-bold text-red-700 dark:text-red-300">
                    🚨 Urgent Dental Triage Advisory
                  </p>
                  <p className="text-[11px] leading-snug mt-0.5">
                    Severe facial swelling, respiratory difficulty, or uncontrolled bleeding requires immediate medical attention. Please contact your nearest emergency center or call 911 immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHasEmergencyAlert(false)}
                  className="text-red-600 hover:text-red-800 p-0.5"
                  title="Dismiss warning"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Message Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const isClinical =
                  !isUser &&
                  /caries|x-ray|xray|opg|infection|impacted|diagnosis|treatment|odontogram/i.test(
                    msg.content
                  );

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`flex items-start gap-2 max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'
                        }`}
                    >
                      {/* Avatar */}
                      {!isUser && (
                        <div className="w-7 h-7 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/20 flex items-center justify-center shrink-0 mt-0.5 text-teal-600 dark:text-teal-400">
                          <SmileGuardMascot size={20} tight={true} />
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`group relative rounded-2xl px-4 py-2.5 shadow-xs transition-all ${isUser
                          ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-br-xs'
                          : 'bg-surface-50 dark:bg-[#122444] border border-surface-200/90 dark:border-[#26415E] text-ink-primary dark:text-[#F8FAFC] rounded-bl-xs'
                          }`}
                      >
                        {isUser ? (
                          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap font-sans">
                            {msg.content}
                          </p>
                        ) : (
                          <FormattedMessage
                            content={msg.content}
                            onNavigate={handleNavigatePath}
                            isPatient={isPatient}
                          />
                        )}

                        {/* Action buttons on AI responses (Copy & Copy SOAP Note) */}
                        {!isUser && (
                          <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity z-10">
                            {isClinical && (
                              <button
                                type="button"
                                onClick={() => handleCopySoapNote(msg.id, msg.content)}
                                className="p-1 rounded-md bg-surface-card dark:bg-[#0B1B32] border border-surface-border dark:border-[#26415E] text-ink-secondary dark:text-[#83A6CE] hover:text-teal-600 shadow-xs text-[10px] flex items-center gap-1 cursor-pointer"
                                title="Copy structured SOAP note"
                              >
                                {copiedSoapId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span className="text-emerald-500 font-semibold">SOAP Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <FileText className="w-3 h-3 text-teal-600" />
                                    <span>SOAP</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="p-1 rounded-md bg-surface-card dark:bg-[#0B1B32] border border-surface-border dark:border-[#26415E] text-ink-secondary dark:text-[#83A6CE] hover:text-teal-600 shadow-xs text-[10px] flex items-center gap-1 cursor-pointer"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-ink-muted dark:text-[#83A6CE]/70 px-2 mt-1">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-start gap-2 max-w-[85%]">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <SmileGuardMascot size={20} tight={true} />
                  </div>
                  <div className="bg-surface-50 dark:bg-[#122444] border border-surface-200 dark:border-[#26415E] rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                    <span className="text-xs text-ink-muted dark:text-[#83A6CE]">
                      Gardy Assistant is analyzing
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div className="flex-1">
                    <p className="font-semibold">Unable to process request</p>
                    <p className="mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Suggested Prompts Carousel / Route Pills */}
              {!isLoading && suggestedPrompts.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-ink-muted dark:text-[#83A6CE] mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-500" /> Suggested for this page:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedPrompts.slice(0, 4).map((prompt, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="text-left text-[11.5px] px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-teal-50 dark:bg-[#152740] dark:hover:bg-[#1E3756] border border-surface-200 dark:border-[#26415E] text-ink-secondary dark:text-[#D1E0F0] hover:text-teal-700 dark:hover:text-teal-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <ChevronRight className="w-3 h-3 text-teal-500 shrink-0" />
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Area with Voice Dictation */}
            <footer className="p-3 bg-surface-card dark:bg-[#0B1B32] border-t border-surface-border dark:border-[#26415E]/80 shrink-0 space-y-2">
              <div className="relative flex items-end gap-1.5 bg-surface-50 dark:bg-[#122444] rounded-2xl border border-surface-200 dark:border-[#26415E] focus-within:border-teal-500 dark:focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all p-1.5">
                {/* Voice Dictation Button */}
                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-ink-secondary dark:text-[#83A6CE] hover:text-teal-600 hover:bg-surface-200/60 dark:hover:bg-[#1E3756]'
                    }`}
                  title={
                    isListening
                      ? 'Stop dictation'
                      : 'Chairside Voice Dictation (Speak your query)'
                  }
                  aria-label="Toggle voice input"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isListening
                      ? 'Listening chairside... speak clearly'
                      : 'Ask Gardy anything...'
                  }
                  rows={1}
                  maxLength={1000}
                  disabled={isLoading}
                  className="w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-5 text-ink-primary dark:text-[#F8FAFC] placeholder:text-ink-muted dark:placeholder:text-[#83A6CE]/60 placeholder:truncate focus:outline-none disabled:opacity-50 min-h-[36px] max-h-[120px] overflow-hidden"
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 disabled:hover:bg-teal-600 transition-all shrink-0 cursor-pointer active:scale-95"
                  aria-label="Send message"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Disclaimer footer caption */}
              <div className="flex items-center justify-between text-[10px] text-ink-muted dark:text-[#83A6CE]/60 px-1">
                <span>
                  {isListening ? (
                    <span className="text-red-500 font-semibold animate-pulse">
                      🎙️ Dictation active — Click mic to finish
                    </span>
                  ) : (
                    'Enter to send • Shift+Enter for new line'
                  )}
                </span>
                {inputText.length > 700 && (
                  <span className={inputText.length > 950 ? 'text-red-500 font-bold' : ''}>
                    {inputText.length}/1000
                  </span>
                )}
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default SmileGuardAssistant;
