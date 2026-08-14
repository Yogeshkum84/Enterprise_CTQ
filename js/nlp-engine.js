/**
 * YK CTQ — Client-side NLP Engine v4.0
 * ======================================
 * Mirrors the Python intelligence engines in server.py for offline/browser-side use.
 * When the Flask server is available the API is preferred; this module is a fallback.
 *
 * Exports:
 *   NLPEngine.analyseSentiment(text, options) → 7-dim sentiment profile
 *   NLPEngine.scoreResolutionIntegrity(resNotes, resCode, state) → 0-100 + breakdown
 *   NLPEngine.scoreCategoryQuality(text, assignedCategory, keywordMap) → confidence + flag
 *   NLPEngine.extractKBCitations(text) → string[]
 *   NLPEngine.computeFrustrationIndex(text) → 0-100
 */

// ---------------------------------------------------------------------------
// Shared lexicons
// ---------------------------------------------------------------------------
const NEGATION = ['not','never','still','no','cannot',"won't","can't","don't",
                  "didn't","isn't","wasn't","hasn't","couldn't","shouldn't"];

const URGENCY_KW = ['urgent','critical','asap','immediately','emergency','cannot wait',
                    'breach','escalate','manager','unacceptable','still not fixed',
                    'hours ago','days ago','waiting all day','not good enough','livid'];

const VIP_MARKERS = ['vip','executive','director','ceo','cto','coo','cfo','vp ',
                     'vice president','board','c-suite','head of','chief ','president'];

const SLA_PATTERNS = ['breach','overdue','sla','xla','deadline','due date',
                      'still waiting','hours left','due in','target','past due'];

const HEDGE_WORDS = ['should be','might','hopefully','probably','may work','could',
                     'perhaps','unclear','unsure','not sure','might resolve'];

const CERTAINTY_WORDS = ['resolved','confirmed','verified','tested','fixed',
                         'working','completed','done','successful','restored'];

const CONFIRMATION = ['user confirmed','caller confirmed','confirmed working',
                      'tested and working','verified by user','working as expected',
                      'confirmed by','signed off','positive confirmation','successful test'];

const POS_WORDS = ['resolved','fixed','completed','success','assisted','happy','glad',
                   'great','thank','working','done','sorted','pleasure','kind','prompt',
                   'excellent','outstanding','apologise','appreciate','pleased'];

const NEG_WORDS = ['frustrated','escalated','unacceptable','still not','not working',
                   'issue persists','not resolved','delay','overdue','waiting','breach',
                   'unhappy','disappointed','urgent','complaint','broken','fail',
                   'error','cannot','unable','ignored','unresolved'];

const RES_CODE_TERMS = {
    'resolved by it':      ['fix','resolved','corrected','repaired','restored','tested','confirmed'],
    'resolved by caller':  ['user','caller','self','themselves','independently'],
    'user education':      ['explained','trained','showed','guided','educated','documented'],
    'workaround provided': ['workaround','temporary','interim','alternative'],
    'no fault found':      ['tested','checked','verified','no issue','unable to reproduce'],
    'third party':         ['vendor','supplier','third party','escalated','external'],
    'duplicate':           ['duplicate','existing','same','already logged'],
};

const ACTION_VERBS = ['restart','reboot','reset','reinstall','update','patch','clear',
                      'reconfigure','tested','verified','confirmed','applied','fixed',
                      'resolved','removed','installed','replaced','migrated','rebuilt'];

const KB_REGEX = /\bKB\d{4,8}\b/gi;

// ---------------------------------------------------------------------------
// Counter utility
// ---------------------------------------------------------------------------
function _count(arr) {
    const m = new Map();
    for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
    return m;
}

function _ngrams(words, n) {
    const out = [];
    for (let i = 0; i <= words.length - n; i++) {
        out.push(words.slice(i, i + n).join(' '));
    }
    return out;
}

// ---------------------------------------------------------------------------
// 1. 7-Dimension Sentiment Analysis
// ---------------------------------------------------------------------------

/**
 * @param {string} text        — combined text (work notes + comments + description)
 * @param {object} [options]
 * @param {string} [options.caller]              — caller name for VIP detection
 * @param {string} [options.priority]            — ticket priority
 * @param {number} [options.callerHistoryCount]  — how many times caller appeared in last 30 days
 * @returns {object} — 7 scores + sentiment_type + sentiment_reason
 */
