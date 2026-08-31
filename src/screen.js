// High-performance screenshot via desktopCapturer (main process).
// Bounded resolution and fast JPEG compression for rapid capture and streaming.
const { desktopCapturer, screen } = require('electron');

async function captureScreenshot() {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  const maxW = 1440;
  const maxH = 900;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const targetW = Math.max(320, Math.floor(width * scale));
  const targetH = Math.max(180, Math.floor(height * scale));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: targetW, height: targetH }
  });
  if (!sources.length) return null;
  // Prefer the primary display source.
  const src = sources.find((s) => String(s.display_id) === String(primary.id)) || sources[0];
  const img = src.thumbnail;
  if (!img || img.isEmpty()) return null;
  if (typeof img.toJPEG === 'function') {
    try {
      return 'data:image/jpeg;base64,' + img.toJPEG(75).toString('base64');
    } catch {
      // fallback
    }
  }
  return img.toDataURL(); // data:image/png;base64,...
}

module.exports = { captureScreenshot };
