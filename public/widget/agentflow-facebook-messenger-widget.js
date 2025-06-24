(function() {
    'use strict';
    
    function createMessengerWidget() {
        const scripts = document.querySelectorAll('script[data-agent-config], script[data-agent-id]');
        if (scripts.length === 0) {
            console.error('AgentFlow Messenger Widget: No configuration found');
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
                console.error('AgentFlow Messenger Widget: Missing agent configuration');
                return;
            }
            
            config = {
                apiKey: agentId,
                position: script.getAttribute('data-position') || 'bottom-right',
                color: script.getAttribute('data-color') || '#0084FF',
                welcomeMessage: script.getAttribute('data-welcome-msg') || 'Hi! How can I help you today?'
            };
        }
        
        // Create widget button
        const widget = document.createElement('div');
        widget.id = 'agentflow-messenger-widget';
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
                    <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.191 14.963l-3.055-3.26L4.805 14.96 10.732 8.6l3.131 3.26L19.195 8.6l-5.927 6.363z"/>
                </svg>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Add click handler
        widget.querySelector('.agentflow-chat-button').addEventListener('click', function() {
            openMessengerChat(config);
        });
        
        // Show welcome message after delay
        setTimeout(() => {
            showWelcomeMessage(config);
        }, 2000);
    }
    
    function openMessengerChat(config) {
        let messengerUrl;
        
        if (config.facebookPageId) {
            messengerUrl = `https://m.me/${config.facebookPageId}`;
        } else {
            // Fallback to Facebook Messenger
            messengerUrl = `https://www.messenger.com/`;
        }
        
        // Track interaction
        if (config.apiKey) {
            fetch('/api/widget-interaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    platform: 'facebook-messenger',
                    action: 'widget_click',
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {}); // Ignore tracking failures
        }
        
        window.open(messengerUrl, '_blank');
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
                        background: #0084FF;
                        border-radius: 50%;
                    "></span>
                    Chat via Messenger
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
        document.addEventListener('DOMContentLoaded', createMessengerWidget);
    } else {
        createMessengerWidget();
    }
})();