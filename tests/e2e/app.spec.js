// @ts-nocheck

const spreadsheet = require('../../spreadsheet.json');
const { test, expect } = require('@playwright/test')
const { describe, beforeEach, afterAll, beforeAll } = test;

const { generateTCPFlow, generateEmptyFlow, insertNodes, deleteAllFlows, deleteFlow, generateSheetToJSONNode, changeUserConfig, generatePreviouslyCreatedSheetsToJSON } = require('./util/nodered');
const createTCPClient = require('./util/tcp-client');
const NodeRedEditor = require('./util/editorElements');

const NODERED_URL = 'http://localhost:1880'
const TCP_PORT = 3000
const { version } = require('os')
const metaKey = version().includes('Darwin') ? 'Meta' : 'Control'
// Usage in a test case
describe('Node-RED Interface', () => {
    beforeAll(async () => {
        await deleteAllFlows({
            serverUrl: NODERED_URL
        })
        await changeUserConfig({
            serverUrl: NODERED_URL,
            data: {
                "editor": {
                    "view": {
                        "view-store-zoom": false,
                        "view-store-position": false,
                        "view-show-grid": true,
                        "view-snap-grid": true,
                        "view-grid-size": 20,
                        "view-node-status": true,
                        "view-node-show-label": true,
                        "view-show-tips": true,
                        "view-show-welcome-tours": true
                    }
                },
                "menu-deploymenu-item-full": false,
                "menu-deploymenu-item-flow": true,
                "menu-deploymenu-item-node": false
            }
        })
    })

    beforeEach(async ({ page }) => {
        await page.goto(NODERED_URL);
    })

    const firstSheet = spreadsheet.sheets.at(0)
    const sheetsNames = spreadsheet.sheets.map(item => item.name)

    describe('should create a flow with an API and setup sheets', () => {

        test(`Use case: receive data 2 lines from the sheet`, async ({ page }) => {
            const [firstLine, remaining] = firstSheet.range.split(':')
            const secondLine = remaining.replace(/\d+/, '3')
            const rangeOfTwoLines = `${firstLine}:${secondLine}`

            const editor = new NodeRedEditor({ page });
            const flow = generateTCPFlow({ tcpPort: TCP_PORT })

            await test.step('Given I insert a complete flow using TCP and the sheets-to-json node', async () => {
                await insertNodes({
                    nodes: Object.values(flow),
                    serverUrl: NODERED_URL
                });
            });

            await test.step('When I reload the home page the tab should be available', async () => {
                await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
            });

            await test.step('And I add a valid Google authentication configuration', async () => {
                const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                const node = page.locator(`#${sheetsToJsonStreamNode}`)
                await node.waitFor();
                await node.dblclick();
                await editor.addValidConfig(spreadsheet.googleAuthCredentials);
            });

            await test.step(`And I enter the spreadsheet ID "${spreadsheet.spreadsheetId}" and leave the input field`, async () => {
                await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId);
                await editor.elements.sheetsToJSON.sheetIdInput().press('Tab');
            });

            await test.step('Then I should see the list of sheets in the select element', async () => {
                const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                await expect(selectElement).toBeEnabled();

                const options = await selectElement.evaluate((select) => {
                    return Array.from(select.options).map(option => option.value);
                });

                expect(options).toStrictEqual(sheetsNames);
            });

            await test.step(`And I manually choose range as ${rangeOfTwoLines} and save`, async () => {
                const range = editor.elements.sheetsToJSON.rangeInput()
                await expect(range).toBeEnabled()
                await range.focus()

                await range.press(metaKey + '+a');
                await page.keyboard.press('Backspace');

                await range.type(rangeOfTwoLines)
                await range.press('Enter')
                await range.press(metaKey + '+Enter');
            });

            await test.step('And I can deploy Node-RED without errors', async () => {
                await editor.elements.workspaceArea().click();
                await expect(editor.elements.workspaceArea()).toBeVisible()
                await editor.elements.workspaceArea().press(metaKey + '+d');
            });

            await test.step('And I can receive two messages with correct columns', async () => {
                await page.waitForTimeout(1000)

                const receivedItems = await createTCPClient({ timeout: 1000, port: TCP_PORT })
                expect(receivedItems.length).toBe(2)

                for (const item of receivedItems) {
                    for (const colum of firstSheet.columns) {
                        expect(item).toHaveProperty(colum)
                    }
                }
            })
        })
    });

    describe('configuration nodes', () => {
        test('Use case: Successfuly configure sheets to json node with config node ', async ({ page }) => {
            const editor = new NodeRedEditor({ page });
            const flow = generateSheetToJSONNode()

            await test.step('Given a web API flow is available', async () => {
                await insertNodes({
                    serverUrl: NODERED_URL,
                    nodes: Object.values(flow)
                });
            });

            await test.step('When I reload the home page the tab should be available', async () => {
                await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
            });

            await test.step('And I add a valid Google authentication configuration', async () => {
                const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                const node = page.locator(`#${sheetsToJsonStreamNode}`)
                await node.waitFor();

                await node.dblclick();
                await editor.addValidConfig(spreadsheet.googleAuthCredentials);
            });

            await test.step(`And I enter the spreadsheet ID "${spreadsheet.spreadsheetId}" and leave the input field`, async () => {
                await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheet.spreadsheetId);
                await editor.elements.sheetsToJSON.sheetIdInput().press('Tab');
            });

            await test.step('Then I should see the list of sheets in the select element', async () => {
                const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                await expect(selectElement).toBeEnabled();

                const options = await selectElement.evaluate((select) => {
                    return Array.from(select.options).map(option => option.value);
                });

                expect(options).toStrictEqual(sheetsNames);
            });

            await test.step(`And I should see the sheet's columns as an array`, async () => {
                const columns = editor.elements.sheetsToJSON.columnsInput()
                await expect(columns).toBeEnabled();

                await expect(columns).toHaveValue(JSON.stringify(firstSheet?.columns));
            });

            await test.step(`And the sheet's range should contain "${firstSheet?.range}"`, async () => {
                const range = editor.elements.sheetsToJSON.rangeInput()
                await expect(range).toBeEnabled();
                // @ts-ignore
                await expect(range).toHaveValue(firstSheet.range);
            });

            await test.step('And I can deploy Node-RED without errors', async () => {
                await editor.elements.inputLabel().press(metaKey + '+Enter');
                await editor.elements.workspaceArea().click();
                await editor.elements.workspaceArea().press(metaKey + '+d');
            });
        })

        describe('An active flow with correctly config node configured', () => {
            test('Use case: the previously configured fields should remain the same', async ({ page }) => {
                const editor = new NodeRedEditor({ page });
                const flow = generatePreviouslyCreatedSheetsToJSON({ spreadsheet })
                const secondSheet = spreadsheet.sheets.at(1)

                await test.step('Given I insert a complete flow using sheets-to-json node and a valid config', async () => {
                    await insertNodes({
                        nodes: Object.values(flow),
                        serverUrl: NODERED_URL
                    });
                });

                await test.step('When I reload the home page the tab should be available', async () => {
                    await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
                });

                async function runNodeCheckingFields() {
                    await test.step('When I open the node', async () => {
                        const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                        const node = page.locator(`#${sheetsToJsonStreamNode}`)
                        await node.waitFor();
                        await node.dblclick();
                    })

                    await test.step(`Then the fields should contain data for spreadsheet id`, async () => {
                        const input = await editor.elements.sheetsToJSON.sheetIdInput()
                        await expect(input).toHaveValue(spreadsheet.spreadsheetId)
                    });

                    await test.step(`Then the range field should be ${secondSheet.range}`, async () => {
                        const input = await editor.elements.sheetsToJSON.rangeInput()
                        await expect(input).toHaveValue(secondSheet.range)
                    });

                    await test.step(`Then the active sheet id should be ${secondSheet.name}`, async () => {
                        const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                        await expect(selectElement).toBeEnabled();

                        const options = await selectElement.evaluate((select) => {
                            return Array.from(select.options).map(option => option.value);
                        });

                        expect(options).toStrictEqual([
                            secondSheet.name,
                            spreadsheet.sheets.at(0).name
                        ]);
                    });

                    const secondSheetColumns = JSON.stringify(secondSheet.columns)
                    await test.step(`Then the columns should be ${secondSheetColumns}`, async () => {
                        const input = await editor.elements.sheetsToJSON.columnsInput();
                        await expect(input).toHaveValue(secondSheetColumns)
                    });
                }

                await runNodeCheckingFields()

                await test.step('Then when I deploy it', async () => {
                    await editor.elements.inputLabel().press(metaKey + '+Enter');
                    await editor.elements.workspaceArea().click();
                    await editor.elements.workspaceArea().press(metaKey + '+d');
                })

                await test.step('Then the fields should remain as previously saved', async () => {
                    return runNodeCheckingFields()
                })

            })

            test('Use case: if the sheet chosen is changed its columns and range should be updated', async ({ page }) => {
                const editor = new NodeRedEditor({ page });
                const flow = generatePreviouslyCreatedSheetsToJSON({ spreadsheet })

                const firstSheet = spreadsheet.sheets.at(0)
                const secondSheet = spreadsheet.sheets.at(1)

                const firstSheetColumns = JSON.stringify(firstSheet.columns)
                const secondSheetColumns = JSON.stringify(secondSheet.columns)

                await test.step('Given I insert a complete flow using sheets-to-json node and a valid config', async () => {
                    await insertNodes({
                        nodes: Object.values(flow),
                        serverUrl: NODERED_URL
                    });
                });

                await test.step('When I reload the home page the tab should be available', async () => {
                    await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
                });

                await test.step('When I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                await test.step(`When I choose the sheets ${firstSheet.name}`, async () => {
                    const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                    await expect(selectElement).toBeEnabled();

                    await selectElement.type(firstSheet.name)
                    await selectElement.type('Enter')
                });

                async function runNodeCheckingFields() {
                    await test.step(`Then the active sheet id should be ${firstSheet.name} and the ${secondSheet.name} should be in the end`, async () => {
                        const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                        await selectElement.waitFor();

                        const options = await selectElement.evaluate((select) => {
                            return Array.from(select.options).map(option => option.value);
                        });

                        expect(options).toStrictEqual([
                            firstSheet.name,
                            secondSheet.name,
                        ]);
                    });

                    await test.step(`Then the range should ${firstSheet.range}`, async () => {
                        const input = await editor.elements.sheetsToJSON.rangeInput()
                        await expect(input).toHaveValue(firstSheet.range)
                    });

                    await test.step(`Then the columns should be ${firstSheetColumns}`, async () => {
                        const input = await editor.elements.sheetsToJSON.columnsInput();
                        await expect(input).toHaveValue(firstSheetColumns)
                    });
                }

                await runNodeCheckingFields()
                await test.step('Then when I deploy it', async () => {
                    await editor.elements.inputLabel().press(metaKey + '+Enter');
                    await editor.elements.workspaceArea().click();
                    await editor.elements.workspaceArea().press(metaKey + '+d');
                })

                await test.step('Then I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                await test.step('Then the fields should remain as previously saved', async () => {
                    return runNodeCheckingFields()
                })
            })
        })

    })

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
