import { storage } from './storage';
import { AuthService } from './auth';

export async function initializeAdmin() {
  try {
    // Check if any admin users exist
    const existingUsers = await storage.getAllUsers();
    const adminExists = existingUsers.some(user => user.role === 'admin');
    
    if (adminExists) {
      console.log('Admin user already exists');
      return;
    }

    // Create default admin user
    const adminData = {
      email: 'admin@agentflow.com',
      password: 'AgentFlow2025!',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin' as const,
      companyName: 'AgentFlow',
      phone: null
    };

    const admin = await storage.createUser(adminData);
    
    // Update status to approved and set approval fields
    await storage.approveUser(admin.id, admin.id);
    
    console.log('✅ Default admin user created:');
    console.log('   Email: admin@agentflow.com');
    console.log('   Password: AgentFlow2025!');
    console.log('   Please change the password after first login');
    
    return admin;
  } catch (error) {
    console.error('Failed to initialize admin user:', error);
    throw error;
  }
}

export async function createInitialAdminIfNeeded() {
  const users = await storage.getAllUsers();
  if (users.length === 0) {
    return await initializeAdmin();
  }
  return null;
}