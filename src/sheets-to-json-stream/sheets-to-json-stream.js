const google = require('@googleapis/sheets');
const { JWT } = require('google-auth-library');
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const ROWS_PER_REQUEST = 100;

/**
 * Class to fetch and process Google Sheets data.
 */
class SheetsToJSON {
    /**
     * @type {import('@googleapis/sheets').sheets_v4.Sheets}
     * @private
     */
    #sheets;

    /**
     * @type {Map}
     * @public
     */
    metadata = new Map();

    /**
     * @type {typeof import('@googleapis/sheets')}
     * @private
     */
    #google;

    /**
     * @type {import('google-auth-library').JWT}
     * @private
     */
    #JWT;

    /**
     * Creates an instance of SheetsToJSON.
     * @param {Object} param - The parameter object.
     * @param {Object} param.google - The Google APIs client.
     * @param {Object} param.JWT - The Google Auth JWT client.
     */
    constructor({ google, JWT }) {
        this.#google = google;
        this.#JWT = JWT;
    }

    /**
     * Fetches sheet data by range.
     * @param {Object} param - The parameter object.
     * @param {string} param.spreadsheetId - The ID of the spreadsheet.
     * @param {string} param.range - The A1 notation of the range to retrieve values from.
     * @returns {Promise<Object>} - A promise that resolves to the sheet data.
     */
    async getSheetDataByRange({ spreadsheetId, range }) {
        const response = await this.#sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        return response.data;
    }

    /**
     * Async iterator to fetch sheet data in pages of ROWS_PER_REQUEST rows.
     * @param {Object} param - The parameter object.
     * @param {string} param.spreadsheetId - The ID of the spreadsheet.
     * @param {string} param.range - The A1 notation of the range to retrieve values from.
     * @param {Object} param.sheetMetadata - The metadata of the specific sheet.
     * @yields {Promise<Object>} - A promise that resolves to the sheet data.
     */
    async *consumeSheetOnDemand({ spreadsheetId, range, sheetMetadata }) {

        const match = range.match(/([A-Z]+)(\d*):([A-Z]+)(\d*)/);
        if (!match) {
            throw new Error('Invalid range format');
        }

        const startColumn = match[1];
        const startRow = parseInt(match[2], 10) || 1;
        const endColumn = match[3];
        const endRow = parseInt(match[4], 10);

        let rangeStart = startRow;
        let moreData = true;

        while (moreData) {
            const endRangeRow = rangeStart + ROWS_PER_REQUEST - 1;
            const rangeEnd = endRangeRow > endRow ? endRow : endRangeRow;
            const newRange = `${sheetMetadata.title}!${startColumn}${rangeStart}:${endColumn}${rangeEnd}`;

            const data = await this.getSheetDataByRange({
                spreadsheetId,
                range: newRange,
            });

            moreData = data.values && data.values.length === ROWS_PER_REQUEST;
            rangeStart += ROWS_PER_REQUEST;

            yield data;
        }
    }


    /**
     * Fetches metadata of the sheets in the spreadsheet.
     * @param {Object} param - The parameter object.
     * @param {string} param.spreadsheetId - The ID of the spreadsheet.
     * @returns {Promise<Object>} - The metadata of the sheets.
     */
    async getSheetsMetadata({ spreadsheetId }) {
        const { data: response } = await this.#sheets.spreadsheets.get({
            spreadsheetId,
        });

        const sheetsRequest = response.sheets.map(async sheet => {
            const sheetTitle = sheet.properties.title;
            const range = `${sheetTitle}!A1:1`;
            const valuesResponse = await this.getSheetDataByRange({ spreadsheetId, range });
            const headers = valuesResponse.values ? valuesResponse.values[0] : [];
            const rowCount = sheet.properties.gridProperties.rowCount;
            const columnCount = sheet.properties.gridProperties.columnCount;
            const columnLetter = this.getColumnLetter(columnCount);
            const cellsRange = `A1:${columnLetter}${rowCount}`;

            return {
                title: sheetTitle,
                rowCount: rowCount,
                columnCount: columnCount,
                frozenRowCount: sheet.properties.gridProperties.frozenRowCount,
                sheetType: sheet.properties.sheetType,
                headers: headers,
                cellsRange: cellsRange,
            };
        });

        const sheetData = await Promise.all(sheetsRequest);

        const metadata = {
            title: response.properties.title,
            sheets: sheetData,
        };

        return metadata;
    }

    /**
     * Converts a column number to its corresponding letter(s).
     * @param {number} columnNumber - The column number.
     * @returns {string} - The corresponding column letter(s).
     */
    getColumnLetter(columnNumber) {
        let letter = '';
        while (columnNumber > 0) {
            const remainder = (columnNumber - 1) % 26;
            letter = String.fromCharCode(65 + remainder) + letter;
            columnNumber = Math.floor((columnNumber - 1) / 26);
        }
        return letter;
    }

    /**
     * Fetches and sets the sheets metadata.
     * @param {Object} googleSheetsConfig - The Google Sheets API configuration.
     * @param {string} googleSheetsConfig.client_email - The client email.
     * @param {string} googleSheetsConfig.private_key - The private key.
     * @param {string} spreadsheetId - The ID of the spreadsheet.
     * @returns {Promise<Object>} - The sheets metadata.
     */
    async fetchSheetsMetadata(googleSheetsConfig, spreadsheetId) {
        const auth = new this.#JWT({
            email: googleSheetsConfig.client_email,
            key: googleSheetsConfig.private_key,
            scopes: SCOPES,
        });

        this.#sheets = this.#google.sheets({ version: 'v4', auth });

        const metadata = await this.getSheetsMetadata({ spreadsheetId });
        this.metadata.set(spreadsheetId, metadata);
        return metadata;
    }
}

