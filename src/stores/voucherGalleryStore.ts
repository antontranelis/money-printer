import { create } from 'zustand';
import type { SavedVoucher, VoucherVersion, StoredValidationResult } from '../types/voucherGallery';
import { validateVoucherImage } from '../services/voucherImageProcessor';
import {
  isOpfsAvailable,
  storeVoucherImages,
  retrieveVoucherImages,
  deleteVoucherImages,
  clearAllVoucherImages,
  storeVersionImages,
  retrieveVersionImages,
} from './opfsStorage';

const DB_NAME = 'voucher-gallery-db';
const STORE_NAME = 'vouchers';
const DB_VERSION = 2; // Bumped version for OPFS migration

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Metadata stored in IndexedDB (without large image data when OPFS is used)
 */
interface VoucherMetadata {
  id: string;
  createdAt: number;
  styleContext: 'spiritual' | 'business';
  originalPrompt?: string;
  generationConfig?: SavedVoucher['generationConfig'];
  validationResult?: StoredValidationResult;
  /** Flag indicating images are stored in OPFS */
  imagesInOpfs: boolean;
  /** Version metadata (without image data when OPFS is used) */
  versionTimestamps?: number[];
  /** Legacy: full image data (for non-OPFS vouchers) */
  originalBase64?: string;
  frontBase64?: string;
  backBase64?: string;
  thumbnailBase64?: string;
  versions?: VoucherVersion[];
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // Note: We don't migrate data here - migration happens on load
      console.log(`[VoucherGallery] DB upgraded from v${event.oldVersion} to v${event.newVersion}`);
    };
  });

  return dbPromise;
}

async function getAllMetadata(): Promise<VoucherMetadata[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Newest first
      const results: VoucherMetadata[] = [];

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  } catch (e) {
    console.error('[VoucherGallery] Failed to get metadata:', e);
    return [];
  }
}

async function saveMetadata(metadata: VoucherMetadata): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(metadata);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error('[VoucherGallery] Failed to save metadata:', e);
    throw e;
  }
}

async function deleteMetadata(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error('[VoucherGallery] Failed to delete metadata:', e);
  }
}

async function clearAllMetadata(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error('[VoucherGallery] Failed to clear metadata:', e);
  }
}

/**
 * Load a full voucher by combining metadata with OPFS images
 */
async function loadFullVoucher(metadata: VoucherMetadata): Promise<SavedVoucher | null> {
  // If images are not in OPFS, return as-is (legacy voucher)
  if (!metadata.imagesInOpfs) {
    return {
      id: metadata.id,
      createdAt: metadata.createdAt,
      styleContext: metadata.styleContext,
      originalPrompt: metadata.originalPrompt,
      generationConfig: metadata.generationConfig,
      validationResult: metadata.validationResult,
      originalBase64: metadata.originalBase64 || '',
      frontBase64: metadata.frontBase64 || '',
      backBase64: metadata.backBase64 || '',
      thumbnailBase64: metadata.thumbnailBase64 || '',
      versions: metadata.versions,
    };
  }

  // Load images from OPFS
  const images = await retrieveVoucherImages(metadata.id);
  if (!images) {
    console.error(`[VoucherGallery] Failed to load images for voucher ${metadata.id}`);
    return null;
  }

  // Load version images if there are versions
  let versions: VoucherVersion[] | undefined;
  if (metadata.versionTimestamps && metadata.versionTimestamps.length > 0) {
    versions = [];
    for (const timestamp of metadata.versionTimestamps) {
      const versionImages = await retrieveVersionImages(metadata.id, timestamp);
      if (versionImages) {
        versions.push({
          timestamp,
          prompt: '', // Prompt not stored separately currently
          ...versionImages,
        });
      }
    }
  }

  return {
    id: metadata.id,
    createdAt: metadata.createdAt,
    styleContext: metadata.styleContext,
    originalPrompt: metadata.originalPrompt,
    generationConfig: metadata.generationConfig,
    validationResult: metadata.validationResult,
    ...images,
    versions,
  };
}

interface VoucherGalleryState {
  vouchers: SavedVoucher[];
  isLoading: boolean;
  isInitialized: boolean;
  /** Currently active voucher ID (for refinements) */
  activeVoucherId: string | null;
  /** Whether OPFS is available */
  opfsAvailable: boolean;
  /** Whether OPFS migration is in progress */
  isMigratingToOpfs: boolean;

