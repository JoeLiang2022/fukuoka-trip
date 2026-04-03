// story-bible.js — Story Bible persistent memory system
// Stores characters, worldbuilding, relationships, plot threads across sessions
// Loaded via <script> tag — all functions are global

// === Valid Enums ===
var VALID_PLOT_STATUS = ['active', 'resolved', 'dormant'];
var VALID_WORLD_CATEGORY = ['location', 'organization', 'magic_system', 'technology', 'culture', 'custom'];
var VALID_RELATIONSHIP_TYPE = ['ally', 'enemy', 'romantic', 'family', 'mentor', 'rival', 'custom'];

// === ID Generator ===
function _bibleId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
}

// === Create Empty Bible ===
function createEmptyBible(storyId) {
  return {
    storyId: storyId || '',
    version: 1,
    lastUpdated: Date.now(),
    characters: [],
    world: [],
    relationships: [],
    plotThreads: [],
    themes: [],
    timeline: {}
  };
}

// === Validation ===
function validateBible(bible) {
  var errors = [];
  if (!bible || typeof bible !== 'object') return ['Bible is not an object'];

  // 14.1: storyId non-empty
  if (!bible.storyId || typeof bible.storyId !== 'string' || bible.storyId.trim() === '') {
    errors.push('storyId must be a non-empty string');
  }

  var chars = bible.characters || [];
  var charIds = [];
  var charNames = [];

  for (var i = 0; i < chars.length; i++) {
    if (chars[i].id) charIds.push(chars[i].id);
    // 14.2: unique character names (case-insensitive)
    var lowerName = (chars[i].name || '').toLowerCase().trim();
    if (lowerName && charNames.indexOf(lowerName) >= 0) {
      errors.push('Duplicate character name: ' + chars[i].name);
    }
    if (lowerName) charNames.push(lowerName);
  }

  // 14.3: relationships reference valid character IDs
  var rels = bible.relationships || [];
  for (var r = 0; r < rels.length; r++) {
    if (rels[r].char1Id && charIds.indexOf(rels[r].char1Id) < 0) {
      errors.push('Relationship references invalid char1Id: ' + rels[r].char1Id);
    }
    if (rels[r].char2Id && charIds.indexOf(rels[r].char2Id) < 0) {
      errors.push('Relationship references invalid char2Id: ' + rels[r].char2Id);
    }
  }

  // 14.4: plotThread status
  var threads = bible.plotThreads || [];
  for (var t = 0; t < threads.length; t++) {
    if (threads[t].status && VALID_PLOT_STATUS.indexOf(threads[t].status) < 0) {
      errors.push('Invalid plotThread status: ' + threads[t].status);
    }
  }

  // 14.5: world category
  var world = bible.world || [];
  for (var w = 0; w < world.length; w++) {
    if (world[w].category && VALID_WORLD_CATEGORY.indexOf(world[w].category) < 0) {
      errors.push('Invalid world category: ' + world[w].category);
    }
  }

  return errors;
}


// === LocalStorage Key ===
function _bibleKey(storyId) {
  return 'storyBible_' + storyId;
}

// === Save Bible to LocalStorage ===
function saveBible(bible) {
  if (!bible || !bible.storyId) return false;
  bible.lastUpdated = Date.now();
  try {
    localStorage.setItem(_bibleKey(bible.storyId), JSON.stringify(bible));
    return true;
  } catch (e) {
    // Storage limit exceeded — compress and retry
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      return _handleStorageLimit(bible);
    }
    console.error('saveBible error:', e);
    return false;
  }
}

// === Load Bible (LocalStorage first, fallback GitHub) ===
function loadBible(storyId) {
  if (!storyId) return null;
  // Try LocalStorage first
  try {
    var stored = localStorage.getItem(_bibleKey(storyId));
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && parsed.storyId) return parsed;
    }
  } catch (e) { /* ignore parse errors */ }
  // No local data — return null (caller can fetch from GitHub async)
  return null;
}

// === Load Bible with GitHub Fallback (async) ===
async function loadBibleAsync(storyId) {
  var local = loadBible(storyId);
  if (local) return local;
  // Fallback: fetch from GitHub
  try {
    var resp = await fetch(STORIES_BASE + 'bibles/' + storyId + '.json?t=' + Date.now());
    if (resp.ok) {
      var bible = await resp.json();
      if (bible && bible.storyId) {
        saveBible(bible); // cache locally
        return bible;
      }
    }
  } catch (e) { /* GitHub fetch failed */ }
  return null;
}

