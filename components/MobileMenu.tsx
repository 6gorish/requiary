'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menu and trigger exit animation
  const closeMenu = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsAnimating(false);
    }, 300); // Match animation duration
  };

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const menuContent = (isOpen || isAnimating) && mounted ? (
    <>
      {/* Semi-transparent Backdrop with fade-in/out */}
      <div
        onClick={closeMenu}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9997,
          animation: isAnimating ? 'fadeOut 300ms cubic-bezier(0.4, 0.0, 0.2, 1)' : 'fadeIn 300ms cubic-bezier(0.4, 0.0, 0.2, 1)'
        }}
      />

      {/* Sidebar Panel - Slide in/out from right */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '280px',
          backgroundColor: '#fafaf9', // Exact stone-50 match
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9998,
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
          overflowY: 'auto',
          animation: isAnimating ? 'slideOutRight 300ms cubic-bezier(0.4, 0.0, 0.2, 1)' : 'slideInRight 300ms cubic-bezier(0.4, 0.0, 0.2, 1)'
        }}
      >
        {/* Close X Button - Pixel-perfect aligned with hamburger */}
        <button
          onClick={closeMenu}
          style={{
            position: 'absolute',
            top: '16px', // Matches nav py-4 (16px)
            right: '24px', // Matches nav px-6 (24px)
            padding: '8px', // Exact match to hamburger
            fontSize: '24px', // Exact match
            lineHeight: '1', // Exact match
            color: '#1c1917', // stone-900 - exact match
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
            zIndex: 10
          }}
          aria-label="Close menu"
        >
          ✕
        </button>

        {/* Menu Links */}
        <nav style={{ 
          paddingTop: '80px',
          paddingLeft: '24px', 
          paddingRight: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <Link
            href="/about"
            onClick={closeMenu}
            style={{
              display: 'block',
              fontSize: '16px',
              padding: '12px 16px',
              color: pathname === '/about' ? '#0c0a09' : '#57534e', // stone-900 : stone-600
              textDecoration: 'none',
              transition: 'color 200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
              fontWeight: pathname === '/about' ? '500' : '400'
            }}
          >
            About
          </Link>

          <Link
            href="/participate"
            onClick={closeMenu}
            style={{
              display: 'block',
              marginTop: '24px',
              textAlign: 'center',
              padding: '14px 32px',
              backgroundColor: '#292524', // stone-800
              color: '#fafaf9', // stone-50
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontSize: '14px',
              letterSpacing: '0.05em',
              fontWeight: '400',
              transition: 'background-color 300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
              borderRadius: '2px'
            }}
          >
            Share Your Grief
          </Link>
        </nav>
      </div>

      {/* Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes slideOutRight {
            from { transform: translateX(0); }
            to { transform: translateX(100%); }
          }
        `
      }} />
    </>
  ) : null;

  return (
    <>
      {/* Hamburger Button - Custom bars for perfect centering */}
      <button
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            setIsOpen(true);
          }
        }}
        className="md:hidden flex items-center justify-center self-center"
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          padding: '0',
          color: '#1c1917', // stone-900
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          transition: 'color 200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          zIndex: 9999
        }}
        aria-label="Menu"
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '5px',
          width: '24px',
          height: '24px'
        }}>
          <span style={{
            display: 'block',
            width: '24px',
            height: '2px',
            backgroundColor: '#1c1917',
            transition: 'all 200ms cubic-bezier(0.4, 0.0, 0.2, 1)'
          }} />
          <span style={{
            display: 'block',
            width: '24px',
            height: '2px',
            backgroundColor: '#1c1917',
            transition: 'all 200ms cubic-bezier(0.4, 0.0, 0.2, 1)'
          }} />
          <span style={{
            display: 'block',
            width: '24px',
            height: '2px',
            backgroundColor: '#1c1917',
            transition: 'all 200ms cubic-bezier(0.4, 0.0, 0.2, 1)'
          }} />
        </div>
      </button>

      {/* Portal the menu to document.body */}
      {mounted && menuContent && createPortal(menuContent, document.body)}
    </>
  );
}
