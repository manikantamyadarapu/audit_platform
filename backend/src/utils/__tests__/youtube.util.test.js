const {
  extractYoutubeVideoId,
  validateAndNormalizeYoutubeUrl,
} = require('../src/utils/youtube.util');

describe('youtube.util', () => {
  test('extracts id from watch URL', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  test('extracts id from youtu.be', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts id from embed URL', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  test('rejects invalid URL', () => {
    expect(extractYoutubeVideoId('https://example.com/watch?v=abc')).toBeNull();
    expect(() => validateAndNormalizeYoutubeUrl('not-a-url')).toThrow(/Invalid YouTube/);
  });

  test('normalizes to watch URL', () => {
    const result = validateAndNormalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
});