  // Actions
  loadVouchers: () => Promise<void>;
  addVoucher: (voucher: Omit<SavedVoucher, 'id' | 'createdAt' | 'thumbnailBase64'>) => Promise<string>;
  /** Add a new version to an existing voucher */
  addVersionToVoucher: (id: string, version: Omit<VoucherVersion, 'timestamp'>) => Promise<void>;
  removeVoucher: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setActiveVoucherId: (id: string | null) => void;
  /** Migrate legacy vouchers (IndexedDB only) to OPFS */
  migrateToOpfs: () => Promise<void>;
  /** Migrate legacy vouchers without validation result */
  migrateLegacyVouchers: () => Promise<void>;
}

/**
 * Generate a thumbnail from a base64 image
 */
async function generateThumbnail(base64: string, maxSize: number = 400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Use JPEG for smaller thumbnails
        resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/png;base64,${base64}`;
  });
}

/**
 * Validate voucher image and return stored result
 */
async function computeValidationResult(originalBase64: string): Promise<StoredValidationResult> {
  try {
    const result = await validateVoucherImage(originalBase64);
    return {
      isValid: result.isValid,
      hasBlackBackground: result.hasBlackBackground,
      sidesAreEqualSize: result.sidesAreEqualSize,
      hasNoBlackBorders: result.hasNoBlackBorders,
      frontDimensions: result.frontDimensions,
      backDimensions: result.backDimensions,
    };
  } catch (e) {
    console.error('[VoucherGallery] Validation failed:', e);
    return {
      isValid: false,
      hasBlackBackground: false,
      sidesAreEqualSize: false,
      hasNoBlackBorders: false,
      frontDimensions: { width: 0, height: 0 },
      backDimensions: { width: 0, height: 0 },
    };
  }
}

export const useVoucherGalleryStore = create<VoucherGalleryState>((set, get) => ({
  vouchers: [],
  isLoading: false,
  isInitialized: false,
  activeVoucherId: null,
  opfsAvailable: isOpfsAvailable(),
  isMigratingToOpfs: false,

  loadVouchers: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    // Request persistent storage for higher quota (up to 60% of disk space)
    if (navigator.storage?.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[VoucherGallery] Persistent storage ${granted ? 'granted' : 'denied'}`);
      }
    }

    try {
      const metadataList = await getAllMetadata();
      const vouchers: SavedVoucher[] = [];

      // Load vouchers with their images
      for (const metadata of metadataList) {
        const voucher = await loadFullVoucher(metadata);
        if (voucher) {
          vouchers.push(voucher);
        }
      }

      set({ vouchers, isLoading: false, isInitialized: true });

      // Auto-migrate to OPFS if available and there are legacy vouchers
      const hasLegacyVouchers = metadataList.some((m) => !m.imagesInOpfs);
      if (isOpfsAvailable() && hasLegacyVouchers) {
        console.log('[VoucherGallery] Starting OPFS migration...');
        // Don't await - run in background
        get().migrateToOpfs();
      }
    } catch (e) {
      console.error('[VoucherGallery] Failed to load vouchers:', e);
      set({ isLoading: false, isInitialized: true });
    }
  },

  addVoucher: async (voucherData) => {
    const id = `voucher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const useOpfs = isOpfsAvailable();

    // Generate thumbnail and validate in parallel
    const [thumbnailBase64, validationResult] = await Promise.all([
      generateThumbnail(voucherData.frontBase64),
      computeValidationResult(voucherData.originalBase64),
    ]);

    const timestamp = Date.now();

    // Store images in OPFS if available
    if (useOpfs) {
      await storeVoucherImages(id, {
        originalBase64: voucherData.originalBase64,
        frontBase64: voucherData.frontBase64,
        backBase64: voucherData.backBase64,
        thumbnailBase64,
      });

      // Store version images
      await storeVersionImages(id, timestamp, {
        originalBase64: voucherData.originalBase64,
        frontBase64: voucherData.frontBase64,
        backBase64: voucherData.backBase64,
      });

      // Save metadata only (no images)
      const metadata: VoucherMetadata = {
        id,
        createdAt: timestamp,
        styleContext: voucherData.styleContext,
        originalPrompt: voucherData.originalPrompt,
        generationConfig: voucherData.generationConfig,
        validationResult,
        imagesInOpfs: true,
        versionTimestamps: [timestamp],
      };
      await saveMetadata(metadata);
    } else {
      // Fallback: Store everything in IndexedDB (legacy)
      const initialVersion: VoucherVersion = {
        timestamp,
        prompt: '',
        originalBase64: voucherData.originalBase64,
        frontBase64: voucherData.frontBase64,
        backBase64: voucherData.backBase64,
      };

      const metadata: VoucherMetadata = {
        id,
        createdAt: timestamp,
        styleContext: voucherData.styleContext,
        originalPrompt: voucherData.originalPrompt,
        generationConfig: voucherData.generationConfig,
        validationResult,
        imagesInOpfs: false,
        originalBase64: voucherData.originalBase64,
        frontBase64: voucherData.frontBase64,
        backBase64: voucherData.backBase64,
        thumbnailBase64,
        versions: [initialVersion],
      };
      await saveMetadata(metadata);
    }

    // Create the full voucher object for state
    const voucher: SavedVoucher = {
      ...voucherData,
      id,
      createdAt: timestamp,
      thumbnailBase64,
      versions: [{
        timestamp,
        prompt: '',
        originalBase64: voucherData.originalBase64,
        frontBase64: voucherData.frontBase64,
        backBase64: voucherData.backBase64,
      }],
      validationResult,
    };

    set((state) => ({
      vouchers: [voucher, ...state.vouchers],
      activeVoucherId: id,
    }));

    return id;
  },

  addVersionToVoucher: async (id, versionData) => {
    const vouchers = get().vouchers;
    const voucher = vouchers.find((v) => v.id === id);

    if (!voucher) {
      console.error('[VoucherGalleryStore] Voucher not found:', id);
      return;
    }

    const useOpfs = isOpfsAvailable();
    const timestamp = Date.now();

    // Generate thumbnail and validate in parallel
    const [thumbnailBase64, validationResult] = await Promise.all([
      generateThumbnail(versionData.frontBase64),
      computeValidationResult(versionData.originalBase64),
    ]);

    if (useOpfs) {
      // Update current images in OPFS
      await storeVoucherImages(id, {
        originalBase64: versionData.originalBase64,
        frontBase64: versionData.frontBase64,
        backBase64: versionData.backBase64,
        thumbnailBase64,
      });

      // Store version images
      await storeVersionImages(id, timestamp, {
        originalBase64: versionData.originalBase64,
        frontBase64: versionData.frontBase64,
        backBase64: versionData.backBase64,
      });

      // Get existing metadata and update
      const metadataList = await getAllMetadata();
      const existingMetadata = metadataList.find((m) => m.id === id);

      const metadata: VoucherMetadata = {
        id,
        createdAt: voucher.createdAt,
        styleContext: voucher.styleContext,
        originalPrompt: voucher.originalPrompt,
        generationConfig: voucher.generationConfig,
        validationResult,
        imagesInOpfs: true,
        versionTimestamps: [
          ...(existingMetadata?.versionTimestamps || []),
          timestamp,
        ],
      };
      await saveMetadata(metadata);
    } else {
      // Fallback: Store in IndexedDB
      const newVersion: VoucherVersion = {
        ...versionData,
        timestamp,
      };

      const metadata: VoucherMetadata = {
        id,
        createdAt: voucher.createdAt,
        styleContext: voucher.styleContext,
        originalPrompt: voucher.originalPrompt,
        generationConfig: voucher.generationConfig,
        validationResult,
        imagesInOpfs: false,
        originalBase64: versionData.originalBase64,
        frontBase64: versionData.frontBase64,
        backBase64: versionData.backBase64,
        thumbnailBase64,
        versions: [...(voucher.versions || []), newVersion],
      };
      await saveMetadata(metadata);
    }

    // Update state
    const updatedVoucher: SavedVoucher = {
      ...voucher,
      originalBase64: versionData.originalBase64,
      frontBase64: versionData.frontBase64,
      backBase64: versionData.backBase64,
      thumbnailBase64,
      versions: [...(voucher.versions || []), {
        timestamp,
        prompt: versionData.prompt,
        originalBase64: versionData.originalBase64,
        frontBase64: versionData.frontBase64,
        backBase64: versionData.backBase64,
      }],
      validationResult,
    };

    set((state) => ({
      vouchers: state.vouchers.map((v) => v.id === id ? updatedVoucher : v),
    }));
  },

  removeVoucher: async (id) => {
    // Delete from OPFS if available
    if (isOpfsAvailable()) {
      await deleteVoucherImages(id);
    }

    // Delete metadata from IndexedDB
    await deleteMetadata(id);

    set((state) => ({
      vouchers: state.vouchers.filter((v) => v.id !== id),
      activeVoucherId: state.activeVoucherId === id ? null : state.activeVoucherId,
    }));
  },

  clearAll: async () => {
    // Clear OPFS images
    if (isOpfsAvailable()) {
      await clearAllVoucherImages();
    }

    // Clear IndexedDB metadata
    await clearAllMetadata();

    set({ vouchers: [], activeVoucherId: null });
  },

  setActiveVoucherId: (id) => {
    set({ activeVoucherId: id });
  },

  migrateToOpfs: async () => {
    // Prevent concurrent migrations
    if (get().isMigratingToOpfs) {
      console.log('[VoucherGallery] OPFS migration already in progress, skipping');
      return;
    }

    if (!isOpfsAvailable()) {
      console.log('[VoucherGallery] OPFS not available, skipping migration');
      return;
    }

    set({ isMigratingToOpfs: true });

    const metadataList = await getAllMetadata();
    const legacyVouchers = metadataList.filter((m) => !m.imagesInOpfs);

    if (legacyVouchers.length === 0) {
      console.log('[VoucherGallery] No legacy vouchers to migrate');
      set({ isMigratingToOpfs: false });
      return;
    }

    console.log(`[VoucherGallery] Migrating ${legacyVouchers.length} vouchers to OPFS...`);

    for (const metadata of legacyVouchers) {
      try {
        // Skip if no images
        if (!metadata.originalBase64 || !metadata.frontBase64 || !metadata.backBase64 || !metadata.thumbnailBase64) {
          console.warn(`[VoucherGallery] Skipping voucher ${metadata.id} - missing images`);
          continue;
        }

        // Store images in OPFS
        await storeVoucherImages(metadata.id, {
          originalBase64: metadata.originalBase64,
          frontBase64: metadata.frontBase64,
          backBase64: metadata.backBase64,
          thumbnailBase64: metadata.thumbnailBase64,
        });

        // Store version images
        const versionTimestamps: number[] = [];
        if (metadata.versions) {
          for (const version of metadata.versions) {
            await storeVersionImages(metadata.id, version.timestamp, {
              originalBase64: version.originalBase64,
              frontBase64: version.frontBase64,
              backBase64: version.backBase64,
            });
            versionTimestamps.push(version.timestamp);
          }
        }

        // Update metadata (remove images)
        const newMetadata: VoucherMetadata = {
          id: metadata.id,
          createdAt: metadata.createdAt,
          styleContext: metadata.styleContext,
          originalPrompt: metadata.originalPrompt,
          generationConfig: metadata.generationConfig,
          validationResult: metadata.validationResult,
          imagesInOpfs: true,
          versionTimestamps,
          // Remove image data
          originalBase64: undefined,
          frontBase64: undefined,
          backBase64: undefined,
          thumbnailBase64: undefined,
          versions: undefined,
        };
        await saveMetadata(newMetadata);

        console.log(`[VoucherGallery] Migrated voucher ${metadata.id} to OPFS`);
      } catch (e) {
        console.error(`[VoucherGallery] Failed to migrate voucher ${metadata.id}:`, e);
      }
    }

    set({ isMigratingToOpfs: false });
    console.log('[VoucherGallery] OPFS migration complete');
  },

  migrateLegacyVouchers: async () => {
    const vouchers = get().vouchers;
    // Find vouchers without validation result OR without dimension data (legacy format)
    const legacyVouchers = vouchers.filter((v) =>
      !v.validationResult ||
      !v.validationResult.frontDimensions ||
      !v.validationResult.backDimensions
    );

    if (legacyVouchers.length === 0) return;

    console.log(`[VoucherGallery] Validating ${legacyVouchers.length} legacy vouchers...`);

    for (const voucher of legacyVouchers) {
      try {
        const validationResult = await computeValidationResult(voucher.originalBase64);

        // Update in-memory state
        set((state) => ({
          vouchers: state.vouchers.map((v) =>
            v.id === voucher.id ? { ...v, validationResult } : v
          ),
        }));

        // Update metadata in IndexedDB
        const metadataList = await getAllMetadata();
        const metadata = metadataList.find((m) => m.id === voucher.id);
        if (metadata) {
          await saveMetadata({ ...metadata, validationResult });
        }
      } catch (e) {
        console.error(`[VoucherGallery] Failed to validate voucher ${voucher.id}:`, e);
      }
    }

    console.log('[VoucherGallery] Legacy validation complete');
  },
}));
