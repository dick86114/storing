'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SourceCount {
  source: string;
  count: number;
  latestCreatedAt?: string;
}

interface SourcePillsProps {
  sources: SourceCount[];
  activeSource: string;
  totalCount: number;
  onSelect: (source: string) => void;
  currentSort?: string;
  onSortChange?: (sort: string) => void;
  sortOrder?: 'asc' | 'desc';
  onSortOrderChange?: (order: 'asc' | 'desc') => void;
}

const ArrowUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
);

export function SourcePills({
  sources,
  activeSource,
  totalCount,
  onSelect,
  currentSort = 'count',
  onSortChange,
  sortOrder = 'desc',
  onSortOrderChange,
}: SourcePillsProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFromModal, setSelectedFromModal] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const displayCount = 10;
  const allSources = [{ source: 'all', count: totalCount }, ...sources];
  const topSources = allSources.slice(0, displayCount);
  const remainingSources = allSources.slice(displayCount);

  const filteredRemaining = searchQuery
    ? remainingSources.filter((src) =>
        src.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : remainingSources;

  const displaySources = [...topSources];
  if (selectedFromModal && selectedFromModal !== 'all') {
    const isSelectedInTop = topSources.some((s) => s.source === selectedFromModal);
    if (!isSelectedInTop) {
      const selectedSource = allSources.find((s) => s.source === selectedFromModal);
      if (selectedSource) {
        displaySources.push(selectedSource);
      }
    }
  }

  const hasMore = remainingSources.length > 0;

  const sortOptions = [
    { value: 'count', label: '数量' },
    { value: 'name', label: '名称' },
    { value: 'latest', label: '时间' },
  ];

  const handleSortClick = (sort: string) => {
    if (!onSortChange || !onSortOrderChange) return;
    if (currentSort === sort) {
      onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(sort);
    }
  };

  const handleSelectFromModal = (source: string) => {
    setSelectedFromModal(source);
    onSelect(source);
    setShowModal(false);
    setSearchQuery('');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowModal(false);
        setSearchQuery('');
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setSearchQuery('');
      }
    };

    if (showModal) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showModal]);

  useEffect(() => {
    if (activeSource === 'all') {
      setSelectedFromModal(null);
    }
  }, [activeSource]);

  return (
    <div className="source-pills" style={{ padding: '12px 8px' }}>
      {onSortChange && (
        <div
          style={{
            display: 'flex',
            gap: '0',
            marginBottom: '12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {sortOptions.map((opt) => {
            const isActive = currentSort === opt.value;
            return (
            <button
              key={opt.value}
              className={`source-sort-button${isActive ? ' active' : ''}`}
                onClick={() => handleSortClick(opt.value)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: isActive ? 500 : 400,
                  border: 'none',
                  background: 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                {opt.label}
                {isActive && (sortOrder === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexWrap: 'nowrap',
        }}
        className="hide-scrollbar"
      >
        {displaySources.map((src, index) => {
          const isActive = activeSource === src.source;
          const isFromModal = selectedFromModal === src.source && index === displaySources.length - 1;
          return (
            <button
              key={src.source}
              className={`source-pill${isActive ? ' active' : ''}`}
              onClick={() => onSelect(src.source)}
              type="button"
              aria-pressed={isActive}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: 'transparent',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {src.source === 'all' ? '全部' : src.source} <span style={{ opacity: 0.7 }}>({src.count})</span>
            </button>
          );
        })}

        {hasMore && (
          <button
            className="source-pill source-pill-more"
            onClick={() => setShowModal(true)}
            type="button"
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              background: 'transparent',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            更多 ({remainingSources.length})
          </button>
        )}
      </div>

      {showModal && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'color-mix(in oklch, var(--bg) 70%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            overflow: 'hidden',
          }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            className="source-modal-panel"
            ref={modalRef}
            style={{
              background: 'var(--glass)',
              borderColor: 'var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(20px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
              width: 'min(900px, calc(100vw - 48px))',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gap-sm)',
                padding: 'var(--gap-md) var(--gap-lg)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: 'var(--muted)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="搜索来源..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  border: 'none',
                  background: 'none',
                  font: 'inherit',
                  fontSize: 16,
                  color: 'var(--fg)',
                  outline: 'none',
                  flex: 1,
                }}
              />
              <kbd
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  padding: '3px 7px',
                  background: 'var(--fg-soft)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--muted)',
                }}
              >
                ESC
              </kbd>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--gap-md)',
              }}
              onWheel={(e) => {
                e.stopPropagation();
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {filteredRemaining.map((src) => {
                  const isActive = activeSource === src.source;
                  return (
                    <button
                      key={src.source}
                      className={`source-pill${isActive ? ' active' : ''}`}
                      onClick={() => handleSelectFromModal(src.source)}
                      type="button"
                      style={{
                        padding: '8px 16px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        background: isActive ? 'var(--accent-soft)' : 'transparent',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {src.source} <span style={{ opacity: 0.7 }}>({src.count})</span>
                    </button>
                  );
                })}
                {filteredRemaining.length === 0 && (
                  <div
                    style={{
                      padding: 'var(--gap-xl) var(--gap-lg)',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: 'var(--fs-sm)',
                      width: '100%',
                    }}
                  >
                    没有找到匹配的来源
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
