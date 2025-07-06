# SIPocracy

SIPocracy is a free and open-source SIP web client that allows you to make and receive calls using the SIP protocol directly from your web browser. It is designed to be modern, user-friendly, and installable as a Progressive Web App (PWA).

## Features
- SIP registration and calling (make/receive calls)
- DTMF dialpad and in-call DTMF support
- Call history with direction and timestamp
- Contacts management
- Call transfer, hold, and mute
- HTML5 notifications for incoming calls
- Service Worker and PWA support (installable)
- Responsive UI with Bootstrap 5 and Bootstrap Icons
- Local log storage and export (for debugging)

## Getting Started

### Prerequisites
- A SIP account (username, password, SIP server, and WebSocket server)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Node.js and npm (for development, optional)

### Installation
1. Clone this repository:
   ```sh
   git clone https://github.com/jonp92/sipocracy.git
   cd sipocracy
   ```
2. Serve the `/var/www/sipocracy` directory with your preferred web server (Caddy, nginx, Apache, etc.).
3. Ensure HTTPS is enabled for service worker and SIP WebSocket support.
4. Open `http(s)://your-server/phone.html` in your browser.

### Usage
1. Click the **Login** button and enter your SIP credentials.
2. Use the dialpad to make calls, or answer incoming calls via notifications.
3. Manage your call history and contacts from the main interface.
4. Install the app as a PWA for a native-like experience.

## Project Structure
- `index.html` – Landing page
- `phone.html` – Main SIP client interface
- `static/js/` – JavaScript files (SIP logic, UI, logging, service worker)
- `static/css/` – CSS styles
- `static/img/` – Icons and images
- `static/manifest.json` – PWA manifest

## Development
- Edit JavaScript and CSS in the `static/` directory.
- Use the built-in logging utility for debugging (`window.getLogs()`, `window.downloadLogs()`).
- Customize the UI with Bootstrap and your own styles.

## License
MIT License

## Credits
- [SIP.js](https://sipjs.com/) for SIP stack
- [Bootstrap](https://getbootstrap.com/) and [Bootstrap Icons](https://icons.getbootstrap.com/)
- Open source contributors

---
For questions or contributions, visit the [GitHub repository](https://github.com/jonp92/sipocracy).
