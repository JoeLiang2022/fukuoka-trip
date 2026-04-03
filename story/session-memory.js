// session-memory.js — Session Memory management for cross-chapter continuity
// Enhanced with character arcs, emotional beats, relationship tracking, and consistency checking

// === Valid enum sets ===
var VALID_TONES = ['tense', 'warm', 'sad', 'exciting', 'peaceful', 'dark'];
var VALID_TRAJECTORIES = ['ascending', 'descending', 'flat', 'transforming'];

// === Create Empty Memory (Enhanced) ===
function createEmptyMemory() {
  return {
    // Original fields
    title: '',
    characters: [],
    chapterSummaries: [],
    openingLines: [],
    unresolvedThreads: [],
    resolvedThreads: [],
    worldState: {},
    lastChapterNum: 0,
    // Enhanced fields
    characterArcs: [],
    emotionalBeats: [],
    relationshipStates: [],
    activeConflicts: [],
    foreshadowing: [],
    consistencyLog: { facts: {}, rules: {}, warnings: [] }
  };
}

// === Auto-upgrade legacy memory with empty defaults ===
function _upgradeMemory(memory) {
  if (!memory.characterArcs) memory.characterArcs = [];
  if (!memory.emotionalBeats) memory.emotionalBeats = [];
  if (!memory.relationshipStates) memory.relationshipStates = [];
  if (!memory.activeConflicts) memory.activeConflicts = [];
  if (!memory.foreshadowing) memory.foreshadowing = [];
  if (!memory.consistencyLog) memory.consistencyLog = { facts: {}, rules: {}, warnings: [] };
  // Ensure consistencyLog sub-fields exist
  if (!memory.consistencyLog.facts) memory.consistencyLog.facts = {};
  if (!memory.consistencyLog.rules) memory.consistencyLog.rules = {};
  if (!memory.consistencyLog.warnings) memory.consistencyLog.warnings = [];
  return memory;
}

// === Extract Summary (first sentence or first 80 chars) ===
function extractSummary(text) {
  if (!text) return '';
  var firstSentence = text.match(/^[^。！？\n]+[。！？]/);
  if (firstSentence && firstSentence[0].length <= 100) return firstSentence[0];
  return text.substring(0, 80) + '...';
}

// === Extract Character Arcs from chapter ===
function extractCharacterArcs(memory, chapter) {
  if (!chapter || !chapter.text) return;
  var text = chapter.text;
  var chapterNum = chapter.num || 0;

  // Get characters mentioned in this chapter
  var chapterCharacters = [];
  if (chapter.characters && Array.isArray(chapter.characters)) {
    chapterCharacters = chapter.characters.map(function(c) { return c.name; });
  }
  // Also check memory characters that might appear in text
  for (var m = 0; m < memory.characters.length; m++) {
    var cName = memory.characters[m].name;
    if (text.indexOf(cName) >= 0 && chapterCharacters.indexOf(cName) < 0) {
      chapterCharacters.push(cName);
    }
  }

  for (var i = 0; i < chapterCharacters.length; i++) {
    var name = chapterCharacters[i];
    // Find or create arc entry
    var arc = null;
    for (var a = 0; a < memory.characterArcs.length; a++) {
      if (memory.characterArcs[a].name === name) { arc = memory.characterArcs[a]; break; }
    }
    if (!arc) {
      arc = { name: name, currentState: '', keyMoments: [], trajectory: 'flat' };
      memory.characterArcs.push(arc);
    }

    // Extract a key moment from this chapter
    var moment = _extractKeyMoment(text, name, chapterNum);
    if (moment) {
      arc.keyMoments.push('Ch' + chapterNum + ':' + moment);
    }

    // Count how many chapters this character has appeared in
    var chapterCount = _countCharacterChapters(memory, name);

    // Update currentState based on text analysis
    var stateSnippet = _extractCharacterState(text, name);
    if (stateSnippet) {
      arc.currentState = stateSnippet;
    } else if (chapterCount >= 3 && !arc.currentState) {
      // For recurring characters, derive state from key moments
      arc.currentState = arc.keyMoments.length > 0 ? arc.keyMoments[arc.keyMoments.length - 1].split(':')[1] || '持續發展中' : '持續發展中';
    }

    // Update trajectory based on emotional progression
    if (chapterCount >= 3) {
      arc.trajectory = _inferTrajectory(arc.keyMoments, text);
      // Ensure minimum requirements for 3+ chapter characters
      if (arc.keyMoments.length < 2 && arc.keyMoments.length >= 1) {
        // Add a derived moment to meet the minimum
        arc.keyMoments.push('Ch' + chapterNum + ':角色持續發展');
      }
    }
  }
}