function analyseSentiment(text = '', options = {}) {
    const { caller = '', priority = '', callerHistoryCount = 0 } = options;
    const t     = text.toLowerCase();
    const words = t.split(/\s+/);
    const wc    = Math.max(words.length, 1);

    // 1. Polarity
    const posHits = POS_WORDS.reduce((n, w) => n + (t.split(w).length - 1), 0);
    const negHits = NEG_WORDS.reduce((n, w) => n + (t.split(w).length - 1), 0);
    const total   = posHits + negHits + 1;
    const polarity = Math.min(100, Math.max(0, Math.round(posHits / total * 70 + 15)));

    // 2. Frustration index
    const alpha     = Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
    const capsCount = text.replace(/[^A-Z]/g, '').length;
    const capsRatio = capsCount / alpha;

    const negDensity = NEGATION.reduce((n, w) => n + (t.split(w).length - 1), 0) / wc;

    const tgrams    = _ngrams(words, 3);
    const tgramMap  = _count(tgrams);
    let repeatPhrases = 0;
    tgramMap.forEach(c => { if (c >= 2) repeatPhrases++; });

    const punct      = (text.match(/[!?]/g) || []).length + (text.match(/\.\.\./g) || []).length;
    const sentences  = Math.max(text.split(/[.!?]+/).length, 1);
    const punctScore = punct / sentences;

    const frustration = Math.min(100, Math.max(0, Math.round(
        capsRatio * 30 +
        Math.min(negDensity * wc, 5) / 5 * 30 +
        Math.min(repeatPhrases, 5) / 5 * 20 +
        Math.min(punctScore, 1.0) * 20
    )));

    // 3. Escalation urgency
    const urgHits = URGENCY_KW.reduce((n, kw) => n + (t.includes(kw) ? 1 : 0), 0);
    const priLow  = /\b(low|p4|p5)\b/.test(priority.toLowerCase());
    const urgScore = Math.min(100, urgHits * 18 + (urgHits > 0 && priLow ? 20 : 0));

    // 4. VIP sensitivity
    const combined   = (caller + ' ' + text).toLowerCase();
    const vipHit     = VIP_MARKERS.some(v => combined.includes(v));
    const vipScore   = vipHit ? 90 : 10;

    // 5. SLA anxiety
    const slaHits  = SLA_PATTERNS.reduce((n, p) => n + (t.includes(p) ? 1 : 0), 0);
    const slaScore = Math.min(100, slaHits * 20);

    // 6. Resolution confidence
    const hedgeHits   = HEDGE_WORDS.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    const certainHits = CERTAINTY_WORDS.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    const rcTotal     = certainHits + hedgeHits;
    const resConf = rcTotal === 0 ? 50 : Math.min(100, Math.round(certainHits / rcTotal * 100));

    // 7. Repeat caller signal
    const repeatSignal = Math.min(100, callerHistoryCount * 25);

    // Legacy type
    let sType = 'Neutral';
    if (negHits > posHits + 1) sType = 'Negative';
    else if (posHits > negHits + 1) sType = 'Positive';

    const reasons = [];
    if (frustration > 70) reasons.push('High frustration detected');
    if (urgScore > 80)    reasons.push('Escalation urgency indicators present');
    if (vipScore > 50)    reasons.push('VIP caller markers found');
    const reason = reasons.length ? reasons.join('; ') : `${sType} tone`;

    return {
        polarity,
        frustration_index:     frustration,
        escalation_urgency:    urgScore,
        vip_sensitivity:       vipScore,
        sla_anxiety:           slaScore,
        resolution_confidence: resConf,
        repeat_caller_signal:  repeatSignal,
        sentiment_type:        sType,
        sentiment_reason:      reason,
    };
}

// ---------------------------------------------------------------------------
// 2. Resolution Integrity Scoring
// ---------------------------------------------------------------------------

/**
 * @param {string} resolutionNotes
 * @param {string} resolutionCode
 * @param {string} [state]
 * @returns {{ resolution_integrity: number, ri_jaccard: number, ri_completeness: number, ri_verification: number }}
 */
function scoreResolutionIntegrity(resolutionNotes = '', resolutionCode = '', state = '') {
    const rn  = resolutionNotes.toLowerCase().trim();
    const rc  = resolutionCode.toLowerCase().trim();
    const rnWords = new Set(rn.match(/\b\w+\b/g) || []);

    // Find code-implied terms
    let codeTerms = ['resolved', 'fix', 'tested', 'confirmed']; // default
    for (const [pattern, terms] of Object.entries(RES_CODE_TERMS)) {
        if (pattern.split(' ').some(w => rc.includes(w))) {
            codeTerms = terms;
            break;
        }
    }
    const codeSet = new Set(codeTerms);

    // Jaccard
    const union      = new Set([...rnWords, ...codeSet]);
    const inter      = [...rnWords].filter(w => codeSet.has(w));
    const jaccard    = union.size ? inter.length / union.size : 0;

    // Completeness
    const wordCount  = rn.split(/\s+/).filter(Boolean).length;
    const actionHits = ACTION_VERBS.filter(v => rn.includes(v)).length;
    const completeness = Math.min(1.0, (Math.min(wordCount, 20) / 20) * 0.6 + (Math.min(actionHits, 3) / 3) * 0.4);

    // Verification
    const verification = CONFIRMATION.some(p => rn.includes(p)) ? 1 : 0;

    const integrity = Math.round(jaccard * 40 + completeness * 35 + verification * 25);

    return {
        resolution_integrity: integrity,
        ri_jaccard:           +jaccard.toFixed(3),
        ri_completeness:      +completeness.toFixed(3),
        ri_verification:      verification,
    };
}

