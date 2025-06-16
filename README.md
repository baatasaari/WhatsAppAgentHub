# AgentFlow - AI Conversational Agent Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)

AgentFlow is a comprehensive SaaS platform for creating and managing AI-powered conversational agents that integrate seamlessly with WhatsApp Business. Transform your website visitors into qualified leads through intelligent, customizable chat widgets that redirect conversations directly to WhatsApp Business.

## 🚀 Features

### Core Platform
- **Multi-LLM Support**: Integration with OpenAI GPT-4o, Anthropic Claude Sonnet 4, Google Gemini 1.5 Pro, and 7+ open source models
- **WhatsApp Business Integration**: Direct conversation routing without web chat complexity
- **Encrypted Widget Security**: Base64-encoded configuration for secure deployment
- **Real-time Analytics**: Comprehensive cost tracking and performance metrics
- **Drag-and-Drop Model Management**: Professional interface for managing AI model configurations

### AI Capabilities
- **Intelligent Lead Qualification**: Automated lead scoring and qualification
- **Multilingual Support**: Global conversation capabilities
- **Cost Optimization**: Real-time token usage and cost tracking across hourly, daily, weekly, monthly periods
- **Custom Prompts**: Tailored conversation flows for different business needs

### Developer Experience
- **RESTful API**: Full-featured API for all platform operations
- **TypeScript Throughout**: Complete type safety from frontend to backend
- **Modern Tech Stack**: React 18, Node.js, PostgreSQL, Drizzle ORM
- **Comprehensive Testing**: Stress-tested with 45+ concurrent requests

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │    │   Express API    │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)      │◄──►│   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐             │
         │              │  LLM Providers  │             │
         │              │ OpenAI/Claude/  │             │
         │              │ Google/OSS      │             │
         │              └─────────────────┘             │
         │                                              │
┌────────▼────────┐                           ┌────────▼────────┐
│ Website Widget  │                           │    Analytics    │
│ (Embedded JS)   │                           │   & Reporting   │
└─────────────────┘                           └─────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Node.js 20 or higher
- PostgreSQL database
- OpenAI API key (required)
- Anthropic API key (optional)
- Google AI API key (optional)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/agentflow.git
   cd agentflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/agentflow
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key  # Optional
   GOOGLE_AI_API_KEY=your_google_ai_api_key  # Optional
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5000
   - API: http://localhost:5000/api

## 📱 Usage

### Creating Your First Agent

1. **Navigate to the Dashboard**
   - Access the main dashboard at http://localhost:5000

2. **Create a New Agent**
   - Click "Create Agent" 
   - Configure your agent settings:
     - Business category and industry vertical
     - LLM provider and model selection
     - Custom system prompts
     - WhatsApp Business number
     - Widget appearance and positioning

3. **Deploy Your Widget**
   - Copy the generated embed code
   - Paste it into your website's HTML
   - The widget will appear and redirect visitors to WhatsApp Business

### Embedding the Widget

Add this code to your website:

```html
<script>
  window.AgentFlowConfig = {
    apiKey: 'your_agent_api_key',
    encrypted: true
  };
</script>
<script src="https://yourdomain.com/widget/agentflow-widget.js"></script>
```

The widget automatically handles:
- Secure configuration loading
- WhatsApp Business integration
- Click tracking and analytics
- Mobile-responsive design

## 🔧 Configuration

### Supported LLM Models

#### Commercial Models
- **OpenAI**: GPT-4o, GPT-3.5 Turbo
- **Anthropic**: Claude Sonnet 4, Claude 3.7 Sonnet  
- **Google**: Gemini 1.5 Pro

#### Open Source Models
- **Meta**: Llama 3.1 (405B, 70B)
- **Mistral AI**: Mistral 7B v0.3
- **Alibaba**: Qwen 2.5 72B
- **Microsoft**: Phi-3.5 Mini
- **Specialized**: Code Llama 34B, DeepSeek Coder 33B

