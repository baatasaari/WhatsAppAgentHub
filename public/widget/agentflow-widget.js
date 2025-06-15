(function() {
    'use strict';
    
    // Widget configuration - support both encrypted and legacy formats
    const script = document.currentScript || document.querySelector('script[data-agent-config]') || document.querySelector('script[data-agent-id]');
    if (!script) return;
    
    let config = {};
    
    // Check for encrypted configuration first
    const encryptedConfig = script.getAttribute('data-agent-config');
    if (encryptedConfig) {
        try {
            // Decrypt the base64 encoded configuration
            const decryptedData = atob(encryptedConfig);
            config = JSON.parse(decryptedData);
            config.apiBase = script.src.replace('/widget/agentflow-widget.js', '');
        } catch (error) {
            console.error('AgentFlow Widget: Failed to decrypt configuration');
            return;
        }
    } else {
        // Fallback to legacy unencrypted attributes for backward compatibility
        config = {
            apiKey: script.getAttribute('data-agent-id'),
            position: script.getAttribute('data-position') || 'bottom-right',
            color: script.getAttribute('data-color') || '#25D366',
            welcomeMessage: script.getAttribute('data-welcome-msg') || 'Hi! How can I help you today?',
            apiBase: script.src.replace('/widget/agentflow-widget.js', '')
        };
    }

    // Normalize API key field names for compatibility
    config.agentId = config.apiKey || config.agentId;

    if (!config.agentId) {
        console.error('AgentFlow Widget: Agent configuration is required');
        return;
    }

    // Set default WhatsApp mode if not specified
    config.whatsappMode = config.whatsappMode || 'web';

    // Generate unique session ID
    const sessionId = 'af_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // State management
    let isOpen = false;
    let messages = [];
    let isLoading = false;

    // Create widget styles
    const styles = `
        .agentflow-widget {
            position: fixed;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .agentflow-widget.bottom-right { bottom: 24px; right: 24px; }
        .agentflow-widget.bottom-left { bottom: 24px; left: 24px; }
        .agentflow-widget.top-right { top: 24px; right: 24px; }
        .agentflow-widget.top-left { top: 24px; left: 24px; }
        
        .agentflow-button {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: ${config.color};
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        .agentflow-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }
        .agentflow-button svg {
            width: 28px;
            height: 28px;
            fill: white;
        }
        
        .agentflow-chat {
            position: absolute;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            border: 1px solid #e5e7eb;
            display: none;
            flex-direction: column;
            overflow: hidden;
        }
        .agentflow-widget.bottom-right .agentflow-chat,
        .agentflow-widget.top-right .agentflow-chat { right: 0; }
        .agentflow-widget.bottom-left .agentflow-chat,
        .agentflow-widget.top-left .agentflow-chat { left: 0; }
        .agentflow-widget.bottom-right .agentflow-chat,
        .agentflow-widget.bottom-left .agentflow-chat { bottom: 80px; }
        .agentflow-widget.top-right .agentflow-chat,
        .agentflow-widget.top-left .agentflow-chat { top: 80px; }
        
        .agentflow-header {
            background-color: ${config.color};
            color: white;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .agentflow-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .agentflow-avatar svg {
            width: 20px;
            height: 20px;
            fill: white;
        }
        .agentflow-agent-info h4 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        .agentflow-agent-info p {
            margin: 0;
            font-size: 12px;
            opacity: 0.9;
        }
        
        .agentflow-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .agentflow-message {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.4;
        }
        .agentflow-message.bot {
            background: #f3f4f6;
            color: #374151;
            align-self: flex-start;
        }
        .agentflow-message.user {
            background: ${config.color};
            color: white;
            align-self: flex-end;
        }
        .agentflow-message.loading {
            background: #f3f4f6;
            color: #6b7280;
            align-self: flex-start;
        }
        
        .agentflow-input-container {
            padding: 16px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            gap: 8px;
        }
        .agentflow-input {
            flex: 1;
            border: 1px solid #d1d5db;
            border-radius: 24px;
            padding: 12px 16px;
            font-size: 14px;
            outline: none;
        }
        .agentflow-input:focus {
            border-color: ${config.color};
        }
        .agentflow-send-button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: ${config.color};
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .agentflow-send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .agentflow-send-button svg {
            width: 16px;
            height: 16px;
            fill: white;
        }

        /* Scrollbar styling */
        .agentflow-messages::-webkit-scrollbar {
            width: 4px;
        }
        .agentflow-messages::-webkit-scrollbar-track {
            background: transparent;
        }
        .agentflow-messages::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 2px;
        }

        /* Mobile responsiveness */
        @media (max-width: 480px) {
            .agentflow-chat {
                width: 320px;
                height: 450px;
            }
            .agentflow-widget.bottom-right,
            .agentflow-widget.bottom-left {
                bottom: 20px;
                right: 20px;
                left: 20px;
            }
            .agentflow-widget.bottom-right .agentflow-chat,
            .agentflow-widget.bottom-left .agentflow-chat {
                right: 0;
                left: 0;
            }
        }
    `;

    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Create widget HTML
    const widgetHTML = `
        <div class="agentflow-widget ${config.position}">
            <button class="agentflow-button" id="agentflow-toggle">
                <svg viewBox="0 0 24 24">
                    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7V9zm0 4h7v2H7v-2z"/>
                </svg>
            </button>
            <div class="agentflow-chat" id="agentflow-chat">
                <div class="agentflow-header">
                    <div class="agentflow-avatar">
                        <svg viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </div>
                    <div class="agentflow-agent-info">
                        <h4>AI Assistant</h4>
                        <p>Typically replies instantly</p>
                    </div>
                </div>
                <div class="agentflow-messages" id="agentflow-messages"></div>
                <div class="agentflow-input-container">
                    <input type="text" class="agentflow-input" id="agentflow-input" placeholder="Type your message...">
                    <button class="agentflow-send-button" id="agentflow-send">
                        <svg viewBox="0 0 24 24">
                            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Insert widget into DOM
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    // Get DOM elements
    const toggleButton = document.getElementById('agentflow-toggle');
    const chatContainer = document.getElementById('agentflow-chat');
    const messagesContainer = document.getElementById('agentflow-messages');
    const messageInput = document.getElementById('agentflow-input');
    const sendButton = document.getElementById('agentflow-send');

    // WhatsApp Business integration functions
    function openWhatsApp() {
        if (config.whatsappNumber) {
            const message = encodeURIComponent(config.welcomeMessage || 'Hi! I\'m interested in your services.');
            const whatsappUrl = `https://wa.me/${config.whatsappNumber.replace(/[^0-9]/g, '')}?text=${message}`;
            window.open(whatsappUrl, '_blank');
        } else {
            // Fallback to web chat if no WhatsApp number configured
            toggleWebChat();
        }
    }

    function toggleWebChat() {
        isOpen = !isOpen;
        chatContainer.style.display = isOpen ? 'flex' : 'none';
        
        if (isOpen && messages.length === 0) {
            addMessage(config.welcomeMessage, 'bot');
        }
    }

    function toggleChat() {
        if (config.whatsappMode === 'whatsapp' && config.whatsappNumber) {
            openWhatsApp();
        } else {
            toggleWebChat();
        }
    }

    function addMessage(content, sender, loading = false) {
        const messageElement = document.createElement('div');
        messageElement.className = `agentflow-message ${sender}${loading ? ' loading' : ''}`;
        messageElement.textContent = loading ? 'Typing...' : content;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (!loading) {
            messages.push({ content, sender, timestamp: new Date().toISOString() });
        }
        
        return messageElement;
    }

    async function sendMessage(message) {
        if (!message.trim() || isLoading) return;
        
        // Add user message
        addMessage(message, 'user');
        messageInput.value = '';
        
        // Show loading
        isLoading = true;
        sendButton.disabled = true;
        const loadingElement = addMessage('', 'bot', true);
        
        try {
            const response = await fetch(`${config.apiBase}/api/widget/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    apiKey: config.agentId,
                    message: message,
                    sessionId: sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            const data = await response.json();
            
            // Remove loading message
            loadingElement.remove();
            
            // Add bot response
            addMessage(data.response, 'bot');
            
        } catch (error) {
            console.error('AgentFlow Widget Error:', error);
            loadingElement.textContent = 'Sorry, I had trouble processing your message. Please try again.';
            loadingElement.classList.remove('loading');
        } finally {
            isLoading = false;
            sendButton.disabled = false;
        }
    }

    // Event listeners
    toggleButton.addEventListener('click', toggleChat);
    
    sendButton.addEventListener('click', () => {
        sendMessage(messageInput.value);
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value);
        }
    });

    // Close chat when clicking outside
    document.addEventListener('click', (e) => {
        if (isOpen && !e.target.closest('.agentflow-widget')) {
            toggleChat();
        }
    });

    // Prevent propagation of clicks within the widget
    document.querySelector('.agentflow-widget').addEventListener('click', (e) => {
        e.stopPropagation();
    });
})();
