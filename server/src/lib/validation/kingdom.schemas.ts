// Kingdom Validation Schemas
import { z } from "zod";

// ============ ENUMS (Match Prisma schema) ============

export const AlignmentSchema = z.enum(["BOM", "MAL", "NEUTRO"]);

export const RaceSchema = z.enum([
  "ABERRACAO",
  "BESTA",
  "CELESTIAL",
  "CONSTRUTO",
  "DRAGAO",
  "ELEMENTAL",
  "FADA",
  "DIABO",
  "GIGANTE",
  "HUMANOIDE",
  "MONSTRUOSIDADE",
  "GOSMA",
  "PLANTA",
  "MORTO_VIVO",
  "INSETO",
]);

export const ResourceTypeSchema = z.enum([
  "ore",
  "supplies",
  "arcane",
  "experience",
  "devotion",
]);

// ============ BASE SCHEMAS ============

export const BaseAttributesSchema = z.object({
  combat: z.number().min(1).max(30),
  speed: z.number().min(1).max(30),
  focus: z.number().min(1).max(30),
  resistance: z.number().min(1).max(30),
  will: z.number().min(0).max(30),
  vitality: z.number().min(1).max(30),
});

// Atributos do Regente (devem somar 30)
export const RegentAttributesSchema = z
  .object({
    combat: z.number().min(0).max(30),
    speed: z.number().min(0).max(30),
    focus: z.number().min(0).max(30),
    resistance: z.number().min(0).max(30),
    will: z.number().min(0).max(30),
    vitality: z.number().min(0).max(30),
  })
  .refine(
    (data) => {
      const total =
        data.combat +
        data.speed +
        data.focus +
        data.resistance +
        data.will +
        data.vitality;
      return total === 30;
    },
    { message: "Atributos do regente devem somar exatamente 30 pontos" }
  );

// ============ REGENT SCHEMA ============

export const CreateRegentSchema = z.object({
  name: z
    .string()
    .min(2, "Nome do regente deve ter pelo menos 2 caracteres")
    .max(50, "Nome do regente deve ter no máximo 50 caracteres"),
  avatar: z.string().optional(), // Nome do arquivo sprite
  attributes: RegentAttributesSchema,
  initialSkillId: z.string().optional(), // Skill inicial (nível 1)
});

// ============ TROOP TEMPLATE ============

export const CreateTroopTemplateSchema = z.object({
  slotIndex: z.number().min(0).max(4),
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres"),
  description: z.string().max(500).optional(),
  avatar: z.string().optional(), // ID do sprite (ex: "1")
  passiveId: z.string().min(1, "Passiva é obrigatória"),
  resourceType: ResourceTypeSchema,
  combat: z.number().min(1).max(15),
  speed: z.number().min(1).max(15),
  focus: z.number().min(1).max(15),
  resistance: z.number().min(1).max(15),
  will: z.number().min(0).max(15),
  vitality: z.number().min(1).max(15),
});

export const TroopTemplatesArraySchema = z
  .array(CreateTroopTemplateSchema)
  .length(5, "Deve haver exatamente 5 templates de tropas")
  .refine(
    (templates) => {
      // Verificar se avatares das tropas são únicos
      const avatars = templates
        .map((t) => t.avatar)
        .filter((a): a is string => !!a);
      const uniqueAvatars = new Set(avatars);
      return avatars.length === uniqueAvatars.size;
    },
    {
      message:
        "Cada tropa deve ter um avatar único. Avatares duplicados não são permitidos.",
    }
  );

// ============ CREATE KINGDOM ============

export const CreateKingdomSchema = z
  .object({
    name: z
      .string()
      .min(3, "Nome do reino deve ter pelo menos 3 caracteres")
      .max(50, "Nome do reino deve ter no máximo 50 caracteres")
      .regex(/^[a-zA-ZÀ-ÿ0-9\s'-]+$/, "Nome contém caracteres inválidos"),
    description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres")
      .optional(),
    alignment: AlignmentSchema,
    race: RaceSchema,
    // Regente (obrigatório para criação completa)
    regent: CreateRegentSchema,
    // Tropas (obrigatório para criação completa)
    troopTemplates: TroopTemplatesArraySchema,
  })
  .refine(
    (data) => {
      // Validação: avatar do regente não pode ser igual ao avatar de nenhuma tropa
      const regentAvatar = data.regent.avatar;
      if (!regentAvatar) return true;

      const troopAvatars = data.troopTemplates
        .map((t) => t.avatar)
        .filter((a): a is string => !!a);

      return !troopAvatars.includes(regentAvatar);
    },
    {
      message:
        "O avatar do regente não pode ser igual ao avatar de uma tropa. Cada entidade deve ter um avatar único no reino.",
      path: ["regent", "avatar"],
    }
  );

// ============ OTHER SCHEMAS ============

export const KingdomIdSchema = z.object({
  kingdomId: z.string().uuid("ID do reino inválido"),
});

export const SetTroopTemplatesSchema = z.object({
  kingdomId: z.string().uuid("ID do reino inválido"),
  templates: TroopTemplatesArraySchema,
});

export const UpdateDescriptionSchema = z.object({
  kingdomId: z.string().uuid("ID do reino inválido"),
  description: z.string().max(1000, "Descrição muito longa").optional(),
});

export const TemplateIdSchema = z.object({
  templateId: z.string().min(1, "ID do template é obrigatório"),
});

export const UnitDescriptionSchema = z.object({
  unitId: z.string().uuid("ID da unidade inválido"),
  description: z.string().max(1000, "Descrição muito longa").optional(),
});

export const TroopTemplateDescriptionSchema = z.object({
  templateId: z.string().uuid("ID do template inválido"),
  description: z.string().max(500, "Descrição muito longa").optional(),
});

// ============ TYPE EXPORTS ============

export type CreateKingdomInput = z.infer<typeof CreateKingdomSchema>;
export type CreateTroopTemplateInput = z.infer<
  typeof CreateTroopTemplateSchema
>;
export type SetTroopTemplatesInput = z.infer<typeof SetTroopTemplatesSchema>;
export type UpdateDescriptionInput = z.infer<typeof UpdateDescriptionSchema>;
