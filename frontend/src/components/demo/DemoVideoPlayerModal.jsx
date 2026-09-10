import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * YouTube embed modal — shared by Watch Demo buttons and the Demo Videos gallery.
 *
 * @param {{ open: boolean, video: object|null, onClose: () => void }} props
 */
export function DemoVideoPlayerModal({ open, video, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !video?.embedUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={video.title || 'Demo video'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-soft)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
              {video.title || 'Demo video'}
            </h3>
            {video.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
                {video.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
            aria-label="Close demo video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            title={video.title || 'YouTube demo'}
            src={`${video.embedUrl}?autoplay=1&rel=0`}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Official YouTube thumbnail URL for a video ID.
 * @param {string|null|undefined} videoId
 * @returns {string|null}
 */
export function getYoutubeThumbnailUrl(videoId) {
  if (!videoId) return null;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
