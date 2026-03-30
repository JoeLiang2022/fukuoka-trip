// outline-generator.js — Outline pre-generation with 3-tier fallback parsing

// === Assign Arc Position based on chapter index ===
function assignArcPosition(index, total, dna) {
  var positions = Object.keys(dna.arcStructure || {});
  if (positions.length === 0) return 'middle';
  var ratio = index / (total - 1 || 1);
  var posIndex = Math.min(Math.floor(ratio * positions.length), positions.length - 1);
  return positions[posIndex];
}

// === Generate Default Outline from DNA arcStructure ===
function generateDefaultOutline(totalChapters, dna) {
  var result = [];
  for (var i = 0; i < totalChapters; i++) {
    var pos = assignArcPosition(i, totalChapters, dna);
    result.push({
      num: i + 1,
      purpose: dna.arcStructure[pos] || '第' + (i + 1) + '篇',
      coreTasks: ['推進劇情', '維持節奏'],
      prohibitions: ['禁止重複前篇開頭', '禁止結尾說教'],
      arcPosition: pos
    });
  }
  return result;
}

// === Normalize Outline: fill missing fields, pad/trim ===
function normalizeOutline(parsed, totalChapters, dna) {
  var result = [];
  for (var i = 0; i < totalChapters; i++) {
    var src = parsed[i] || {};
    result.push({
      num: i + 1,
      purpose: src.purpose || '第' + (i + 1) + '篇',
      coreTasks: Array.isArray(src.coreTasks) && src.coreTasks.length > 0
        ? src.coreTasks : ['推進劇情'],
      prohibitions: Array.isArray(src.prohibitions) && src.prohibitions.length > 0
        ? src.prohibitions : ['禁止重複前篇開頭'],
      arcPosition: src.arcPosition || assignArcPosition(i, totalChapters, dna)
    });
  }
  return result;
}

// === Parse Outline with 3-tier fallback ===
function parseOutline(rawText, totalChapters, dna) {
  // Tier 1: Clean JSON parse
  try {
    var cleaned = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    var parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return normalizeOutline(parsed, totalChapters, dna);
    }
  } catch (_) {}

  // Tier 2: Extract JSON array from mixed text
  try {
    var match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      var parsed2 = JSON.parse(match[0]);
      if (Array.isArray(parsed2)) {
        return normalizeOutline(parsed2, totalChapters, dna);
      }
    }
  } catch (_) {}

  // Tier 3: Fallback — default outline from DNA arcStructure
  console.warn('Outline parse failed, using default arc from DNA');
  return generateDefaultOutline(totalChapters, dna);
}

// === Generate Outline via API ===
async function generateOutline(dna, topic, totalChapters, audience) {
  var prompt = assembleOutlinePrompt(dna, topic, totalChapters, audience);
  try {
    var resp = await fetch(API_BASE + '/api/story-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, style: dna.id })
    });
    if (!resp.ok) {
      console.warn('Outline API failed, using default');
      return generateDefaultOutline(totalChapters, dna);
    }
    var data = await resp.json();
    var raw = data.text || '';
    return parseOutline(raw, totalChapters, dna);
  } catch (e) {
    console.warn('Outline generation error:', e.message);
    return generateDefaultOutline(totalChapters, dna);
  }
}
