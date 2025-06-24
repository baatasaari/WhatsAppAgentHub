# AgentFlow API Reference

This document provides comprehensive documentation for the AgentFlow REST API.

## Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:5000/api
```

## Authentication

AgentFlow uses session-based authentication with JWT-style tokens.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@company.com",
    "role": "business_user",
    "status": "approved"
  },
  "sessionToken": "abc123..."
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <session_token>
```

## Agents

### List All Agents
```http
GET /api/agents
Authorization: Bearer <session_token>
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Customer Support Bot",
    "description": "Handles customer inquiries",
    "model": "gpt-4o",
    "llmProvider": "openai",
    "platformType": "whatsapp",
    "systemPrompt": "You are a helpful assistant...",
    "createdAt": "2025-06-24T10:00:00Z"
  }
]
```

### Create Agent
```http
POST /api/agents
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "name": "Sales Assistant",
  "description": "Helps with sales inquiries",
  "model": "gpt-4o",
  "llmProvider": "openai",
  "platformType": "telegram",
  "systemPrompt": "You are a sales assistant...",
  "welcomeMessage": "Hello! How can I help you today?",
  "widgetColor": "#0088CC",
  "widgetPosition": "bottom-right"
}
```

### Update Agent
```http
PUT /api/agents/:id
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "name": "Updated Agent Name",
  "systemPrompt": "Updated system prompt..."
}
```

### Delete Agent
```http
DELETE /api/agents/:id
Authorization: Bearer <session_token>
```

## AI Training

### Knowledge Base Management

#### Add Knowledge Item
```http
POST /api/agents/:id/knowledge
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "title": "Product Information",
  "content": "Our flagship product is an AI platform...",
  "category": "product",
  "tags": ["product", "features", "AI"],
  "metadata": {
    "priority": "high",
    "lastUpdated": "2025-06-24"
  }
}
```

#### Get Knowledge Items
```http
GET /api/agents/:id/knowledge
Authorization: Bearer <session_token>
```

#### Search Knowledge Base
```http
POST /api/agents/:id/knowledge/search
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "query": "product features",
  "limit": 5
}
```

### Training Sessions

#### Start Training Session
```http
POST /api/agents/:id/training
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "sessionName": "Customer Service Training",
  "trainingData": [
    {
      "input": "What are your business hours?",
      "expectedOutput": "We're open Monday-Friday 9AM-5PM EST",
      "category": "hours",
      "weight": 1
    }
  ],
  "brandVoiceConfig": {
    "tone": "professional",
    "personality": "helpful",
    "communicationStyle": "concise",
    "dosList": ["Be specific", "Provide examples"],
    "dontsList": ["Use jargon", "Be vague"]
  },
  "businessContextConfig": {
    "industry": "SaaS",
    "companySize": "startup",
    "targetAudience": "Small businesses",
    "keyProducts": ["AI Platform", "Customer Service"],
    "valueProposition": "Automate customer support"
  }
}
```

#### Get Training Session Status
```http
GET /api/training-sessions/:id/status
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "id": 1,
  "status": "training",
  "progressPercentage": 75,
  "metrics": {
    "totalExamples": 100,
    "processedExamples": 75,
    "estimatedCompletion": "2025-06-24T11:30:00Z"
  }
}
```

### Enhanced AI Responses

#### Get Enhanced Response
```http
POST /api/agents/:id/enhanced-response
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "message": "What products do you offer?",
  "context": {
    "platform": "whatsapp",
    "userId": "user123",
    "timestamp": "2025-06-24T10:00:00Z"
  }
}
```

**Response:**
```json
{
  "response": "We offer an AI-powered customer service platform...",
  "customTrainingUsed": true,
  "knowledgeUsed": [
    {
      "id": "kb1",
      "title": "Product Information",
      "relevanceScore": 0.95
    }
  ],
  "trainingExamplesUsed": [
    {
      "category": "product_inquiry",
      "similarity": 0.87
    }
  ],
  "enhancementType": "custom_trained",
  "modelVersion": "v2.1"
}
```

## Data Source Integrations

### File Imports

#### Import CSV Training Data
```http
POST /api/agents/:id/import/csv
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "csvData": "input,expected_output,category,weight\nHello,Hi there!,greeting,1\nWhat's your price?,Our pricing starts at $99/month,pricing,2"
}
```

