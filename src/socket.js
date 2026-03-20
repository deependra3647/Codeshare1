import {io} from 'socket.io-client';

export const initSocket = async () =>{
  const options = {
    'force new connection': true,
    reconnectionAttempts: 'Infinity',
    timeout: 10000,
    transports: ['websocket'],
  };
  // In production the React build is served by the same Express server,
  // so fall back to window.location.origin when the env var is not set.
  const serverUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  return io(serverUrl, options);
};
