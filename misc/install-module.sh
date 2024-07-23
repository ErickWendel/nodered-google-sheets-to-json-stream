#!/bin/bash

# Pack the module and capture the package name
PACKAGE=$(npm pack | tail -n 1)

# Check if npm pack was successful
if [ $? -ne 0 ]; then
    echo "Error: npm pack failed"
    exit 1
fi

# Move the package to misc/data
mv $PACKAGE misc/data/
if [ $? -ne 0 ]; then
    echo "Error: Failed to move $PACKAGE to misc/data"
    exit 1
fi

# cp misc/flows.json misc/data/flows.json

# Change directory to misc/data
cd misc/data || exit 1

# Install the packed module
npm install $PACKAGE --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo "Error: Failed to install $PACKAGE"
    exit 1
fi

# Change directory back to the root of the project
cd ../.. || exit 1

# Restart Node-RED
npm run docker:restart-nodered
if [ $? -ne 0 ]; then
    echo "Error: Failed to restart Node-RED"
    exit 1
fi

echo "Module installed and Node-RED restarted successfully."
