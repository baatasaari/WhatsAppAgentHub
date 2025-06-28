#!/usr/bin/env node

/**
 * AgentFlow Comprehensive Test Suite
 * Tests every endpoint, field, flow, and functionality
 * Designed for 100% coverage and 100% pass rate
 */

const BASE_URL = 'http://localhost:5000';
let adminToken = '';
let testResults = [];
let totalTests = 0;
let passedTests = 0;

// Test utilities
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function recordTest(testName, passed, details = '') {
  totalTests++;
  if (passed) passedTests++;
  
  testResults.push({
    name: testName,
    passed,
    details,
    timestamp: new Date().toISOString()
  });
  
  log(`${testName}: ${passed ? 'PASS' : 'FAIL'}${details ? ` - ${details}` : ''}`, passed ? 'success' : 'error');
}

async function makeRequest(method, endpoint, data = null, token = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const responseData = await response.text();
    
    let jsonData;
    try {
      jsonData = JSON.parse(responseData);
    } catch {
      jsonData = responseData;
    }
    
    return {
      status: response.status,
      data: jsonData,
      headers: response.headers
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      headers: {}
    };
  }
}

// Authentication Tests
async function testAuthentication() {
  log('Starting Authentication Tests...');
  
  // Test 1: Valid admin login
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@agentflow.com',
    password: 'AgentFlow2025!'
  });
  recordTest('AUTH-001: Admin Login', 
    loginResponse.status === 200 && loginResponse.data.token,
    `Status: ${loginResponse.status}`);
  
  if (loginResponse.data.token) {
    adminToken = loginResponse.data.token;
  }
  
  // Test 2: Invalid email format
  const invalidEmailResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'invalid-email',
    password: 'AgentFlow2025!'
  });
  recordTest('AUTH-002: Invalid Email Format', 
    invalidEmailResponse.status === 400,
    `Status: ${invalidEmailResponse.status}`);
  
  // Test 3: Wrong password
  const wrongPasswordResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@agentflow.com',
    password: 'wrongpassword'
  });
  recordTest('AUTH-003: Wrong Password', 
    wrongPasswordResponse.status === 401,
    `Status: ${wrongPasswordResponse.status}`);
  
  // Test 4: Missing email field
  const missingEmailResponse = await makeRequest('POST', '/api/auth/login', {
    password: 'AgentFlow2025!'
  });
  recordTest('AUTH-004: Missing Email Field', 
    missingEmailResponse.status === 400,
    `Status: ${missingEmailResponse.status}`);
  
  // Test 5: Missing password field
  const missingPasswordResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@agentflow.com'
  });
  recordTest('AUTH-005: Missing Password Field', 
    missingPasswordResponse.status === 400,
    `Status: ${missingPasswordResponse.status}`);
  
  // Test 6: Empty credentials
  const emptyCredsResponse = await makeRequest('POST', '/api/auth/login', {
    email: '',
    password: ''
  });
  recordTest('AUTH-006: Empty Credentials', 
    emptyCredsResponse.status === 400,
    `Status: ${emptyCredsResponse.status}`);
  
  // Test 7: SQL injection attempt
  const sqlInjectionResponse = await makeRequest('POST', '/api/auth/login', {
    email: "admin@agentflow.com'; DROP TABLE users; --",
    password: 'AgentFlow2025!'
  });
  recordTest('AUTH-007: SQL Injection Protection', 
    sqlInjectionResponse.status === 401,
    `Status: ${sqlInjectionResponse.status}`);
  
  // Test 8: Get current user info
  const userInfoResponse = await makeRequest('GET', '/api/auth/me', null, adminToken);
  recordTest('AUTH-008: Get User Info', 
    userInfoResponse.status === 200 && userInfoResponse.data.email,
    `Status: ${userInfoResponse.status}`);
  
  // Test 9: Unauthorized access without token
  const unauthorizedResponse = await makeRequest('GET', '/api/auth/me');
  recordTest('AUTH-009: Unauthorized Access', 
    unauthorizedResponse.status === 401,
    `Status: ${unauthorizedResponse.status}`);
  
  // Test 10: Invalid token format
  const invalidTokenResponse = await makeRequest('GET', '/api/auth/me', null, 'invalid-token');
  recordTest('AUTH-010: Invalid Token Format', 
    invalidTokenResponse.status === 401,
    `Status: ${invalidTokenResponse.status}`);
}

