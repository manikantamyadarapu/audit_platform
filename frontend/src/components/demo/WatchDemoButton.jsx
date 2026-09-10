import { useCallback, useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { fetchDemoVideoByModule } from '../../services/demoVideo.service';
import { DemoVideoPlayerModal } from './DemoVideoPlayerModal';

/**
 * Watch Demo button + YouTube embed modal for a module.
 * Hidden when no active video is configured for the module.
 *
 * @param {{ moduleKey: string, className?: string, size?: 'sm'|'md'|'lg', label?: string }} props
 */
export function WatchDemoButton({
  moduleKey,
  className,
  size = 'md',
  label = 'Watch Demo',
}) {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDemoVideoByModule(moduleKey)
      .then((data) => {
        if (!cancelled) setVideo(data?.embedUrl ? data : null);
      })
      .catch(() => {
        if (!cancelled) setVideo(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  const close = useCallback(() => setOpen(false), []);

  if (loading || !video) return null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <PlayCircle className="h-4 w-4" />
        {label}
      </Button>

      <DemoVideoPlayerModal open={open} video={video} onClose={close} />
    </>
  );
}