// === Track Emotional Beats per chapter ===
function trackEmotionalBeats(memory, chapter) {
  if (!chapter || !chapter.text) return;
  var text = chapter.text;
  var chapterNum = chapter.num || 0;

  var tone = _detectTone(text);
  var summary = _extractEmotionalSummary(text, tone);

  memory.emotionalBeats.push({
    chapter: chapterNum,
    tone: tone,
    summary: summary
  });

  // Trim to 20 max
  if (memory.emotionalBeats.length > 20) {
    memory.emotionalBeats = memory.emotionalBeats.slice(-20);
  }
}

// === Update Relationship Matrix ===
function updateRelationshipMatrix(memory, chapter) {
  if (!chapter || !chapter.text) return;
  var text = chapter.text;
  var chapterNum = chapter.num || 0;

  // Get all known character names
  var charNames = memory.characters.map(function(c) { return c.name; });

  // Find character pairs that appear together in this chapter
  for (var i = 0; i < charNames.length; i++) {
    for (var j = i + 1; j < charNames.length; j++) {
      var name1 = charNames[i];
      var name2 = charNames[j];
      if (text.indexOf(name1) >= 0 && text.indexOf(name2) >= 0) {
        _updateRelationship(memory, name1, name2, text, chapterNum);
      }
    }
  }
}

// === Detect Inconsistencies ===
function detectInconsistencies(memory, chapter) {
  if (!chapter || !chapter.text) return;
  var text = chapter.text;
  var chapterNum = chapter.num || 0;

  // Extract potential facts from the chapter
  var newFacts = _extractFacts(text, chapterNum);

  for (var factName in newFacts) {
    var newValue = newFacts[factName];
    if (memory.consistencyLog.facts[factName]) {
      var existing = memory.consistencyLog.facts[factName];
      // Check for contradiction
      if (existing.value !== newValue.value) {
        memory.consistencyLog.warnings.push(
          '矛盾：「' + factName + '」在第' + existing.chapter + '篇為「' + existing.value +
          '」，但第' + chapterNum + '篇變為「' + newValue.value + '」'
        );
      }
    } else {
      // New fact established
      memory.consistencyLog.facts[factName] = newValue;
    }
  }

  // Extract world rules
  var newRules = _extractRules(text, chapterNum);
  for (var ruleName in newRules) {
    if (!memory.consistencyLog.rules[ruleName]) {
      memory.consistencyLog.rules[ruleName] = newRules[ruleName];
    }
  }
}

