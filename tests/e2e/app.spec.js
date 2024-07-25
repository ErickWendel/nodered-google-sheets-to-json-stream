// @ts-check

const spreadsheet = require('../../spreadsheet.json');
const { test, expect } = require('@playwright/test')
const { describe, beforeEach } = test;
const net = require('net');

const NODERED_URL = 'http://localhost:1880'
const TCP_PORT = 6123

class NodeRedEditor {
    constructor({ page }) {
        this.page = page
    }

    elements = {
        focusedNode: () => this.page.locator('.red-ui-flow-node'),
        nodeSearchInput: () => this.page.locator('#red-ui-type-search-input'),
        inputLabel: () => this.page.locator('#node-input-name'),
        sheetsToJSON: {
            sheetIdInput: () => this.page.locator('#node-input-sheetId'),
            sheetListInput: () => this.page.locator('#node-input-sheetList'),
            rangeInput: () => this.page.locator('#node-input-range'),
            columnsInput: () => this.page.locator('#node-input-columns'),
            addNewConfigInputBtn: () => this.page.locator('#node-input-btn-config-add'),
            gAuth: {
                configArea: () => this.page.locator('#node-config-input-config'),
            },
        },
        httpIn: {
            urlInput: () => this.page.locator('#node-input-url')
        },
        workspaceArea: () => this.page.locator('#red-ui-workspace-chart'),
        closeButton: () => this.page.getByRole('button', { name: 'Close' }).first()

    }
}
function createTCPServer({ timeout }) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection({ port: TCP_PORT }, () => {
            client.write('hey');
        });

        setTimeout(() => client.end(), timeout)

        const responses = []
        client.on('data', (data) => {
            const msg = data.toString().trim().split('\n').map(line => JSON.parse(line))
            responses.push(...msg)
        });

        client.on('end', () => {
            return resolve(responses);
        });

        client.on('error', (err) => {
            console.error('Client error:', err);
            reject(err);
        });
    });
}
function getFlow() {
    // Generate unique IDs and names for the nodes
    const generateRandomId = () => 'node-' + Math.random().toString(36).substr(2, 9);
    const generateRandomName = (base, id) => base + '-' + id;

    const tcpInNodeId = generateRandomId();
    const sheetsToJsonStreamNodeId = generateRandomId();
    const tcpRespondeNodeId = generateRandomId();
    const formatToStringFn = generateRandomId();
    const debugNodeId = generateRandomId()
    return {
        tcpIn: {
            id: tcpInNodeId,
            name: generateRandomName('TCP In', tcpInNodeId),
            "type": "tcp in",
            "server": "server",
            "host": "localhost",
            "port": TCP_PORT,
            "datamode": "stream",
            "datatype": "buffer",
            "newline": "",
            "topic": "",
            "trim": false,
            "base64": false,
            "tls": "",
            "x": 120,
            "y": 180,
            wires: [[sheetsToJsonStreamNodeId]]
        },
        sheetsToJSON: {
            id: sheetsToJsonStreamNodeId,
            type: 'sheets-to-json-stream',
            name: generateRandomName('Sheets to JSON Stream', sheetsToJsonStreamNodeId),
            "x": 200, "y": 250,
            wires: [[formatToStringFn]]
        },
        formatTOStringFn: {
            id: formatToStringFn,
            type: "function",
            name: generateRandomName('Stringify Reponse', formatToStringFn),
            func: "msg.payload = JSON.stringify(msg.payload).concat('\\n')\nreturn msg;",
            outputs: 1,
            timeout: 0,
            noerr: 0,
            initialize: "",
            finalize: "",
            libs: [],
            "x": 300, "y": 300,
            wires: [[tcpRespondeNodeId, debugNodeId]]
        },
        debug: {
            id: debugNodeId,
            type: "debug",
            name: generateRandomName('Debug', debugNodeId),
            outputs: 1,
            "x": 580, "y": 300,
            wires: [[]]
        },
        tcpOut: {
            id: tcpRespondeNodeId,
            name: generateRandomName('TCP Out', tcpRespondeNodeId),
            "type": "tcp out",
            "host": "localhost",
            "port": "",
            "beserver": "reply",
            "base64": false,
            "end": false,
            "tls": "",
            "x": 340,
            "y": 380,
            "wires": []
        }
    }
}

