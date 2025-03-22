#!/bin/bash
cd /Users/jamesking/CascadeProjects/Fooocus-API

# Check if virtual environment exists and activate it
if [ -d "venv" ]; then
  source venv/bin/activate
  echo "Activated virtual environment"
elif [ -d "env" ]; then
  source env/bin/activate  
  echo "Activated virtual environment"
fi

# Run the main.py script (NOT app.py which doesn't exist)
python main.py --host 127.0.0.1 --port 8888 --skip-pip
