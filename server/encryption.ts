import crypto from 'crypto';

// Generate a consistent encryption key from environment or use a default for development
const ENCRYPTION_KEY = process.env.WIDGET_ENCRYPTION_KEY || 'AgentFlow2025SecretKey32Characters!';
const ALGORITHM = 'aes-256-gcm';

export function encryptWidgetData(data: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // Fallback to unencrypted in case of error
  }
}

export function decryptWidgetData(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      return encryptedData; // Assume it's already decrypted
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData; // Return original if decryption fails
  }
}

// Helper function to create secure widget configuration
export function createSecureWidgetConfig(apiKey: string, config: any): string {
  const widgetData = {
    apiKey,
    position: config.position || 'bottom-right',
    color: config.color || '#25D366',
    welcomeMessage: config.welcomeMessage || 'Hi! How can I help?',
    timestamp: Date.now() // Add timestamp for additional security
  };
  
  return encryptWidgetData(JSON.stringify(widgetData));
}