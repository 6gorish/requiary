/**
 * Client Layout Wrapper
 * 
 * Conditionally renders nav/footer based on route.
 * Installation route gets no chrome.
 */

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import DesktopNav from '@/components/DesktopNav'
import MobileMenu from '@/components/MobileMenu'

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // Installation and test routes get no chrome (full-screen canvas)
  const isInstallation = pathname === '/installation' || 
                         pathname === '/constellation-preview' ||
                         pathname === '/constellation-preview-light' ||
                         pathname === '/constellation-api' ||
                         pathname === '/hover-test' ||
                         pathname === '/multi-layer-test' ||
                         pathname === '/glow-test' ||
                         pathname === '/shader-test'

  if (isInstallation) {
    // Installation route: no nav, no footer
    return <>{children}</>
  }

  // All other routes: full layout with nav and footer
  return (
    <>
      {/* Navigation */}
      <nav className="border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm sticky top-0 z-50 transition-elegant">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-4 md:py-6">
          <div className="flex items-center justify-between min-h-[40px]">
            {/* Site title */}
            <Link 
              href="/" 
              className="group relative flex items-center self-center"
            >
              <span className="text-2xl md:text-3xl font-light tracking-tight text-stone-900 
                             transition-all duration-300 ease-out
                             group-hover:text-stone-600
                             relative inline-block leading-none"
                    style={{ fontFamily: 'var(--font-logo)', display: 'flex', alignItems: 'center' }}>
                Requiary
                {/* Elegant underline on hover */}
                <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-stone-900 
                             transition-all duration-500 ease-out
                             group-hover:w-full"></span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <DesktopNav />
            
            {/* Mobile Menu Button */}
            <MobileMenu />
          </div>
        </div>
      </nav>

      {children}

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            {/* About */}
            <div>
              <h3 className="text-xl md:text-2xl font-serif font-light tracking-tight mb-6">Requiary</h3>
              <p className="text-sm md:text-base text-stone-500 leading-relaxed">
                A contemplative space for collective witness of grief. Anonymous expressions of loss become luminous particles in a shared constellation.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-xl md:text-2xl font-serif font-light tracking-tight mb-6">Contact</h3>
              <div className="space-y-2">
                <p className="text-sm md:text-base text-stone-600 leading-relaxed">
                  Email: <a href="mailto:hello@requiary.app" className="hover:text-sky-700 transition-smooth">hello@requiary.app</a>
                </p>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-16 pt-8 border-t border-stone-200 text-center">
            <p className="text-xs md:text-sm text-stone-500 tracking-wide uppercase">
              © {new Date().getFullYear()} Requiary. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