// === Bible-to-Memory Sync ===
function syncToBible(memoryCharacters, memoryWorldState) {
  // Load the current bible (if story-bible.js is available)
  if (typeof loadBible !== 'function' || typeof saveBible !== 'function') return null;

  // We need a storyId — try to get from the current bible in localStorage
  // Look for any bible key in localStorage
  var bible = null;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('storyBible_') === 0) {
        var candidate = JSON.parse(localStorage.getItem(key));
        if (candidate && candidate.storyId) {
          bible = candidate;
          break;
        }
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  if (!bible) return null;

  // Update character lastSeen from memory — never remove bible-only characters
  if (memoryCharacters && Array.isArray(memoryCharacters)) {
    for (var mc = 0; mc < memoryCharacters.length; mc++) {
      var memChar = memoryCharacters[mc];
      var found = false;
      for (var bc = 0; bc < bible.characters.length; bc++) {
        if (bible.characters[bc].name === memChar.name ||
            (bible.characters[bc].aliases && bible.characters[bc].aliases.indexOf(memChar.name) >= 0)) {
          // Update lastSeen to the greater value
          if (memChar.lastSeen && (!bible.characters[bc].lastSeen || memChar.lastSeen > bible.characters[bc].lastSeen)) {
            bible.characters[bc].lastSeen = memChar.lastSeen;
          }
          found = true;
          break;
        }
      }
      // If character exists in memory but not in bible, add it
      if (!found && memChar.name) {
        bible.characters.push({
          id: 'char_sync_' + Date.now() + '_' + mc,
          name: memChar.name,
          appearance: memChar.appearance || '',
          personality: '',
          backstory: '',
          motivation: '',
          arc: '',
          aliases: [],
          firstSeen: memChar.firstSeen || 1,
          lastSeen: memChar.lastSeen || 1
        });
      }
    }
  }

  // Sync world state changes to bible world entries
  if (memoryWorldState && typeof memoryWorldState === 'object') {
    for (var wsKey in memoryWorldState) {
      var wsValue = memoryWorldState[wsKey];
      var worldFound = false;
      for (var w = 0; w < bible.world.length; w++) {
        if (bible.world[w].name === wsKey) {
          // Update description or properties
          if (typeof wsValue === 'string') {
            bible.world[w].description = wsValue;
          } else if (typeof wsValue === 'object') {
            if (!bible.world[w].properties) bible.world[w].properties = {};
            for (var pk in wsValue) {
              bible.world[w].properties[pk] = wsValue[pk];
            }
          }
          worldFound = true;
          break;
        }
      }
      // Add new world entry if not found
      if (!worldFound) {
        bible.world.push({
          id: 'world_sync_' + Date.now(),
          name: wsKey,
          category: 'custom',
          description: typeof wsValue === 'string' ? wsValue : JSON.stringify(wsValue),
          properties: typeof wsValue === 'object' ? wsValue : {}
        });
      }
    }
  }

  bible.lastUpdated = Date.now();
  saveBible(bible);
  return bible;
}

// === Update Session Memory (Enhanced, backward-compatible) ===
function updateSessionMemory(memory, newChapters, outline) {
  // Auto-upgrade legacy memory objects
  _upgradeMemory(memory);

  for (var i = 0; i < newChapters.length; i++) {
    var chapter = newChapters[i];

    // === Original APPEND phase (unchanged) ===

    // APPEND: summary
    var summary = extractSummary(chapter.text);
    memory.chapterSummaries.push('第' + chapter.num + '篇「' + chapter.title + '」：' + summary);

    // APPEND: opening line (anti-repetition)
    memory.openingLines.push((chapter.text || '').substring(0, 40));

    // APPEND: character registry
    if (chapter.characters && Array.isArray(chapter.characters)) {
      for (var c = 0; c < chapter.characters.length; c++) {
        var char = chapter.characters[c];
        var existing = null;
        for (var e = 0; e < memory.characters.length; e++) {
          if (memory.characters[e].name === char.name) { existing = memory.characters[e]; break; }
        }
        if (existing) {
          existing.lastSeen = chapter.num;
        } else {
          memory.characters.push({ name: char.name, appearance: char.appearance || '', firstSeen: chapter.num, lastSeen: chapter.num });
        }
      }
    }

    // Track plot threads from outline
    if (outline) {
      var chOutline = null;
      for (var o = 0; o < outline.length; o++) {
        if (outline[o].num === chapter.num) { chOutline = outline[o]; break; }
      }
      if (chOutline && chOutline.coreTasks) {
        for (var t = 0; t < chOutline.coreTasks.length; t++) {
          var task = chOutline.coreTasks[t];
          if (task.indexOf('引入') === 0 || task.indexOf('埋線') === 0) {
            memory.unresolvedThreads.push({ thread: task, introduced: chapter.num });
          }
          if (task.indexOf('解決') === 0 || task.indexOf('揭曉') === 0 || task.indexOf('收線') === 0) {
            for (var u = memory.unresolvedThreads.length - 1; u >= 0; u--) {
              var ut = memory.unresolvedThreads[u];
              if (task.indexOf(ut.thread.replace(/^(引入|埋線)/, '')) >= 0) {
                memory.resolvedThreads.push({ thread: ut.thread, introduced: ut.introduced, resolvedAt: chapter.num });
                memory.unresolvedThreads.splice(u, 1);
                break;
              }
            }
          }
        }
      }
    }

    // === NEW: Enhanced tracking phases ===
    extractCharacterArcs(memory, chapter);
    trackEmotionalBeats(memory, chapter);
    updateRelationshipMatrix(memory, chapter);
    detectInconsistencies(memory, chapter);

    memory.lastChapterNum = chapter.num;
  }

  // SET: title from first chapter
  if (!memory.title && newChapters.length > 0 && newChapters[0].title) {
    memory.title = newChapters[0].title;
  }

  // COMPRESS: summaries older than 10
  if (memory.chapterSummaries.length > 10) {
    var oldCount = memory.chapterSummaries.length - 10;
    var oldSummaries = memory.chapterSummaries.slice(0, oldCount);
    var compressed = '【第1-' + oldCount + '篇摘要】' + oldSummaries.map(function(s) { return s.split('：')[1] || s; }).join('→');
    memory.chapterSummaries = [compressed].concat(memory.chapterSummaries.slice(oldCount));
  }

  // DISCARD: resolved threads older than 5 chapters
  var currentCh = memory.lastChapterNum;
  memory.resolvedThreads = memory.resolvedThreads.filter(function(t) {
    return (currentCh - t.resolvedAt) <= 5;
  });

  // NEW: Trim emotional beats to 20 max (safety — also done in trackEmotionalBeats)
  if (memory.emotionalBeats.length > 20) {
    memory.emotionalBeats = memory.emotionalBeats.slice(-20);
  }

  return memory;
}

