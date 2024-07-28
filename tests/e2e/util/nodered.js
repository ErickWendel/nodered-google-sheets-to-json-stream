const { randomUUID } = require('crypto')
const generateRandomId = () => 'node-' + randomUUID().slice(0, 8)
const generateRandomName = (base, id) => base + '-' + id;
function generateEmptyFlow() {
    const tabId = generateRandomId()
    return {
        tab: {
            id: tabId,
            info: '',
            type: 'tab',
            label: `Flow 1`
        },
    }
}
function generateValidConfigNode({ spreadsheet }) {

    const nodeId = generateRandomId()
    return {
        config: {
            "id": nodeId,
            "type": "gauth",
            "name": spreadsheet.googleAuthCredentials.client_email,
            "credentials": {
                "config": JSON.stringify(spreadsheet.googleAuthCredentials)
            }
        }
    }
}

function generatePreviouslyCreatedSheetsToJSON({ spreadsheet }) {

    const emptyTaB = generateEmptyFlow()
    const validConfig = generateValidConfigNode({ spreadsheet })
    const nodeSheetId = generateRandomId()
    const [firstSheet, secondSheet] = spreadsheet.sheets

    const generateSheetValuesWithSecondItemEnabled = [secondSheet, firstSheet].map((item, index) => {
        return {
            text: item.name,
            value: item.name,
            selected: index === 0
        }
    })

    return {
        tab: emptyTaB.tab,
        config: validConfig.config,
        sheetsToJSON: {
            "id": nodeSheetId,
            "type": "sheets-to-json-stream",
            "z": emptyTaB.tab.id,
            "config": validConfig.config.id,
            "sheetId": spreadsheet.spreadsheetId,
            "sheetList": secondSheet.name,
            "sheetListValues": JSON.stringify(generateSheetValuesWithSecondItemEnabled),
            "range": secondSheet.range,
            "columns": JSON.stringify(secondSheet.columns),
            "name": secondSheet.name,
            "x": 160,
            "y": 100,
            "wires": [
                []
            ]
        }
    }
}

function generateSheetToJSONNode() {

    const sheetsToJsonStreamNodeId = generateRandomId();
    const tabId = generateRandomId()
    return {
        tab: {
            id: tabId,
            info: '',
            type: 'tab',
            label: `Flow ${tabId}`
        },
        sheetsToJSON: {
            id: sheetsToJsonStreamNodeId,
            type: 'sheets-to-json-stream',
            name: generateRandomName('Sheets to JSON Stream', sheetsToJsonStreamNodeId),
            "x": 200,
            "y": 250,
            z: tabId,
            wires: [[]]
        },
    }
}

function generateTCPFlow({ tcpPort }) {
    const tcpInNodeId = generateRandomId();
    const sheetsToJsonStreamNodeId = generateRandomId();
    const tcpRespondeNodeId = generateRandomId();
    const formatToStringFn = generateRandomId();
    const debugNodeId = generateRandomId()
    const tabId = generateRandomId()
    return {
        tab: {
            id: tabId,
            info: '',
            type: 'tab',
            label: `Flow ${tabId}`
        },
        tcpIn: {
            id: tcpInNodeId,
            name: generateRandomName('TCP In', tcpInNodeId),
            "type": "tcp in",
            "server": "server",
            "host": "localhost",
            "port": tcpPort,
            "datamode": "stream",
            "datatype": "buffer",
            "newline": "",
            "topic": "",
            "trim": false,
            "base64": false,
            "tls": "",
            "x": 120,
            "y": 180,
            z: tabId,
            wires: [[sheetsToJsonStreamNodeId]]
        },
        sheetsToJSON: {
            id: sheetsToJsonStreamNodeId,
            type: 'sheets-to-json-stream',
            name: generateRandomName('Sheets to JSON Stream', sheetsToJsonStreamNodeId),
            "x": 200, "y": 250,
            z: tabId,
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
            z: tabId,
            wires: [[tcpRespondeNodeId, debugNodeId]]
        },
        debug: {
            id: debugNodeId,
            type: "debug",
            name: generateRandomName('Debug', debugNodeId),
            active: true,
            outputs: 1,
            "x": 580,
            "y": 300,
            z: tabId,
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
            z: tabId,
            "wires": []
        }
    }
}

async function deleteFlow({ serverUrl, flowId }) {
    return fetch(`${serverUrl}/flow/${flowId}`, {
        method: 'DELETE'
    });
}

async function changeUserConfig({ serverUrl, data }) {
    return fetch(`${serverUrl}/settings/user`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function deleteAllFlows({ serverUrl }) {
    const flows = await getAllFlows({ serverUrl });
    const tab = flows.find(item => item.label === 'Flow 1')
    const deletePromises = flows.map(async (flow) => {
        const flowId = flow.id;
        if (flowId === tab?.id) return

        return deleteFlow({ serverUrl, flowId })
    });

    return Promise.all(deletePromises);
}

async function getAllFlows({ serverUrl }) {
    const flows = await (await fetch(`${serverUrl}/flows`)).json()
    return flows
}

async function insertNodes({ nodes, serverUrl }) {
    // const flows = await getAllFlows({ serverUrl })
    const payload = [
        // ...flows,
        ...nodes,
    ]

    return await fetch(`${serverUrl}/flows`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

module.exports = {
    generateTCPFlow,
    generatePreviouslyCreatedSheetsToJSON,
    generateSheetToJSONNode,
    generateEmptyFlow,
    changeUserConfig,
    insertNodes,
    deleteFlow,
    deleteAllFlows
}