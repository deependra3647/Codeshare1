# Actions.js File Created ✅

## 📁 File Created

**Location**: `my-app/src/Actions.js`

```javascript
const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    KICK_USER: 'kick-user',
    USER_KICKED: 'user-kicked',
    TOGGLE_WRITE: 'toggle-write',
    PERMISSION_DENIED: 'permission-denied',
    PERMISSION_UPDATED: 'permission-updated',
    CLIENTS_UPDATED: 'clients-updated'
};

export default ACTIONS;
```

## 🎯 Purpose

This file contains all the socket action constants used for real-time communication between the client and server in your code sharing application.

## 🔧 Usage

The Actions are imported and used in:
- `EditorPage.js` - For socket communication
- `Editor.js` - For code change events
- `server.js` - For handling socket events

## ✅ Compilation Fixed

The compilation error `Module not found: Error: Can't resolve '../Actions'` has been resolved.

Your app should now compile successfully with:
```bash
npm run start:front
```

## 🚀 Features Enabled

With this Actions.js file, the following features will work:
- Real-time code collaboration
- User join/leave notifications
- Room management
- Admin permissions
- Code synchronization
- User kick functionality
- Write permission toggles

No theme functions included - just the essential Actions constants for socket communication.