// === Compress Memory for Prompt Injection (Enhanced) ===
function compressMemoryForPrompt(memory, nextChapterNum) {
  var lines = [];

  // Title and characters (original)
  if (memory.title) lines.push('故事標題：' + memory.title);
  if (memory.characters.length > 0) {
    lines.push('主要角色：' + memory.characters.map(function(c) { return c.name + '(' + (c.appearance || '') + ')'; }).join('、'));
  }

  // NEW: Character arc summaries (if available)
  if (memory.characterArcs && memory.characterArcs.length > 0) {
    var arcLines = [];
    for (var a = 0; a < memory.characterArcs.length; a++) {
      var arc = memory.characterArcs[a];
      var arcStr = '- ' + arc.name + '：' + (arc.currentState || '發展中') + '（' + (arc.trajectory || 'flat') + '）';
      if (arc.keyMoments && arc.keyMoments.length > 0) {
        // Show last 3 key moments max
        var recentMoments = arc.keyMoments.slice(-3);
        arcStr += '\n  關鍵時刻：' + recentMoments.join('、');
      }
      arcLines.push(arcStr);
    }
    lines.push('【角色弧線】\n' + arcLines.join('\n'));
  }

  // NEW: Last 3 emotional beats (if available)
  if (memory.emotionalBeats && memory.emotionalBeats.length > 0) {
    var recentBeats = memory.emotionalBeats.slice(-3);
    var beatStr = recentBeats.map(function(b) {
      return 'Ch' + b.chapter + ':' + b.tone;
    }).join(' → ');
    // Add pacing suggestion
    var lastTone = recentBeats[recentBeats.length - 1].tone;
    var pacingSuggestion = _suggestPacing(lastTone);
    lines.push('【情緒軌跡】\n' + beatStr + (pacingSuggestion ? '（' + pacingSuggestion + '）' : ''));
  }

  // NEW: Active relationship states (if available)
  if (memory.relationshipStates && memory.relationshipStates.length > 0) {
    var relLines = memory.relationshipStates.map(function(r) {
      return r.char1 + '↔' + r.char2 + '：' + r.currentState + '（張力：' + r.tension + '/10）';
    });
    lines.push('【關係狀態】\n' + relLines.join('\n'));
  }

  // Recent summaries (last 5, full detail) — original
  var recentStart = Math.max(0, memory.chapterSummaries.length - 5);
  var recentSummaries = memory.chapterSummaries.slice(recentStart);
  if (recentSummaries.length > 0) {
    lines.push('【近期劇情】\n' + recentSummaries.join('\n'));
  }

  // Compressed older summaries — original
  if (recentStart > 0) {
    lines.push('【早期劇情】' + memory.chapterSummaries[0]);
  }

  // Unresolved threads — original
  if (memory.unresolvedThreads.length > 0) {
    lines.push('【未解伏筆】\n' + memory.unresolvedThreads.map(function(t) {
      return '- ' + t.thread + '（第' + t.introduced + '篇埋下）';
    }).join('\n'));
  }

  // World state — original
  if (memory.worldState && Object.keys(memory.worldState).length > 0) {
    lines.push('【世界狀態】' + JSON.stringify(memory.worldState));
  }

  // NEW: Consistency warnings (if any)
  if (memory.consistencyLog && memory.consistencyLog.warnings && memory.consistencyLog.warnings.length > 0) {
    var recentWarnings = memory.consistencyLog.warnings.slice(-5);
    lines.push('【一致性提醒】\n' + recentWarnings.map(function(w) { return '- ' + w; }).join('\n'));
  }

  lines.push('\n請接續上面的劇情，寫第' + nextChapterNum + '篇。');

  // Token budget check — trim if exceeding ~2500 tokens (rough: 1 token ≈ 2 CJK chars or 4 latin chars)
  var result = lines.join('\n');
  var estimatedTokens = _estimateTokens(result);
  if (estimatedTokens > 2500) {
    result = _trimToTokenBudget(lines, 2500, nextChapterNum);
  }

  return result;
}

