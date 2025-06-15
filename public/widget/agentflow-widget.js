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
            whatsappNumber: script.getAttribute('data-whatsapp-number'),
            enableChat: script.getAttribute('data-enable-chat') !== 'false'
        };
    }

    // Normalize API key field names for compatibility
    config.agentId = config.apiKey || config.agentId;
    config.enableChat = config.enableChat !== false; // Default to true

    if (!config.agentId) {
        console.error('AgentFlow Widget: Agent ID is required');
        return;
    }

    // Widget state
    let isOpen = false;
    let sessionId = null;
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
            background-color: ${config.color || '#25D366'};
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            position: relative;
        }
        .agentflow-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }
        .agentflow-button svg {
            width: 32px;
            height: 32px;
            fill: white;
        }

        .agentflow-chat {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
            display: none;
            flex-direction: column;
            overflow: hidden;
        }
        .agentflow-chat.open {
            display: flex;
        }

        .agentflow-header {
            background: ${config.color || '#25D366'};
            color: white;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .agentflow-header-avatar {
            width: 40px;
            height: 40px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .agentflow-header-info h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        .agentflow-header-info p {
            margin: 0;
            font-size: 12px;
            opacity: 0.8;
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
        .agentflow-message.user {
            background: #f0f0f0;
            align-self: flex-end;
            margin-left: auto;
        }
        .agentflow-message.bot {
            background: ${config.color || '#25D366'};
            color: white;
            align-self: flex-start;
        }
        .agentflow-message.loading {
            background: #f0f0f0;
            align-self: flex-start;
            opacity: 0.7;
        }

        .agentflow-input-area {
            padding: 16px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }
        .agentflow-input {
            flex: 1;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            padding: 12px 16px;
            font-size: 14px;
            resize: none;
            outline: none;
            max-height: 100px;
        }
        .agentflow-send-btn {
            background: ${config.color || '#25D366'};
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s;
        }
        .agentflow-send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .agentflow-whatsapp-handoff {
            padding: 12px 16px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
            text-align: center;
        }
        .agentflow-whatsapp-btn {
            background: #25D366;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        /* Mobile responsiveness */
        @media (max-width: 480px) {
            .agentflow-widget.bottom-right,
            .agentflow-widget.bottom-left {
                bottom: 20px;
                right: 20px;
            }
            .agentflow-button {
                width: 56px;
                height: 56px;
            }
            .agentflow-button svg {
                width: 28px;
                height: 28px;
            }
            .agentflow-chat {
                width: 90vw;
                height: 70vh;
                bottom: 90px;
                right: 5vw;
            }
        }
    `;

    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Create widget HTML - Chat interface with WhatsApp integration
    const widgetHTML = `
        <div class="agentflow-widget ${config.position || 'bottom-right'}">
            <button class="agentflow-button" id="agentflow-toggle" title="${config.welcomeMessage}">
                <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
            </button>
            <div class="agentflow-chat" id="agentflow-chat">
                <div class="agentflow-header">
                    <div class="agentflow-header-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M12 8C14.67 8 19 9.33 19 12V21H5V12C5 9.33 9.33 8 12 8Z"/>
                        </svg>
                    </div>
                    <div class="agentflow-header-info">
                        <h3>AI Assistant</h3>
                        <p>Powered by AgentFlow</p>
                    </div>
                </div>
                <div class="agentflow-messages" id="agentflow-messages">
                    <div class="agentflow-message bot">
                        ${config.welcomeMessage}
                    </div>
                </div>
                <div class="agentflow-input-area">
                    <textarea 
                        id="agentflow-input" 
                        class="agentflow-input" 
                        placeholder="Type your message..."
                        rows="1"
                    ></textarea>
                    <button id="agentflow-send" class="agentflow-send-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                        </svg>
                    </button>
                </div>
                <div class="agentflow-whatsapp-handoff" id="agentflow-whatsapp-handoff" style="display: none;">
                    <button class="agentflow-whatsapp-btn" id="agentflow-whatsapp-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.086"/>
                        </svg>
                        Continue on WhatsApp
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
    const whatsappHandoff = document.getElementById('agentflow-whatsapp-handoff');
    const whatsappButton = document.getElementById('agentflow-whatsapp-btn');

    // Generate session ID
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);

    // Chat toggle function
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            chatContainer.classList.add('open');
            messageInput.focus();
        } else {
            chatContainer.classList.remove('open');
        }
    }

    // Add message to chat
    function addMessage(content, sender, loading = false) {
        const messageElement = document.createElement('div');
        messageElement.className = `agentflow-message ${sender}${loading ? ' loading' : ''}`;
        messageElement.textContent = loading ? 'AI is typing...' : content;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (!loading) {
            messages.push({ content, sender, timestamp: new Date().toISOString() });
        }
        
        return messageElement;
    }

    // Send message to LLM API
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
            const response = await fetch(`${window.location.origin}/api/widget/chat`, {
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
            
            // Add AI response
            addMessage(data.response, 'bot');
            
            // Show WhatsApp handoff if suggested
            if (data.shouldTransfer && data.whatsappHandoff) {
                whatsappHandoff.style.display = 'block';
                whatsappButton.onclick = () => {
                    window.open(data.whatsappHandoff, '_blank');
                };
            }
            
        } catch (error) {
            console.error('AgentFlow Widget Error:', error);
            loadingElement.textContent = 'Sorry, I had trouble processing your message. Please try again.';
            loadingElement.classList.remove('loading');
        } finally {
            isLoading = false;
            sendButton.disabled = false;
        }
    }

    // Direct WhatsApp function (fallback)
    function openWhatsApp() {
        if (config.whatsappNumber) {
            const message = encodeURIComponent(config.welcomeMessage || 'Hi! I\'m interested in your services.');
            const cleanNumber = config.whatsappNumber.replace(/[^0-9]/g, '');
            const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
            window.open(whatsappUrl, '_blank');
        }
    }

    // Event listeners
    toggleButton.addEventListener('click', () => {
        if (config.enableChat) {
            toggleChat();
        } else {
            openWhatsApp();
        }
    });
    
    sendButton.addEventListener('click', () => {
        sendMessage(messageInput.value);
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value);
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
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