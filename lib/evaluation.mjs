import { RUBRIC } from './config.mjs';

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const normalized = (value) => String(value || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();

function topicMatches(actual, expected) {
  const topic = normalized(actual);
  if (expected === 'hash map') return /hash ?map|hash ?table|dictionary|dict/.test(topic);
  if (expected === 'sliding window') return /sliding window|two pointers/.test(topic);
  return topic.includes(normalized(expected));
}

export function gradeDeterministically(output, task = null) {
  const p = output?.problem;
  const s = output?.solution;
  const validShape = hasText(output?.title)
    && ['easy', 'medium', 'hard'].includes(output?.difficulty)
    && hasText(output?.topic)
    && output?.language === 'python'
    && hasText(p?.description)
    && Array.isArray(p?.examples)
    && p.examples.length >= 2
    && p.examples.every((x) => hasText(x?.input) && hasText(x?.output) && hasText(x?.explanation))
    && Array.isArray(p?.constraints)
    && p.constraints.length > 0
    && p.constraints.every(hasText)
    && hasText(p?.starterCode)
    && ['intuition', 'approach', 'walkthrough', 'correctness', 'complexity', 'code'].every((key) => hasText(s?.[key]));

  const difficultyMatch = task?.expectedDifficulty == null || output?.difficulty === task.expectedDifficulty;
  const topicMatch = task?.expectedTopic == null || topicMatches(output?.topic, task.expectedTopic);
  const separateSolution = Boolean(p && s && hasText(s.code))
    && ![p.description, p.starterCode, ...(p.constraints || [])].some(
      (part) => typeof part === 'string' && part.includes(s.code.trim())
    );

  return [
    { key: 'schema', label: 'Required fields present', passed: validShape, detail: validShape ? 'All required text, examples, constraints, and code fields are present.' : 'A required section is empty or malformed.' },
    { key: 'difficulty', label: 'Declared difficulty matches', passed: difficultyMatch, detail: task?.expectedDifficulty ? `Expected ${task.expectedDifficulty}; received ${output?.difficulty || 'none'}.` : 'No requested difficulty; check skipped.' },
    { key: 'topic', label: 'Declared topic matches', passed: topicMatch, detail: task?.expectedTopic ? `Expected ${task.expectedTopic}; received ${output?.topic || 'none'}.` : 'No requested topic; check skipped.' },
    { key: 'separation', label: 'Solution is in a separate field', passed: separateSolution, detail: separateSolution ? 'The UI can keep the solution closed by default.' : 'The solution is missing or copied into the visible problem.' }
  ];
}

export function summarizeGrades(gates, judge) {
  if (!judge) return { rubricPercent: null, passed: null };
  const scores = RUBRIC.map(({ key }) => Number(judge?.[key]?.score));
  if (scores.some((score) => ![0, 0.5, 1].includes(score))) return { rubricPercent: null, passed: false };
  const rubricPercent = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100);
  return { rubricPercent, passed: gates.every((gate) => gate.passed) && rubricPercent > 75 };
}
