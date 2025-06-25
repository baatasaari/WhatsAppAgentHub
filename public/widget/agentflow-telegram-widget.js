(function() {
    'use strict';
    
    // AgentFlow Telegram Widget Implementation
    function createTelegramWidget() {
        const script = document.currentScript || document.querySelector('script[data-agent-config]');
        if (!script) return;
        
        const config = script.getAttribute('data-agent-config');
        let settings = {};
        
        try {
            settings = JSON.parse(atob(config));
        } catch (e) {
            console.error('AgentFlow: Invalid Telegram widget configuration');
            return;
        }
        
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'agentflow-telegram-widget';
        widgetContainer.style.cssText = `
            position: fixed;
            ${settings.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
            ${settings.position.includes('left') ? 'left: 20px;' : 'right: 90px;'}
            z-index: 9998;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Create chat button
        const chatButton = document.createElement('div');
        chatButton.style.cssText = `
            width: 60px;
            height: 60px;
            background: #0088cc;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            position: relative;
        `;
        
        // Telegram icon
        chatButton.innerHTML = `
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
        `;
        
        // Pulse animation
        const pulseRing = document.createElement('div');
        pulseRing.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            border: 2px solid #0088cc;
            border-radius: 50%;
            animation: agentflow-pulse 2s infinite;
            opacity: 0.5;
        `;
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'agentflow-tooltip';
        tooltip.textContent = 'Chat with us on Telegram';
        tooltip.style.cssText += `
            bottom: 70px;
            right: 0;
        `;
        
        // Event handlers
        chatButton.addEventListener('mouseenter', () => {
            tooltip.classList.add('show');
        });
        
        chatButton.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
        
        chatButton.addEventListener('click', () => {
            // Track click event
            if (window.gtag) {
                gtag('event', 'click', {
                    event_category: 'AgentFlow Widget',
                    event_label: 'Telegram Chat',
                    value: 1
                });
            }
            
            // Generate Telegram URL
            const telegramUrl = settings.telegramUsername 
                ? `https://t.me/${settings.telegramUsername}`
                : 'https://telegram.org/';
            
            // Open Telegram
            window.open(telegramUrl, '_blank');
            
            // Analytics tracking
            console.log('AgentFlow Telegram widget clicked', {
                timestamp: new Date().toISOString(),
                config: settings.apiKey,
                platform: 'telegram'
            });
        });
        
        // Assemble widget
        chatButton.appendChild(pulseRing);
        widgetContainer.appendChild(chatButton);
        widgetContainer.appendChild(tooltip);
        
        // Add to page
        document.body.appendChild(widgetContainer);
        
        console.log('AgentFlow Telegram widget loaded successfully');
    }
    
    // Initialize widget when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createTelegramWidget);
    } else {
        createTelegramWidget();
    }
})();