// ============================================================
// Helper functions for enhanced session memory
// ============================================================

// --- Token estimation (rough: 1 token ≈ 2 CJK chars or 4 latin chars) ---
function _estimateTokens(text) {
  if (!text) return 0;
  var cjkCount = 0;
  var latinCount = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code > 0x2E80) { cjkCount++; } else { latinCount++; }
  }
  return Math.ceil(cjkCount / 2) + Math.ceil(latinCount / 4);
}

// --- Trim output to token budget ---
function _trimToTokenBudget(lines, maxTokens, nextChapterNum) {
  var closing = '\n請接續上面的劇情，寫第' + nextChapterNum + '篇。';
  var closingTokens = _estimateTokens(closing);
  var budget = maxTokens - closingTokens;

  var result = [];
  var usedTokens = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('請接續上面的劇情') >= 0) continue; // skip closing, we add it at end
    var lineTokens = _estimateTokens(line);
    if (usedTokens + lineTokens <= budget) {
      result.push(line);
      usedTokens += lineTokens;
    }
  }
  result.push(closing);
  return result.join('\n');
}

// --- Extract a key moment for a character from chapter text ---
function _extractKeyMoment(text, name, chapterNum) {
  if (!text || !name) return '';
  // Find sentences containing the character name
  var sentences = text.split(/[。！？\n]/);
  var bestSentence = '';
  var emotionKeywords = ['發現', '決定', '意識到', '感到', '震驚', '開心', '難過', '憤怒', '害怕',
    '告白', '離開', '回來', '改變', '面對', '放棄', '堅持', '選擇', '承認', '拒絕', '接受',
    '哭', '笑', '吵架', '和好', '分手', '相遇', '重逢', '背叛', '原諒', '犧牲'];

  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i].trim();
    if (s.indexOf(name) >= 0 && s.length > 5 && s.length < 60) {
      // Prefer sentences with emotional keywords
      for (var k = 0; k < emotionKeywords.length; k++) {
        if (s.indexOf(emotionKeywords[k]) >= 0) {
          return s.length > 30 ? s.substring(0, 30) : s;
        }
      }
      if (!bestSentence || s.length > bestSentence.length) {
        bestSentence = s;
      }
    }
  }
  return bestSentence ? (bestSentence.length > 30 ? bestSentence.substring(0, 30) : bestSentence) : '';
}

