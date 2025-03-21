#!/bin/bash

echo "Stopping Fooocus API processes..."

# Find and kill Python processes running Fooocus API
FOOOCUS_API_PROCESSES=$(ps -ef | grep "python.*api.py" | grep -v grep | awk '{print $2}')

if [ -z "$FOOOCUS_API_PROCESSES" ]; then
  echo "No Fooocus API processes found"
else
  echo "Killing Fooocus API processes: $FOOOCUS_API_PROCESSES"
  for pid in $FOOOCUS_API_PROCESSES; do
    kill -9 $pid
  done
  echo "Fooocus API processes stopped"
fi

# Find and kill any stray Python processes from Fooocus
FOOOCUS_PROCESSES=$(ps -ef | grep "python.*fooocus" | grep -v grep | awk '{print $2}')

if [ -z "$FOOOCUS_PROCESSES" ]; then
  echo "No additional Fooocus processes found"
else
  echo "Killing additional Fooocus processes: $FOOOCUS_PROCESSES"
  for pid in $FOOOCUS_PROCESSES; do
    kill -9 $pid
  done
  echo "Additional Fooocus processes stopped"
fi

echo "Cleanup complete"
