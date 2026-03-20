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
    PERMISSION_UPDATED: 'permission-updated',
    PERMISSION_DENIED: 'permission-denied',
    CLIENTS_UPDATED: 'clients-updated',
    JOIN_REQUEST: 'join-request',
    APPROVE_JOIN: 'approve-join',
    REJECT_JOIN: 'reject-join',
    JOIN_APPROVED: 'join-approved',
    JOIN_REJECTED: 'join-rejected',
};

module.exports = ACTIONS;
