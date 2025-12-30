// Kingdom Template Types
export interface KingdomTemplateSummary {
  id: string;
  name: string;
  description: string;
  raceName: string;
  alignmentName: string;
  regentClassName: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  icon: string;
}

export interface KingdomTemplateDetails {
  id: string;
  name: string;
  capitalName: string;
  description: string;
  alignment: string;
  race: string;
  regent: {
    name: string;
    description: string;
    classCode: string;
    combat: number;
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
  };
  troopTemplates: Array<{
    slotIndex: number;
    name: string;
    description: string;
    passiveId: string;
    resourceType: string;
    combat: number;
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
  }>;
}