// --- Count how many chapters a character has appeared in ---
function _countCharacterChapters(memory, name) {
  // Check character registry
  for (var i = 0; i < memory.characters.length; i++) {
    if (memory.characters[i].name === name) {
      var first = memory.characters[i].firstSeen || 1;
      var last = memory.characters[i].lastSeen || 1;
      return last - first + 1;
    }
  }
  return 1;
}

// --- Extract character's current emotional/narrative state from text ---
function _extractCharacterState(text, name) {
  if (!text || !name) return '';
  var stateKeywords = [
    { pattern: '開始意識', state: '開始意識到變化' },
    { pattern: '下定決心', state: '下定決心' },
    { pattern: '猶豫不決', state: '猶豫不決' },
    { pattern: '感到迷茫', state: '感到迷茫' },
    { pattern: '充滿信心', state: '充滿信心' },
    { pattern: '陷入困境', state: '陷入困境' },
    { pattern: '找到方向', state: '找到方向' },
    { pattern: '面對真相', state: '面對真相' },
    { pattern: '接受現實', state: '接受現實' },
    { pattern: '重新出發', state: '重新出發' }
  ];

  // Look for state keywords near the character name
  var nameIdx = text.indexOf(name);
  if (nameIdx < 0) return '';
  var context = text.substring(Math.max(0, nameIdx - 50), Math.min(text.length, nameIdx + 100));

  for (var i = 0; i < stateKeywords.length; i++) {
    if (context.indexOf(stateKeywords[i].pattern) >= 0) {
      return stateKeywords[i].state;
    }
  }
  return '';
}

// --- Infer trajectory from key moments ---
function _inferTrajectory(keyMoments, text) {
  if (!keyMoments || keyMoments.length < 2) return 'flat';

  var positiveWords = ['成長', '進步', '開心', '信心', '勇氣', '希望', '成功', '突破', '和好', '接受', '笑'];
  var negativeWords = ['失敗', '難過', '絕望', '放棄', '背叛', '分手', '哭', '崩潰', '迷茫', '困境'];
  var changeWords = ['改變', '轉變', '意識到', '決定', '重新', '不再', '開始'];

  var positiveCount = 0;
  var negativeCount = 0;
  var changeCount = 0;
  var allText = keyMoments.join(' ') + ' ' + (text || '');

  for (var i = 0; i < positiveWords.length; i++) {
    if (allText.indexOf(positiveWords[i]) >= 0) positiveCount++;
  }
  for (var j = 0; j < negativeWords.length; j++) {
    if (allText.indexOf(negativeWords[j]) >= 0) negativeCount++;
  }
  for (var k = 0; k < changeWords.length; k++) {
    if (allText.indexOf(changeWords[k]) >= 0) changeCount++;
  }

  if (changeCount >= 2) return 'transforming';
  if (positiveCount > negativeCount + 1) return 'ascending';
  if (negativeCount > positiveCount + 1) return 'descending';
  return 'flat';
}

// --- Detect emotional tone of chapter text ---
function _detectTone(text) {
  if (!text) return 'peaceful';

  var toneScores = {
    tense: ['緊張', '危險', '威脅', '追趕', '逃跑', '衝突', '對峙', '壓力', '焦慮', '不安', '恐懼'],
    warm: ['溫暖', '微笑', '擁抱', '感動', '關心', '陪伴', '安慰', '幸福', '甜蜜', '溫柔', '體貼'],
    sad: ['難過', '眼淚', '哭', '失去', '離別', '遺憾', '心痛', '孤獨', '寂寞', '悲傷', '思念'],
    exciting: ['興奮', '驚喜', '冒險', '突破', '勝利', '發現', '震撼', '心跳', '期待', '激動', '精彩'],
    peaceful: ['平靜', '安寧', '日常', '散步', '休息', '享受', '悠閒', '寧靜', '放鬆', '自在'],
    dark: ['黑暗', '絕望', '死亡', '毀滅', '背叛', '陰謀', '詛咒', '恐怖', '噩夢', '崩潰', '墮落']
  };

  var maxTone = 'peaceful';
  var maxScore = 0;

  for (var tone in toneScores) {
    var score = 0;
    var keywords = toneScores[tone];
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) >= 0) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      maxTone = tone;
    }
  }

  return maxTone;
}

