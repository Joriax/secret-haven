/**
 * PhantomVault Backup System
 * 
 * A robust ZIP-based backup format for Vault data with:
 * - manifest.json for metadata and table data
 * - Separate media files (chunked) to prevent memory issues
 * - AES-256-GCM encryption support
 * - Progress tracking for large backups
 */

export * from './types';
export * from './manifest';
export { exportPhantomVault, type ProgressCallback as ExportProgressCallback } from './exporter';
export { importPhantomVault, type ProgressCallback as ImportProgressCallback } from './importer';
