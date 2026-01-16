import Link from 'next/link';

export default function DesktopNav() {
  return (
    <div className="hidden md:flex items-center gap-8">
      <Link href="/about" className="nav-link">
        About
      </Link>
      <Link href="/participate" className="btn-primary">
        Share Your Grief
      </Link>
    </div>
  );
}
