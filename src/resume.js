// Extracts plain text from a resume/job-description file (PDF or DOCX).
// For standard PDFs, uses pdf-parse to extract selectable text.
// For scanned or canvas-based PDFs (e.g. jsPDF exports with no text layer),
// automatically extracts embedded page images and transcribes them using
// the user's configured AI vision provider if available.
const fs = require('fs');
const path = require('path');

function extractJpegImages(buf) {
  const images = [];
  let start = 0;
  while ((start = buf.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), start)) !== -1) {
    const end = buf.indexOf(Buffer.from([0xFF, 0xD9]), start);
    if (end !== -1) {
      images.push(buf.slice(start, end + 2));
      start = end + 2;
    } else {
      break;
    }
  }
  return images;
}

async function parseDocumentFile(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    let text = '';
    try {
      const res = await pdfParse(buf);
      text = (res.text || '').trim();
    } catch (e) {
      console.warn('[resume] pdf-parse warning:', e && e.message ? e.message : e);
    }
    if (text.length >= 40) return text;

    // Fallback: Check for scanned/canvas-rendered PDF with embedded page images
    const images = extractJpegImages(buf);
    if (images.length > 0 && options.settings) {
      try {
        const { createLLM } = require('./llm');
        const llm = createLLM(options.settings);
        if (llm && llm.ready) {
          const pageTexts = [];
          for (let i = 0; i < images.length; i++) {
            const dataUrl = 'data:image/jpeg;base64,' + images[i].toString('base64');
            const pageText = await llm.stream({
              system: 'You are an expert document transcription system. Transcribe all text, sections, bullet points, headers, contact info, and details from this resume/document image accurately into structured text. Preserve all dates, numbers, metrics, and technical skills. Do not add conversational intro or outro.',
              turns: [{ role: 'user', text: `Transcribe all text from page ${i + 1} of ${images.length} accurately.` }],
              imageDataUrl: dataUrl,
              maxTokens: 2500,
              onToken: () => {}
            });
            if (pageText && pageText.trim()) {
              pageTexts.push(pageText.trim());
            }
          }
          if (pageTexts.length > 0) {
            return pageTexts.join('\n\n');
          }
        }
      } catch (ocrErr) {
        console.warn('[resume] vision transcription error:', ocrErr && ocrErr.message ? ocrErr.message : ocrErr);
      }
    }

    if (text.length > 0) return text;
    throw new Error('This PDF appears to be a scanned document or image without a selectable text layer (0 characters found). Please configure an AI provider in Settings so Cue can transcribe it automatically, or paste your resume text directly into Settings.');
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const res = await mammoth.extractRawText({ buffer: buf });
    return (res.value || '').trim();
  }
  throw new Error('Unsupported file type: ' + (ext || '(none)') + '. Use a PDF or DOCX file.');
}

module.exports = { parseDocumentFile, extractJpegImages };

