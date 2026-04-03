/**
 * Story Exporter — EPUB3 client-side generation & PDF export
 * Vanilla JS, no modules. Loaded via <script> tag.
 * Depends on global JSZip (loaded via CDN).
 */

// === Constants ===

var EPUB_IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/JoeLiang2022/fukuoka-trip@main/stories/img/';

var CONTAINER_XML = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
  '  <rootfiles>\n' +
  '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' +
  '  </rootfiles>\n' +
  '</container>';

var EPUB_CSS = 'body { font-family: "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif; ' +
  'margin: 1em; line-height: 1.8; color: #333; }\n' +
  'h1 { font-size: 1.5em; margin-bottom: 0.5em; }\n' +
  'h2 { font-size: 1.2em; margin-bottom: 0.3em; }\n' +
  'p { margin: 0.5em 0; text-indent: 2em; }\n' +
  'img { max-width: 100%; height: auto; display: block; margin: 1em auto; }\n' +
  '.chapter-title { text-align: center; margin: 2em 0 1em; }\n';

// === Utility: escape XML entities ===

function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// === Generate chapter XHTML ===

function generateChapterXHTML(chapter, index) {
  var num = index + 1;
  var title = escapeXML(chapter.title || ('Chapter ' + num));
  var text = chapter.text || '';

  // Split text into paragraphs and escape each
  var paragraphs = text.split(/\n+/).filter(function(p) { return p.trim(); });
  var bodyHTML = paragraphs.map(function(p) {
    return '    <p>' + escapeXML(p.trim()) + '</p>';
  }).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-TW">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8"/>\n' +
    '  <title>' + title + '</title>\n' +
    '  <link rel="stylesheet" type="text/css" href="style.css"/>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <h1 class="chapter-title">' + title + '</h1>\n' +
    bodyHTML + '\n' +
    '</body>\n' +
    '</html>';
}

// === Generate content.opf (package metadata) ===

function generateContentOPF(storyData, manifest, spine, options) {
  var title = escapeXML(storyData.title || 'Untitled Story');
  var author = escapeXML((options && options.author) || 'AI Story Creator');
  var lang = (options && options.language) || 'zh-TW';
  var uid = 'story-' + (storyData.id || Date.now());
  var date = new Date().toISOString().split('T')[0];

  var manifestItems = '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n' +
    '    <item id="style" href="style.css" media-type="text/css"/>\n' +
    '    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n';

  for (var i = 0; i < manifest.length; i++) {
    var m = manifest[i];
    manifestItems += '    <item id="' + escapeXML(m.id) + '" href="' + escapeXML(m.href) + '" media-type="' + escapeXML(m.mediaType) + '"/>\n';
  }

  var spineItems = '';
  for (var j = 0; j < spine.length; j++) {
    spineItems += '    <itemref idref="' + escapeXML(spine[j]) + '"/>\n';
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">\n' +
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    '    <dc:identifier id="BookId">' + escapeXML(uid) + '</dc:identifier>\n' +
    '    <dc:title>' + title + '</dc:title>\n' +
    '    <dc:creator>' + author + '</dc:creator>\n' +
    '    <dc:language>' + escapeXML(lang) + '</dc:language>\n' +
    '    <dc:date>' + date + '</dc:date>\n' +
    '    <meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta>\n' +
    '  </metadata>\n' +
    '  <manifest>\n' +
    manifestItems +
    '  </manifest>\n' +
    '  <spine toc="ncx">\n' +
    spineItems +
    '  </spine>\n' +
    '</package>';
}

// === Generate toc.ncx (EPUB2 navigation) ===

function generateTocNCX(storyData) {
  var title = escapeXML(storyData.title || 'Untitled Story');
  var uid = 'story-' + (storyData.id || Date.now());
  var chapters = storyData.chapters || [];

  var navPoints = '';
  for (var i = 0; i < chapters.length; i++) {
    var num = i + 1;
    var chTitle = escapeXML(chapters[i].title || ('Chapter ' + num));
    var filename = 'chapter_' + String(num).padStart(3, '0') + '.xhtml';
    navPoints += '    <navPoint id="navpoint-' + num + '" playOrder="' + num + '">\n' +
      '      <navLabel><text>' + chTitle + '</text></navLabel>\n' +
      '      <content src="' + filename + '"/>\n' +
      '    </navPoint>\n';
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n' +
    '  <head>\n' +
    '    <meta name="dtb:uid" content="' + escapeXML(uid) + '"/>\n' +
    '  </head>\n' +
    '  <docTitle><text>' + title + '</text></docTitle>\n' +
    '  <navMap>\n' +
    navPoints +
    '  </navMap>\n' +
    '</ncx>';
}

// === Generate toc.xhtml (EPUB3 navigation) ===

function generateTocXHTML(storyData) {
  var title = escapeXML(storyData.title || 'Untitled Story');
  var chapters = storyData.chapters || [];

  var navItems = '';
  for (var i = 0; i < chapters.length; i++) {
    var num = i + 1;
    var chTitle = escapeXML(chapters[i].title || ('Chapter ' + num));
    var filename = 'chapter_' + String(num).padStart(3, '0') + '.xhtml';
    navItems += '      <li><a href="' + filename + '">' + chTitle + '</a></li>\n';
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8"/>\n' +
    '  <title>' + title + '</title>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <nav epub:type="toc" id="toc">\n' +
    '    <h1>Table of Contents</h1>\n' +
    '    <ol>\n' +
    navItems +
    '    </ol>\n' +
    '  </nav>\n' +
    '</body>\n' +
    '</html>';
}

// === Download blob as file ===

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}


// === Resolve image URL for a chapter ===

function resolveChapterImageUrl(chapter, index) {
  // If chapter has explicit imageUrl, use it
  if (chapter.imageUrl) return chapter.imageUrl;
  // Try CDN path based on story convention
  if (chapter.image) return EPUB_IMAGE_BASE + chapter.image;
  return null;
}

// === Generate EPUB3 (client-side, uses JSZip) ===

async function generateEPUB(storyData, options) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip not loaded. Please include JSZip via CDN.');
  }

  options = options || {};
  var zip = new JSZip();

  // 1. mimetype — MUST be first entry, stored uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', CONTAINER_XML);

  // 3. Build chapters, collect manifest & spine
  var chapters = storyData.chapters || [];
  var manifest = [];
  var spine = [];
  var imageWarnings = [];

  for (var i = 0; i < chapters.length; i++) {
    var ch = chapters[i];
    var num = i + 1;
    var filename = 'chapter_' + String(num).padStart(3, '0') + '.xhtml';
    var xhtml = generateChapterXHTML(ch, i);
    zip.file('OEBPS/' + filename, xhtml);
    manifest.push({ id: 'ch' + num, href: filename, mediaType: 'application/xhtml+xml' });
    spine.push('ch' + num);

    // 4. Embed images if requested (Task 7.2)
    if (options.includeImages) {
      var imgUrl = resolveChapterImageUrl(ch, i);
      if (imgUrl) {
        try {
          var imgResp = await fetch(imgUrl);
          if (!imgResp.ok) throw new Error('HTTP ' + imgResp.status);
          var imgBlob = await imgResp.blob();
          // Determine extension from content-type or URL
          var ext = 'png';
          var ct = imgResp.headers.get('content-type') || '';
          if (ct.indexOf('jpeg') !== -1 || ct.indexOf('jpg') !== -1) ext = 'jpg';
          else if (ct.indexOf('gif') !== -1) ext = 'gif';
          else if (ct.indexOf('webp') !== -1) ext = 'webp';
          var imgName = 'images/ch_' + String(num).padStart(3, '0') + '.' + ext;
          var imgMediaType = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
          zip.file('OEBPS/' + imgName, imgBlob);
          manifest.push({ id: 'img' + num, href: imgName, mediaType: imgMediaType });
        } catch (e) {
          console.warn('Failed to embed image for chapter ' + num + ':', e.message || e);
          imageWarnings.push('Chapter ' + num + ': image skipped (' + (e.message || 'fetch failed') + ')');
        }
      }
    }
  }

  // 5. Generate metadata files
  zip.file('OEBPS/content.opf', generateContentOPF(storyData, manifest, spine, options));
  zip.file('OEBPS/toc.ncx', generateTocNCX(storyData));
  zip.file('OEBPS/toc.xhtml', generateTocXHTML(storyData));
  zip.file('OEBPS/style.css', EPUB_CSS);

  // 6. Generate ZIP blob
  var blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  // Log warnings if any
  if (imageWarnings.length > 0) {
    console.warn('EPUB image warnings:', imageWarnings);
  }

  return blob;
}

