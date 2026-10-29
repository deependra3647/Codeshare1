import React, { useRef } from 'react';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const FileSharePanel = ({ files, onUpload, canUpload }) => {
  const inputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_SIZE_BYTES) {
      alert(`File too large. Max allowed size is ${MAX_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpload({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl: ev.target.result,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleDownload(file) {
    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="fileSharePanel">
      <div className="fileShareHeader">
        <span>📁 File Share</span>
        {canUpload && (
          <>
            <button
              className="fileUploadBtn"
              onClick={() => inputRef.current && inputRef.current.click()}
            >
              ⬆ Upload File
            </button>
            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      <div className="fileShareBody">
        {files.length === 0 ? (
          <p className="fileShareEmpty">No files shared yet. Upload a file to share with the room.</p>
        ) : (
          <ul className="fileList">
            {files.map((f, i) => (
              <li key={i} className="fileItem">
                <div className="fileInfo">
                  <span className="fileName">{f.name}</span>
                  <span className="fileMeta">{formatSize(f.size)} · {new Date(f.uploadedAt).toLocaleTimeString()}</span>
                </div>
                <button
                  className="fileDownloadBtn"
                  onClick={() => handleDownload(f)}
                >
                  ⬇ Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileSharePanel;
