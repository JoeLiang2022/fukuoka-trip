// i18n.js — Internationalization module for AI Story Creator
// Supports: zh-TW (default), en, ja, ko
// All functions are global (loaded via script tag)

var SUPPORTED_LANGUAGES = {
  'zh-TW': { name: '繁體中文', nameEn: 'Traditional Chinese', direction: 'ltr' },
  'en':    { name: 'English',   nameEn: 'English',             direction: 'ltr' },
  'ja':    { name: '日本語',    nameEn: 'Japanese',            direction: 'ltr' },
  'ko':    { name: '한국어',    nameEn: 'Korean',              direction: 'ltr' }
};

// Internal state
var _currentLang = 'zh-TW';
var _languagePacks = {};
var _fallbackPack = null; // zh-TW pack used as fallback

/**
 * Load a language pack JSON from i18n/{langCode}.json
 * Returns the pack object, or null on failure.
 */
async function _loadLanguagePack(langCode) {
  if (_languagePacks[langCode]) return _languagePacks[langCode];
  try {
    var base = window.location.hostname.includes('render.com')
      ? 'https://cdn.jsdelivr.net/gh/JoeLiang2022/fukuoka-trip@main/story/i18n/'
      : 'i18n/';
    var resp = await fetch(base + langCode + '.json?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var pack = await resp.json();
    _languagePacks[langCode] = pack;
    return pack;
  } catch (e) {
    console.warn('[i18n] Failed to load language pack: ' + langCode, e);
    return null;
  }
}

/**
 * Initialize i18n — load the saved language or default to zh-TW.
 * Call this on page load.
 */
async function initI18n() {
  // Load fallback (zh-TW) first
  _fallbackPack = await _loadLanguagePack('zh-TW');

  // Restore saved language
  var saved = localStorage.getItem('storyLang');
  if (saved && SUPPORTED_LANGUAGES[saved]) {
    _currentLang = saved;
  } else {
    _currentLang = 'zh-TW';
  }

  // Load current language pack
  if (_currentLang !== 'zh-TW') {
    await _loadLanguagePack(_currentLang);
  }

  // Apply to DOM
  _applyTranslations();
  document.documentElement.lang = _currentLang;
}

/**
 * setLanguage(langCode) — Switch UI and generation language.
 * Updates all data-i18n DOM elements, persists to localStorage, sets document lang.
 */
async function setLanguage(langCode) {
  if (!SUPPORTED_LANGUAGES[langCode]) {
    console.warn('[i18n] Unsupported language: ' + langCode + ', falling back to zh-TW');
    langCode = 'zh-TW';
  }

  // Load pack if not cached
  var pack = await _loadLanguagePack(langCode);
  if (!pack) {
    console.warn('[i18n] Could not load pack for ' + langCode + ', falling back to zh-TW');
    langCode = 'zh-TW';
    pack = _fallbackPack;
  }

  _currentLang = langCode;
  localStorage.setItem('storyLang', langCode);
  document.documentElement.lang = langCode;
  _applyTranslations();
}

/**
 * getLanguage() — Returns the current language code.
 */
function getLanguage() {
  return _currentLang;
}

/**
 * t(key) — Translate a UI string key.
 * Looks up in current language pack's `ui` object first,
 * falls back to zh-TW if key is missing.
 */
function t(key) {
  var pack = _languagePacks[_currentLang];
  if (pack && pack.ui && pack.ui[key] !== undefined && pack.ui[key] !== '') {
    return pack.ui[key];
  }
  // Fallback to zh-TW
  if (_fallbackPack && _fallbackPack.ui && _fallbackPack.ui[key] !== undefined) {
    return _fallbackPack.ui[key];
  }
  return key; // Last resort: return the key itself
}

/**
 * getPromptLanguageInstruction(langCode) — Returns the language instruction
 * string for prompt injection (e.g., "用繁體中文寫作" or "Write in English").
 */
function getPromptLanguageInstruction(langCode) {
  langCode = langCode || _currentLang;
  var pack = _languagePacks[langCode];
  if (pack && pack.prompts && pack.prompts.languageInstruction) {
    return pack.prompts.languageInstruction;
  }
  // Fallback
  if (_fallbackPack && _fallbackPack.prompts && _fallbackPack.prompts.languageInstruction) {
    return _fallbackPack.prompts.languageInstruction;
  }
  return '用繁體中文寫作';
}

/**
 * getPromptString(key, langCode) — Get a prompt template string for the given language.
 * Falls back to zh-TW if key missing.
 */
function getPromptString(key, langCode) {
  langCode = langCode || _currentLang;
  var pack = _languagePacks[langCode];
  if (pack && pack.prompts && pack.prompts[key] !== undefined) {
    return pack.prompts[key];
  }
  if (_fallbackPack && _fallbackPack.prompts && _fallbackPack.prompts[key]) {
    return _fallbackPack.prompts[key];
  }
  return '';
}

/**
 * getLanguageVoices(langCode) — Returns an array of TTS voice names
 * appropriate for the given language.
 */
function getLanguageVoices(langCode) {
  langCode = langCode || _currentLang;
  var pack = _languagePacks[langCode];
  if (pack && pack.defaultVoices && pack.defaultVoices.length > 0) {
    return pack.defaultVoices;
  }
  if (_fallbackPack && _fallbackPack.defaultVoices) {
    return _fallbackPack.defaultVoices;
  }
  return ['Kore', 'Aoede', 'Puck'];
}

/**
 * detectLanguage(text) — Simple heuristic to auto-detect language from user input.
 * Returns a language code from SUPPORTED_LANGUAGES.
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'zh-TW';
  text = text.trim();
  if (!text) return 'zh-TW';

  // Count character types
  var cjk = 0, hiraganaKatakana = 0, hangul = 0, latin = 0, total = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code <= 32) continue; // skip whitespace
    total++;
    // CJK Unified Ideographs (shared by zh, ja)
    if (code >= 0x4E00 && code <= 0x9FFF) cjk++;
    // Hiragana + Katakana (Japanese-specific)
    else if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) hiraganaKatakana++;
    // Hangul (Korean)
    else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF) || (code >= 0x3130 && code <= 0x318F)) hangul++;
    // Latin
    else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) latin++;
  }

  if (total === 0) return 'zh-TW';

  // Japanese: has hiragana/katakana
  if (hiraganaKatakana > 0 && hiraganaKatakana / total > 0.1) return 'ja';
  // Korean: has hangul
  if (hangul > 0 && hangul / total > 0.1) return 'ko';
  // English: mostly latin
  if (latin / total > 0.5) return 'en';
  // Default: Chinese
  return 'zh-TW';
}

/**
 * _applyTranslations() — Update all DOM elements with data-i18n attribute.
 */
function _applyTranslations() {
  var elements = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var key = el.getAttribute('data-i18n');
    if (key) {
      var translated = t(key);
      // Handle different element types
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.hasAttribute('placeholder')) {
          el.placeholder = translated;
        } else {
          el.value = translated;
        }
      } else {
        el.textContent = translated;
      }
    }
  }
}
