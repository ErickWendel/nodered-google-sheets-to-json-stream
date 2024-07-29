console.log('GOOGLE_SHEETS_AUTH_FILE:', process.env.GOOGLE_SHEETS_AUTH_FILE ? 'Exists' : 'Not set');

// Additional debugging
if (process.env.GOOGLE_SHEETS_AUTH_FILE) {
    const secretData = JSON.parse(process.env.GOOGLE_SHEETS_AUTH_FILE);
    console.log('Secret JSON keys:', Object.keys(secretData));
    process.exit(0)
}

process.exit(1)
