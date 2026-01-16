import { getPageContent } from '@/lib/content-loader';
import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPageContent('about');
  return {
    title: content.metadata.title,
    description: content.metadata.description,
  };
}

export default async function AboutPage() {
  const content = await getPageContent('about');

  return (
    <PageTransition>
      <main>
      <section className="py-24 md:py-32 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <article
            className="prose prose-stone prose-lg max-w-none
                       [&>h1]:text-4xl [&>h1]:md:text-5xl [&>h1]:font-light [&>h1]:tracking-tight [&>h1]:mb-8
                       [&>h2]:text-3xl [&>h2]:md:text-4xl [&>h2]:font-light [&>h2]:tracking-tight [&>h2]:mt-16 [&>h2]:mb-6
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
