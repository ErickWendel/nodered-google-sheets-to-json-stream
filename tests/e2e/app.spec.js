// @ts-nocheck

console.assert(process.env.GOOGLE_SHEETS_AUTH_FILE, 'env GOOGLE_SHEETS_AUTH_FILE is required!')

// @ts-ignore
const spreadsheets = JSON.parse(process.env.GOOGLE_SHEETS_AUTH_FILE || '{}')
if (!spreadsheets?.googleAuthCredentials?.client_email || !spreadsheets?.googleAuthCredentials?.private_key) {
    console.error('env should contain client_email and private_key')
    process.exit(1)
}

const { test, expect } = require('@playwright/test')
const { describe, beforeEach, afterAll, beforeAll } = test;

const { generateTCPFlow, generateEmptyFlow, insertNodes, deleteAllFlows, deleteFlow, generateSheetToJSONNode, changeUserConfig, generatePreviouslyCreatedSheetsToJSON, generateTCPFlowWithCompleteData } = require('./util/nodered');
const createAndTriggerTCPClient = require('./util/tcp-client');
const NodeRedEditor = require('./util/editorElements');

const NODERED_URL = 'http://localhost:1880'
const TCP_PORT = 3000
const { version } = require('os')
const metaKey = version().includes('Darwin') ? 'Meta' : 'Control'

