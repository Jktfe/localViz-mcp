#!/bin/bash

# Kill any processes using ports 8888 or 8889
echo "Killing processes on ports 8888 and 8889..."
lsof -ti :8888,8889 | xargs kill -9 2>/dev/null || echo "No processes to kill on these ports"

# Kill any Python processes with "fooo" in the command
echo "Killing any Fooocus-related processes..."
ps aux | grep -i 'python.*fooo' | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || echo "No Fooocus processes running"

# Verify ports are clear
echo "Verifying ports are clear..."
lsof -i :8888,8889 || echo "Ports are clear"

# Start Fooocus API
echo "Starting Fooocus API on port 8888..."
cd "$(dirname "$0")"
source venv/bin/activate
python main.py --host 127.0.0.1 --port 8888 --skip-pip
