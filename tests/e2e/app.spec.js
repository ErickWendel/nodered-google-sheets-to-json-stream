// @ts-check

const spreadsheet = require('../../spreadsheet.json');
const { test, expect } = require('@playwright/test')
const { describe, beforeEach } = test;

const { generateFlow, insertNodes } = require('./util/nodered');
const createTCPClient = require('./util/tcp-client');
const NodeRedEditor = require('./util/editorElements');

const NODERED_URL = 'http://localhost:1880'
const TCP_PORT = 6123


// Usage in a test case
describe('Node-RED Interface', () => {


    beforeEach(async ({ page }) => {
        return test.step('Given a clean nodered instance', async () => {
            const editor = new NodeRedEditor({ page });
            await page.goto(NODERED_URL);
            await editor.resetChart();
        })
    })


    describe('should create a flow with an API and setup sheets', () => {
        test('Use case: Successfuly configure node ', async ({ page }) => {
            const editor = new NodeRedEditor({ page });
            const flow = generateFlow({ tcpPort: TCP_PORT })

            await test.step('Given a web API flow is available', async () => {
                await insertNodes({
                    serverUrl: NODERED_URL,
                    nodes: Object.values(flow)
                });
            });

            await test.step('When I reload the home page', async () => {
                await page.goto(NODERED_URL);
            });

            await test.step('And I add a valid Google authentication configuration', async () => {
                const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                await page.locator(`#${sheetsToJsonStreamNode}`).dblclick();
                await editor.addValidConfig(spreadsheet.googleAuthCredentials);
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
            const flow = generateFlow({ tcpPort: TCP_PORT })
            await test.step('Given a web API flow is available', async () => {
                await insertNodes({
                    nodes: Object.values(flow),
                    serverUrl: NODERED_URL
                });
            });

            await test.step('When I reload the home page', async () => {
                await page.goto(NODERED_URL);
            });

            await test.step('And I add a valid Google authentication configuration', async () => {
                const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                await page.locator(`#${sheetsToJsonStreamNode}`).dblclick();
                await editor.addValidConfig(spreadsheet.googleAuthCredentials);
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
                const receivedItems = await createTCPClient({ timeout: 1200, port: TCP_PORT })
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
