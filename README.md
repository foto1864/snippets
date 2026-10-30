# Snippets — Free File Converter

My first job as a web developer had me converting files all the time (PDF to JPG
and so on). I kept using the free versions of online converters, and even those
cap how much you can convert for free. So I started building my own.

Every conversion runs **in the browser**. Files never get uploaded, there are no
limits, and hosting stays free.

Live: https://snippets-militos.web.app

## Tools

| PDF | Images | Office → PDF | HEIC |
| --- | --- | --- | --- |
| Merge PDF (with images, page ranges, reorder) | JPG ⇄ PNG, PNG ⇄ WebP, JPG ⇄ WebP, WebP → JPG/PNG | DOCX → PDF (live preview, smart page breaks, or print for selectable text) | HEIC → JPG/PNG/WebP |
| Split PDF (select / ranges / every N / each page) | SVG → PNG (any scale) | PPTX → PDF | HEIC → PDF |
| JPG/any image → PDF (page size, margins, compression) | PNG → SVG (vector tracing or embed) | XLSX/XLS/ODS/CSV → PDF (vector tables, Greek/Unicode fonts) | |
| PDF → JPG/PNG/WebP (72–600 DPI, page selection) | Resize, quality, background colour for all image tools | | |

**Compress:** one File Compressor for PDFs (shrinks embedded images and keeps text
selectable, or flattens pages for maximum savings), JPG/PNG/WebP (quality, resize,
PNG colour quantization), videos (H.264 re-encode at 1080p/720p) and audio (MP3).

**Audio & video:** MP4/MOV/WebM/MKV → MP3 or WAV (bitrate, mono, trim), and
video compression. Uses WebCodecs, so large videos are streamed and never fully
loaded into memory.

**PDF:** also includes Extract Cover, which saves the first page of each PDF as an image.

Shared features: batch processing, drag-and-drop/paste, drag to reorder, ZIP
download, native share on mobile, dark mode, and a home page that suggests tools
for whatever file you drop on it.

## Development

```bash
npm install        # also copies pdf.js assets into public/pdfjs
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run build && firebase deploy   # deploy to snippets-militos.web.app
```

Stack: React + Vite, pdf-lib, pdf.js, Mediabunny (+ LAME MP3 encoder), UPNG.js, heic-to (libheif), docx-preview,
pptx-preview, SheetJS, jsPDF + autotable, imagetracerjs, modern-screenshot, fflate.

Hosting is Firebase project `code-snippets-foto`, site `snippets-militos`
(see `firebase.json`). To add a custom domain, go to Firebase Console → Hosting →
snippets-militos → Add custom domain.