// === Save Bible to GitHub ===
async function saveBibleToGitHub(bible) {
  if (!bible || !bible.storyId) return false;
  bible.lastUpdated = Date.now();
  try {
    var resp = await fetch(API_BASE + '/api/story/save-bible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: bible.storyId, bible: bible })
    });
    return resp.ok;
  } catch (e) {
    console.error('saveBibleToGitHub error:', e);
    return false;
  }
}

// === Update Entry ===
function updateEntry(bible, category, id, data) {
  if (!bible || !category || !id || !data) return bible;
  var arr = bible[category];
  if (!Array.isArray(arr)) return bible;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === id) {
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          arr[i][key] = data[key];
        }
      }
      bible.lastUpdated = Date.now();
      break;
    }
  }
  return bible;
}

// === Delete Entry (with cascade for characters) ===
function deleteEntry(bible, category, id) {
  if (!bible || !category || !id) return bible;
  var arr = bible[category];
  if (!Array.isArray(arr)) return bible;

  // Remove the entry
  bible[category] = arr.filter(function(entry) { return entry.id !== id; });

  // Cascade: if deleting a character, remove relationships referencing it
  if (category === 'characters') {
    bible.relationships = (bible.relationships || []).filter(function(rel) {
      return rel.char1Id !== id && rel.char2Id !== id;
    });
    // Also remove from plotThread relatedCharacters
    var threads = bible.plotThreads || [];
    for (var t = 0; t < threads.length; t++) {
      if (threads[t].relatedCharacters) {
        threads[t].relatedCharacters = threads[t].relatedCharacters.filter(function(cid) {
          return cid !== id;
        });
      }
    }
  }

  bible.lastUpdated = Date.now();
  return bible;
}

// === Search Bible ===
function searchBible(bible, query) {
  if (!bible || !query) return [];
  var q = query.toLowerCase().trim();
  if (!q) return [];
  var results = [];

  function matchText(text) {
    return text && text.toLowerCase().indexOf(q) >= 0;
  }

  // Search characters
  (bible.characters || []).forEach(function(c) {
    if (matchText(c.name) || matchText(c.appearance) || matchText(c.personality) ||
        matchText(c.backstory) || matchText(c.motivation) || matchText(c.arc) ||
        (c.aliases && c.aliases.some(matchText))) {
      results.push({ category: 'characters', entry: c });
    }
  });

  // Search world
  (bible.world || []).forEach(function(w) {
    if (matchText(w.name) || matchText(w.description) || matchText(w.category)) {
      results.push({ category: 'world', entry: w });
    }
  });

  // Search relationships
  (bible.relationships || []).forEach(function(r) {
    if (matchText(r.description) || matchText(r.type) ||
        (r.history && r.history.some(matchText))) {
      results.push({ category: 'relationships', entry: r });
    }
  });

  // Search plot threads
  (bible.plotThreads || []).forEach(function(p) {
    if (matchText(p.name) || matchText(p.description)) {
      results.push({ category: 'plotThreads', entry: p });
    }
  });

  // Search themes
  (bible.themes || []).forEach(function(th) {
    if (matchText(th)) {
      results.push({ category: 'themes', entry: th });
    }
  });

  return results;
}


