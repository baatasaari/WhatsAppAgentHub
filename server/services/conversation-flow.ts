import { Agent } from "@shared/schema";
import { generateChatResponse } from "./llm-providers";

export interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'condition' | 'action' | 'end';
  position: { x: number; y: number };
  data: {
    label?: string;
    message?: string;
    condition?: string;
    action?: string;
    responses?: Array<{ text: string; nextNodeId: string }>;
    fallbackMessage?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ConversationContext {
  userId: string;
  userName?: string;
  userInput: string;
  conversationCount: number;
  variables: Record<string, any>;
  leadData?: Record<string, any>;
}

export class ConversationFlowService {
  
  async executeFlow(
    agent: Agent, 
    context: ConversationContext
  ): Promise<{ message: string; nextNodeId?: string; shouldEndFlow?: boolean }> {
    
    if (!agent.flowEnabled || !agent.conversationFlow) {
      // Fall back to traditional AI response
      return await this.fallbackToAI(agent, context);
    }

    const flow = agent.conversationFlow;
    const startNode = flow.nodes.find(node => node.type === 'start');
    
    if (!startNode) {
      return await this.fallbackToAI(agent, context);
    }

    // Find the next node to execute
    let currentNode = this.findNextNode(flow, startNode.id, context);
    
    return await this.executeNode(currentNode, flow, context, agent);
  }

  private findNextNode(flow: any, currentNodeId: string, context: ConversationContext): FlowNode | null {
    // Get all edges from current node
    const outgoingEdges = flow.edges.filter((edge: FlowEdge) => edge.source === currentNodeId);
    
    if (outgoingEdges.length === 0) {
      return null;
    }

    // If only one edge, follow it
    if (outgoingEdges.length === 1) {
      return flow.nodes.find((node: FlowNode) => node.id === outgoingEdges[0].target);
    }

    // Multiple edges - need to evaluate conditions
    for (const edge of outgoingEdges) {
      if (this.evaluateEdgeCondition(edge, context)) {
        return flow.nodes.find((node: FlowNode) => node.id === edge.target);
      }
    }

    // No conditions matched, take first edge as fallback
    return flow.nodes.find((node: FlowNode) => node.id === outgoingEdges[0].target);
  }

  private evaluateEdgeCondition(edge: FlowEdge, context: ConversationContext): boolean {
    if (!edge.label) return true;

    const condition = edge.label.toLowerCase();
    const userInput = context.userInput.toLowerCase();

    // Simple condition evaluation
    if (condition.includes('yes') && (userInput.includes('yes') || userInput.includes('yeah') || userInput.includes('sure'))) {
      return true;
    }
    
    if (condition.includes('no') && (userInput.includes('no') || userInput.includes('nope') || userInput.includes('not'))) {
      return true;
    }

    if (condition.includes('help') && userInput.includes('help')) {
      return true;
    }

    if (condition.includes('buy') && (userInput.includes('buy') || userInput.includes('purchase') || userInput.includes('order'))) {
      return true;
    }

    return false;
  }

  private async executeNode(
    node: FlowNode | null, 
    flow: any, 
    context: ConversationContext, 
    agent: Agent
  ): Promise<{ message: string; nextNodeId?: string; shouldEndFlow?: boolean }> {
    
    if (!node) {
      return await this.fallbackToAI(agent, context);
    }

    switch (node.type) {
      case 'message':
        return {
          message: this.interpolateMessage(node.data.message || 'Hello!', context),
          nextNodeId: node.id
        };

      case 'condition':
        const conditionResult = this.evaluateCondition(node.data.condition || '', context);
        const nextNode = this.findNextNode(flow, node.id, context);
        
        if (nextNode) {
          return await this.executeNode(nextNode, flow, context, agent);
        }
        
        return {
          message: 'Let me think about that...',
          nextNodeId: node.id
        };

      case 'action':
        await this.executeAction(node.data.action || '', context, agent);
        const nextAfterAction = this.findNextNode(flow, node.id, context);
        
        if (nextAfterAction) {
          return await this.executeNode(nextAfterAction, flow, context, agent);
        }
        
        return {
          message: 'Action completed successfully.',
          nextNodeId: node.id
        };

      case 'end':
        return {
          message: node.data.message || 'Thank you for the conversation!',
          shouldEndFlow: true
        };

      default:
        return await this.fallbackToAI(agent, context);
    }
  }

  private interpolateMessage(message: string, context: ConversationContext): string {
    return message
      .replace(/\{user_name\}/g, context.userName || 'there')
      .replace(/\{user_input\}/g, context.userInput)
      .replace(/\{conversation_count\}/g, context.conversationCount.toString());
  }

  private evaluateCondition(condition: string, context: ConversationContext): boolean {
    try {
      const userInput = context.userInput.toLowerCase();
      
      // Simple condition parser
      if (condition.includes('contains')) {
        const match = condition.match(/contains\s+["']([^"']+)["']/);
        if (match) {
          return userInput.includes(match[1].toLowerCase());
        }
      }

      if (condition.includes('equals')) {
        const match = condition.match(/equals\s+["']([^"']+)["']/);
        if (match) {
          return userInput.trim() === match[1].toLowerCase();
        }
      }

      if (condition.includes('length >')) {
        const match = condition.match(/length\s*>\s*(\d+)/);
        if (match) {
          return userInput.length > parseInt(match[1]);
        }
      }

      return false;
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  private async executeAction(action: string, context: ConversationContext, agent: Agent): Promise<void> {
    switch (action) {
      case 'save_lead_info':
        // Save lead information
        console.log('Saving lead info for user:', context.userId);
        break;

      case 'send_email':
        // Send email notification
        console.log('Sending email for user:', context.userId);
        break;

      case 'create_ticket':
        // Create support ticket
        console.log('Creating support ticket for user:', context.userId);
        break;

      case 'schedule_callback':
        // Schedule callback
        console.log('Scheduling callback for user:', context.userId);
        break;

      case 'transfer_to_human':
        // Transfer to human agent
        console.log('Transferring to human for user:', context.userId);
        break;

      case 'update_user_profile':
        // Update user profile
        console.log('Updating user profile for user:', context.userId);
        break;

      default:
        console.log('Unknown action:', action);
    }
  }

  private async fallbackToAI(agent: Agent, context: ConversationContext): Promise<{ message: string; nextNodeId?: string; shouldEndFlow?: boolean }> {
    try {
      const messages = [
        { role: 'user', content: context.userInput, timestamp: new Date().toISOString() }
      ];

      const aiResponse = await generateChatResponse(
        agent.llmProvider,
        agent.model || 'gpt-4o',
        agent.systemPrompt,
        messages
      );

      return {
        message: aiResponse,
        shouldEndFlow: false
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      return {
        message: 'I apologize, but I\'m having trouble processing your request right now. Please try again.',
        shouldEndFlow: false
      };
    }
  }

  validateFlow(flow: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!flow.nodes || !Array.isArray(flow.nodes)) {
      errors.push('Flow must have a nodes array');
      return { isValid: false, errors };
    }

    if (!flow.edges || !Array.isArray(flow.edges)) {
      errors.push('Flow must have an edges array');
      return { isValid: false, errors };
    }

    // Check for start node
    const startNodes = flow.nodes.filter((node: FlowNode) => node.type === 'start');
    if (startNodes.length === 0) {
      errors.push('Flow must have at least one start node');
    } else if (startNodes.length > 1) {
      errors.push('Flow can only have one start node');
    }

    // Check for orphaned nodes
    const nodeIds = flow.nodes.map((node: FlowNode) => node.id);
    const connectedNodes = new Set([
      ...flow.edges.map((edge: FlowEdge) => edge.source),
      ...flow.edges.map((edge: FlowEdge) => edge.target)
    ]);

    const orphanedNodes = nodeIds.filter(id => !connectedNodes.has(id) && flow.nodes.find((n: FlowNode) => n.id === id)?.type !== 'start');
    if (orphanedNodes.length > 0) {
      errors.push(`Orphaned nodes found: ${orphanedNodes.join(', ')}`);
    }

    // Check for invalid edge references
    for (const edge of flow.edges) {
      if (!nodeIds.includes(edge.source)) {
        errors.push(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!nodeIds.includes(edge.target)) {
        errors.push(`Edge references non-existent target node: ${edge.target}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const conversationFlowService = new ConversationFlowService();