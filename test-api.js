#!/usr/bin/env node
/**
 * Test script for Fooocus API connection
 */

const axios = require('axios');
const path = require('path');

// Configuration
const CONFIG = {
  FOOOCUS_API_URL: 'http://127.0.0.1:8888',
  FOOOCUS_API_PATH: '/Users/jamesking/CascadeProjects/Fooocus-API',
  FOOOCUS_PATH: '/Users/jamesking/CascadeProjects/Fooocus'
};

async function testApi() {
  console.log("Testing Fooocus API connection...");
  console.log(`API URL: ${CONFIG.FOOOCUS_API_URL}`);
  console.log(`API Path: ${CONFIG.FOOOCUS_API_PATH}`);
  console.log(`Fooocus Path: ${CONFIG.FOOOCUS_PATH}`);
  
  // Check if API is running
  try {
    console.log("\nChecking if API is running...");
    const response = await axios.get(`${CONFIG.FOOOCUS_API_URL}/ping`, { 
      timeout: 5000
    });
    console.log("✅ API is running!");
    console.log(`Response: ${JSON.stringify(response.data)}`);
    
    // Try to list styles
    console.log("\nFetching available styles...");
    const stylesResponse = await axios.get(`${CONFIG.FOOOCUS_API_URL}/v1/generation/styles`);
    console.log("✅ Styles retrieved successfully!");
    console.log("Available styles:");
    console.log(stylesResponse.data);
    
  } catch (error) {
    console.log("❌ API is not running or not accessible");
    console.log(`Error: ${error.message}`);
    
    // Check if API paths exist
    console.log("\nChecking API paths...");
    const fs = require('fs');
    
    if (fs.existsSync(CONFIG.FOOOCUS_API_PATH)) {
      console.log(`✅ API path exists: ${CONFIG.FOOOCUS_API_PATH}`);
      
      const runApiPath = path.join(CONFIG.FOOOCUS_API_PATH, 'run_api.sh');
      if (fs.existsSync(runApiPath)) {
        console.log(`✅ run_api.sh script exists: ${runApiPath}`);
        console.log("\nYou can start the API manually by running:");
        console.log(`  cd ${CONFIG.FOOOCUS_API_PATH} && bash run_api.sh`);
      } else {
        console.log(`❌ run_api.sh script not found at ${runApiPath}`);
      }
    } else {
      console.log(`❌ API path does not exist: ${CONFIG.FOOOCUS_API_PATH}`);
    }
    
    if (fs.existsSync(CONFIG.FOOOCUS_PATH)) {
      console.log(`✅ Fooocus path exists: ${CONFIG.FOOOCUS_PATH}`);
    } else {
      console.log(`❌ Fooocus path does not exist: ${CONFIG.FOOOCUS_PATH}`);
    }
  }
}

testApi();
