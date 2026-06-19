import { ROLE_SKILLS, SKILL_ALIASES, SUPPORTED_ROLES } from '../data/role-skills.js';
import { AppError } from '../middleware/error.middleware.js';
import type { SkillGapResult, SupportedRole } from '../types/index.js';

/**
 * Normalize a skill string for comparison.
 */
function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[.\-_]/g, ' ');
}

/**
 * Build a reverse alias map for quick lookup.
 */
function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    map.set(normalizeSkill(canonical), canonical);
    for (const alias of aliases) {
      map.set(normalizeSkill(alias), canonical);
    }
  }
  return map;
}

const ALIAS_MAP = buildAliasMap();

/**
 * Resolve a skill to its canonical name using alias map.
 */
function resolveSkill(skill: string): string {
  const normalized = normalizeSkill(skill);
  return ALIAS_MAP.get(normalized) || skill;
}

/**
 * Analyze the skill gap between candidate skills and role requirements.
 */
export function analyzeSkillGap(
  extractedSkills: string[],
  targetRole: string
): SkillGapResult {
  const role = targetRole as SupportedRole;

  if (!SUPPORTED_ROLES.includes(role)) {
    throw new AppError(`Unsupported role: ${targetRole}`, 400);
  }

  const roleData = ROLE_SKILLS[role];
  const required = roleData.requiredSkills;
  const recommended = roleData.recommendedSkills;

  // Resolve candidate skills to canonical names
  const candidateResolved = extractedSkills.map(resolveSkill);
  const candidateNormalized = candidateResolved.map(normalizeSkill);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of required) {
    const reqNorm = normalizeSkill(req);
    const reqResolved = normalizeSkill(resolveSkill(req));

    const isMatched = candidateNormalized.some((cs) => {
      return (
        cs === reqNorm ||
        cs === reqResolved ||
        cs.includes(reqNorm) ||
        reqNorm.includes(cs) ||
        // Check alias match
        normalizeSkill(resolveSkill(cs)) === reqResolved
      );
    });

    if (isMatched) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  // Recommended skills not yet possessed
  const recommendedMissing = recommended.filter((rec) => {
    const recNorm = normalizeSkill(rec);
    return !candidateNormalized.some((cs) => cs === recNorm || cs.includes(recNorm));
  });

  const readinessScore =
    required.length > 0
      ? Math.round((matchedSkills.length / required.length) * 100)
      : 0;

  return {
    matchedSkills,
    missingSkills,
    recommendedSkills: recommendedMissing.slice(0, 5),
    readinessScore,
    totalRequired: required.length,
  };
}