// === Bible Extraction from Story (Task 1.4) ===
async function extractBibleFromStory(storyData, existingBible) {
  if (!storyData || !storyData.chapters || storyData.chapters.length === 0) {
    return createEmptyBible(storyData ? storyData.storyId || '' : '');
  }

  // Build text from chapters
  var allText = storyData.chapters.map(function(ch) {
    return '第' + ch.num + '篇「' + (ch.title || '') + '」：\n' + (ch.text || '');
  }).join('\n\n');

  // Truncate to 8000 chars
  if (allText.length > 8000) {
    allText = allText.substring(0, 8000) + '\n...(truncated)';
  }

  var prompt = '分析以下故事，提取結構化的故事聖經（Story Bible）。\n\n' +
    allText + '\n\n' +
    '【輸出格式】JSON（不要 markdown 標記）：\n' +
    '{"characters":[{"name":"角色名","appearance":"外貌","personality":"性格","backstory":"背景","motivation":"動機","arc":"弧線","firstSeen":1,"lastSeen":1}],' +
    '"world":[{"name":"地點/組織名","category":"location|organization|magic_system|technology|culture|custom","description":"描述","properties":{}}],' +
    '"relationships":[{"char1":"角色1名","char2":"角色2名","type":"ally|enemy|romantic|family|mentor|rival|custom","description":"關係描述"}],' +
    '"plotThreads":[{"name":"線索名","status":"active|resolved|dormant","description":"描述","introduced":1}],' +
    '"themes":["主題1"]}';

  try {
    var resp = await fetch(API_BASE + '/api/story-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, style: 'bible-extract' })
    });
    if (!resp.ok) return createEmptyBible(storyData.storyId || '');
    var data = await resp.json();
    return parseBibleExtraction(data.text || '');
  } catch (e) {
    console.error('extractBibleFromStory error:', e);
    return createEmptyBible(storyData.storyId || '');
  }
}

// === Parse Bible Extraction (3-tier fallback, never throws) ===
function parseBibleExtraction(text) {
  var empty = createEmptyBible('');

  if (!text || typeof text !== 'string') return empty;

  // Tier 1: Direct JSON parse
  try {
    var cleaned = text.trim();
    // Strip markdown code fences
    var tick3 = String.fromCharCode(96, 96, 96);
    cleaned = cleaned.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
    var parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      return _normalizeParsedBible(parsed);
    }
  } catch (e) { /* Tier 1 failed */ }

  // Tier 2: Extract JSON from text (find first { ... } block)
  try {
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      var jsonStr = text.substring(start, end + 1);
      var parsed2 = JSON.parse(jsonStr);
      if (parsed2 && typeof parsed2 === 'object') {
        return _normalizeParsedBible(parsed2);
      }
    }
  } catch (e) { /* Tier 2 failed */ }

  // Tier 3: Regex extraction of character names at minimum
  try {
    var chars = [];
    var nameMatches = text.match(/["「]([^"」]{1,20})["」]/g);
    if (nameMatches) {
      var seen = {};
      for (var i = 0; i < nameMatches.length && chars.length < 10; i++) {
        var name = nameMatches[i].replace(/[""「」]/g, '').trim();
        if (name && !seen[name.toLowerCase()] && name.length >= 2) {
          seen[name.toLowerCase()] = true;
          chars.push({
            id: _bibleId('char'),
            name: name,
            appearance: '', personality: '', backstory: '', motivation: '', arc: '',
            aliases: [], firstSeen: 1, lastSeen: 1
          });
        }
      }
    }
    if (chars.length > 0) {
      empty.characters = chars;
      return empty;
    }
  } catch (e) { /* Tier 3 failed */ }

  return empty;
}

