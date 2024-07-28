// @ts-check
const { version } = require('os')

const metaKey = version().includes('Darwin') ? 'Meta' : 'Control'

class NodeRedEditor {
    constructor({ page }) {
        this.page = page
    }

    elements = {
        focusedNode: () => this.page.locator('.red-ui-flow-node'),
        nodeSearchInput: () => this.page.locator('#red-ui-type-search-input'),
        inputLabel: () => this.page.locator('#node-input-name'),
        sheetsToJSON: {
            sheetIdInput: () => this.page.getByPlaceholder('Spreadsheet ID'),
            sheetListInput: () => this.page.locator('#node-input-sheetList'),
            rangeInput: () => this.page.getByRole('textbox', { name: 'Sheet!A1:B2' }),
            columnsInput: () => this.page.getByRole('textbox', { name: "['name', 'email']" }),
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

    async addNodeAndOpen(nodeName) {
        await this.elements.workspaceArea().click();
        await this.elements.nodeSearchInput().type(nodeName);
        await this.elements.focusedNode().dblclick();
        const nodeId = `node-${Date.now()}`;
        await this.elements.inputLabel().type(nodeId);

        return nodeId;
    }

    async addValidConfig(googleAuthCredentials) {
        const configBtn = await this.elements.sheetsToJSON.addNewConfigInputBtn()
        await configBtn.waitFor()

        await configBtn.click();

        await this.elements.sheetsToJSON.gAuth.configArea().fill(JSON.stringify(googleAuthCredentials));
        await this.elements.sheetsToJSON.gAuth.configArea().press(metaKey + '+Enter');
    }

    async resetChart() {
        await this.elements.workspaceArea().focus()
        await this.elements.workspaceArea().press(metaKey + '+a');
        await this.elements.workspaceArea().press('Delete');
        await this.elements.workspaceArea().press(metaKey + '+d');
    }
}

module.exports = NodeRedEditor