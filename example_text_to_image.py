#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import requests
import base64
import os
from datetime import datetime

# Fooocus API endpoint
API_URL = "http://127.0.0.1:8888"  # API will run on port 8888

def text_to_image(prompt, negative_prompt="", style_selections=None, async_process=True):
    """
    Generate an image from a text prompt using Fooocus API
    
    Args:
        prompt (str): The text prompt for image generation
        negative_prompt (str): Negative prompt to avoid certain elements
        style_selections (list): List of style names to apply
        async_process (bool): Whether to process asynchronously
        
    Returns:
        dict: API response
    """
    if style_selections is None:
        style_selections = ["Fooocus V2"]
        
    params = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "style_selections": style_selections,
        "performance_selection": "Quality",  # Speed, Quality, or Extreme Speed
        "aspect_ratios_selection": "1152*896",  # resolution
        "image_number": 1,
        "image_seed": -1,  # random seed
        "sharpness": 2.0,
        "guidance_scale": 4.0,
        "async_process": async_process,
        "save_extension": "png"
    }
    
    response = requests.post(
        f"{API_URL}/v1/generation/text-to-image",
        json=params,
        headers={"Content-Type": "application/json"}
    )
    
    return response.json()

def check_job_status(job_id):
    """
    Check the status of an asynchronous job
    
    Args:
        job_id (str): The job ID to check
        
    Returns:
        dict: Job status response
    """
    response = requests.get(
        f"{API_URL}/v1/generation/query-job",
        params={"job_id": job_id}
    )
    
    return response.json()

def main():
    # Generate an image from a text prompt
    prompt = "A beautiful landscape with mountains, a lake, and a sunset"
    negative_prompt = "ugly, blurry, low quality"
    
    print(f"Sending text-to-image request with prompt: '{prompt}'")
    response = text_to_image(prompt, negative_prompt)
    
    print(json.dumps(response, indent=2))
    
    if response.get("job_id"):
        job_id = response["job_id"]
        print(f"\nJob ID: {job_id}")
        print("Checking job status...")
        
        # Create outputs directory if it doesn't exist
        os.makedirs("outputs", exist_ok=True)
        
        # Check job status
        job_status = check_job_status(job_id)
        print(json.dumps(job_status, indent=2))
        
        if job_status.get("job_stage") == "PENDING" or job_status.get("job_stage") == "RUNNING":
            print("Job is still processing. Check status later with:")
            print(f"curl {API_URL}/v1/generation/query-job?job_id={job_id}")
        
        if job_status.get("job_result"):
            for idx, result in enumerate(job_status["job_result"]):
                if result.get("url"):
                    print(f"Image URL: {result['url']}")
                    print(f"Seed: {result.get('seed', 'N/A')}")
                    
                    # Download image
                    image_response = requests.get(result["url"])
                    if image_response.status_code == 200:
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"outputs/image_{timestamp}_{idx}.png"
                        with open(filename, "wb") as f:
                            f.write(image_response.content)
                        print(f"Image saved to {filename}")

if __name__ == "__main__":
    main()