module.exports = function main(RED) {
    const sheetsToJSON = new SheetsToJSON({ google, JWT });

    async function onSheetOptionsRequest(req, res) {
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
            RED.log.error(`ensure the credentials data is correct, you've been using the correct spreadsheet id and have the proper access to it`);
            res.status(500).json({ error });
        }
    }

    function SheetsToJSONModule(ctx) {
        RED.nodes.createNode(this, ctx);
        const node = this;
        const context = {
            spreadsheetId: ctx.sheetId,
            range: `${ctx.sheetList}!${ctx.range}`,
            sheetTitle: ctx.sheetList,
            columns: ctx.columns,
            config: ctx.config,
        };

        async function refreshMetadata() {
            let sheetMetadata;
            const metadata = sheetsToJSON.metadata.get(context.spreadsheetId);
            if (metadata) {
                sheetMetadata = metadata.sheets.find(item => item.title === context.sheetTitle);
            }
            if (!sheetMetadata) {
                console.log('no metadata available!')
                const creds = JSON.parse(RED.nodes.getNode(context.config).credentials.config);
                const metadata = await sheetsToJSON.fetchSheetsMetadata(creds, context.spreadsheetId);
                sheetMetadata = metadata.sheets.find(item => item.title === context.sheetTitle);
            }
            return sheetMetadata
        }

        function configureProgress(node, range) {
            const match = range.match(/([A-Z]+)(\d*):([A-Z]+)(\d*)/);

            const startRow = parseInt(match[2], 10);
            const endRow = parseInt(match[4], 10);
            const totalLines = endRow - startRow;
            let processedRows = totalLines

            return {
                update(stop = false) {
                    if (stop) {
                        const missingLines = totalLines - processedRows;
                        processedRows = totalLines
                        return node.status({
                            fill: "red",
                            shape: "dot",
                            text: `Stopped: ${missingLines}/${totalLines}`
                        });
                    }

                    --processedRows;

                    const missingLines = totalLines - processedRows;
                    const color = missingLines === totalLines ? 'green' : 'blue'

                    node.status({
                        fill: color,
                        shape: "dot",
                        text: `${missingLines}/${totalLines}`
                    });
                }
            }
        }

        node.status({
            fill: 'blue',
            shape: "dot",
            text: `trigger to start!`
        });


        let isProcessing = false; // State variable to track if the node is processing
        const progress = configureProgress(node, context.range);

        node.on('input', async function (msg) {
            // If the node is currently processing, stop the process and return
            if (isProcessing) {
                isProcessing = false;
                progress.update(true)
                return;
            }
            node.status({
                fill: 'blue',
                shape: "dot",
                text: `process starting...`
            });

            // Set the node to processing state
            isProcessing = true;
            try {
                const sheetMetadata = await refreshMetadata();

                const stream = sheetsToJSON.consumeSheetOnDemand({
                    spreadsheetId: context.spreadsheetId,
                    range: context.range,
                    sheetMetadata: sheetMetadata
                });

                let headers = [];

                for await (const data of stream) {
                    if (!isProcessing) break;
                    for (const line of data.values) {
                        if (!isProcessing) break;
                        if (!headers.length) {
                            headers = line;
                            continue;
                        }

                        const lineItem = {};
                        for (const indexLine in line) {
                            const headerName = headers[indexLine];
                            if (!isProcessing) break;
                            if (!context.columns.includes(headerName)) continue;

                            lineItem[headerName] = line[indexLine];
                        }

                        if (!isProcessing) break;

                        node.send({
                            ...msg,
                            payload: lineItem,
                        });
                        progress.update();
                    }
                }

                // Reset the processing state after completion
                isProcessing = false;

            } catch (error) {
                console.log('error', error);
                node.send({
                    ...msg,
                    payload: error
                });
                isProcessing = false;
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "Error"
                });
            }
        });


        node.on('close', async function () {
        });
    }

    RED.httpAdmin.post('/sheets-to-json-stream/sheets-options', onSheetOptionsRequest);
    RED.nodes.registerType('sheets-to-json-stream', SheetsToJSONModule, {
        credentials: {
            config: {}
        }
    });
};
