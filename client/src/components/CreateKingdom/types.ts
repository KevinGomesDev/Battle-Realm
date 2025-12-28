interface Race {
  id: string;
  name: string;
  description: string;
  passiveName: string;
  passiveEffect: string;
  color: number;
}

interface Alignment {
  id: string;
  name: string;
  description: string;
  passiveName: string;
  passiveEffect: string;
  color: number;
}

interface GameClass {
  id: string;
  name: string;
  archetype: string;
  resourceUsed: string;
  description: string;
  skills: any[];
}

interface TroopPassive {
  id: string;
  name: string;
  description: string;
}

interface TroopTemplate {
  slotIndex: number;
  name: string;
  passiveId: string;
  resourceType:
    | "minerio"
    | "suprimentos"
    | "arcana"
    | "experiencia"
    | "devocao";
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
}

interface KingdomData {
  name: string;
  capitalName: string;
  alignment: string;
  race: string;
  raceMetadata: any;
}

interface RegentData {
  name: string;
  class: string;
  attributeDistribution: {
    combat: number;
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
  };
  initialFeature?: string;
}

export type {
  Race,
  Alignment,
  GameClass,
  TroopPassive,
  TroopTemplate,
  KingdomData,
  RegentData,
};
