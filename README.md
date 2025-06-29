# WhatsApp Enhanced v3

🚀 **Advanced WhatsApp Web Enhancement with Complete Personalization System**

## 🌟 Features

### 🎯 Core Features
- **Real-time WhatsApp Web Interface** - Modern, responsive web interface
- **QR Code Authentication** - Secure WhatsApp Web connection
- **Live Chat Management** - Real-time message sending and receiving
- **Contact Management** - Complete contact list with search functionality

### ✨ Advanced Personalization
- **Dynamic Token System** - 7 personalization tokens: `{{name}}`, `{{phone}}`, `{{email}}`, `{{company}}`, `{{city}}`, `{{country}}`, `{{custom}}`
- **Live Message Preview** - Real-time preview with token replacement
- **Bulk Messaging** - Send personalized messages to multiple contacts
- **Template Management** - Save and reuse message templates
- **Smart Recipient Selection** - Single, multiple, or all contacts

### 📊 Smart Analytics
- **Message Statistics** - Token count, recipient count, estimated messages
- **Real-time Updates** - Live statistics as you type
- **Contact Filtering** - Advanced search and filter capabilities

### 🛠️ Developer Features
- **Modern Tech Stack** - Node.js, Express, Socket.io, Baileys
- **Responsive Design** - Bootstrap 5 with custom WhatsApp styling
- **Real-time Communication** - WebSocket-based live updates
- **Error Handling** - Comprehensive error management

## 🚀 Live Demo

**Deployed on Railway**: [https://whatsapp-enhanced-v3-production-0017.up.railway.app](https://whatsapp-enhanced-v3-production-0017.up.railway.app)

## 📦 Installation

### Prerequisites
- Node.js 16+
- npm or yarn
- Modern web browser

### Quick Start

```bash
# Clone the repository
git clone https://github.com/r2997790/r2997790.git
cd r2997790

# Install dependencies
npm install

# Start the server
npm start
```

### Development Mode

```bash
# Start with auto-reload
npm run dev
```

## 📋 Usage

### 1. Connect to WhatsApp
1. Open the application in your browser
2. Scan the QR code with WhatsApp mobile app
3. Wait for "Ready" status

### 2. Personalized Messaging
1. Go to the **Personalization** tab
2. Write your message with tokens like `Hello {{name}}, welcome to {{company}}!`
3. Select recipients (single, multiple, or all)
4. Preview your personalized message
5. Click "Send Personalized Messages"

### 3. Token Examples

```text
Hi {{name}}! 👋

Thank you for your interest in our services. We're excited to work with {{company}}.

Our team will contact you at {{phone}} or {{email}} soon.

Best regards,
The {{company}} Team
```

## 🔧 API Endpoints

### WebSocket Events

#### Client → Server
- `getContacts` - Fetch contact list
- `getChats` - Fetch chat list
- `sendMessage` - Send message to contact
- `getMessages` - Get chat history

#### Server → Client
- `qr` - QR code for authentication
- `ready` - WhatsApp client ready
- `contacts` - Contact list data
- `chats` - Chat list data
- `message` - New incoming message
- `message_sent` - Message sent confirmation

## 📁 File Structure

```
r2997790/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── index.html            # Main HTML interface
├── public/
│   ├── app.js            # Main frontend JavaScript
│   ├── PersonalizationManager.js  # Personalization system
│   └── styles.css        # Custom CSS styles
├── README.md             # This file
└── .gitignore           # Git ignore rules
```

## 🚀 Deployment

### Railway Deployment (Recommended)

1. **Connect Repository**:
   - Go to [Railway Dashboard](https://railway.com/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `r2997790/r2997790`
   - Click "Deploy Now"

2. **Automatic Configuration**:
   - Railway auto-detects Node.js
   - Installs dependencies from package.json
   - Starts with `npm start`
   - Generates public URL

### Manual Deployment

```bash
# Build for production
npm install --production

# Start the server
PORT=3000 npm start
```

## 🛠️ Technical Details

### Dependencies

```json
{
  "@whiskeysockets/baileys": "^6.7.5",
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "qrcode": "^1.5.3",
  "cors": "^2.8.5"
}
```

### Architecture

- **Backend**: Node.js + Express + Socket.io
- **WhatsApp Integration**: Baileys library
- **Frontend**: Vanilla JavaScript + Bootstrap 5
- **Real-time Communication**: WebSockets
- **Authentication**: QR Code scanning

## 🔍 Troubleshooting

### Common Issues

1. **QR Code Not Loading**
   - Check server console for errors
   - Ensure port is not blocked
   - Try refreshing the page

2. **Messages Not Sending**
   - Verify WhatsApp connection status
   - Check contact phone number format
   - Ensure message is not empty

3. **Personalization Not Working**
   - Check token syntax: `{{token}}`
   - Verify contact data is loaded
   - Check browser console for errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

For issues and questions:
- Create a GitHub issue
- Check existing documentation
- Review troubleshooting section

---

**WhatsApp Enhanced v3** - The complete personalization system for WhatsApp Web! 🚀