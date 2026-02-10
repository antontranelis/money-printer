/**
 * Template Loader
 *
 * Lädt und cached Templates aus verschiedenen Quellen:
 * - Statische JSON-Dateien
 * - Entwicklungs-Templates (Hot Reload)
 */

import type {
  TemplateV2,
  TemplateProviderV2,
  TemplateFilter,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './schema';

// Use Vite's BASE_URL if available, otherwise default to '/'
const base =
  (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

// Template cache
const templateCache = new Map<string, TemplateV2>();
let templatesLoaded = false;

// Known template paths (statisch registriert)
const STATIC_TEMPLATE_PATHS = [
  '/templates/classic/template.json',
  '/templates/modern/template.json',
  '/templates/spiritual-natur-blaetter/template.json',
];

// Dev template path (nur in Development)
const DEV_TEMPLATE_PATH = '/templates/dev/';

/**
 * Lade ein Template aus einer JSON-Datei
 */
async function loadTemplateFromPath(path: string): Promise<TemplateV2 | null> {
  try {
    const url = `${base}${path.startsWith('/') ? path.slice(1) : path}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Failed to load template from ${url}: ${response.status}`);
      return null;
    }

    const template = (await response.json()) as TemplateV2;

    // Resolve relative asset paths to absolute
    template.assets = resolveAssetPaths(template.assets, path);

    return template;
  } catch (error) {
    console.warn(`Error loading template from ${path}:`, error);
    return null;
  }
}

/**
 * Konvertiere relative Asset-Pfade zu absoluten
 */
function resolveAssetPaths(
  assets: TemplateV2['assets'],
  templatePath: string
): TemplateV2['assets'] {
  const templateDir = templatePath.substring(0, templatePath.lastIndexOf('/'));

  const resolvePath = (path: string | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    if (path.startsWith('/')) return `${base}${path.slice(1)}`;
    return `${base}${templateDir.slice(1)}/${path}`;
  };

  return {
    ...assets,
    background: resolvePath(assets.background) || assets.background,
    front: resolvePath(assets.front),
    back: resolvePath(assets.back),
    frontFrame: resolvePath(assets.frontFrame),
    backFrame: resolvePath(assets.backFrame),
    badges: assets.badges
      ? {
          ...assets.badges,
          variants: assets.badges.variants?.map((v) => ({
            ...v,
            image: resolvePath(v.image) || v.image,
          })),
        }
      : undefined,
    decorations: assets.decorations
      ? Object.fromEntries(
          Object.entries(assets.decorations).map(([key, value]) => [
            key,
            resolvePath(value) || value,
          ])
        )
      : undefined,
  };
}

/**
 * Lade alle statischen Templates
 */
async function loadStaticTemplates(): Promise<void> {
  if (templatesLoaded) return;

  const loadPromises = STATIC_TEMPLATE_PATHS.map(async (path) => {
    const template = await loadTemplateFromPath(path);
    if (template) {
      templateCache.set(template.id, template);
    }
  });

  await Promise.all(loadPromises);
  templatesLoaded = true;
}

/**
 * Lade Dev-Templates (nur in Development)
 */
async function loadDevTemplates(): Promise<TemplateV2[]> {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) {
    return [];
  }

  // In Development: Versuche index.json zu laden, das Dev-Templates auflistet
  try {
    const indexUrl = `${base}${DEV_TEMPLATE_PATH.slice(1)}index.json`;
    const response = await fetch(indexUrl);

    if (!response.ok) {
      return [];
    }

    const index = (await response.json()) as { templates: string[] };
    const templates: TemplateV2[] = [];

    for (const templateName of index.templates) {
      const template = await loadTemplateFromPath(
        `${DEV_TEMPLATE_PATH}${templateName}/template.json`
      );
      if (template) {
        template.status = 'development';
        templates.push(template);
        templateCache.set(template.id, template);
      }
    }

    return templates;
  } catch {
    // Dev-Templates sind optional
    return [];
  }
}

/**
 * Validiere ein Template gegen das Schema
 */
