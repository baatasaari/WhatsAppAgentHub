import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createInitialAdminIfNeeded } from "./init-admin";
import { HealthMonitor, MetricsCollector } from "./monitoring/health";
import { 
  securityHeaders, 
  corsMiddleware, 
  requestLogger, 
  errorHandler, 
  generateRequestId,
  apiRateLimit 
} from "./middleware/security";
import { pool } from "./db";
import { DatabaseHealth, gracefulShutdown } from "./config/database";
import path from "path";

const app = express();

// Enterprise security middleware
app.use(generateRequestId);
app.use(securityHeaders);
app.use(corsMiddleware);

// Enhanced body parsing with security limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Rate limiting for API routes
app.use('/api', apiRateLimit);

// Enterprise health and monitoring endpoints
const healthMonitor = HealthMonitor.getInstance();
const metricsCollector = MetricsCollector.getInstance();

app.get('/health', healthMonitor.handleHealthCheck.bind(healthMonitor));
app.get('/health/ready', healthMonitor.handleReadiness.bind(healthMonitor));
app.get('/health/live', healthMonitor.handleLiveness.bind(healthMonitor));
app.get('/metrics', metricsCollector.handleMetrics.bind(metricsCollector));

// Serve static files from public directory (including widget and test files)
app.use(express.static(path.resolve(import.meta.dirname, "..", "public")));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Add specific routes for widget and test files before Vite middleware
  app.get('/widget/agentflow-widget.js', (req, res) => {
    res.sendFile(path.resolve(import.meta.dirname, "..", "public", "widget", "agentflow-widget.js"));
  });
  
  app.get('/test-widget.html', (req, res) => {
    res.sendFile(path.resolve(import.meta.dirname, "..", "public", "test-widget.html"));
  });

  const server = await registerRoutes(app);
  
  // Initialize admin user if no users exist
  try {
    await createInitialAdminIfNeeded();
  } catch (error) {
    console.error('Failed to initialize admin user:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