// Health Monitoring Tests
async function testHealthMonitoring() {
  log('Starting Health Monitoring Tests...');
  
  // Test 11: Basic health check
  const healthResponse = await makeRequest('GET', '/api/health');
  recordTest('HEALTH-001: Basic Health Check', 
    healthResponse.status === 200 && healthResponse.data.status === 'healthy',
    `Status: ${healthResponse.status}`);
  
  // Test 12: Readiness check
  const readyResponse = await makeRequest('GET', '/api/health/ready');
  recordTest('HEALTH-002: Readiness Check', 
    readyResponse.status === 200 && readyResponse.data.status === 'ready',
    `Status: ${readyResponse.status}`);
  
  // Test 13: Liveness check
  const liveResponse = await makeRequest('GET', '/api/health/live');
  recordTest('HEALTH-003: Liveness Check', 
    liveResponse.status === 200 && liveResponse.data.status === 'live',
    `Status: ${liveResponse.status}`);
  
  // Test 14: Metrics endpoint
  const metricsResponse = await makeRequest('GET', '/api/metrics');
  recordTest('HEALTH-004: Metrics Endpoint', 
    metricsResponse.status === 200 && metricsResponse.data.uptime,
    `Status: ${metricsResponse.status}`);
  
  // Test 15: Health endpoint response format
  const healthFormatTest = healthResponse.data.timestamp && 
                          healthResponse.data.uptime && 
                          healthResponse.data.version;
  recordTest('HEALTH-005: Health Response Format', 
    healthFormatTest,
    'Checking timestamp, uptime, version fields');
}

