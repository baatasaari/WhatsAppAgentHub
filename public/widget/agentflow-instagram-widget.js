(function() {
    'use strict';
    
    function createInstagramWidget() {
        const scripts = document.querySelectorAll('script[data-agent-config], script[data-agent-id]');
        if (scripts.length === 0) {
            console.error('AgentFlow Instagram Widget: No configuration found');
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
                console.error('AgentFlow Instagram Widget: Missing agent configuration');
                return;
            }
            
            config = {
                apiKey: agentId,
                position: script.getAttribute('data-position') || 'bottom-right',
                color: script.getAttribute('data-color') || '#E4405F',
                welcomeMessage: script.getAttribute('data-welcome-msg') || 'Hi! How can I help you today?'
            };
        }
        
        // Create widget button
        const widget = document.createElement('div');
        widget.id = 'agentflow-instagram-widget';
        widget.innerHTML = `
            <div class="agentflow-chat-button" style="
                position: fixed;
                ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
                ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                width: 60px;
                height: 60px;
                background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);
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
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Add click handler
        widget.querySelector('.agentflow-chat-button').addEventListener('click', function() {
            openInstagramChat(config);
        });
        
        // Show welcome message after delay
        setTimeout(() => {
            showWelcomeMessage(config);
        }, 2000);
    }
    
    function openInstagramChat(config) {
        let instagramUrl;
        
        if (config.instagramBusinessId) {
            instagramUrl = `https://ig.me/m/${config.instagramBusinessId}`;
        } else {
            // Fallback to Instagram
            instagramUrl = `https://www.instagram.com/`;
        }
        
        // Track interaction
        if (config.apiKey) {
            fetch('/api/widget-interaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: config.apiKey,
                    platform: 'instagram',
                    action: 'widget_click',
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {}); // Ignore tracking failures
        }
        
        window.open(instagramUrl, '_blank');
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
                        background: #E4405F;
                        border-radius: 50%;
                    "></span>
                    Chat via Instagram
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
        document.addEventListener('DOMContentLoaded', createInstagramWidget);
    } else {
        createInstagramWidget();
    }
})();