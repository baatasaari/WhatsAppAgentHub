# AgentFlow - AI Conversational Agent Platform

## Overview

AgentFlow is a comprehensive web application for creating, managing, and deploying WhatsApp Business integration widgets. The platform allows users to create embeddable WhatsApp buttons that redirect website visitors directly to WhatsApp Business conversations for customer interactions, lead qualification, and sales conversations. The application features a React frontend with a Node.js/Express backend, using PostgreSQL for data persistence and Drizzle ORM for database operations.

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

### WhatsApp Business Widget System
- Embeddable JavaScript widget for websites
- Direct WhatsApp Business integration
- Encrypted configuration for security
- Customizable appearance and positioning

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

1. **Agent Creation**: Users configure WhatsApp Business agents through the React frontend, sending data to the Express API
2. **Widget Deployment**: Generated embed codes with encrypted WhatsApp configurations are placed on client websites
3. **WhatsApp Integration**: Website visitors click the widget and are redirected to WhatsApp Business with pre-filled messages
4. **Direct Communication**: All conversations happen directly in WhatsApp Business, eliminating web chat complexity
5. **Lead Qualification**: Potential for future WhatsApp Business API integration for automated lead scoring
6. **Analytics Collection**: Widget click data and engagement metrics are tracked for reporting

## External Dependencies

### AI Services
- **Multi-LLM Support**: OpenAI (GPT-4o, GPT-3.5), Anthropic (Claude Sonnet 4, Claude 3.7), Google (Gemini 1.5 Pro)
- **OpenAI API**: GPT-4o and GPT-3.5-turbo models for chat responses and lead qualification
- **Anthropic API**: Claude Sonnet 4 (latest) and Claude 3.7 Sonnet for advanced reasoning
- **Google AI API**: Gemini 1.5 Pro for multimodal AI capabilities
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
- June 15, 2025. Implemented encrypted widget security system with base64 encoding
- June 15, 2025. Added secure embed code generation with dual format support (encrypted/legacy)
- June 15, 2025. Removed web chat functionality and simplified to WhatsApp Business only integration
- June 15, 2025. Streamlined widget to direct WhatsApp redirects with encrypted configuration support
- June 15, 2025. Implemented automatic embed code generation after agent creation
- June 15, 2025. Fixed agent creation flow to automatically redirect to embed code page with generated client code
- June 16, 2025. Implemented multi-LLM provider support (OpenAI, Anthropic, Google AI) with unified interface
- June 16, 2025. Added Claude Sonnet 4, Claude 3.7, and Gemini 1.5 Pro model support alongside existing OpenAI models
- June 16, 2025. Enhanced agent management UI to display LLM provider badges and improved type safety
- June 16, 2025. Replaced hardcoded model options with dynamic YAML configuration system for centralized management
- June 16, 2025. Implemented centralized industry verticals configuration replacing hardcoded business categories
- June 16, 2025. Added comprehensive model configuration page displaying cost, performance, and capability metrics
- June 16, 2025. Implemented comprehensive LLM cost tracking across hourly, daily, weekly, monthly, and all-time periods
- June 16, 2025. Enhanced analytics schema with token usage and cost fields, updated all LLM providers to calculate costs
- June 16, 2025. Created cost analytics API endpoint and enhanced analytics page with detailed cost breakdowns by agent
- June 16, 2025. Fixed navigation routing using proper Link components, added Model Config page to navigation menu
- June 16, 2025. Completed comprehensive testing of all functionality: APIs, navigation, CRUD operations, error handling, widget embedding, chat functionality, and cost analytics
- June 16, 2025. Validated full system integration from agent creation to WhatsApp widget deployment with encrypted security
- June 16, 2025. Implemented comprehensive model management system with drag-and-drop reordering, CRUD operations, grid/list views, and customizable display options
- June 16, 2025. Added model creation, editing, deletion with YAML file persistence and real-time UI updates
- June 16, 2025. Enhanced Model Config page with search filtering, display customization, and professional model management interface
- June 16, 2025. Fixed database connection stability issues by enhancing pool configuration, adding connection error handling, and implementing graceful shutdown procedures
- June 16, 2025. Resolved application crashes caused by WebSocket connection failures with Neon PostgreSQL database through improved connection management
- June 16, 2025. Completed comprehensive stress testing with 45+ concurrent requests, memory leak testing, and full CRUD operation validation - all systems stable
- June 16, 2025. Added 7 popular open source models to LLM configuration: Llama 3.1 (405B/70B), Mistral 7B, Qwen 2.5 72B, Phi-3.5 Mini, Code Llama 34B, DeepSeek Coder 33B
- June 16, 2025. Enhanced model diversity with specialized coding models and efficient deployment options for self-hosted environments
- June 16, 2025. Created comprehensive README.md with installation guide, API documentation, deployment instructions, and feature overview
- June 23, 2025. Implemented comprehensive RBAC system with Admin and Business User roles, user registration workflow, and approval system
- June 23, 2025. Added authentication middleware, session management, and protected API endpoints with role-based access control
- June 23, 2025. Created user management system with pending approval workflow and admin-only user administration features
- June 23, 2025. Enhanced database schema with users, sessions, and user-owned agent relationships for multi-tenant architecture
- June 23, 2025. Implemented secure password hashing, JWT-style session tokens, and comprehensive authorization middleware
- June 23, 2025. Implemented real WhatsApp Business API integration with webhook handling, message processing, and AI-powered responses
- June 23, 2025. Added WhatsApp Business API service for sending messages, handling status updates, and managing real-time conversations
- June 23, 2025. Created WhatsApp configuration page with credential management, webhook setup instructions, and message history
- June 23, 2025. Extended database schema with WhatsApp message tracking, agent API configuration, and comprehensive webhook support
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```