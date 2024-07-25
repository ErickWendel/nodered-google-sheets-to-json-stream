
const net = require('net');
function createTCPClient({ timeout, port }) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection({ port }, () => {
            client.write('hey');
        });

        setTimeout(() => client.end(), timeout)

        const responses = []
        client.on('data', (data) => {
            const msg = data.toString().trim().split('\n').map(line => JSON.parse(line))
            responses.push(...msg)
        });

        client.on('end', () => {
            return resolve(responses);
        });

        client.on('error', (err) => {
            console.error('Client error:', err);
            reject(err);
        });
    });
}

module.exports = createTCPClient