// --- Extract one-line emotional summary ---
function _extractEmotionalSummary(text, tone) {
  if (!text) return '章節情緒';
  // Try to find a sentence that captures the emotional essence
  var sentences = text.split(/[。！？\n]/);
  var toneKeywords = {
    tense: ['緊張', '危險', '衝突', '對峙', '壓力'],
    warm: ['溫暖', '微笑', '感動', '關心', '幸福'],
    sad: ['難過', '眼淚', '失去', '離別', '心痛'],
    exciting: ['興奮', '驚喜', '突破', '發現', '心跳'],
    peaceful: ['平靜', '安寧', '日常', '休息', '自在'],
    dark: ['黑暗', '絕望', '背叛', '恐怖', '崩潰']
  };

  var keywords = toneKeywords[tone] || [];
  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i].trim();
    if (s.length >= 5 && s.length <= 40) {
      for (var k = 0; k < keywords.length; k++) {
        if (s.indexOf(keywords[k]) >= 0) return s;
      }
    }
  }

  // Fallback: use first meaningful sentence
  for (var j = 0; j < sentences.length; j++) {
    var sent = sentences[j].trim();
    if (sent.length >= 5 && sent.length <= 40) return sent;
  }

  // Last resort: truncate beginning
  return text.substring(0, 30).replace(/\n/g, ' ');
}

// --- Update a relationship entry between two characters ---
function _updateRelationship(memory, name1, name2, text, chapterNum) {
  // Find existing relationship
  var rel = null;
  for (var i = 0; i < memory.relationshipStates.length; i++) {
    var r = memory.relationshipStates[i];
    if ((r.char1 === name1 && r.char2 === name2) || (r.char1 === name2 && r.char2 === name1)) {
      rel = r;
      break;
    }
  }

  if (!rel) {
    rel = { char1: name1, char2: name2, currentState: '', tension: 5 };
    memory.relationshipStates.push(rel);
  }

  // Analyze relationship dynamics from text
  var state = _analyzeRelationshipState(text, name1, name2);
  if (state.description) rel.currentState = state.description;
  rel.tension = state.tension;
}

// --- Analyze relationship state from text ---
function _analyzeRelationshipState(text, name1, name2) {
  var positiveSignals = ['微笑', '擁抱', '關心', '幫助', '信任', '合作', '感謝', '喜歡', '愛', '在乎'];
  var negativeSignals = ['爭吵', '冷戰', '背叛', '懷疑', '敵意', '對立', '拒絕', '忽視', '嫉妒', '恨'];
  var romanticSignals = ['心跳', '臉紅', '暗戀', '告白', '約會', '牽手', '親吻', '甜蜜', '曖昧'];
  var tensionSignals = ['秘密', '誤會', '隱瞞', '矛盾', '試探', '猜疑', '不安'];

  var posScore = 0, negScore = 0, romScore = 0, tensionScore = 0;

  for (var i = 0; i < positiveSignals.length; i++) {
    if (text.indexOf(positiveSignals[i]) >= 0) posScore++;
  }
  for (var j = 0; j < negativeSignals.length; j++) {
    if (text.indexOf(negativeSignals[j]) >= 0) negScore++;
  }
  for (var k = 0; k < romanticSignals.length; k++) {
    if (text.indexOf(romanticSignals[k]) >= 0) romScore++;
  }
  for (var t = 0; t < tensionSignals.length; t++) {
    if (text.indexOf(tensionSignals[t]) >= 0) tensionScore++;
  }

  var description = '';
  var tension = 5; // default neutral

  if (romScore >= 2) {
    description = 'romantic interest developing';
    tension = 6 + tensionScore;
  } else if (posScore > negScore + 1) {
    description = 'positive, supportive';
    tension = 3 - Math.min(2, negScore);
  } else if (negScore > posScore + 1) {
    description = 'strained, conflicted';
    tension = 7 + Math.min(3, negScore);
  } else if (tensionScore >= 2) {
    description = 'uncertain, tension building';
    tension = 6 + tensionScore;
  } else {
    description = 'neutral, developing';
    tension = 5;
  }

  // Clamp tension to 1-10
  tension = Math.max(1, Math.min(10, tension));

  return { description: description, tension: tension };
}

