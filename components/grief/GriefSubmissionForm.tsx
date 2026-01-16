'use client';

/**
 * GriefSubmissionForm
 * Anonymous grief message submission with character counter and validation
 * On success, stores message in sessionStorage and redirects to preview
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrCreateSessionId } from '@/lib/session';

const MAX_LENGTH = 280;

// Feature flag: Set to true to redirect to full installation
const SHOW_FULL_INSTALLATION = false;

export default function GriefSubmissionForm() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const remainingChars = MAX_LENGTH - content.length;
  const isValid = content.trim().length >= 1 && content.trim().length <= MAX_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // Get or create session ID
      const sessionId = getOrCreateSessionId();

      // Submit to API
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          sessionId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store the submitted message for the preview page
        sessionStorage.setItem('submittedGriefMessage', content.trim());
        
        // Redirect to appropriate page
        if (SHOW_FULL_INSTALLATION) {
          router.push('/installation');
        } else {
          router.push('/installation-preview');
        }
      } else if (response.status === 429) {
        setSubmitStatus({
          type: 'error',
          message: data.error || 'You\'ve reached the submission limit. Please wait before sharing another message.',
        });
      } else {
        setSubmitStatus({
          type: 'error',
          message: data.error || 'Failed to submit message. Please try again.',
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitStatus({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Textarea */}
        <div>
          <label htmlFor="grief-content" className="sr-only">
            What are you mourning?
          </label>
          <textarea
            id="grief-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What are you mourning?"
            maxLength={MAX_LENGTH}
            rows={6}
            className="w-full px-6 py-5
                       bg-white border border-stone-200
                       text-base md:text-lg font-light leading-relaxed text-stone-900
                       placeholder:text-stone-400 placeholder:font-light
                       focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400
                       resize-none
                       transition-all duration-200
                       shadow-sm"
            disabled={isSubmitting}
          />

          {/* Character counter and helper text */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mt-3 px-1">
            <p className="text-sm font-light text-stone-500 italic">
              A person, a relationship, a version of yourself, a future that won't arrive.
            </p>
            <p
              className={`text-sm font-normal tabular-nums ${
                remainingChars < 0
                  ? 'text-red-600'
                  : remainingChars < 50
                  ? 'text-amber-600'
                  : 'text-stone-500'
              }`}
            >
              {remainingChars} characters remaining
            </p>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? 'Sharing...' : 'Share Your Grief'}
          </button>
        </div>

        {/* Status messages - only shown for errors now */}
        {submitStatus.type === 'error' && (
          <div className="p-5 text-center border bg-red-50 text-red-900 border-red-200">
            <p className="text-sm md:text-base font-light leading-relaxed">
              {submitStatus.message}
            </p>
          </div>
        )}
      </form>

      {/* Privacy note */}
      <div className="mt-16 pt-12 border-t border-stone-200">
        <h3 className="text-lg md:text-xl font-normal tracking-tight text-stone-900 mb-5">
          Privacy & Moderation
        </h3>
        <div className="space-y-4 text-sm md:text-base font-light leading-relaxed text-stone-700">
          <p>
            <strong className="font-normal text-stone-900">Anonymity:</strong> We do not collect email addresses or identifying information.
            Your submission is anonymous.
          </p>
          <p>
            <strong className="font-normal text-stone-900">Public Display:</strong> Messages are displayed publicly as part of the visualization
            and on this website.
          </p>
          <p>
            <strong className="font-normal text-stone-900">Moderation:</strong> We review submissions to prevent abuse. We won't reject grief
            that's raw, angry, or difficult—but we will remove spam, harassment, and content that
            violates the space's intention.
          </p>
        </div>
      </div>
    </div>
  );
}