// === Normalize parsed bible data ===
function _normalizeParsedBible(parsed) {
  var bible = createEmptyBible('');

  // Normalize characters
  if (Array.isArray(parsed.characters)) {
    for (var i = 0; i < parsed.characters.length; i++) {
      var c = parsed.characters[i];
      if (!c.name) continue;
      bible.characters.push({
        id: c.id || _bibleId('char'),
        name: c.name || '',
        appearance: c.appearance || '',
        personality: c.personality || '',
        backstory: c.backstory || '',
        motivation: c.motivation || '',
        arc: c.arc || '',
        aliases: Array.isArray(c.aliases) ? c.aliases : [],
        firstSeen: c.firstSeen || 1,
        lastSeen: c.lastSeen || c.firstSeen || 1
      });
    }
  }

  // Normalize world
  if (Array.isArray(parsed.world)) {
    for (var w = 0; w < parsed.world.length; w++) {
      var we = parsed.world[w];
      if (!we.name) continue;
      var cat = we.category || 'custom';
      if (VALID_WORLD_CATEGORY.indexOf(cat) < 0) cat = 'custom';
      bible.world.push({
        id: we.id || _bibleId('world'),
        name: we.name,
        category: cat,
        description: we.description || '',
        properties: we.properties || {}
      });
    }
  }

  // Normalize relationships (char1/char2 names → will be resolved to IDs during merge)
  if (Array.isArray(parsed.relationships)) {
    for (var r = 0; r < parsed.relationships.length; r++) {
      var rel = parsed.relationships[r];
      var type = rel.type || 'custom';
      if (VALID_RELATIONSHIP_TYPE.indexOf(type) < 0) type = 'custom';
      bible.relationships.push({
        char1Id: rel.char1Id || rel.char1 || '',
        char2Id: rel.char2Id || rel.char2 || '',
        type: type,
        description: rel.description || '',
        history: Array.isArray(rel.history) ? rel.history : []
      });
    }
  }

  // Normalize plot threads
  if (Array.isArray(parsed.plotThreads)) {
    for (var t = 0; t < parsed.plotThreads.length; t++) {
      var pt = parsed.plotThreads[t];
      if (!pt.name) continue;
      var status = pt.status || 'active';
      if (VALID_PLOT_STATUS.indexOf(status) < 0) status = 'active';
      bible.plotThreads.push({
        id: pt.id || _bibleId('plot'),
        name: pt.name,
        status: status,
        description: pt.description || '',
        introduced: pt.introduced || 1,
        resolved: pt.resolved || null,
        relatedCharacters: Array.isArray(pt.relatedCharacters) ? pt.relatedCharacters : []
      });
    }
  }

  // Themes
  if (Array.isArray(parsed.themes)) {
    bible.themes = parsed.themes.filter(function(th) { return typeof th === 'string' && th.trim(); });
  }

  return bible;
}


// === Bible Merge (Task 1.6) ===
function mergeBible(existing, extracted) {
  if (!existing) existing = createEmptyBible('');
  if (!extracted) return existing;

  var merged = JSON.parse(JSON.stringify(existing)); // deep clone

  // === Merge Characters ===
  var extChars = extracted.characters || [];
  for (var i = 0; i < extChars.length; i++) {
    var ext = extChars[i];
    var match = _findCharacterMatch(merged.characters, ext.name, ext.aliases);
    if (match) {
      // Fill empty fields only — never overwrite non-empty existing
      _fillEmptyFields(match, ext, ['name', 'id']);
      // Always update lastSeen if extracted is newer
      if (ext.lastSeen && (!match.lastSeen || ext.lastSeen > match.lastSeen)) {
        match.lastSeen = ext.lastSeen;
      }
      // Merge aliases without duplicates
      if (ext.aliases && ext.aliases.length > 0) {
        if (!match.aliases) match.aliases = [];
        for (var a = 0; a < ext.aliases.length; a++) {
          var alias = ext.aliases[a];
          var alreadyHas = match.aliases.some(function(existing) {
            return existing.toLowerCase() === alias.toLowerCase();
          });
          if (!alreadyHas && alias.toLowerCase() !== match.name.toLowerCase()) {
            match.aliases.push(alias);
          }
        }
      }
    } else {
      // New character — add with generated ID
      var newChar = JSON.parse(JSON.stringify(ext));
      newChar.id = newChar.id || _bibleId('char');
      merged.characters.push(newChar);
    }
  }

  // === Merge Relationships ===
  var extRels = extracted.relationships || [];
  for (var ri = 0; ri < extRels.length; ri++) {
    var extRel = extRels[ri];
    // Resolve names to IDs if needed
    var c1Id = _resolveCharRef(merged.characters, extRel.char1Id);
    var c2Id = _resolveCharRef(merged.characters, extRel.char2Id);
    if (!c1Id || !c2Id || c1Id === c2Id) continue;

    var relMatch = _findRelationshipMatch(merged.relationships, c1Id, c2Id);
    if (relMatch) {
      _fillEmptyFields(relMatch, extRel, ['char1Id', 'char2Id']);
      // Append new history entries
      if (extRel.history && extRel.history.length > 0) {
        if (!relMatch.history) relMatch.history = [];
        for (var h = 0; h < extRel.history.length; h++) {
          if (relMatch.history.indexOf(extRel.history[h]) < 0) {
            relMatch.history.push(extRel.history[h]);
          }
        }
      }
    } else {
      merged.relationships.push({
        char1Id: c1Id,
        char2Id: c2Id,
        type: extRel.type || 'custom',
        description: extRel.description || '',
        history: Array.isArray(extRel.history) ? extRel.history.slice() : []
      });
    }
  }

  // === Merge Plot Threads ===
  var extThreads = extracted.plotThreads || [];
  for (var ti = 0; ti < extThreads.length; ti++) {
    var extThread = extThreads[ti];
    var threadMatch = _findPlotThreadMatch(merged.plotThreads, extThread.name);
    if (threadMatch) {
      _fillEmptyFields(threadMatch, extThread, ['name', 'id']);
      // Update status if extracted has a more advanced status
      if (extThread.status === 'resolved' && threadMatch.status === 'active') {
        threadMatch.status = 'resolved';
        threadMatch.resolved = extThread.resolved || null;
      }
    } else {
      var newThread = JSON.parse(JSON.stringify(extThread));
      newThread.id = newThread.id || _bibleId('plot');
      // Resolve relatedCharacters names to IDs
      if (newThread.relatedCharacters) {
        newThread.relatedCharacters = newThread.relatedCharacters.map(function(ref) {
          return _resolveCharRef(merged.characters, ref) || ref;
        });
      }
      merged.plotThreads.push(newThread);
    }
  }

  // === Merge World Entries ===
  var extWorld = extracted.world || [];
  for (var wi = 0; wi < extWorld.length; wi++) {
    var extW = extWorld[wi];
    var worldMatch = _findWorldMatch(merged.world, extW.name);
    if (worldMatch) {
      _fillEmptyFields(worldMatch, extW, ['name', 'id']);
      // Merge properties
      if (extW.properties) {
        if (!worldMatch.properties) worldMatch.properties = {};
        for (var pk in extW.properties) {
          if (extW.properties.hasOwnProperty(pk) && !worldMatch.properties[pk]) {
            worldMatch.properties[pk] = extW.properties[pk];
          }
        }
      }
    } else {
      var newW = JSON.parse(JSON.stringify(extW));
      newW.id = newW.id || _bibleId('world');
      merged.world.push(newW);
    }
  }

  // === Merge Themes ===
  if (extracted.themes && extracted.themes.length > 0) {
    if (!merged.themes) merged.themes = [];
    for (var thi = 0; thi < extracted.themes.length; thi++) {
      var theme = extracted.themes[thi];
      var hasTheme = merged.themes.some(function(t) {
        return t.toLowerCase() === theme.toLowerCase();
      });
      if (!hasTheme) merged.themes.push(theme);
    }
  }

  // === Post-merge cleanup ===
  // Ensure no duplicate character names
  _deduplicateCharacterNames(merged);
  // Ensure all relationship refs are valid
  _cleanInvalidRelationships(merged);

  merged.lastUpdated = Date.now();
  return merged;
}

