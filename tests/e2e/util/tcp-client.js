const net = require('net');

function createTCPClient({ timeout, port }) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection({ port }, () => {
            client.write('hey');
        });

        const responses = [];
        let buffer = '';

        client.on('data', (data) => {
            buffer += data.toString();
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
                const line = buffer.substring(0, boundary).trim();
                try {
                    const parsed = JSON.parse(line);
                    responses.push(parsed);
                } catch (err) {
                    console.error('Failed to parse JSON:', err);
                }
                buffer = buffer.substring(boundary + 1);
                boundary = buffer.indexOf('\n');
            }
        });

        setTimeout(() => client.end(), timeout);

        client.on('end', () => {
            return resolve(responses);
        });

        client.on('error', (err) => {
            console.error('Client error:', err);
            reject(err);
        });
    });
}

module.exports = createTCPClient;
