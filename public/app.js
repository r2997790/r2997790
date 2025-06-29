/**
 * WhatsApp Enhanced v3 - Main Application JavaScript
 * Handles socket connections, UI management, and core functionality
 */

class WhatsAppEnhanced {
    constructor() {
        this.socket = null;
        this.currentChat = null;
        this.contacts = [];
        this.chats = [];
        this.connected = false;
        
        this.init();
    }

    init() {
        this.setupSocket();
        this.bindEvents();
        this.updateConnectionStatus(false);
    }

    setupSocket() {
        this.socket = io();
        window.socket = this.socket; // Make available globally for PersonalizationManager

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            this.updateConnectionStatus(false);
        });

        // WhatsApp events
        this.socket.on('qr', (qr) => {
            console.log('QR Code received');
            this.displayQRCode(qr);
        });

        this.socket.on('ready', () => {
            console.log('WhatsApp client ready');
            this.hideQRCode();
            this.showWelcomeScreen();
            this.loadContacts();
            this.loadChats();
        });

        this.socket.on('authenticated', () => {
            console.log('WhatsApp authenticated');
            this.updateConnectionStatus(true, 'Authenticated');
        });

        this.socket.on('auth_failure', () => {
            console.log('WhatsApp authentication failed');
            this.updateConnectionStatus(false, 'Auth Failed');
        });

        this.socket.on('disconnected', () => {
            console.log('WhatsApp disconnected');
            this.updateConnectionStatus(false, 'Disconnected');
            this.showQRSection();
        });

        // Message events
        this.socket.on('message', (message) => {
            console.log('New message received:', message);
            this.handleNewMessage(message);
        });

        this.socket.on('message_sent', (data) => {
            console.log('Message sent:', data);
            this.handleMessageSent(data);
        });

        this.socket.on('message_error', (error) => {
            console.error('Message error:', error);
            this.showAlert('Error sending message: ' + error.message, 'danger');
        });

        // Contact and chat events
        this.socket.on('contacts', (contacts) => {
            console.log('Contacts received:', contacts.length);
            this.updateContacts(contacts);
        });

        this.socket.on('chats', (chats) => {
            console.log('Chats received:', chats.length);
            this.updateChats(chats);
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showAlert('Connection error: ' + error, 'danger');
        });
    }

    bindEvents() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                location.reload();
            });
        }

        // Send message
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageText');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Chat and contact search
        const chatSearch = document.getElementById('chatSearch');
        const contactSearch = document.getElementById('contactSearch');
        
        if (chatSearch) {
            chatSearch.addEventListener('input', (e) => {
                this.filterChats(e.target.value);
            });
        }

        if (contactSearch) {
            contactSearch.addEventListener('input', (e) => {
                this.filterContacts(e.target.value);
            });
        }

        // Tab switching
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const target = e.target.getAttribute('data-bs-target');
                if (target === '#personalization') {
                    // Update personalization manager with current contacts
                    if (window.personalizationManager) {
                        window.personalizationManager.updateContacts(this.contacts);
                    }
                }
            });
        });
    }

    updateConnectionStatus(connected, status = null) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        if (connected) {
            statusElement.className = 'badge bg-success me-2';
            statusElement.textContent = status || 'Connected';
        } else {
            statusElement.className = 'badge bg-danger me-2';
            statusElement.textContent = status || 'Disconnected';
        }
    }

    displayQRCode(qr) {
        const qrContainer = document.getElementById('qrCodeContainer');
        if (!qrContainer) return;

        // Clear existing content
        qrContainer.innerHTML = '';

        // Create QR code
        QRCode.toCanvas(qr, { width: 256, margin: 2 }, (error, canvas) => {
            if (error) {
                console.error('QR Code generation failed:', error);
                qrContainer.innerHTML = '<div class="alert alert-danger">Failed to generate QR code</div>';
                return;
            }

            canvas.className = 'border rounded';
            qrContainer.appendChild(canvas);
        });

        // Show QR section
        this.showQRSection();
    }

    hideQRCode() {
        const qrSection = document.getElementById('qrSection');
        if (qrSection) {
            qrSection.style.display = 'none';
        }
    }

    showQRSection() {
        const qrSection = document.getElementById('qrSection');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const chatHeader = document.getElementById('chatHeader');
        const messagesArea = document.getElementById('messagesArea');
        const messageInput = document.getElementById('messageInput');

        if (qrSection) qrSection.style.display = 'flex';
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'none';
        if (messagesArea) messagesArea.style.display = 'none';
        if (messageInput) messageInput.style.display = 'none';
    }

    showWelcomeScreen() {
        const qrSection = document.getElementById('qrSection');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const chatHeader = document.getElementById('chatHeader');
        const messagesArea = document.getElementById('messagesArea');
        const messageInput = document.getElementById('messageInput');

        if (qrSection) qrSection.style.display = 'none';
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
        if (chatHeader) chatHeader.style.display = 'none';
        if (messagesArea) messagesArea.style.display = 'none';
        if (messageInput) messageInput.style.display = 'none';
    }

    loadContacts() {
        this.socket.emit('getContacts');
    }

    loadChats() {
        this.socket.emit('getChats');
    }

    updateContacts(contacts) {
        this.contacts = contacts.map((contact, index) => ({
            id: contact.id || index.toString(),
            name: contact.name || contact.pushname || 'Unknown',
            number: contact.id,
            email: contact.email || '',
            company: contact.company || '',
            city: contact.city || '',
            country: contact.country || '',
            custom: contact.custom || ''
        }));
        
        this.displayContacts();
        
        // Update personalization manager if available
        if (window.personalizationManager) {
            window.personalizationManager.updateContacts(this.contacts);
        }
    }

    updateChats(chats) {
        this.chats = chats;
        this.displayChats();
    }

    displayContacts(filter = '') {
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;

        const filteredContacts = this.contacts.filter(contact => 
            contact.name.toLowerCase().includes(filter.toLowerCase()) ||
            contact.number.includes(filter)
        );

        contactsList.innerHTML = '';

        if (filteredContacts.length === 0) {
            contactsList.innerHTML = '<div class="text-center text-muted py-3">No contacts found</div>';
            return;
        }

        filteredContacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'contact-item border-bottom p-2 cursor-pointer';
            contactElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="contact-avatar me-2">
                        <i class="fas fa-user-circle fa-2x text-secondary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0">${contact.name}</h6>
                        <small class="text-muted">${contact.number}</small>
                    </div>
                </div>
            `;
            
            contactElement.addEventListener('click', () => {
                this.selectContact(contact);
            });
            
            contactsList.appendChild(contactElement);
        });
    }

    displayChats(filter = '') {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        const filteredChats = this.chats.filter(chat => 
            (chat.name && chat.name.toLowerCase().includes(filter.toLowerCase())) ||
            chat.id.includes(filter)
        );

        chatsList.innerHTML = '';

        if (filteredChats.length === 0) {
            chatsList.innerHTML = '<div class="text-center text-muted py-3">No chats found</div>';
            return;
        }

        filteredChats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = 'chat-item border-bottom p-2 cursor-pointer';
            
            const lastMessage = chat.lastMessage || '';
            const timestamp = chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString() : '';
            
            chatElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="chat-avatar me-2">
                        <i class="fas fa-${chat.isGroup ? 'users' : 'user'}-circle fa-2x text-secondary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${chat.name || chat.id}</h6>
                            <small class="text-muted">${timestamp}</small>
                        </div>
                        <p class="text-muted small mb-0">${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}</p>
                    </div>
                </div>
            `;
            
            chatElement.addEventListener('click', () => {
                this.selectChat(chat);
            });
            
            chatsList.appendChild(chatElement);
        });
    }

    filterContacts(filter) {
        this.displayContacts(filter);
    }

    filterChats(filter) {
        this.displayChats(filter);
    }

    selectContact(contact) {
        this.currentChat = {
            id: contact.number,
            name: contact.name,
            isGroup: false
        };
        
        this.showChatInterface();
        this.loadMessages(contact.number);
    }

    selectChat(chat) {
        this.currentChat = chat;
        this.showChatInterface();
        this.loadMessages(chat.id);
    }

    showChatInterface() {
        const qrSection = document.getElementById('qrSection');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const chatHeader = document.getElementById('chatHeader');
        const messagesArea = document.getElementById('messagesArea');
        const messageInput = document.getElementById('messageInput');
        const chatName = document.getElementById('chatName');
        const chatStatus = document.getElementById('chatStatus');

        if (qrSection) qrSection.style.display = 'none';
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'block';
        if (messagesArea) messagesArea.style.display = 'block';
        if (messageInput) messageInput.style.display = 'block';
        
        if (chatName && this.currentChat) {
            chatName.textContent = this.currentChat.name || this.currentChat.id;
        }
        
        if (chatStatus) {
            chatStatus.textContent = this.currentChat?.isGroup ? 'Group Chat' : 'Personal Chat';
        }
    }

    loadMessages(chatId) {
        this.socket.emit('getMessages', { chatId });
    }

    sendMessage() {
        const messageInput = document.getElementById('messageText');
        if (!messageInput || !this.currentChat) return;

        const message = messageInput.value.trim();
        if (!message) return;

        this.socket.emit('sendMessage', {
            number: this.currentChat.id,
            message: message
        });

        messageInput.value = '';
    }

    handleNewMessage(message) {
        if (this.currentChat && message.from === this.currentChat.id) {
            this.addMessageToChat(message, false);
        }
        
        // Update chat list
        this.updateChatInList(message);
    }

    handleMessageSent(data) {
        if (this.currentChat && data.to === this.currentChat.id) {
            this.addMessageToChat({
                body: data.message,
                timestamp: Date.now(),
                from: 'me'
            }, true);
        }
    }

    addMessageToChat(message, sent = false) {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${sent ? 'sent' : 'received'} mb-2`;
        
        const timestamp = new Date(message.timestamp || Date.now()).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-content p-2 rounded ${sent ? 'bg-primary text-white ms-auto' : 'bg-light'}" style="max-width: 70%;">
                <div class="message-text">${this.escapeHtml(message.body || '')}</div>
                <small class="message-time d-block mt-1 ${sent ? 'text-white-50' : 'text-muted'}">${timestamp}</small>
            </div>
        `;
        
        messagesList.appendChild(messageElement);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    updateChatInList(message) {
        // Update the chat in the list with the latest message
        const existingChatIndex = this.chats.findIndex(chat => chat.id === message.from);
        
        if (existingChatIndex >= 0) {
            this.chats[existingChatIndex].lastMessage = message.body;
            this.chats[existingChatIndex].timestamp = message.timestamp;
        } else {
            // Add new chat
            this.chats.unshift({
                id: message.from,
                name: message.pushname || message.from,
                lastMessage: message.body,
                timestamp: message.timestamp,
                isGroup: false
            });
        }
        
        this.displayChats();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Initialize application when DOM is loaded
let whatsappApp;
document.addEventListener('DOMContentLoaded', () => {
    whatsappApp = new WhatsAppEnhanced();
    window.whatsappApp = whatsappApp; // Make available globally
});