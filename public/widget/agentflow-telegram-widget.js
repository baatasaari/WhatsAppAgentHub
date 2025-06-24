(function() {
    'use strict';
    
    function createTelegramWidget() {
        const scripts = document.querySelectorAll('script[data-agent-config], script[data-agent-id]');
        if (scripts.length === 0) {
            console.error('AgentFlow Telegram Widget: No configuration found');
            return;
        }
        
        const script = scripts[scripts.length - 1];
        let config = null;
        
        // Try encrypted config first
        const encryptedConfig = script.getAttribute('data-agent-config');
        if (encryptedConfig) {
            try {
                config = JSON.parse(atob(encryptedConfig));
            } catch (e) {
                console.error('AgentFlow: Invalid encrypted configuration');
                return;
            }
        } else {
            // Fallback to legacy attributes
            const agentId = script.getAttribute('data-agent-id');
            if (!agentId) {
                console.error('AgentFlow Telegram Widget: Missing agent configuration');
                return;
            }
            
            config = {
                apiKey: agentId,
                position: script.getAttribute('data-position') || 'bottom-right',
                color: script.getAttribute('data-color') || '#0088cc',
                welcomeMessage: script.getAttribute('data-welcome-msg') || 'Hi! How can I help you today?'
            };
        }
        
        // Create widget button
        const widget = document.createElement('div');
        widget.id = 'agentflow-telegram-widget';
        widget.innerHTML = `
            <div class="agentflow-chat-button" style="
                position: fixed;
                ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
                ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                width: 60px;
                height: 60px;
                background-color: ${config.color};
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                cursor: pointer;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Add click handler
        widget.querySelector('.agentflow-chat-button').addEventListener('click', function() {
            openTelegramChat(config);
        });
        
        // Show welcome message after delay
        setTimeout(() => {
            showWelcomeMessage(config);
        }, 2000);
    }
    
    function openTelegramChat(config) {
        const message = encodeURIComponent(config.welcomeMessage || 'Hi! I need help.');
        let telegramUrl;
        
        if (config.telegramUsername) {
            telegramUrl = `https://t.me/${config.telegramUsername}?start=${message}`;
        } else {
            // Fallback to generic Telegram
            telegramUrl = `https://t.me/`;
        }
        
        // Track interaction
        if (config.apiKey) {
            fetch('/api/widget-interaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    platform: 'telegram',
                    action: 'widget_click',
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {}); // Ignore tracking failures
        }
        
        window.open(telegramUrl, '_blank');
    }
    
    function showWelcomeMessage(config) {
        const existingMessage = document.getElementById('agentflow-welcome-message');
        if (existingMessage) return;
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'agentflow-welcome-message';
        welcomeMessage.innerHTML = `
            <div style="
                position: fixed;
                ${config.position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;'}
                ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                background: white;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 280px;
                z-index: 999;
                border: 1px solid #e5e7eb;
                animation: slideUp 0.3s ease-out;
            ">
                <div style="
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    color: #374151;
                    line-height: 1.4;
                    margin-bottom: 8px;
                ">${config.welcomeMessage || 'Hi! How can I help you today?'}</div>
                <div style="
                    font-size: 12px;
                    color: #9ca3af;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                ">
                    <span style="
                        display: inline-block;
                        width: 6px;
                        height: 6px;
                        background: #0088cc;
                        border-radius: 50%;
                    "></span>
                    Chat via Telegram
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 18px;
                    color: #9ca3af;
                    line-height: 1;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                ">×</button>
            </div>
        `;
        
        // Add CSS animation
        if (!document.getElementById('agentflow-animations')) {
            const style = document.createElement('style');
            style.id = 'agentflow-animations';
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(welcomeMessage);
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (welcomeMessage.parentElement) {
                welcomeMessage.remove();
            }
        }, 8000);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createTelegramWidget);
    } else {
        createTelegramWidget();
    }
})();