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

    // Create widget HTML - Direct WhatsApp button with LLM integration
    const widgetHTML = `
        <div class="agentflow-widget ${config.position || 'bottom-right'}">
            <button class="agentflow-button" id="agentflow-toggle" title="${config.welcomeMessage}">
                <svg viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.086"/>
                </svg>
            </button>
        </div>
    `;

    // Insert widget into DOM
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    // Get DOM element
    const toggleButton = document.getElementById('agentflow-toggle');

    // WhatsApp Business integration with LLM trigger
    function openWhatsApp() {
        if (config.whatsappNumber) {
            // Create intelligent welcome message that triggers LLM response
            const welcomeText = config.welcomeMessage || 'Hi! I\'m interested in your services and would like to chat with your AI assistant.';
            const message = encodeURIComponent(welcomeText);
            const cleanNumber = config.whatsappNumber.replace(/[^0-9]/g, '');
            const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
            
            // Track widget interaction
            if (config.agentId) {
                fetch(`${window.location.origin}/api/widget/track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey: config.agentId,
                        action: 'whatsapp_redirect',
                        timestamp: new Date().toISOString()
                    })
                }).catch(() => {}); // Silent fail for tracking
            }
            
            window.open(whatsappUrl, '_blank');
        } else {
            console.error('AgentFlow Widget: WhatsApp number not configured');
        }
    }

    // Event listener - Direct WhatsApp redirect
    toggleButton.addEventListener('click', openWhatsApp);
})();