// ---------------------------------------------------------------------------
// 3. Category Quality Scoring (keyword overlap)
// ---------------------------------------------------------------------------

/**
 * @param {string} text              — short_description + description
 * @param {string} assignedCategory  — e.g. "Hardware"
 * @param {object} [keywordMap]      — loaded from category_keywords_default.json
 * @returns {{ category_confidence: number|null, category_flag: boolean, category_suggestion: string|null, category_flag_reason: string|null }}
 */
function scoreCategoryQuality(text = '', assignedCategory = '', keywordMap = null) {
    if (!keywordMap || !assignedCategory) {
        return { category_confidence: null, category_flag: false,
                 category_suggestion: null, category_flag_reason: null };
    }

    const textWords = new Set((text.toLowerCase().match(/\b\w+\b/g) || []));
    const catScores = {};

    for (const [cat, keywords] of Object.entries(keywordMap)) {
        if (cat.startsWith('_')) continue; // skip metadata keys
        const kwSet = new Set(keywords.map(k => k.toLowerCase()));
        if (!kwSet.size) continue;
        const overlap = [...textWords].filter(w => kwSet.has(w)).length;
        catScores[cat] = overlap / kwSet.size;
    }

    if (!Object.keys(catScores).length) {
        return { category_confidence: null, category_flag: false,
                 category_suggestion: null, category_flag_reason: null };
    }

    const bestCat    = Object.keys(catScores).reduce((a, b) => catScores[a] > catScores[b] ? a : b);
    const bestScore  = catScores[bestCat];
    const assignedLc = assignedCategory.toLowerCase();
    const assignedScore = Object.entries(catScores)
        .find(([k]) => k.toLowerCase() === assignedLc)?.[1] ?? 0;

    const confidence = bestScore === 0 ? 1.0
        : +Math.min(1.0, assignedScore / bestScore).toFixed(2);

    let flag = false, suggestion = null, reason = null;
    if (confidence < 0.40 && bestCat.toLowerCase() !== assignedLc && bestScore > 0) {
        flag = true;
        suggestion = bestCat;
        const ratio = (bestScore / Math.max(assignedScore, 0.001)).toFixed(1);
        reason = `Text is ${ratio}× more similar to '${bestCat}' than '${assignedCategory}'`;
    } else if (bestScore > 0 && bestCat.toLowerCase() !== assignedLc &&
               (bestScore - assignedScore) / bestScore > 0.5) {
        flag = true;
        suggestion = bestCat;
        reason = `'${bestCat}' matches text significantly better than '${assignedCategory}'`;
    }

    return { category_confidence: confidence, category_flag: flag,
             category_suggestion: suggestion, category_flag_reason: reason };
}

// ---------------------------------------------------------------------------
// 4. KB Citation Extraction
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @returns {string[]} — unique KB article IDs, e.g. ["KB1234567", "KB0009876"]
 */
function extractKBCitations(text = '') {
    const matches = text.match(KB_REGEX) || [];
    return [...new Set(matches.map(m => m.toUpperCase()))];
}

// ---------------------------------------------------------------------------
// 5. Frustration Index (standalone helper)
// ---------------------------------------------------------------------------

/**
 * @param {string} text
 * @returns {number} 0–100
 */
function computeFrustrationIndex(text = '') {
    const t = text.toLowerCase();
    const words = t.split(/\s+/);
    const wc = Math.max(words.length, 1);

    const alpha     = Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
    const caps      = text.replace(/[^A-Z]/g, '').length;
    const capsRatio = caps / alpha;

    const negDensity = NEGATION.reduce((n, w) => n + (t.split(w).length - 1), 0) / wc;

    const tgrams = _ngrams(words, 3);
    const tgramMap = _count(tgrams);
    let repeatPhrases = 0;
    tgramMap.forEach(c => { if (c >= 2) repeatPhrases++; });

    const punct      = (text.match(/[!?]/g) || []).length + (text.match(/\.\.\./g) || []).length;
    const sentences  = Math.max(text.split(/[.!?]+/).length, 1);
    const punctScore = punct / sentences;

    return Math.min(100, Math.max(0, Math.round(
        capsRatio * 30 +
        Math.min(negDensity * wc, 5) / 5 * 30 +
        Math.min(repeatPhrases, 5) / 5 * 20 +
        Math.min(punctScore, 1.0) * 20
    )));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const NLPEngine = {
    analyseSentiment,
    scoreResolutionIntegrity,
    scoreCategoryQuality,
    extractKBCitations,
    computeFrustrationIndex,
};

export default NLPEngine;
