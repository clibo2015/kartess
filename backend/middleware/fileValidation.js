/**
 * Enhanced file validation middleware
 * Validates files by signature (magic bytes) not just MIME type
 */

// File signature validation (magic bytes)
const FILE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a or GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // WebP starts with RIFF
  'video/mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]], // ftyp box variations
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
  'video/quicktime': [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74]], // QuickTime
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0xFF, 0xE3]], // MP3 variations
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]], // WAV also starts with RIFF
  'audio/ogg': [[0x4F, 0x67, 0x67, 0x53]], // OggS
};

function checkFileSignature(buffer, expectedMime) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const signatures = FILE_SIGNATURES[expectedMime];
  if (!signatures || !Array.isArray(signatures)) {
    return false;
  }

  // Check if buffer starts with any of the expected signatures
  for (const signature of signatures) {
    if (buffer.length < signature.length) continue;
    
    const matches = signature.every((byte, index) => buffer[index] === byte);
    if (matches) return true;
  }

  // Special handling for MP4 (can start at different positions)
  if (expectedMime === 'video/mp4') {
    // Check for ftyp box anywhere in first 32 bytes
    const header = buffer.slice(0, 32);
    if (header.includes(Buffer.from('ftyp'))) {
      return true;
    }
    // Also check for QuickTime format
    if (header.includes(Buffer.from('qt'))) {
      return true;
    }
  }

  // Special handling for WebP (starts with RIFF...WEBP)
  if (expectedMime === 'image/webp') {
    if (buffer.length >= 12 &&
        buffer.slice(0, 4).toString('ascii') === 'RIFF' && 
        buffer.slice(8, 12).toString('ascii') === 'WEBP') {
      return true;
    }
  }

  // Special handling for WAV (starts with RIFF...WAVE)
  if (expectedMime === 'audio/wav') {
    if (buffer.length >= 12 &&
        buffer.slice(0, 4).toString('ascii') === 'RIFF' && 
        buffer.slice(8, 12).toString('ascii') === 'WAVE') {
      return true;
    }
  }

  return false;
}

/**
 * Validate file by signature (magic bytes)
 */
async function validateFileSignature(buffer, allowedMimeTypes) {
  try {
    if (!buffer || buffer.length < 4) {
      return { valid: false, error: 'File too small or invalid' };
    }

    // Check each allowed MIME type
    for (const mime of allowedMimeTypes) {
      if (checkFileSignature(buffer, mime)) {
        return { valid: true, detectedType: { mime } };
      }
    }

    return { 
      valid: false, 
      error: 'File type does not match allowed types. File signature validation failed.' 
    };
  } catch (error) {
    return { valid: false, error: 'File validation failed' };
  }
}

/**
 * Validate file size
 */
function validateFileSize(size, maxSize = 50 * 1024 * 1024) { // 50MB default
  if (size > maxSize) {
    return { 
      valid: false, 
      error: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${(maxSize / 1024 / 1024).toFixed(2)}MB` 
    };
  }
  return { valid: true };
}

/**
 * Enhanced file filter for multer
 */
function createFileFilter(allowedMimeTypes) {
  return (req, file, cb) => {
    // First check MIME type (quick check)
    if (!allowedMimeTypes.some(mime => file.mimetype.startsWith(mime.split('/')[0]))) {
      return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }

    // Accept the file (signature validation will happen in route handler)
    cb(null, true);
  };
}

module.exports = {
  validateFileSignature,
  validateFileSize,
  createFileFilter,
  FILE_SIGNATURES,
};
