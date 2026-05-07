export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center" style={{ padding: 'var(--gap-2xl) var(--gap-lg)', color: 'var(--muted)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48, margin: '0 auto var(--gap-md)', opacity: 0.4 }}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', marginBottom: 'var(--gap-xs)', color: 'var(--fg)' }}>{title}</h3>
      {description && <p style={{ fontSize: 'var(--fs-sm)', maxWidth: 36, margin: '0 auto' }}>{description}</p>}
    </div>
  );
}