#### Import JSON Knowledge Base
```http
POST /api/agents/:id/import/json
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "jsonData": {
    "knowledgeBase": [
      {
        "title": "Pricing Information",
        "content": "Our plans start at $99/month...",
        "category": "pricing",
        "tags": ["pricing", "plans"]
      }
    ]
  }
}
```

### External System Connections

#### Connect to CRM
```http
POST /api/agents/:id/connect/crm
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "type": "salesforce",
  "apiKey": "your_salesforce_api_key",
  "baseUrl": "your_instance.salesforce.com"
}
```

#### Connect to Help Desk
```http
POST /api/agents/:id/connect/helpdesk
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "type": "zendesk",
  "apiKey": "your_zendesk_api_key",
  "domain": "your_company.zendesk.com"
}
```

#### Import from Google Sheets
```http
POST /api/agents/:id/import/google-sheets
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A1:D100",
  "apiKey": "your_google_api_key"
}
```

## Platform Integration

### Platform Recommendations
```http
GET /api/agents/:id/platform-recommendations/:platform
Authorization: Bearer <session_token>
```

Where `:platform` is one of: `whatsapp`, `telegram`, `discord`, `facebook`, `instagram`

### Platform Analysis
```http
GET /api/agents/:id/platform-analysis/:platform
Authorization: Bearer <session_token>
```

## Analytics

### Agent Analytics
```http
GET /api/agents/:id/analytics?timeRange=7d
Authorization: Bearer <session_token>
```

Query Parameters:
- `timeRange`: `1d`, `7d`, `30d`, `90d`, `all`

### Dashboard Statistics
```http
GET /api/dashboard/stats
Authorization: Bearer <session_token>
```

### Cost Analytics
```http
GET /api/analytics/costs?period=monthly
Authorization: Bearer <session_token>
```

## User Management (Admin Only)

### List All Users
```http
GET /api/admin/users
Authorization: Bearer <admin_session_token>
```

### Approve User
```http
POST /api/admin/users/:id/approve
Authorization: Bearer <admin_session_token>
```

### Update User Role
```http
PUT /api/admin/users/:id/role
Authorization: Bearer <admin_session_token>
Content-Type: application/json

{
  "role": "business_manager"
}
```

## System Monitoring

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-24T10:00:00Z",
  "uptime": 86400,
  "database": {
    "status": "connected",
    "responseTime": "5ms"
  },
  "memory": {
    "used": "256MB",
    "free": "1.2GB"
  }
}
```

### System Metrics
```http
GET /api/metrics
Authorization: Bearer <admin_session_token>
```

### System Logs
```http
GET /api/admin/logs?level=error&limit=100
Authorization: Bearer <admin_session_token>
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

API requests are limited to:
- **Authenticated users**: 100 requests per minute
- **Admin users**: 200 requests per minute
- **AI response endpoints**: 20 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Platform Webhooks

#### WhatsApp Webhook
```http
POST /api/whatsapp/webhook
Content-Type: application/json

{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "1234567890",
                "text": {
                  "body": "Hello"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

#### Telegram Webhook
```http
POST /api/telegram/webhook
Content-Type: application/json

{
  "message": {
    "chat": {
      "id": 123456789
    },
    "text": "Hello"
  }
}
```

## SDK Examples

### Node.js
```javascript
const AgentFlow = require('@agentflow/sdk');

const client = new AgentFlow({
  apiKey: 'your_api_key',
  baseUrl: 'https://your-domain.com/api'
});

// Create an agent
const agent = await client.agents.create({
  name: 'Support Bot',
  model: 'gpt-4o',
  platformType: 'whatsapp'
});

// Get enhanced response
const response = await client.agents.getEnhancedResponse(agent.id, {
  message: 'Hello',
  context: { platform: 'whatsapp' }
});
```

### Python
```python
from agentflow import AgentFlowClient

client = AgentFlowClient(
    api_key='your_api_key',
    base_url='https://your-domain.com/api'
)

# Create agent
agent = client.agents.create(
    name='Support Bot',
    model='gpt-4o',
    platform_type='whatsapp'
)

# Get response
response = client.agents.get_enhanced_response(
    agent_id=agent.id,
    message='Hello',
    context={'platform': 'whatsapp'}
)
```