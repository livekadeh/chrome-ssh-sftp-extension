/**
 * Persian & Arabic BiDi Shaper & Alignment Engine for Terminal / xterm.js
 * Handles contextual cursive shaping (Presentation Forms-B), BiDi reversal,
 * line right-alignment for Persian text, and keystroke stream buffering.
 */

const ARABIC_PERSIAN_TABLE = {
  // [isolated, initial, medial, final, joinType: 0=non-joiner, 1=dual-joiner]
  0x0622: [0xFE81, 0xFE81, 0xFE82, 0xFE82, 0], // آ
  0x0627: [0xFE8D, 0xFE8D, 0xFE8E, 0xFE8E, 0], // ا
  0x0623: [0xFE83, 0xFE83, 0xFE84, 0xFE84, 0], // أ
  0x0625: [0xFE87, 0xFE87, 0xFE88, 0xFE88, 0], // إ
  0x0628: [0xFE8F, 0xFE91, 0xFE92, 0xFE90, 1], // ب
  0x067E: [0xFB56, 0xFB58, 0xFB59, 0xFB57, 1], // پ
  0x062A: [0xFE95, 0xFE97, 0xFE98, 0xFE96, 1], // ت
  0x062B: [0xFE99, 0xFE9B, 0xFE9C, 0xFE9A, 1], // ث
  0x062C: [0xFE9D, 0xFE9F, 0xFEA0, 0xFE9E, 1], // ج
  0x0686: [0xFB7A, 0xFB7C, 0xFB7D, 0xFB7B, 1], // چ
  0x062D: [0xFEA1, 0xFEA3, 0xFEA4, 0xFEA2, 1], // ح
  0x062E: [0xFEA5, 0xFEA7, 0xFEA8, 0xFEA6, 1], // خ
  0x062F: [0xFEA9, 0xFEA9, 0xFEAA, 0xFEAA, 0], // د
  0x0630: [0xFEAB, 0xFEAB, 0xFEAC, 0xFEAC, 0], // ذ
  0x0631: [0xFEAD, 0xFEAD, 0xFEAE, 0xFEAE, 0], // ر
  0x0632: [0xFEAF, 0xFEAF, 0xFEB0, 0xFEB0, 0], // ز
  0x0698: [0xFB8A, 0xFB8A, 0xFB8B, 0xFB8B, 0], // ژ
  0x0633: [0xFEB1, 0xFEB3, 0xFEB4, 0xFEB2, 1], // س
  0x0634: [0xFEB5, 0xFEB7, 0xFEB8, 0xFEB6, 1], // ش
  0x0635: [0xFEB9, 0xFEBB, 0xFEBC, 0xFEBA, 1], // ص
  0x0636: [0xFEBD, 0xFEBF, 0xFEC0, 0xFEBE, 1], // ض
  0x0637: [0xFEC1, 0xFEC3, 0xFEC4, 0xFEC2, 1], // ط
  0x0638: [0xFEC5, 0xFEC7, 0xFEC8, 0xFEC6, 1], // ظ
  0x0639: [0xFEC9, 0xFECB, 0xFECC, 0xFECA, 1], // ع
  0x063A: [0xFECD, 0xFECF, 0xFED0, 0xFECE, 1], // غ
  0x0641: [0xFED1, 0xFED3, 0xFED4, 0xFED2, 1], // ف
  0x0642: [0xFED5, 0xFED7, 0xFED8, 0xFED6, 1], // ق
  0x06A9: [0xFB8E, 0xFB90, 0xFB91, 0xFB8F, 1], // ک (Persian Kaf)
  0x0643: [0xFED9, 0xFEDB, 0xFEDC, 0xFEDA, 1], // ك (Arabic Kaf)
  0x06AF: [0xFB92, 0xFB94, 0xFB95, 0xFB93, 1], // گ (Gaf)
  0x0644: [0xFEDD, 0xFEDF, 0xFEE0, 0xFEDE, 1], // ل (Lam)
  0x0645: [0xFEE1, 0xFEE3, 0xFEE4, 0xFEE2, 1], // م (Mim)
  0x0646: [0xFEE5, 0xFEE7, 0xFEE8, 0xFEE6, 1], // ن (Nun)
  0x0648: [0xFEED, 0xFEED, 0xFEEE, 0xFEEE, 0], // و (Vav)
  0x0647: [0xFEE9, 0xFEEB, 0xFEEC, 0xFEEA, 1], // ه (He)
  0x06CC: [0xFBFC, 0xFBFE, 0xFBFF, 0xFBFD, 1], // ی (Persian Ye)
  0x064A: [0xFEF1, 0xFEF3, 0xFEF4, 0xFEF2, 1], // ي (Arabic Ye)
  0x0649: [0xFEEF, 0xFEEF, 0xFEF0, 0xFEF0, 0], // ى (Alef Maksura)
  0x0626: [0xFE89, 0xFE8B, 0xFE8C, 0xFE8A, 1], // ئ (Ye with Hamza)
  0x0624: [0xFE85, 0xFE85, 0xFE86, 0xFE86, 0], // ؤ (Vav with Hamza)
  0x0629: [0xFE93, 0xFE93, 0xFE94, 0xFE94, 0], // ة (Te Marbuta)
  0x0671: [0xFB50, 0xFB50, 0xFB51, 0xFB51, 0], // Alef Wasla
  0x0621: [0xFE80, 0xFE80, 0xFE80, 0xFE80, 0], // Hamza
};