function validateTemplate(template: TemplateV2): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!template.id) {
    errors.push({ path: 'id', message: 'Template ID is required', severity: 'error' });
  }

  if (!template.name) {
    errors.push({ path: 'name', message: 'Template name is required', severity: 'error' });
  }

  if (!template.version) {
    errors.push({ path: 'version', message: 'Template version is required', severity: 'error' });
  }

  if (!template.assets?.background) {
    errors.push({
      path: 'assets.background',
      message: 'Background asset is required',
      severity: 'error',
    });
  }

  if (!template.schema?.fields || template.schema.fields.length === 0) {
    errors.push({
      path: 'schema.fields',
      message: 'At least one field is required',
      severity: 'error',
    });
  }

  if (!template.layout?.dimensions) {
    errors.push({
      path: 'layout.dimensions',
      message: 'Layout dimensions are required',
      severity: 'error',
    });
  }

  // Field validation
  const fieldIds = new Set<string>();
  template.schema?.fields?.forEach((field, index) => {
    if (!field.id) {
      errors.push({
        path: `schema.fields[${index}].id`,
        message: 'Field ID is required',
        severity: 'error',
      });
    } else if (fieldIds.has(field.id)) {
      errors.push({
        path: `schema.fields[${index}].id`,
        message: `Duplicate field ID: ${field.id}`,
        severity: 'error',
      });
    } else {
      fieldIds.add(field.id);
    }

    if (!field.type) {
      errors.push({
        path: `schema.fields[${index}].type`,
        message: 'Field type is required',
        severity: 'error',
      });
    }
  });

  // Layout layer validation
  const validateLayerFieldRefs = (layers: TemplateV2['layout']['front']['layers'], side: string) => {
    layers.forEach((layer, index) => {
      if ('fieldId' in layer && layer.fieldId) {
        if (!fieldIds.has(layer.fieldId)) {
          errors.push({
            path: `layout.${side}.layers[${index}].fieldId`,
            message: `Referenced field not found: ${layer.fieldId}`,
            severity: 'error',
          });
        }
      }
    });
  };

  if (template.layout?.front?.layers) {
    validateLayerFieldRefs(template.layout.front.layers, 'front');
  }

  if (template.layout?.back?.layers) {
    validateLayerFieldRefs(template.layout.back.layers, 'back');
  }

  // Warnings
  if (!template.description) {
    warnings.push({
      path: 'description',
      message: 'Template description is recommended',
      severity: 'warning',
    });
  }

  if (!template.designer?.name) {
    warnings.push({
      path: 'designer.name',
      message: 'Designer name is recommended',
      severity: 'warning',
    });
  }

  if (!template.shop?.thumbnail) {
    warnings.push({
      path: 'shop.thumbnail',
      message: 'Thumbnail is recommended for shop display',
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Template Provider Implementation
 */
export const templateProviderV2: TemplateProviderV2 = {
  async listTemplates(filter?: TemplateFilter): Promise<TemplateV2[]> {
    await loadStaticTemplates();

    // Auch Dev-Templates laden wenn in Development
    await loadDevTemplates();

    let templates = Array.from(templateCache.values());

    // Filter anwenden
    if (filter?.type) {
      templates = templates.filter((t) => t.type === filter.type);
    }

    if (filter?.status) {
      templates = templates.filter((t) => t.status === filter.status);
    }

    if (filter?.language) {
      templates = templates.filter(
        (t) =>
          !t.schema.languages || t.schema.languages.includes(filter.language!)
      );
    }

    return templates;
  },

  async getTemplate(id: string): Promise<TemplateV2> {
    await loadStaticTemplates();
    await loadDevTemplates();

    const template = templateCache.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    return template;
  },

  async validateTemplate(template: TemplateV2): Promise<ValidationResult> {
    return validateTemplate(template);
  },

  async loadDevTemplate(path: string): Promise<TemplateV2> {
    const template = await loadTemplateFromPath(
      `${DEV_TEMPLATE_PATH}${path}/template.json`
    );

    if (!template) {
      throw new Error(`Dev template not found: ${path}`);
    }

    template.status = 'development';
    templateCache.set(template.id, template);

    return template;
  },

  watchDevTemplates(callback: (templates: TemplateV2[]) => void): () => void {
    // Vite HMR Integration (wenn verfügbar)
    if (typeof import.meta !== 'undefined' && import.meta.hot) {
      const handleHmr = async () => {
        const devTemplates = await loadDevTemplates();
        callback(devTemplates);
      };

      // Initial load
      handleHmr();

      // Watch for changes - dies funktioniert nur wenn Vite konfiguriert ist
      // In der Praxis würde man hier File-System-Watching oder WebSocket nutzen
      return () => {
        // Cleanup (keine echte Implementierung ohne Vite Plugin)
      };
    }

    return () => {};
  },
};

/**
 * Registriere ein Template manuell (für Tests oder dynamische Templates)
 */
export function registerTemplate(template: TemplateV2): void {
  templateCache.set(template.id, template);
}

/**
 * Entferne ein Template aus dem Cache
 */
export function unregisterTemplate(id: string): void {
  templateCache.delete(id);
}

/**
 * Leere den Template-Cache
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  templatesLoaded = false;
}

/**
 * Prüfe ob ein Template existiert
 */
export async function hasTemplate(id: string): Promise<boolean> {
  await loadStaticTemplates();
  return templateCache.has(id);
}

/**
 * Hole das Default-Template für eine Sprache
 */
export function getDefaultTemplateId(): string {
  return 'classic-time-voucher';
}
