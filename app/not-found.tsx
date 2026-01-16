import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <section className="py-32 md:py-40 px-6 md:px-12 bg-stone-50 text-center min-h-[60vh] flex items-center justify-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight leading-tight text-stone-900 mb-6">
            Page Not Found
          </h1>
          <p className="text-lg md:text-xl font-light leading-relaxed text-stone-600 mb-12">
            The page you're looking for doesn't exist.
          </p>
          <Link href="/" className="btn-primary">
            Return to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
