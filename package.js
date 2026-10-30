// Automated packaging script for Chrome Web Store submission
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Files and folders required for the extension
const filesToInclude = [
  'manifest.json',
  'background.js',
  'content/content.js',
  'content/audio-processor.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

// Simple pure-Node zip writer (no external dependencies needed)
function createZip(outputPath, files) {
  const zipEntries = [];
  let offset = 0;

  for (const relPath of files) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Warning: File missing: ${relPath}`);
      continue;
    }
    const data = fs.readFileSync(fullPath);
    const deflated = zlib.deflateRawSync(data);
    const normalizedName = relPath.replace(/\\/g, '/');
    const nameBuf = Buffer.from(normalizedName, 'utf8');

    // CRC32
    const crc = crc32(data);

    // Local file header
    const header = Buffer.alloc(30 + nameBuf.length);
    header.writeUInt32LE(0x04034b50, 0); // signature
    header.writeUInt16LE(20, 4);         // version needed (2.0)
    header.writeUInt16LE(0, 6);          // flags
    header.writeUInt16LE(8, 8);          // compression (deflate)
    header.writeUInt16LE(0, 10);         // time
    header.writeUInt16LE(0, 12);         // date
    header.writeUInt32LE(crc, 14);       // crc32
    header.writeUInt32LE(deflated.length, 18); // compressed size
    header.writeUInt32LE(data.length, 22);     // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26);  // file name length
    header.writeUInt16LE(0, 28);               // extra field length
    nameBuf.copy(header, 30);

    zipEntries.push({
      nameBuf,
      header,
      deflated,
      offset,
      crc,
      compressedSize: deflated.length,
      uncompressedSize: data.length
    });

    offset += header.length + deflated.length;
  }

  // Central directory
  const cdParts = [];
  let cdSize = 0;
  for (const entry of zipEntries) {
    const cdHeader = Buffer.alloc(46 + entry.nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    cdHeader.writeUInt16LE(20, 4);         // version made by
    cdHeader.writeUInt16LE(20, 6);         // version needed
    cdHeader.writeUInt16LE(0, 8);          // flags
    cdHeader.writeUInt16LE(8, 10);         // compression
    cdHeader.writeUInt16LE(0, 12);         // time
    cdHeader.writeUInt16LE(0, 14);         // date
    cdHeader.writeUInt32LE(entry.crc, 16);
    cdHeader.writeUInt32LE(entry.compressedSize, 20);
    cdHeader.writeUInt32LE(entry.uncompressedSize, 24);
    cdHeader.writeUInt16LE(entry.nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);         // extra field length
    cdHeader.writeUInt16LE(0, 32);         // file comment length
    cdHeader.writeUInt16LE(0, 34);         // disk number start
    cdHeader.writeUInt16LE(0, 36);         // internal attrs
    cdHeader.writeUInt32LE(0, 38);         // external attrs
    cdHeader.writeUInt32LE(entry.offset, 42); // relative offset of local header
    entry.nameBuf.copy(cdHeader, 46);

    cdParts.push(cdHeader);
    cdSize += cdHeader.length;
  }

  // End of central directory record (EOCD)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);        // signature
  eocd.writeUInt16LE(0, 4);                 // disk number
  eocd.writeUInt16LE(0, 6);                 // start disk
  eocd.writeUInt16LE(zipEntries.length, 8); // total entries on disk
  eocd.writeUInt16LE(zipEntries.length, 10);// total entries
  eocd.writeUInt32LE(cdSize, 12);           // cd size
  eocd.writeUInt32LE(offset, 16);           // offset of start of cd
  eocd.writeUInt16LE(0, 20);                // comment length

  // Assemble full zip
  const fullChunks = [];
  for (const entry of zipEntries) {
    fullChunks.push(entry.header);
    fullChunks.push(entry.deflated);
  }
  for (const cd of cdParts) {
    fullChunks.push(cd);
  }
  fullChunks.push(eocd);

  fs.writeFileSync(outputPath, Buffer.concat(fullChunks));
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const outputFile = path.join(distDir, 'soniclevel-v1.0.0.zip');
createZip(outputFile, filesToInclude);
console.log(`Created Chrome Web Store package: ${outputFile}`);
