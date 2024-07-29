/**
 * @typedef {Object} GoogleSheetsCredentials
 * @property {string} client_email - The client email for Google Sheets API.
 * @property {string} private_key - The private key for Google Sheets API.
 */

/**
 * @typedef {Object} Context
 * @property {string} spreadsheetId - The ID of the spreadsheet.
 * @property {string} range - The A1 notation of the range to retrieve values from.
 * @property {string} sheetTitle - The title of the sheet.
 * @property {Array<string>} columns - The columns to be processed.
 * @property {string} config - The configuration object.
 */


const { SCOPES, ROWS_PER_REQUEST } = require('./constants');
const { getColumnLetter } = require('./utils');


/**
 * Class to handle Google Sheets operations and convert sheets data to JSON.
 */
class SheetsToJSON {
    /**
     *  * @private {import('@googleapis/sheets').sheets_v4.Sheets}
     *
     */
    #sheets;

    /**
     * @private {import('@googleapis/sheets')}
     */
    #google;

    /**
     * @private {import('google-auth-library').JWT}
     */
    #JWT;
    metadata = new Map();

    /**
     * Creates an instance of SheetsToJSON.
     * @param {Object} params - The parameters object.
     * @param {import('@googleapis/sheets')} params.google - The Google APIs client.
     * @param {import('google-auth-library')} params.JWT - The Google Auth JWT client.
     */
    constructor({ google, JWT }) {
        this.#google = google;
        this.#JWT = JWT;
    }

    /**
     * Fetches sheet data by range.
     * @param {Object} params - The parameters object.
     * @param {string} params.spreadsheetId - The ID of the spreadsheet.
     * @param {string} params.range - The A1 notation of the range to retrieve values from.
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
     * @param {Object} params - The parameters object.
     * @param {string} params.spreadsheetId - The ID of the spreadsheet.
     * @param {string} params.range - The A1 notation of the range to retrieve values from.
     * @param {Object} params.sheetMetadata - The metadata of the specific sheet.
     * @yields {Promise<Object>} - A promise that resolves to the sheet data.
     */
    async *consumeSheetOnDemand({ spreadsheetId, range, sheetMetadata }) {
        const match = range.match(/([A-Z]+)(\d*):([A-Z]+)(\d*)/);
        if (!match) throw new Error('Invalid range format');

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
     * @param {Object} params - The parameters object.
     * @param {string} params.spreadsheetId - The ID of the spreadsheet.
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
            const columnLetter = getColumnLetter(columnCount);
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

        return {
            title: response.properties.title,
            sheets: sheetData,
        };
    }

    /**
     * Fetches and sets the sheets metadata.
     * @param {GoogleSheetsCredentials} googleSheetsConfig - The Google Sheets API configuration.
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

    /**
     * Refreshes the metadata for the specified context.
     * @param {Context} context - The context object.
     * @param {Function} getAuthNode - Function to get the Google Auth node.
     * @returns {Promise<Object>} - The sheet metadata.
     */
    async refreshMetadata(context, getAuthNode) {
        let sheetMetadata;
        const metadata = this.metadata.get(context.spreadsheetId);
        if (metadata) {
            sheetMetadata = metadata.sheets.find(item => item.title === context.sheetTitle);
        }
        if (!sheetMetadata) {
            console.log('No metadata available!');
            const creds = getAuthNode();
            const metadata = await this.fetchSheetsMetadata(creds, context.spreadsheetId);
            sheetMetadata = metadata.sheets.find(item => item.title === context.sheetTitle);
        }
        return sheetMetadata;
    }

    /**
     * Processes the data from Google Sheets and triggers the onData callback.
     * @param {Object} params - The parameters object.
     * @param {Context} params.context - The context object.
     * @param {Function} params.onData - The callback function to handle each row of data.
     * @param {Function} params.getGoogleAuthNode - Function to get the Google Auth node.
     * @param {boolean} params.isProcessing - The flag indicating if the processing is active.
     * @returns {Promise<void>}
     */
    async process({ context, onData, getGoogleAuthNode, isProcessing }) {
        const sheetMetadata = await this.refreshMetadata(context, getGoogleAuthNode);
        const stream = this.consumeSheetOnDemand({
            spreadsheetId: context.spreadsheetId,
            range: context.range,
            sheetMetadata
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

                onData(lineItem);
            }
        }
    }
}

module.exports = SheetsToJSON;
