import React, { useRef, useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import Client from "../components/Client";
import Editor from "../components/Editor";
import OutputPanel from "../components/OutputPanel";
import FileSharePanel from "../components/FileSharePanel";
import AIExplainerPanel from "../components/AIExplainerPanel";
import { initSocket } from "../socket";
import { useLocation, useNavigate, Navigate, useParams } from "react-router-dom";
import { LANGUAGES, TEMPLATES } from "../LanguageTemplates";

const DEFAULT_LANGUAGE = LANGUAGES[0]; // Plain Text

const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const codePerLang = useRef({}); // stores code per language id
  const cmInstanceRef = useRef(null); // CodeMirror instance exposed by Editor
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();

  const [clients, setClients] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canWrite, setCanWrite] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  // templateCode is passed to Editor to trigger setValue — null means "don't inject"
  const [templateCode, setTemplateCode] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runStdout, setRunStdout] = useState('');
  const [runStderr, setRunStderr] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [stdin, setStdin] = useState('');
  const [sharedFiles, setSharedFiles] = useState([]);
  const [showAIPanel, setShowAIPanel] = useState(false);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on('connect_error', (err) => handleErrors(err));
      socketRef.current.on('connect_failed', (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator('/');
      }

      setIsPending(true);
      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId, isAdmin: adminStatus, canWrite: writePermission, code, language }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);

          if (socketId === socketRef.current.id) {
            setIsPending(false);
            if (adminStatus !== undefined) setIsAdmin(adminStatus);
            if (writePermission !== undefined) setCanWrite(writePermission);
            // Restore language if room already has one
            if (language) {
              const lang = LANGUAGES.find(l => l.id === language) || DEFAULT_LANGUAGE;
              setCurrentLanguage(lang);
            }
            if (code !== null && code !== undefined) codeRef.current = code;
            if (codeRef.current) {
              socketRef.current.emit(ACTIONS.SYNC_CODE, { code: codeRef.current, socketId });
            }
          }

          const currentClient = clients.find(c => c.socketId === socketRef.current.id);
          if (currentClient && currentClient.canWrite !== undefined) setCanWrite(currentClient.canWrite);
        }
      );

      socketRef.current.on(
        ACTIONS.DISCONNECTED,
        ({ socketId, username, clients: updatedClients }) => {
          toast.success(`${username} left the room.`);
          if (updatedClients) {
            setClients(updatedClients);
            const me = updatedClients.find(c => c.socketId === socketRef.current.id);
            if (me && me.isAdmin) setIsAdmin(true);
          } else {
            setClients(prev => prev.filter(c => c.socketId !== socketId));
          }
        }
      );

      socketRef.current.on(ACTIONS.USER_KICKED, ({ message }) => {
        toast.error(message || 'You have been kicked from the room.');
        reactNavigator('/');
      });

      socketRef.current.on(ACTIONS.PERMISSION_DENIED, ({ message }) => {
        toast.error(message || 'You do not have permission to write.');
      });

      socketRef.current.on(ACTIONS.PERMISSION_UPDATED, ({ canWrite: writePermission }) => {
        if (writePermission !== undefined) {
          setCanWrite(writePermission);
          writePermission
            ? toast.success('Write permission granted by admin.')
            : toast.error('Write permission revoked by admin.');
        }
      });

      socketRef.current.on(ACTIONS.CLIENTS_UPDATED, ({ clients: updatedClients }) => {
        if (updatedClients) {
          setClients(updatedClients);
          const me = updatedClients.find(c => c.socketId === socketRef.current.id);
          if (me && me.canWrite !== undefined) setCanWrite(me.canWrite);
        }
      });

      socketRef.current.on(ACTIONS.JOIN_REQUEST, ({ socketId, username }) => {
        setJoinRequests(prev => [...prev, { socketId, username }]);
      });

      socketRef.current.on(ACTIONS.JOIN_APPROVED, () => {
        setIsPending(false);
      });

      socketRef.current.on(ACTIONS.JOIN_REJECTED, ({ message }) => {
        toast.error(message || 'Your join request was denied.');
        reactNavigator('/');
      });

      socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ languageId, code }) => {
        const lang = LANGUAGES.find(l => l.id === languageId) || DEFAULT_LANGUAGE;
        setCurrentLanguage(lang);
        if (languageId !== 'fileshare' && code !== undefined && code !== null) {
          codeRef.current = code;
          setTemplateCode(code);
        }
        toast(`${languageId === 'fileshare' ? '📁' : '🌐'} ${lang.label}`, { icon: languageId === 'fileshare' ? '📁' : '🌐' });
      });

      // File share — receive file shared by someone in the room
      socketRef.current.on(ACTIONS.FILE_SHARE, ({ file }) => {
        setSharedFiles(prev => [...prev, file]);
        toast(`📁 ${file.name} shared by ${file.sharedBy}`, { icon: '📁' });
      });
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.USER_KICKED);
        socketRef.current.off(ACTIONS.PERMISSION_DENIED);
        socketRef.current.off(ACTIONS.PERMISSION_UPDATED);
        socketRef.current.off(ACTIONS.CLIENTS_UPDATED);
        socketRef.current.off(ACTIONS.JOIN_REQUEST);
        socketRef.current.off(ACTIONS.JOIN_APPROVED);
        socketRef.current.off(ACTIONS.JOIN_REJECTED);
        socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
        socketRef.current.off(ACTIONS.FILE_SHARE);
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Language change handler ──────────────────────────────────────────────
  function handleLanguageChange(e) {
    const langId = e.target.value;
    const lang = LANGUAGES.find(l => l.id === langId) || DEFAULT_LANGUAGE;

    if (langId === 'fileshare') {
      setCurrentLanguage(lang);
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, { roomId, languageId: langId, code: codeRef.current });
      }
      toast.success('Switched to File Share');
      return;
    }

    // Save current editor code before switching language (skip for fileshare)
    if (currentLanguage.id !== 'fileshare') {
      codePerLang.current[currentLanguage.id] = codeRef.current || '';
    }

    // Restore previously typed code, or fall back to boilerplate template
    const restored = (codePerLang.current[langId] !== undefined && codePerLang.current[langId] !== '')
      ? codePerLang.current[langId]
      : (TEMPLATES[langId] || '');

    setCurrentLanguage(lang);
    setTemplateCode(restored);
    codeRef.current = restored;

    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, { roomId, languageId: langId, code: restored });
      socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code: restored });
    }

    toast.success(`Switched to ${lang.label}`);
  }

  // ── File Share ────────────────────────────────────────────────────────────
  function handleFileUpload(fileData) {
    const file = { ...fileData, sharedBy: location.state?.username || 'Unknown' };
    setSharedFiles(prev => [...prev, file]);
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.FILE_SHARE, { roomId, file });
    }
    toast.success(`📁 ${file.name} shared with the room`);
  }

  // ── Download ─────────────────────────────────────────────────────────────
  async function logDownload(code) {
    try {
      const apiBase = process.env.REACT_APP_API_URL || window.location.origin;
      await fetch(new URL('/api/downloads', apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, username: location.state?.username || 'unknown', code }),
      });
    } catch (err) {
      console.error('Failed to log download', err);
    }
  }

  async function downloadCode() {
    const code = codeRef.current || '';
    const ext = getExtension(currentLanguage.id);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codeshare.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    await logDownload(code);
    toast.success("Code downloaded successfully");
  }

  async function runCode() {
    if (isRunning) return;
    setIsRunning(true);
    setRunStdout('');
    setRunStderr('');
    setPreviewHtml('');
    try {
      const apiBase = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || window.location.origin;
      const response = await fetch(new URL('/api/run', apiBase).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: currentLanguage.id,
          code: codeRef.current || '',
          stdin: stdin,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && !result.stderr) {
        setRunStderr(result.message || `Run failed (${response.status})`);
        return;
      }
      setRunStdout(result.stdout || '');
      setRunStderr(result.stderr || '');
      setPreviewHtml(result.previewHtml || '');
    } catch (err) {
      setRunStderr(err.message || 'Failed to run code.');
    } finally {
      setIsRunning(false);
    }
  }

  // ── AI Code Explainer ─────────────────────────────────────────────────────
  const getCodeToExplain = useCallback(() => {
    const cm = cmInstanceRef.current;
    if (cm) {
      const selected = cm.getSelection();
      if (selected && selected.trim().length > 0) {
        return { code: selected, isSelection: true };
      }
    }
    return { code: codeRef.current || '', isSelection: false };
  }, []);

  // ── Extension map ─────────────────────────────────────────────────────────
  function getExtension(langId) {
    const map = {
      plaintext: 'txt',
      javascript: 'js', python: 'py', java: 'java', cpp: 'cpp',
      c: 'c', csharp: 'cs', php: 'php', ruby: 'rb', go: 'go',
      rust: 'rs', typescript: 'ts', html: 'html', css: 'css',
      sql: 'sql', swift: 'swift', kotlin: 'kt',
    };
    return map[langId] || 'txt';
  }

  // ── Room controls ─────────────────────────────────────────────────────────
  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Failed to copy Room ID");
    }
  }

  function leaveRoom() { reactNavigator('/'); }

  function handleKickUser(targetSocketId) {
    if (isAdmin && socketRef.current)
      socketRef.current.emit(ACTIONS.KICK_USER, { roomId, targetSocketId });
  }

  function handleToggleWrite(targetSocketId) {
    if (isAdmin && socketRef.current)
      socketRef.current.emit(ACTIONS.TOGGLE_WRITE, { roomId, targetSocketId });
  }

  function handleApproveJoin(targetSocketId) {
    if (isAdmin && socketRef.current) {
      socketRef.current.emit(ACTIONS.APPROVE_JOIN, { roomId, targetSocketId });
      setJoinRequests(prev => prev.filter(r => r.socketId !== targetSocketId));
    }
  }

  function handleRejectJoin(targetSocketId) {
    if (isAdmin && socketRef.current) {
      socketRef.current.emit(ACTIONS.REJECT_JOIN, { roomId, targetSocketId });
      setJoinRequests(prev => prev.filter(r => r.socketId !== targetSocketId));
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!location.state) return <Navigate to="/" />;

  if (isPending) {
    return (
      <div className="pendingWrap">
        <div className="pendingCard">
          <img className="logoImage" src="/code-sync.png" alt="logo" />
          <h2>Waiting for Approval</h2>
          <p>Your request has been sent to the admin. Please wait...</p>
          <div className="pendingSpinner"></div>
          <button className="btn leaveBtn" style={{ marginTop: '24px' }} onClick={leaveRoom}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mainWrap">

      {/* Admin join-request notifications */}
      {isAdmin && joinRequests.length > 0 && (
        <div className="joinRequestsContainer">
          {joinRequests.map((req) => (
            <div key={req.socketId} className="joinRequestCard">
              <span className="joinRequestText">
                <strong>{req.username}</strong> wants to join the room
              </span>
              <div className="joinRequestActions">
                <button className="joinRequestBtn confirmBtn" onClick={() => handleApproveJoin(req.socketId)}>Confirm</button>
                <button className="joinRequestBtn cancelBtn"  onClick={() => handleRejectJoin(req.socketId)}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/code-sync.png" alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client
                key={client.socketId}
                username={client.username}
                socketId={client.socketId}
                isAdmin={isAdmin && client.socketId !== socketRef.current?.id}
                clientIsAdmin={client.isAdmin}
                canWrite={client.canWrite}
                onKick={handleKickUser}
                onToggleWrite={handleToggleWrite}
              />
            ))}
          </div>
        </div>

        {/* Language Selector */}
        <div className="languageSelectorWrap">
          <label className="languageLabel">🌐 Language</label>
          <select
            className="languageSelect"
            value={currentLanguage.id}
            onChange={handleLanguageChange}
            disabled={!canWrite}
            title={!canWrite ? 'Only users with write permission can change the language' : ''}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.label}</option>
            ))}
          </select>
        </div>

        <button className="btn downloadBtn" onClick={downloadCode}>Download</button>
        <button className="btn copyBtn"     onClick={copyRoomId}>Copy ROOM ID</button>
        <button className="btn leaveBtn"    onClick={leaveRoom}>Leave</button>
      </div>

      <div className="workspace">
        {currentLanguage.id === 'fileshare' ? (
          <FileSharePanel
            files={sharedFiles}
            onUpload={handleFileUpload}
            canUpload={canWrite}
          />
        ) : (
          <>
            <div className="editorHeader">
              <div className="editorHeaderCenter">
                <button
                  className="btn runBtn"
                  onClick={runCode}
                  disabled={isRunning}
                >
                  {isRunning ? 'Running...' : 'Run'}
                </button>
                <button
                  className="btn aiExplainHeaderBtn"
                  onClick={() => setShowAIPanel(prev => !prev)}
                  title="Explain the current code with AI"
                >
                  ✨ Explain
                </button>
              </div>
              <div />
            </div>
            <div className="editorBody">
              <div className="editorwrap">
                <Editor
                  socketRef={socketRef}
                  roomId={roomId}
                  canWrite={canWrite}
                  language={currentLanguage}
                  templateCode={templateCode}
                  onCodeChange={(code) => { codeRef.current = code; }}
                  onEditorReady={(cm) => { cmInstanceRef.current = cm; }}
                />
              </div>
              {showAIPanel ? (
                <AIExplainerPanel
                  getCodeToExplain={getCodeToExplain}
                  language={currentLanguage}
                  onClose={() => setShowAIPanel(false)}
                />
              ) : (
                <OutputPanel
                  output={runStdout}
                  error={runStderr}
                  isRunning={isRunning}
                  previewHtml={previewHtml}
                  stdin={stdin}
                  onStdinChange={setStdin}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EditorPage;
