import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    const apiURL = process.env.API_URL || 'http://localhost:5000';
    const response = await axios.post(apiURL, req.body, {
      headers: req.headers,
    });
    
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ message: 'Error connecting to backend service' });
  }
}