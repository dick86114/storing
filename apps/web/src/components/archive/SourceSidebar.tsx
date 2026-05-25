'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SourceCount {
  source: string;
  count: number;
  latestCreatedAt?: string;
}

interface SourceSidebarProps {
  sources: SourceCount[];
  activeSource: string;
  totalCount: number;
  onSelect: (source: string) => void;
  currentSort: string;
  onSortChange: (sort: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const ArrowUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export function SourceSidebar({
  sources,
  activeSource,
  totalCount,
  onSelect,
  currentSort,
  onSortChange,
  sortOrder,
  onSortOrderChange,
  collapsed = false,
  onToggleCollapsed,
}: SourceSidebarProps) {
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

  const activeLabel = activeSource === 'all' ? '全部文章' : activeSource;
  const activeCount = allSources.find((src) => src.source === activeSource)?.count ?? totalCount;
  const activeInitial = activeSource === 'all' ? '全' : Array.from(activeLabel.trim())[0] || '源';

  if (collapsed) {
    return (
      <aside
        className="source-sidebar source-sidebar--collapsed"
        style={{
          width: '52px',
          flexShrink: 0,
          height: 'fit-content',
          position: 'sticky',
          top: '24px',
        }}
      >
        <button
          className="source-sidebar-toggle source-sidebar-collapsed-card"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="展开来源列表"
          title="展开来源列表"
        >
          <span className="source-sidebar-collapsed-arrow" aria-hidden="true">
            <ChevronRightIcon />
          </span>
          <span className="source-sidebar-collapsed-mark">{activeInitial}</span>
          <span className="source-sidebar-collapsed-count">{activeCount}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="source-sidebar"
      style={{
        width: '260px',
        flexShrink: 0,
        padding: '0',
        height: 'fit-content',
        position: 'sticky',
        top: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>来源</span>
        <button
          className="source-sidebar-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="收起来源列表"
          title="收起来源列表"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            background: 'var(--fg-soft)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronLeftIcon />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            gap: '0',
            marginBottom: '16px',
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
                  padding: '8px 12px',
                  fontSize: '13px',
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
                  gap: '4px',
                }}
              >
                {opt.label}
                {isActive && (sortOrder === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              </button>
            );
          })}
        </div>
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {displaySources.map((src, index) => {
          const isActive = activeSource === src.source;
          const isFromModal = selectedFromModal === src.source && index === displaySources.length - 1;
          return (
            <li
              key={src.source}
              className={`source-sidebar-item${isActive ? ' active' : ''}`}
              onClick={() => onSelect(src.source)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && onSelect(src.source)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginTop: isFromModal ? '12px' : '0',
                borderTop: isFromModal ? '1px dashed var(--border)' : 'none',
                paddingTop: isFromModal ? '12px' : '10px',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {src.source === 'all' ? '全部文章' : src.source}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{src.count}</span>
            </li>
          );
        })}

        {hasMore && (
          <li
            onClick={() => setShowModal(true)}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--text-muted)',
              background: 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            更多 ({remainingSources.length})
          </li>
        )}
      </ul>

      {showModal && createPortal(
        <div
          className="source-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
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
            ref={modalRef}
            className="source-modal-panel"
            style={{
              background: 'var(--card-bg)',
              borderRadius: '16px',
              padding: '28px',
              width: '90%',
              maxWidth: '900px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>选择来源</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSearchQuery('');
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="搜索来源..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                scrollbarWidth: 'thin',
              }}
              onWheel={(e) => {
                e.stopPropagation();
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '8px',
                }}
              >
                {filteredRemaining.map((src) => {
                  const isActive = activeSource === src.source;
                  return (
                    <div
                      key={src.source}
                      className={`source-modal-item${isActive ? ' active' : ''}`}
                      onClick={() => handleSelectFromModal(src.source)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectFromModal(src.source)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        background: isActive ? 'var(--accent-soft)' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {src.source}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{src.count}</span>
                    </div>
                  );
                })}
                {filteredRemaining.length === 0 && (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '14px',
                      gridColumn: '1 / -1',
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
    </aside>
  );
}
