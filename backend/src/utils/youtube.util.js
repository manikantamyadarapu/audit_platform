/**
 * Extract a YouTube video ID from common URL formats or a bare 11-char ID.
 * @param {string} input
 * @returns {string|null}
 */
function extractYoutubeVideoId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split('/').filter(Boolean);
      if (
        (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v') &&
        parts[1] &&
        /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Validate and normalize a YouTube URL for storage.
 * @param {string} input
 * @returns {{ videoId: string, youtubeUrl: string, embedUrl: string }}
 */
function validateAndNormalizeYoutubeUrl(input) {
  const videoId = extractYoutubeVideoId(input);
  if (!videoId) {
    const error = new Error('Invalid YouTube URL or video ID');
    error.statusCode = 400;
    throw error;
  }

  return {
    videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

module.exports = {
  extractYoutubeVideoId,
  validateAndNormalizeYoutubeUrl,
};
