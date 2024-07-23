const spreadsheet = require('./../../spreadsheet.json')

class NodeRedEditor {
    elements = {
        focusedNode: () => cy.get('.red-ui-flow-node'),
        nodeSearchInput: () => cy.get('#red-ui-type-search-input'),
        sheetsToJSON: {
            sheetIdInput: () => cy.get('#node-input-sheetId'),
            sheetListInput: () => cy.get('#node-input-sheetList'),
            rangeInput: () => cy.get('#node-input-range'),
            columnsInput: () => cy.get('#node-input-columns'),
            addNewConfigInputBtn: () => cy.get('#node-input-btn-config-add'),
            gAuth: {
                configArea: () => cy.get('#node-config-input-config'),
            },
        },
        workspaceArea: () => cy.get('#red-ui-workspace-chart')  // Adjust the selector to match the main editor area
    }

    successfullyAutoComplete() {

    }
}

// Usage in a test case
describe('Node-RED Interface', () => {
    const editor = new NodeRedEditor();
    function addSheetsNodeAndOpen() {
        editor.elements.workspaceArea().click({ metaKey: true })
        editor.elements.nodeSearchInput().type('sheets').type('{meta}').type('{enter}')
        editor.elements.focusedNode().dblclick({ force: true })
        cy.wait(500)
    }
    function addValidConfig() {
        editor.elements.sheetsToJSON.addNewConfigInputBtn().click();

        cy.wait(500);

        editor.elements.sheetsToJSON.gAuth.configArea().invoke('val', JSON.stringify(spreadsheet.googleAuthCredentials))
            .type('{meta}{enter}');
    }

    beforeEach(() => {
        // Navigate to the base URL before each test
        cy.visit('/');
    });

    it('should load the Node-RED interface', () => {
        // Check if the page contains the Node-RED header
        cy.contains('Node-RED');
    });

    it('should search for the Sheets module and add it to the workspace', () => {
        cy.viewport(1920, 735)
        cy.visit('/')

        addSheetsNodeAndOpen()
        addValidConfig();

        editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId).type('{enter}')
        cy.wait(500);
        editor.elements.sheetsToJSON.sheetListInput()
            .children('option')
            .should('have.length', spreadsheet.sheets.length) // Ensure the number of options matches
            .each((option, index) => {
                // Validate the value and text of each option
                cy.wrap(option).should('have.value', spreadsheet.sheets[index]);
                cy.wrap(option).should('contain', spreadsheet.sheets[index]);
            });

        editor.elements.sheetsToJSON.rangeInput().should('have.value', spreadsheet.range)
        editor.elements.sheetsToJSON.columnsInput().should('have.value', JSON.stringify(spreadsheet.columns))

    })



});

