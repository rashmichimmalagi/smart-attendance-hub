/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEPARTMENT_OPTIONS = [
  "Computer Science Engineering",
  "Information Science Engineering",
  "Electronics & Communication Engineering",
  "Electrical & Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Artificial Intelligence & Machine Learning",
  "Biotechnology Engineering",
  "Automobile Engineering",
  "Aeronautical Engineering"
];

export const normalizeDepartmentName = (dept: string | null | undefined): string => {
  if (!dept) return "Computer Science Engineering";
  
  const d = dept.trim();
  const upper = d.toUpperCase();

  // CSE or Computer Science types
  if (
    upper === 'CSE' ||
    /^CSE$/i.test(d) ||
    /Computer\s+Science/i.test(d) ||
    /Comp\s*Sci/i.test(d)
  ) {
    return "Computer Science Engineering";
  }

  // ISE or Information Science types
  if (
    upper === 'ISE' ||
    /Information\s+Science/i.test(d) ||
    /Info\s*Sci/i.test(d)
  ) {
    return "Information Science Engineering";
  }

  // ECE or Electronics and Communication Engineering types
  if (
    upper === 'ECE' ||
    upper === 'ENC' ||
    /Electronics\s+(and|&)\s+Communication/i.test(d) ||
    /Telecom/i.test(d)
  ) {
    return "Electronics & Communication Engineering";
  }

  // EEE or Electrical and Electronics Engineering types
  if (
    upper === 'EEE' ||
    /Electrical\s+(and|&)\s+Electronics/i.test(d) ||
    /Electricity/i.test(d) ||
    /Power\s+Electronics/i.test(d)
  ) {
    return "Electrical & Electronics Engineering";
  }

  // ME or Mechanical Engineering types
  if (
    upper === 'ME' ||
    /Mechanical/i.test(d)
  ) {
    return "Mechanical Engineering";
  }

  // CIVIL or Civil Engineering types
  if (
    upper === 'CIVIL' ||
    upper === 'CV' ||
    /Civil/i.test(d)
  ) {
    return "Civil Engineering";
  }

  // Artificial Intelligence & Machine Learning types
  if (
    upper === 'AIML' ||
    upper === 'AI & ML' ||
    upper === 'AI/ML' ||
    /Artificial\s+Intelligence/i.test(d) ||
    /Machine\s+Learning/i.test(d) ||
    /AI\s*(and|&)\s*ML/i.test(d)
  ) {
    return "Artificial Intelligence & Machine Learning";
  }

  // Biotechnology Engineering types
  if (
    upper === 'BT' ||
    /Biotech/i.test(d) ||
    /Biomedical/i.test(d)
  ) {
    return "Biotechnology Engineering";
  }

  // Automobile Engineering types
  if (
    upper === 'AU' ||
    /Automobile/i.test(d) ||
    /Automotive/i.test(d)
  ) {
    return "Automobile Engineering";
  }

  // Aeronautical Engineering types
  if (
    upper === 'AE' ||
    /Aeronautical/i.test(d) ||
    /Aerospace/i.test(d) ||
    /Aero/i.test(d)
  ) {
    return "Aeronautical Engineering";
  }

  // Fallback map: if it is any other string, try to substring match,
  // or return "Computer Science Engineering" to fully conform to the 10 options
  const lower = d.toLowerCase();
  if (lower.includes('computer')) return "Computer Science Engineering";
  if (lower.includes('information') || lower.includes('info')) return "Information Science Engineering";
  if (lower.includes('electronics') || lower.includes('communication') || lower.includes('tele')) return "Electronics & Communication Engineering";
  if (lower.includes('electrical') || lower.includes('electricity')) return "Electrical & Electronics Engineering";
  if (lower.includes('mechanical')) return "Mechanical Engineering";
  if (lower.includes('civil')) return "Civil Engineering";
  if (lower.includes('intelligence') || lower.includes('machine') || lower.includes('aiml') || /\bai\b/i.test(d)) return "Artificial Intelligence & Machine Learning";
  if (lower.includes('biotech') || lower.includes('biomedical') || lower.includes('biology') || lower.includes('biotechnology')) return "Biotechnology Engineering";
  if (lower.includes('automobile') || lower.includes('automotive')) return "Automobile Engineering";
  if (lower.includes('aero') || lower.includes('aviation') || lower.includes('space') || lower.includes('aerospace')) return "Aeronautical Engineering";

  // Default fallback to keep it compliant with the 10 options
  return "Computer Science Engineering";
};
