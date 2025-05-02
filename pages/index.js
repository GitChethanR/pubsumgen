import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

import SingleSearchForm from '../components/SingleSearchForm';
import FileUploadForm from '../components/FileUploadForm';
import AuthorCard from '../components/AuthorCard';
import PublicationTable from '../components/PublicationTable';
import { searchSingleAuthor, uploadFile, downloadFile } from '../utils/api';

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [singleAuthorResult, setSingleAuthorResult] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [activeFacultyTab, setActiveFacultyTab] = useState(0);
  const [error, setError] = useState(null);
  
  // Handle single author search
  const handleSingleSearch = async (name, institution) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await searchSingleAuthor(name, institution);
      
      // Convert HTML response to usable data
      // This is a simplified approach; in a real implementation, 
      // the backend should return JSON data instead of HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      
      const profileName = doc.querySelector('.profile-details h2')?.textContent || name;
      const affiliation = doc.querySelector('.profile-details p')?.textContent || '';
      
      const publications = [];
      const rows = doc.querySelectorAll('table tbody tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          publications.push({
            Title: cells[0].textContent,
            Year: cells[1].textContent,
            Type: cells[2].textContent,
            Venue: cells[3].textContent
          });
        }
      });
      
      setSingleAuthorResult({
        profile: {
          name: profileName,
          affiliation: affiliation,
          photo: ''
        },
        publications
      });
      
      setBulkResults(null);
      setActiveTab(0);
    } catch (err) {
      console.error('Error searching for author:', err);
      setError('An error occurred while searching for the author. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await uploadFile(file);
      
      // Convert HTML response to usable data
      // In a real implementation, the backend should return JSON
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      
      const facultyResults = [];
      const facultyTabs = doc.querySelectorAll('.faculty-tab');
      const facultyContents = doc.querySelectorAll('.faculty-content');
      
      for (let i = 0; i < facultyTabs.length; i++) {
        const content = facultyContents[i];
        
        const profileName = content.querySelector('.profile-details h2')?.textContent || '';
        const affiliation = content.querySelector('.profile-details p')?.textContent || '';
        
        const publications = [];
        const rows = content.querySelectorAll('table tbody tr');
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            publications.push({
              Title: cells[0].textContent,
              Year: cells[1].textContent,
              Type: cells[2].textContent,
              Venue: cells[3].textContent
            });
          }
        });
        
        facultyResults.push({
          profile: {
            name: profileName,
            affiliation: affiliation,
            photo: ''
          },
          publications
        });
      }
      
      setBulkResults(facultyResults);
      setSingleAuthorResult(null);
      setActiveTab(1);
      setActiveFacultyTab(0);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('An error occurred while processing the file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle download
  const handleDownload = () => {
    downloadFile();
  };
  
  return (
    <div className="container">
      <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>Publication Summary Generator</h1>
      <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
        Search for academic publications by author or upload a list of authors in Excel format.
      </p>
      
      {error && (
        <div style={{ 
          backgroundColor: '#ffdede', 
          color: '#d32f2f', 
          padding: '1rem', 
          borderRadius: '4px', 
          marginBottom: '1rem' 
        }}>
          {error}
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SingleSearchForm onSubmit={handleSingleSearch} isLoading={isLoading} />
        <FileUploadForm onSubmit={handleFileUpload} isLoading={isLoading} />
      </div>
      
      {(singleAuthorResult || bulkResults) && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <Tabs 
            selectedIndex={activeTab} 
            onSelect={index => setActiveTab(index)}
            className="react-tabs"
          >
            <TabList className="tabs">
              <Tab 
                className={`tab ${activeTab === 0 ? 'active' : ''}`}
                disabled={!singleAuthorResult}
              >
                Single Author
              </Tab>
              <Tab 
                className={`tab ${activeTab === 1 ? 'active' : ''}`}
                disabled={!bulkResults}
              >
                Bulk Results
              </Tab>
            </TabList>
            
            <TabPanel>
              {singleAuthorResult && (
                <>
                  <AuthorCard profile={singleAuthorResult.profile} />
                  <PublicationTable publications={singleAuthorResult.publications} />
                  <div className="action-buttons">
                    <button onClick={handleDownload} className="button">
                      Download
                    </button>
                    <button 
                      onClick={() => {
                        setSingleAuthorResult(null);
                        setBulkResults(null);
                      }} 
                      className="button button-secondary"
                    >
                      New Search
                    </button>
                  </div>
                </>
              )}
            </TabPanel>
            
            <TabPanel>
              {bulkResults && bulkResults.length > 0 && (
                <>
                  <div className="horizontal-tabs">
                    {bulkResults.map((faculty, index) => (
                      <div 
                        key={index}
                        className={`faculty-tab ${index === activeFacultyTab ? 'active' : ''}`}
                        onClick={() => setActiveFacultyTab(index)}
                      >
                        {faculty.profile.name}
                      </div>
                    ))}
                  </div>
                  
                  {bulkResults.map((faculty, index) => (
                    <div 
                      key={index}
                      className={`faculty-content ${index === activeFacultyTab ? 'active' : ''}`}
                    >
                      <AuthorCard profile={faculty.profile} />
                      <PublicationTable publications={faculty.publications} />
                    </div>
                  ))}
                  
                  <div className="action-buttons">
                    <button onClick={handleDownload} className="button">
                      Download All
                    </button>
                    <button 
                      onClick={() => {
                        setSingleAuthorResult(null);
                        setBulkResults(null);
                      }} 
                      className="button button-secondary"
                    >
                      New Search
                    </button>
                  </div>
                </>
              )}
            </TabPanel>
          </Tabs>
        </div>
      )}
    </div>
  );
}