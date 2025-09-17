const config = {
  // Main API host for authentication and general API calls
  API_HOST: "https://api.kelsenia.com", // Same as kelsenia-word-addin
  
  // Chat webhook endpoint for streaming
  CHAT_WEBHOOK: "http://18.188.22.251:5678/webhook/c3e7c9b4-d5a0-49a7-be75-172b30d76839",
  
  // Chat user ID (generates random ID for session)
  CHAT_USER_ID: 'chat-user-' + Math.random().toString(36).substr(2, 9),
  
  // Optional: API timeout in milliseconds
  API_TIMEOUT: 30000,
};

export default config;