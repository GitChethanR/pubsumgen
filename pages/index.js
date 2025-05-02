import React, { useState } from 'react';
import axios from 'axios';
import styles from '../styles/styles.module.css';
import Image from 'next/image';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [singleAuthorResult, setSingleAuthorResult] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [activeAuthorTab, setActiveAuthorTab] = useState(0);
  const [activeTab, setActiveTab] = useState(singleAuthorResult ? 0 : 1); // Default to the tab that has data

  // Handle single author search
  const handleSingleSearch = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const name = event.target.elements.name.value;
    const institution = event.target.elements.institution.value;

    if (!name) {
      setError("Please enter an author name");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/', {
        name: name,
        institution: institution || ''
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Backend returns JSON directly
      setSingleAuthorResult({
        profile: response.data.profile,
        results: response.data.results
      });
      
      setBulkResults(null);
      setActiveTab(0);
    } catch (err) {
      console.error('Error searching for author:', err);
      setError(err.response?.data?.error || 
               'An error occurred while searching for the author. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const fileInput = event.target.elements.file;
    
    if (!fileInput.files || fileInput.files.length === 0) {
      setError("Please select a file to upload");
      setIsLoading(false);
      return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post('http://localhost:5000/', formData, {
        headers: {
          'Accept': 'application/json'
        }
      });

      // Process the JSON response
      if (response.data.faculty_results && response.data.faculty_results.length > 0) {
        setBulkResults(response.data.faculty_results);
        setSingleAuthorResult(null);
        setActiveTab(1);
        setActiveAuthorTab(0);
      } else {
        setError('No results found in the uploaded file.');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.error || 
               'An error occurred while processing the file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle download
  const handleDownload = async (format = 'excel') => {
    try {
      window.open(`http://localhost:5000/download?format=${format}`, '_blank');
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('An error occurred while downloading the file.');
    }
  };
  
  // Reset search results
  const handleNewSearch = () => {
    setSingleAuthorResult(null);
    setBulkResults(null);
  };
  
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Publication Summary Generator</h1>
      
      {error && (
        <div className={styles.errorBox}>
          {error}
        </div>
      )}
      
      <div className={styles.card}>
        <div className={styles.searchContainer}>
          <div className={styles.searchSection}>
            <h2>Single Search</h2>
            <form onSubmit={handleSingleSearch}>
              <div className={styles.formGroup}>
                <input 
                  type="text" 
                  name="name" 
                  placeholder="Author name" 
                  className={styles.input}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.formGroup}>
                <input 
                  type="text" 
                  name="institution" 
                  placeholder="Institution name (optional)" 
                  className={styles.input}
                  disabled={isLoading}
                />
              </div>
              <button 
                type="submit" 
                className={styles.button}
                disabled={isLoading}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
          
          <div className={styles.searchSection}>
            <h2>Bulk Search</h2>
            <form onSubmit={handleFileUpload}>
              <div className={styles.formGroup}>
                <div className={styles.fileUpload}>
                  <input 
                    type="file" 
                    name="file" 
                    accept=".xlsx,.xls" 
                    disabled={isLoading}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className={styles.button}
                disabled={isLoading}
              >
                {isLoading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {(singleAuthorResult || (bulkResults && bulkResults.length > 0)) && (
        <div className={styles.card}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 0 ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(0)}
              disabled={!singleAuthorResult}
            >
              Single Author
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 1 ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(1)}
              disabled={!bulkResults || bulkResults.length === 0}
            >
              Bulk Results
            </button>
          </div>
          
          <div className={styles.tabContent}>
            {activeTab === 0 && singleAuthorResult && (
              <div>
                <div className={styles.authorCard}>
                  <div className={styles.authorImageContainer}>
                    {singleAuthorResult.profile.photo ? (
                      <Image 
                        src={singleAuthorResult.profile.photo} 
                        alt={singleAuthorResult.profile.name} 
                        width={80} 
                        height={80}
                        className={styles.authorImage} 
                      />
                    ) : (
                      <div className={styles.authorImagePlaceholder}>
                        {singleAuthorResult.profile.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className={styles.authorInfo}>
                    <h2>{singleAuthorResult.profile.name}</h2>
                    <p>{singleAuthorResult.profile.affiliation}</p>
                    {singleAuthorResult.profile.h_index && (
                      <p>h-index: {singleAuthorResult.profile.h_index}</p>
                    )}
                  </div>
                </div>
                
                <div className={styles.publicationsContainer}>
                  <h3>Publications</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Year</th>
                        <th>Type</th>
                        <th>Venue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleAuthorResult.results.length > 0 ? (
                        singleAuthorResult.results.map((pub, index) => (
                          <tr key={index}>
                            <td>{pub.Title}</td>
                            <td>{pub.Year}</td>
                            <td>{pub.Type}</td>
                            <td>{pub.Venue}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center' }}>No publications found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className={styles.actionButtons}>
                  <button onClick={() => handleDownload('excel')} className={styles.button}>
                    Download
                  </button>
                  <button onClick={handleNewSearch} className={`${styles.button} ${styles.buttonSecondary}`}>
                    New Search
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 1 && bulkResults && bulkResults.length > 0 && (
              <div>
                <div className={styles.authorTabs}>
                  {bulkResults.map((faculty, index) => (
                    <button 
                      key={index}
                      className={`${styles.authorTab} ${index === activeAuthorTab ? styles.activeAuthorTab : ''}`}
                      onClick={() => setActiveAuthorTab(index)}
                    >
                      {faculty.profile.name}
                    </button>
                  ))}
                </div>
                
                <div className={styles.authorContent}>
                  <div className={styles.authorCard}>
                    <div className={styles.authorImageContainer}>
                      {bulkResults[activeAuthorTab].profile.photo ? (
                        <Image 
                          src={bulkResults[activeAuthorTab].profile.photo} 
                          alt={bulkResults[activeAuthorTab].profile.name}
                          width={80}
                          height={80} 
                          className={styles.authorImage} 
                        />
                      ) : (
                        <div className={styles.authorImagePlaceholder}>
                          {bulkResults[activeAuthorTab].profile.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className={styles.authorInfo}>
                      <h2>{bulkResults[activeAuthorTab].profile.name}</h2>
                      <p>{bulkResults[activeAuthorTab].profile.affiliation}</p>
                      {bulkResults[activeAuthorTab].profile.h_index && (
                        <p>h-index: {bulkResults[activeAuthorTab].profile.h_index}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.publicationsContainer}>
                    <h3>Publications</h3>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Year</th>
                          <th>Type</th>
                          <th>Venue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResults[activeAuthorTab].publications.length > 0 ? (
                          bulkResults[activeAuthorTab].publications.map((pub, index) => (
                            <tr key={index}>
                              <td>{pub.Title}</td>
                              <td>{pub.Year}</td>
                              <td>{pub.Type}</td>
                              <td>{pub.Venue}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center' }}>No publications found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className={styles.actionButtons}>
                    <button onClick={() => handleDownload('excel')} className={styles.button}>
                      Download All
                    </button>
                    <button onClick={handleNewSearch} className={`${styles.button} ${styles.buttonSecondary}`}>
                      New Search
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}