// === Export PDF — client-side print-friendly approach (Task 7.4) ===

function exportPDF(storyData, options) {
  options = options || {};
  var title = storyData.title || 'Untitled Story';
  var author = (options && options.author) || 'AI Story Creator';
  var chapters = storyData.chapters || [];

  // Build a print-friendly HTML page
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>' + escapeXML(title) + '</title>' +
    '<style>' +
    'body { font-family: "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", "Hiragino Sans", "Yu Gothic", sans-serif; ' +
    'margin: 0; padding: 20px 40px; line-height: 1.8; color: #333; }' +
    'h1 { text-align: center; font-size: 1.8em; margin: 1em 0; }' +
    'h2 { font-size: 1.3em; margin: 1.5em 0 0.5em; page-break-before: always; }' +
    'h2:first-of-type { page-break-before: avoid; }' +
    'p { margin: 0.5em 0; text-indent: 2em; }' +
    '.author { text-align: center; color: #666; margin-bottom: 2em; }' +
    'img { max-width: 100%; height: auto; display: block; margin: 1em auto; }' +
    '@media print { body { padding: 0; } h2 { page-break-before: always; } h2:first-of-type { page-break-before: avoid; } }' +
    '</style></head><body>';

  html += '<h1>' + escapeXML(title) + '</h1>';
  html += '<p class="author">' + escapeXML(author) + '</p>';

  for (var i = 0; i < chapters.length; i++) {
    var ch = chapters[i];
    var chTitle = ch.title || ('Chapter ' + (i + 1));
    html += '<h2>' + escapeXML(chTitle) + '</h2>';

    var text = ch.text || '';
    var paragraphs = text.split(/\n+/).filter(function(p) { return p.trim(); });
    for (var j = 0; j < paragraphs.length; j++) {
      html += '<p>' + escapeXML(paragraphs[j].trim()) + '</p>';
    }
  }

  html += '<script>window.onload=function(){window.print();}<\/script>';
  html += '</body></html>';

  // Open in new window for print-to-PDF
  var printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // Fallback: download as HTML
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, title + '.html');
  }
}