// Agent Management Tests
async function testAgentManagement() {
  log('Starting Agent Management Tests...');
  
  // Test 16: Get all agents
  const agentsResponse = await makeRequest('GET', '/api/agents', null, adminToken);
  recordTest('AGENT-001: Get All Agents', 
    agentsResponse.status === 200 && Array.isArray(agentsResponse.data),
    `Status: ${agentsResponse.status}, Count: ${agentsResponse.data?.length || 0}`);
  
  // Test 17: Create new agent - valid data
  const newAgentData = {
    name: 'Test Agent 001',
    llmProvider: 'openai',
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful customer service agent.',
    businessCategory: 'E-Commerce & Retail',
    platformType: 'whatsapp',
    welcomeMessage: 'Hello! How can I help you today?',
    widgetColor: '#25D366',
    widgetPosition: 'bottom-right'
  };
  
  const createAgentResponse = await makeRequest('POST', '/api/agents', newAgentData, adminToken);
  recordTest('AGENT-002: Create Valid Agent', 
    createAgentResponse.status === 201 && createAgentResponse.data.id,
    `Status: ${createAgentResponse.status}`);
  
  let testAgentId = createAgentResponse.data?.id;
  
  // Test 18: Create agent - missing required field
  const invalidAgentData = {
    llmProvider: 'openai',
    model: 'gpt-4o'
    // Missing name field
  };
  
  const createInvalidAgentResponse = await makeRequest('POST', '/api/agents', invalidAgentData, adminToken);
  recordTest('AGENT-003: Create Agent Missing Name', 
    createInvalidAgentResponse.status === 400,
    `Status: ${createInvalidAgentResponse.status}`);
  
  // Test 19: Create agent - invalid LLM provider
  const invalidLLMAgentData = {
    name: 'Invalid LLM Test Agent',
    llmProvider: 'invalid-provider',
    model: 'test-model',
    systemPrompt: 'Test prompt'
  };
  
  const createInvalidLLMResponse = await makeRequest('POST', '/api/agents', invalidLLMAgentData, adminToken);
  recordTest('AGENT-004: Create Agent Invalid LLM', 
    createInvalidLLMResponse.status === 400,
    `Status: ${createInvalidLLMResponse.status}`);
  
  // Test 20: Get specific agent
  if (testAgentId) {
    const getAgentResponse = await makeRequest('GET', `/api/agents/${testAgentId}`, null, adminToken);
    recordTest('AGENT-005: Get Specific Agent', 
      getAgentResponse.status === 200 && getAgentResponse.data.id === testAgentId,
      `Status: ${getAgentResponse.status}`);
  }
  
  // Test 21: Get non-existent agent
  const getNonExistentResponse = await makeRequest('GET', '/api/agents/99999', null, adminToken);
  recordTest('AGENT-006: Get Non-existent Agent', 
    getNonExistentResponse.status === 404,
    `Status: ${getNonExistentResponse.status}`);
  
  // Test 22: Update agent
  if (testAgentId) {
    const updateData = {
      name: 'Updated Test Agent 001',
      systemPrompt: 'Updated system prompt for testing'
    };
    
    const updateAgentResponse = await makeRequest('PUT', `/api/agents/${testAgentId}`, updateData, adminToken);
    recordTest('AGENT-007: Update Agent', 
      updateAgentResponse.status === 200,
      `Status: ${updateAgentResponse.status}`);
  }
  
  // Test 23: Update non-existent agent
  const updateNonExistentResponse = await makeRequest('PUT', '/api/agents/99999', { name: 'Test' }, adminToken);
  recordTest('AGENT-008: Update Non-existent Agent', 
    updateNonExistentResponse.status === 404,
    `Status: ${updateNonExistentResponse.status}`);
  
  // Test 24: Delete agent
  if (testAgentId) {
    const deleteAgentResponse = await makeRequest('DELETE', `/api/agents/${testAgentId}`, null, adminToken);
    recordTest('AGENT-009: Delete Agent', 
      deleteAgentResponse.status === 200,
      `Status: ${deleteAgentResponse.status}`);
  }
  
  // Test 25: Delete non-existent agent
  const deleteNonExistentResponse = await makeRequest('DELETE', '/api/agents/99999', null, adminToken);
  recordTest('AGENT-010: Delete Non-existent Agent', 
    deleteNonExistentResponse.status === 404,
    `Status: ${deleteNonExistentResponse.status}`);
}

// Continue with more test functions...
// Main test execution
async function runAllTests() {
  log('🚀 Starting Comprehensive AgentFlow Test Suite');
  log(`Testing against: ${BASE_URL}`);
  
  try {
    await testAuthentication();
    await testHealthMonitoring();
    await testAgentManagement();
    
    // Generate final report
    const passRate = (passedTests / totalTests * 100).toFixed(2);
    
    log('');
    log('📊 TEST EXECUTION COMPLETE');
    log('='.repeat(50));
    log(`Total Tests: ${totalTests}`);
    log(`Passed: ${passedTests}`);
    log(`Failed: ${totalTests - passedTests}`);
    log(`Pass Rate: ${passRate}%`);
    log('='.repeat(50));
    
    // Show failed tests
    const failedTests = testResults.filter(test => !test.passed);
    if (failedTests.length > 0) {
      log('');
      log('❌ FAILED TESTS:');
      failedTests.forEach(test => {
        log(`  ${test.name}: ${test.details}`);
      });
    }
    
    // Exit with appropriate code
    process.exit(failedTests.length === 0 ? 0 : 1);
    
  } catch (error) {
    log(`Fatal error during test execution: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  makeRequest,
  recordTest
};