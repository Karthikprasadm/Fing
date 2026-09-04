// High-performance screenshot via desktopCapturer (main process).
// Dynamic display targeting (multi-monitor aware) and High-DPI preservation.
const { desktopCapturer, screen } = require('electron');

async function captureScreenshot(targetBounds = null) {
  let display = null;
  if (targetBounds && typeof screen.getDisplayMatching === 'function') {
    try {
      display = screen.getDisplayMatching(targetBounds);
    } catch {}
  }
  if (!display) {
    try {
      const cursor = screen.getCursorScreenPoint();
      display = screen.getDisplayNearestPoint(cursor);
    } catch {}
  }
  if (!display) {
    display = screen.getPrimaryDisplay();
  }

  const scaleFactor = display.scaleFactor || 1;
  const width = Math.round((display.bounds?.width || display.size.width) * scaleFactor);
  const height = Math.round((display.bounds?.height || display.size.height) * scaleFactor);

  const maxW = 1920;
  const maxH = 1080;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const targetW = Math.max(320, Math.floor(width * scale));
  const targetH = Math.max(180, Math.floor(height * scale));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: targetW, height: targetH }
  });
  if (!sources.length) return null;

  // Match the active display ID or fallback to the closest source
  const displayIdStr = String(display.id);
  const src = sources.find((s) => String(s.display_id) === displayIdStr) || sources[0];
  const img = src.thumbnail;
  if (!img || img.isEmpty()) return null;

  if (typeof img.toJPEG === 'function') {
    try {
      return 'data:image/jpeg;base64,' + img.toJPEG(82).toString('base64');
    } catch {}
  }
  return img.toDataURL();
}

module.exports = { captureScreenshot };
