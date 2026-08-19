import {
  TIPS_MODULES,
  getTipsModuleById,
} from "../src/features/tips/tipsContent";

describe("TIPS_MODULES", () => {
  it("contiene los 3 módulos esperados", () => {
    expect(TIPS_MODULES.map((m) => m.id)).toEqual([
      "rutina-nocturna",
      "apnea-alertas",
      "habitos-colombia",
    ]);
  });

  it("cada módulo tiene estructura válida", () => {
    for (const module of TIPS_MODULES) {
      expect(typeof module.id).toBe("string");
      expect(typeof module.title).toBe("string");
      expect(typeof module.description).toBe("string");
      expect(typeof module.accent).toBe("string");
      expect(Array.isArray(module.sections)).toBe(true);
      expect(Array.isArray(module.checklist)).toBe(true);
      expect(Array.isArray(module.resources)).toBe(true);
    }
  });

  it("las secciones tienen bullets", () => {
    for (const module of TIPS_MODULES) {
      for (const section of module.sections) {
        expect(typeof section.title).toBe("string");
        expect(Array.isArray(section.bullets)).toBe(true);
        expect(section.bullets.length).toBeGreaterThan(0);
      }
    }
  });

  it("los recursos tienen url https", () => {
    for (const module of TIPS_MODULES) {
      for (const resource of module.resources) {
        expect(resource.url).toMatch(/^https:\/\//);
        expect(typeof resource.label).toBe("string");
      }
    }
  });

  it("los ids son únicos", () => {
    const ids = TIPS_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getTipsModuleById", () => {
  it("devuelve el módulo solicitado", () => {
    const module = getTipsModuleById("apnea-alertas");
    expect(module).not.toBeNull();
    expect(module.title).toBe("Apnea y señales de alerta");
  });

  it("devuelve null para id inexistente", () => {
    expect(getTipsModuleById("no-existe")).toBeNull();
  });
});