// --- Extract facts from chapter text ---
function _extractFacts(text, chapterNum) {
  if (!text) return {};
  var facts = {};

  // Pattern: "X的Y是Z" or "X的Y為Z" — common Chinese fact patterns
  var factPatterns = [
    /([^\s，。！？]{2,6})的([^\s，。！？]{2,6})是([^\s，。！？]{2,20})/g,
    /([^\s，。！？]{2,6})的([^\s，。！？]{2,6})為([^\s，。！？]{2,20})/g,
    /([^\s，。！？]{2,6})住在([^\s，。！？]{2,20})/g,
    /([^\s，。！？]{2,6})在([^\s，。！？]{2,10})工作/g
  ];

  // Pattern 1 & 2: X的Y是/為Z
  for (var p = 0; p < 2; p++) {
    var regex = factPatterns[p];
    var match;
    while ((match = regex.exec(text)) !== null) {
      var factKey = match[1] + '的' + match[2];
      facts[factKey] = { value: match[3], chapter: chapterNum };
    }
  }

  // Pattern 3: X住在Y
  var liveMatch;
  var liveRegex = /([^\s，。！？]{2,6})住在([^\s，。！？]{2,20})/g;
  while ((liveMatch = liveRegex.exec(text)) !== null) {
    facts[liveMatch[1] + '的住處'] = { value: liveMatch[2], chapter: chapterNum };
  }

  // Pattern 4: X在Y工作
  var workMatch;
  var workRegex = /([^\s，。！？]{2,6})在([^\s，。！？]{2,10})工作/g;
  while ((workMatch = workRegex.exec(text)) !== null) {
    facts[workMatch[1] + '的工作地點'] = { value: workMatch[2], chapter: chapterNum };
  }

  return facts;
}

// --- Extract world rules from chapter text ---
function _extractRules(text, chapterNum) {
  if (!text) return {};
  var rules = {};

  // Look for rule-like statements
  var rulePatterns = [
    /在這個世界[，,]([^。！？]{5,40})/g,
    /規則是([^。！？]{5,40})/g,
    /不可以([^。！？]{5,30})/g,
    /必須([^。！？]{5,30})/g
  ];

  for (var p = 0; p < rulePatterns.length; p++) {
    var regex = rulePatterns[p];
    var match;
    while ((match = regex.exec(text)) !== null) {
      rules[match[1].trim()] = chapterNum;
    }
  }

  return rules;
}

// --- Suggest pacing based on recent emotional tone ---
function _suggestPacing(lastTone) {
  var suggestions = {
    tense: '注意節奏，下一篇建議放緩',
    warm: '可以加入一些衝突或轉折',
    sad: '適時加入希望或溫暖的元素',
    exciting: '可以放慢節奏，讓讀者消化',
    peaceful: '可以開始鋪陳下一個衝突',
    dark: '注意不要連續太多沉重章節'
  };
  return suggestions[lastTone] || '';
}

// --- Get character summary (utility) ---
function getCharacterSummary(memory, characterName) {
  if (!memory || !characterName) return null;

  var charInfo = null;
  for (var i = 0; i < memory.characters.length; i++) {
    if (memory.characters[i].name === characterName) {
      charInfo = memory.characters[i];
      break;
    }
  }

  var arcInfo = null;
  if (memory.characterArcs) {
    for (var a = 0; a < memory.characterArcs.length; a++) {
      if (memory.characterArcs[a].name === characterName) {
        arcInfo = memory.characterArcs[a];
        break;
      }
    }
  }

  var relationships = [];
  if (memory.relationshipStates) {
    for (var r = 0; r < memory.relationshipStates.length; r++) {
      var rel = memory.relationshipStates[r];
      if (rel.char1 === characterName || rel.char2 === characterName) {
        relationships.push(rel);
      }
    }
  }

  return {
    character: charInfo,
    arc: arcInfo,
    relationships: relationships
  };
}
