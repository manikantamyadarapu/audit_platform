import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CustomSelect } from '../components/ui/CustomSelect';
import {
  DemoVideoPlayerModal,
  getYoutubeThumbnailUrl,
} from '../components/demo/DemoVideoPlayerModal';
import { DEMO_VIDEO_MODULES, getDemoModuleLabel } from '../constants/demoVideoModules';
import {
  createDemoVideo,
  deactivateDemoVideo,
  deleteDemoVideo,
  fetchActiveDemoVideos,
  fetchAllDemoVideos,
  updateDemoVideo,
} from '../services/demoVideo.service';
import { getStoredUser } from '../utils/authUser';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${
        type === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-green-200 bg-green-50 text-green-700'
      }`}
    >
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm">{message}</span>
      <button type="button" onClick={onClose} className="ml-2">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function VideoModal({ isOpen, onClose, onSave, video, isLoading }) {
  const [formData, setFormData] = useState({
    module: 'sales-audit',
    title: '',
    youtubeUrl: '',
    description: '',
    displayOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    if (video) {
      setFormData({
        module: video.module || 'sales-audit',
        title: video.title || '',
        youtubeUrl: video.youtubeUrl || '',
        description: video.description || '',
        displayOrder: video.displayOrder ?? 0,
        isActive: video.isActive !== false,
      });
    } else {
      setFormData({
        module: 'sales-audit',
        title: '',
        youtubeUrl: '',
        description: '',
        displayOrder: 0,
        isActive: true,
      });
    }
  }, [video, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {video ? 'Edit demo video' : 'Add demo video'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
        >
          <CustomSelect
            label="Module"
            value={formData.module}
            onChange={(value) => setFormData({ ...formData, module: value })}
            options={DEMO_VIDEO_MODULES.map((m) => ({ value: m.key, label: m.label }))}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-full border border-gray-200 px-4 py-2.5 outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">YouTube URL</label>
            <input
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              value={formData.youtubeUrl}
              onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
              className="w-full rounded-full border border-gray-200 px-4 py-2.5 outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Display order</label>
            <input
              type="number"
              value={formData.displayOrder}
              onChange={(e) =>
                setFormData({ ...formData, displayOrder: Number(e.target.value) || 0 })
              }
              className="w-full rounded-full border border-gray-200 px-4 py-2.5 outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Active (visible to users)
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-full">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
              className="flex-1 rounded-full"
            >
              {video ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewerDemoVideosGallery() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActiveDemoVideos()
      .then((data) => {
        if (!cancelled) {
          setVideos(Array.isArray(data) ? data.filter((v) => v?.embedUrl || v?.videoId) : []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || 'Failed to load videos');
          setVideos([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const closePlayer = useCallback(() => setPlaying(null), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Demo Videos</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Watch help videos for each audit module. Click a thumbnail to play.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <Card>
          <CardBody>
            <p className="text-sm text-rose-700">{error}</p>
          </CardBody>
        </Card>
      ) : videos.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-slate-500">
              No demo videos are available yet.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => {
            const thumb = getYoutubeThumbnailUrl(video.videoId);
            return (
              <button
                key={video.id}
                type="button"
                onClick={() => setPlaying(video)}
                className="group overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-left shadow-[var(--shadow-glass)] transition hover:border-emerald-300 hover:shadow-[var(--shadow-float)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-900 text-slate-400">
                      No preview
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-110">
                      <Play className="h-7 w-7 fill-white" />
                    </span>
                  </div>
                </div>
                <div className="space-y-1 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {getDemoModuleLabel(video.module)}
                  </p>
                  <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
                    {video.title}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <DemoVideoPlayerModal open={Boolean(playing)} video={playing} onClose={closePlayer} />
    </div>
  );
}

function AdminDemoVideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAllDemoVideos();
      setVideos(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Failed to load videos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (formData) => {
    try {
      setSaving(true);
      if (editing) {
        await updateDemoVideo(editing.id, formData);
        showToast('Demo video updated');
      } else {
        await createDemoVideo(formData);
        showToast('Demo video created');
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (video) => {
    try {
      await deactivateDemoVideo(video.id);
      showToast('Demo video deactivated');
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Deactivate failed', 'error');
    }
  };

  const handleDelete = async (video) => {
    if (!window.confirm(`Delete demo video for ${getDemoModuleLabel(video.module)}?`)) return;
    try {
      await deleteDemoVideo(video.id);
      showToast('Demo video deleted');
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Demo Videos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage YouTube help videos for each audit module. URLs are validated before save.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add video
        </Button>
      </div>

      <Card>
        <CardBody>
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : videos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No demo videos yet. Add one for Sales Audit, Cash Ledger, and other modules.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-3 py-3 font-semibold">Order</th>
                    <th className="px-3 py-3 font-semibold">Module</th>
                    <th className="px-3 py-3 font-semibold">Title</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => (
                    <tr key={video.id} className="border-b border-slate-100">
                      <td className="px-3 py-3">{video.displayOrder}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {getDemoModuleLabel(video.module)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800">{video.title}</div>
                        <div className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                          {video.youtubeUrl}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            video.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {video.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditing(video);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {video.isActive ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDeactivate(video)}
                            >
                              Deactivate
                            </Button>
                          ) : null}
                          <Button variant="danger" size="sm" onClick={() => handleDelete(video)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <VideoModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        video={editing}
        isLoading={saving}
      />
    </div>
  );
}

export default function DemoVideosPage() {
  const role = String(getStoredUser()?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  if (isAdmin) {
    return <AdminDemoVideosPage />;
  }

  return <ViewerDemoVideosGallery />;
}
