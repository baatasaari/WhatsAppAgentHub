(function() {
    'use strict';
    
    function createDiscordWidget() {
        const scripts = document.querySelectorAll('script[data-agent-config], script[data-agent-id]');
        if (scripts.length === 0) {
            console.error('AgentFlow Discord Widget: No configuration found');
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
                console.error('AgentFlow Discord Widget: Missing agent configuration');
                return;
            }
            
            config = {
                apiKey: agentId,
                position: script.getAttribute('data-position') || 'bottom-right',
                color: script.getAttribute('data-color') || '#5865F2',
                welcomeMessage: script.getAttribute('data-welcome-msg') || 'Hi! How can I help you today?'
            };
        }
        
        // Create widget button
        const widget = document.createElement('div');
        widget.id = 'agentflow-discord-widget';
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
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/>
                </svg>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Add click handler
        widget.querySelector('.agentflow-chat-button').addEventListener('click', function() {
            openDiscordChat(config);
        });
        
        // Show welcome message after delay
        setTimeout(() => {
            showWelcomeMessage(config);
        }, 2000);
    }
    
    function openDiscordChat(config) {
        let discordUrl;
        
        if (config.discordGuildId) {
            discordUrl = `https://discord.gg/${config.discordGuildId}`;
        } else {
            // Fallback to Discord
            discordUrl = `https://discord.com/`;
        }
        
        // Track interaction
        if (config.apiKey) {
            fetch('/api/widget-interaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    platform: 'discord',
                    action: 'widget_click',
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {}); // Ignore tracking failures
        }
        
        window.open(discordUrl, '_blank');
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
                        background: #5865F2;
                        border-radius: 50%;
                    "></span>
                    Chat via Discord
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
        document.addEventListener('DOMContentLoaded', createDiscordWidget);
    } else {
        createDiscordWidget();
    }
})();