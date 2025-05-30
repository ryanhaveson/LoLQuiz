interface ChampionStats {
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeed: number;
  attackspeedperlevel: number;
  attackrange: number;
  crit: number;
  critperlevel: number;
  // Add other stats as needed
}

interface ChampionAbility {
  damageType?: string;
  adRatio?: number;
  apRatio?: number;
  baseDamage?: number;
  cooldown?: number;
  isPassive?: boolean;
}

interface Champion {
  stats: ChampionStats;
  abilities?: ChampionAbility[];
  tags: string[];
  info?: {
    attack: number;
    defense: number;
    magic: number;
    difficulty: number;
  };
}

export function determineChampionDamageType(champion: Champion): string {
  // Initialize counters for AD and AP emphasis
  let adEmphasis = 0;
  let apEmphasis = 0;

  // Check if the champion relies on basic attacks
  const attackSpeedThreshold = 0.65;
  const attackRangeThreshold = 400;
  
  // Attack speed analysis
  if (champion.stats.attackspeed > attackSpeedThreshold) {
    adEmphasis += 1.5;
  }
  if (champion.stats.attackspeedperlevel > 3) {
    adEmphasis += 1;
  }

  // Attack range analysis
  if (champion.stats.attackrange > attackRangeThreshold) {
    adEmphasis += 1; // Ranged champions often rely more on basic attacks
  }

  // Critical strike analysis
  if (champion.stats.crit > 0 || champion.stats.critperlevel > 0) {
    adEmphasis += 1.5; // Critical strike is primarily an AD mechanic
  }

  // Champion info analysis (1-10 scale)
  if (champion.info) {
    adEmphasis += champion.info.attack * 0.3;
    apEmphasis += champion.info.magic * 0.3;
  }

  // Check champion tags for hints with weighted importance
  if (champion.tags.includes('Marksman')) {
    adEmphasis += 2; // Marksmen are almost always AD-based
  }
  if (champion.tags.includes('Fighter')) {
    adEmphasis += 1;
  }
  if (champion.tags.includes('Mage')) {
    apEmphasis += 2; // Mages are almost always AP-based
  }
  if (champion.tags.includes('Assassin')) {
    // Assassins can be either, but often have mixed scaling
    adEmphasis += 0.5;
    apEmphasis += 0.5;
  }

  // Analyze abilities if available
  if (champion.abilities) {
    let totalAbilityDamage = 0;
    let totalADScaling = 0;
    let totalAPScaling = 0;

    champion.abilities.forEach(ability => {
      if (!ability.isPassive) { // Don't count passive abilities in damage calculations
        if (ability.damageType === 'physical' || ability.damageType === 'mixed') {
          totalADScaling += ability.adRatio || 0;
          totalAbilityDamage += ability.baseDamage || 0;
        }
        if (ability.damageType === 'magic' || ability.damageType === 'mixed') {
          totalAPScaling += ability.apRatio || 0;
          totalAbilityDamage += ability.baseDamage || 0;
        }
      }
    });

    // Weight the ability scaling based on total damage potential
    if (totalAbilityDamage > 0) {
      adEmphasis += (totalADScaling / totalAbilityDamage) * 2;
      apEmphasis += (totalAPScaling / totalAbilityDamage) * 2;
    }
  }

  // Compare emphasis counters with a threshold for hybrid classification
  const hybridThreshold = 0.3; // 30% difference required to be considered non-hybrid
  const totalEmphasis = adEmphasis + apEmphasis;
  
  if (totalEmphasis === 0) {
    return "Unknown";
  }

  const adPercentage = adEmphasis / totalEmphasis;
  const apPercentage = apEmphasis / totalEmphasis;

  if (Math.abs(adPercentage - apPercentage) < hybridThreshold) {
    return "Hybrid";
  } else if (adEmphasis > apEmphasis) {
    return "AD";
  } else {
    return "AP";
  }
} 