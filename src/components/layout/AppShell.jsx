import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';

/**
 * Shared Global Application Shell for all authenticated SmileGuard AI portals.
 * Enforces a single consistent header height, 3-tier responsive navigation
 * (mobile slide-over drawer < md, tablet compact icon rail md..<lg, desktop sidebar >= lg),
 * mobile bottom tab bar (< md), and unified viewport gutter/container sizing.
 */
export function AppShell({
  title,
  role,
  unreadCount = 0,
  maxWidthClass = 'max-w-7xl',
  children,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const location = useLocation();

  // Auto-close transient mobile drawer & expanded tablet rail on navigation
  useEffect(() => {
    setMobileNavOpen(false);
    setTabletExpanded(false);
  }, [location.pathname]);

  // Close open navigation overlays on Escape key
  useEffect(() => {
    if (!mobileNavOpen && !tabletExpanded) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setTabletExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileNavOpen, tabletExpanded]);

  return (
    <div className="min-h-[100dvh] bg-surface-base text-ink-primary flex flex-col">
      <Topbar
        title={title}
        showMenuButton={true}
        isMobileMenuOpen={mobileNavOpen}
        onMenuToggle={() => setMobileNavOpen((prev) => !prev)}
        unreadCount={unreadCount}
      />

      <div className="md:pl-[4.5rem] lg:pl-64 flex-1 flex flex-col min-w-0 transition-[padding] duration-200">
        <Sidebar
          role={role}
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          tabletExpanded={tabletExpanded}
          onTabletToggle={() => setTabletExpanded((prev) => !prev)}
        />

        <main className="flex-1 w-full min-w-0 px-3.5 xs:px-5 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:py-6 lg:px-7 lg:py-7 desktop:px-8 desktop:py-8">
          <div className={`w-full min-w-0 mx-auto ${maxWidthClass}`}>
            {children}
          </div>
        </main>
      </div>

      <BottomTabBar role={role} />
    </div>
  );
}