// === Merge Helpers ===
function _findCharacterMatch(characters, name, aliases) {
  if (!name) return null;
  var lowerName = name.toLowerCase().trim();
  var allNames = [lowerName];
  if (aliases) {
    for (var i = 0; i < aliases.length; i++) {
      allNames.push(aliases[i].toLowerCase().trim());
    }
  }

  for (var c = 0; c < characters.length; c++) {
    var ch = characters[c];
    var chLower = (ch.name || '').toLowerCase().trim();
    // Match by name
    if (allNames.indexOf(chLower) >= 0) return ch;
    // Match by aliases
    if (ch.aliases) {
      for (var a = 0; a < ch.aliases.length; a++) {
        if (allNames.indexOf(ch.aliases[a].toLowerCase().trim()) >= 0) return ch;
      }
    }
  }
  return null;
}

function _findRelationshipMatch(relationships, char1Id, char2Id) {
  for (var i = 0; i < relationships.length; i++) {
    var r = relationships[i];
    if ((r.char1Id === char1Id && r.char2Id === char2Id) ||
        (r.char1Id === char2Id && r.char2Id === char1Id)) {
      return r;
    }
  }
  return null;
}

function _findPlotThreadMatch(threads, name) {
  if (!name) return null;
  var lowerName = name.toLowerCase().trim();
  for (var i = 0; i < threads.length; i++) {
    var tName = (threads[i].name || '').toLowerCase().trim();
    if (tName === lowerName) return threads[i];
    // Name similarity > 80%
    if (_nameSimilarity(tName, lowerName) > 0.8) return threads[i];
  }
  return null;
}