async function insertNodes(nodes) {
    const flows = await (await fetch(`${NODERED_URL}/flows`)).json()
    const tab = flows.find(item => item.label === 'Flow 1')
    nodes.forEach(node => node.z = tab.id)
    const payload = [
        tab,
        ...nodes
    ]

    return await fetch(`${NODERED_URL}/flows`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

}

// Usage in a test case
describe('Node-RED Interface', () => {
    async function addNodeAndOpen(editor, nodeName) {
        await editor.elements.workspaceArea().click();
        await editor.elements.nodeSearchInput().type(nodeName);
        await editor.elements.focusedNode().dblclick();
        const nodeId = `node-${Date.now()}`;
        await editor.elements.inputLabel().type(nodeId);

        return nodeId;
    }

    async function addValidConfig(editor) {
        await editor.elements.sheetsToJSON.addNewConfigInputBtn().click();
        await editor.elements.sheetsToJSON.gAuth.configArea().fill(JSON.stringify(spreadsheet.googleAuthCredentials));
        await editor.elements.sheetsToJSON.gAuth.configArea().press('Meta+Enter');
    }

    async function resetChart(editor) {
        await editor.elements.workspaceArea().focus()
        await editor.elements.workspaceArea().press('Meta+a');
        await editor.elements.workspaceArea().press('Delete');
        await editor.elements.workspaceArea().press('Meta+d');

    }

    beforeEach(async ({ page }) => {
        return test.step('Given a clean nodered instance', async () => {
            const editor = new NodeRedEditor({ page });
            await page.goto(NODERED_URL);
            await resetChart(editor);
        })
    })


    describe('should create a flow with an API and setup sheets', () => {
        test('Use case: Successfuly configure node ', async ({ page }) => {

            const editor = new NodeRedEditor({ page });
            const flow = getFlow()
            await test.step('Given a web API flow is available', async () => {
                await insertNodes(Object.values(flow));
            });

            await test.step('When I reload the home page', async () => {
                await page.goto(NODERED_URL);
            });

            await test.step('And I add a valid Google authentication configuration', async () => {
                const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                await page.locator(`#${sheetsToJsonStreamNode}`).dblclick();
                await addValidConfig(editor);
            });

            await test.step(`And I enter the spreadsheet ID "${spreadsheet.spreadsheetId}" and leave the input field`, async () => {
                await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId);
                await editor.elements.sheetsToJSON.sheetIdInput().press('Tab');
                await page.waitForTimeout(3000);
            });

            await test.step('Then I should see the list of sheets in the select element', async () => {
                const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                const options = await selectElement.evaluate((select) => {
                    return Array.from(select.options).map(option => option.value);
                });

                expect(options).toStrictEqual(spreadsheet.sheets);
            });

            await test.step(`And I should see the sheet's columns as an array`, async () => {
                await expect(editor.elements.sheetsToJSON.columnsInput()).toHaveValue(JSON.stringify(spreadsheet.columns));
            });

            await test.step(`And the sheet's range should contain "${spreadsheet.range}"`, async () => {
                await expect(editor.elements.sheetsToJSON.rangeInput()).toHaveValue(spreadsheet.range);
            });

            await test.step('And I can deploy Node-RED without errors', async () => {
                await editor.elements.inputLabel().press('Meta+Enter');
                await editor.elements.workspaceArea().click();
                await editor.elements.workspaceArea().press('Meta+d');
            });
        })

        test(`Use case: receive data 2 lines from the sheet`, async ({ page }) => {
            const [firstLine, remaining] = spreadsheet.range.split(':')
            const secondLine = remaining.replace(/\d+/, '3')
            const rangeOfTwoLines = `${firstLine}:${secondLine}`

            const editor = new NodeRedEditor({ page });
            const flow = getFlow()
            await test.step('Given a web API flow is available', async () => {
                await insertNodes(Object.values(flow));
            });

            await test.step('When I reload the home page', async () => {
                await page.goto(NODERED_URL);
            });

            await test.step('And I add a valid Google authentication configuration', async () => {
                const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                await page.locator(`#${sheetsToJsonStreamNode}`).dblclick();
                await addValidConfig(editor);
            });

            await test.step(`And I enter the spreadsheet ID "${spreadsheet.spreadsheetId}" and leave the input field`, async () => {
                await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId);
                await editor.elements.sheetsToJSON.sheetIdInput().press('Tab');
                await page.waitForTimeout(3000);
            });


            await test.step(`And I manually choose range as ${rangeOfTwoLines}`, async () => {
                await editor.elements.sheetsToJSON.rangeInput().focus()
                await editor.elements.sheetsToJSON.rangeInput().press('Meta+A')
                await editor.elements.sheetsToJSON.rangeInput().press('Delete')
                await editor.elements.sheetsToJSON.rangeInput().type(rangeOfTwoLines)
            });

            await test.step('And I can deploy Node-RED without errors', async () => {
                await editor.elements.inputLabel().press('Meta+Enter');
                await editor.elements.workspaceArea().click();
                await editor.elements.workspaceArea().press('Meta+d');
            });

            await test.step('And I can receive two messages with correct columns', async () => {
                await page.waitForTimeout(1000)
                const receivedItems = await createTCPServer({ timeout: 1200 })
                expect(receivedItems.length).toBe(2)

                for (const item of receivedItems) {
                    for (const colum of spreadsheet.columns) {
                        expect(item).toHaveProperty(colum)
                    }
                }
            })
        })
    });


    // it('manually create the sheet node in the editor', async ({ page }) => {
    //     const editor = new NodeRedEditor({ page });

    //     await page.goto(NODERED_URL);
    //     const nodeId = await addNodeAndOpen(editor, 'sheets')

    //     await page.locator(`#${nodeId}`).dblclick();

    //     await addValidConfig(editor);

    //     await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId);
    //     await editor.elements.sheetsToJSON.sheetIdInput().press('Enter');
    //     await page.waitForTimeout(3000);

    //     const selectElement = await editor.elements.sheetsToJSON.sheetListInput()
    //     const options = await selectElement.evaluate((select) => {
    //         return Array.from(select.options).map(option => option.value);
    //     });

    //     expect(options).toStrictEqual(spreadsheet.sheets);

    //     await expect(editor.elements.sheetsToJSON.rangeInput()).toHaveValue(spreadsheet.range);
    //     await expect(editor.elements.sheetsToJSON.columnsInput()).toHaveValue(JSON.stringify(spreadsheet.columns));
    //     await editor.elements.inputLabel().press('Meta+Enter');
    //     await editor.elements.workspaceArea().click()
    //     await editor.elements.workspaceArea().press('Meta+d')
    // });
});
