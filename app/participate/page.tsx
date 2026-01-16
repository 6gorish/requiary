import { getPageContent } from '@/lib/content-loader';
import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import GriefSubmissionForm from '@/components/grief/GriefSubmissionForm';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('participate');
  return {
    title: content.metadata.title,
    description: content.metadata.description,
  };
}

export default async function ParticipatePage() {
  const content = await getPageContent('participate');

  return (
    <PageTransition>
      <main>
        {/* Hero section - tighter spacing */}
        <section className="pt-24 md:pt-32 pb-6 md:pb-8 bg-gradient-to-b from-stone-100 to-stone-50">
          <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
            <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight leading-tight text-stone-900 mb-6">
              Share Your Grief
            </h1>
            <p className="text-lg md:text-xl font-light leading-relaxed text-stone-700 max-w-3xl mx-auto">
              We invite you to share a moment of loss, a memory, or a feeling. Your words will become 
              part of the installation's living soundscape and visualization, connecting with others 
              through unexpected resonances.
            </p>
          </div>
        </section>

        {/* Submission form - reduced top padding */}
        <section className="pt-6 pb-16 md:pt-8 md:pb-24 bg-stone-50">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
            <GriefSubmissionForm />
          </div>
        </section>

        {/* Additional content from markdown */}
        <section className="py-16 md:py-24 bg-stone-100">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
            <article
              className="prose prose-stone prose-lg max-w-none
                         [&>h1]:font-serif [&>h1]:text-4xl [&>h1]:md:text-5xl [&>h1]:font-light [&>h1]:tracking-tight [&>h1]:mb-8
                         [&>h2]:font-serif [&>h2]:text-3xl [&>h2]:md:text-4xl [&>h2]:font-light [&>h2]:tracking-tight [&>h2]:mt-16 [&>h2]:mb-6
                         [&>h3]:text-2xl [&>h3]:md:text-3xl [&>h3]:font-normal [&>h3]:tracking-tight [&>h3]:mt-12 [&>h3]:mb-4
                         [&>p]:text-base [&>p]:md:text-lg [&>p]:font-light [&>p]:leading-relaxed [&>p]:text-stone-700 [&>p]:mb-6"
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
          </div>
        </section>
      </main>
    </PageTransition>
  );
}