function _findWorldMatch(world, name) {
  if (!name) return null;
  var lowerName = name.toLowerCase().trim();
  for (var i = 0; i < world.length; i++) {
    if ((world[i].name || '').toLowerCase().trim() === lowerName) return world[i];
  }
  return null;
}

function _resolveCharRef(characters, ref) {
  if (!ref) return '';
  // If ref is already a valid ID
  for (var i = 0; i < characters.length; i++) {
    if (characters[i].id === ref) return ref;
  }
  // Try matching by name
  var match = _findCharacterMatch(characters, ref, []);
  return match ? match.id : '';
}

function _fillEmptyFields(target, source, skipKeys) {
  for (var key in source) {
    if (!source.hasOwnProperty(key)) continue;
    if (skipKeys && skipKeys.indexOf(key) >= 0) continue;
    var srcVal = source[key];
    var tgtVal = target[key];
    // Only fill if target field is empty/falsy
    if (srcVal && !tgtVal) {
      target[key] = srcVal;
    }
  }
}

function _nameSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Simple character overlap ratio
  var longer = a.length > b.length ? a : b;
  var shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  var matches = 0;
  for (var i = 0; i < shorter.length; i++) {
    if (longer.indexOf(shorter[i]) >= 0) matches++;
  }
  return matches / longer.length;
}

function _deduplicateCharacterNames(bible) {
  var seen = {};
  var unique = [];
  for (var i = 0; i < bible.characters.length; i++) {
    var ch = bible.characters[i];
    var key = (ch.name || '').toLowerCase().trim();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(ch);
    }
  }
  bible.characters = unique;
}

function _cleanInvalidRelationships(bible) {
  var charIds = {};
  for (var i = 0; i < bible.characters.length; i++) {
    charIds[bible.characters[i].id] = true;
  }
  bible.relationships = (bible.relationships || []).filter(function(r) {
    return charIds[r.char1Id] && charIds[r.char2Id];
  });
}


