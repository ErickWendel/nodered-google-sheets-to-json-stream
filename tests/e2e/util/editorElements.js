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

    async addNodeAndOpen(nodeName) {
        await this.elements.workspaceArea().click();
        await this.elements.nodeSearchInput().type(nodeName);
        await this.elements.focusedNode().dblclick();
        const nodeId = `node-${Date.now()}`;
        await this.elements.inputLabel().type(nodeId);

        return nodeId;
    }

    async addValidConfig(googleAuthCredentials) {
        await this.elements.sheetsToJSON.addNewConfigInputBtn().click();
        await this.elements.sheetsToJSON.gAuth.configArea().fill(JSON.stringify(googleAuthCredentials));
        await this.elements.sheetsToJSON.gAuth.configArea().press('Meta+Enter');
    }

    async resetChart() {
        await this.elements.workspaceArea().focus()
        await this.elements.workspaceArea().press('Meta+a');
        await this.elements.workspaceArea().press('Delete');
        await this.elements.workspaceArea().press('Meta+d');
    }
}

module.exports = NodeRedEditor