/**
 * Criptografia para sessão no servidor (Node.js/Bun)
 * Usa AES-GCM com uma chave secreta do servidor
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Obtém a chave secreta para criptografia de sessão
 * Em produção, deve vir de uma variável de ambiente
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SESSION_ENCRYPTION_KEY;
  if (!key) {
    return Buffer.from('sapoconnect-default-key-32-bytes-long!', 'utf8').slice(0, 32);
  }
  return Buffer.from(key, 'hex').slice(0, 32);
}

/**
 * Criptografa dados da sessão
 * @param data - Dados a serem criptografados
 * @returns String criptografada em formato (iv:authTag:encrypted)
 */
export function encryptSessionData(data: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Formato: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa dados da sessão
 * @param encryptedData - Dados criptografados no formato (iv:authTag:encrypted)
 * @returns Dados descriptografados
 */
export function decryptSessionData(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de dados criptografados inválido');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Serializa dados da sessão para criptografia
 */
export function serializeSessionData(data: {
  externalCookies: { aspNetSessionId: string; aspxAuth: string };
  lastExternalLoginAt: number;
}): string {
  return JSON.stringify(data);
}

/**
 * Deserializa dados da sessão após descriptografia
 */
export function deserializeSessionData(data: string): {
  externalCookies: { aspNetSessionId: string; aspxAuth: string };
  lastExternalLoginAt: number;
} {
  return JSON.parse(data);
}
