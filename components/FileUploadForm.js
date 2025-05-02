import React, { useState } from 'react';

const FileUploadForm = ({ onSubmit, isLoading }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    } else {
      setFile(null);
      setFileName('No file chosen');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (file) {
      onSubmit(file);
    }
  };

  return (
    <div className="card">
      <h2>Search From Excel</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            border: '1px solid #ddd', 
            borderRadius: '4px', 
            padding: '0.75rem', 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%' 
          }}>
            <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </span>
            <label htmlFor="file" style={{ 
              backgroundColor: '#f0f0f0', 
              padding: '0.5rem 1rem', 
              borderRadius: '4px', 
              marginLeft: '1rem',
              cursor: 'pointer' 
            }}>
              Browse
            </label>
            <input
              type="file"
              id="file"
              onChange={handleFileChange}
              accept=".csv, .xlsx"
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <button type="submit" className="button" disabled={isLoading || !file}>
          {isLoading ? 'Uploading...' : 'Upload and Search'}
        </button>
      </form>
    </div>
  );
};

export default FileUploadForm;
