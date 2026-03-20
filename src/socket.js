import {io} from 'socket.io-client';

export const initSocket = async () =>{
  const options = {
    'force new connection': true,
    reconnectionAttempts: 'Infinity',
    timeout: 10000,
    transports: ['websocket'],
  };
  const serverUrl = process.env.REACT_APP_BACKEND_URL || 'https://codeshare-1-sbh9.onrender.com';
  return io(serverUrl, options);
};
