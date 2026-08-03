/**
 * Maps raw coach type codes (e.g. 3A, 2A, 1A, SL, FIRST_CLASS, GENERAL, CC, EC)
 * into human-readable, displayable text for UI elements.
 */
export const formatCoachType = (coachType: string): string => {
  if (!coachType) return '';
  const normalized = coachType.trim().toUpperCase();

  const labels: Record<string, string> = {
    'GENERAL': 'General (GEN)',
    'FIRST_CLASS': 'First Class (FC)',
    '3A': 'AC 3 Tier (3A)',
    '2A': 'AC 2 Tier (2A)',
    '1A': 'AC First Class (1A)',
    'SL': 'Sleeper Class (SL)',
    'CC': 'AC Chair Car (CC)',
    'EC': 'Exec. Chair Car (EC)',
    '2S': 'Second Seating (2S)',
    '3E': 'AC 3 Tier Economy (3E)',
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  // Format custom string e.g. "SUPER_DELUXE" => "Super Deluxe"
  return normalized
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Short label version for small pills/badges (e.g. "3A", "FC", "SL")
 */
export const formatCoachTypeShort = (coachType: string): string => {
  if (!coachType) return '';
  const normalized = coachType.trim().toUpperCase();
  
  if (normalized === 'FIRST_CLASS') return 'First Class';
  if (normalized === 'GENERAL') return 'General';
  return normalized;
};
