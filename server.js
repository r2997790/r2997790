const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const multer = require('multer');
const cors = require('cors');
const mime = require('mime-types');
const fsExtra = require('fs-extra');
const cron = require('node-cron');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory with proper MIME types
app.use('/public', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create necessary directories
const createDirectories = () => {
    const dirs = ['./auth_info_baileys', './data', './uploads'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

// Data file paths
const DATA_FILES = {
    templates: './data/templates.json',
    contactGroups: './data/contact_groups.json',
    messages: './data/messages.json'
};

// Initialize data files
const initializeDataFiles = () => {
    Object.values(DATA_FILES).forEach(file => {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify([]));
        }
    });
};

// Utility functions for data management
const loadData = (filename) => {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return [];
    }
};

const saveData = (filename, data) => {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving ${filename}:`, error);
        return false;
    }
};

// WhatsApp variables
let sock;
let qrCodeData = null;
let isConnected = false;
let contacts = new Map();
let groups = new Map();

// Store message
const storeMessage = (messageData) => {
    try {
        const messages = loadData(DATA_FILES.messages);
        messages.push(messageData);
        
        // Keep only last 1000 messages
        if (messages.length > 1000) {
            messages.splice(0, messages.length - 1000);
        }
        
        saveData(DATA_FILES.messages, messages);
    } catch (error) {
        console.error('Error storing message:', error);
    }
};

// WhatsApp connection function
const connectToWhatsApp = async () => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['WhatsApp Web Client', 'Chrome', '4.0.0']
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    qrCodeData = await QRCode.toDataURL(qr);
                    console.log('QR Code generated and sent to clients');
                    io.emit('qr-code', qrCodeData);
                } catch (error) {
                    console.error('Error generating QR code:', error);
                }
            }
            
            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                
                io.emit('connection-status', { connected: false });
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(), 3000);
                }
            } else if (connection === 'open') {
                isConnected = true;
                qrCodeData = null;
                console.log('WhatsApp connected successfully');
                
                io.emit('connection-status', { connected: true });
                
                // Load contacts and groups
                setTimeout(async () => {
                    await loadContactsAndGroups();
                }, 2000);
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const message of messages) {
                    if (message.message) {
                        const messageData = {
                            id: message.key.id,
                            from: message.key.remoteJid,
                            to: sock.user?.id || '',
                            message: message.message.conversation || 
                                    message.message.extendedTextMessage?.text || 
                                    'Media message',
                            timestamp: Date.now(),
                            type: 'received',
                            status: 'delivered'
                        };
                        
                        storeMessage(messageData);
                        io.emit('new-message', messageData);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error connecting to WhatsApp:', error);
        setTimeout(() => connectToWhatsApp(), 5000);
    }
};

// Load contacts and groups
const loadContactsAndGroups = async () => {
    try {
        if (sock && isConnected) {
            // Get contacts
            const contactsList = Object.entries(sock.authState.creds.contacts || {});
            contacts.clear();
            
            contactsList.forEach(([jid, contact]) => {
                if (jid.includes('@s.whatsapp.net')) {
                    contacts.set(jid, {
                        jid,
                        name: contact.name || contact.notify || jid.split('@')[0],
                        phone: jid.split('@')[0]
                    });
                }
            });
            
            // Get groups
            const groupsList = await sock.groupFetchAllParticipating();
            groups.clear();
            
            Object.values(groupsList).forEach(group => {
                groups.set(group.id, {
                    jid: group.id,
                    subject: group.subject,
                    participants: group.participants.map(p => p.id)
                });
            });
            
            console.log(`Loaded ${contacts.size} contacts and ${groups.size} groups`);
            
            // Send to clients
            io.emit('contacts-loaded', Array.from(contacts.values()));
            io.emit('groups-loaded', Array.from(groups.values()));
        }
    } catch (error) {
        console.error('Error loading contacts and groups:', error);
    }
};

// API Routes

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        connected: isConnected,
        qrCode: qrCodeData,
        contactsCount: contacts.size,
        groupsCount: groups.size
    });
});

// QR Code endpoint
app.get('/api/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qrCode: qrCodeData });
    } else {
        res.status(404).json({ error: 'QR code not available' });
    }
});

// Contacts endpoint
app.get('/api/contacts', (req, res) => {
    res.json(Array.from(contacts.values()));
});

// Groups endpoint
app.get('/api/groups', (req, res) => {
    res.json(Array.from(groups.values()));
});

// Messages endpoint
app.get('/api/messages/:chatId', (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = loadData(DATA_FILES.messages);
        const chatMessages = messages.filter(msg => 
            msg.from === chatId || msg.to === chatId
        ).slice(-50); // Last 50 messages
        
        res.json(chatMessages);
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Messaging endpoints
app.post('/api/send-message', async (req, res) => {
    try {
        if (!sock || !isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const { to, message, type = 'text' } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let result;
        
        if (type === 'text') {
            result = await sock.sendMessage(to, { text: message });
        } else {
            return res.status(400).json({ error: 'Unsupported message type' });
        }

        // Store sent message
        const messageData = {
            id: result.key.id,
            to: to,
            message: message,
            timestamp: Date.now(),
            type: 'sent',
            status: 'sent'
        };
        
        storeMessage(messageData);
        io.emit('message-sent', messageData);

        res.json({ success: true, messageId: result.key.id });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Template management endpoints
app.get('/api/templates', (req, res) => {
    try {
        const templates = loadData(DATA_FILES.templates);
        res.json(templates);
    } catch (error) {
        console.error('Error loading templates:', error);
        res.status(500).json({ error: 'Failed to load templates' });
    }
});

app.post('/api/templates', (req, res) => {
    try {
        const { name, content, variables } = req.body;
        
        if (!name || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const templates = loadData(DATA_FILES.templates);
        const newTemplate = {
            id: Date.now().toString(),
            name,
            content,
            variables: variables || [],
            createdAt: new Date().toISOString()
        };

        templates.push(newTemplate);
        saveData(DATA_FILES.templates, templates);

        res.json(newTemplate);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Bulk messaging endpoint for personalization
app.post('/api/send-bulk-personalized', async (req, res) => {
    try {
        if (!sock || !isConnected) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const { recipients, messageTemplate, delay = 3000 } = req.body;
        
        if (!recipients || !Array.isArray(recipients) || !messageTemplate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const results = {
            total: recipients.length,
            success: 0,
            failed: 0,
            errors: []
        };

        // Send messages with delay
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            
            try {
                // Personalize message for this recipient
                let personalizedMessage = messageTemplate;
                
                // Replace tokens with recipient data
                if (recipient.name) {
                    personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/g, recipient.name);
                }
                if (recipient.phone) {
                    personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/g, recipient.phone);
                }
                if (recipient.email) {
                    personalizedMessage = personalizedMessage.replace(/\{\{email\}\}/g, recipient.email);
                }
                if (recipient.company) {
                    personalizedMessage = personalizedMessage.replace(/\{\{company\}\}/g, recipient.company);
                }
                if (recipient.position) {
                    personalizedMessage = personalizedMessage.replace(/\{\{position\}\}/g, recipient.position);
                }
                if (recipient.customField1) {
                    personalizedMessage = personalizedMessage.replace(/\{\{customField1\}\}/g, recipient.customField1);
                }
                if (recipient.customField2) {
                    personalizedMessage = personalizedMessage.replace(/\{\{customField2\}\}/g, recipient.customField2);
                }

                // Send the personalized message
                const result = await sock.sendMessage(recipient.jid, { text: personalizedMessage });
                
                // Store sent message
                const messageData = {
                    id: result.key.id,
                    to: recipient.jid,
                    message: personalizedMessage,
                    timestamp: Date.now(),
                    type: 'sent',
                    status: 'sent',
                    bulk: true
                };
                
                storeMessage(messageData);
                io.emit('message-sent', messageData);
                
                results.success++;
                
                // Add delay between messages (except for the last one)
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
            } catch (error) {
                console.error(`Error sending to ${recipient.jid}:`, error);
                results.failed++;
                results.errors.push({
                    recipient: recipient.jid,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            results: results
        });
        
    } catch (error) {
        console.error('Error sending bulk messages:', error);
        res.status(500).json({ error: 'Failed to send bulk messages' });
    }
});

// Token suggestion endpoint
app.get('/api/personalization/tokens', (req, res) => {
    try {
        const availableTokens = [
            { token: '{{name}}', description: 'Contact name' },
            { token: '{{phone}}', description: 'Contact phone number' },
            { token: '{{email}}', description: 'Contact email address' },
            { token: '{{company}}', description: 'Contact company' },
            { token: '{{position}}', description: 'Contact position' },
            { token: '{{customField1}}', description: 'Custom field 1' },
            { token: '{{customField2}}', description: 'Custom field 2' }
        ];
        
        res.json(availableTokens);
    } catch (error) {
        console.error('Error getting tokens:', error);
        res.status(500).json({ error: 'Failed to get tokens' });
    }
});

// Template variable detection endpoint
app.post('/api/personalization/detect-variables', (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Missing content' });
        }
        
        // Extract variables from template content
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables = [];
        let match;
        
        while ((match = variableRegex.exec(content)) !== null) {
            const variable = match[1].trim();
            if (!variables.includes(variable)) {
                variables.push(variable);
            }
        }
        
        res.json({ variables });
    } catch (error) {
        console.error('Error detecting variables:', error);
        res.status(500).json({ error: 'Failed to detect variables' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current status
    socket.emit('connection-status', { connected: isConnected });
    
    if (qrCodeData) {
        socket.emit('qr-code', qrCodeData);
    }
    
    if (isConnected) {
        socket.emit('contacts-loaded', Array.from(contacts.values()));
        socket.emit('groups-loaded', Array.from(groups.values()));
    }
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
    console.log(`WhatsApp Web Client server running on port ${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'public')}`);
    
    // Initialize directories and data files
    createDirectories();
    initializeDataFiles();
    
    // Initialize WhatsApp connection
    console.log('Initializing WhatsApp connection...');
    await connectToWhatsApp();
});

module.exports = { app, server, io };