(function() {
    'use strict';
    
    // AgentFlow WhatsApp Widget Implementation
    function createWhatsAppWidget() {
        const script = document.currentScript || document.querySelector('script[data-agent-config]');
        if (!script) return;
        
        const config = script.getAttribute('data-agent-config');
        let settings = {};
        
        try {
            settings = JSON.parse(atob(config));
        } catch (e) {
            console.error('AgentFlow: Invalid widget configuration');
            return;
        }
        
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'agentflow-whatsapp-widget';
        widgetContainer.style.cssText = `
            position: fixed;
            ${settings.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
            ${settings.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Create chat button
        const chatButton = document.createElement('div');
        chatButton.style.cssText = `
            width: 60px;
            height: 60px;
            background: ${settings.color || '#25D366'};
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            position: relative;
        `;
        
        // WhatsApp icon
        chatButton.innerHTML = `
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.786"/>
            </svg>
        `;
        
        // Pulse animation
        const pulseRing = document.createElement('div');
        pulseRing.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            border: 2px solid ${settings.color || '#25D366'};
            border-radius: 50%;
            animation: agentflow-pulse 2s infinite;
            opacity: 0.5;
        `;
        
        // Add CSS animations
        if (!document.querySelector('#agentflow-widget-styles')) {
            const styles = document.createElement('style');
            styles.id = 'agentflow-widget-styles';
            styles.textContent = `
                @keyframes agentflow-pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.1); opacity: 0.3; }
                    100% { transform: scale(1.2); opacity: 0; }
                }
                
                #agentflow-whatsapp-widget:hover > div {
                    transform: scale(1.1);
                }
                
                .agentflow-tooltip {
                    position: absolute;
                    background: #333;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                }
                
                .agentflow-tooltip.show {
                    opacity: 1;
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'agentflow-tooltip';
        tooltip.textContent = settings.welcomeMessage || 'Chat with us on WhatsApp';
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
                    event_label: 'WhatsApp Chat',
                    value: 1
                });
            }
            
            // Generate WhatsApp URL
            const message = encodeURIComponent(settings.welcomeMessage || 'Hello! I found you through your website.');
            let whatsappUrl;
            
            if (settings.whatsappMode === 'api' && settings.whatsappNumber) {
                whatsappUrl = `https://wa.me/${settings.whatsappNumber}?text=${message}`;
            } else {
                whatsappUrl = `https://web.whatsapp.com/send?text=${message}`;
            }
            
            // Open WhatsApp
            window.open(whatsappUrl, '_blank');
            
            // Analytics tracking
            console.log('AgentFlow WhatsApp widget clicked', {
                timestamp: new Date().toISOString(),
                config: settings.apiKey,
                platform: 'whatsapp'
            });
        });
        
        // Assemble widget
        chatButton.appendChild(pulseRing);
        widgetContainer.appendChild(chatButton);
        widgetContainer.appendChild(tooltip);
        
        // Add to page
        document.body.appendChild(widgetContainer);
        
        // Report widget loaded
        console.log('AgentFlow WhatsApp widget loaded successfully');
        
        // Optional: Report to AgentFlow analytics
        if (settings.apiKey) {
            fetch('http://localhost:5000/api/widget-analytics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    apiKey: settings.apiKey,
                    event: 'widget_loaded',
                    platform: 'whatsapp',
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                })
            }).catch(err => console.log('Analytics reporting failed:', err));
        }
    }
    
    // Initialize widget when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWhatsAppWidget);
    } else {
        createWhatsAppWidget();
    }
})();