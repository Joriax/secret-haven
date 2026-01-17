// Client-side encryption utilities for secure notes and secret texts

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

// Convert string to Uint8Array
const stringToBytes = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

// Convert Uint8Array to string
const bytesToString = (bytes: Uint8Array): string => {
  return new TextDecoder().decode(bytes);
};

// Convert ArrayBuffer to base64 string
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
};

// Derive encryption key from password
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const passwordBytes = stringToBytes(password);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt text with password
export const encryptText = async (text: string, password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const textBytes = stringToBytes(text);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    textBytes.buffer as ArrayBuffer
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

  return arrayBufferToBase64(combined.buffer as ArrayBuffer);
};

// Decrypt text with password
export const decryptText = async (encryptedBase64: string, password: string): Promise<string | null> => {
  try {
    const combinedBuffer = base64ToArrayBuffer(encryptedBase64);
    const combined = new Uint8Array(combinedBuffer);
    
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encryptedData = combined.slice(SALT_LENGTH + IV_LENGTH);

    const key = await deriveKey(password, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      encryptedData.buffer as ArrayBuffer
    );

    return bytesToString(new Uint8Array(decryptedBuffer));
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

// Generate a random recovery key
export const generateRecoveryKey = (): string => {
  const segments = 4;
  const segmentLength = 6;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  
  const keyParts: string[] = [];
  for (let s = 0; s < segments; s++) {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    keyParts.push(segment);
  }
  
  return keyParts.join('-');
};

// Backup-specific encryption with versioning and integrity
export interface EncryptedBackup {
  version: string;
  encrypted: true;
  salt: number[];
  iv: number[];
  data: number[];
}

// Encrypt backup data with password using AES-GCM
export const encryptBackup = async (data: string, password: string): Promise<EncryptedBackup> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const textBytes = stringToBytes(data);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    textBytes.buffer as ArrayBuffer
  );

  return {
    version: '2.0',
    encrypted: true,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encryptedBuffer))
  };
};

// Decrypt backup data with password
export const decryptBackup = async (backup: EncryptedBackup, password: string): Promise<string | null> => {
  try {
    if (!backup.encrypted || !backup.salt || !backup.iv || !backup.data) {
      throw new Error('Invalid backup format');
    }

    const salt = new Uint8Array(backup.salt);
    const iv = new Uint8Array(backup.iv);
    const encryptedData = new Uint8Array(backup.data);

    const key = await deriveKey(password, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      encryptedData.buffer as ArrayBuffer
    );

    return bytesToString(new Uint8Array(decryptedBuffer));
  } catch (error) {
    console.error('Backup decryption failed:', error);
    return null;
  }
};

// Check if a backup is using the new encryption format
export const isNewEncryptionFormat = (data: any): data is EncryptedBackup => {
  return data && 
    typeof data === 'object' && 
    data.version === '2.0' && 
    data.encrypted === true &&
    Array.isArray(data.salt) &&
    Array.isArray(data.iv) &&
    Array.isArray(data.data);
};

// Check if a backup is using the old (insecure) format
export const isOldEncryptionFormat = (data: any): boolean => {
  return data && 
    typeof data === 'object' && 
    data.encrypted === true &&
    typeof data.hash === 'string' &&
    typeof data.data === 'string';
};

// Decrypt old format backup (legacy support)
export const decryptOldBackup = (encryptedData: { hash: string; data: string }, password: string): string | null => {
  try {
    const pwHash = btoa(password);
    if (encryptedData.hash !== pwHash.substring(0, 8)) {
      return null; // Wrong password
    }
    return decodeURIComponent(escape(atob(encryptedData.data)));
  } catch (error) {
    console.error('Old backup decryption failed:', error);
    return null;
  }
};
