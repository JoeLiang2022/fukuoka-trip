// prompt-assembler.js — Style DNA validation, loading, and prompt assembly
// Part of Story Generation Architecture v2

// === Style Categories ===
var STYLE_CATEGORIES = {
  narrative: {
    name: '敘事文學',
    styles: ['storybook','romance','ceo','isekai','suspense','horror','satire','scifi','cultivation','detective'],
    requiredDNA: ['characterRules','paceRules','sceneRules','dialogueRules'],
    optionalDNA: ['worldBuildingRules','genreConstraints']
  },
  knowledge: {
    name: '知識內容',
    styles: ['book','toolkit','invest','knowledge','workplace','academic'],
    requiredDNA: ['structureRules','evidenceRules','insightRules','actionRules'],
    optionalDNA: ['dataRules','caseStudyRules']
  },
  opinion: {
    name: '觀點文章',
    styles: ['column','emotional','inspirational','history','food','travel','videocopy','printcopy'],
    requiredDNA: ['voiceRules','argumentRules','narrativeRules','closingRules'],
    optionalDNA: ['sensoryRules','researchRules']
  },
  news: {
    name: '新聞報導',
    styles: ['news','finance'],
    requiredDNA: ['factRules','sourceRules','formatRules'],
    optionalDNA: ['analysisRules']
  }
};

// === Rule Labels (categoryDNA key → display label) ===
var RULE_LABELS = {
  characterRules: '角色深度規則',
  paceRules: '節奏規則',
  sceneRules: '場景規則',
  dialogueRules: '對話規則',
  worldBuildingRules: '世界觀規則',
  genreConstraints: '類型限制',
  structureRules: '結構規則',
  evidenceRules: '證據規則',
  insightRules: '洞見規則',
  actionRules: '行動規則',
  dataRules: '數據規則',
  caseStudyRules: '案例規則',
  voiceRules: '語氣規則',
  argumentRules: '論述規則',
  narrativeRules: '敘事規則',
  closingRules: '收尾規則',
  sensoryRules: '感官規則',
  researchRules: '考據規則',
  factRules: '事實規則',
  sourceRules: '來源規則',
  formatRules: '格式規則',
  analysisRules: '分析規則'
};

// === DNA Validation ===
function validateDNA(dna) {
  var errors = [];
  var topLevel = ['id','category','name','role','references','qualityRules','categoryDNA','arcStructure'];
  for (var i = 0; i < topLevel.length; i++) {
    if (!dna[topLevel[i]]) errors.push('Missing top-level field: ' + topLevel[i]);
  }
  if (dna.category && !STYLE_CATEGORIES[dna.category]) {
    errors.push('Unknown category: ' + dna.category);
  }
  if (dna.category && STYLE_CATEGORIES[dna.category] && dna.categoryDNA) {
    var required = STYLE_CATEGORIES[dna.category].requiredDNA;
    for (var j = 0; j < required.length; j++) {
      var field = required[j];
      if (!dna.categoryDNA[field] || !Array.isArray(dna.categoryDNA[field]) || dna.categoryDNA[field].length === 0) {
        errors.push('Missing or empty categoryDNA.' + field + ' (required for ' + dna.category + ')');
      }
    }
  }
  if (dna.references && (!Array.isArray(dna.references) || dna.references.length === 0)) {
    errors.push('references must be a non-empty array');
  }
  if (dna.arcStructure && typeof dna.arcStructure !== 'object') {
    errors.push('arcStructure must be an object');
  }
  return errors;
}

// === Load Style DNA ===
async function loadStyleDNA(styleId) {
  var dnaBase = window.location.hostname.includes('render.com') ? 'https://cdn.jsdelivr.net/gh/JoeLiang2022/fukuoka-trip@main/story/dna/' : 'dna/';
  var resp = await fetch(dnaBase + styleId + '.json?t=' + Date.now());
  if (!resp.ok) throw new Error('DNA file not found: dna/' + styleId + '.json');
  var dna = await resp.json();
  var errors = validateDNA(dna);
  if (errors.length > 0) {
    console.error('DNA validation failed for ' + styleId + ':', errors);
    throw new Error('Style DNA invalid: ' + errors.join('; '));
  }
  return dna;
}

// === Helper: pick random items from array ===
function pickRandom(arr, count) {
  if (!arr || arr.length === 0) return [];
  var shuffled = arr.slice().sort(function() { return Math.random() - 0.5; });
  return shuffled.slice(0, count || 4);
}

