#!/bin/bash

# Pack the module and capture the package name
PACKAGE=$(npm pack | tail -n 1)

# Check if npm pack was successful
if [ $? -ne 0 ]; then
    echo "Error: npm pack failed"
    exit 1
fi

# Move the package to misc/data
docker cp $PACKAGE nodered:/data/
if [ $? -ne 0 ]; then
    echo "Error: Failed to move $PACKAGE to misc/data"
    exit 1
fi

# cp misc/flows.json misc/data/flows.json
docker cp misc/settings.js nodered:/data/settings.js

# Install the packed module
# Install the packed module in the /data folder
docker exec -it nodered sh -c "cd /data && npm install $PACKAGE --legacy-peer-deps --omit=dev"

# Restart Node-RED
npm run docker:restart-nodered
if [ $? -ne 0 ]; then
    echo "Error: Failed to restart Node-RED"
    exit 1
fi

echo "Module installed and Node-RED restarted successfully."
