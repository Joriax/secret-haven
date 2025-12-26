import { useState, useEffect, useCallback } from 'react';

interface BiometricState {
  isAvailable: boolean;
  isEnabled: boolean;
  credentialId: string | null;
}

export const useBiometric = () => {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    isEnabled: false,
    credentialId: null,
  });

  // Check if WebAuthn is available
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!window.PublicKeyCredential) {
      return false;
    }

    try {
      // Check if platform authenticator (biometric) is available
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const isAvailable = await checkAvailability();
      const storedCredentialId = localStorage.getItem('vault_biometric_credential');
      const isEnabled = localStorage.getItem('vault_biometric_enabled') === 'true';

      setState({
        isAvailable,
        isEnabled: isAvailable && isEnabled && !!storedCredentialId,
        credentialId: storedCredentialId,
      });
    };
    init();
  }, [checkAvailability]);

  // Generate a random challenge
  const generateChallenge = (): ArrayBuffer => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return array.buffer as ArrayBuffer;
  };

  // Convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Convert Base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  };

  // Register biometric
  const register = async (userId: string): Promise<boolean> => {
    if (!state.isAvailable) {
      return false;
    }

    try {
      const challenge = generateChallenge();
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Private Vault',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId).buffer as ArrayBuffer,
            name: 'vault-user',
            displayName: 'Vault User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential;

      if (credential) {
        const credentialId = arrayBufferToBase64(credential.rawId);
        localStorage.setItem('vault_biometric_credential', credentialId);
        localStorage.setItem('vault_biometric_user', userId);
        localStorage.setItem('vault_biometric_enabled', 'true');
        
        setState(prev => ({
          ...prev,
          isEnabled: true,
          credentialId,
        }));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Biometric registration error:', error);
      return false;
    }
  };

  // Authenticate with biometric
  const authenticate = async (): Promise<string | null> => {
    if (!state.isEnabled || !state.credentialId) {
      return null;
    }

    try {
      const challenge = generateChallenge();
      
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: base64ToArrayBuffer(state.credentialId),
            type: 'public-key',
            transports: ['internal'],
          }],
          userVerification: 'required',
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (credential) {
        // Return the stored userId
        return localStorage.getItem('vault_biometric_user');
      }
      return null;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return null;
    }
  };

  // Disable biometric
  const disable = useCallback(() => {
    localStorage.removeItem('vault_biometric_credential');
    localStorage.removeItem('vault_biometric_user');
    localStorage.removeItem('vault_biometric_enabled');
    
    setState(prev => ({
      ...prev,
      isEnabled: false,
      credentialId: null,
    }));
  }, []);

  return {
    isAvailable: state.isAvailable,
    isEnabled: state.isEnabled,
    register,
    authenticate,
    disable,
  };
};