// === Helper: chapter length text ===
function getLengthTextDNA(len) {
  if (len === 'short') return '約200字';
  if (len === 'long') return '500-800字';
  return '約400字';
}

// === Prompt Assembly (per-chapter) ===
function assemblePrompt(input) {
  var dna = input.dna;
  var chapterOutline = input.chapterOutline;
  var memory = input.memory;
  var chapterNum = input.chapterNum;
  var totalChapters = input.totalChapters;
  var topic = input.topic;
  var audience = input.audience;
  var chapterLength = input.chapterLength;
  var isFirstChapter = input.isFirstChapter;
  var isLastChapter = input.isLastChapter;

  var sections = [];

  // [1] Role
  sections.push('【你的角色】' + dna.role);

  // [2] Topic & Context
  sections.push('【主題】' + topic);
  sections.push('【風格】' + dna.name);
  sections.push('【參考作品風格】' + pickRandom(dna.references, 4).join('、'));

  // [3] Style-Specific Rules from categoryDNA
  var categoryRules = dna.categoryDNA || {};
  for (var ruleKey in categoryRules) {
    if (categoryRules.hasOwnProperty(ruleKey) && Array.isArray(categoryRules[ruleKey])) {
      var label = RULE_LABELS[ruleKey] || ruleKey;
      sections.push('【' + label + '】\n' + categoryRules[ruleKey].join('\n'));
    }
  }

  // [4] Audience
  sections.push('【目標觀眾】' + (audience ? audience.name + ' — ' + audience.tone : '一般讀者'));

  // [5] Chapter Contract
  if (chapterOutline) {
    sections.push(
      '【本篇合約 — 第' + chapterOutline.num + '篇 [' + chapterOutline.arcPosition + ']】\n' +
      '目的：' + chapterOutline.purpose + '\n' +
      '必做：' + chapterOutline.coreTasks.join('；') + '\n' +
      '禁止：' + chapterOutline.prohibitions.join('；')
    );
  }

  // [5.5] Bible Context (between chapter contract and session memory)
  if (input.bible) {
    sections.push('【故事聖經】\n' + input.bible);
  }

  // [5.6] User Style Tuning (from AI tuning dialog)
  if (input.tuning) {
    sections.push(input.tuning);
  }

  // [6] Session Memory (chapters 2+)
  if (!isFirstChapter && memory) {
    var memBlock = compressMemoryForPrompt(memory, chapterNum);
    sections.push('【前情記憶】\n' + memBlock);
  }

  // [7] Anti-Repetition Guard
  if (memory && memory.openingLines && memory.openingLines.length > 0) {
    var antiRep = '【已寫過的開頭（禁止重複）】\n';
    for (var k = 0; k < memory.openingLines.length; k++) {
      antiRep += '第' + (k + 1) + '篇：' + memory.openingLines[k] + '\n';
    }
    sections.push(antiRep);
  }

  // [8] Quality Rules from DNA
  if (dna.qualityRules && dna.qualityRules.length > 0) {
    sections.push('【品質要求】\n' + dna.qualityRules.join('\n'));
  }

  // [9] Hook Techniques (first chapter only)
  if (isFirstChapter && dna.hookTechniques && dna.hookTechniques.length > 0) {
    sections.push('【抓眼球技巧】\n' + dna.hookTechniques.join('\n'));
  }

  // [10] Output Format — single chapter or batch JSON
  if (input.batchOutlines && input.batchSize > 1) {
    // Batch mode: replace single chapter contract with batch contracts
    // Remove the single chapter contract that was added in section [5]
    sections = sections.filter(function(s) { return s.indexOf('【本篇合約') < 0; });
    
    var batchContracts = '';
    for (var bi = 0; bi < input.batchOutlines.length; bi++) {
      var bo = input.batchOutlines[bi];
      batchContracts += '第' + bo.num + '篇 [' + bo.arcPosition + ']：' + bo.purpose + '\n  必做：' + bo.coreTasks.join('；') + '\n  禁止：' + bo.prohibitions.join('；') + '\n\n';
    }
    sections.push('【批次章節合約 — 請生成以下 ' + input.batchSize + ' 篇】\n' + batchContracts);
    sections.push(
      '【輸出格式】嚴格 JSON（不要 markdown 標記），必須包含 ' + input.batchSize + ' 篇章節：\n' +
      '{"title":"系列總標題","chapters":[{"num":' + (chapterNum) + ',"title":"第1篇標題","text":"' + getLengthTextDNA(chapterLength) + '內容","imagePrompt":"英文配圖描述","hook":"金句"},{"num":' + (chapterNum+1) + ',...}]}\n' +
      '⚠️ chapters 陣列必須有 ' + input.batchSize + ' 個元素，每篇的開頭必須不同。'
    );
  } else {
    sections.push(
      '【輸出格式】JSON（不要 markdown），只輸出這一篇：\n' +
      '{"num":' + chapterNum + ',"title":"篇章標題","text":"' + getLengthTextDNA(chapterLength) + '內容","imagePrompt":"英文寫實攝影風格配圖描述","hook":"金句"}'
    );
  }

  // [11] Chapter Instructions — language-aware (uses i18n if available)
  var _langCode = input.language || 'zh-TW';
  var _langInstruction = (typeof getPromptLanguageInstruction === 'function')
    ? getPromptLanguageInstruction(_langCode)
    : '用繁體中文寫作';
  var _hookText = (typeof getPromptString === 'function')
    ? getPromptString('hookInstruction', _langCode)
    : '第一篇開頭3秒抓住注意力。';
  var _endingText = (typeof getPromptString === 'function')
    ? getPromptString('endingInstruction', _langCode)
    : '最後一篇要有震撼或感動的結尾。';
  var _cliffText = (typeof getPromptString === 'function')
    ? getPromptString('cliffhangerInstruction', _langCode)
    : '結尾留懸念。';
  var _batchCliffText = (typeof getPromptString === 'function')
    ? getPromptString('batchCliffhanger', _langCode)
    : '每篇結尾留懸念。';

  if (input.batchOutlines && input.batchSize > 1) {
    sections.push(
      '【批次資訊】第' + chapterNum + '~' + (chapterNum + input.batchSize - 1) + '篇（共' + totalChapters + '篇）\n' +
      '【每篇篇幅】' + getLengthTextDNA(chapterLength) + '\n' +
      '【語言】' + _langInstruction + '\n' +
      (isFirstChapter ? _hookText : '') +
      (isLastChapter ? _endingText : _batchCliffText)
    );
  } else {
    sections.push(
      '【本篇資訊】第' + chapterNum + '篇（共' + totalChapters + '篇）\n' +
      '【篇幅】' + getLengthTextDNA(chapterLength) + '\n' +
      '【語言】' + _langInstruction + '\n' +
      (isFirstChapter ? _hookText : '') +
      (isLastChapter ? _endingText : _cliffText)
    );
  }

  return sections.join('\n\n');
}