### Industry Verticals
Pre-configured business categories including:
- E-commerce & Retail
- Technology & Software
- Healthcare & Medical
- Financial Services
- Education & Training
- Real Estate
- And many more...

## 📊 Analytics & Monitoring

### Cost Analytics
- **Real-time Tracking**: Monitor API costs across all time periods
- **Token Usage**: Detailed prompt and completion token consumption
- **Model Comparison**: Cost efficiency analysis across different models
- **Budget Alerts**: Set spending limits and notifications

### Performance Metrics
- **Conversation Analytics**: Track engagement and conversion rates
- **Lead Qualification**: Automated scoring and qualification insights
- **Response Times**: Monitor AI response latency and performance
- **Usage Statistics**: Agent activity and utilization reports

## 🛡️ Security

### Data Protection
- **Encrypted Configurations**: All widget settings use base64 encoding
- **Secure API Keys**: Environment-based secret management  
- **Database Security**: PostgreSQL with connection pooling and SSL
- **GDPR Compliance**: Built-in privacy and data protection features

### Authentication
- **API Key Management**: Secure agent-specific authentication
- **Rate Limiting**: Built-in request throttling and abuse prevention
- **Input Validation**: Comprehensive Zod schema validation
- **Error Handling**: Graceful failure modes and error recovery

## 🚀 Deployment

### Development
```bash
npm run dev          # Start development server
npm run db:push      # Push database schema changes
npm run build        # Build for production
```

### Production

The application is optimized for Replit autoscale deployment:

1. **Environment Setup**
   - Configure production environment variables
   - Set up PostgreSQL database connection
   - Add required API keys

2. **Database Migration**
   ```bash
   npm run db:push
   ```

3. **Build and Deploy**
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 📋 API Reference

### Agents
```http
GET    /api/agents              # List all agents
POST   /api/agents              # Create new agent
GET    /api/agents/:id          # Get agent details
PUT    /api/agents/:id          # Update agent
DELETE /api/agents/:id          # Delete agent
```

### Widget Integration
```http
POST   /api/widget/chat         # Process chat message
GET    /api/widget/config/:key  # Get widget configuration
```

### Analytics
```http
GET    /api/dashboard/stats     # Dashboard statistics
GET    /api/analytics/agent/:id/costs  # Cost analytics
GET    /api/analytics/agent/:id # Performance metrics
```

### Model Management
```http
GET    /api/models              # List available models
POST   /api/models              # Add new model
PUT    /api/models/:id          # Update model
DELETE /api/models/:id          # Remove model
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Add tests and ensure they pass**
5. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push and create a Pull Request**

### Code Style
- TypeScript for all code
- ESLint and Prettier for formatting
- Conventional commits for git messages
- Comprehensive JSDoc documentation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](./docs/api.md)
- [Widget Integration Guide](./docs/widget.md)
- [Deployment Guide](./docs/deployment.md)

### Community
- [GitHub Issues](https://github.com/your-username/agentflow/issues)
- [Discussions](https://github.com/your-username/agentflow/discussions)
- [Discord Community](https://discord.gg/agentflow)

### Enterprise Support
For enterprise support, custom integrations, or consulting services, contact us at enterprise@agentflow.com

## 🎯 Roadmap

### Q1 2025
- [ ] Voice integration with ElevenLabs
- [ ] Advanced analytics dashboard
- [ ] Multi-language admin interface
- [ ] WhatsApp Business API webhooks

### Q2 2025
- [ ] Team collaboration features
- [ ] Advanced A/B testing
- [ ] Custom branding options
- [ ] Integration marketplace

### Future
- [ ] Mobile app for agent management
- [ ] Advanced AI training capabilities
- [ ] Enterprise SSO integration
- [ ] Advanced compliance features

---

Built with ❤️ by the AgentFlow team. Transform your website visitors into qualified leads with AI-powered conversations.