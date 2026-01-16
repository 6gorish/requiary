import { getPageContent } from '@/lib/content-loader';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShaderBackground } from '@/components/ShaderBackground';
import PageTransition from '@/components/PageTransition';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('home');
  return {
    title: content.metadata.title,
    description: content.metadata.description,
  };
}

export default async function HomePage() {
  const content = await getPageContent('home');

  return (
    <PageTransition>
      <main>
      {/* Hero Section */}
      <section className="relative min-h-[100dvh] md:min-h-[80vh] overflow-auto md:overflow-hidden">
        {/* Shader Background */}
        <ShaderBackground />

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/30 z-0" />

        {/* Fallback gradient if shader fails */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900 to-stone-800 -z-20" />

        <div className="relative z-10 flex items-center min-h-[100dvh] md:min-h-[80vh] py-4">
          <div className="w-full max-w-6xl mx-auto px-6 md:px-12 py-12 md:py-40">
            <div className="space-y-5 md:space-y-10 animate-fade-in">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif font-light tracking-tight leading-tight text-white drop-shadow-2xl">
                Requiary
              </h1>

              <p className="text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/90 max-w-3xl">
                Grief witnessed collectively.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 pt-4">
                <Link href="/participate" className="btn-primary">
                  Share Your Grief
                </Link>
                <Link href="/about" className="btn-secondary bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:border-white/50">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden md:block">
          <div className="flex flex-col items-center gap-2 text-white/60 animate-bounce">
            <span className="text-xs uppercase tracking-wider">Explore</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-24 md:py-32 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6 md:px-12 space-y-8">
          <p className="text-base md:text-lg font-light leading-relaxed text-stone-700">
            Grief can feel like the loneliest experience. We carry our losses as if they're singular, incomprehensible to anyone else. Yet when we create space to witness mourning together—not to fix it, not to rush past it, but simply to be present with it—something shifts.
          </p>

          <p className="text-base md:text-lg font-light leading-relaxed text-stone-700">
            Requiary transforms anonymous grief messages into a luminous constellation. Each submission becomes a glowing point of light in a shared cosmos. The system identifies resonances between expressions, revealing unexpected connections between individual griefs.
          </p>

          <p className="text-base md:text-lg font-light leading-relaxed text-stone-700">
            A generative soundscape emerges from the aggregate presence of messages—not a preset ambient bed, but sound generated from the data itself. Semantic similarity becomes harmonic consonance. The installation breathes, creating acoustic architecture for contemplation.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 md:py-32 bg-stone-100">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-serif font-light tracking-tight leading-tight text-stone-900">
            Contribute Your Voice
          </h2>

          <p className="text-lg md:text-xl font-light leading-relaxed text-stone-600 max-w-3xl mx-auto">
            Share a moment of loss, a memory, or a feeling. Your words will become part of the living soundscape and visualization, finding company in strangers' words.
          </p>

          <div className="pt-4">
            <Link href="/participate" className="btn-primary">
              Share Your Grief
            </Link>
          </div>
        </div>
      </section>
    </main>
    </PageTransition>
  );
}
