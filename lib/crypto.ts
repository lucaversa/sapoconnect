const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

export async function encrypt(data: string, deviceId: string): Promise<{
  encrypted: string;
  salt: string;
  iv: string;
}> {
  const encoder = new TextEncoder();
  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKey(deviceId, salt);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
    },
    key,
    encoder.encode(data)
  );

  return {
    encrypted: arrayBufferToBase64(encryptedData),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
  };
}

export async function decrypt(
  encrypted: string,
  salt: string,
  iv: string,
  deviceId: string
): Promise<string> {
  const decoder = new TextDecoder();
  const key = await deriveKey(deviceId, base64ToArrayBuffer(salt));

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: base64ToArrayBuffer(iv).buffer as ArrayBuffer,
    },
    key,
    base64ToArrayBuffer(encrypted).buffer as ArrayBuffer
  );

  return decoder.decode(decryptedData);
}

const DEVICE_ID_KEY = 'sapoconnect_device_id';

export function getDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}

export function setDeviceId(deviceId: string): void {
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
}

export function getOrCreateDeviceId(): string {
  let deviceId = getDeviceId();

  if (!deviceId) {
    deviceId = generateRandomId();
    setDeviceId(deviceId);
  }

  return deviceId;
}

function generateRandomId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array);
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
