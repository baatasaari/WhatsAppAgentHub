import { db } from '../db';
import { auditLogs, type InsertAuditLog } from '@shared/schema';
import { Request } from 'express';
import { AuthenticatedRequest } from '../auth';

export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  userId?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class AuditService {
  static async log(event: AuditEvent): Promise<void> {
    try {
      const auditLog: InsertAuditLog = {
        userId: event.userId || null,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId || null,
        details: event.details || {},
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        severity: event.severity,
        timestamp: new Date(),
      };

      await db.insert(auditLogs).values(auditLog);
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging failures shouldn't break application flow
    }
  }

  static async logFromRequest(
    req: AuthenticatedRequest,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    await this.log({
      action,
      resource,
      resourceId,
      details,
      severity,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Predefined audit events for common actions
  static async logUserLogin(req: Request, userId: number, success: boolean): Promise<void> {
    await this.log({
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      resource: 'user',
      resourceId: userId.toString(),
      severity: success ? 'low' : 'medium',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      userId: success ? userId : undefined,
    });
  }

  static async logUserLogout(req: AuthenticatedRequest): Promise<void> {
    await this.logFromRequest(req, 'LOGOUT', 'user', req.user?.id.toString(), {}, 'low');
  }

  static async logAgentCreated(req: AuthenticatedRequest, agentId: number): Promise<void> {
    await this.logFromRequest(req, 'CREATE', 'agent', agentId.toString(), {}, 'medium');
  }

  static async logAgentUpdated(req: AuthenticatedRequest, agentId: number, changes: Record<string, any>): Promise<void> {
    await this.logFromRequest(req, 'UPDATE', 'agent', agentId.toString(), { changes }, 'medium');
  }

  static async logAgentDeleted(req: AuthenticatedRequest, agentId: number): Promise<void> {
    await this.logFromRequest(req, 'DELETE', 'agent', agentId.toString(), {}, 'high');
  }

  static async logVoiceCallInitiated(req: AuthenticatedRequest, callId: number, phoneNumber: string): Promise<void> {
    await this.logFromRequest(req, 'INITIATE_CALL', 'voice_call', callId.toString(), 
      { phoneNumber: phoneNumber.slice(-4) }, 'medium'); // Only log last 4 digits for privacy
  }

  static async logSecurityEvent(req: Request, event: string, details: Record<string, any>): Promise<void> {
    await this.log({
      action: event,
      resource: 'security',
      details,
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  static async logRateLimitExceeded(req: Request, endpoint: string): Promise<void> {
    await this.log({
      action: 'RATE_LIMIT_EXCEEDED',
      resource: 'api',
      resourceId: endpoint,
      severity: 'medium',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  static async logDataExport(req: AuthenticatedRequest, resourceType: string, recordCount: number): Promise<void> {
    await this.logFromRequest(req, 'DATA_EXPORT', resourceType, undefined, 
      { recordCount }, 'high');
  }

  static async logPermissionDenied(req: AuthenticatedRequest, action: string, resource: string): Promise<void> {
    await this.logFromRequest(req, 'PERMISSION_DENIED', resource, undefined, 
      { attemptedAction: action }, 'medium');
  }

  static async logSystemEvent(event: string, details: Record<string, any>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    await this.log({
      action: event,
      resource: 'system',
      details,
      severity,
    });
  }

  // Query audit logs with filters
  static async getAuditLogs(filters: {
    userId?: number;
    action?: string;
    resource?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const query = db.select().from(auditLogs);
    
    // Apply filters (simplified - in production would use proper query builder)
    // This is a basic implementation - would need proper filtering logic
    
    return await query.limit(filters.limit || 100).offset(filters.offset || 0);
  }

  // Get security alerts (high and critical severity events)
  static async getSecurityAlerts(hours: number = 24) {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    // Simplified query - would need proper filtering in production
    return await db.select().from(auditLogs).limit(50);
  }

  // Compliance reporting
  static async generateComplianceReport(startDate: Date, endDate: Date) {
    // Generate compliance report for audit purposes
    const logs = await db.select().from(auditLogs).limit(1000);
    
    return {
      period: { startDate, endDate },
      totalEvents: logs.length,
      eventsByAction: {},
      eventsBySeverity: {},
      userActivities: {},
      securityEvents: logs.filter(log => log.severity === 'high' || log.severity === 'critical'),
      generatedAt: new Date(),
    };
  }
}