/**
 * @typedef {import('./sheetsToJSON')} SheetsToJSON
 */

/**
 * @typedef {Object} NodeRed
 * @property {Object} nodes
 * @property {Function} createNode
 * @property {Object} httpAdmin
 * @property {Function} registerType
 * @property {Object} log
 * @property {Function} error
 */

/**
 * @typedef {Object} GoogleSheetsCredentials
 * @property {string} client_email - The client email for Google Sheets API.
 * @property {string} private_key - The private key for Google Sheets API.
 */

/**
 * @typedef {Object} RequestBodyOnSheetOptions
 * @property {string} sheetId - The ID of the spreadsheet.
 * @property {GoogleSheetsCredentials} credentials - The Google Sheets credentials.
 * @property {string} gauthNodeId - The Node ID for Google Auth.
 */

/**
 * Handles the request to fetch sheet options.
 * @param {NodeRed} RED - The Node-RED instance.
 * @param {SheetsToJSON} sheetsToJSON - The SheetsToJSON instance.
 * @returns {Function} - The async function to handle the request.
 */
function onSheetOptionsRequest(RED, sheetsToJSON) {
    /**
     * Async function to handle the request.
     * @param {Object} req - The request object.
     * @param {RequestBodyOnSheetOptions} req.body - The body of the request.
     * @param {Object} res - The response object.
     */
    return async (req, res) => {
        try {
            const { sheetId: spreadsheetId, credentials, gauthNodeId } = req.body;
            let googleSheetsConfig = credentials;

            if (!credentials.client_email) {
                const config = RED.nodes.getNode(gauthNodeId)?.credentials?.config;
                if (!config) return res.status(200).send({});

                googleSheetsConfig = JSON.parse(config);
            }

            if (!spreadsheetId || !googleSheetsConfig?.private_key || !googleSheetsConfig?.client_email) {
                const message = `Invalid request sent with: ${JSON.stringify({ spreadsheetId, credentials })}`;
                RED.log.error(message);
                return res.status(400).send(message);
            }

            const metadata = await sheetsToJSON.fetchSheetsMetadata(googleSheetsConfig, spreadsheetId);
            sheetsToJSON.metadata.set(spreadsheetId, metadata);

            return res.json(metadata);
        } catch (error) {
            console.error(error.stack);
            RED.log.error(error);
            RED.log.error('Ensure the credentials data is correct, you\'ve been using the correct spreadsheet ID and have the proper access to it');
            res.status(500).json({ error });
        }
    };
}

/**
 * Registers the routes for the SheetsToJSON module.
 * @param {NodeRed} RED - The Node-RED instance.
 * @param {SheetsToJSON} sheetsToJSON - The SheetsToJSON instance.
 */
function registerRoutes(RED, sheetsToJSON) {
    RED.httpAdmin.post('/sheets-to-json-stream/sheets-options', onSheetOptionsRequest(RED, sheetsToJSON));
}

module.exports = registerRoutes;
