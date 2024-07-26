const generateRandomId = () => 'node-' + Math.random().toString(36).substr(2, 9);

const generateRandomName = (base, id) => base + '-' + id;
function generateFlow({ tcpPort }) {
    // Generate unique IDs and names for the nodes

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
            active: true,
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
async function insertNodes({ nodes, serverUrl }) {
    const flows = await (await fetch(`${serverUrl}/flows`)).json()
    const tab = flows.find(item => item.label === 'Flow 1')
    nodes.forEach(node => node.z = tab.id)
    const payload = [
        tab,
        ...nodes
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
    generateFlow,
    insertNodes
}