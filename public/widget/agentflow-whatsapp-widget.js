(function() {
    'use strict';
    
    const CONFIG_ENDPOINT = '/api/widget-config';
    
    function createWhatsAppWidget() {
        const scripts = document.querySelectorAll('script[data-agent-config], script[data-agent-id]');
        if (scripts.length === 0) {
            console.error('AgentFlow WhatsApp Widget: No configuration found');
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
                console.error('AgentFlow WhatsApp Widget: Missing agent configuration');
                return;
            }
            
            config = {
                apiKey: agentId,
                position: script.getAttribute('data-position') || 'bottom-right',
                color: script.getAttribute('data-color') || '#25D366',
                welcomeMessage: script.getAttribute('data-welcome-msg') || 'Hi! How can I help you today?'
            };
        }
        
        // Validate WhatsApp-specific config
        if (!config.whatsappNumber && !config.apiKey) {
            console.error('AgentFlow WhatsApp Widget: Missing WhatsApp number or API key');
            return;
        }
        
        // Create widget button
        const widget = document.createElement('div');
        widget.id = 'agentflow-whatsapp-widget';
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
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.484 3.687"/>
                </svg>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Add click handler
        widget.querySelector('.agentflow-chat-button').addEventListener('click', function() {
            openWhatsAppChat(config);
        });
        
        // Show welcome message after delay
        setTimeout(() => {
            showWelcomeMessage(config);
        }, 2000);
    }
    
    function openWhatsAppChat(config) {
        const message = encodeURIComponent(config.welcomeMessage || 'Hi! I need help.');
        let whatsappUrl;
        
        if (config.whatsappNumber) {
            // Clean phone number
            const phoneNumber = config.whatsappNumber.replace(/[^0-9]/g, '');
            whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
        } else {
            // Use web WhatsApp for testing
            whatsappUrl = `https://web.whatsapp.com/send?text=${message}`;
        }
        
        // Track interaction
        if (config.apiKey) {
            fetch('/api/widget-interaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    platform: 'whatsapp',
                    action: 'widget_click',
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {}); // Ignore tracking failures
        }
        
        window.open(whatsappUrl, '_blank');
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
                        background: #10b981;
                        border-radius: 50%;
                    "></span>
                    Typically replies in minutes
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
        document.addEventListener('DOMContentLoaded', createWhatsAppWidget);
    } else {
        createWhatsAppWidget();
    }
})();