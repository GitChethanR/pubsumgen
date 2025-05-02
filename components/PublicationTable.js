import React from 'react';

const PublicationTable = ({ publications }) => {
  if (!publications || publications.length === 0) {
    return <p>No publications found.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Year</th>
            <th>Type</th>
            <th>Venue</th>
          </tr>
        </thead>
        <tbody>
          {publications.map((pub, index) => (
            <tr key={index}>
              <td>{pub.Title}</td>
              <td>{pub.Year}</td>
              <td>{pub.Type}</td>
              <td>{pub.Venue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PublicationTable;