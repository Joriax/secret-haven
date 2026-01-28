/**
 * PhantomVault Backup System v1.1
 * 
 * A robust ZIP-based backup format for Vault data with:
 * - manifest.json for metadata and table data
 * - Separate media files with parallel chunked processing
 * - AES-256-GCM encryption support
 * - Bulk database operations for performance
 * - Progress tracking with UI yielding
 */

export * from './types';
export * from './manifest';
export { exportPhantomVault, type ProgressCallback as ExportProgressCallback } from './exporter';
export { importPhantomVault, type ProgressCallback as ImportProgressCallback } from './importer';
