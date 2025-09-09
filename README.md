# WebRTC Video Conferencing App

A modern, feature-rich video conferencing application built with WebRTC technology. This application provides real-time video, audio, and text communication with advanced features like voice activity detection, screen sharing, and cross-platform compatibility.

## 🚀 Features

### Core Communication
- **Real-time Video Calls** - High-quality video conferencing with multiple participants
- **Crystal Clear Audio** - Optimized audio processing with noise reduction and echo cancellation
- **Text Chat** - Real-time messaging system with message history and user identification
- **Screen Sharing** - Share your screen with other participants (desktop/Android only)

### Advanced Audio Features
- **Voice Activity Detection** - Automatically highlights the current speaker
- **Audio Level Monitoring** - Visual audio level indicators for each participant
- **Smart Audio Processing** - Automatic gain control and audio enhancement
- **Cross-platform Audio** - Optimized for iOS, Android, and desktop browsers

### User Experience
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Theme Customization** - Multiple themes (Default, Dark, Light, Purple) with local storage
- **Professional UI/UX** - Modern interface with smooth animations and transitions
- **Connection Status** - Real-time connection monitoring with auto-reconnect functionality

### Technical Features
- **Cross-platform Codec Support** - Optimized codec selection for iOS, Android, and desktop
- **Robust Reconnection** - Automatic reconnection handling for network issues
- **ICE Restart** - Advanced WebRTC connection recovery mechanisms
- **Progressive Web App** - Installable with offline capabilities and push notifications
- **Device Detection** - Smart feature detection based on device capabilities

### Security & Privacy
- **Peer-to-Peer Communication** - Direct connections between participants
- **No Server Storage** - Messages and calls are not stored on servers
- **Local Data Storage** - User preferences stored locally on device
- **Secure Signaling** - Encrypted signaling through Scaledrone

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **WebRTC**: Real-time communication protocols
- **Signaling**: Scaledrone for real-time messaging
- **Build Tool**: Vite for fast development and building
- **PWA**: Service Worker for offline functionality
- **Audio Processing**: Web Audio API for advanced audio features

## 📱 Browser Support

### Desktop
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

### Mobile
- ✅ Chrome Mobile 80+
- ✅ Safari iOS 13+
- ✅ Samsung Internet 12+
- ✅ Firefox Mobile 75+

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with WebRTC support
- HTTPS connection (required for WebRTC)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd webrtc
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

### Configuration

1. **Set up Scaledrone** (for signaling)
   - Create account at [Scaledrone](https://www.scaledrone.com/)
   - Get your channel ID
   - Update the channel ID in `src/javascript/signalling.js`

2. **Configure HTTPS** (required for WebRTC)
   - Use a local HTTPS server or deploy to a secure domain
   - For local development, you can use tools like `mkcert` or `ngrok`

## 📖 Usage

### Starting a Call
1. Open the application in your browser
2. Enter your nickname and room name
3. Allow camera and microphone permissions
4. Share the room link with other participants

### Features Usage
- **Toggle Camera**: Click the camera button to turn video on/off
- **Mute/Unmute**: Click the microphone button to control audio
- **Screen Share**: Click the share button (desktop/Android only)
- **Chat**: Click the 💬 button to open the chat panel
- **Themes**: Use the theme selector to change the appearance
- **Reconnect**: Use the retry button if connection issues occur

## 🏗️ Project Structure

```
webrtc/
├── src/
│   ├── javascript/
│   │   ├── app.js          # Main application logic
│   │   ├── room.js         # WebRTC room management
│   │   ├── media.js        # Media stream handling
│   │   ├── signalling.js   # Signaling server communication
│   │   ├── chat.js         # Chat functionality
│   │   ├── recording.js    # Screen recording
│   │   ├── toast.js        # Toast notifications
│   │   ├── theme.js        # Theme management
│   │   ├── util.js         # Utility functions
│   │   └── main.js         # Service worker registration
│   └── styles/
│       ├── style.css       # Main styles with CSS variables
│       ├── channel.css     # Video channel styles
│       └── userInfoModal.css # Modal styles
├── public/                 # Static assets
├── dist/                   # Built application
├── index.html             # Main HTML file
├── manifest.json          # PWA manifest
└── vite.config.js         # Vite configuration
```

## 🔧 Configuration Options

### Audio Settings
- Voice activity detection threshold: `20` (adjustable in `media.js`)
- Audio level monitoring interval: `100ms`
- Voice activity timeout: `500ms`

### Video Settings
- Preferred codecs: H264 (iOS), VP8 (Android), H264/VP8 (Desktop)
- Screen sharing constraints: Optimized for different platforms
- Video quality: Adaptive based on connection

### Theme Variables
All colors, shadows, and spacing are customizable through CSS variables in `style.css`.

## 🚀 Future Features

### Planned Enhancements

#### 🎥 Advanced Video Features
- **Virtual Backgrounds** - AI-powered background replacement
- **Video Filters** - Real-time video effects and filters
- **Picture-in-Picture** - Floating video windows
- **Video Recording** - Local recording of meetings
- **HD Video Support** - 4K video streaming capabilities

#### 🎵 Enhanced Audio Features
- **Spatial Audio** - 3D audio positioning for participants
- **Audio Effects** - Voice changers and audio filters
- **Music Mode** - Optimized audio for music sharing
- **Audio Recording** - High-quality audio capture
- **Noise Cancellation** - AI-powered noise reduction

#### 💬 Advanced Chat Features
- **File Sharing** - Send images, documents, and files
- **Emoji Reactions** - React to messages with emojis
- **Message Threading** - Reply to specific messages
- **Chat History** - Persistent message storage
- **Rich Text** - Bold, italic, and formatted messages

#### 🔐 Security & Privacy
- **End-to-End Encryption** - Encrypted video and audio streams
- **Meeting Passwords** - Password-protected rooms
- **Waiting Rooms** - Host approval for participants
- **User Authentication** - Login system with user accounts
- **Meeting Analytics** - Usage statistics and insights

#### 🤖 AI-Powered Features
- **Live Transcription** - Real-time speech-to-text
- **Language Translation** - Multi-language support
- **Meeting Summaries** - AI-generated meeting notes
- **Smart Muting** - Automatic noise detection and muting
- **Gesture Recognition** - Hand raise and gesture detection

#### 📱 Mobile Enhancements
- **Native Mobile Apps** - iOS and Android applications
- **Push Notifications** - Mobile notification system
- **Offline Mode** - Limited functionality without internet
- **Mobile Optimizations** - Touch gestures and mobile UI

#### 🔧 Developer Features
- **API Integration** - RESTful API for third-party integrations
- **Webhook Support** - Event notifications for external systems
- **Custom Plugins** - Plugin system for extensions
- **Analytics Dashboard** - Detailed usage analytics
- **White-label Solution** - Customizable branding options

#### 🌐 Enterprise Features
- **User Management** - Admin panel for user control
- **Meeting Scheduling** - Calendar integration
- **Recording Storage** - Cloud-based recording storage
- **Compliance** - GDPR, HIPAA compliance features
- **SSO Integration** - Single sign-on support

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC** - For the real-time communication technology
- **Scaledrone** - For the signaling service
- **Vite** - For the fast build tool
- **Contributors** - All the amazing people who contribute to this project

## 📞 Support

- **Documentation**: Check this README and code comments
- **Issues**: Report bugs and request features on GitHub Issues
- **Discussions**: Join our community discussions
- **Email**: Contact us at [your-email@domain.com]

---

**Made with ❤️ for the open-source community**