// === Compress Bible for Prompt (Task 1.8) ===
function compressBibleForPrompt(bible, maxTokens) {
  if (!bible) return '';
  maxTokens = maxTokens || 1500;

  // Estimate tokens: ~1 token per 1.5 Chinese chars, ~1 token per 4 English chars
  function estimateTokens(text) {
    if (!text) return 0;
    var cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g);
    var cjkCount = cjk ? cjk.length : 0;
    var nonCjkCount = text.length - cjkCount;
    return Math.ceil(cjkCount / 1.5 + nonCjkCount / 4);
  }

  var sections = [];
  var usedTokens = 0;
  var lastChapter = bible.characters.reduce(function(max, c) {
    return Math.max(max, c.lastSeen || 0);
  }, 0);

  // Priority 1: Active characters (lastSeen within last 5 chapters)
  var recentChars = bible.characters.filter(function(c) {
    return !lastChapter || (c.lastSeen && (lastChapter - c.lastSeen) < 5);
  });
  if (recentChars.length > 0) {
    var charLines = recentChars.map(function(c) {
      var parts = [c.name];
      if (c.appearance) parts.push(c.appearance);
      if (c.personality) parts.push(c.personality);
      if (c.motivation) parts.push('動機:' + c.motivation);
      return '- ' + parts.join('，');
    });
    var charSection = '【角色】\n' + charLines.join('\n');
    var charTokens = estimateTokens(charSection);
    if (usedTokens + charTokens <= maxTokens) {
      sections.push(charSection);
      usedTokens += charTokens;
    } else {
      // Truncate to fit — include as many characters as possible
      var truncLines = [];
      for (var ci = 0; ci < charLines.length; ci++) {
        var testSection = '【角色】\n' + truncLines.concat([charLines[ci]]).join('\n');
        if (usedTokens + estimateTokens(testSection) > maxTokens) break;
        truncLines.push(charLines[ci]);
      }
      if (truncLines.length > 0) {
        var truncSection = '【角色】\n' + truncLines.join('\n');
        sections.push(truncSection);
        usedTokens += estimateTokens(truncSection);
      }
    }
  }

  // Priority 2: Active relationships
  var activeRels = (bible.relationships || []).filter(function(r) {
    // Include all relationships between recent characters
    return true;
  });
  if (activeRels.length > 0 && usedTokens < maxTokens) {
    var relLines = activeRels.map(function(r) {
      var c1 = _findCharById(bible.characters, r.char1Id);
      var c2 = _findCharById(bible.characters, r.char2Id);
      return '- ' + (c1 ? c1.name : '?') + '↔' + (c2 ? c2.name : '?') + '：' + (r.description || r.type);
    });
    var relSection = '【關係】\n' + relLines.join('\n');
    var relTokens = estimateTokens(relSection);
    if (usedTokens + relTokens <= maxTokens) {
      sections.push(relSection);
      usedTokens += relTokens;
    }
  }

  // Priority 3: Active plot threads
  var activeThreads = (bible.plotThreads || []).filter(function(t) {
    return t.status === 'active';
  });
  if (activeThreads.length > 0 && usedTokens < maxTokens) {
    var threadLines = activeThreads.map(function(t) {
      return '- ' + t.name + '（' + t.status + '）：' + (t.description || '');
    });
    var threadSection = '【伏筆線索】\n' + threadLines.join('\n');
    var threadTokens = estimateTokens(threadSection);
    if (usedTokens + threadTokens <= maxTokens) {
      sections.push(threadSection);
      usedTokens += threadTokens;
    }
  }

  // Priority 4: World entries (if budget allows)
  if ((bible.world || []).length > 0 && usedTokens < maxTokens) {
    var worldLines = bible.world.map(function(w) {
      return '- ' + w.name + '（' + w.category + '）：' + (w.description || '');
    });
    var worldSection = '【世界觀】\n' + worldLines.join('\n');
    var worldTokens = estimateTokens(worldSection);
    if (usedTokens + worldTokens <= maxTokens) {
      sections.push(worldSection);
      usedTokens += worldTokens;
    }
  }

  // Priority 5: Resolved threads (lowest priority)
  var resolvedThreads = (bible.plotThreads || []).filter(function(t) {
    return t.status === 'resolved';
  });
  if (resolvedThreads.length > 0 && usedTokens < maxTokens) {
    var resLines = resolvedThreads.map(function(t) {
      return '- ' + t.name + '（已解決）';
    });
    var resSection = '【已解決線索】\n' + resLines.join('\n');
    var resTokens = estimateTokens(resSection);
    if (usedTokens + resTokens <= maxTokens) {
      sections.push(resSection);
      usedTokens += resTokens;
    }
  }

  // Themes
  if ((bible.themes || []).length > 0 && usedTokens < maxTokens) {
    var themeSection = '【主題】' + bible.themes.join('、');
    var themeTokens = estimateTokens(themeSection);
    if (usedTokens + themeTokens <= maxTokens) {
      sections.push(themeSection);
    }
  }

  return sections.join('\n');
}

function _findCharById(characters, id) {
  for (var i = 0; i < characters.length; i++) {
    if (characters[i].id === id) return characters[i];
  }
  return null;
}

// === Storage Limit Handling (Task 1.10) ===
function _handleStorageLimit(bible) {
  // Step 1: Compress — remove resolved threads, trim old history
  var compressed = JSON.parse(JSON.stringify(bible));

  // Remove resolved plot threads
  compressed.plotThreads = (compressed.plotThreads || []).filter(function(t) {
    return t.status !== 'resolved';
  });

  // Trim relationship history to last 3 entries
  (compressed.relationships || []).forEach(function(r) {
    if (r.history && r.history.length > 3) {
      r.history = r.history.slice(-3);
    }
  });

  // Trim character backstory/arc to 100 chars
  (compressed.characters || []).forEach(function(c) {
    if (c.backstory && c.backstory.length > 100) c.backstory = c.backstory.substring(0, 100) + '...';
    if (c.arc && c.arc.length > 100) c.arc = c.arc.substring(0, 100) + '...';
  });

  // Try saving compressed version
  try {
    localStorage.setItem(_bibleKey(compressed.storyId), JSON.stringify(compressed));
    // Warn user
    if (typeof showToast === 'function') {
      showToast('⚠️ 故事聖經已壓縮儲存。建議保存到 GitHub 以避免資料遺失。');
    }
    return true;
  } catch (e) {
    // Still too large — warn user to save to GitHub
    if (typeof showToast === 'function') {
      showToast('❌ 本地儲存空間不足，請保存到 GitHub。');
    }
    return false;
  }
}
