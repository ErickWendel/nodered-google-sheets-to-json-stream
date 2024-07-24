// @ts-check

const spreadsheet = require('../../spreadsheet.json');
const { test: it, expect } = require('@playwright/test')
const { describe, beforeEach } = it;
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

// Generate unique IDs and names for the nodes
const generateRandomId = () => 'node-' + Math.random().toString(36).substr(2, 9);
const generateRandomName = (base, id) => base + '-' + id;

const httpInNodeId = generateRandomId();
const sheetsToJsonStreamNodeId = generateRandomId();
const httpResponseNodeId = generateRandomId();

const httpInNode = {
    id: httpInNodeId,
    type: 'http in',
    name: generateRandomName('HTTP In', httpInNodeId),
    url: '/sheets',
    method: 'get',
    x: 200,
    y: 200,
    wires: [[sheetsToJsonStreamNodeId]]
};

const sheetsToJsonStreamNode = {
    id: sheetsToJsonStreamNodeId,
    type: 'sheets-to-json-stream',
    name: generateRandomName('Sheets to JSON Stream', sheetsToJsonStreamNodeId),
    x: 250,
    y: 250,
    wires: [[httpResponseNodeId]]
};

const httpResponseNode = {
    id: httpResponseNodeId,
    type: 'http response',
    name: generateRandomName('HTTP Response', httpResponseNodeId),
    x: 350,
    y: 300,
    wires: [[]]
};

async function insertNodes(nodes) {
    await fetch('http://localhost:1880/flows', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(nodes)
    });
}

const NODERED_URL = 'http://0.0.0.0:1880'
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
        await editor.elements.workspaceArea().click()
        await editor.elements.workspaceArea().press('Meta+a');
        await editor.elements.workspaceArea().press('Delete');
        await editor.elements.workspaceArea().press('Meta+d');

    }

    beforeEach(async ({ page }) => {
        const editor = new NodeRedEditor({ page });
        await page.goto(NODERED_URL);

        await resetChart(editor);
    })

    it('should create a flow with an API and setup sheets', async ({ page }) => {
        const editor = new NodeRedEditor({ page });
        await insertNodes([httpInNode, sheetsToJsonStreamNode, httpResponseNode]);

        await page.goto(NODERED_URL);

        await editor.elements.closeButton().click()

        await page.locator(`#${sheetsToJsonStreamNode.id}`).dblclick();

        await addValidConfig(editor);

        await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId);
        await editor.elements.sheetsToJSON.sheetIdInput().press('Enter');
        await page.waitForTimeout(3000);

        const selectElement = await editor.elements.sheetsToJSON.sheetListInput()
        const options = await selectElement.evaluate((select) => {
            return Array.from(select.options).map(option => option.value);
        });

        expect(options).toStrictEqual(spreadsheet.sheets);

        await expect(editor.elements.sheetsToJSON.rangeInput()).toHaveValue(spreadsheet.range);
        await expect(editor.elements.sheetsToJSON.columnsInput()).toHaveValue(JSON.stringify(spreadsheet.columns));
        await editor.elements.inputLabel().press('Meta+Enter');
        await editor.elements.workspaceArea().click()
        await editor.elements.workspaceArea().press('Meta+d')
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
