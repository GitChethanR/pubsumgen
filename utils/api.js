import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const searchSingleAuthor = async (name, institution) => {
  try {
    const formData = new FormData();
    formData.append('name', name);
    if (institution) {
      formData.append('institution', institution);
    }
    
    const response = await axios.post(`${API_URL}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error searching for author:', error.message, error.response);
    throw error;
  }
};

export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_URL}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const downloadFile = async () => {
  try {
    window.open(`${API_URL}/download`, '_blank');
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};