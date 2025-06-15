# AgentFlow - AI Conversational Agent Platform

## Overview

AgentFlow is a comprehensive web application for creating, managing, and deploying AI-powered conversational agents. The platform allows users to build WhatsApp-style chat widgets that can be embedded on websites to handle customer interactions, lead qualification, and sales conversations. The application features a React frontend with a Node.js/Express backend, using PostgreSQL for data persistence and Drizzle ORM for database operations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system variables

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API architecture
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL store

### Database Schema
The application uses three main entities:
- **Agents**: Core AI agent configurations including LLM settings, prompts, and widget customization
- **Conversations**: Chat session data with message history and lead qualification information
- **Analytics**: Performance metrics and conversion tracking data

## Key Components

### Agent Management System
- Create and configure AI agents with customizable prompts and behavior
- Support for multiple LLM providers (GPT-4o, GPT-3.5-turbo, Claude-3)
- Voice integration with ElevenLabs for AI phone calls
- Widget customization (position, colors, welcome messages)

### Chat Widget System
- Embeddable JavaScript widget for websites
- WhatsApp-style chat interface
- Real-time messaging with AI responses
- Lead qualification and data collection

### Analytics Dashboard
- Performance metrics tracking
- Conversion rate monitoring
- Agent usage statistics
- Lead qualification insights

### Embed Code Generator
- Dynamic code generation for website integration
- Customizable widget appearance and behavior
- Copy-to-clipboard functionality for easy deployment

## Data Flow

1. **Agent Creation**: Users configure AI agents through the React frontend, sending data to the Express API
2. **Widget Deployment**: Generated embed codes are placed on client websites
3. **Chat Interactions**: Website visitors interact with the chat widget, which communicates with the backend API
4. **AI Processing**: User messages are processed by the configured LLM provider (OpenAI API)
5. **Lead Qualification**: Conversations are analyzed and scored for conversion potential
6. **Analytics Collection**: Interaction data is aggregated for reporting and insights

## External Dependencies

### AI Services
- **OpenAI API**: Primary LLM provider for chat responses and lead qualification
- **ElevenLabs**: Voice synthesis for AI phone calls (planned feature)

### Database
- **PostgreSQL**: Primary database with connection via environment variable
- **Neon Database**: Serverless PostgreSQL provider integration

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Fast bundling for production server builds

## Deployment Strategy

### Development Environment
- **Local Development**: `npm run dev` runs both frontend and backend in development mode
- **Hot Reload**: Vite provides fast refresh for frontend changes
- **Database Management**: `npm run db:push` for schema updates

### Production Deployment
- **Build Process**: Vite builds the frontend, ESBuild bundles the server
- **Deployment Target**: Configured for Replit autoscale deployment
- **Port Configuration**: Server runs on port 5000, exposed as port 80
- **Environment Variables**: Database URL and API keys configured via environment

### Infrastructure Requirements
- Node.js 20+ runtime environment
- PostgreSQL database instance
- OpenAI API key for LLM functionality
- Web server capable of serving static files and API endpoints

## Changelog

```
Changelog:
- June 15, 2025. Initial setup complete
- June 15, 2025. Fixed CSS color classes and integrated OpenAI API
- June 15, 2025. Platform is now running with full functionality
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```