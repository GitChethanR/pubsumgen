import React, { useState } from 'react';

const SingleSearchForm = ({ onSubmit, isLoading }) => {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name, institution);
    }
  };

  return (
    <div className="card">
      <h2>Single Author Search</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Author Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Institution (optional)"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </div>
        <button type="submit" className="button" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  );
};

export default SingleSearchForm;