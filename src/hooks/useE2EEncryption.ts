import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface EncryptionSettings {
  enabled: boolean;
  autoEncrypt: boolean;
  masterKeyHash: string | null;
}

// AES-256-GCM encryption utilities
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 310000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(c => c.charCodeAt(0))
  );

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return decoder.decode(decrypted);
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export function useE2EEncryption() {
  const { userId } = useAuth();
  const [settings, setSettings] = useState<EncryptionSettings>({
    enabled: false,
    autoEncrypt: false,
    masterKeyHash: null,
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [salt, setSalt] = useState<Uint8Array | null>(null);

  // Load settings
  useEffect(() => {
    if (!userId) return;
    
    const saved = localStorage.getItem(`e2e-settings-${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        
        // Load salt if exists
        const savedSalt = localStorage.getItem(`e2e-salt-${userId}`);
        if (savedSalt) {
          setSalt(new Uint8Array(JSON.parse(savedSalt)));
        }
      } catch {}
    }
  }, [userId]);

  // Save settings
  const saveSettings = useCallback((newSettings: Partial<EncryptionSettings>) => {
    if (!userId) return;
    
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(`e2e-settings-${userId}`, JSON.stringify(updated));
  }, [userId, settings]);

  // Setup master password
  const setupMasterPassword = useCallback(async (password: string) => {
    if (!userId) return false;

    try {
      // Generate new salt
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      setSalt(newSalt);
      localStorage.setItem(`e2e-salt-${userId}`, JSON.stringify(Array.from(newSalt)));

      // Derive key
      const key = await deriveKey(password, newSalt);
      setDerivedKey(key);

      // Hash password for verification
      const hash = await hashPassword(password);
      
      saveSettings({
        enabled: true,
        masterKeyHash: hash,
      });

      setIsUnlocked(true);
      return true;
    } catch (error) {
      console.error('Error setting up E2E encryption:', error);
      return false;
    }
  }, [userId, saveSettings]);

  // Unlock with password
  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (!userId || !salt || !settings.masterKeyHash) return false;

    try {
      // Verify password
      const hash = await hashPassword(password);
      if (hash !== settings.masterKeyHash) {
        return false;
      }

      // Derive key
      const key = await deriveKey(password, salt);
      setDerivedKey(key);
      setIsUnlocked(true);

      return true;
    } catch (error) {
      console.error('Error unlocking E2E encryption:', error);
      return false;
    }
  }, [userId, salt, settings.masterKeyHash]);

  // Lock
  const lock = useCallback(() => {
    setDerivedKey(null);
    setIsUnlocked(false);
  }, []);

  // Encrypt data
  const encrypt = useCallback(async (data: string): Promise<string | null> => {
    if (!derivedKey) return null;
    
    try {
      return await encryptData(data, derivedKey);
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }, [derivedKey]);

  // Decrypt data
  const decrypt = useCallback(async (encryptedData: string): Promise<string | null> => {
    if (!derivedKey) return null;
    
    try {
      return await decryptData(encryptedData, derivedKey);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }, [derivedKey]);

  // Change master password
  const changeMasterPassword = useCallback(async (
    currentPassword: string, 
    newPassword: string
  ): Promise<boolean> => {
    if (!userId) return false;

    // Verify current password
    const isValid = await unlock(currentPassword);
    if (!isValid) return false;

    // Setup new password
    return setupMasterPassword(newPassword);
  }, [userId, unlock, setupMasterPassword]);

  // Disable E2E encryption
  const disable = useCallback(() => {
    if (!userId) return;
    
    setSettings({
      enabled: false,
      autoEncrypt: false,
      masterKeyHash: null,
    });
    localStorage.removeItem(`e2e-settings-${userId}`);
    localStorage.removeItem(`e2e-salt-${userId}`);
    setDerivedKey(null);
    setSalt(null);
    setIsUnlocked(false);
  }, [userId]);

  return {
    settings,
    isUnlocked,
    isEnabled: settings.enabled,
    setupMasterPassword,
    unlock,
    lock,
    encrypt,
    decrypt,
    changeMasterPassword,
    disable,
    setAutoEncrypt: (enabled: boolean) => saveSettings({ autoEncrypt: enabled }),
  };
}
