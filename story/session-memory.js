// session-memory.js — Session Memory management for cross-chapter continuity

// === Create Empty Memory ===
function createEmptyMemory() {
  return {
    title: '',
    characters: [],
    chapterSummaries: [],
    openingLines: [],
    unresolvedThreads: [],
    resolvedThreads: [],
    worldState: {},
    lastChapterNum: 0
  };
}

// === Extract Summary (first sentence or first 80 chars) ===
function extractSummary(text) {
  if (!text) return '';
  var firstSentence = text.match(/^[^。！？\n]+[。！？]/);
  if (firstSentence && firstSentence[0].length <= 100) return firstSentence[0];
  return text.substring(0, 80) + '...';
}

// === Update Session Memory ===
function updateSessionMemory(memory, newChapters, outline) {
  for (var i = 0; i < newChapters.length; i++) {
    var chapter = newChapters[i];

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

  return memory;
}

// === Compress Memory for Prompt Injection ===
function compressMemoryForPrompt(memory, nextChapterNum) {
  var lines = [];

  // Title and characters
  if (memory.title) lines.push('故事標題：' + memory.title);
  if (memory.characters.length > 0) {
    lines.push('主要角色：' + memory.characters.map(function(c) { return c.name + '(' + (c.appearance || '') + ')'; }).join('、'));
  }

  // Recent summaries (last 5, full detail)
  var recentStart = Math.max(0, memory.chapterSummaries.length - 5);
  var recentSummaries = memory.chapterSummaries.slice(recentStart);
  if (recentSummaries.length > 0) {
    lines.push('【近期劇情】\n' + recentSummaries.join('\n'));
  }

  // Compressed older summaries
  if (recentStart > 0) {
    lines.push('【早期劇情】' + memory.chapterSummaries[0]);
  }

  // Unresolved threads
  if (memory.unresolvedThreads.length > 0) {
    lines.push('【未解伏筆】\n' + memory.unresolvedThreads.map(function(t) {
      return '- ' + t.thread + '（第' + t.introduced + '篇埋下）';
    }).join('\n'));
  }

  // World state
  if (memory.worldState && Object.keys(memory.worldState).length > 0) {
    lines.push('【世界狀態】' + JSON.stringify(memory.worldState));
  }

  lines.push('\n請接續上面的劇情，寫第' + nextChapterNum + '篇。');

  return lines.join('\n');
}