// === Outline Prompt Assembly ===
function assembleOutlinePrompt(dna, topic, totalChapters, audience) {
  var sections = [];
  sections.push('你是一位資深的' + (dna.category === 'narrative' ? '小說' : '內容') + '策劃編輯。');
  sections.push('請為以下作品規劃章節大綱。');
  sections.push('【主題】' + topic);
  sections.push('【風格】' + dna.name);
  sections.push('【目標觀眾】' + (audience ? audience.name : '一般讀者'));
  sections.push('【總篇章數】' + totalChapters + '篇');

  // Arc structure from DNA
  var arcLines = [];
  for (var pos in dna.arcStructure) {
    if (dna.arcStructure.hasOwnProperty(pos)) {
      arcLines.push(pos + '：' + dna.arcStructure[pos]);
    }
  }
  sections.push('【弧線結構】\n' + arcLines.join('\n') + '\n請按照此結構分配每篇的弧線位置');

  var firstArc = Object.keys(dna.arcStructure)[0] || 'setup';
  sections.push(
    '【輸出格式】JSON（不要 markdown），格式如下：\n' +
    '[{"num":1,"purpose":"本篇目的","coreTasks":["必做任務1","必做任務2"],"prohibitions":["禁止事項1"],"arcPosition":"' + firstArc + '"}]'
  );

  sections.push(
    '【規則】\n' +
    '- 每篇必須有明確且不同的目的\n' +
    '- coreTasks 至少2項，具體可執行\n' +
    '- prohibitions 至少1項，針對該篇的特定問題（不要重複 DNA 品質規則中已有的通用禁止項）\n' +
    '- 相鄰篇章不能有相同的場景或開場方式\n' +
    '- 伏筆要有對應的收線篇章\n' +
    '- 節奏要有張弛：不能連續3篇都是高潮或都是鋪墊\n' +
    '- prohibitions 優先級：DNA 品質規則 > 大綱禁止項（兩者衝突時以 DNA 為準）'
  );

  return sections.join('\n\n');
}
