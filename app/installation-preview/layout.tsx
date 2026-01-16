import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Your Grief Has Been Witnessed | The House of Mourning',
  description: 'Your message has joined others in the constellation. December 19-20, 2025 at Truss House, Denver.',
  openGraph: {
    title: 'Your Grief Has Been Witnessed | The House of Mourning',
    description: 'Your message has joined others in the constellation. December 19-20, 2025 at Truss House, Denver.',
    type: 'website',
  },
}

export default function InstallationPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
