const google = require('@googleapis/sheets');
const { JWT } = require('google-auth-library');
const { Readable } = require('stream')
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
];

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
    * @returns {Promise<Object|import('stream').Readable>} - A promise that resolves to the sheet data as a readable stream.
    */
    async getSheetDataByRange({ spreadsheetId, range }, asStream = false) {
        const options = asStream ? { responseType: 'stream' } : {}
        const response = await this.#sheets.spreadsheets.values.get(
            {
                spreadsheetId,
                range,
            },
            options
        );
        if (asStream)
            return Readable.from(response.data, { encoding: 'utf-8' });

        return response.data
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

            // Fetch the first row to use as headers
            const range = `${sheetTitle}!A1:1`;
            const valuesResponse = await this.getSheetDataByRange({ spreadsheetId, range })
            const headers = valuesResponse.values ? valuesResponse.values[0] : [];

            // Calculate the cell range in A1 notation
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
        return metadata;
    }
}



module.exports = function main(RED) {

    const sheetsToJSON = new SheetsToJSON({ google, JWT })


    async function onSheetOptionsRequest(req, res) {
        try {

            const { sheetId: spreadsheetId, credentials, gauthNodeId } = req.body
            let googleSheetsConfig = credentials

            if (!credentials.client_email) {
                const config = RED.nodes.getNode(gauthNodeId)?.credentials?.config
                if (!config) return res.status(200).send({})

                googleSheetsConfig = JSON.parse(config)
            }

            if (!spreadsheetId || !googleSheetsConfig?.private_key || !googleSheetsConfig?.client_email) {
                const message = `Invalid request sent with: ${JSON.stringify({ spreadsheetId, credentials })}`
                RED.log.error(message);
                return res.status(400).send(message);
            }

            const metadata = await sheetsToJSON.fetchSheetsMetadata(googleSheetsConfig, spreadsheetId);
            sheetsToJSON.metadata.set(spreadsheetId, metadata);

            return res.json(metadata);
        } catch (error) {
            console.error(error.stack)

            RED.log.error(error)
            RED.log.error(`ensure the credentials data is correct, you've been using the correct spreadsheet id and have the proper access to it`)
            res.status(500).json({ error })
        }
    }

    function SheetsToJSONModule(ctx) {
        RED.nodes.createNode(this, ctx);
        const node = this;
        const context = {
            spreadsheetId: ctx.sheetId,
            range: `${ctx.sheetList}!${ctx.range}`,
            columns: ctx.columns,
            config: ctx.config,
        }
        // const columns = ctx.columns
        const creds = JSON.parse(RED.nodes.getNode(context.config).credentials.config);
        node.on('input', async function (msg) {
            try {
                const metadata = await sheetsToJSON.fetchSheetsMetadata(creds, context.spreadsheetId)
                const stream = await sheetsToJSON.getSheetDataByRange(context)
                let headers = []

                for (const line of stream.values) {
                    console.log('lengh', line.length)
                    if (!headers.length) {
                        headers = line
                        continue
                    }

                    const lineItem = {}
                    for (const indexLine in line) {
                        const headerName = headers[indexLine]
                        // if (!context.columns.includes(headerName) && headerName) continue

                        lineItem[headerName] = line[indexLine]
                    }

                    node.send({ payload: lineItem });
                }
                // console.log('item', item)
                // node.send(item);

            } catch (error) {
                console.log('error', error)
                node.send({ payload: 'error' });

            }

            node.send(msg);
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

