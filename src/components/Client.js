import React from 'react';
import Avatar from 'react-avatar';


const Client = ({ username, socketId, isAdmin, clientIsAdmin, canWrite, onKick, onToggleWrite }) => {
  return (
    <div className="client">
      <Avatar name={username} size={50} round="14px"/>
      <span className="userName">{username}</span>
      {clientIsAdmin && (
        <span className="adminBadge" title="Admin">Admin</span>
      )}
      {!clientIsAdmin && canWrite !== undefined && (
        <span className={`writeBadge ${canWrite ? 'canWrite' : 'noWrite'}`} title={canWrite ? 'Can write' : 'Cannot write'}>
          {canWrite ? '✏️' : '🔒'}
        </span>
      )}
      {isAdmin && socketId && onKick && (
        <button 
          className="kickBtn" 
          onClick={() => onKick(socketId)}
          title="Kick user"
        >
          ✕
        </button>
      )}
      {isAdmin && socketId && onToggleWrite && !clientIsAdmin && (
        <button 
          className="writeToggleBtn" 
          onClick={() => onToggleWrite(socketId)}
          title={canWrite ? 'Revoke write permission' : 'Grant write permission'}
        >
          {canWrite ? '🔒' : '✏️'}
        </button>
      )}
    </div>
  )
}
export default Client;