async function cleanField(input) {
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    await input.focus();
    await input.click({ clickCount: 3 });
    await input.press('Backspace');

}
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

    const firstSheet = spreadsheets.sheets.at(0)
    const secondSheet = spreadsheets.sheets.at(1)

    const firstSheetColumns = JSON.stringify(firstSheet.columns)
    const secondSheetColumns = JSON.stringify(secondSheet.columns)

    const sheetsNames = spreadsheets.sheets.map(item => item.name)

    describe('should create a flow with an API and setup sheets', () => {

        test(`Use case: create config and sheets-to-json nodes and set range to consume 2 lines from the sheet`, async ({ page }) => {
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
                await editor.addValidConfig(spreadsheets.googleAuthCredentials);
            });

            await test.step(`And I enter the spreadsheet ID "${spreadsheets.spreadsheetId}" and leave the input field`, async () => {
                await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheets.spreadsheetId);
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
                const input = editor.elements.sheetsToJSON.rangeInput()

                await cleanField(input)

                await input.type(rangeOfTwoLines)
                await page.keyboard.press('Enter')
                await page.keyboard.press(metaKey + '+Enter');
            });

            await test.step('And I can deploy Node-RED without errors', async () => {
                await editor.elements.workspaceArea().click();
                await expect(editor.elements.workspaceArea()).toBeVisible()
                await editor.elements.workspaceArea().press(metaKey + '+d');
            });

            await test.step('Then I can receive two messages with correct columns', async () => {
                await page.waitForTimeout(1000)

                const receivedItems = await createAndTriggerTCPClient({ timeout: 1000, port: TCP_PORT })
                expect(receivedItems.length).toBe(2)

                for (const item of receivedItems) {
                    for (const colum of firstSheet.columns) {
                        expect(item).toHaveProperty(colum)
                    }
                }
            })
        });

        ; {

            const linesToConsume = 4
            const expectedAmountOfLines = linesToConsume - 1
            const expectedAmountOfColumns = 3
            const expectedJSONColumns = firstSheet.columns.slice(2, expectedAmountOfColumns)
            const columnLetter = 'C' // will get only the first 3 columns

            test(`Use case: using range A1:${columnLetter}${linesToConsume} and columns ${JSON.stringify(expectedJSONColumns)} it should process ${expectedAmountOfLines} lines`, async ({ page }) => {
                const editor = new NodeRedEditor({ page });
                const regex = /\:\D+(?<column>[a-zA-Z]+)(?<digits>\d+)/g;
                const expectedRange = firstSheet.range.split(':').at(0).concat(`:${columnLetter}${linesToConsume}`)

                const flow = generateTCPFlowWithCompleteData({
                    sheets: spreadsheets.sheets,
                    spreadsheetId: spreadsheets.spreadsheetId,
                    googleAuthCredentials: spreadsheets.googleAuthCredentials,
                    tcpPort: TCP_PORT,
                })

                await test.step('Given I insert a complete flow using sheets-to-json node and a valid config', async () => {
                    await insertNodes({
                        nodes: Object.values(flow),
                        serverUrl: NODERED_URL
                    });
                });

                await test.step('When I reload the home page the tab should be available', async () => {
                    await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
                });

                await test.step('And I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                await test.step(`And I change the range`, async () => {
                    const input = editor.elements.sheetsToJSON.rangeInput()
                    await cleanField(input)


                    await input.type(expectedRange)
                    await page.keyboard.press('Enter');
                });

                await test.step(`And I change the columns`, async () => {
                    const input = editor.elements.sheetsToJSON.columnsInput()

                    await cleanField(input)

                    await input.type(JSON.stringify(expectedJSONColumns))
                    await page.keyboard.press('Enter');
                });

                await test.step('And I deploy it', async () => {
                    await editor.elements.inputLabel().press(metaKey + '+Enter');
                    const workspaceArea = editor.elements.workspaceArea()
                    await workspaceArea.waitFor();
                    await workspaceArea.click();
                    await workspaceArea.press(metaKey + '+d');
                })

                await test.step(`Then I can receive ${expectedAmountOfLines} messages with columns ${JSON.stringify(expectedJSONColumns)}`, async () => {
                    await page.waitForTimeout(1000)

                    const receivedItems = await createAndTriggerTCPClient({ timeout: 1000, port: TCP_PORT })
                    expect(receivedItems.length).toBe(expectedAmountOfLines)

                    for (const item of receivedItems) {
                        for (const colum of expectedJSONColumns) {
                            expect(item).toHaveProperty(colum)
                        }
                    }
                })

            })
        };

        ; {
            const linesToConsume = 2
            const columnsToConsume = 5
            const expectedAmountOfLines = linesToConsume - 1
            const expectedJSONColumns = firstSheet.columns.slice(2, columnsToConsume) // will ignore the first 3 columns
            const columnLetter = 'E' // will get only the first 5 columns but process 3 starting from the 2nd

            test(`Use case: using range ${firstSheet.range} and columns ${JSON.stringify(expectedJSONColumns)} it should process ${expectedAmountOfLines} lines`, async ({ page }) => {
                const editor = new NodeRedEditor({ page });
                const regex = /\:\D+(?<column>[a-zA-Z]+)(?<digits>\d+)/g;
                const expectedRange = firstSheet.range.split(':').at(0).concat(`:${columnLetter}${linesToConsume}`)

                const flow = generateTCPFlowWithCompleteData({
                    sheets: spreadsheets.sheets,
                    spreadsheetId: spreadsheets.spreadsheetId,
                    googleAuthCredentials: spreadsheets.googleAuthCredentials,
                    tcpPort: TCP_PORT,
                })

                await test.step('Given I insert a complete flow using sheets-to-json node and a valid config', async () => {
                    await insertNodes({
                        nodes: Object.values(flow),
                        serverUrl: NODERED_URL
                    });
                });

                await test.step('When I reload the home page the tab should be available', async () => {
                    await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
                });

                await test.step('And I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                await test.step(`And I change the range`, async () => {
                    const input = editor.elements.sheetsToJSON.rangeInput()
                    await cleanField(input)

                    await input.type(expectedRange)
                    await page.keyboard.press('Enter');
                });

                await test.step(`And I change the columns`, async () => {
                    const input = editor.elements.sheetsToJSON.columnsInput()
                    await cleanField(input)

                    await input.type(JSON.stringify(expectedJSONColumns))
                    await page.keyboard.press('Enter');
                });

                await test.step('And I deploy it', async () => {
                    await editor.elements.inputLabel().press(metaKey + '+Enter');
                    const workspaceArea = editor.elements.workspaceArea()
                    await workspaceArea.waitFor();
                    await workspaceArea.click();
                    await workspaceArea.press(metaKey + '+d');
                })

                await test.step(`Then I can receive ${expectedAmountOfLines} messages with columns ${JSON.stringify(expectedJSONColumns)}`, async () => {
                    await page.waitForTimeout(1000)

                    const receivedItems = await createAndTriggerTCPClient({ timeout: 1000, port: TCP_PORT })
                    expect(receivedItems.length).toBe(expectedAmountOfLines)

                    for (const item of receivedItems) {
                        for (const colum of expectedJSONColumns) {
                            expect(item).toHaveProperty(colum)
                        }
                    }
                })

            })
        }
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
                await editor.addValidConfig(spreadsheets.googleAuthCredentials);
            });

            await test.step(`And I enter the spreadsheet ID "${spreadsheets.spreadsheetId}" and leave the input field`, async () => {
                await editor.elements.sheetsToJSON.sheetIdInput().type(spreadsheets.spreadsheetId);
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
                await columns.waitFor();

                await expect(columns).toHaveValue(JSON.stringify(firstSheet?.columns));
            });

            await test.step(`And the sheet's range should contain "${firstSheet?.range}"`, async () => {
                const range = editor.elements.sheetsToJSON.rangeInput()
                await range.waitFor();
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
                const flow = generatePreviouslyCreatedSheetsToJSON({
                    sheets: [secondSheet, firstSheet],
                    spreadsheetId: spreadsheets.spreadsheetId,
                    googleAuthCredentials: spreadsheets.googleAuthCredentials,
                })

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
                    await test.step('And I open the node', async () => {
                        const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                        const node = page.locator(`#${sheetsToJsonStreamNode}`)
                        await node.waitFor();
                        await node.dblclick();
                    })

                    await test.step(`Then the fields should contain data for spreadsheet id`, async () => {
                        const input = await editor.elements.sheetsToJSON.sheetIdInput()
                        await expect(input).toHaveValue(spreadsheets.spreadsheetId)
                    });

                    await test.step(`And the range field should be ${secondSheet.range}`, async () => {
                        const input = await editor.elements.sheetsToJSON.rangeInput()
                        await expect(input).toHaveValue(secondSheet.range)
                    });

                    await test.step(`And the active sheet id should be ${secondSheet.name}`, async () => {
                        const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                        await expect(selectElement).toBeEnabled();

                        const options = await selectElement.evaluate((select) => {
                            return Array.from(select.options).map(option => option.value);
                        });

                        expect(options).toStrictEqual([
                            secondSheet.name,
                            spreadsheets.sheets.at(0).name
                        ]);
                    });

                    const secondSheetColumns = JSON.stringify(secondSheet.columns)
                    await test.step(`And the columns should be ${secondSheetColumns}`, async () => {
                        const input = await editor.elements.sheetsToJSON.columnsInput();
                        await expect(input).toHaveValue(secondSheetColumns)
                    });
                }

                await runNodeCheckingFields()

                await test.step('And I deploy it', async () => {
                    await editor.elements.inputLabel().press(metaKey + '+Enter');
                    await editor.elements.workspaceArea().click();
                    await editor.elements.workspaceArea().press(metaKey + '+d');
                })

                await test.step('Then the fields should remain as previously saved', async () => {
                    return runNodeCheckingFields()
                })

            })

            test('Use case: if the chosen sheet is changed its columns and range should be updated', async ({ page }) => {
                const editor = new NodeRedEditor({ page });
                const flow = generatePreviouslyCreatedSheetsToJSON({
                    sheets: [secondSheet, firstSheet],
                    spreadsheetId: spreadsheets.spreadsheetId,
                    googleAuthCredentials: spreadsheets.googleAuthCredentials,
                })

                await test.step('Given I insert a complete flow using sheets-to-json node and a valid config', async () => {
                    await insertNodes({
                        nodes: Object.values(flow),
                        serverUrl: NODERED_URL
                    });
                });

                await test.step('When I reload the home page the tab should be available', async () => {
                    await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
                });

                await test.step('And I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                await test.step(`And I choose the sheets ${firstSheet.name}`, async () => {
                    const selectElement = await editor.elements.sheetsToJSON.sheetListInput();
                    await selectElement.waitFor();

                    await selectElement.type(firstSheet.name);
                    await selectElement.focus();
                });

                async function runNodeCheckingFields() {
                    await test.step(`And the active sheet id should be ${firstSheet.name} and the ${secondSheet.name} should be in the end`, async () => {
                        const selectElement = await editor.elements.sheetsToJSON.sheetListInput();

                        const options = await selectElement.evaluate((select) => {
                            return Array.from(select.options).map(option => option.value);
                        });

                        expect(options).toStrictEqual([
                            firstSheet.name,
                            secondSheet.name,
                        ]);
                    });

                    await test.step(`And the range should ${firstSheet.range}`, async () => {
                        const input = await editor.elements.sheetsToJSON.rangeInput()
                        await expect(input).toHaveValue(firstSheet.range)
                    });

                    await test.step(`And the columns should be ${firstSheetColumns}`, async () => {
                        const input = await editor.elements.sheetsToJSON.columnsInput();
                        await expect(input).toHaveValue(firstSheetColumns)
                    });
                }

                await runNodeCheckingFields()

                await test.step('And I deploy it', async () => {
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

            test('Use case: if the chosen range is changed nodered should persist it', async ({ page }) => {
                const editor = new NodeRedEditor({ page });
                const flow = generatePreviouslyCreatedSheetsToJSON({
                    sheets: [secondSheet, firstSheet],
                    spreadsheetId: spreadsheets.spreadsheetId,
                    googleAuthCredentials: spreadsheets.googleAuthCredentials,
                })


                await test.step('Given I insert a complete flow using sheets-to-json node and a valid config', async () => {
                    await insertNodes({
                        nodes: Object.values(flow),
                        serverUrl: NODERED_URL
                    });
                });

                await test.step('When I reload the home page the tab should be available', async () => {
                    await page.goto(`${NODERED_URL}/#flow/${flow.tab.id}`);
                });

                await test.step('And I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                const expectedRange = 'A1:B2'
                await test.step(`And I change the range`, async () => {
                    const input = editor.elements.sheetsToJSON.rangeInput()
                    await cleanField(input)

                    await input.type(expectedRange)
                    await page.keyboard.press('Enter');
                });

                await test.step('And I deploy it', async () => {
                    await editor.elements.inputLabel().press(metaKey + '+Enter');
                    const workspaceArea = editor.elements.workspaceArea()
                    await workspaceArea.waitFor();
                    await workspaceArea.click();
                    await workspaceArea.press(metaKey + '+d');
                })

                await test.step('Then I open the node', async () => {
                    const sheetsToJsonStreamNode = flow.sheetsToJSON.id
                    const node = page.locator(`#${sheetsToJsonStreamNode}`)
                    await node.waitFor();
                    await node.dblclick();
                })

                await test.step(`And the range should be ${expectedRange}`, async () => {
                    const input = await editor.elements.sheetsToJSON.rangeInput()
                    await input.waitFor();
                    await expect(input).toHaveValue(expectedRange)
                });

                await test.step(`And the columns should be ${firstSheetColumns}`, async () => {
                    const input = await editor.elements.sheetsToJSON.columnsInput();
                    await expect(input).toHaveValue(secondSheetColumns)
                });
            })

        })
    })
});
