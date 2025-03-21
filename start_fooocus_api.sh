#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python main.py --host 127.0.0.1 --port 8888 --skip-pip
