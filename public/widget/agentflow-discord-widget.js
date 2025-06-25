(function() {
    'use strict';
    
    // AgentFlow Discord Widget Implementation
    function createDiscordWidget() {
        const script = document.currentScript || document.querySelector('script[data-agent-config]');
        if (!script) return;
        
        const config = script.getAttribute('data-agent-config');
        let settings = {};
        
        try {
            settings = JSON.parse(atob(config));
        } catch (e) {
            console.error('AgentFlow: Invalid Discord widget configuration');
            return;
        }
        
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'agentflow-discord-widget';
        widgetContainer.style.cssText = `
            position: fixed;
            ${settings.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
            ${settings.position.includes('left') ? 'left: 20px;' : 'right: 160px;'}
            z-index: 9997;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Create chat button
        const chatButton = document.createElement('div');
        chatButton.style.cssText = `
            width: 60px;
            height: 60px;
            background: #5865F2;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            position: relative;
        `;
        
        // Discord icon
        chatButton.innerHTML = `
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/>
            </svg>
        `;
        
        // Pulse animation
        const pulseRing = document.createElement('div');
        pulseRing.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            border: 2px solid #5865F2;
            border-radius: 50%;
            animation: agentflow-pulse 2s infinite;
            opacity: 0.5;
        `;
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'agentflow-tooltip';
        tooltip.textContent = 'Join our Discord community';
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
                    event_label: 'Discord Community',
                    value: 1
                });
            }
            
            // Generate Discord URL
            const discordUrl = settings.discordInvite 
                ? `https://discord.gg/${settings.discordInvite}`
                : 'https://discord.com/';
            
            // Open Discord
            window.open(discordUrl, '_blank');
            
            // Analytics tracking
            console.log('AgentFlow Discord widget clicked', {
                timestamp: new Date().toISOString(),
                config: settings.apiKey,
                platform: 'discord'
            });
        });
        
        // Assemble widget
        chatButton.appendChild(pulseRing);
        widgetContainer.appendChild(chatButton);
        widgetContainer.appendChild(tooltip);
        
        // Add to page
        document.body.appendChild(widgetContainer);
        
        console.log('AgentFlow Discord widget loaded successfully');
    }
    
    // Initialize widget when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDiscordWidget);
    } else {
        createDiscordWidget();
    }
})();