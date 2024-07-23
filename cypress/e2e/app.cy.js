const spreadsheet = require('./../../spreadsheet.json')

class NodeRedEditor {
    elements = {
        focusedNode: () => cy.get('.red-ui-flow-node'),
        nodeSearchInput: () => cy.get('#red-ui-type-search-input', { force: true }),
        inputLabel: () => cy.get('#node-input-name'),
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
        httpIn: {
            urlInput: () => cy.get('#node-input-url')
        },
        workspaceArea: () => cy.get('#red-ui-workspace-chart')  // Adjust the selector to match the main editor area
    }

    successfullyAutoComplete() {

    }
}
const editor = new NodeRedEditor();

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
    const insertRequest = await fetch('http://localhost:1880/flows', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(nodes)
    });

    // const response = await fetch('http://localhost:1880/flows')
    // return response.json()
    // cy.
}

// Usage in a test case
describe('Node-RED Interface', () => {
    function addNodeAndOpen(nodeName) {
        editor.elements.workspaceArea().click({ metaKey: true })
        editor.elements.nodeSearchInput().type(nodeName).type('{meta}{enter}')
        editor.elements.focusedNode().dblclick({ force: true })
        const nodeId = `node-${Date.now()}`
        editor.elements.inputLabel().type(nodeId)
        cy.wait(500)

        return nodeId
    }

    function addValidConfig() {
        editor.elements.sheetsToJSON.addNewConfigInputBtn().click();

        cy.wait(500);

        editor.elements.sheetsToJSON.gAuth.configArea().invoke('val', JSON.stringify(spreadsheet.googleAuthCredentials))
            .type('{meta}{enter}');
    }
    function resetChart() {
        editor.elements.workspaceArea().type('{meta}a').type('{del}').type('{meta}d')
        return cy.wait(500);
    }

    beforeEach(() => {
        cy.visit('/').then(() => {
            cy.get('body').should('be.visible');
            return resetChart().then(() => {
                return insertNodes([httpInNode, sheetsToJsonStreamNode, httpResponseNode])
            })

        });
    });


    it('should load sheets data and have values accourding to config', () => {
        cy.viewport(1920, 735)
        cy.visit('/');


        cy.get(`#${sheetsToJsonStreamNode.id}`).should('exist');
        cy.get(`#${sheetsToJsonStreamNode.id}`).dblclick();

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
        editor.elements.inputLabel().type('{meta}{enter}')
    })

    // it('should load sheets data and have values accourding to config', () => {

    //     cy.viewport(1920, 735)
    //     cy.visit('/').then(async () => {

    //         // resetChart()

    //         // const httpInId = addNodeAndOpen('http in')
    //         // editor.elements.httpIn.urlInput().type('/sheets')
    //         // editor.elements.httpIn.urlInput().type('{meta}{enter}')
    //         // cy.wait(200)
    //         // editor.elements.workspaceArea().type('{meta}d')
    //         // cy.wait(500)

    //         // const httpResponseId = addNodeAndOpen('http response')
    //         // cy.wait(500)
    //         // editor.elements.inputLabel().type('{meta}{enter}')


    //     })

    // })



});