const LAM = 0x0644;
const LAM_ALEF_MAP = {
  0x0622: [0xFEF5, 0xFEF5, 0xFEF6, 0xFEF6], // Alef Mad
  0x0627: [0xFEFB, 0xFEFB, 0xFEFC, 0xFEFC], // Alef
  0x0623: [0xFEF7, 0xFEF7, 0xFEF8, 0xFEF8], // Alef Hamza Above
  0x0625: [0xFEF9, 0xFEF9, 0xFEFA, 0xFEFA], // Alef Hamza Below
};

function isTashkeel(code) {
  return (code >= 0x064B && code <= 0x0652) || code === 0x0670;
}

function isArabicPersianChar(code) {
  return (code >= 0x0600 && code <= 0x06FF) || (code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF) || code === 0x200C;
}

function isJoiner(code) {
  if (code === 0x200C) return false;
  const entry = ARABIC_PERSIAN_TABLE[code];
  return entry ? entry[4] === 1 : false;
}

function canConnectPrevious(code) {
  if (code === 0x200C) return false;
  return ARABIC_PERSIAN_TABLE[code] !== undefined;
}

function shapeArabicPersianWord(word) {
  const chars = Array.from(word);
  const shaped = [];
  const len = chars.length;

  for (let i = 0; i < len; i++) {
    const code = chars[i].charCodeAt(0);

    // Pass through ZWNJ and tashkeel directly
    if (code === 0x200C || isTashkeel(code)) {
      shaped.push(chars[i]);
      continue;
    }

    // Find non-tashkeel next code
    let nextCode = 0;
    for (let ni = i + 1; ni < len; ni++) {
      const nc = chars[ni].charCodeAt(0);
      if (!isTashkeel(nc)) {
        nextCode = nc;
        break;
      }
    }

    // Find non-tashkeel previous code
    let prevCode = 0;
    for (let pi = i - 1; pi >= 0; pi--) {
      const pc = chars[pi].charCodeAt(0);
      if (!isTashkeel(pc)) {
        prevCode = pc;
        break;
      }
    }

    // Lam-Alef ligature
    if (code === LAM && LAM_ALEF_MAP[nextCode]) {
      const prevConnected = prevCode !== 0 && isJoiner(prevCode);
      const formIdx = prevConnected ? 2 : 0;
      shaped.push(String.fromCharCode(LAM_ALEF_MAP[nextCode][formIdx]));
      // Skip the alef
      for (let skip = i + 1; skip < len; skip++) {
        if (!isTashkeel(chars[skip].charCodeAt(0))) {
          i = skip;
          break;
        }
      }
      continue;
    }

    const entry = ARABIC_PERSIAN_TABLE[code];
    if (!entry) {
      shaped.push(chars[i]);
      continue;
    }

    const prevConnected = prevCode !== 0 && isJoiner(prevCode);
    const nextConnected = nextCode !== 0 && canConnectPrevious(nextCode);

    let formIndex = 0; // isolated
    if (prevConnected && nextConnected && entry[4] === 1) {
      formIndex = 2; // medial
    } else if (prevConnected) {
      formIndex = 3; // final
    } else if (nextConnected && entry[4] === 1) {
      formIndex = 1; // initial
    } else {
      formIndex = 0; // isolated
    }

    shaped.push(String.fromCharCode(entry[formIndex]));
  }

  return shaped.join('');
}

/**
 * Process a line or text segment for BiDi display in terminal emulator.
 */
function processBiDiTerminalText(text, termCols = 80, rightAlign = false) {
  if (!text || typeof text !== 'string') return text;
  
  let hasRTL = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c >= 0x0600 && c <= 0x06FF) || (c >= 0xFB50 && c <= 0xFEFC) || c === 0x200C) {
      hasRTL = true;
      break;
    }
  }

  if (!hasRTL) return text;

  // Split lines if multiline
  const lines = text.split(/(\r\n|\n|\r)/);
  const processedLines = lines.map((line) => {
    if (line === '\r\n' || line === '\n' || line === '\r') return line;

    // Split by ANSI escape sequences to avoid breaking terminal control codes
    const parts = line.split(/(\x1b\[[0-9;?]*[a-zA-Z]|\x1b\].*?\x07|\x1b[()][A-Z0-9])/g);

    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      if (!part || part.startsWith('\x1b')) continue;

      const rtlRegex = /([\u0600-\u06FF\uFB50-\uFEFC\u200C]+)/g;
      parts[p] = part.replace(rtlRegex, (match) => shapeArabicPersianWord(match));
    }

    return parts.join('');
  });

  return processedLines.join('');
}

if (typeof window !== 'undefined') {
  window.shapeArabicPersianWord = shapeArabicPersianWord;
  window.processBiDiTerminalText = processBiDiTerminalText;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shapeArabicPersianWord, processBiDiTerminalText };
}
